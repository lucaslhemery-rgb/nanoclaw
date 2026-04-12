import { logger } from './logger.js';
import {
  NOTION_API_KEY,
  NOTION_POLL_INTERVAL,
  NOTION_PROJECTS_DB_ID,
} from './config.js';
import { upsertNotionProject } from './db.js';
import type { NotionProjectActivity, WebhookDeps } from './types.js';

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

interface NotionPage {
  id: string;
  last_edited_time: string;
  properties: Record<string, any>;
}

// Cache pour résoudre les relations Client (page ID → nom)
const clientNameCache = new Map<string, string>();

async function resolveClientName(pageId: string): Promise<string> {
  const cached = clientNameCache.get(pageId);
  if (cached !== undefined) return cached;

  try {
    const res = await fetch(`${NOTION_API_BASE}/pages/${pageId}`, {
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
      },
    });
    if (!res.ok) return '';
    const page = (await res.json()) as NotionPage;
    // Chercher la propriété titre (type=title)
    for (const prop of Object.values(page.properties || {})) {
      if (prop?.type === 'title' && prop.title?.length > 0) {
        const name = prop.title[0].plain_text || '';
        clientNameCache.set(pageId, name);
        return name;
      }
    }
  } catch {
    // Silently fail, return empty
  }
  clientNameCache.set(pageId, '');
  return '';
}

export function parseNotionProjects(
  results: NotionPage[],
  clientNames?: Map<string, string>,
): NotionProjectActivity[] {
  const now = new Date().toISOString();
  return results.map((page) => {
    // Propriété titre : Nom (fr) ou Name (en)
    const nameProperty = page.properties?.Nom || page.properties?.Name;
    const titleArray = nameProperty?.title || [];
    const projectName =
      titleArray.length > 0 ? titleArray[0].plain_text : 'Sans titre';

    // Propriété statut : État (fr) ou Status (en)
    const statusProperty =
      page.properties?.['État'] ||
      page.properties?.Status ||
      page.properties?.Statut;
    const status =
      statusProperty?.status?.name || statusProperty?.select?.name || '';

    // Client : relation (résolu via clientNames) ou select ou texte
    const clientProperty = page.properties?.Client;
    let clientSlug = '';
    if (clientProperty?.type === 'relation' && clientProperty.relation?.length > 0) {
      const clientId = clientProperty.relation[0].id;
      const resolvedName = clientNames?.get(clientId) || '';
      clientSlug = resolvedName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
    } else if (clientProperty?.select?.name) {
      clientSlug = clientProperty.select.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
    }

    return {
      notion_page_id: page.id,
      client_slug: clientSlug,
      project_name: projectName,
      status,
      last_edited_time: page.last_edited_time,
      last_checked_time: now,
      last_status_change_time: null,
      previous_status: null,
    };
  });
}

export function formatStatusChangeNotification(
  clientSlug: string,
  projectName: string,
  previousStatus: string,
  newStatus: string,
): string {
  return [
    `*Notion* - Changement de statut`,
    `Client : ${clientSlug}`,
    `Projet : ${projectName}`,
    `${previousStatus} → ${newStatus}`,
  ].join('\n');
}

async function queryNotionDatabase(): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(
      `${NOTION_API_BASE}/databases/${NOTION_PROJECTS_DB_ID}/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Notion API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as {
      results: NotionPage[];
      has_more: boolean;
      next_cursor?: string;
    };
    pages.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return pages;
}

async function pollOnce(deps: WebhookDeps): Promise<void> {
  const mainJid = deps.getMainGroupJid();
  if (!mainJid) {
    logger.warn('Notion poller: no main group, skipping');
    return;
  }

  const pages = await queryNotionDatabase();

  // Résoudre les relations Client (page IDs → noms)
  const clientIds = new Set<string>();
  for (const page of pages) {
    const rel = page.properties?.Client?.relation;
    if (rel?.length > 0) clientIds.add(rel[0].id);
  }
  const clientNames = new Map<string, string>();
  for (const id of clientIds) {
    const name = await resolveClientName(id);
    if (name) clientNames.set(id, name);
  }

  const projects = parseNotionProjects(pages, clientNames);

  const notifications: string[] = [];

  for (const project of projects) {
    const { statusChanged, previousStatus } = upsertNotionProject(project);
    if (statusChanged && previousStatus) {
      notifications.push(
        formatStatusChangeNotification(
          project.client_slug,
          project.project_name,
          previousStatus,
          project.status,
        ),
      );
    }
  }

  if (notifications.length > 0) {
    await deps.sendMessage(mainJid, notifications.join('\n\n'));
  }

  logger.debug(
    { projectCount: projects.length, changes: notifications.length },
    'Notion poll completed',
  );
}

export function startNotionPoller(deps: WebhookDeps): void {
  if (!NOTION_API_KEY || !NOTION_PROJECTS_DB_ID) {
    logger.warn(
      'Notion: NOTION_API_KEY or NOTION_PROJECTS_DB_ID not set, skipping poller',
    );
    return;
  }

  logger.info({ intervalMs: NOTION_POLL_INTERVAL }, 'Starting Notion poller');

  // Premier poll après 10 secondes (laisser le temps au système de démarrer)
  setTimeout(() => {
    pollOnce(deps).catch((err) => logger.error({ err }, 'Notion poll error'));
  }, 10_000);

  // Polls suivants
  setInterval(() => {
    pollOnce(deps).catch((err) => logger.error({ err }, 'Notion poll error'));
  }, NOTION_POLL_INTERVAL);
}

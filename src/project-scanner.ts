import { getInactiveProjects } from './db.js';
import { logger } from './logger.js';
import type { NotionProjectActivity, WebhookDeps } from './types.js';

const INACTIVITY_THRESHOLD_DAYS = 5;

function daysSince(isoDate: string): number {
  return Math.floor(
    (Date.now() - new Date(isoDate).getTime()) / (24 * 60 * 60 * 1000),
  );
}

export function formatInactivityReport(
  projects: NotionProjectActivity[],
): string | null {
  if (projects.length === 0) return null;

  const lines = projects.map((p) => {
    const days = daysSince(p.last_edited_time);
    return `  - ${p.client_slug} / ${p.project_name} (${days}j, statut: ${p.status || 'inconnu'})`;
  });

  return [
    `*Scan hebdo* - ${projects.length} projets sans activité depuis ${INACTIVITY_THRESHOLD_DAYS}+ jours`,
    '',
    ...lines,
  ].join('\n');
}

export async function runProjectScan(deps: WebhookDeps): Promise<void> {
  const mainJid = deps.getMainGroupJid();
  if (!mainJid) {
    logger.warn('Project scanner: no main group, skipping');
    return;
  }

  const inactive = getInactiveProjects(INACTIVITY_THRESHOLD_DAYS);
  const report = formatInactivityReport(inactive);

  if (report) {
    await deps.sendMessage(mainJid, report);
    logger.info(
      { inactiveCount: inactive.length },
      'Project inactivity report sent',
    );
  } else {
    logger.debug('No inactive projects found');
  }
}

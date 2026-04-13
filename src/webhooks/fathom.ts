import crypto from 'crypto';
import fs from 'fs';

import { CLIENT_MAPPING_PATH, FATHOM_WEBHOOK_SECRET } from '../config.js';
import { logger } from '../logger.js';
import type { WebhookDeps, WebhookHandler } from '../types.js';
import { registerWebhook } from './registry.js';

// --- Client mapping ---

interface ClientMapping {
  aliases: Record<string, string>; // alias (lowercase) → client slug
}

let clientMapping: ClientMapping = { aliases: {} };

function loadClientMapping(): void {
  try {
    if (fs.existsSync(CLIENT_MAPPING_PATH)) {
      const raw = fs.readFileSync(CLIENT_MAPPING_PATH, 'utf-8');
      clientMapping = JSON.parse(raw) as ClientMapping;
      logger.info(
        { aliasCount: Object.keys(clientMapping.aliases).length },
        'Client mapping loaded',
      );
    } else {
      logger.warn(
        { path: CLIENT_MAPPING_PATH },
        'Client mapping file not found, client detection disabled',
      );
    }
  } catch (err) {
    logger.error(
      { err, path: CLIENT_MAPPING_PATH },
      'Failed to load client mapping',
    );
  }
}

loadClientMapping();

// --- Signature verification (HMAC-SHA256, Svix/Standard Webhooks) ---

const TIMESTAMP_TOLERANCE_SECONDS = 300; // 5 minutes

function getWebhookSecret(): string | null {
  if (!FATHOM_WEBHOOK_SECRET) return null;
  // Svix secrets are prefixed with "whsec_" and base64-encoded after that
  return FATHOM_WEBHOOK_SECRET.startsWith('whsec_')
    ? FATHOM_WEBHOOK_SECRET.slice(6)
    : FATHOM_WEBHOOK_SECRET;
}

function verifySignature(
  headers: Record<string, string | undefined>,
  rawBody: Buffer,
): boolean {
  const secret = getWebhookSecret();
  if (!secret) {
    logger.warn('FATHOM_WEBHOOK_SECRET not set, rejecting webhook');
    return false;
  }

  const webhookId = headers['webhook-id'];
  const webhookTimestamp = headers['webhook-timestamp'];
  const webhookSignature = headers['webhook-signature'];

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    logger.warn('Missing webhook signature headers');
    return false;
  }

  // Timestamp tolerance check
  const ts = parseInt(webhookTimestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > TIMESTAMP_TOLERANCE_SECONDS) {
    logger.warn(
      { delta: now - ts },
      'Webhook timestamp outside tolerance window',
    );
    return false;
  }

  // Compute expected signature: HMAC-SHA256 of "{webhook-id}.{webhook-timestamp}.{body}"
  const secretBytes = Buffer.from(secret, 'base64');
  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody.toString('utf-8')}`;
  const expected = crypto
    .createHmac('sha256', secretBytes)
    .update(signedContent)
    .digest('base64');

  // webhook-signature may contain multiple signatures separated by spaces (v1,xxx v1,yyy)
  const signatures = webhookSignature.split(' ');
  for (const sig of signatures) {
    // Format: "v1,<base64>"
    const parts = sig.split(',');
    if (parts.length !== 2) continue;
    const sigValue = parts[1];
    const sigBuf = Buffer.from(sigValue, 'base64');
    const expectedBuf = Buffer.from(expected, 'base64');
    if (
      sigBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(sigBuf, expectedBuf)
    ) {
      return true;
    }
  }

  logger.warn('Webhook signature mismatch');
  return false;
}

// --- Client detection ---

interface FathomPayload {
  // Champs du webhook Fathom (meeting_content_ready)
  recording_id?: string;
  url?: string;
  share_url?: string;
  title?: string;
  default_summary?: string;
  transcript?: unknown;
  action_items?: unknown[];
  calendar_invitees?: Array<{ name?: string; email?: string }>;
  // Fallback pour des champs alternatifs
  summary?: string;
  short_summary?: string;
  participants?: Array<{ name?: string; email?: string }>;
  [key: string]: unknown;
}

function matchAliases(texts: string[]): {
  slugs: Set<string>;
  matchedOn: string;
} {
  const slugs = new Set<string>();
  let matchedOn = '';
  for (const text of texts) {
    for (const [alias, slug] of Object.entries(clientMapping.aliases)) {
      if (text.includes(alias.toLowerCase())) {
        slugs.add(slug);
        if (!matchedOn) matchedOn = `"${alias}" dans "${text.slice(0, 80)}"`;
      }
    }
  }
  return { slugs, matchedOn };
}

function detectClient(
  payload: FathomPayload,
):
  | { slug: string; matchedOn: string }
  | { ambiguous: string[]; matchedOn: string }
  | null {
  // Priorité 1 : titre + participants (match fort)
  const strongTexts: string[] = [];
  if (typeof payload.title === 'string') strongTexts.push(payload.title.toLowerCase());
  const participants = payload.calendar_invitees || payload.participants || [];
  for (const p of participants) {
    if (typeof p.name === 'string') strongTexts.push(p.name.toLowerCase());
    if (typeof p.email === 'string') strongTexts.push(p.email.toLowerCase());
  }

  const strong = matchAliases(strongTexts);
  if (strong.slugs.size === 1) {
    return { slug: [...strong.slugs][0], matchedOn: strong.matchedOn };
  }
  if (strong.slugs.size > 1) {
    return { ambiguous: [...strong.slugs], matchedOn: strong.matchedOn };
  }

  // Priorité 2 : summary (match faible - seulement si un seul client)
  const weakTexts: string[] = [];
  const rawSummary =
    payload.default_summary ?? payload.summary ?? payload.short_summary;
  const summaryText = typeof rawSummary === 'string' ? rawSummary : '';
  if (summaryText) weakTexts.push(summaryText.toLowerCase());

  const weak = matchAliases(weakTexts);
  if (weak.slugs.size === 1) {
    return {
      slug: [...weak.slugs][0],
      matchedOn: `${weak.matchedOn} (via summary)`,
    };
  }
  if (weak.slugs.size > 1) {
    // Call interne multi-client - lister les clients mentionnés
    return {
      ambiguous: [...weak.slugs],
      matchedOn: 'multiple clients dans le summary',
    };
  }

  return null;
}

// --- Handler ---

const fathomHandler: WebhookHandler = {
  verify(headers, rawBody) {
    return verifySignature(headers, rawBody);
  },

  async handle(payload: unknown, deps: WebhookDeps) {
    const data = payload as FathomPayload;
    logger.info(
      {
        keys: Object.keys(data),
        title: data.title,
        recording_id: data.recording_id,
      },
      'Fathom webhook payload received',
    );
    const mainJid = deps.getMainGroupJid();
    if (!mainJid) {
      logger.warn('No main group configured, cannot deliver Fathom webhook');
      return;
    }

    const title = data.title || 'Sans titre';
    const shareUrl = data.share_url || data.url || '';
    const summary =
      data.default_summary || data.summary || data.short_summary || '';

    const clientResult = detectClient(data);

    if (!clientResult) {
      // Aucun match - notifier Lucas
      const msg = [
        `*Fathom* - Nouveau meeting`,
        `Titre : ${title}`,
        shareUrl ? `Lien : ${shareUrl}` : '',
        summary ? `\nResum\u00e9 : ${summary}` : '',
        `\nAucun client d\u00e9tect\u00e9. V\u00e9rifie le mapping ou assigne manuellement.`,
      ]
        .filter(Boolean)
        .join('\n');
      await deps.sendMessage(mainJid, msg);
      return;
    }

    if ('ambiguous' in clientResult) {
      // Ambiguite (R2) - ne rien ecrire, notifier
      const msg = [
        `*Fathom* - Ambigu\u00eft\u00e9 client (R2)`,
        `Titre : ${title}`,
        shareUrl ? `Lien : ${shareUrl}` : '',
        `Clients d\u00e9tect\u00e9s : ${clientResult.ambiguous.join(', ')}`,
        `Match : ${clientResult.matchedOn}`,
        `\nAction requise : assigne le bon client manuellement.`,
      ]
        .filter(Boolean)
        .join('\n');
      await deps.sendMessage(mainJid, msg);
      return;
    }

    // Match unique
    const msg = [
      `*Fathom* - Meeting ${clientResult.slug}`,
      `Titre : ${title}`,
      shareUrl ? `Lien : ${shareUrl}` : '',
      summary ? `\nResum\u00e9 : ${summary}` : '',
      `\nClient : ${clientResult.slug} (via ${clientResult.matchedOn})`,
    ]
      .filter(Boolean)
      .join('\n');
    await deps.sendMessage(mainJid, msg);
  },
};

registerWebhook('fathom', fathomHandler);

export type EmailPriority = 'urgent' | 'normal';

export interface TriageResult {
  priority: EmailPriority;
  clientSlug: string | null;
  reason: string;
}

const URGENT_KEYWORDS = [
  'urgent',
  'asap',
  'bloqué',
  'bloque',
  'bloquer',
  'critique',
  'problème',
  'probleme',
  'panne',
  'down',
  'bug',
  'erreur',
];

export function classifyEmail(
  senderEmail: string,
  subject: string,
  body: string,
  clientEmailMap: Record<string, string>,
): TriageResult {
  const lowerSender = senderEmail.toLowerCase();
  const lowerSubject = subject.toLowerCase();
  const lowerBody = body.toLowerCase().slice(0, 500);

  // Vérifier si l'expéditeur est un client connu
  const clientSlug = clientEmailMap[lowerSender] ?? null;
  if (clientSlug) {
    return { priority: 'urgent', clientSlug, reason: 'client connu' };
  }

  // Vérifier les mots-clés urgence dans le sujet
  for (const keyword of URGENT_KEYWORDS) {
    if (lowerSubject.includes(keyword)) {
      return {
        priority: 'urgent',
        clientSlug: null,
        reason: `mot-clé "${keyword}" dans le sujet`,
      };
    }
  }

  // Vérifier les mots-clés urgence dans le body (premiers 500 chars)
  for (const keyword of URGENT_KEYWORDS) {
    if (lowerBody.includes(keyword)) {
      return {
        priority: 'urgent',
        clientSlug: null,
        reason: `mot-clé "${keyword}" dans le corps`,
      };
    }
  }

  return { priority: 'normal', clientSlug: null, reason: '' };
}

export function formatUrgentEmailNotification(
  senderName: string,
  senderEmail: string,
  subject: string,
  bodyPreview: string,
  clientSlug: string | null,
  reason: string,
): string {
  const lines = [
    `*Email urgent*${clientSlug ? ` - ${clientSlug}` : ''}`,
    `De : ${senderName} <${senderEmail}>`,
    `Sujet : ${subject}`,
    `Raison : ${reason}`,
    '',
    bodyPreview.slice(0, 300),
  ];
  return lines.join('\n');
}

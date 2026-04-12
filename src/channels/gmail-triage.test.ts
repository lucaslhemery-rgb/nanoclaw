import { describe, it, expect } from 'vitest';
import { classifyEmail } from './gmail-triage.js';

describe('classifyEmail', () => {
  const clientAliases = {
    'cindy@bistrobiz.com': 'bistrobiz',
    'mikael@shifterpro.com': 'azmk',
  };

  it('classifies email from known client as urgent', () => {
    const result = classifyEmail(
      'cindy@bistrobiz.com',
      'Re: Webinaire',
      'Bonjour, le webinaire est prêt',
      clientAliases,
    );
    expect(result.priority).toBe('urgent');
    expect(result.clientSlug).toBe('bistrobiz');
  });

  it('classifies email with urgent keyword as urgent', () => {
    const result = classifyEmail(
      'random@example.com',
      'URGENT : problème facturation',
      'Il y a un souci',
      clientAliases,
    );
    expect(result.priority).toBe('urgent');
  });

  it('classifies normal email as normal', () => {
    const result = classifyEmail(
      'newsletter@service.com',
      'Weekly digest',
      'Here are the news...',
      clientAliases,
    );
    expect(result.priority).toBe('normal');
  });
});

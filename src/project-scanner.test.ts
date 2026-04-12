import { describe, it, expect } from 'vitest';
import { formatInactivityReport } from './project-scanner.js';
import type { NotionProjectActivity } from './types.js';

describe('formatInactivityReport', () => {
  it('formats a report with multiple inactive projects', () => {
    const projects: NotionProjectActivity[] = [
      {
        notion_page_id: 'p1',
        client_slug: 'azmk',
        project_name: 'Webinaire',
        status: 'En cours',
        last_edited_time: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        last_checked_time: new Date().toISOString(),
        last_status_change_time: null,
        previous_status: null,
      },
      {
        notion_page_id: 'p2',
        client_slug: 'numadeo',
        project_name: 'VSL',
        status: 'En cours',
        last_edited_time: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        last_checked_time: new Date().toISOString(),
        last_status_change_time: null,
        previous_status: null,
      },
    ];

    const report = formatInactivityReport(projects);
    expect(report).toContain('2 projets sans activité');
    expect(report).toContain('azmk');
    expect(report).toContain('numadeo');
    expect(report).toContain('7j');
    expect(report).toContain('6j');
  });

  it('returns null when no inactive projects', () => {
    const report = formatInactivityReport([]);
    expect(report).toBeNull();
  });
});

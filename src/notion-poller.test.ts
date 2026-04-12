import { describe, it, expect } from 'vitest';
import { parseNotionProjects, formatStatusChangeNotification } from './notion-poller.js';

describe('parseNotionProjects', () => {
  it('extracts project name, status, client slug, and last_edited_time from Notion results', () => {
    const notionResults = [
      {
        id: 'page-1',
        last_edited_time: '2026-04-12T10:00:00.000Z',
        properties: {
          Name: { title: [{ plain_text: 'Webinaire Club' }] },
          Status: { status: { name: 'En cours' } },
          Client: { select: { name: 'BistroBiz' } },
        },
      },
    ];

    const projects = parseNotionProjects(notionResults);
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({
      notion_page_id: 'page-1',
      project_name: 'Webinaire Club',
      status: 'En cours',
      client_slug: 'bistrobiz',
      last_edited_time: '2026-04-12T10:00:00.000Z',
    });
  });

  it('handles missing properties gracefully', () => {
    const notionResults = [
      {
        id: 'page-2',
        last_edited_time: '2026-04-12T10:00:00.000Z',
        properties: {
          Name: { title: [] },
          Status: { status: null },
        },
      },
    ];

    const projects = parseNotionProjects(notionResults);
    expect(projects).toHaveLength(1);
    expect(projects[0].project_name).toBe('Sans titre');
    expect(projects[0].status).toBe('');
  });
});

describe('formatStatusChangeNotification', () => {
  it('formats a status change message', () => {
    const msg = formatStatusChangeNotification('BistroBiz', 'Webinaire Club', 'En attente', 'En cours');
    expect(msg).toContain('BistroBiz');
    expect(msg).toContain('Webinaire Club');
    expect(msg).toContain('En attente');
    expect(msg).toContain('En cours');
  });
});

import { describe, it, expect } from 'vitest';
import {
  parseNotionProjects,
  formatStatusChangeNotification,
} from './notion-poller.js';

describe('parseNotionProjects', () => {
  it('extracts from Nom/État (french Notion properties)', () => {
    const notionResults = [
      {
        id: 'page-1',
        last_edited_time: '2026-04-12T10:00:00.000Z',
        properties: {
          Nom: { type: 'title', title: [{ plain_text: 'Webinaire Club' }] },
          État: { type: 'status', status: { name: 'En cours' } },
          Client: {
            type: 'relation',
            relation: [{ id: 'client-abc' }],
          },
        },
      },
    ];

    const clientNames = new Map([['client-abc', 'BistroBiz']]);
    const projects = parseNotionProjects(notionResults, clientNames);
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({
      notion_page_id: 'page-1',
      project_name: 'Webinaire Club',
      status: 'En cours',
      client_slug: 'bistrobiz',
      last_edited_time: '2026-04-12T10:00:00.000Z',
    });
  });

  it('falls back to Name/Status (english properties)', () => {
    const notionResults = [
      {
        id: 'page-en',
        last_edited_time: '2026-04-12T10:00:00.000Z',
        properties: {
          Name: { type: 'title', title: [{ plain_text: 'Test Project' }] },
          Status: { type: 'status', status: { name: 'Active' } },
          Client: { type: 'select', select: { name: 'Acme' } },
        },
      },
    ];

    const projects = parseNotionProjects(notionResults);
    expect(projects[0].project_name).toBe('Test Project');
    expect(projects[0].status).toBe('Active');
    expect(projects[0].client_slug).toBe('acme');
  });

  it('handles missing properties gracefully', () => {
    const notionResults = [
      {
        id: 'page-2',
        last_edited_time: '2026-04-12T10:00:00.000Z',
        properties: {
          Nom: { type: 'title', title: [] },
          État: { type: 'status', status: null },
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
    const msg = formatStatusChangeNotification(
      'BistroBiz',
      'Webinaire Club',
      'En attente',
      'En cours',
    );
    expect(msg).toContain('BistroBiz');
    expect(msg).toContain('Webinaire Club');
    expect(msg).toContain('En attente');
    expect(msg).toContain('En cours');
  });
});

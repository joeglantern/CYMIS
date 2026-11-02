import { describe, expect, it } from 'vitest';
import { isActive, navFor, type NavItem } from './nav';

const labels = (items: NavItem[]) => items.map((i) => i.label);
const lit = (path: string) => {
  const { main, more } = navFor('ADMIN', 0);
  return labels([...main, ...more].filter((i) => isActive(path, i)));
};

describe('navFor', () => {
  it('gives admins the agreed order', () => {
    const { main, more } = navFor('ADMIN', 0);
    expect(labels(main)).toEqual(['Overview', 'Yard planning', 'Yard management', 'Shift planning', 'Reports']);
    expect(labels(more)).toEqual(['Review queue', 'Containers', 'People', 'Settings']);
  });

  it('gives supervisors the same order without Yard management', () => {
    const { main, more } = navFor('SUPERVISOR', 0);
    expect(labels(main)).toEqual(['Overview', 'Yard planning', 'Shift planning', 'Reports']);
    expect(labels(more)).toEqual(['Review queue', 'Containers', 'People', 'Settings']);
  });

  it('sends no supervisor row to an admin page', () => {
    const { main, more } = navFor('SUPERVISOR', 0);
    expect([...main, ...more].filter((i) => i.href.startsWith('/dashboard/admin'))).toEqual([]);
  });

  it('puts the pending count on Review queue and nowhere else', () => {
    const { main, more } = navFor('ADMIN', 7);
    expect([...main, ...more].filter((i) => i.badge).map((i) => [i.label, i.badge])).toEqual([['Review queue', 7]]);
  });
});

describe('isActive', () => {
  it('lights Settings on its own page and the pages it links to', () => {
    for (const path of ['/dashboard/settings', '/dashboard/admin/mappings', '/dashboard/admin/integrations', '/dashboard/admin/activity']) {
      expect(lit(path)).toEqual(['Settings']);
    }
  });

  it('lights Yard management on the sections page', () => {
    expect(lit('/dashboard/admin/sections')).toEqual(['Yard management']);
  });

  it('lights Overview on its exact path only', () => {
    expect(lit('/dashboard')).toEqual(['Overview']);
    expect(lit('/dashboard/')).toEqual(['Overview']);
    expect(lit('/dashboard/reports')).toEqual(['Reports']);
  });

  it('keeps a parent lit on its child pages', () => {
    expect(lit('/dashboard/yard-plans/new')).toEqual(['Yard planning']);
  });

  it('does not match a path that only shares a prefix', () => {
    expect(lit('/dashboard/settings-old')).toEqual([]);
    expect(lit('/dashboard/admin/mappings-old')).toEqual([]);
  });
});

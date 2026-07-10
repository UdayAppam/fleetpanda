import { describe, it, expect } from 'vitest';
import reducer, { setTheme, toggleSidebar, selectTheme, selectSidebarCollapsed } from './uiSlice';

describe('uiSlice', () => {
  const initial = reducer(undefined, { type: '@@INIT' });

  it('defaults to the system theme and an expanded sidebar', () => {
    expect(selectTheme({ ui: initial })).toBe('system');
    expect(selectSidebarCollapsed({ ui: initial })).toBe(false);
  });

  it('sets the theme', () => {
    const s = reducer(initial, setTheme('dark'));
    expect(s.theme).toBe('dark');
  });

  it('toggles the sidebar', () => {
    const s = reducer(initial, toggleSidebar());
    expect(s.sidebarCollapsed).toBe(true);
    expect(reducer(s, toggleSidebar()).sidebarCollapsed).toBe(false);
  });
});

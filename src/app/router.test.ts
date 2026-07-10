import { describe, it, expect } from 'vitest';
import { router } from './router';
import { queryClient } from './queryClient';

describe('app wiring', () => {
  it('builds the router with the expected top-level routes', () => {
    const paths = router.routes.map((r) => r.path).filter(Boolean);
    expect(paths).toContain('/login');
    expect(paths).toContain('/');
    expect(paths).toContain('*');
  });

  it('configures a query client with the demo-friendly defaults', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(30_000);
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
    expect(defaults.queries?.retry).toBe(1);
  });
});

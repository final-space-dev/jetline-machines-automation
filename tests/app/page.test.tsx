import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import Home from '@/app/page';

vi.mock('next/font/google', () => ({
  Manrope: () => ({ className: 'mock-font' })
}));

const companiesPayload = {
  companies: [
    { schema: 'alpha', name: 'Alpha', switch: 'ON', host: 'h1', port: 3306, split: 'CORPORATE' },
    { schema: 'beta', name: 'Beta', switch: 'ON', host: 'h2', port: 3306, split: 'STORES' }
  ],
  total: 2,
  activeCount: 2
};

describe('Home page UI', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/companies') {
        return Promise.resolve(
          new Response(JSON.stringify(companiesPayload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        );
      }
      if (url === '/api/status') {
        return Promise.resolve(
          new Response(JSON.stringify({ count: 0 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        );
      }
      if (url === '/api/reset') {
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    }) as unknown as typeof fetch;

    global.fetch = fetchMock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('renders company pills and controls without hydration errors', async () => {
    render(<Home />);
    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
    });
    expect(screen.getByText('Run all entities')).toBeEnabled();
    expect(screen.getByText('Quick test (first 2)')).toBeEnabled();
  });
});

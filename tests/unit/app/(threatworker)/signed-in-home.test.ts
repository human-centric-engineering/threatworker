/**
 * `/threatworker` is the signed-in home: gated at the edge, and where every
 * door into the app lands.
 *
 * Reads the REAL `lib/app/protected-routes.ts` and `lib/app/auth-landing.ts`
 * (no seam mock), so it fails if either value drifts. The doors themselves —
 * login, OAuth, signup, invite acceptance, email verification — all read
 * `AUTH_LANDING_ROUTE`, which Sunrise's own tests hold them to.
 *
 * @see lib/app/protected-routes.ts · lib/app/auth-landing.ts · proxy.ts
 */

import { describe, it, expect, vi } from 'vitest';
import type { NextRequest } from 'next/server';

vi.mock('@/lib/logging/context', () => ({ generateRequestId: vi.fn(() => 'req-1') }));
vi.mock('@/lib/security/headers', () => ({ setSecurityHeaders: vi.fn() }));
vi.mock('@/lib/security/rate-limit-middleware', () => ({
  applyRateLimit: vi.fn(async () => null),
}));

import { proxy } from '@/proxy';
import { AUTH_LANDING_LABEL, AUTH_LANDING_ROUTE } from '@/lib/auth-landing/route';

function request(pathname: string, cookies: Record<string, string> = {}): NextRequest {
  const url = `http://localhost:3000${pathname}`;
  return {
    nextUrl: new URL(url),
    url,
    method: 'GET',
    headers: new Map<string, string>(),
    cookies: {
      get: (name: string) => (cookies[name] ? { name, value: cookies[name] } : undefined),
    },
  } as unknown as NextRequest;
}

describe('the signed-in home', () => {
  it('is where a signed-in user lands, labelled Overview', () => {
    expect(AUTH_LANDING_ROUTE).toBe('/threatworker');
    expect(AUTH_LANDING_LABEL).toBe('Overview');
  });

  it.each(['/threatworker', '/threatworker/targets'])(
    'redirects a signed-out visitor from %s to login',
    async (path) => {
      const response = await proxy(request(path));

      expect(response.status).toBe(307);
      const location = response.headers.get('location') ?? '';
      expect(new URL(location).pathname).toBe('/login');
      expect(new URL(location).searchParams.get('callbackUrl')).toBe(path);
    }
  );

  it('lets a signed-in user through', async () => {
    const response = await proxy(
      request('/threatworker', { 'better-auth.session_token': 'token' })
    );
    expect(response.status).toBe(200);
  });

  it('sends a signed-in user on an auth page to Overview', async () => {
    const response = await proxy(request('/login', { 'better-auth.session_token': 'token' }));
    expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/threatworker');
  });
});

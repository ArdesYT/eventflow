import { apiUrl, ensureResponseOk } from './api';

async function postReset(path: string, body: unknown): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('errors.serverConnect');
  }
  await ensureResponseOk(response, 'passwordReset.failed', {
    503: 'passwordReset.unavailable',
  });
  return response;
}

export async function requestPasswordReset(email: string): Promise<{ delivery?: 'console'; code?: string }> {
  const response = await postReset('/api/auth/password-reset/request', { email });
  return response.json();
}

export async function confirmPasswordReset(token: string, password: string): Promise<void> {
  await postReset('/api/auth/password-reset/confirm', { token, password });
}

export async function verifyPasswordResetCode(email: string, code: string): Promise<string> {
  const response = await postReset('/api/auth/password-reset/verify', { email, code });
  const result = await response.json();
  if (typeof result.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(result.token)) {
    throw new Error('passwordReset.failed');
  }
  return result.token;
}

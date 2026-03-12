import * as SecureStore from 'expo-secure-store';

import type { LoginResponse } from '../../features/auth/types';

const SESSION_STORAGE_KEY = 'nightowl.session';

function isSessionLike(value: unknown): value is LoginResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<LoginResponse>;
  return (
    typeof candidate.accessToken === 'string' &&
    typeof candidate.refreshToken === 'string' &&
    Boolean(candidate.user) &&
    typeof candidate.user?.id === 'string' &&
    typeof candidate.user?.email === 'string' &&
    Array.isArray(candidate.user?.roles)
  );
}

export async function readStoredSession(): Promise<LoginResponse | null> {
  try {
    const rawSession = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);

    if (!rawSession) {
      return null;
    }

    const parsedSession = JSON.parse(rawSession) as unknown;
    if (!isSessionLike(parsedSession)) {
      await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
      return null;
    }

    return parsedSession;
  } catch {
    await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
    return null;
  }
}

export async function persistSession(session: LoginResponse) {
  await SecureStore.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export async function clearStoredSession() {
  await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
}

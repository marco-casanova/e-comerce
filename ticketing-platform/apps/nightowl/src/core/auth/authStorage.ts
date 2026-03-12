import * as SecureStore from 'expo-secure-store';

import type { LoginResponse } from '../../features/auth/types';

const SESSION_STORAGE_KEY = 'nightowl.session';

export async function readStoredSession(): Promise<LoginResponse | null> {
  try {
    const rawSession = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);

    if (!rawSession) {
      return null;
    }

    return JSON.parse(rawSession) as LoginResponse;
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

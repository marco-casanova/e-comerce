import { beforeEach, describe, expect, it, vi } from 'vitest';

const secureStoreMock = vi.hoisted(() => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

vi.mock('expo-secure-store', () => secureStoreMock);

import { clearStoredSession, persistSession, readStoredSession } from './authStorage';

describe('authStorage', () => {
  const validSession = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    user: {
      id: 'user_123',
      email: 'staff@nightowl.test',
      roles: ['staff'],
    },
  };

  beforeEach(() => {
    secureStoreMock.getItemAsync.mockReset();
    secureStoreMock.setItemAsync.mockReset();
    secureStoreMock.deleteItemAsync.mockReset();
  });

  it('returns a valid stored session', async () => {
    secureStoreMock.getItemAsync.mockResolvedValue(JSON.stringify(validSession));

    await expect(readStoredSession()).resolves.toEqual(validSession);
    expect(secureStoreMock.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('returns null when no session exists', async () => {
    secureStoreMock.getItemAsync.mockResolvedValue(null);

    await expect(readStoredSession()).resolves.toBeNull();
    expect(secureStoreMock.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('clears invalid stored session payloads', async () => {
    secureStoreMock.getItemAsync.mockResolvedValue(
      JSON.stringify({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: { id: 'user_123', email: 'broken@nightowl.test' },
      }),
    );

    await expect(readStoredSession()).resolves.toBeNull();
    expect(secureStoreMock.deleteItemAsync).toHaveBeenCalledWith('nightowl.session');
  });

  it('clears malformed stored session payloads', async () => {
    secureStoreMock.getItemAsync.mockResolvedValue('{this-is-not-json');

    await expect(readStoredSession()).resolves.toBeNull();
    expect(secureStoreMock.deleteItemAsync).toHaveBeenCalledWith('nightowl.session');
  });

  it('persists a session payload', async () => {
    await persistSession(validSession);

    expect(secureStoreMock.setItemAsync).toHaveBeenCalledWith(
      'nightowl.session',
      JSON.stringify(validSession),
    );
  });

  it('clears the stored session explicitly', async () => {
    await clearStoredSession();

    expect(secureStoreMock.deleteItemAsync).toHaveBeenCalledWith('nightowl.session');
  });
});

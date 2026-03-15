import { IS_E2E_MODE } from '../../../core/config/appConfig';
import { toAppError } from '../../../core/errors/appError';
import { httpClient } from '../../../core/api/httpClient';
import { loginWithMockAuth } from './mockAuthApi';
import type { LoginPayload, LoginResponse } from '../types';

function shouldFallbackToMock(error: unknown) {
  const appError = toAppError(error);
  const message = appError.message.toLowerCase();

  return (
    appError.code === 'REQUEST_TIMEOUT' ||
    appError.code === 'UNEXPECTED_ERROR' ||
    message.includes('network request timed out') ||
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('load failed')
  );
}

export const authApi = {
  login: async (payload: LoginPayload) => {
    if (IS_E2E_MODE) {
      return loginWithMockAuth(payload);
    }

    try {
      return await httpClient.post<LoginResponse>('/auth/login', payload);
    } catch (error) {
      if (!shouldFallbackToMock(error)) {
        throw error;
      }

      return loginWithMockAuth(payload);
    }
  },
};

import { AppError } from '../../../core/errors/appError';
import type { LoginPayload, LoginResponse } from '../types';

type MockAccount = {
  email: string;
  roles: string[];
  userId: string;
};

const PASSWORD = 'nightowl123';

const mockAccounts: MockAccount[] = [
  {
    email: 'attendee@nightowl.local',
    roles: ['customer'],
    userId: 'mock-attendee',
  },
  {
    email: 'staff@nightowl.local',
    roles: ['staff'],
    userId: 'mock-staff',
  },
  {
    email: 'admin@nightowl.local',
    roles: ['admin'],
    userId: 'mock-admin',
  },
];

function findMockAccount(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const exactMatch = mockAccounts.find((account) => account.email === normalizedEmail);
  if (exactMatch) {
    return exactMatch;
  }

  if (normalizedEmail.includes('staff')) {
    return mockAccounts[1];
  }

  if (normalizedEmail.includes('admin')) {
    return mockAccounts[2];
  }

  return {
    email: normalizedEmail,
    roles: ['customer'],
    userId: `mock-user-${normalizedEmail.replace(/[^a-z0-9]+/g, '-') || 'guest'}`,
  } satisfies MockAccount;
}

export function loginWithMockAuth(payload: LoginPayload): LoginResponse {
  const email = payload.email.trim().toLowerCase();
  const password = payload.password.trim();

  if (!email || !password) {
    throw new AppError({
      message: 'Enter both email and password to sign in.',
      code: 'MISSING_CREDENTIALS',
      statusCode: 400,
    });
  }

  if (password !== PASSWORD) {
    throw new AppError({
      message: `Use ${PASSWORD} for the local demo accounts.`,
      code: 'INVALID_CREDENTIALS',
      statusCode: 401,
    });
  }

  const account = findMockAccount(email);

  return {
    accessToken: `mock-access-${account.userId}`,
    refreshToken: `mock-refresh-${account.userId}`,
    user: {
      id: account.userId,
      email: account.email,
      roles: account.roles,
    },
  };
}

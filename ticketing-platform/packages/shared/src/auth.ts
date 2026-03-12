import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import jwt, { type JwtPayload } from 'jsonwebtoken';

import { hasPermission, normalizeRoles, type Permission, type Role } from '@ticketing/authz';
import { AppError } from './errors';

export type TokenType = 'access' | 'refresh';

export interface JwtUser {
  sub: string;
  email: string;
  roles: Role[];
  tokenType: TokenType;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtUser;
  }
}

export function parseBearerToken(header?: string): string {
  if (!header) {
    throw new AppError(401, 'Missing Authorization header', 'AUTH_MISSING');
  }

  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new AppError(401, 'Invalid Authorization header', 'AUTH_INVALID');
  }

  return token;
}

export function verifyToken(token: string, secret: string): JwtUser {
  let payload: JwtPayload | string;

  try {
    payload = jwt.verify(token, secret);
  } catch (error) {
    throw new AppError(401, 'Invalid token', 'TOKEN_INVALID', error);
  }

  if (typeof payload === 'string') {
    throw new AppError(401, 'Invalid token payload', 'TOKEN_PAYLOAD_INVALID');
  }

  const roles = normalizeRoles(Array.isArray(payload.roles) ? payload.roles.map(String) : []);

  if (!payload.sub || typeof payload.email !== 'string' || !payload.tokenType) {
    throw new AppError(401, 'Malformed token payload', 'TOKEN_PAYLOAD_INVALID');
  }

  return {
    sub: String(payload.sub),
    email: payload.email,
    roles,
    tokenType: payload.tokenType as TokenType
  };
}

export function authGuard(secret: string, permission?: Permission): preHandlerHookHandler {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const token = parseBearerToken(request.headers.authorization);
    const user = verifyToken(token, secret);

    if (user.tokenType !== 'access') {
      throw new AppError(401, 'Access token required', 'ACCESS_TOKEN_REQUIRED');
    }

    if (permission && !hasPermission(user.roles, permission)) {
      throw new AppError(403, 'Insufficient permission', 'FORBIDDEN');
    }

    request.user = user;
  };
}

export function requireUser(request: FastifyRequest): JwtUser {
  if (!request.user) {
    throw new AppError(401, 'Authentication required', 'AUTH_REQUIRED');
  }
  return request.user;
}

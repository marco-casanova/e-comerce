import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { ROLES, type Role } from '@ticketing/authz';
import { query } from '@ticketing/db';
import {
  AppError,
  authGuard,
  createServiceApp,
  readEnv,
  requireUser,
  verifyToken,
  type JwtUser
} from '@ticketing/shared';

const env = readEnv({
  PORT: z.string().default('4001'),
  HOST: z.string().default('0.0.0.0'),
  JWT_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d')
});

const app = createServiceApp('auth');

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1).max(120).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1)
});

const roleSchema = z.enum(['customer', 'staff', 'admin', 'super_admin']);

const assignRoleSchema = z.object({
  userId: z.string().uuid(),
  role: roleSchema
});

type DbUserWithRoles = {
  id: string;
  email: string;
  password_hash: string;
  full_name: string | null;
  roles: string[];
};

async function getUserWithRolesByEmail(email: string) {
  const result = await query<DbUserWithRoles>(
    `
      SELECT
        u.id,
        u.email,
        u.password_hash,
        u.full_name,
        COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), ARRAY[]::text[]) AS roles
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      WHERE u.email = $1
      GROUP BY u.id
    `,
    [email]
  );

  return result.rows[0] ?? null;
}

async function getRolesByUserId(userId: string): Promise<Role[]> {
  const result = await query<{ role: Role }>('SELECT role FROM user_roles WHERE user_id = $1', [userId]);
  return result.rows.map((row) => row.role);
}

function signTokens(user: { id: string; email: string; roles: Role[] }) {
  const payload = {
    sub: user.id,
    email: user.email,
    roles: user.roles
  };

  const accessToken = jwt.sign(
    {
      ...payload,
      tokenType: 'access'
    },
    env.JWT_SECRET,
    {
      expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn']
    }
  );

  const refreshToken = jwt.sign(
    {
      ...payload,
      tokenType: 'refresh'
    },
    env.JWT_SECRET,
    {
      expiresIn: env.REFRESH_TOKEN_TTL as jwt.SignOptions['expiresIn']
    }
  );

  return { accessToken, refreshToken };
}

app.post('/register', async (request, reply) => {
  const body = registerSchema.parse(request.body);
  const passwordHash = await bcrypt.hash(body.password, 10);

  try {
    const inserted = await query<{ id: string; email: string }>(
      'INSERT INTO users(email, password_hash, full_name) VALUES($1, $2, $3) RETURNING id, email',
      [body.email, passwordHash, body.fullName ?? null]
    );

    const user = inserted.rows[0];
    await query('INSERT INTO user_roles(user_id, role) VALUES($1, $2)', [user.id, 'customer']);

    const tokens = signTokens({ id: user.id, email: user.email, roles: ['customer'] });

    return reply.status(201).send({
      user: {
        id: user.id,
        email: user.email,
        roles: ['customer']
      },
      ...tokens
    });
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError.code === '23505') {
      throw new AppError(409, 'Email already registered', 'EMAIL_EXISTS');
    }
    throw error;
  }
});

app.post('/login', async (request) => {
  const body = loginSchema.parse(request.body);
  const user = await getUserWithRolesByEmail(body.email);

  if (!user) {
    throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  }

  const isPasswordValid = await bcrypt.compare(body.password, user.password_hash);
  if (!isPasswordValid) {
    throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  }

  const roles = user.roles.filter((role): role is Role => ROLES.includes(role as Role));
  const tokens = signTokens({
    id: user.id,
    email: user.email,
    roles
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      roles
    },
    ...tokens
  };
});

app.post('/refresh', async (request) => {
  const body = refreshSchema.parse(request.body);
  const tokenPayload = verifyToken(body.refreshToken, env.JWT_SECRET) as JwtUser;

  if (tokenPayload.tokenType !== 'refresh') {
    throw new AppError(401, 'Refresh token required', 'REFRESH_REQUIRED');
  }

  const roles = await getRolesByUserId(tokenPayload.sub);
  if (!roles.length) {
    throw new AppError(401, 'User has no roles', 'NO_ROLES');
  }

  return signTokens({
    id: tokenPayload.sub,
    email: tokenPayload.email,
    roles
  });
});

app.get('/me', { preHandler: authGuard(env.JWT_SECRET) }, async (request) => {
  const user = requireUser(request);
  const roles = await getRolesByUserId(user.sub);

  return {
    id: user.sub,
    email: user.email,
    roles
  };
});

app.post('/assign-role', { preHandler: authGuard(env.JWT_SECRET, 'roles:assign') }, async (request) => {
  const body = assignRoleSchema.parse(request.body);

  await query('INSERT INTO user_roles(user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
    body.userId,
    body.role
  ]);

  const roles = await getRolesByUserId(body.userId);

  return {
    userId: body.userId,
    roles
  };
});

async function start() {
  try {
    await app.listen({
      port: Number(env.PORT),
      host: env.HOST
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();

export type Role = 'customer' | 'staff' | 'admin' | 'super_admin';

export const ROLES: Role[] = ['customer', 'staff', 'admin', 'super_admin'];

export type Permission =
  | '*'
  | 'catalog:read'
  | 'catalog:write'
  | 'cart:manage'
  | 'orders:own'
  | 'orders:manage'
  | 'tickets:own'
  | 'tickets:validate'
  | 'metrics:read'
  | 'ops:read'
  | 'ops:write'
  | 'incidents:manage'
  | 'analytics:write'
  | 'analytics:read'
  | 'roles:assign';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  customer: ['catalog:read', 'cart:manage', 'orders:own', 'tickets:own', 'analytics:write'],
  staff: [
    'catalog:read',
    'cart:manage',
    'orders:own',
    'tickets:own',
    'tickets:validate',
    'ops:read',
    'incidents:manage',
    'analytics:write'
  ],
  admin: [
    'catalog:read',
    'catalog:write',
    'cart:manage',
    'orders:own',
    'orders:manage',
    'tickets:own',
    'tickets:validate',
    'metrics:read',
    'ops:read',
    'ops:write',
    'incidents:manage',
    'analytics:write',
    'analytics:read'
  ],
  super_admin: ['*']
};

export function hasPermission(roles: Role[], permission: Permission): boolean {
  if (permission === '*') {
    return roles.includes('super_admin');
  }

  return roles.some((role) => {
    const permissions = ROLE_PERMISSIONS[role] ?? [];
    return permissions.includes('*') || permissions.includes(permission);
  });
}

export function normalizeRoles(input: string[]): Role[] {
  return input.filter((role): role is Role => ROLES.includes(role as Role));
}

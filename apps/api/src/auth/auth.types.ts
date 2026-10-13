export const ACTIVE_ROLES = ['CONSUMER', 'MERCHANT', 'ADMIN'] as const;

export type ActiveRole = (typeof ACTIVE_ROLES)[number];

export function isActiveRole(value: string): value is ActiveRole {
  return ACTIVE_ROLES.some((role) => role === value);
}

export const LOGIN_ROLES = ['consumer', 'merchant', 'administrator'] as const;

export type LoginRole = (typeof LOGIN_ROLES)[number];

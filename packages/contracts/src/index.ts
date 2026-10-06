export const API_VERSION = '1' as const;

export type HealthStatus = 'error' | 'ok' | 'shutting_down';

export type HealthResponse = {
  status: HealthStatus;
  details?: Readonly<Record<string, { status: string }>>;
};

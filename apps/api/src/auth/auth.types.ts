export type ActorRole = 'ADMIN' | 'CONSUMER' | 'MERCHANT';

export type AuthActor = {
  sessionId: number;
  userId: number;
  role: ActorRole;
};

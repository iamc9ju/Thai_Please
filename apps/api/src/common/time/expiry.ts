export function isUnexpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() > now.getTime();
}

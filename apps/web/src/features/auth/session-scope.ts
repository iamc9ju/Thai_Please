let sessionGeneration = 0;

export function getSessionGeneration() {
  return sessionGeneration;
}

export function invalidateSessionScope() {
  sessionGeneration += 1;
}

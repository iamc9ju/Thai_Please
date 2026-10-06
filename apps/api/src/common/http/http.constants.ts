export const HTTP_HEADERS = {
  requestId: 'x-request-id',
} as const;

export const ERROR_CODES = {
  internal: 'INTERNAL_SERVER_ERROR',
  requestFailed: 'REQUEST_FAILED',
} as const;

export const ERROR_MESSAGES = {
  internal: 'The server could not complete the request.',
  requestFailed: 'The request could not be completed.',
} as const;

export const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

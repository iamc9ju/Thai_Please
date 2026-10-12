export function isOrderMutable(
  status: 'CHECKED_OUT' | 'DRAFT' | 'EXPIRED' | 'PAID',
): boolean {
  return status === 'DRAFT';
}

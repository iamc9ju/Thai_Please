export function calculateFinalAmount(
  subtotal: number,
  couponDiscount: number,
): { discount: number; finalAmount: number } {
  const discount = Math.min(subtotal, Math.max(0, couponDiscount));
  return { discount, finalAmount: subtotal - discount };
}

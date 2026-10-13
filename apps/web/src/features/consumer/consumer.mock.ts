export const consumerMock = {
  wallet: {
    personalBalanceSatang: 185_000,
    subsidyBalanceSatang: 76_000,
    dailyCapSatang: 20_000,
    dailyUsedSatang: 8_000,
    dailyRemainingSatang: 12_000,
    subsidyPercentage: 50,
    pointBalance: 1_250,
  },
  payment: {
    subtotalSatang: 18_500,
    discountSatang: 2_000,
    finalAmountSatang: 16_500,
    subsidyPaidSatang: 8_250,
    personalPaidSatang: 8_250,
  },
  topUpMaximumSatang: 500_000,
} as const;

export function formatBaht(satang: number): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(satang / 100);
}

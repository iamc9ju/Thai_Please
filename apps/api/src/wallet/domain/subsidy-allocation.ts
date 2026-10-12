export type SubsidyAllocationInput = {
  finalAmount: number;
  subsidyBalance: number;
  personalBalance: number;
  subsidyUsedToday: number;
  dailySubsidyCap: number;
  subsidyPercent: number;
};

export type SubsidyAllocation = {
  subsidyPaid: number;
  personalPaid: number;
  sufficient: boolean;
};

export function allocateSubsidy(
  input: SubsidyAllocationInput,
): SubsidyAllocation {
  const remainingDaily = Math.max(
    0,
    input.dailySubsidyCap - input.subsidyUsedToday,
  );
  const desiredSubsidy = Math.floor(
    (input.finalAmount * input.subsidyPercent) / 100,
  );
  const subsidyPaid = Math.min(
    desiredSubsidy,
    remainingDaily,
    input.subsidyBalance,
  );
  const personalPaid = input.finalAmount - subsidyPaid;
  return {
    subsidyPaid,
    personalPaid,
    sufficient: input.personalBalance >= personalPaid,
  };
}

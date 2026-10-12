import { describe, expect, it } from 'vitest';
import { satisfiesSpendQuest } from './quest-rule.js';

describe('deterministic quest evaluation (FR-S02)', () => {
  it('uses the final post-discount amount', () => {
    expect(
      satisfiesSpendQuest(
        { minimumAmount: 100 },
        { finalAmount: 90, categoryIds: [1] },
      ),
    ).toBe(false);
  });

  it('requires all conditions in one receipt and does not aggregate receipts', () => {
    expect(
      satisfiesSpendQuest(
        { minimumAmount: 100 },
        { finalAmount: 60, categoryIds: [1] },
      ),
    ).toBe(false);
    expect(
      satisfiesSpendQuest(
        { minimumAmount: 100 },
        { finalAmount: 60, categoryIds: [1] },
      ),
    ).toBe(false);
  });

  it('checks the immutable receipt category facts', () => {
    expect(
      satisfiesSpendQuest(
        { minimumAmount: 100, categoryId: 2 },
        { finalAmount: 100, categoryIds: [1] },
      ),
    ).toBe(false);
    expect(
      satisfiesSpendQuest(
        { minimumAmount: 100, categoryId: 1 },
        { finalAmount: 100, categoryIds: [1] },
      ),
    ).toBe(true);
  });
});

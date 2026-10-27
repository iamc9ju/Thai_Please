import { describe, expect, it } from 'vitest';
import { questAudit } from './quest-audit.js';

describe('FR-A05 minimized proposal audit', () => {
  it('shows safe proposal and validation facts while stripping arbitrary content', () => {
    const result = questAudit(
      [
        {
          id: 'MIN_SPEND:ALL:6000',
          type: 'MIN_SPEND',
          targetId: null,
          minimumSpendMinor: '6000',
          private: 'do not expose',
        },
      ],
      {
        output: {
          attempts: [
            {
              call: 1,
              acceptedCount: 1,
              rejections: ['PROPOSAL_AMOUNT_INVALID'],
              private: 'hidden',
            },
          ],
        },
        rejections: [],
        private: 'hidden',
      },
    );
    expect(result.proposals).toHaveLength(1);
    expect(result.validation.attempts[0]?.rejections).toEqual([
      'PROPOSAL_AMOUNT_INVALID',
    ]);
    expect(JSON.stringify(result)).not.toContain('private');
  });
  it('handles legacy and malicious audit payloads without exposing raw model text', () => {
    expect(questAudit(null, { score: 42 })).toEqual({
      proposals: [],
      validation: { attempts: [], rejections: [] },
    });
    expect(
      questAudit([{ type: 'INVALID', private: 'secret' }], {
        output: {
          attempts: [
            { call: 1, acceptedCount: 0, rejections: ['secret token'] },
          ],
        },
        rejections: [],
      }),
    ).toEqual({ proposals: [], validation: { attempts: [], rejections: [] } });
  });
});

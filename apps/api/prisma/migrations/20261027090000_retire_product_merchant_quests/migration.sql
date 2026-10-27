-- FR-C07 / FR-S03 / FR-S06: retire exact-product and single-merchant quests.
-- Additive, no new tables. Keeps historical conditions, receipts, points and logs.
-- Lock risk: ALTER + UPDATE of active assignments; deploy in a controlled window.
-- Stop old generation/completion workers before applying; restart with policy v2.
-- Roll-forward only: never reactivate cancelled assignments during app rollback.
BEGIN;

-- NOT VALID preserves historical definitions while enforcing all new writes.
-- Do not VALIDATE this constraint until retired historical rows are archived.
ALTER TABLE quests ADD CONSTRAINT quests_new_supported_rules_check CHECK (
  target_product_id IS NULL AND target_merchant_id IS NULL
  AND min_spend IS NOT NULL AND min_spend > 0
  AND ((quest_type = 'MIN_SPEND' AND target_category_id IS NULL)
    OR (quest_type = 'CATEGORY_SPEND' AND target_category_id IS NOT NULL))
) NOT VALID;

ALTER TABLE user_quests
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancellation_reason varchar(80),
  ADD CONSTRAINT quest_cancellation_metadata_check CHECK (
    (status = 'CANCELLED' AND cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL
      AND completed_at IS NULL AND completed_order_id IS NULL)
    OR (status <> 'CANCELLED' AND cancelled_at IS NULL AND cancellation_reason IS NULL)
  );

-- A supposedly active assignment with reward/completion facts needs manual audit.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM user_quests uq JOIN quests q ON q.quest_id = uq.quest_id
    WHERE uq.status = 'ACTIVE' AND (uq.expires_at AT TIME ZONE 'UTC') > CURRENT_TIMESTAMP
      AND (q.quest_type IN ('PRODUCT_PURCHASE', 'MERCHANT_SPEND')
      OR q.target_product_id IS NOT NULL OR q.target_merchant_id IS NOT NULL)
      AND (uq.completed_at IS NOT NULL OR uq.completed_order_id IS NOT NULL
        OR EXISTS (SELECT 1 FROM point_transactions pt WHERE pt.user_quest_id = uq.user_quest_id))
  ) THEN
    RAISE EXCEPTION 'QUEST_RETIREMENT_REQUIRES_REWARD_AUDIT';
  END IF;
END $$;

UPDATE user_quests uq
SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP,
    cancellation_reason = 'QUEST_TYPE_RETIRED_POLICY_V2'
FROM quests q
WHERE q.quest_id = uq.quest_id AND uq.status = 'ACTIVE'
  AND (uq.expires_at AT TIME ZONE 'UTC') > CURRENT_TIMESTAMP
  AND (q.quest_type IN ('PRODUCT_PURCHASE', 'MERCHANT_SPEND')
    OR q.target_product_id IS NOT NULL OR q.target_merchant_id IS NOT NULL);

COMMIT;
-- Validation (must return zero):
-- SELECT count(*) FROM user_quests uq JOIN quests q USING(quest_id)
-- WHERE uq.status='ACTIVE' AND (uq.expires_at AT TIME ZONE 'UTC') > now()
-- AND q.quest_type IN ('PRODUCT_PURCHASE','MERCHANT_SPEND');

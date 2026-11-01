-- FR-C07 / FR-S01-06: proposal selection and personal-spend policy v3.
-- Rollout: stop v2 generation/completion writers, apply, generate Prisma client,
-- then start v3. Old writers must not run after this migration.
-- ALTER and active-assignment UPDATE take locks: deploy in a controlled window.
-- Recovery is roll-forward. Do not reactivate cancelled assignments or remove
-- historical basis/audit columns on application rollback.
BEGIN;

-- Never repair historical duplicate value movements automatically.
DO $$ BEGIN
  IF EXISTS (SELECT completed_order_id FROM user_quests WHERE completed_order_id IS NOT NULL
    GROUP BY completed_order_id HAVING count(*)>1) THEN
    RAISE EXCEPTION 'QUEST_RECEIPT_DUPLICATES_REQUIRE_AUDIT';
  END IF;
  IF EXISTS (SELECT user_quest_id FROM point_transactions
    WHERE transaction_type='QUEST_REWARD' AND user_quest_id IS NOT NULL
    GROUP BY user_quest_id HAVING count(*)>1) THEN
    RAISE EXCEPTION 'QUEST_REWARD_DUPLICATES_REQUIRE_AUDIT';
  END IF;
END $$;
CREATE UNIQUE INDEX user_quests_receipt_once ON user_quests(completed_order_id) WHERE completed_order_id IS NOT NULL;
CREATE UNIQUE INDEX point_transactions_quest_reward_once ON point_transactions(user_quest_id)
  WHERE transaction_type='QUEST_REWARD' AND user_quest_id IS NOT NULL;

ALTER TABLE quests ADD COLUMN amount_basis varchar(30) NOT NULL DEFAULT 'FINAL_AFTER_DISCOUNT',
  ADD COLUMN rule_version varchar(80),
  ADD CONSTRAINT quest_amount_basis_check CHECK (amount_basis IN ('FINAL_AFTER_DISCOUNT','PERSONAL_AFTER_DISCOUNT'));
-- The temporary default backfills historical facts only. Every future writer
-- must specify its amount basis explicitly; never silently create a v2 quest.
ALTER TABLE quests ALTER COLUMN amount_basis DROP DEFAULT,
  ADD CONSTRAINT quest_personal_rule_metadata_check CHECK (amount_basis <> 'PERSONAL_AFTER_DISCOUNT'
    OR (rule_version IS NOT NULL AND length(rule_version)>0 AND min_spend IS NOT NULL AND min_spend>0
      AND mod(min_spend*100,1000)=0));
ALTER TABLE user_quests ADD COLUMN next_eligible_at timestamptz,
  ADD CONSTRAINT quest_next_eligible_check CHECK (next_eligible_at IS NULL OR next_eligible_at > (assigned_at AT TIME ZONE 'UTC'));
CREATE INDEX idx_user_quests_next_eligible ON user_quests(user_id,next_eligible_at DESC);

ALTER TABLE quest_generation_logs
  ADD COLUMN worker_started_at timestamptz,
  ADD COLUMN generated_proposals jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN proposal_expires_at timestamptz,
  ADD COLUMN selected_proposal_id varchar(160),
  ADD COLUMN selection_key uuid UNIQUE;
ALTER TABLE quest_generation_logs DROP CONSTRAINT quest_logs_status_check,
  DROP CONSTRAINT quest_logs_run_metadata_check;
ALTER TABLE quest_generation_logs
  ADD CONSTRAINT quest_logs_status_check CHECK (status IN ('LEGACY','PENDING','READY','ASSIGNED','DEFERRED','FAILED')),
  ADD CONSTRAINT quest_logs_proposals_check CHECK (
    jsonb_typeof(generated_proposals)='array' AND jsonb_array_length(generated_proposals)<=3
    AND (status <> 'READY' OR (jsonb_array_length(generated_proposals)>0 AND proposal_expires_at IS NOT NULL
      AND assignment_id IS NULL AND generated_quest_id IS NULL AND reserved_points=0))
    AND ((selected_proposal_id IS NULL AND selection_key IS NULL)
      OR (selected_proposal_id IS NOT NULL AND selection_key IS NOT NULL AND status='ASSIGNED'))
  ),
  ADD CONSTRAINT quest_logs_run_metadata_check CHECK (status='LEGACY' OR (
    request_key IS NOT NULL AND requested_by IS NOT NULL AND provider IS NOT NULL
    AND model_version IS NOT NULL AND prompt_version IS NOT NULL AND policy_version IS NOT NULL
    AND policy_snapshot IS NOT NULL AND candidates IS NOT NULL AND reserved_points IS NOT NULL
    AND reserved_points>=0 AND reservation_day IS NOT NULL AND lease_expires_at IS NOT NULL
    AND reservation_expires_at IS NOT NULL
    AND lease_expires_at > (generated_at AT TIME ZONE 'UTC')
    AND reservation_expires_at >= lease_expires_at
    AND ((status='ASSIGNED') = (assignment_id IS NOT NULL))
    AND ((status='ASSIGNED') = (generated_quest_id IS NOT NULL))
    AND (status <> 'ASSIGNED' OR reserved_points>0)
    AND ((status='PENDING') = (finished_at IS NULL))
  ));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM user_quests uq JOIN quests q USING(quest_id)
    WHERE uq.status='ACTIVE' AND (uq.expires_at AT TIME ZONE 'UTC') > CURRENT_TIMESTAMP
      AND q.amount_basis='FINAL_AFTER_DISCOUNT'
      AND (uq.completed_at IS NOT NULL OR uq.completed_order_id IS NOT NULL OR EXISTS
        (SELECT 1 FROM point_transactions pt WHERE pt.user_quest_id=uq.user_quest_id))) THEN
    RAISE EXCEPTION 'QUEST_PERSONAL_SPEND_MIGRATION_REQUIRES_REWARD_AUDIT';
  END IF;
END $$;
UPDATE user_quests uq SET status='CANCELLED',cancelled_at=CURRENT_TIMESTAMP,
  cancellation_reason='PERSONAL_SPEND_POLICY_V3'
FROM quests q WHERE q.quest_id=uq.quest_id AND q.amount_basis='FINAL_AFTER_DISCOUNT'
  AND uq.status='ACTIVE' AND (uq.expires_at AT TIME ZONE 'UTC')>CURRENT_TIMESTAMP;
-- Cancelled v2 assignments have no v3 cycle lock. Their historical reservations
-- are released by the budget query's ACTIVE check; daily issued liability remains.
UPDATE quest_generation_logs SET status='FAILED',selection_reason='POLICY_CHANGED',finished_at=CURRENT_TIMESTAMP
  WHERE status='PENDING';
COMMIT;
-- Validation (zero): SELECT count(*) FROM user_quests uq JOIN quests q USING(quest_id)
-- WHERE uq.status='ACTIVE' AND (uq.expires_at AT TIME ZONE 'UTC')>now() AND q.amount_basis='FINAL_AFTER_DISCOUNT';
-- Audit: SELECT status,count(*) FROM quest_generation_logs GROUP BY status;

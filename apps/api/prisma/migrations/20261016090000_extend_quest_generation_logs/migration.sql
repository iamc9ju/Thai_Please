-- FR-S03/04/05: extend existing audit storage; preserve legacy IDs and history.
-- Apply before enabling the new writer. No data deletion or invented legacy metadata.
-- ALTER/unique/index creation takes table locks; duration depends on existing row count.
-- Schedule with normal migration controls. Retain columns on application rollback.
ALTER TABLE quest_generation_logs
  ALTER COLUMN generated_quest_id DROP NOT NULL,
  ADD COLUMN request_key uuid UNIQUE,
  ADD COLUMN requested_by bigint REFERENCES users(user_id),
  ADD COLUMN status varchar(16) NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN provider varchar(30),
  ADD COLUMN prompt_version varchar(80),
  ADD COLUMN policy_version varchar(80),
  ADD COLUMN policy_snapshot jsonb,
  ADD COLUMN candidates jsonb,
  ADD COLUMN assignment_id bigint UNIQUE REFERENCES user_quests(user_quest_id),
  ADD COLUMN reserved_points integer,
  ADD COLUMN reservation_day date,
  ADD COLUMN lease_expires_at timestamptz,
  ADD COLUMN reservation_expires_at timestamptz,
  ADD COLUMN finished_at timestamptz;

ALTER TABLE quest_generation_logs
  ADD CONSTRAINT quest_logs_status_check CHECK (status IN ('LEGACY','PENDING','ASSIGNED','DEFERRED','FAILED')),
  ADD CONSTRAINT quest_logs_run_metadata_check CHECK (status = 'LEGACY' OR (
    request_key IS NOT NULL AND requested_by IS NOT NULL AND provider IS NOT NULL
    AND model_version IS NOT NULL AND prompt_version IS NOT NULL AND policy_version IS NOT NULL
    AND policy_snapshot IS NOT NULL AND candidates IS NOT NULL AND reserved_points IS NOT NULL
    AND reserved_points > 0 AND reservation_day IS NOT NULL AND lease_expires_at IS NOT NULL
    AND reservation_expires_at IS NOT NULL
    AND lease_expires_at > (generated_at AT TIME ZONE 'UTC')
    AND reservation_expires_at >= lease_expires_at
    AND ((status = 'ASSIGNED') = (assignment_id IS NOT NULL))
    AND ((status = 'ASSIGNED') = (generated_quest_id IS NOT NULL))
    AND ((status = 'PENDING') = (finished_at IS NULL))
  ));

CREATE INDEX idx_quest_logs_user_generated ON quest_generation_logs(user_id, generated_at DESC);
CREATE INDEX idx_quest_logs_budget ON quest_generation_logs(reservation_day, status);
-- Validation: SELECT status,count(*) FROM quest_generation_logs GROUP BY status;
-- Roll-forward recovery: revert writer, retain these additive columns for audit.

-- FR-A04 / NFR-DATA-03: subsidy-program date ranges are inclusive.
-- Rollout: run the validation query below before deploy. This migration
-- intentionally refuses to deploy if historical programs already overlap;
-- resolve them through an approved policy decision, then re-run. No data is
-- changed by this migration.
--
-- Validation query before deployment:
-- SELECT a.program_id, b.program_id
-- FROM subsidy_programs a
-- JOIN subsidy_programs b ON a.program_id < b.program_id
--   AND a.start_date <= b.end_date AND a.end_date >= b.start_date;
--
-- Recovery: drop the named constraint. The exclusion constraint is the
-- database source of truth for direct and concurrent writes.

-- Lock risk: ALTER TABLE requires ACCESS EXCLUSIVE; schedule a low-traffic window.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM subsidy_programs a
    JOIN subsidy_programs b ON a.program_id < b.program_id
      AND a.start_date <= b.end_date AND a.end_date >= b.start_date
  ) THEN
    RAISE EXCEPTION 'subsidy_program date ranges overlap; resolve legacy data before migration'
      USING ERRCODE = '23P01',
            CONSTRAINT = 'subsidy_programs_date_overlap';
  END IF;
END;
$$;

ALTER TABLE subsidy_programs
  ADD CONSTRAINT subsidy_programs_date_overlap
  EXCLUDE USING gist (
    daterange(start_date, end_date, '[]') WITH &&
  );

COMMIT;

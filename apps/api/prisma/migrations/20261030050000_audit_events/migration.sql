-- CreateTable
CREATE TABLE IF NOT EXISTS "audit_events" (
    "audit_event_id" BIGSERIAL NOT NULL,
    "actor_user_id" BIGINT,
    "actor_role" VARCHAR(30),
    "action" VARCHAR(80) NOT NULL,
    "target_type" VARCHAR(50) NOT NULL,
    "target_id" VARCHAR(80),
    "result" VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    "correlation_id" VARCHAR(100),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("audit_event_id"),
    CONSTRAINT "fk_audit_events_actor" FOREIGN KEY ("actor_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE NO ACTION
);

-- CreateIndexes
CREATE INDEX IF NOT EXISTS "idx_audit_events_action_date" ON "audit_events"("action", "created_at");
CREATE INDEX IF NOT EXISTS "idx_audit_events_actor_date" ON "audit_events"("actor_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_audit_events_target" ON "audit_events"("target_type", "target_id");

ALTER TABLE "morning_readings" ADD COLUMN "off_posture" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sleep_logs" ADD COLUMN "hrv_posture" text;--> statement-breakpoint
ALTER TABLE "sleep_logs" ADD COLUMN "hrv_off_posture" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "hrv_posture" text;--> statement-breakpoint
-- Backfill: nights whose HRV came from a morning reading carry that reading's posture.
UPDATE "sleep_logs" SET "hrv_posture" = mr."posture" FROM "morning_readings" mr WHERE mr."id" = "sleep_logs"."morning_reading_id";--> statement-breakpoint
-- Each existing user's set posture is the posture of their latest morning reading.
UPDATE "users" SET "hrv_posture" = (SELECT mr."posture" FROM "morning_readings" mr WHERE mr."user_id" = "users"."id" ORDER BY mr."taken_at" DESC LIMIT 1) WHERE "hrv_posture" IS NULL;

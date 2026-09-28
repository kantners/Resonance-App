CREATE TABLE "breathwork_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" text NOT NULL,
	"type" text NOT NULL,
	"duration_min" integer NOT NULL,
	"quality" integer,
	"perceived_effect" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "daily_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" text NOT NULL,
	"rule_version" text NOT NULL,
	"hrv_log_scale" boolean NOT NULL,
	"hrv_source_used" text NOT NULL,
	"hrv_baseline_mean" real,
	"hrv_baseline_sd" real,
	"rhr_baseline_mean" real,
	"rhr_baseline_sd" real,
	"hrv_range_low" real,
	"hrv_range_high" real,
	"rhr_range_low" real,
	"rhr_range_high" real,
	"hrv_7_avg" real,
	"rhr_7_avg" real,
	"week_nights" integer NOT NULL,
	"baseline_nights" integer NOT NULL,
	"week_label" text NOT NULL,
	"night_state" text NOT NULL,
	"consecutive_nights_out" integer NOT NULL,
	"escalation_level" integer NOT NULL,
	"nights_in_range_last_30" integer,
	"nights_logged_last_30" integer,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "daily_status_user_date_rule_flag" UNIQUE("user_id","date","rule_version","hrv_log_scale")
);
--> statement-breakpoint
CREATE TABLE "digital_exposure" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" text NOT NULL,
	"source" text NOT NULL,
	"platform" text,
	"total_min" integer NOT NULL,
	"pickups" integer,
	"notifications" integer,
	"social_min" integer,
	"entertainment_min" integer,
	"productivity_min" integer,
	"other_min" integer,
	"top_apps" text,
	"hourly_pickups" text,
	"pickups_after_21" integer,
	"longest_quiet_min" integer,
	"quiet_stretches_30" integer,
	"quiet_minutes_30_total" integer,
	"last_pickup_at" text,
	"quiet_source" text,
	"low_confidence_fields" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "digital_exposure_user_date" UNIQUE("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "fasting_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"started_at" text NOT NULL,
	"ended_at" text,
	"goal_hours" real DEFAULT 16,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "morning_readings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" text NOT NULL,
	"taken_at" text NOT NULL,
	"duration_sec" integer DEFAULT 60 NOT NULL,
	"rmssd_ms" real NOT NULL,
	"heart_rate_bpm" real NOT NULL,
	"signal_quality" real,
	"posture" text DEFAULT 'seated' NOT NULL,
	"hrv_source" text DEFAULT 'device_manual' NOT NULL,
	"hrv_device" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "night_context_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" text NOT NULL,
	"tag" text NOT NULL,
	CONSTRAINT "night_tag_user_date_tag" UNIQUE("user_id","date","tag")
);
--> statement-breakpoint
CREATE TABLE "phone_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"at" text NOT NULL,
	"kind" text NOT NULL,
	"app_id" text,
	"session_sec" integer
);
--> statement-breakpoint
CREATE TABLE "practitioners" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"display_code" text NOT NULL,
	"practice_name" text,
	CONSTRAINT "practitioners_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "reading_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" text NOT NULL,
	"started_at" text,
	"medium" text NOT NULL,
	"duration_min" integer NOT NULL,
	"title" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp (6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sleep_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" text NOT NULL,
	"hours" real,
	"quality" integer,
	"sleep_score" integer,
	"resting_hr" integer,
	"hrv" real,
	"hrv_source" text DEFAULT 'device_manual' NOT NULL,
	"hrv_device" text,
	"morning_reading_id" integer,
	"notes" text,
	CONSTRAINT "sleep_user_date" UNIQUE("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "stillness_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" text NOT NULL,
	"started_at" text NOT NULL,
	"minutes" integer NOT NULL,
	"type" text NOT NULL,
	"reiki_role" text,
	"reading_medium" text,
	"phone_location" text NOT NULL,
	"breaths_per_min" real,
	"rmssd_during_ms" real,
	"breath_method" text,
	"hr_source" text,
	"posture_style" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "study_enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"protocol_id" integer NOT NULL,
	"client_user_id" integer NOT NULL,
	"client_code" text NOT NULL,
	"consent_version" text NOT NULL,
	"consented_at" timestamp NOT NULL,
	"withdrawn_at" timestamp,
	"touch_profile" text NOT NULL,
	"touch_profile_locked_at" timestamp NOT NULL,
	"allocation_index" integer NOT NULL,
	"condition_sequence" text NOT NULL,
	"sequence_block" integer NOT NULL,
	CONSTRAINT "enrollment_protocol_client" UNIQUE("protocol_id","client_user_id"),
	CONSTRAINT "enrollment_protocol_code" UNIQUE("protocol_id","client_code"),
	CONSTRAINT "enrollment_protocol_allocation" UNIQUE("protocol_id","allocation_index")
);
--> statement-breakpoint
CREATE TABLE "study_protocols" (
	"id" serial PRIMARY KEY NOT NULL,
	"practitioner_id" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"supersedes_id" integer,
	"question" text NOT NULL,
	"primary_outcome" text NOT NULL,
	"primary_contrast" text NOT NULL,
	"secondary_contrast" text,
	"conditions" text NOT NULL,
	"design" text DEFAULT 'crossover' NOT NULL,
	"target_clients" integer NOT NULL,
	"min_days_between" integer,
	"withholding_procedure" text NOT NULL,
	"commitment_text" text NOT NULL,
	"closing_reiki_for_all" boolean DEFAULT true NOT NULL,
	"consent_version" text DEFAULT '1' NOT NULL,
	"analysis_scale" text DEFAULT 'ln' NOT NULL,
	"reading_device" text,
	"allocation_list" text,
	"allocation_nonce" text,
	"allocation_sha256" text,
	"locked_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"enrollment_id" integer NOT NULL,
	"visit_number" integer NOT NULL,
	"condition" text NOT NULL,
	"condition_revealed_at" timestamp,
	"pre_taken_at" text,
	"pre_rmssd_ms" real,
	"pre_hr_bpm" real,
	"pre_posture" text,
	"pre_breaths_per_min" real,
	"pre_reading_device" text,
	"post_taken_at" text,
	"post_rmssd_ms" real,
	"post_hr_bpm" real,
	"post_posture" text,
	"post_breaths_per_min" real,
	"post_reading_device" text,
	"relax_pre" integer,
	"relax_post" integer,
	"client_guess" text,
	"intention_held_rating" integer,
	"drift_count" integer DEFAULT 0 NOT NULL,
	"checklist" text,
	"deviations" text,
	"stones_notes" text,
	"client_report" text,
	"closing_reiki_given" boolean,
	"completed_at" timestamp,
	CONSTRAINT "session_enrollment_visit" UNIQUE("enrollment_id","visit_number")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"first_name" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"time_zone" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "breathwork_logs" ADD CONSTRAINT "breathwork_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_status" ADD CONSTRAINT "daily_status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_exposure" ADD CONSTRAINT "digital_exposure_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fasting_sessions" ADD CONSTRAINT "fasting_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "morning_readings" ADD CONSTRAINT "morning_readings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "night_context_tags" ADD CONSTRAINT "night_context_tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_events" ADD CONSTRAINT "phone_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practitioners" ADD CONSTRAINT "practitioners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_logs" ADD CONSTRAINT "reading_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sleep_logs" ADD CONSTRAINT "sleep_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sleep_logs" ADD CONSTRAINT "sleep_logs_morning_reading_id_morning_readings_id_fk" FOREIGN KEY ("morning_reading_id") REFERENCES "public"."morning_readings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stillness_sessions" ADD CONSTRAINT "stillness_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_enrollments" ADD CONSTRAINT "study_enrollments_protocol_id_study_protocols_id_fk" FOREIGN KEY ("protocol_id") REFERENCES "public"."study_protocols"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_enrollments" ADD CONSTRAINT "study_enrollments_client_user_id_users_id_fk" FOREIGN KEY ("client_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_protocols" ADD CONSTRAINT "study_protocols_practitioner_id_practitioners_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."practitioners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_enrollment_id_study_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."study_enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "session" USING btree ("expire");
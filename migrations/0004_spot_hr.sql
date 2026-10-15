CREATE TABLE "spot_hr_readings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" text NOT NULL,
	"taken_at" text NOT NULL,
	"kind" text NOT NULL,
	"lowest_steady_bpm" real,
	"mean_bpm" real,
	"start_bpm" real,
	"end_bpm" real,
	"duration_s" integer NOT NULL,
	"sample_count" integer NOT NULL,
	"device" text,
	"stillness_session_id" integer
);
--> statement-breakpoint
ALTER TABLE "spot_hr_readings" ADD CONSTRAINT "spot_hr_readings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spot_hr_readings" ADD CONSTRAINT "spot_hr_readings_stillness_session_id_stillness_sessions_id_fk" FOREIGN KEY ("stillness_session_id") REFERENCES "public"."stillness_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "spot_hr_user_date" ON "spot_hr_readings" USING btree ("user_id","date");
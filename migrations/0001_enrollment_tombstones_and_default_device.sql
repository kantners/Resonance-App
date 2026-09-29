ALTER TABLE "study_enrollments" DROP CONSTRAINT "study_enrollments_client_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "study_enrollments" ALTER COLUMN "client_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "default_hrv_source" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "default_hrv_device" text;--> statement-breakpoint
ALTER TABLE "study_enrollments" ADD CONSTRAINT "study_enrollments_client_user_id_users_id_fk" FOREIGN KEY ("client_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
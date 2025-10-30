ALTER TABLE "users" DROP CONSTRAINT "users_employee_id_unique";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "department_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "employee_id" DROP NOT NULL;
CREATE TABLE "webset_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webset_id" uuid NOT NULL,
	"data" jsonb NOT NULL,
	"criteria_answers" boolean[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "websets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" varchar(255),
	"query" text NOT NULL,
	"criterias" text[],
	"target_validated_rows" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "webset_rows" ADD CONSTRAINT "webset_rows_webset_id_websets_id_fk" FOREIGN KEY ("webset_id") REFERENCES "public"."websets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "websets" ADD CONSTRAINT "websets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webset_rows_webset_id_idx" ON "webset_rows" USING btree ("webset_id");--> statement-breakpoint
CREATE INDEX "websets_workspace_id_idx" ON "websets" USING btree ("workspace_id");
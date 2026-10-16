CREATE TYPE "public"."niche" AS ENUM('salud', 'legal', 'fitness', 'gastronomia', 'inmobiliaria', 'educacion', 'marca_personal', 'otro');--> statement-breakpoint
CREATE TYPE "public"."project_type" AS ENUM('subscription', 'legacy');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'sent', 'accepted', 'rejected', 'expired', 'requires_review');--> statement-breakpoint
CREATE TYPE "public"."material_status" AS ENUM('tiene_todo', 'tiene_logo_no_fotos', 'no_tiene_nada');--> statement-breakpoint
CREATE TYPE "public"."hosting_provider" AS ENUM('vercel', 'external');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('DRAFT', 'PROPOSAL_SENT', 'REQUIRES_REVIEW', 'PAYMENT_RECEIVED', 'AWAITING_ASSETS', 'ASSETS_SUBMITTED', 'ASSETS_UNDER_REVIEW', 'ASSETS_INCOMPLETE', 'PRODUCTION_STARTED', 'STAGING_REVIEW', 'REVISIONS', 'REVISIONS_DONE', 'LIVE', 'SUSPENDED', 'CANCELLED', 'PROPOSAL_EXPIRED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."subscription_plan" AS ENUM('BASIC', 'PRO', 'BUSINESS', 'LEGACY');--> statement-breakpoint
CREATE TYPE "public"."asset_key" AS ENUM('logo', 'photos', 'brand_guide', 'hex_colors', 'copy_doc', 'social_links', 'brief', 'special_instructions', 'product_data');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('pending', 'uploaded', 'under_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."project_event_type" AS ENUM('status_changed', 'asset_uploaded', 'asset_approved', 'asset_rejected', 'assets_submitted_for_review', 'production_started', 'staging_deployed', 'staging_feedback_submitted', 'revision_completed', 'proposal_sent', 'proposal_expired', 'comment_added', 'email_sent', 'payment_received');--> statement-breakpoint
CREATE TYPE "public"."comment_visibility" AS ENUM('internal', 'client');--> statement-breakpoint
CREATE TYPE "public"."addon_type" AS ENUM('QUICK_FIX', 'NEW_BLOCK', 'EXTRA_PAGE', 'MOTION_ANIMATION', 'COPYWRITING', 'SEO_BASICO', 'INTEGRACION_BASICA', 'INTEGRACION_AVANZADA', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."quote_acceptance_source" AS ENUM('portal', 'whatsapp', 'phone', 'in_person', 'other');--> statement-breakpoint
CREATE TYPE "public"."ticket_creator" AS ENUM('CLIENT', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."ticket_event_type" AS ENUM('STATUS_CHANGED', 'NOTE_ADDED', 'PRICE_UPDATED', 'PAYPAL_ORDER_CREATED', 'PAYPAL_WEBHOOK_RECEIVED', 'QUOTE_SENT', 'QUOTE_ACCEPTED', 'QUOTE_DECLINED', 'QUOTE_EXPIRED', 'MANUAL_PAYMENT_RECORDED', 'PAYPAL_CAPTURE_COMPLETED', 'PAYPAL_RECONCILED');--> statement-breakpoint
CREATE TYPE "public"."ticket_event_visibility" AS ENUM('public', 'internal');--> statement-breakpoint
CREATE TYPE "public"."ticket_payment_method" AS ENUM('paypal_checkout', 'bank_transfer', 'cash', 'paypal_external', 'other');--> statement-breakpoint
CREATE TYPE "public"."ticket_quote_status" AS ENUM('none', 'requested', 'needs_info', 'priced', 'accepted', 'declined', 'expired', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."ticket_request_kind" AS ENUM('initial_delivery', 'change', 'correction', 'expansion', 'maintenance', 'reactivation');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PAYMENT_PENDING', 'PAID', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."incident_reporter" AS ENUM('CLIENT', 'ADMIN', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."incident_severity" AS ENUM('P1', 'P2', 'P3');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED');--> statement-breakpoint
CREATE TYPE "public"."addon_category" AS ENUM('design', 'content', 'integration', 'revision', 'custom');--> statement-breakpoint
CREATE TYPE "public"."catalog_availability" AS ENUM('included', 'paid', 'quote', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."catalog_inclusion_scope" AS ENUM('initial_setup', 'recurring_allowance');--> statement-breakpoint
CREATE TYPE "public"."catalog_overage_mode" AS ENUM('paid', 'quote', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."catalog_pricing_mode" AS ENUM('included', 'fixed', 'quote');--> statement-breakpoint
CREATE TYPE "public"."catalog_recurring_period" AS ENUM('calendar_month');--> statement-breakpoint
CREATE TYPE "public"."catalog_source" AS ENUM('waas_ticket', 'legacy_calculator', 'manual', 'legacy_scope');--> statement-breakpoint
CREATE TYPE "public"."backup_method" AS ENUM('zip_manual', 'github_repo', 'r2_storage', 'other');--> statement-breakpoint
CREATE TYPE "public"."nps_trigger" AS ENUM('day_7', 'day_30');--> statement-breakpoint
CREATE TYPE "public"."maintenance_billing_method" AS ENUM('paypal_subscription', 'manual');--> statement-breakpoint
CREATE TYPE "public"."maintenance_contract_status" AS ENUM('active', 'paused', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."maintenance_tier" AS ENUM('care', 'care_plus', 'care_pro', 'custom');--> statement-breakpoint
CREATE TYPE "public"."admin_reminder_priority" AS ENUM('alta', 'media', 'baja');--> statement-breakpoint
CREATE TYPE "public"."admin_reminder_recurrence" AS ENUM('none', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."seo_check_status" AS ENUM('ok', 'site_unreachable', 'api_error');--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_name" text NOT NULL,
	"business_name" text NOT NULL,
	"project_type" "project_type" NOT NULL,
	"niche" "niche" NOT NULL,
	"domain_target" text,
	"client_email" text,
	"client_phone" text,
	"status" "quote_status" DEFAULT 'draft' NOT NULL,
	"total_amount_client" real NOT NULL,
	"total_amount_provider" real NOT NULL,
	"discount_percent" real DEFAULT 0 NOT NULL,
	"discount_reason" text,
	"components_snapshot" jsonb NOT NULL,
	"calculation_snapshot" jsonb NOT NULL,
	"proposal_html" text NOT NULL,
	"executive_summary" text NOT NULL,
	"catalog_snapshot" jsonb,
	"subscription_plan" text,
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"whatsapp" text,
	"business_name" text NOT NULL,
	"industry" "niche" NOT NULL,
	"location" text,
	"current_url" text,
	"material_status" "material_status",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_clerk_user_id_unique" UNIQUE("clerk_user_id"),
	CONSTRAINT "clients_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"plan" "subscription_plan" NOT NULL,
	"monthly_price_cents" integer NOT NULL,
	"setup_fee_cents" integer DEFAULT 5000 NOT NULL,
	"suggested_add_ons" jsonb,
	"paypal_order_id" text,
	"paypal_subscription_id" text,
	"status" "project_status" DEFAULT 'DRAFT' NOT NULL,
	"proposal_sent_at" timestamp with time zone,
	"proposal_expires_at" timestamp with time zone,
	"production_started_at" timestamp with time zone,
	"production_deadline_at" timestamp with time zone,
	"staging_deployed_at" timestamp with time zone,
	"staging_review_deadline_at" timestamp with time zone,
	"live_at" timestamp with time zone,
	"intake_snapshot" jsonb,
	"catalog_snapshot" jsonb,
	"staging_url" text,
	"production_url" text,
	"domain_target" text,
	"internal_notes" text,
	"terms_accepted_at" timestamp with time zone,
	"terms_accepted_ip" text,
	"terms_version" text,
	"portfolio_flag" boolean DEFAULT false NOT NULL,
	"hosting_provider" "hosting_provider" DEFAULT 'vercel',
	"hosting_panel_url" text,
	"delivered_at" timestamp with time zone,
	"post_launch_warranty_ends_at" timestamp with time zone,
	"payment_grace_period_until" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	"reactivation_fee_active" boolean DEFAULT false NOT NULL,
	"wizard_brief" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"asset_key" "asset_key" NOT NULL,
	"r2_key" text,
	"original_name" text,
	"mime_type" text,
	"file_size_bytes" integer,
	"text_value" text,
	"file_index" integer DEFAULT 0 NOT NULL,
	"status" "asset_status" DEFAULT 'pending' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" text,
	"rejection_comment" text,
	"uploaded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"event_type" "project_event_type" NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"from_status" "project_status",
	"to_status" "project_status",
	"asset_key" "asset_key",
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"asset_key" "asset_key",
	"author_id" text NOT NULL,
	"author_type" text NOT NULL,
	"visibility" "comment_visibility" NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staging_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"items" jsonb NOT NULL,
	"all_approved" jsonb,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"event_type" "ticket_event_type" NOT NULL,
	"previous_status" "ticket_status",
	"new_status" "ticket_status",
	"actor_id" text NOT NULL,
	"actor_role" text NOT NULL,
	"quote_revision" integer,
	"acceptance_source" "quote_acceptance_source",
	"payment_method" "ticket_payment_method",
	"amount_cents" integer,
	"currency" text,
	"note" text,
	"metadata" jsonb,
	"visibility" "ticket_event_visibility" DEFAULT 'internal' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"ticket_number" text NOT NULL,
	"addon_catalog_id" uuid,
	"addon_type" "addon_type" NOT NULL,
	"request_kind" "ticket_request_kind" DEFAULT 'change' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"internal_notes" text,
	"price_amount" integer NOT NULL,
	"price_currency" text DEFAULT 'USD' NOT NULL,
	"custom_price_reason" text,
	"billing_decision" text,
	"catalog_decision_snapshot" jsonb,
	"admin_override_reason" text,
	"quote_status" "ticket_quote_status" DEFAULT 'none' NOT NULL,
	"quote_revision" integer DEFAULT 0 NOT NULL,
	"quoted_price_cents" integer,
	"quote_sent_at" timestamp with time zone,
	"quote_scope" text,
	"quote_estimated_business_days" integer,
	"quote_response_note" text,
	"quote_responded_at" timestamp with time zone,
	"quote_expires_at" timestamp with time zone,
	"quote_acceptance_source" "quote_acceptance_source",
	"status" "ticket_status" DEFAULT 'PENDING_APPROVAL' NOT NULL,
	"created_by" "ticket_creator" NOT NULL,
	"paypal_order_id" text,
	"paypal_capture_id" text,
	"paypal_order_quote_revision" integer,
	"paypal_order_amount_cents" integer,
	"payment_method" "ticket_payment_method",
	"payment_reference" text,
	"paid_amount_cents" integer,
	"paid_currency" text,
	"payment_recorded_by" text,
	"sla_hours" integer DEFAULT 48 NOT NULL,
	"due_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"client_submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"payment_requested_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tickets_ticket_number_unique" UNIQUE("ticket_number")
);
--> statement-breakpoint
CREATE TABLE "holidays_rd" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"name" text NOT NULL,
	"year" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "holidays_rd_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paypal_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"project_id" uuid,
	"raw_payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_started_at" timestamp with time zone,
	"processing_attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_events_paypal_event_id_unique" UNIQUE("paypal_event_id")
);
--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"affected_url" text,
	"evidence_url" text,
	"status" "incident_status" DEFAULT 'OPEN' NOT NULL,
	"severity" "incident_severity" DEFAULT 'P3' NOT NULL,
	"reported_by" "incident_reporter" NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_note" text,
	"notify_client_on_resolve" boolean DEFAULT true NOT NULL,
	"client_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "addon_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer NOT NULL,
	"category" "addon_category" DEFAULT 'custom' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"source" "catalog_source" DEFAULT 'manual' NOT NULL,
	"pricing_mode" "catalog_pricing_mode" DEFAULT 'fixed' NOT NULL,
	"list_price_cents" integer DEFAULT 0 NOT NULL,
	"public_name" text,
	"public_description" text,
	"visible_in_calculator" boolean DEFAULT true NOT NULL,
	"visible_in_tickets" boolean DEFAULT true NOT NULL,
	"visible_in_proposals" boolean DEFAULT true NOT NULL,
	"visible_in_portal" boolean DEFAULT false NOT NULL,
	"portal_category_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"admin_notes" text,
	"dependencies" jsonb,
	"conflicts" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "addon_catalog_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "addon_catalog_plan_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"addon_catalog_id" uuid NOT NULL,
	"plan" "subscription_plan" NOT NULL,
	"availability" "catalog_availability" NOT NULL,
	"inclusion_scope" "catalog_inclusion_scope",
	"initial_included_qty" integer DEFAULT 0 NOT NULL,
	"recurring_included_qty" integer DEFAULT 0 NOT NULL,
	"recurring_period" "catalog_recurring_period",
	"overage_mode" "catalog_overage_mode" DEFAULT 'unavailable' NOT NULL,
	"overage_addon_code" text,
	"allowed_request_kinds" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_admin_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"public_name" text NOT NULL,
	"description" text,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"visibility_rule" text DEFAULT 'always' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portal_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "project_capability_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"addon_catalog_id" uuid NOT NULL,
	"ticket_id" uuid,
	"usage_key" text NOT NULL,
	"request_kind" text NOT NULL,
	"decision" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"period_key" text,
	"decision_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"method" "backup_method" NOT NULL,
	"notes" text,
	"backed_up_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nps_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"trigger" "nps_trigger" NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"score" integer,
	"comment" text,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"project_id" uuid,
	"tier" "maintenance_tier" NOT NULL,
	"monthly_price_cents" integer NOT NULL,
	"hosting_included" boolean DEFAULT false NOT NULL,
	"hosting_price_cents" integer DEFAULT 2000 NOT NULL,
	"billing_method" "maintenance_billing_method" DEFAULT 'paypal_subscription' NOT NULL,
	"paypal_subscription_id" text,
	"status" "maintenance_contract_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	"next_billing_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_notification_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"notification_key" text NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"client_label" text,
	"due_date" timestamp with time zone NOT NULL,
	"priority" "admin_reminder_priority" DEFAULT 'media' NOT NULL,
	"recurrence" "admin_reminder_recurrence" DEFAULT 'none' NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"preference_key" text NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "seo_check_status" DEFAULT 'ok' NOT NULL,
	"lighthouse_score" integer,
	"crux_score" text,
	"lcp_ms" integer,
	"cls_score" real,
	"inp_ms" integer,
	"top_issues" jsonb,
	"site_changed" boolean DEFAULT false NOT NULL,
	"raw_data" jsonb,
	"report_sent_at" timestamp with time zone,
	"approved_by_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_approval_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"token" text NOT NULL,
	"report_data" jsonb,
	"changes_applied" text,
	"content_suggestions" text,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seo_approval_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assets" ADD CONSTRAINT "project_assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_events" ADD CONSTRAINT "project_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staging_feedback" ADD CONSTRAINT "staging_feedback_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_addon_catalog_id_addon_catalog_id_fk" FOREIGN KEY ("addon_catalog_id") REFERENCES "public"."addon_catalog"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_catalog" ADD CONSTRAINT "addon_catalog_portal_category_id_portal_categories_id_fk" FOREIGN KEY ("portal_category_id") REFERENCES "public"."portal_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_catalog_plan_rules" ADD CONSTRAINT "addon_catalog_plan_rules_addon_catalog_id_addon_catalog_id_fk" FOREIGN KEY ("addon_catalog_id") REFERENCES "public"."addon_catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_capability_usage" ADD CONSTRAINT "project_capability_usage_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_capability_usage" ADD CONSTRAINT "project_capability_usage_addon_catalog_id_addon_catalog_id_fk" FOREIGN KEY ("addon_catalog_id") REFERENCES "public"."addon_catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_capability_usage" ADD CONSTRAINT "project_capability_usage_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backups" ADD CONSTRAINT "backups_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nps_responses" ADD CONSTRAINT "nps_responses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nps_responses" ADD CONSTRAINT "nps_responses_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_contracts" ADD CONSTRAINT "maintenance_contracts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_contracts" ADD CONSTRAINT "maintenance_contracts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_notification_reads" ADD CONSTRAINT "admin_notification_reads_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_reminders" ADD CONSTRAINT "admin_reminders_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_notification_preferences" ADD CONSTRAINT "admin_notification_preferences_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_reports" ADD CONSTRAINT "seo_reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_approval_tokens" ADD CONSTRAINT "seo_approval_tokens_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_asset_idx" ON "project_assets" USING btree ("project_id","asset_key","file_index");--> statement-breakpoint
CREATE INDEX "tickets_paypal_order_id_idx" ON "tickets" USING btree ("paypal_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_paypal_capture_id_uidx" ON "tickets" USING btree ("paypal_capture_id");--> statement-breakpoint
CREATE INDEX "tickets_project_status_idx" ON "tickets" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "webhook_events_project_id_idx" ON "webhook_events" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "webhook_events_unprocessed_idx" ON "webhook_events" USING btree ("processed_at","event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "addon_catalog_plan_rules_addon_plan_idx" ON "addon_catalog_plan_rules" USING btree ("addon_catalog_id","plan");--> statement-breakpoint
CREATE UNIQUE INDEX "project_capability_usage_usage_key_idx" ON "project_capability_usage" USING btree ("usage_key");--> statement-breakpoint
CREATE INDEX "project_capability_usage_project_capability_idx" ON "project_capability_usage" USING btree ("project_id","addon_catalog_id");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_notification_reads_admin_key_idx" ON "admin_notification_reads" USING btree ("admin_id","notification_key");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_notification_preferences_admin_key_idx" ON "admin_notification_preferences" USING btree ("admin_id","preference_key");
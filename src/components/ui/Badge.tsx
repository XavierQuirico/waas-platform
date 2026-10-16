import * as React from "react";

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "error"
  | "info"
  // Project workflow states — aligned to state-machine.ts (16 states)
  | "draft"
  | "proposal_sent"
  | "proposal_expired"
  | "requires_review"
  | "payment_received"
  | "awaiting_assets"
  | "assets_submitted"
  | "assets_under_review"
  | "assets_incomplete"
  | "production_started"
  | "staging_review"
  | "revisions"
  | "revisions_done"
  | "live"
  | "suspended"
  | "cancelled";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  // Semantic states
  default:             "bg-gray-100 text-gray-700",
  success:             "bg-success-100 text-success-700",
  warning:             "bg-warning-100 text-warning-700",
  error:               "bg-error-100 text-error-700",
  info:                "bg-info-100 text-info-700",
  // Project workflow states (16-state machine)
  draft:               "bg-gray-100 text-gray-600",
  proposal_sent:       "bg-info-100 text-info-600",
  proposal_expired:    "bg-gray-100 text-gray-500",
  requires_review:     "bg-warning-100 text-warning-700",
  payment_received:    "bg-success-100 text-success-600",
  awaiting_assets:     "bg-warning-100 text-warning-700",
  assets_submitted:    "bg-info-100 text-info-700",
  assets_under_review: "bg-info-100 text-info-600",
  assets_incomplete:   "bg-error-100 text-error-700",
  production_started:  "bg-info-100 text-info-700",
  staging_review:      "bg-purple-100 text-purple-700",
  revisions:           "bg-warning-100 text-warning-700",
  revisions_done:      "bg-success-100 text-success-600",
  live:                "bg-success-100 text-success-700",
  suspended:           "bg-error-100 text-error-700",
  cancelled:           "bg-gray-200 text-gray-600",
};

export function Badge({ variant = "default", children, className = "" }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

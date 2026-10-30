import React from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, Circle } from "lucide-react";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

interface StatusBadgeProps {
  tone?: StatusTone;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  size?: "sm" | "md";
  className?: string;
}

const toneStyles: Record<StatusTone, { badge: string; defaultIcon: typeof CheckCircle2 }> = {
  success: {
    badge: "bg-success-tint text-success border-success/30",
    defaultIcon: CheckCircle2,
  },
  warning: {
    badge: "bg-warning-tint text-warning border-warning/30",
    defaultIcon: AlertTriangle,
  },
  danger: {
    badge: "bg-danger-tint text-danger border-danger/30",
    defaultIcon: XCircle,
  },
  info: {
    badge: "bg-info-tint text-info border-info/30",
    defaultIcon: Info,
  },
  neutral: {
    badge: "bg-surface-subtle text-text-2 border-border",
    defaultIcon: Circle,
  },
};

export function StatusBadge({
  tone = "neutral",
  children,
  icon: CustomIcon,
  size = "md",
  className = "",
}: StatusBadgeProps) {
  const { badge, defaultIcon: DefaultIcon } = toneStyles[tone] || toneStyles.neutral;
  const Icon = CustomIcon || DefaultIcon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${badge} ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
      } ${className}`}
    >
      <Icon className={size === "sm" ? "h-3 w-3 shrink-0" : "h-3.5 w-3.5 shrink-0"} />
      <span className="leading-none">{children}</span>
    </span>
  );
}

export default StatusBadge;

import type { HTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";

type PriorityStyles = {
  border: string;
  background: string;
  badge: string;
  label: string;
};

const priorityStyles: Record<string, PriorityStyles> = {
  urgent: {
    border: "priority-urgent-border",
    background: "priority-urgent-surface",
    badge: "priority-urgent-badge",
    label: "Urgente",
  },
  high: {
    border: "priority-high-border",
    background: "priority-high-surface",
    badge: "priority-high-badge",
    label: "Alta",
  },
  normal: {
    border: "priority-normal-border",
    background: "priority-normal-surface",
    badge: "priority-normal-badge",
    label: "Normale",
  },
  low: {
    border: "priority-low-border",
    background: "priority-low-surface",
    badge: "priority-low-badge",
    label: "Bassa",
  },
};

export function getPriorityStyles(priority: string): PriorityStyles {
  return priorityStyles[priority] ?? priorityStyles.normal;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const styles = getPriorityStyles(priority);
  return <Badge className={styles.badge}>{styles.label}</Badge>;
}

export function Card({ className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
      {...props}
    />
  );
}

export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

export function FormLabel({ children, className = "", ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={`block ${className}`} {...props}>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

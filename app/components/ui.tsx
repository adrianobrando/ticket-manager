import type { HTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";

type PriorityStyles = {
  border: string;
  background: string;
  badge: string;
  label: string;
};

const priorityStyles: Record<string, PriorityStyles> = {
  urgent: {
    border: "border-red-500",
    background: "bg-red-50",
    badge: "bg-red-100 text-red-800",
    label: "Urgente",
  },
  high: {
    border: "border-orange-500",
    background: "bg-orange-50",
    badge: "bg-orange-100 text-orange-800",
    label: "Alta",
  },
  normal: {
    border: "border-green-500",
    background: "bg-green-50",
    badge: "bg-green-100 text-green-800",
    label: "Normale",
  },
  low: {
    border: "border-sky-500",
    background: "bg-sky-50",
    badge: "bg-sky-100 text-sky-800",
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
  return <section className={`rounded-2xl bg-white shadow-sm ${className}`} {...props} />;
}

export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${className}`}>
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

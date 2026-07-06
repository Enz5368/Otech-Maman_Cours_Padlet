import { clsx } from "clsx";

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={clsx("rounded-lg border border-wine-100/70 bg-white/82 p-5 shadow-soft", className)}>{children}</section>;
}

export function Badge({ children, tone = "bg-wine-100 text-wine-700 border-wine-100" }: { children: React.ReactNode; tone?: string }) {
  return <span className={clsx("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", tone)}>{children}</span>;
}

import Link from "next/link";
import { ArrowLeft, Eye, LayoutDashboard, LogOut } from "lucide-react";

export function AdminShell({
  title,
  subtitle,
  previewHref,
  backHref,
  children
}: {
  title: string;
  subtitle?: string;
  previewHref?: string;
  backHref?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-paper">
      <header className="sticky top-0 z-20 border-b border-wine-100 bg-paper/95 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link href={backHref || "/admin/dashboard"} className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-wine-700 shadow-sm" title="Retour">
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-xs font-bold uppercase text-wine-700">
                <LayoutDashboard size={14} /> Editeur
              </p>
              <h1 className="truncate text-2xl font-bold text-wine-900">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-ink/60">{subtitle}</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {previewHref && (
              <Link href={previewHref} target="_blank" className="inline-flex items-center gap-2 rounded-lg border border-wine-100 bg-white px-4 py-2 text-sm font-semibold text-wine-700">
                <Eye size={16} /> Apercu
              </Link>
            )}
            <form action="/api/admin/logout" method="post">
              <button className="inline-flex items-center gap-2 rounded-lg bg-wine-700 px-4 py-2 text-sm font-semibold text-white">
                <LogOut size={16} /> Deconnexion
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-7xl gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_380px]">{children}</div>
    </main>
  );
}

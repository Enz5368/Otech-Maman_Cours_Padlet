import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { statusLabels } from "@/lib/format";

type Item = {
  id: string;
  title: string;
  description: string;
  status: string;
  isPublished: boolean;
};

export function AdminItemList({
  title,
  empty,
  items,
  hrefFor,
  addLabel,
  addHref
}: {
  title: string;
  empty: string;
  items: Item[];
  hrefFor?: (item: Item) => string;
  addLabel?: string;
  addHref?: string;
}) {
  return (
    <section className="rounded-lg border border-wine-100 bg-white p-4 shadow-soft">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-wine-900">{title}</h2>
        {addHref && addLabel && (
          <Link href={addHref} className="inline-flex items-center gap-2 rounded-lg bg-wine-700 px-4 py-2 text-sm font-semibold text-white">
            <Plus size={16} /> {addLabel}
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-wine-100 bg-paper/45 p-5 text-sm text-ink/60">{empty}</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const content = (
              <>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-wine-900">{item.title}</h3>
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-wine-700">{statusLabels[item.status]}</span>
                  {!item.isPublished && <span className="rounded-full bg-ink/10 px-2 py-1 text-xs font-semibold text-ink/60">Masque</span>}
                </div>
                <p className="mt-1 text-sm text-ink/62">{item.description || "Aucune description."}</p>
              </div>
              {hrefFor && (
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-wine-700">
                  Ouvrir <ChevronRight size={17} />
                </span>
              )}
              </>
            );
            return hrefFor ? (
              <Link key={item.id} href={hrefFor(item)} className="grid gap-3 rounded-lg border border-wine-100 bg-paper/45 p-4 transition hover:border-wine-700/50 hover:bg-white sm:grid-cols-[1fr_auto] sm:items-center">
                {content}
              </Link>
            ) : (
              <article key={item.id} className="grid gap-3 rounded-lg border border-wine-100 bg-paper/45 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                {content}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

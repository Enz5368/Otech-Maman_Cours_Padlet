import Link from "next/link";

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="container-pad mt-6 flex flex-wrap items-center gap-2 text-sm text-ink/60">
      <Link className="font-medium text-wine-700" href="/">
        Accueil
      </Link>
      {items.map((item) => (
        <span className="flex items-center gap-2" key={item.label}>
          <span>/</span>
          {item.href ? (
            <Link className="font-medium text-wine-700" href={item.href}>
              {item.label}
            </Link>
          ) : (
            <span>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

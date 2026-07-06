import Link from "next/link";
import { LogIn, MapPinned } from "lucide-react";

export function Header() {
  return (
    <header className="border-b border-wine-100/80 bg-paper/85 backdrop-blur">
      <div className="container-pad flex min-h-20 items-center justify-between gap-4 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-wine-700 text-white shadow-soft">
            <MapPinned size={25} />
          </span>
          <span>
            <span className="block text-xl font-semibold text-wine-900">In viaggio per l'Italia</span>
            <span className="block text-sm text-ink/65">Navigando, s'impara.</span>
          </span>
        </Link>
        <nav className="flex items-center gap-2 text-sm font-medium">
          <Link className="rounded-full px-3 py-2 text-ink/75 hover:bg-white" href="/classes">
            Classes
          </Link>
          <Link className="rounded-full px-3 py-2 text-ink/75 hover:bg-white" href="/depot">
            Depot
          </Link>
          <Link className="grid size-10 place-items-center rounded-full bg-wine-700 text-white shadow-soft" href="/admin" title="Mode editeur">
            <LogIn size={18} />
          </Link>
        </nav>
      </div>
    </header>
  );
}

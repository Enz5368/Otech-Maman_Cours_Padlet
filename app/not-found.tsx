import Link from "next/link";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="container-pad grid min-h-[60vh] place-items-center py-10">
        <Card className="max-w-xl text-center">
          <h1 className="text-3xl font-bold text-wine-900">Page introuvable</h1>
          <p className="mt-3 text-ink/65">La ressource demandee n'existe pas ou n'est pas encore publiee.</p>
          <Link className="mt-6 inline-flex rounded-lg bg-wine-700 px-5 py-3 font-semibold text-white" href="/">
            Retour a l'accueil
          </Link>
        </Card>
      </main>
    </>
  );
}

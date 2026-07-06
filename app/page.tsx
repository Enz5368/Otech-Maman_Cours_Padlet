import Link from "next/link";
import { ArrowRight, BookOpen, LibraryBig, Newspaper, UploadCloud } from "lucide-react";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { ResourceList } from "@/components/ResourceList";
import { getHomeData } from "@/lib/data";
import { statusLabels } from "@/lib/format";

export default async function HomePage() {
  const { classes, news, resources } = await getHomeData();

  return (
    <>
      <Header />
      <main>
        <section className="container-pad grid gap-8 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:py-14">
          <div className="flex flex-col justify-center">
            <p className="mb-3 text-sm font-bold uppercase text-wine-700">Portail pedagogique d'italien</p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight text-wine-900 sm:text-5xl">In viaggio per l'Italia</h1>
            <p className="mt-3 text-2xl font-medium text-ink/70">Navigando, s'impara.</p>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-ink/68">
              Retrouvez les sequences, seances, activites, audios, videos, affiches et documents utiles pour travailler en classe et a la maison.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link className="inline-flex items-center gap-2 rounded-lg bg-wine-700 px-5 py-3 font-semibold text-white shadow-soft" href="/classes">
                Choisir ma classe <ArrowRight size={18} />
              </Link>
              <Link className="inline-flex items-center gap-2 rounded-lg border border-wine-100 bg-white px-5 py-3 font-semibold text-wine-700" href="/depot">
                Ouvrir le depot
              </Link>
            </div>
          </div>
          <Card className="bg-white">
            <div className="flex items-center gap-3">
              <LibraryBig className="text-wine-700" size={28} />
              <div>
                <h2 className="text-xl font-bold text-wine-900">Classes</h2>
                <p className="text-sm text-ink/60">Acces rapide aux espaces eleves</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {classes.map((classe) => (
                <Link key={classe.id} href={`/classes/${classe.slug}`} className="rounded-lg border border-wine-100 bg-paper/60 p-4 transition hover:bg-white">
                  <span className="font-semibold text-wine-900">{classe.title}</span>
                  <span className="mt-1 block text-sm text-ink/60">{classe.sequences.length} sequences publiees</span>
                </Link>
              ))}
            </div>
          </Card>
        </section>

        <section className="container-pad grid gap-5 pb-12 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <div className="mb-4 flex items-center gap-3">
              <Newspaper className="text-wine-700" />
              <h2 className="text-xl font-bold text-wine-900">Fil d'actualites</h2>
            </div>
            <div className="space-y-3">
              {news.map((item) => (
                <article key={item.id} className="rounded-lg bg-paper/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-wine-900">{item.title}</h3>
                    <span className="text-xs font-semibold text-wine-700">{statusLabels[item.status]}</span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-ink/65">{item.description}</p>
                </article>
              ))}
            </div>
          </Card>
          <Card>
            <div className="mb-4 flex items-center gap-3">
              <UploadCloud className="text-wine-700" />
              <h2 className="text-xl font-bold text-wine-900">Depot</h2>
            </div>
            <ResourceList resources={resources} />
          </Card>
        </section>

        <section className="container-pad pb-14">
          <Card className="bg-wine-900 text-white">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold">
                  <BookOpen size={22} /> Liens utiles
                </h2>
                <p className="mt-1 text-white/75">Dictionnaires, ressources culturelles et supports officiels pour approfondir.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm font-semibold">
                <a className="rounded-lg bg-white/10 px-4 py-2" href="https://www.italia.it/fr" target="_blank" rel="noreferrer">
                  Italia.it
                </a>
                <a className="rounded-lg bg-white/10 px-4 py-2" href="https://www.wordreference.com/itfr/" target="_blank" rel="noreferrer">
                  WordReference
                </a>
              </div>
            </div>
          </Card>
        </section>
      </main>
    </>
  );
}

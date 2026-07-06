import Link from "next/link";
import { BookOpen, Clapperboard, FileStack, Layers, Sparkles } from "lucide-react";
import { Header } from "@/components/Header";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Card } from "@/components/Card";
import { ResourceList } from "@/components/ResourceList";
import { ViewerEditPanel } from "@/components/admin/ViewerEditPanel";
import { getClass } from "@/lib/data";
import { statusLabels } from "@/lib/format";
import { isAdmin } from "@/lib/auth";

export default async function ClassPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const classe = await getClass(slug);
  const admin = await isAdmin();
  const activitiesCount = classe.sequences.reduce((sum, sequence) => sum + sequence.sessions.length, 0);

  return (
    <>
      <Header />
      <Breadcrumbs items={[{ label: "Classes", href: "/classes" }, { label: classe.title }]} />
      <main className="container-pad py-8">
        <section className="rounded-lg bg-wine-900 p-7 text-white shadow-soft">
          <h1 className="text-3xl font-bold">{classe.title}</h1>
          <p className="mt-3 max-w-3xl leading-7 text-white/78">{classe.description}</p>
        </section>

        <div className="mt-7 grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
          <div className="space-y-5">
            <Card>
              <h2 className="flex items-center gap-2 text-lg font-bold text-wine-900">
                <Sparkles size={20} /> Presentation
              </h2>
              <p className="mt-3 text-sm leading-6 text-ink/65">Un espace organise pour suivre les contenus de cours, reviser et retrouver les supports importants.</p>
            </Card>
            <Card>
              <h2 className="flex items-center gap-2 text-lg font-bold text-wine-900">
                <FileStack size={20} /> Ressources
              </h2>
              <ResourceList resources={classe.resources} />
            </Card>
          </div>

          <div className="space-y-5">
            <Card>
              <h2 className="flex items-center gap-2 text-lg font-bold text-wine-900">
                <Layers size={20} /> Sequences
              </h2>
              <div className="mt-4 grid gap-3">
                {classe.sequences.map((sequence) => (
                  <Link key={sequence.id} href={`/classes/${classe.slug}/sequences/${sequence.slug}`} className="rounded-lg border border-wine-100 bg-paper/55 p-4 hover:bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold text-wine-900">{sequence.title}</h3>
                      <span className="text-xs font-semibold text-wine-700">{statusLabels[sequence.status]}</span>
                    </div>
                    <p className="mt-1 text-sm text-ink/62">{sequence.description}</p>
                  </Link>
                ))}
              </div>
            </Card>
            <div className="grid gap-5 sm:grid-cols-2">
              <Card>
                <h2 className="flex items-center gap-2 font-bold text-wine-900">
                  <BookOpen size={18} /> Activites
                </h2>
                <p className="mt-2 text-3xl font-bold text-wine-700">{activitiesCount}</p>
                <p className="text-sm text-ink/60">seances disponibles</p>
              </Card>
              <Card>
                <h2 className="flex items-center gap-2 font-bold text-wine-900">
                  <Clapperboard size={18} /> Multimedia
                </h2>
                <p className="mt-2 text-3xl font-bold text-wine-700">{classe.resources.length}</p>
                <p className="text-sm text-ink/60">supports rattaches</p>
              </Card>
            </div>
          </div>
        </div>
      </main>
      {admin && <ViewerEditPanel parentIds={{ classId: classe.id }} />}
    </>
  );
}

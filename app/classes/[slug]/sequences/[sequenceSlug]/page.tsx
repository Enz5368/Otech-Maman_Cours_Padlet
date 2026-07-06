import Link from "next/link";
import { Header } from "@/components/Header";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Card } from "@/components/Card";
import { ResourceList } from "@/components/ResourceList";
import { ViewerEditPanel } from "@/components/admin/ViewerEditPanel";
import { getSequence } from "@/lib/data";
import { isAdmin } from "@/lib/auth";

export default async function SequencePage({ params }: { params: Promise<{ slug: string; sequenceSlug: string }> }) {
  const { slug, sequenceSlug } = await params;
  const sequence = await getSequence(slug, sequenceSlug);
  const admin = await isAdmin();

  return (
    <>
      <Header />
      <Breadcrumbs items={[{ label: sequence.class.title, href: `/classes/${sequence.class.slug}` }, { label: sequence.title }]} />
      <main className="container-pad grid gap-6 py-8 lg:grid-cols-[1fr_0.8fr]">
        <section>
          <h1 className="text-3xl font-bold text-wine-900">{sequence.title}</h1>
          <p className="mt-2 max-w-3xl text-ink/65">{sequence.description}</p>
          <div className="mt-6 grid gap-4">
            {sequence.sessions.map((session) => (
              <Link key={session.id} href={`/classes/${sequence.class.slug}/sequences/${sequence.slug}/sessions/${session.slug}`}>
                <Card className="transition hover:bg-white">
                  <h2 className="text-lg font-bold text-wine-900">{session.title}</h2>
                  <p className="mt-1 text-sm text-ink/65">{session.description}</p>
                  <p className="mt-3 text-sm font-semibold text-wine-700">{session.activities.length} activites</p>
                </Card>
              </Link>
            ))}
          </div>
        </section>
        <aside>
          <Card>
            <h2 className="mb-4 text-lg font-bold text-wine-900">Ressources de sequence</h2>
            <ResourceList resources={sequence.resources} />
          </Card>
        </aside>
      </main>
      {admin && <ViewerEditPanel parentIds={{ classId: sequence.class.id, sequenceId: sequence.id }} />}
    </>
  );
}

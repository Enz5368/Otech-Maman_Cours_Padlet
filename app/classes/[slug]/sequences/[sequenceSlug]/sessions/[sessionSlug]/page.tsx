import Link from "next/link";
import { Header } from "@/components/Header";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Card } from "@/components/Card";
import { ResourceList } from "@/components/ResourceList";
import { ViewerEditPanel } from "@/components/admin/ViewerEditPanel";
import { getSession } from "@/lib/data";
import { isAdmin } from "@/lib/auth";

export default async function SessionPage({ params }: { params: Promise<{ slug: string; sequenceSlug: string; sessionSlug: string }> }) {
  const { slug, sequenceSlug, sessionSlug } = await params;
  const session = await getSession(slug, sequenceSlug, sessionSlug);
  const admin = await isAdmin();
  const base = `/classes/${session.sequence.class.slug}/sequences/${session.sequence.slug}/sessions/${session.slug}`;

  return (
    <>
      <Header />
      <Breadcrumbs
        items={[
          { label: session.sequence.class.title, href: `/classes/${session.sequence.class.slug}` },
          { label: session.sequence.title, href: `/classes/${session.sequence.class.slug}/sequences/${session.sequence.slug}` },
          { label: session.title }
        ]}
      />
      <main className="container-pad py-8">
        <h1 className="text-3xl font-bold text-wine-900">{session.title}</h1>
        <p className="mt-2 max-w-3xl text-ink/65">{session.description}</p>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="grid gap-4">
            {session.activities.map((activity) => (
              <Link key={activity.id} href={`${base}/activities/${activity.slug}`}>
                <Card className="transition hover:bg-white">
                  <h2 className="text-lg font-bold text-wine-900">{activity.title}</h2>
                  <p className="mt-1 text-sm text-ink/65">{activity.description}</p>
                  <p className="mt-3 text-sm font-semibold text-wine-700">{activity.resources.length} ressources</p>
                </Card>
              </Link>
            ))}
          </section>
          <aside>
            <Card>
              <h2 className="mb-4 text-lg font-bold text-wine-900">Ressources de seance</h2>
              <ResourceList resources={session.resources} />
            </Card>
          </aside>
        </div>
      </main>
      {admin && <ViewerEditPanel parentIds={{ classId: session.sequence.class.id, sequenceId: session.sequence.id, sessionId: session.id }} canAddActivity />}
    </>
  );
}

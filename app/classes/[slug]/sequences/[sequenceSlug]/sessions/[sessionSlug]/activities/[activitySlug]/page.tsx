import { Header } from "@/components/Header";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Card } from "@/components/Card";
import { ResourceList } from "@/components/ResourceList";
import { ViewerEditPanel } from "@/components/admin/ViewerEditPanel";
import { getActivity } from "@/lib/data";
import { dateLabel, statusLabels } from "@/lib/format";
import { isAdmin } from "@/lib/auth";

export default async function ActivityPage({ params }: { params: Promise<{ slug: string; sequenceSlug: string; sessionSlug: string; activitySlug: string }> }) {
  const { slug, sequenceSlug, sessionSlug, activitySlug } = await params;
  const activity = await getActivity(slug, sequenceSlug, sessionSlug, activitySlug);
  const admin = await isAdmin();
  const session = activity.session;
  const sequence = session.sequence;
  const classe = sequence.class;

  return (
    <>
      <Header />
      <Breadcrumbs
        items={[
          { label: classe.title, href: `/classes/${classe.slug}` },
          { label: sequence.title, href: `/classes/${classe.slug}/sequences/${sequence.slug}` },
          { label: session.title, href: `/classes/${classe.slug}/sequences/${sequence.slug}/sessions/${session.slug}` },
          { label: activity.title }
        ]}
      />
      <main className="container-pad grid gap-6 py-8 lg:grid-cols-[1fr_0.9fr]">
        <section className="space-y-5">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold text-wine-900">{activity.title}</h1>
                <p className="mt-2 text-ink/65">{activity.description}</p>
              </div>
              <span className="rounded-full bg-paper px-3 py-1 text-sm font-semibold text-wine-700">{statusLabels[activity.status]}</span>
            </div>
            {activity.publishDate && <p className="mt-4 text-sm text-ink/55">Publication : {dateLabel(activity.publishDate)}</p>}
          </Card>
          <Card>
            <h2 className="text-xl font-bold text-wine-900">Consigne</h2>
            <p className="mt-3 leading-7 text-ink/70">{activity.instruction}</p>
          </Card>
          <Card>
            <h2 className="text-xl font-bold text-wine-900">Texte</h2>
            <p className="mt-3 whitespace-pre-line leading-7 text-ink/70">{activity.text}</p>
          </Card>
        </section>
        <aside>
          <Card>
            <h2 className="mb-4 text-xl font-bold text-wine-900">Fichiers et liens</h2>
            <ResourceList resources={activity.resources} />
          </Card>
        </aside>
      </main>
      {admin && (
        <ViewerEditPanel
          parentIds={{ classId: classe.id, sequenceId: sequence.id, sessionId: session.id, activityId: activity.id }}
          activity={{
            id: activity.id,
            title: activity.title,
            slug: activity.slug,
            description: activity.description,
            instruction: activity.instruction,
            text: activity.text,
            order: activity.order,
            status: activity.status,
            isPublished: activity.isPublished,
            publishDate: activity.publishDate,
            sessionId: session.id
          }}
        />
      )}
    </>
  );
}

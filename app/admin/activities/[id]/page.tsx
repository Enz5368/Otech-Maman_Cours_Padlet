import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/admin/pages/AdminShell";
import { AdminEntityForm } from "@/components/admin/pages/AdminEntityForm";
import { AdminItemList } from "@/components/admin/pages/AdminItemList";

export default async function AdminActivityPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) redirect("/admin");
  const { id } = await params;
  const activity = await prisma.activity.findUnique({
    where: { id },
    include: {
      session: { include: { sequence: { include: { class: true } } } },
      resources: { orderBy: { order: "asc" } }
    }
  });
  if (!activity) notFound();

  const session = activity.session;
  const sequence = session.sequence;
  const classe = sequence.class;

  return (
    <AdminShell
      title={activity.title}
      subtitle="Activite : modifier le texte et ajouter ses fichiers ou liens."
      previewHref={`/classes/${classe.slug}/sequences/${sequence.slug}/sessions/${session.slug}/activities/${activity.slug}`}
      backHref={`/admin/sessions/${session.id}`}
    >
      <div className="space-y-5">
        <AdminItemList title="Ressources de cette activite" empty="Aucune ressource pour cette activite." items={activity.resources} />
      </div>
      <aside className="space-y-5">
        <AdminEntityForm entity="activity" item={activity as unknown as Record<string, unknown>} />
        <AdminEntityForm entity="resource" parent={{ activityId: activity.id }} submitLabel="Ajouter une ressource" />
      </aside>
    </AdminShell>
  );
}

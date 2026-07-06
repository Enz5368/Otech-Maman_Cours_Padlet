import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/admin/pages/AdminShell";
import { AdminEntityForm } from "@/components/admin/pages/AdminEntityForm";
import { AdminItemList } from "@/components/admin/pages/AdminItemList";

export default async function AdminSessionPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) redirect("/admin");
  const { id } = await params;
  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      sequence: { include: { class: true } },
      activities: { orderBy: { order: "asc" } }
    }
  });
  if (!session) notFound();

  const sequence = session.sequence;
  const classe = sequence.class;

  return (
    <AdminShell
      title={session.title}
      subtitle={`Seance de ${sequence.title} : modifier et ouvrir ses activites.`}
      previewHref={`/classes/${classe.slug}/sequences/${sequence.slug}/sessions/${session.slug}`}
      backHref={`/admin/sequences/${sequence.id}`}
    >
      <div className="space-y-5">
        <AdminItemList title="Activites de cette seance" empty="Aucune activite pour cette seance." items={session.activities} hrefFor={(item) => `/admin/activities/${item.id}`} />
      </div>
      <aside className="space-y-5">
        <AdminEntityForm entity="session" item={session as unknown as Record<string, unknown>} />
        <AdminEntityForm entity="activity" parent={{ sessionId: session.id }} submitLabel="Ajouter une activite" />
      </aside>
    </AdminShell>
  );
}

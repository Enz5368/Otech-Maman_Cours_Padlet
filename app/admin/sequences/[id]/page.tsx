import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/admin/pages/AdminShell";
import { AdminEntityForm } from "@/components/admin/pages/AdminEntityForm";
import { AdminItemList } from "@/components/admin/pages/AdminItemList";

export default async function AdminSequencePage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) redirect("/admin");
  const { id } = await params;
  const sequence = await prisma.sequence.findUnique({
    where: { id },
    include: { class: true, sessions: { orderBy: { order: "asc" } } }
  });
  if (!sequence) notFound();

  return (
    <AdminShell
      title={sequence.title}
      subtitle={`Sequence de ${sequence.class.title} : modifier et ouvrir ses seances.`}
      backHref={`/admin/classes/${sequence.classId}`}
    >
      <div className="space-y-5">
        <AdminItemList title="Seances de cette sequence" empty="Aucune seance pour cette sequence." items={sequence.sessions} hrefFor={(item) => `/admin/sessions/${item.id}`} />
      </div>
      <aside className="space-y-5">
        <AdminEntityForm entity="sequence" item={sequence as unknown as Record<string, unknown>} />
        <AdminEntityForm entity="session" parent={{ sequenceId: sequence.id }} submitLabel="Ajouter une seance" />
      </aside>
    </AdminShell>
  );
}

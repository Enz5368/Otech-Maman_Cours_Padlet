import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/admin/pages/AdminShell";
import { AdminEntityForm } from "@/components/admin/pages/AdminEntityForm";
import { AdminItemList } from "@/components/admin/pages/AdminItemList";

export default async function AdminClassPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) redirect("/admin");
  const { id } = await params;
  const classe = await prisma.class.findUnique({
    where: { id },
    include: { sequences: { orderBy: { order: "asc" } } }
  });
  if (!classe) notFound();

  return (
    <AdminShell title={classe.title} subtitle="Classe : modifier les informations et ouvrir ses sequences.">
      <div className="space-y-5">
        <AdminItemList
          title="Sequences de cette classe"
          empty="Aucune sequence pour cette classe."
          items={classe.sequences}
          hrefFor={(item) => `/admin/sequences/${item.id}`}
        />
      </div>
      <aside className="space-y-5">
        <AdminEntityForm entity="class" item={classe as unknown as Record<string, unknown>} />
        <AdminEntityForm entity="sequence" parent={{ classId: classe.id }} submitLabel="Ajouter une sequence" />
      </aside>
    </AdminShell>
  );
}

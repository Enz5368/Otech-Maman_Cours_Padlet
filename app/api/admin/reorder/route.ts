import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

type Entity = "class" | "sequence" | "session" | "activity" | "resource" | "news";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const { entity, ids } = (await request.json()) as { entity: Entity; ids: string[] };
    await Promise.all(
      ids.map((id, index) => {
        const data = { order: index + 1 };
        if (entity === "class") return prisma.class.update({ where: { id }, data });
        if (entity === "sequence") return prisma.sequence.update({ where: { id }, data });
        if (entity === "session") return prisma.session.update({ where: { id }, data });
        if (entity === "activity") return prisma.activity.update({ where: { id }, data });
        if (entity === "resource") return prisma.resource.update({ where: { id }, data });
        return prisma.news.update({ where: { id }, data });
      })
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Reorganisation impossible." }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/format";

type Entity = "class" | "sequence" | "session" | "activity" | "resource" | "news";
type Status = "AVAILABLE" | "SOON" | "UPCOMING";
type ResourceType = "AUDIO" | "VIDEO" | "IMAGE" | "PDF" | "DOCUMENT" | "LINK";

async function adminData() {
  const [classes, news, resources] = await Promise.all([
    prisma.class.findMany({
      orderBy: { order: "asc" },
      include: {
        sequences: {
          orderBy: { order: "asc" },
          include: { sessions: { orderBy: { order: "asc" }, include: { activities: { orderBy: { order: "asc" }, include: { resources: true } } } }, resources: true }
        },
        resources: true
      }
    }),
    prisma.news.findMany({ orderBy: { order: "asc" } }),
    prisma.resource.findMany({ orderBy: { order: "asc" } })
  ]);
  return { classes, news, resources };
}

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await adminData());
  } catch {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const entity = body.entity as Entity;
    const payload = normalize(body);

    if (entity === "class") await prisma.class.create({ data: payload.classData });
    if (entity === "sequence") await prisma.sequence.create({ data: { ...payload.baseData, classId: body.classId } });
    if (entity === "session") await prisma.session.create({ data: { ...payload.baseData, sequenceId: body.sequenceId } });
    if (entity === "activity") await prisma.activity.create({ data: { ...payload.activityData, sessionId: body.sessionId } });
    if (entity === "resource") await prisma.resource.create({ data: payload.resourceData });
    if (entity === "news") await prisma.news.create({ data: payload.classData });

    return NextResponse.json(await adminData());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur." }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const entity = body.entity as Entity;
    const id = body.id as string;
    const payload = normalize(body);

    if (entity === "class") await prisma.class.update({ where: { id }, data: payload.classData });
    if (entity === "sequence") await prisma.sequence.update({ where: { id }, data: payload.baseData });
    if (entity === "session") await prisma.session.update({ where: { id }, data: payload.baseData });
    if (entity === "activity") await prisma.activity.update({ where: { id }, data: payload.activityData });
    if (entity === "resource") await prisma.resource.update({ where: { id }, data: payload.resourceData });
    if (entity === "news") await prisma.news.update({ where: { id }, data: payload.classData });

    return NextResponse.json(await adminData());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const { entity, id } = (await request.json()) as { entity: Entity; id: string };
    if (entity === "class") await prisma.class.delete({ where: { id } });
    if (entity === "sequence") await prisma.sequence.delete({ where: { id } });
    if (entity === "session") await prisma.session.delete({ where: { id } });
    if (entity === "activity") await prisma.activity.delete({ where: { id } });
    if (entity === "resource") await prisma.resource.delete({ where: { id } });
    if (entity === "news") await prisma.news.delete({ where: { id } });
    return NextResponse.json(await adminData());
  } catch {
    return NextResponse.json({ error: "Suppression impossible." }, { status: 400 });
  }
}

function normalize(body: Record<string, unknown>) {
  const title = String(body.title || "Sans titre");
  const baseData = {
    title,
    slug: String(body.slug || slugify(title)),
    description: String(body.description || ""),
    order: Number(body.order || 0),
    status: String(body.status || "AVAILABLE") as Status,
    isPublished: Boolean(body.isPublished)
  };
  const classData = baseData;
  const activityData = {
    ...baseData,
    instruction: String(body.instruction || ""),
    text: String(body.text || ""),
    publishDate: body.publishDate ? new Date(String(body.publishDate)) : null
  };
  const resourceData = {
    ...baseData,
    type: String(body.type || "DOCUMENT") as ResourceType,
    url: String(body.url || ""),
    filename: body.filename ? String(body.filename) : null,
    activityId: nullable(body.activityId),
    classId: nullable(body.classId),
    sequenceId: nullable(body.sequenceId),
    sessionId: nullable(body.sessionId)
  };
  return { baseData, classData, activityData, resourceData };
}

function nullable(value: unknown) {
  return value ? String(value) : null;
}

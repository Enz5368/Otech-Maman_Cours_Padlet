import { notFound } from "next/navigation";
import { prisma } from "./prisma";

export async function getHomeData() {
  const [classes, news, resources] = await Promise.all([
    prisma.class.findMany({
      where: { isPublished: true },
      orderBy: { order: "asc" },
      include: { sequences: { where: { isPublished: true }, orderBy: { order: "asc" } } }
    }),
    prisma.news.findMany({ where: { isPublished: true }, orderBy: [{ order: "asc" }, { createdAt: "desc" }], take: 4 }),
    prisma.resource.findMany({ where: { isPublished: true }, orderBy: [{ order: "asc" }, { createdAt: "desc" }], take: 8 })
  ]);
  return { classes, news, resources };
}

export async function getClass(slug: string) {
  const classe = await prisma.class.findFirst({
    where: { slug, isPublished: true },
    include: {
      sequences: {
        where: { isPublished: true },
        orderBy: { order: "asc" },
        include: {
          sessions: { where: { isPublished: true }, orderBy: { order: "asc" } },
          resources: { where: { isPublished: true }, orderBy: { order: "asc" } }
        }
      },
      resources: { where: { isPublished: true }, orderBy: { order: "asc" } }
    }
  });
  if (!classe) notFound();
  return classe;
}

export async function getSequence(classSlug: string, sequenceSlug: string) {
  const sequence = await prisma.sequence.findFirst({
    where: { slug: sequenceSlug, isPublished: true, class: { slug: classSlug, isPublished: true } },
    include: {
      class: true,
      sessions: {
        where: { isPublished: true },
        orderBy: { order: "asc" },
        include: { activities: { where: { isPublished: true }, orderBy: { order: "asc" } } }
      },
      resources: { where: { isPublished: true }, orderBy: { order: "asc" } }
    }
  });
  if (!sequence) notFound();
  return sequence;
}

export async function getSession(classSlug: string, sequenceSlug: string, sessionSlug: string) {
  const session = await prisma.session.findFirst({
    where: {
      slug: sessionSlug,
      isPublished: true,
      sequence: { slug: sequenceSlug, isPublished: true, class: { slug: classSlug, isPublished: true } }
    },
    include: {
      sequence: { include: { class: true } },
      activities: { where: { isPublished: true }, orderBy: { order: "asc" }, include: { resources: true } },
      resources: { where: { isPublished: true }, orderBy: { order: "asc" } }
    }
  });
  if (!session) notFound();
  return session;
}

export async function getActivity(classSlug: string, sequenceSlug: string, sessionSlug: string, activitySlug: string) {
  const activity = await prisma.activity.findFirst({
    where: {
      slug: activitySlug,
      isPublished: true,
      session: {
        slug: sessionSlug,
        isPublished: true,
        sequence: { slug: sequenceSlug, isPublished: true, class: { slug: classSlug, isPublished: true } }
      }
    },
    include: {
      session: { include: { sequence: { include: { class: true } } } },
      resources: { where: { isPublished: true }, orderBy: { order: "asc" } }
    }
  });
  if (!activity) notFound();
  return activity;
}

export async function getDepot() {
  return prisma.resource.findMany({ where: { isPublished: true }, orderBy: [{ type: "asc" }, { order: "asc" }] });
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const Status = { AVAILABLE: "AVAILABLE", SOON: "SOON", UPCOMING: "UPCOMING" } as const;
const ResourceType = { AUDIO: "AUDIO", VIDEO: "VIDEO", IMAGE: "IMAGE", PDF: "PDF", DOCUMENT: "DOCUMENT", LINK: "LINK" } as const;

const classes = ["5eme", "4eme", "3eme", "2nde", "1ere-tle", "bts-mhr", "bts-tourisme"];
const labels = ["5eme", "4eme", "3eme", "2nde", "1ere/Tle", "BTS MHR", "BTS Tourisme"];
const sequenceTitles = [
  "Benvenuti in Italia !",
  "La mia famiglia",
  "La scuola",
  "Il tempo libero",
  "Viaggi e vacanze",
  "L'ambiente"
];

async function main() {
  await prisma.resource.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.session.deleteMany();
  await prisma.sequence.deleteMany();
  await prisma.news.deleteMany();
  await prisma.class.deleteMany();

  await prisma.news.createMany({
    data: [
      {
        title: "Bienvenue sur le depot du cours d'italien",
        slug: "bienvenue",
        description: "Les supports, consignes et ressources multimedia seront publies ici au fil des sequences.",
        order: 1,
        status: Status.AVAILABLE
      },
      {
        title: "Audios d'entrainement disponibles",
        slug: "audios-entrainement",
        description: "Des fichiers audio courts permettent de travailler l'ecoute et la prononciation a la maison.",
        order: 2,
        status: Status.AVAILABLE
      },
      {
        title: "Prochaine publication",
        slug: "prochaine-publication",
        description: "Une nouvelle affiche culturelle sur les regions italiennes arrive prochainement.",
        order: 3,
        status: Status.SOON
      }
    ]
  });

  for (const [index, slug] of classes.entries()) {
    const classe = await prisma.class.create({
      data: {
        title: `Classe de ${labels[index]}`,
        slug,
        description: `Espace de travail pour les eleves de ${labels[index]} : sequences, activites, documents et ressources multimedia.`,
        order: index + 1,
        status: Status.AVAILABLE
      }
    });

    for (const [seqIndex, title] of sequenceTitles.entries()) {
      const seqSlug = `sequence-${seqIndex + 1}-${title
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")}`;
      const sequence = await prisma.sequence.create({
        data: {
          title: `Sequence ${seqIndex + 1} : ${title}`,
          slug: seqSlug,
          description: `Objectifs linguistiques et culturels autour de "${title}".`,
          order: seqIndex + 1,
          status: seqIndex < 3 ? Status.AVAILABLE : Status.SOON,
          classId: classe.id
        }
      });

      for (let sessionIndex = 1; sessionIndex <= 2; sessionIndex++) {
        const session = await prisma.session.create({
          data: {
            title: `Seance ${sessionIndex}`,
            slug: `seance-${sessionIndex}`,
            description: `Activites guidees pour progresser dans la sequence ${seqIndex + 1}.`,
              order: sessionIndex,
              status: seqIndex < 3 ? Status.AVAILABLE : Status.UPCOMING,
              sequenceId: sequence.id
            }
          });

        for (let activityIndex = 1; activityIndex <= 2; activityIndex++) {
          const activity = await prisma.activity.create({
            data: {
              title: `Activite ${activityIndex} - Comprendre et s'exprimer`,
              slug: `activite-${activityIndex}`,
              description: "Une activite courte avec consigne, support et trace ecrite.",
              instruction: "Lis la consigne, observe le document puis prepare une reponse en italien.",
              text: "Questa attivita permette di ripassare il lessico, lavorare la pronuncia e preparare une courte production.",
              order: activityIndex,
              status: seqIndex < 3 ? Status.AVAILABLE : Status.UPCOMING,
              publishDate: new Date(),
              sessionId: session.id
            }
          });

          await prisma.resource.create({
            data: {
              title: "Fiche d'activite",
              slug: `fiche-${slug}-${seqIndex + 1}-${sessionIndex}-${activityIndex}`,
              description: "Document de travail a telecharger.",
              order: 1,
              status: Status.AVAILABLE,
              type: ResourceType.PDF,
              url: "/uploads/exemple-fiche.pdf",
              filename: "exemple-fiche.pdf",
              activityId: activity.id
            }
          });
        }
      }
    }

    await prisma.resource.createMany({
      data: [
        {
          title: `Audio de bienvenue - ${labels[index]}`,
          slug: `audio-bienvenue-${slug}`,
          description: "Court audio d'introduction a ecouter en autonomie.",
          order: 1,
          status: Status.AVAILABLE,
          type: ResourceType.AUDIO,
          url: "/uploads/exemple-audio.mp3",
          filename: "exemple-audio.mp3",
          classId: classe.id
        },
        {
          title: `Lien culturel - ${labels[index]}`,
          slug: `lien-culturel-${slug}`,
          description: "Ressource externe pour decouvrir l'Italie.",
          order: 2,
          status: Status.AVAILABLE,
          type: ResourceType.LINK,
          url: "https://www.italia.it/fr",
          filename: null,
          classId: classe.id
        }
      ]
    });
  }

  await prisma.resource.createMany({
    data: [
      {
        title: "Affiche - Regioni italiane",
        slug: "affiche-regioni-italiane",
        description: "Affiche de synthese pour memoriser les regions.",
        order: 1,
        status: Status.SOON,
        type: ResourceType.IMAGE,
        url: "/uploads/exemple-affiche.jpg",
        filename: "exemple-affiche.jpg"
      },
      {
        title: "Video - Saluti e presentazioni",
        slug: "video-saluti-presentazioni",
        description: "Support video pour revoir les salutations.",
        order: 2,
        status: Status.AVAILABLE,
        type: ResourceType.VIDEO,
        url: "/uploads/exemple-video.mp4",
        filename: "exemple-video.mp4"
      }
    ]
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

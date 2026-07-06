import Link from "next/link";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { prisma } from "@/lib/prisma";

export default async function ClassesPage() {
  const classes = await prisma.class.findMany({
    where: { isPublished: true },
    orderBy: { order: "asc" },
    include: { sequences: { where: { isPublished: true } } }
  });

  return (
    <>
      <Header />
      <main className="container-pad py-10">
        <h1 className="text-3xl font-bold text-wine-900">Liste des classes</h1>
        <p className="mt-2 max-w-2xl text-ink/65">Choisissez votre niveau pour retrouver les sequences, activites et ressources publiees.</p>
        <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((classe) => (
            <Link key={classe.id} href={`/classes/${classe.slug}`}>
              <Card className="h-full transition hover:-translate-y-0.5 hover:bg-white">
                <h2 className="text-xl font-bold text-wine-900">{classe.title}</h2>
                <p className="mt-3 text-sm leading-6 text-ink/65">{classe.description}</p>
                <p className="mt-4 text-sm font-semibold text-wine-700">{classe.sequences.length} sequences</p>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}

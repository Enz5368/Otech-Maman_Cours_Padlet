import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { ResourceList } from "@/components/ResourceList";
import { getDepot } from "@/lib/data";
import { resourceTypeLabels } from "@/lib/format";

export default async function DepotPage() {
  const resources = await getDepot();
  const groups = ["AUDIO", "VIDEO", "IMAGE", "PDF", "DOCUMENT", "LINK"] as const;

  return (
    <>
      <Header />
      <main className="container-pad py-10">
        <h1 className="text-3xl font-bold text-wine-900">Depot</h1>
        <p className="mt-2 max-w-2xl text-ink/65">Audios, videos, affiches, documents et liens publies pour les cours.</p>
        <div className="mt-7 space-y-6">
          {groups.map((type) => {
            const items = resources.filter((resource) => resource.type === type);
            return (
              <Card key={type}>
                <h2 className="mb-4 text-xl font-bold text-wine-900">{resourceTypeLabels[type]}s</h2>
                <ResourceList resources={items} />
              </Card>
            );
          })}
        </div>
      </main>
    </>
  );
}

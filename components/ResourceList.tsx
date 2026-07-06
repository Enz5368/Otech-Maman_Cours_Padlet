import type { Resource } from "@prisma/client";
import { Download, ExternalLink } from "lucide-react";
import { resourceIcons, resourceTypeLabels, statusLabels, statusTone } from "@/lib/format";
import { Badge, Card } from "./Card";

export function ResourceList({ resources }: { resources: Resource[] }) {
  if (resources.length === 0) {
    return <p className="rounded-lg border border-dashed border-wine-100 p-5 text-sm text-ink/60">Aucune ressource publiee pour le moment.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {resources.map((resource) => {
        const Icon = resourceIcons[resource.type];
        const isMedia = resource.type === "AUDIO" || resource.type === "VIDEO" || resource.type === "IMAGE";
        return (
          <Card key={resource.id} className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-paper text-wine-700">
                <Icon size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-wine-900">{resource.title}</h3>
                  <Badge tone={statusTone[resource.status]}>{statusLabels[resource.status]}</Badge>
                </div>
                <p className="mt-1 text-sm text-ink/65">{resource.description}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink/45">{resourceTypeLabels[resource.type]}</p>
              </div>
            </div>
            {resource.type === "AUDIO" && <audio className="w-full" controls src={resource.url} />}
            {resource.type === "VIDEO" && <video className="aspect-video w-full rounded-lg bg-ink" controls src={resource.url} />}
            {resource.type === "IMAGE" && <img className="max-h-72 w-full rounded-lg object-cover" src={resource.url} alt={resource.title} />}
            <a
              className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-wine-700 px-4 py-2 text-sm font-semibold text-white"
              href={resource.url}
              target={resource.type === "LINK" ? "_blank" : undefined}
              rel={resource.type === "LINK" ? "noreferrer" : undefined}
              download={!isMedia && resource.type !== "LINK" ? resource.filename || true : undefined}
            >
              {resource.type === "LINK" ? <ExternalLink size={16} /> : <Download size={16} />}
              {resource.type === "LINK" ? "Ouvrir le lien" : "Consulter / telecharger"}
            </a>
          </Card>
        );
      })}
    </div>
  );
}

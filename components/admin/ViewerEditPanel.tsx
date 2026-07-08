"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Link as LinkIcon, Pencil, Plus, UploadCloud, X } from "lucide-react";
import { resourceTypeLabels, slugify } from "@/lib/format";

type ResourceType = "AUDIO" | "VIDEO" | "IMAGE" | "PDF" | "DOCUMENT" | "LINK";
type ParentIds = {
  classId?: string;
  sequenceId?: string;
  sessionId?: string;
  activityId?: string;
};
type ActivityDraft = {
  id: string;
  title: string;
  slug: string;
  description: string;
  instruction: string;
  text: string;
  order: number;
  status: string;
  isPublished: boolean;
  publishDate?: Date | string | null;
  sessionId: string;
};

export function ViewerEditPanel({
  parentIds,
  canAddActivity,
  activity
}: {
  parentIds: ParentIds;
  canAddActivity?: boolean;
  activity?: ActivityDraft;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"resource" | "activity" | "editActivity">("resource");
  const [message, setMessage] = useState("");
  const [fileLabel, setFileLabel] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceFilename, setResourceFilename] = useState("");

  const title = useMemo(() => {
    if (mode === "activity") return "Ajouter une activite texte";
    if (mode === "editActivity") return "Modifier cette activite";
    return "Ajouter une ressource";
  }, [mode]);

  function show(nextMode: "resource" | "activity" | "editActivity") {
    setMode(nextMode);
    setOpen(true);
    setMessage("");
  }

  async function upload(file: File) {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/upload", { method: "POST", body: form });
    const result = await response.json();
    if (response.ok) {
      setResourceUrl(result.url);
      setResourceFilename(result.filename);
      setFileLabel(file.name);
      setMessage("Fichier ajoute. Completez le titre puis enregistrez.");
    } else {
      setMessage(result.error || "Upload impossible.");
    }
  }

  async function submitResource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "Nouvelle ressource");
    const body = {
      entity: "resource",
      title,
      slug: slugify(title),
      description: String(form.get("description") || ""),
      order: Number(form.get("order") || 0),
      status: String(form.get("status") || "AVAILABLE"),
      isPublished: form.get("isPublished") === "on",
      type: String(form.get("type") || "DOCUMENT"),
      url: String(form.get("url") || resourceUrl),
      filename: resourceFilename || String(form.get("filename") || ""),
      ...parentIds
    };
    await save(body);
  }

  async function submitActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "Nouvelle activite");
    const body = {
      entity: "activity",
      id: activity?.id || "",
      title,
      slug: String(form.get("slug") || slugify(title)),
      description: String(form.get("description") || ""),
      instruction: String(form.get("instruction") || ""),
      text: String(form.get("text") || ""),
      order: Number(form.get("order") || 0),
      status: String(form.get("status") || "AVAILABLE"),
      isPublished: form.get("isPublished") === "on",
      publishDate: String(form.get("publishDate") || ""),
      sessionId: activity?.sessionId || parentIds.sessionId
    };
    await save(body, activity?.id ? "PUT" : "POST");
  }

  async function save(body: Record<string, unknown>, method = "POST") {
    const response = await fetch("/api/admin/content", {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = await response.json();
    if (response.ok) {
      setOpen(false);
      setMessage("");
      setFileLabel("");
      setResourceUrl("");
      setResourceFilename("");
      router.refresh();
    } else {
      setMessage(result.error || "Enregistrement impossible.");
    }
  }

  return (
    <>
      <div className="fixed bottom-5 right-5 z-30 flex max-w-[calc(100vw-40px)] flex-wrap items-center gap-2 rounded-lg border border-wine-100 bg-white p-2 shadow-soft">
        <button onClick={() => show("resource")} className="inline-flex items-center gap-2 rounded-lg bg-wine-700 px-4 py-2 text-sm font-semibold text-white">
          <UploadCloud size={16} /> Ressource
        </button>
        {canAddActivity && (
          <button onClick={() => show("activity")} className="inline-flex items-center gap-2 rounded-lg bg-paper px-4 py-2 text-sm font-semibold text-wine-700">
            <Plus size={16} /> Activite
          </button>
        )}
        {activity && (
          <button onClick={() => show("editActivity")} className="inline-flex items-center gap-2 rounded-lg bg-paper px-4 py-2 text-sm font-semibold text-wine-700">
            <Pencil size={16} /> Modifier le texte
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm">
          <div className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-wine-100 bg-paper px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase text-wine-700">Edition</p>
                <h2 className="text-2xl font-bold text-wine-900">{title}</h2>
                <p className="mt-1 text-sm text-ink/60">Vous restez sur la page publique, l'ajout est rattache ici.</p>
              </div>
              <button onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-lg bg-white text-wine-700">
                <X size={18} />
              </button>
            </div>

            {mode === "resource" ? (
              <form onSubmit={submitResource} className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-4 overflow-auto p-5">
                  <Input name="title" label="Titre" required />
                  <Textarea name="description" label="Description / consigne courte" />
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Select name="type" label="Type" options={resourceTypeLabels} />
                    <Select name="status" label="Statut" options={{ AVAILABLE: "Disponible", SOON: "Bientot disponible", UPCOMING: "A venir" }} />
                    <Input name="order" label="Ordre" type="number" defaultValue="0" />
                  </div>
                  <label className="flex items-center gap-2 rounded-lg border border-wine-100 px-3 py-2 text-sm font-semibold text-ink/70">
                    <input name="isPublished" type="checkbox" defaultChecked /> Visible
                  </label>
                  <Input name="url" label="Lien externe ou URL du fichier" value={resourceUrl} onChange={setResourceUrl} />
                  <input type="hidden" name="filename" value={resourceFilename} />
                  <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-wine-100 bg-paper/45 px-4 py-5 text-center text-sm font-semibold text-ink/65">
                    <UploadCloud className="mb-2 text-wine-700" />
                    {fileLabel || "Ajouter un fichier audio, video, image, PDF ou document"}
                    <input type="file" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(file); }} />
                  </label>
                  {resourceUrl && <Preview url={resourceUrl} />}
                  {message && <p className="rounded-lg bg-paper p-3 text-sm font-semibold text-wine-700">{message}</p>}
                </div>
                <Footer onCancel={() => setOpen(false)} />
              </form>
            ) : (
              <form onSubmit={submitActivity} className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-4 overflow-auto p-5">
                  <Input name="title" label="Titre" defaultValue={activity?.title || ""} required />
                  <Input name="slug" label="Slug" defaultValue={activity?.slug || ""} />
                  <Textarea name="description" label="Description" defaultValue={activity?.description || ""} />
                  <Textarea name="instruction" label="Consigne" defaultValue={activity?.instruction || ""} />
                  <Textarea name="text" label="Texte / contenu de l'activite" defaultValue={activity?.text || ""} tall />
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Input name="order" label="Ordre" type="number" defaultValue={String(activity?.order || 0)} />
                    <Select name="status" label="Statut" defaultValue={activity?.status || "AVAILABLE"} options={{ AVAILABLE: "Disponible", SOON: "Bientot disponible", UPCOMING: "A venir" }} />
                    <Input name="publishDate" label="Publication" type="date" defaultValue={String(activity?.publishDate || "").slice(0, 10)} />
                  </div>
                  <label className="flex items-center gap-2 rounded-lg border border-wine-100 px-3 py-2 text-sm font-semibold text-ink/70">
                    <input name="isPublished" type="checkbox" defaultChecked={activity?.isPublished !== false} /> Visible
                  </label>
                  {message && <p className="rounded-lg bg-paper p-3 text-sm font-semibold text-wine-700">{message}</p>}
                </div>
                <Footer onCancel={() => setOpen(false)} />
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Footer({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-wine-100 bg-white px-5 py-4">
      <button type="button" onClick={onCancel} className="rounded-lg border border-wine-100 px-4 py-3 text-sm font-semibold text-wine-700">
        Annuler
      </button>
      <button className="rounded-lg bg-wine-700 px-5 py-3 font-semibold text-white">Enregistrer</button>
    </div>
  );
}

function Input({
  name,
  label,
  type = "text",
  defaultValue = "",
  value,
  required,
  onChange
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  value?: string;
  required?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold text-ink/70">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={value === undefined ? defaultValue : undefined}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className="mt-1 w-full rounded-lg border border-wine-100 bg-white px-3 py-2 focus-ring"
      />
    </label>
  );
}

function Textarea({ name, label, defaultValue = "", tall }: { name: string; label: string; defaultValue?: string; tall?: boolean }) {
  return (
    <label className="block text-sm font-semibold text-ink/70">
      {label}
      <textarea name={name} defaultValue={defaultValue} className={`mt-1 w-full rounded-lg border border-wine-100 bg-white px-3 py-2 focus-ring ${tall ? "min-h-44" : "min-h-24"}`} />
    </label>
  );
}

function Select({ name, label, options, defaultValue }: { name: string; label: string; options: Record<string, string>; defaultValue?: string }) {
  return (
    <label className="block text-sm font-semibold text-ink/70">
      {label}
      <select name={name} defaultValue={defaultValue} className="mt-1 w-full rounded-lg border border-wine-100 bg-white px-3 py-2 focus-ring">
        {Object.entries(options).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Preview({ url }: { url: string }) {
  if (/\.(mp3|wav)$/i.test(url)) return <audio controls className="w-full" src={url} />;
  if (/\.(mp4)$/i.test(url)) return <video controls className="aspect-video w-full rounded-lg bg-ink" src={url} />;
  if (/\.(jpg|jpeg|png|webp)$/i.test(url)) return <img className="max-h-56 w-full rounded-lg object-cover" src={url} alt="Preview" />;
  return (
    <a href={url} target="_blank" className="inline-flex items-center gap-2 text-sm font-semibold text-wine-700">
      {/\.(pdf|doc|docx)$/i.test(url) ? <FileText size={16} /> : <LinkIcon size={16} />} Ouvrir l'apercu
    </a>
  );
}

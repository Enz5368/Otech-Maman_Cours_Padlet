"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, UploadCloud } from "lucide-react";
import { resourceTypeLabels, slugify } from "@/lib/format";

type Entity = "class" | "sequence" | "session" | "activity" | "resource" | "news";

export function AdminEntityForm({
  entity,
  item,
  parent,
  submitLabel = "Enregistrer"
}: {
  entity: Entity;
  item?: Record<string, unknown>;
  parent?: Record<string, string>;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [resourceUrl, setResourceUrl] = useState(String(item?.url || ""));
  const [resourceFilename, setResourceFilename] = useState(String(item?.filename || ""));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "Sans titre");
    const body: Record<string, unknown> = {
      entity,
      id: item?.id || "",
      title,
      slug: String(form.get("slug") || slugify(title)),
      description: String(form.get("description") || ""),
      order: Number(form.get("order") || 0),
      status: String(form.get("status") || "AVAILABLE"),
      isPublished: form.get("isPublished") === "on",
      ...parent
    };

    if (entity === "activity") {
      body.instruction = String(form.get("instruction") || "");
      body.text = String(form.get("text") || "");
      body.publishDate = String(form.get("publishDate") || "");
    }

    if (entity === "resource") {
      body.type = String(form.get("type") || "DOCUMENT");
      body.url = String(form.get("url") || resourceUrl);
      body.filename = String(form.get("filename") || resourceFilename);
    }

    const response = await fetch("/api/admin/content", {
      method: item?.id ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    if (response.ok) {
      setMessage("Enregistre.");
      router.refresh();
      if (!item?.id) event.currentTarget.reset();
      if (!item?.id && entity === "resource") {
        setResourceUrl("");
        setResourceFilename("");
      }
    } else {
      const result = await response.json();
      setMessage(result.error || "Erreur d'enregistrement.");
    }
  }

  async function upload(file: File) {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/upload", { method: "POST", body: form });
    const result = await response.json();
    if (response.ok) {
      setResourceUrl(result.url);
      setResourceFilename(result.filename);
      setMessage("Fichier ajoute. Verifiez le titre puis enregistrez.");
    } else {
      setMessage(result.error || "Upload impossible.");
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-wine-100 bg-white p-4 shadow-soft">
      <h2 className="text-lg font-bold text-wine-900">{item?.id ? "Modifier les informations" : submitLabel}</h2>
      <div className="mt-4 space-y-4">
        <Input name="title" label="Titre" defaultValue={String(item?.title || "")} required />
        <Input name="slug" label="Slug" defaultValue={String(item?.slug || "")} />
        <Textarea name="description" label="Description" defaultValue={String(item?.description || "")} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Input name="order" label="Ordre" type="number" defaultValue={String(item?.order || 0)} />
          <Select name="status" label="Statut" defaultValue={String(item?.status || "AVAILABLE")} options={{ AVAILABLE: "Disponible", SOON: "Bientot disponible", UPCOMING: "A venir" }} />
          <label className="flex items-center gap-2 self-end rounded-lg border border-wine-100 px-3 py-2 text-sm font-semibold text-ink/70">
            <input name="isPublished" type="checkbox" defaultChecked={item?.isPublished !== false} /> Visible
          </label>
        </div>

        {entity === "activity" && (
          <>
            <Textarea name="instruction" label="Consigne" defaultValue={String(item?.instruction || "")} />
            <Textarea name="text" label="Texte" defaultValue={String(item?.text || "")} tall />
            <Input name="publishDate" label="Date de publication" type="date" defaultValue={String(item?.publishDate || "").slice(0, 10)} />
          </>
        )}

        {entity === "resource" && (
          <>
            <Select name="type" label="Type" defaultValue={String(item?.type || "DOCUMENT")} options={resourceTypeLabels} />
            <Input name="url" label="URL / fichier" value={resourceUrl} onChange={setResourceUrl} required />
            <Input name="filename" label="Nom de fichier" value={resourceFilename} onChange={setResourceFilename} />
            <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-wine-100 bg-paper/45 px-4 py-5 text-center text-sm font-semibold text-ink/65">
              <UploadCloud className="mb-2 text-wine-700" />
              Choisir un audio, une video, une image, un PDF ou un document
              <input type="file" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(file); }} />
            </label>
          </>
        )}

        {message && <p className="rounded-lg bg-paper p-3 text-sm font-semibold text-wine-700">{message}</p>}
        <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-wine-700 px-4 py-3 font-semibold text-white">
          <Save size={17} /> Enregistrer
        </button>
      </div>
    </form>
  );
}

function Input({
  name,
  label,
  defaultValue = "",
  value,
  onChange,
  type = "text",
  required
}: {
  name: string;
  label: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-semibold text-ink/70">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value === undefined ? defaultValue : undefined}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        required={required}
        className="mt-1 w-full rounded-lg border border-wine-100 bg-white px-3 py-2 focus-ring"
      />
    </label>
  );
}

function Textarea({ name, label, defaultValue = "", tall }: { name: string; label: string; defaultValue?: string; tall?: boolean }) {
  return (
    <label className="block text-sm font-semibold text-ink/70">
      {label}
      <textarea name={name} defaultValue={defaultValue} className={`mt-1 w-full rounded-lg border border-wine-100 bg-white px-3 py-2 focus-ring ${tall ? "min-h-40" : "min-h-24"}`} />
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

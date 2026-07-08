"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sortable from "sortablejs";
import {
  CheckCircle2,
  FilePlus2,
  GripVertical,
  LayoutDashboard,
  Link as LinkIcon,
  LogOut,
  Newspaper,
  Pencil,
  Plus,
  Save,
  Settings,
  Trash2,
  UploadCloud,
  X
} from "lucide-react";
import { resourceTypeLabels, slugify, statusLabels } from "@/lib/format";

type Status = "AVAILABLE" | "SOON" | "UPCOMING";
type ResourceType = "AUDIO" | "VIDEO" | "IMAGE" | "PDF" | "DOCUMENT" | "LINK";
type BaseItem = { id: string; title: string; slug: string; description: string; order: number; status: Status; isPublished: boolean };
type Resource = BaseItem & { type: ResourceType; url: string; filename: string | null; activityId?: string | null; classId?: string | null; sequenceId?: string | null; sessionId?: string | null };
type Activity = BaseItem & { instruction: string; text: string; publishDate: string | null; resources: Resource[]; sessionId: string };
type Session = BaseItem & { activities: Activity[]; resources: Resource[]; sequenceId: string };
type Sequence = BaseItem & { sessions: Session[]; resources: Resource[]; classId: string };
type Classe = BaseItem & { sequences: Sequence[]; resources: Resource[] };
type News = BaseItem;
type Data = { classes: Classe[]; news: News[]; resources: Resource[] };
type Entity = "class" | "sequence" | "session" | "activity" | "resource" | "news";
type Section = "classes" | "news" | "depot" | "settings";
type Flat = { classes: Classe[]; sequences: Sequence[]; sessions: Session[]; activities: Activity[] };

const empty: BaseItem = { id: "", title: "", slug: "", description: "", order: 0, status: "AVAILABLE", isPublished: true };

const entityLabels: Record<Entity, string> = {
  class: "classe",
  sequence: "sequence",
  session: "seance",
  activity: "activite",
  resource: "ressource",
  news: "actualite"
};

export function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [section, setSection] = useState<Section>("classes");
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [entity, setEntity] = useState<Entity>("class");
  const [selectedId, setSelectedId] = useState("");
  const [message, setMessage] = useState("");
  const [dropActive, setDropActive] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!listRef.current || section === "settings") return;
    const sortable = Sortable.create(listRef.current, {
      handle: ".drag-handle",
      animation: 150,
      ghostClass: "opacity-40",
      onEnd: async () => {
        const ids = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-id]") || []).map((node) => node.dataset.id || "");
        await fetch("/api/admin/reorder", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ entity: section === "news" ? "news" : section === "depot" ? "resource" : "class", ids })
        });
        await refresh();
        setMessage("Nouvel ordre enregistre.");
      }
    });
    return () => sortable.destroy();
  }, [section, data]);

  async function refresh() {
    const response = await fetch("/api/admin/content");
    if (response.status === 401) {
      window.location.href = "/admin";
      return;
    }
    setData(await response.json());
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin";
  }

  const flat: Flat = useMemo(() => {
    const classes = data?.classes || [];
    const sequences = classes.flatMap((classe) => classe.sequences.map((sequence) => ({ ...sequence, classTitle: classe.title })));
    const sessions = sequences.flatMap((sequence) => sequence.sessions.map((session) => ({ ...session, sequenceTitle: sequence.title })));
    const activities = sessions.flatMap((session) => session.activities.map((activity) => ({ ...activity, sessionTitle: session.title })));
    return { classes, sequences, sessions, activities };
  }, [data]);

  const rows = section === "classes" ? flat.classes : section === "news" ? data?.news || [] : section === "depot" ? data?.resources || [] : [];

  function changeSection(next: Section) {
    setSection(next);
    setEditing(null);
    setSelectedId("");
  }

  function startCreate(nextEntity: Entity, parent?: Record<string, string>) {
    setEntity(nextEntity);
    setSelectedId("");
    setEditing({ ...empty, ...parent, entity: nextEntity, type: "DOCUMENT", url: "", filename: "", instruction: "", text: "" });
    setMessage(`Creation d'une ${entityLabels[nextEntity]} ouverte.`);
  }

  function startEdit(nextEntity: Entity, item: Record<string, unknown>) {
    if (nextEntity === "class") {
      router.push(`/admin/classes/${String(item.id)}`);
      return;
    }
    if (nextEntity === "sequence") {
      router.push(`/admin/sequences/${String(item.id)}`);
      return;
    }
    if (nextEntity === "session") {
      router.push(`/admin/sessions/${String(item.id)}`);
      return;
    }
    if (nextEntity === "activity") {
      router.push(`/admin/activities/${String(item.id)}`);
      return;
    }
    setEntity(nextEntity);
    setSelectedId(String(item.id || ""));
    setEditing({ ...item, entity: nextEntity });
    setMessage(`${String(item.title || "Element")} est pret a etre modifie.`);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = { entity, id: editing.id };
    form.forEach((value, key) => {
      body[key] = value;
    });
    body.isPublished = form.get("isPublished") === "on";
    body.slug = String(body.slug || slugify(String(body.title || "")));

    const method = editing.id ? "PUT" : "POST";
    const response = await fetch("/api/admin/content", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (response.ok) {
      setData(await response.json());
      setSelectedId(String(editing.id || ""));
      setEditing(null);
      setMessage("Enregistre. Le panneau d'edition est ferme.");
    } else {
      const result = await response.json();
      setMessage(result.error || "Enregistrement impossible.");
    }
  }

  async function remove(nextEntity: Entity, id: string) {
    if (!confirm("Supprimer cet element et ses contenus rattaches ?")) return;
    const response = await fetch("/api/admin/content", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ entity: nextEntity, id }) });
    if (response.ok) {
      setData(await response.json());
      if (selectedId === id) {
        setSelectedId("");
        setEditing(null);
      }
      setMessage("Element supprime.");
    }
  }

  async function upload(file: File) {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/upload", { method: "POST", body: form });
    const result = await response.json();
    if (response.ok) {
      setEditing((current) => ({ ...(current || {}), url: result.url, filename: result.filename }));
      setMessage("Fichier ajoute. Enregistrez la ressource pour publier.");
    } else {
      setMessage(result.error || "Upload impossible.");
    }
  }

  if (!data) return <main className="grid min-h-screen place-items-center bg-paper text-wine-900">Chargement du dashboard...</main>;

  return (
    <main className="min-h-screen bg-paper">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-wine-100 bg-wine-900 p-4 text-white lg:block">
        <div className="mb-8 flex items-center gap-3 px-2">
          <LayoutDashboard />
          <div>
            <h1 className="font-bold">Editeur</h1>
            <p className="text-xs text-white/65">In viaggio per l'Italia</p>
          </div>
        </div>
        <NavButton active={section === "classes"} onClick={() => changeSection("classes")} icon={<FilePlus2 size={18} />} label="Classes" />
        <NavButton active={section === "news"} onClick={() => changeSection("news")} icon={<Newspaper size={18} />} label="Actualites" />
        <NavButton active={section === "depot"} onClick={() => changeSection("depot")} icon={<UploadCloud size={18} />} label="Depot" />
        <NavButton active={section === "settings"} onClick={() => changeSection("settings")} icon={<Settings size={18} />} label="Reglages" />
        <button onClick={logout} className="absolute bottom-4 left-4 right-4 flex items-center gap-2 rounded-lg bg-white/10 px-4 py-3 text-sm font-semibold">
          <LogOut size={18} /> Deconnexion
        </button>
      </aside>

      <section className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-wine-100 bg-paper/95 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <h2 className="text-2xl font-bold text-wine-900">{sectionTitle(section)}</h2>
              <p className="text-sm text-ink/60">{sectionHelp(section)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {section === "classes" && <ActionButton onClick={() => startCreate("class")} label="Nouvelle classe" />}
              {section === "news" && <ActionButton onClick={() => startCreate("news")} label="Nouvelle actualite" />}
              {section === "depot" && <ActionButton onClick={() => startCreate("resource")} label="Nouvelle ressource" />}
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto px-5 pb-4 lg:hidden">
            <MobileTab active={section === "classes"} onClick={() => changeSection("classes")} label="Classes" />
            <MobileTab active={section === "news"} onClick={() => changeSection("news")} label="Actualites" />
            <MobileTab active={section === "depot"} onClick={() => changeSection("depot")} label="Depot" />
            <MobileTab active={section === "settings"} onClick={() => changeSection("settings")} label="Reglages" />
          </div>
        </header>

        <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="rounded-lg border border-wine-100 bg-white p-4 shadow-soft">
            {message && (
              <p className="mb-4 flex items-center gap-2 rounded-lg bg-paper p-3 text-sm font-semibold text-wine-700">
                <CheckCircle2 size={17} /> {message}
              </p>
            )}
            {section === "settings" ? (
              <SettingsPanel />
            ) : rows.length === 0 ? (
              <EmptyState section={section} onCreate={() => startCreate(section === "news" ? "news" : section === "depot" ? "resource" : "class")} />
            ) : (
              <div ref={listRef} className="space-y-3">
                {rows.map((row) => (
                  <AdminRow
                    key={row.id}
                    item={row}
                    entity={section === "classes" ? "class" : section === "news" ? "news" : "resource"}
                    selected={selectedId === row.id}
                    onEdit={startEdit}
                    onDelete={remove}
                    extra={section === "depot" && "type" in row ? resourceTypeLabels[row.type as ResourceType] : undefined}
                  />
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-5">
            {section === "classes" && <HierarchyPanel flat={flat} selectedId={selectedId} onCreate={startCreate} onEdit={startEdit} onDelete={remove} />}
            {!editing && <HintPanel section={section} />}
          </aside>
        </div>
      </section>

      {editing && (
        <EditorPanel
          editing={editing}
          entity={entity}
          flat={flat}
          dropActive={dropActive}
          setDropActive={setDropActive}
          upload={upload}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </main>
  );
}

function ActionButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-2 rounded-lg bg-wine-700 px-4 py-2 text-sm font-semibold text-white shadow-soft">
      <Plus size={16} /> {label}
    </button>
  );
}

function MobileTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold ${active ? "bg-wine-700 text-white" : "bg-white text-wine-700"}`}>
      {label}
    </button>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`mb-2 flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold ${active ? "bg-white text-wine-900" : "text-white/75 hover:bg-white/10"}`}>
      {icon} {label}
    </button>
  );
}

function AdminRow({
  item,
  entity,
  extra,
  selected,
  onEdit,
  onDelete
}: {
  item: BaseItem;
  entity: Entity;
  extra?: string;
  selected: boolean;
  onEdit: (e: Entity, i: Record<string, unknown>) => void;
  onDelete: (e: Entity, id: string) => void;
}) {
  return (
    <article
      data-id={item.id}
      onClick={() => onEdit(entity, item as unknown as Record<string, unknown>)}
      className={`group grid cursor-pointer gap-3 rounded-lg border p-4 transition sm:grid-cols-[auto_1fr_auto] sm:items-center ${
        selected ? "border-wine-700 bg-wine-50 shadow-soft" : "border-wine-100 bg-paper/45 hover:border-wine-700/45 hover:bg-white"
      }`}
    >
      <GripVertical className="drag-handle cursor-grab text-ink/35" size={18} onClick={(event) => event.stopPropagation()} />
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-wine-900">{item.title}</h3>
          <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-wine-700">{statusLabels[item.status]}</span>
          {!item.isPublished && <span className="rounded-full bg-ink/10 px-2 py-1 text-xs font-semibold text-ink/60">Masque</span>}
          {extra && <span className="rounded-full bg-sea/10 px-2 py-1 text-xs font-semibold text-sea">{extra}</span>}
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-ink/62">{item.description || "Aucune description."}</p>
      </div>
      <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
        <button onClick={() => onEdit(entity, item as unknown as Record<string, unknown>)} className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-wine-700">
          <Pencil size={15} /> Modifier
        </button>
        <button onClick={() => onDelete(entity, item.id)} className="grid size-10 place-items-center rounded-lg bg-wine-50 text-wine-700" title="Supprimer">
          <Trash2 size={17} />
        </button>
      </div>
    </article>
  );
}

function HierarchyPanel({
  flat,
  selectedId,
  onCreate,
  onEdit,
  onDelete
}: {
  flat: Flat;
  selectedId: string;
  onCreate: (e: Entity, p?: Record<string, string>) => void;
  onEdit: (e: Entity, i: Record<string, unknown>) => void;
  onDelete: (e: Entity, id: string) => void;
}) {
  return (
    <section className="rounded-lg border border-wine-100 bg-white p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-bold text-wine-900">Parcours complet</h3>
        <span className="text-xs font-semibold text-ink/45">Cliquez pour modifier</span>
      </div>
      <div className="max-h-[calc(100vh-180px)] space-y-4 overflow-auto pr-1 text-sm">
        {flat.classes.map((classe) => (
          <TreeBlock key={classe.id} active={selectedId === classe.id}>
            <TreeLine title={classe.title} active={selectedId === classe.id} onEdit={() => onEdit("class", classe as unknown as Record<string, unknown>)} onCreate={() => onCreate("sequence", { classId: classe.id })} createTitle="Ajouter une sequence" />
            {classe.sequences.map((sequence) => (
              <div key={sequence.id} className="mt-3 border-l border-wine-100 pl-3">
                <TreeLine title={sequence.title} active={selectedId === sequence.id} onEdit={() => onEdit("sequence", sequence as unknown as Record<string, unknown>)} onCreate={() => onCreate("session", { sequenceId: sequence.id })} createTitle="Ajouter une seance" />
                {sequence.sessions.map((session) => (
                  <div key={session.id} className="mt-2 border-l border-wine-100 pl-3">
                    <TreeLine title={session.title} active={selectedId === session.id} onEdit={() => onEdit("session", session as unknown as Record<string, unknown>)} onCreate={() => onCreate("activity", { sessionId: session.id })} createTitle="Ajouter une activite" compact />
                    {session.activities.map((activity) => (
                      <div key={activity.id} className={`mt-2 flex items-center justify-between gap-2 rounded-md px-2 py-1.5 ${selectedId === activity.id ? "bg-wine-50 text-wine-900" : "text-ink/65 hover:bg-paper"}`}>
                        <button className="min-w-0 truncate text-left" onClick={() => onEdit("activity", activity as unknown as Record<string, unknown>)}>
                          {activity.title}
                        </button>
                        <button onClick={() => onDelete("activity", activity.id)} className="shrink-0 text-wine-700" title="Supprimer">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </TreeBlock>
        ))}
      </div>
    </section>
  );
}

function TreeBlock({ active, children }: { active: boolean; children: React.ReactNode }) {
  return <div className={`rounded-lg p-3 ${active ? "bg-wine-50 ring-1 ring-wine-100" : "bg-paper/60"}`}>{children}</div>;
}

function TreeLine({ title, active, compact, createTitle, onEdit, onCreate }: { title: string; active: boolean; compact?: boolean; createTitle: string; onEdit: () => void; onCreate: () => void }) {
  return (
    <div className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 ${active ? "bg-white text-wine-900 shadow-sm" : "hover:bg-white/75"}`}>
      <button onClick={onEdit} className={`min-w-0 truncate text-left ${compact ? "" : "font-semibold"} ${active ? "text-wine-900" : ""}`}>
        {title}
      </button>
      <button onClick={onCreate} className="grid size-7 shrink-0 place-items-center rounded-md bg-white text-wine-700" title={createTitle}>
        <Plus size={14} />
      </button>
    </div>
  );
}

function EditorPanel({
  editing,
  entity,
  flat,
  dropActive,
  setDropActive,
  upload,
  onClose,
  onSave
}: {
  editing: Record<string, unknown>;
  entity: Entity;
  flat: Flat;
  dropActive: boolean;
  setDropActive: (v: boolean) => void;
  upload: (file: File) => void;
  onClose: () => void;
  onSave: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const title = editing.id ? `Modifier la ${entityLabels[entity]}` : `Ajouter une ${entityLabels[entity]}`;

  return (
    <div className="fixed inset-0 z-40 bg-ink/25 backdrop-blur-sm">
      <div className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-white shadow-2xl">
        <div className="border-b border-wine-100 bg-paper px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase text-wine-700">{editing.id ? "Edition" : "Creation"}</p>
              <h3 className="text-2xl font-bold text-wine-900">{title}</h3>
              <p className="mt-1 text-sm text-ink/60">{String(editing.title || "Nouvel element")}</p>
            </div>
            <button onClick={onClose} className="grid size-10 place-items-center rounded-lg bg-white text-wine-700" title="Fermer">
              <X size={19} />
            </button>
          </div>
        </div>
        <form onSubmit={onSave} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-auto px-5 py-5">
            <FormFields editing={editing} entity={entity} flat={flat} dropActive={dropActive} setDropActive={setDropActive} upload={upload} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-wine-100 bg-white px-5 py-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-wine-100 bg-white px-4 py-3 text-sm font-semibold text-wine-700">
              Annuler
            </button>
            <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-wine-700 px-5 py-3 font-semibold text-white shadow-soft">
              <Save size={17} /> Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormFields({ editing, entity, flat, dropActive, setDropActive, upload }: { editing: Record<string, unknown>; entity: Entity; flat: Flat; dropActive: boolean; setDropActive: (v: boolean) => void; upload: (file: File) => void }) {
  return (
    <div className="space-y-5">
      <fieldset className="grid gap-4 rounded-lg border border-wine-100 bg-paper/45 p-4 sm:grid-cols-2">
        <legend className="px-2 text-sm font-bold text-wine-900">Informations principales</legend>
        <Field name="title" label="Titre" value={editing.title} />
        <Field name="slug" label="Slug" value={editing.slug} />
        <label className="block text-sm font-semibold text-ink/70 sm:col-span-2">
          Description
          <textarea name="description" defaultValue={String(editing.description || "")} className="mt-1 min-h-28 w-full rounded-lg border border-wine-100 bg-white px-3 py-2 focus-ring" />
        </label>
      </fieldset>

      <fieldset className="grid gap-4 rounded-lg border border-wine-100 bg-white p-4 sm:grid-cols-3">
        <legend className="px-2 text-sm font-bold text-wine-900">Publication</legend>
        <label className="block text-sm font-semibold text-ink/70">
          Ordre
          <input name="order" type="number" defaultValue={Number(editing.order || 0)} className="mt-1 w-full rounded-lg border border-wine-100 px-3 py-2 focus-ring" />
        </label>
        <label className="block text-sm font-semibold text-ink/70">
          Statut
          <select name="status" defaultValue={String(editing.status || "AVAILABLE")} className="mt-1 w-full rounded-lg border border-wine-100 px-3 py-2 focus-ring">
            <option value="AVAILABLE">Disponible</option>
            <option value="SOON">Bientot disponible</option>
            <option value="UPCOMING">A venir</option>
          </select>
        </label>
        <label className="flex items-center gap-2 self-end rounded-lg border border-wine-100 px-3 py-2 text-sm font-semibold text-ink/70">
          <input name="isPublished" type="checkbox" defaultChecked={editing.isPublished !== false} /> Visible
        </label>
      </fieldset>

      {entity === "sequence" && <Select name="classId" label="Classe parent" value={editing.classId} options={flat.classes} />}
      {entity === "session" && <Select name="sequenceId" label="Sequence parente" value={editing.sequenceId} options={flat.sequences} />}
      {entity === "activity" && (
        <fieldset className="space-y-4 rounded-lg border border-wine-100 bg-paper/45 p-4">
          <legend className="px-2 text-sm font-bold text-wine-900">Contenu de l'activite</legend>
          <Select name="sessionId" label="Seance parente" value={editing.sessionId} options={flat.sessions} />
          <Field name="instruction" label="Consigne" value={editing.instruction} />
          <label className="block text-sm font-semibold text-ink/70">
            Texte
            <textarea name="text" defaultValue={String(editing.text || "")} className="mt-1 min-h-36 w-full rounded-lg border border-wine-100 bg-white px-3 py-2 focus-ring" />
          </label>
          <Field name="publishDate" label="Date de publication" value={String(editing.publishDate || "").slice(0, 10)} type="date" />
        </fieldset>
      )}
      {entity === "resource" && (
        <fieldset className="space-y-4 rounded-lg border border-wine-100 bg-paper/45 p-4">
          <legend className="px-2 text-sm font-bold text-wine-900">Fichier ou lien</legend>
          <label className="block text-sm font-semibold text-ink/70">
            Type
            <select name="type" defaultValue={String(editing.type || "DOCUMENT")} className="mt-1 w-full rounded-lg border border-wine-100 bg-white px-3 py-2 focus-ring">
              {Object.entries(resourceTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Field name="url" label="URL ou fichier" value={editing.url} />
          <Field name="filename" label="Nom de fichier" value={editing.filename} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select name="classId" label="Classe" value={editing.classId} options={flat.classes} optional />
            <Select name="sequenceId" label="Sequence" value={editing.sequenceId} options={flat.sequences} optional />
            <Select name="sessionId" label="Seance" value={editing.sessionId} options={flat.sessions} optional />
            <Select name="activityId" label="Activite" value={editing.activityId} options={flat.activities} optional />
          </div>
          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDropActive(true);
            }}
            onDragLeave={() => setDropActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDropActive(false);
              const file = event.dataTransfer.files[0];
              if (file) upload(file);
            }}
            className={`flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-5 text-center text-sm font-semibold ${
              dropActive ? "border-wine-700 bg-wine-50 text-wine-700" : "border-wine-100 bg-white text-ink/60"
            }`}
          >
            <UploadCloud className="mb-2" />
            Glisser-deposer un fichier ou cliquer pour choisir
            <input type="file" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(file); }} />
          </label>
          {editing.url ? <Preview url={String(editing.url)} /> : null}
        </fieldset>
      )}
    </div>
  );
}

function Field({ name, label, value, type = "text" }: { name: string; label: string; value: unknown; type?: string }) {
  return (
    <label className="block text-sm font-semibold text-ink/70">
      {label}
      <input name={name} type={type} defaultValue={String(value || "")} className="mt-1 w-full rounded-lg border border-wine-100 bg-white px-3 py-2 focus-ring" />
    </label>
  );
}

function Select({ name, label, value, options, optional = false }: { name: string; label: string; value: unknown; options: BaseItem[]; optional?: boolean }) {
  return (
    <label className="block text-sm font-semibold text-ink/70">
      {label}
      <select name={name} defaultValue={String(value || "")} className="mt-1 w-full rounded-lg border border-wine-100 bg-white px-3 py-2 focus-ring">
        {optional && <option value="">Aucun rattachement</option>}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.title}
          </option>
        ))}
      </select>
    </label>
  );
}

function Preview({ url }: { url: string }) {
  if (/\.(mp3|wav)$/i.test(url)) return <audio controls className="w-full" src={url} />;
  if (/\.(mp4)$/i.test(url)) return <video controls className="aspect-video w-full rounded-lg bg-ink" src={url} />;
  if (/\.(jpg|jpeg|png|webp)$/i.test(url)) return <img className="max-h-52 w-full rounded-lg object-cover" src={url} alt="Preview" />;
  return (
    <a href={url} target="_blank" className="inline-flex items-center gap-2 text-sm font-semibold text-wine-700">
      <LinkIcon size={16} /> Ouvrir la ressource
    </a>
  );
}

function EmptyState({ section, onCreate }: { section: Section; onCreate: () => void }) {
  return (
    <div className="grid min-h-80 place-items-center rounded-lg border border-dashed border-wine-100 bg-paper/45 p-8 text-center">
      <div>
        <h3 className="text-xl font-bold text-wine-900">Aucun contenu ici</h3>
        <p className="mt-2 text-sm text-ink/60">{sectionHelp(section)}</p>
        <button onClick={onCreate} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-wine-700 px-4 py-3 font-semibold text-white">
          <Plus size={17} /> Ajouter
        </button>
      </div>
    </div>
  );
}

function HintPanel({ section }: { section: Section }) {
  if (section === "settings") return null;
  return (
    <section className="rounded-lg border border-wine-100 bg-white p-4 shadow-soft">
      <h3 className="font-bold text-wine-900">Edition rapide</h3>
      <p className="mt-2 text-sm leading-6 text-ink/65">
        Cliquez sur une ligne ou sur un element du parcours pour ouvrir le panneau de modification. Le bouton + dans l'arborescence ajoute directement un contenu au bon endroit.
      </p>
    </section>
  );
}

function SettingsPanel() {
  return (
    <div className="space-y-4 text-sm leading-6 text-ink/70">
      <p>
        Le mot de passe editeur est lu cote serveur depuis la variable d'environnement <strong>ADMIN_PASSWORD</strong>.
      </p>
      <p>
        Les fichiers ajoutes par upload sont stockes dans le dossier <strong>uploads/</strong> et servis via <strong>/uploads/nom-du-fichier</strong>.
      </p>
      <p>
        Pour publier ou masquer un contenu, ouvrez sa fiche et utilisez la case <strong>Visible</strong>.
      </p>
    </div>
  );
}

function sectionTitle(section: Section) {
  if (section === "classes") return "Classes et parcours";
  if (section === "news") return "Fil d'actualites";
  if (section === "depot") return "Depot de ressources";
  return "Reglages";
}

function sectionHelp(section: Section) {
  if (section === "classes") return "Cliquez sur une classe, sequence, seance ou activite pour la modifier.";
  if (section === "news") return "Ajoutez ou modifiez les messages visibles sur l'accueil.";
  if (section === "depot") return "Ajoutez les fichiers et liens, puis rattachez-les au bon niveau.";
  return "Configuration de l'acces editeur et des fichiers.";
}

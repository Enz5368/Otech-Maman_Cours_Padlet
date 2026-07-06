import { AudioLines, BookOpen, CalendarClock, FileText, Image, Link2, MonitorPlay, Video, type LucideIcon } from "lucide-react";

export const statusLabels: Record<string, string> = {
  AVAILABLE: "Disponible",
  SOON: "Bientot disponible",
  UPCOMING: "A venir"
};

export const resourceTypeLabels: Record<string, string> = {
  AUDIO: "Audio",
  VIDEO: "Video",
  IMAGE: "Affiche",
  PDF: "PDF",
  DOCUMENT: "Document",
  LINK: "Lien"
};

export const resourceIcons: Record<string, LucideIcon> = {
  AUDIO: AudioLines,
  VIDEO: Video,
  IMAGE: Image,
  PDF: FileText,
  DOCUMENT: BookOpen,
  LINK: Link2
};

export const statusTone: Record<string, string> = {
  AVAILABLE: "bg-olive/10 text-olive border-olive/20",
  SOON: "bg-sea/10 text-sea border-sea/20",
  UPCOMING: "bg-wine-100 text-wine-700 border-wine-100"
};

export function dateLabel(value?: Date | string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const classIcon = MonitorPlay;
export const sessionIcon = CalendarClock;

import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const mimeByExt: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
};

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return NextResponse.json({ error: "Fichier invalide." }, { status: 400 });
  }

  try {
    const filePath = path.join(process.cwd(), "uploads", filename);
    const file = await readFile(filePath);
    const contentType = mimeByExt[path.extname(filename).toLowerCase()] || "application/octet-stream";
    return new NextResponse(file, { headers: { "content-type": contentType } });
  } catch {
    return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
  }
}

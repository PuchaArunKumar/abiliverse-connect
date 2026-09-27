import type { Database } from "@/integrations/supabase/types";

export type MediaKind = Database["public"]["Enums"]["media_kind"];
export type ProblemMedia = Database["public"]["Tables"]["problem_media"]["Row"];

export const PROBLEM_MEDIA_BUCKET = "problem-media";

/** Columns read back for display; select("*") would be the same today but not tomorrow. */
export const PROBLEM_MEDIA_COLUMNS =
  "id, problem_id, user_id, kind, storage_path, file_name, mime_type, size_bytes, description, created_at";

/** Most files one problem can carry; the database enforces the same cap. */
export const MAX_MEDIA_PER_PROBLEM = 20;
export const MAX_DESCRIPTION_LENGTH = 1000;
/** problem_media.file_name allows 1..255 characters. */
export const MAX_FILE_NAME_LENGTH = 255;

/**
 * Allowed types, mirroring the bucket's allowed_mime_types and the
 * problem_media_kind_mime constraint. SVG is excluded on purpose: it can carry
 * script, and these files are public.
 */
export const MEDIA_TYPES: Record<string, MediaKind> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "video/mp4": "video",
  "video/webm": "video",
  "application/pdf": "document",
};

/**
 * Stored file extension per allowed type. Taken from the type rather than the
 * uploaded name, so a file called "photo.html" that is really a PNG is stored
 * as .png and a public URL never ends in something a browser might run.
 */
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "application/pdf": "pdf",
};

/** Per-kind size limits. The bucket's own ceiling is the video limit. */
export const MAX_BYTES: Record<MediaKind, number> = {
  image: 5 * 1024 * 1024,
  video: 25 * 1024 * 1024,
  document: 10 * 1024 * 1024,
};

export const ACCEPT_ATTRIBUTE = Object.keys(MEDIA_TYPES).join(",");

export const MEDIA_KIND_LABELS: Record<MediaKind, string> = {
  image: "Image",
  video: "Video",
  document: "PDF document",
};

/** Short type names for link text such as "report.pdf (PDF, 1.2 MB)". */
export const MEDIA_KIND_SHORT_LABELS: Record<MediaKind, string> = {
  image: "image",
  video: "video",
  document: "PDF",
};

/** Label for the description field of each kind. */
export const DESCRIPTION_PROMPTS: Record<MediaKind, string> = {
  image: "Describe what this image shows",
  video: "Describe what happens in this video",
  document: "What is in this document? (optional)",
};

export const ACCEPTED_FORMATS_SUMMARY =
  "JPEG, PNG, WebP or GIF images up to 5 MB, MP4 or WebM video up to 25 MB, and PDF documents up to 10 MB";

export function mediaKindFor(mimeType: string): MediaKind | null {
  return MEDIA_TYPES[mimeType] ?? null;
}

/** Images and video need a text alternative; a PDF carries its own text. */
export function needsDescription(kind: MediaKind): boolean {
  return kind !== "document";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "report.pdf (PDF, 1.2 MB)" — the visible name of a download link. */
export function mediaLinkText(m: { file_name: string; kind: MediaKind; size_bytes: number }): string {
  return `${m.file_name} (${MEDIA_KIND_SHORT_LABELS[m.kind]}, ${formatBytes(m.size_bytes)})`;
}

/**
 * Returns a sentence explaining why a file cannot be attached, or null when it
 * can. Written to be read aloud by a screen reader as-is.
 */
export function validateMediaFile(file: { name: string; type: string; size: number }): string | null {
  const kind = mediaKindFor(file.type);
  if (!kind) {
    return `${file.name} is not a supported file type. Use JPEG, PNG, WebP or GIF images, MP4 or WebM video, or PDF documents.`;
  }
  if (file.size === 0) {
    return `${file.name} is empty.`;
  }
  if (file.size > MAX_BYTES[kind]) {
    return `${file.name} is ${formatBytes(file.size)}. ${MEDIA_KIND_LABELS[kind]} files can be at most ${formatBytes(MAX_BYTES[kind])}.`;
  }
  return null;
}

/**
 * The text alternative rule from problem_media_described: images and video
 * must say what they show, in at most MAX_DESCRIPTION_LENGTH characters.
 */
export function validateMediaDescription(
  kind: MediaKind,
  description: string,
  fileName: string,
): string | null {
  const text = description.trim();
  if (needsDescription(kind) && !text) {
    return kind === "image"
      ? `Describe what the image ${fileName} shows, so people who cannot see it get the same information.`
      : `Describe what happens in the video ${fileName}, so people who cannot see or hear it get the same information.`;
  }
  if (text.length > MAX_DESCRIPTION_LENGTH) {
    return `Keep the description of ${fileName} to ${MAX_DESCRIPTION_LENGTH} characters or fewer.`;
  }
  return null;
}

/** A file chosen in the form but not uploaded yet. */
export interface PendingMedia {
  /** Local key only; never sent anywhere. */
  id: string;
  file: File;
  kind: MediaKind;
  description: string;
}

/** DOM id of a pending file's description field, shared by the error summary. */
export function mediaDescriptionFieldId(pendingId: string): string {
  return `media-desc-${pendingId}`;
}

/** Description problems for every pending file, keyed by pending id. */
export function pendingDescriptionErrors(
  pending: Pick<PendingMedia, "id" | "kind" | "description" | "file">[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const item of pending) {
    const problem = validateMediaDescription(item.kind, item.description, item.file.name);
    if (problem) errors[item.id] = problem;
  }
  return errors;
}

/**
 * Sorts newly chosen files into ones that can be attached and sentences saying
 * why the rest cannot. `slotsLeft` is how many more files the problem can take.
 */
export function sortChosenFiles<F extends { name: string; type: string; size: number }>(
  files: F[],
  slotsLeft: number,
): { accepted: { file: F; kind: MediaKind }[]; rejected: string[] } {
  const accepted: { file: F; kind: MediaKind }[] = [];
  const rejected: string[] = [];
  for (const file of files) {
    const problem = validateMediaFile(file);
    if (problem) {
      rejected.push(problem);
      continue;
    }
    if (accepted.length >= Math.max(slotsLeft, 0)) {
      rejected.push(
        `${file.name} was not added: a problem can have at most ${MAX_MEDIA_PER_PROBLEM} files.`,
      );
      continue;
    }
    accepted.push({ file, kind: mediaKindFor(file.type) as MediaKind });
  }
  return { accepted, rejected };
}

/** A problem_media.file_name value: the original name, trimmed to fit the column. */
export function storedFileName(name: string): string {
  const trimmed = name.trim() || "file";
  return trimmed.length > MAX_FILE_NAME_LENGTH
    ? trimmed.slice(0, MAX_FILE_NAME_LENGTH)
    : trimmed;
}

/**
 * A random identifier. crypto.randomUUID exists only in secure contexts, so a
 * local build opened over plain http falls back to getRandomValues, which does
 * not have that restriction.
 */
export function randomToken(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// A path segment the policies can compare with auth.uid()::text / problem_id::text.
const PATH_SEGMENT = /^[A-Za-z0-9-]+$/;

/**
 * Object path inside the bucket: <user id>/<problem id>/<random>.<ext>.
 *
 * The first two segments are what the Storage and problem_media policies check.
 * The file name is replaced with a random one so that user-supplied names never
 * reach a URL; the original name is kept in problem_media.file_name for display.
 */
export function mediaStoragePath(
  userId: string,
  problemId: string,
  file: { name: string; type: string },
  random: string = randomToken(),
): string {
  for (const segment of [userId, problemId, random]) {
    // A slash or dot here would move the object out of the folder the
    // policies check, so refuse rather than quietly produce a different path.
    if (!PATH_SEGMENT.test(segment)) {
      throw new Error("mediaStoragePath: ids must be plain identifiers");
    }
  }
  const fromName = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10)
    : "";
  const ext = EXTENSIONS[file.type] ?? (fromName || "bin");
  return `${userId}/${problemId}/${random}.${ext}`;
}

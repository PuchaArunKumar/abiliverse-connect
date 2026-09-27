import { supabase } from "@/integrations/supabase/client";
import {
  PROBLEM_MEDIA_BUCKET,
  PROBLEM_MEDIA_COLUMNS,
  mediaStoragePath,
  storedFileName,
  type PendingMedia,
  type ProblemMedia,
} from "@/lib/media";
import { isMissingBucketError, isMissingSchemaError } from "@/lib/supabase-errors";

export interface UploadOutcome {
  uploaded: ProblemMedia[];
  /** Pending ids that could not be attached, in the order they were tried. */
  failedIds: string[];
  failedNames: string[];
  /** The bucket or table is not deployed; the uploader should be hidden. */
  unavailable: boolean;
}

export function mediaPublicUrl(storagePath: string): string {
  return supabase.storage.from(PROBLEM_MEDIA_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

/**
 * Uploads each file, then records it in problem_media with its description.
 *
 * One at a time rather than in parallel: videos can be 25 MB, and on a slow
 * connection several at once make every one of them likely to time out.
 * A file whose row cannot be written is removed again, so Storage never holds
 * an object that nothing shows or links to.
 */
export async function uploadPendingMedia(
  userId: string,
  problemId: string,
  pending: PendingMedia[],
  onProgress?: (done: number, total: number) => void,
): Promise<UploadOutcome> {
  const outcome: UploadOutcome = {
    uploaded: [],
    failedIds: [],
    failedNames: [],
    unavailable: false,
  };
  const fail = (item: PendingMedia) => {
    outcome.failedIds.push(item.id);
    outcome.failedNames.push(item.file.name);
  };
  const bucket = supabase.storage.from(PROBLEM_MEDIA_BUCKET);

  for (const [index, item] of pending.entries()) {
    onProgress?.(index, pending.length);
    if (outcome.unavailable) {
      fail(item);
      continue;
    }

    const path = mediaStoragePath(userId, problemId, item.file);
    const { error: uploadError } = await bucket.upload(path, item.file, {
      contentType: item.file.type,
      upsert: false,
    });
    if (uploadError) {
      if (isMissingBucketError(uploadError)) outcome.unavailable = true;
      fail(item);
      continue;
    }

    const { data, error } = await supabase
      .from("problem_media")
      .insert({
        problem_id: problemId,
        user_id: userId,
        kind: item.kind,
        storage_path: path,
        file_name: storedFileName(item.file.name),
        mime_type: item.file.type,
        size_bytes: item.file.size,
        description: item.description.trim(),
      })
      .select(PROBLEM_MEDIA_COLUMNS)
      .single();

    if (error || !data) {
      await bucket.remove([path]);
      if (isMissingSchemaError(error)) outcome.unavailable = true;
      fail(item);
      continue;
    }
    outcome.uploaded.push(data as ProblemMedia);
  }
  onProgress?.(pending.length, pending.length);
  return outcome;
}

/**
 * Deletes Storage objects, best effort. Called only after the rows that point
 * at them are gone, so a failure here leaves an invisible orphan file (which
 * the problem_media migration accepts and the dashboard can clean up), never a
 * public problem showing a broken image.
 */
async function removeObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    await supabase.storage.from(PROBLEM_MEDIA_BUCKET).remove(paths);
  } catch {
    // Orphaned file; see above.
  }
}

/**
 * Removes one attached file: the row first, then the Storage object, so the
 * gallery never lists a file that no longer exists. Returns an error
 * sentence, or null.
 */
export async function removeProblemMedia(
  media: Pick<ProblemMedia, "id" | "storage_path">,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("problem_media")
    .delete()
    .eq("id", media.id)
    .select("id");
  if (error) return "The file could not be removed. Please try again.";
  // RLS turns a delete of someone else's row into "0 rows", not an error.
  if (!data || data.length === 0) return "You don't have permission to remove this file.";
  await removeObjects([media.storage_path]);
  return null;
}

/**
 * The Storage paths of a problem's files, read before the problem is deleted
 * (the row cascade removes problem_media but cannot reach Storage). A missing
 * table means there are none.
 */
export async function listProblemMediaPaths(
  problemId: string,
): Promise<{ paths: string[]; error: string | null }> {
  const { data, error } = await supabase
    .from("problem_media")
    .select("storage_path")
    .eq("problem_id", problemId);
  if (error) {
    return isMissingSchemaError(error)
      ? { paths: [], error: null }
      : { paths: [], error: "The problem could not be deleted. Please try again." };
  }
  return { paths: (data ?? []).map((row) => row.storage_path), error: null };
}

/** Removes a deleted problem's files from Storage, best effort. */
export async function removeDeletedProblemMedia(paths: string[]): Promise<void> {
  await removeObjects(paths);
}

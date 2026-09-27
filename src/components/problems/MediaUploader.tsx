import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import { FileText, Film, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ConfirmDialog from "@/components/problems/ConfirmDialog";
import { mediaPublicUrl } from "@/components/problems/media-upload";
import {
  ACCEPTED_FORMATS_SUMMARY,
  ACCEPT_ATTRIBUTE,
  DESCRIPTION_PROMPTS,
  MAX_DESCRIPTION_LENGTH,
  MAX_MEDIA_PER_PROBLEM,
  MEDIA_KIND_LABELS,
  formatBytes,
  mediaDescriptionFieldId,
  needsDescription,
  randomToken,
  sortChosenFiles,
  type PendingMedia,
  type ProblemMedia,
} from "@/lib/media";

export interface MediaUploaderProps {
  pending: PendingMedia[];
  onPendingChange: Dispatch<SetStateAction<PendingMedia[]>>;
  /** Files already attached (edit page). */
  existing?: ProblemMedia[];
  /** Removes an attached file; resolves an error sentence, or null. */
  onRemoveExisting?: (media: ProblemMedia) => Promise<string | null>;
  /** False when the bucket or table is not deployed yet, or unreadable. */
  available: boolean;
  /** Replaces the default "not switched on yet" line when unavailable. */
  unavailableNote?: string;
  /** Only the problem's author may attach files (problem_media insert policy). */
  canAdd?: boolean;
  cannotAddNote?: string;
  /** Description problems keyed by pending id, shown after a submit attempt. */
  descriptionErrors?: Record<string, string>;
  disabled?: boolean;
}

/** A local preview, so a sighted author can check the file while describing it. */
const PendingThumbnail = ({ file }: { file: File }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (typeof URL.createObjectURL !== "function") return;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  if (!url) return null;
  // Decorative: the description field right beside it is the text alternative.
  return (
    <img
      src={url}
      alt=""
      className="h-16 w-16 shrink-0 rounded-md border border-border object-cover"
    />
  );
};

const KindIcon = ({ kind }: { kind: PendingMedia["kind"] }) =>
  kind === "video" ? (
    <Film className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
  ) : (
    <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
  );

const MediaUploader = ({
  pending,
  onPendingChange,
  existing = [],
  onRemoveExisting,
  available,
  unavailableNote,
  canAdd = true,
  cannotAddNote,
  descriptionErrors = {},
  disabled = false,
}: MediaUploaderProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [rejected, setRejected] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [removeTarget, setRemoveTarget] = useState<ProblemMedia | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!available) {
    return (
      <p className="text-sm text-muted-foreground">
        {unavailableNote ??
          "Attaching photos, video and documents is not switched on yet. You can still save the problem without them."}
      </p>
    );
  }

  const slotsLeft = MAX_MEDIA_PER_PROBLEM - existing.length - pending.length;

  const onFilesChosen = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    // Clearing the input lets the same file be chosen again after a removal.
    event.target.value = "";
    if (files.length === 0) return;

    const { accepted, rejected: problems } = sortChosenFiles(files, slotsLeft);
    setRejected(problems);
    if (accepted.length === 0) {
      setStatus("");
      return;
    }
    onPendingChange((prev) => [
      ...prev,
      ...accepted.map(({ file, kind }) => ({
        id: randomToken(),
        file,
        kind,
        description: "",
      })),
    ]);
    const describe = accepted.some(({ kind }) => needsDescription(kind));
    setStatus(
      `${accepted.length} file${accepted.length === 1 ? "" : "s"} added.` +
        (describe ? " Describe each image and video below." : ""),
    );
  };

  const removePending = (item: PendingMedia) => {
    onPendingChange((prev) => prev.filter((p) => p.id !== item.id));
    setStatus(`${item.file.name} removed.`);
    // The removed row's button is gone; the file picker is the natural next stop.
    (inputRef.current ?? regionRef.current)?.focus();
  };

  const updateDescription = (id: string, description: string) =>
    onPendingChange((prev) =>
      prev.map((p) => (p.id === id ? { ...p, description } : p)),
    );

  return (
    <div ref={regionRef} tabIndex={-1} className="space-y-4 focus:outline-none">
      <p id="media-hint" className="text-sm text-muted-foreground">
        Show the barrier as well as describing it. {ACCEPTED_FORMATS_SUMMARY}.
        Up to {MAX_MEDIA_PER_PROBLEM} files per problem. Attached files are
        public, so leave out faces, names and anything else private.
      </p>

      {existing.length > 0 && (
        <div>
          <p className="text-sm font-medium text-foreground" id="media-existing-label">
            Attached files
          </p>
          <ul className="mt-2 space-y-3" role="list" aria-labelledby="media-existing-label">
            {existing.map((m) => (
              <li
                key={m.id}
                className="flex items-start gap-3 rounded-lg border border-border p-3"
              >
                {m.kind === "image" ? (
                  <img
                    src={mediaPublicUrl(m.storage_path)}
                    alt={m.description}
                    className="h-16 w-16 shrink-0 rounded-md border border-border object-cover"
                  />
                ) : (
                  <KindIcon kind={m.kind} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium [overflow-wrap:anywhere]">
                    {m.file_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {MEDIA_KIND_LABELS[m.kind]} · {formatBytes(m.size_bytes)}
                  </p>
                  {m.description && m.kind !== "image" && (
                    <p className="mt-1 break-words text-sm [overflow-wrap:anywhere]">
                      {m.description}
                    </p>
                  )}
                </div>
                {onRemoveExisting && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="min-h-11 min-w-11 shrink-0"
                    aria-label={`Remove ${m.file_name}`}
                    aria-disabled={disabled}
                    onClick={(event) => {
                      if (disabled) return;
                      returnFocusRef.current = event.currentTarget;
                      setRemoveTarget(m);
                      setConfirmOpen(true);
                    }}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {canAdd ? (
        <div>
          <Label htmlFor="media-input">Choose files to attach</Label>
          <Input
            ref={inputRef}
            id="media-input"
            type="file"
            multiple
            accept={ACCEPT_ATTRIBUTE}
            onChange={onFilesChosen}
            disabled={disabled}
            aria-describedby="media-hint media-slots"
            className="mt-1 h-auto min-h-11 cursor-pointer py-2"
          />
          <p id="media-slots" className="mt-1 text-sm text-muted-foreground">
            {slotsLeft > 0
              ? `${slotsLeft} more file${slotsLeft === 1 ? "" : "s"} can be attached.`
              : "This problem has the most files it can hold. Remove one to add another."}
          </p>
        </div>
      ) : (
        cannotAddNote && <p className="text-sm text-muted-foreground">{cannotAddNote}</p>
      )}

      {/* Always mounted so a rejection is announced the moment it appears. */}
      <div role="alert">
        {rejected.length > 0 && (
          <ul className="space-y-1 text-sm font-medium text-destructive" role="list">
            {rejected.map((message) => (
              <li key={message} className="break-words [overflow-wrap:anywhere]">
                {message}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p role="status" className="sr-only">
        {status}
      </p>

      {pending.length > 0 && (
        <ul className="space-y-4" role="list" aria-label="Files to attach">
          {pending.map((item) => {
            const fieldId = mediaDescriptionFieldId(item.id);
            const errorId = `${fieldId}-error`;
            const error = descriptionErrors[item.id];
            const required = needsDescription(item.kind);
            return (
              <li key={item.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start gap-3">
                  {item.kind === "image" ? (
                    <PendingThumbnail file={item.file} />
                  ) : (
                    <KindIcon kind={item.kind} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium [overflow-wrap:anywhere]">
                      {item.file.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {MEDIA_KIND_LABELS[item.kind]} · {formatBytes(item.file.size)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="min-h-11 min-w-11 shrink-0"
                    aria-label={`Remove ${item.file.name}`}
                    aria-disabled={disabled}
                    onClick={() => {
                      if (!disabled) removePending(item);
                    }}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
                <div className="mt-3">
                  <Label htmlFor={fieldId}>
                    {DESCRIPTION_PROMPTS[item.kind]}
                    {required && " (required)"}
                    <span className="sr-only">: {item.file.name}</span>
                  </Label>
                  <Textarea
                    id={fieldId}
                    className="mt-1"
                    rows={2}
                    value={item.description}
                    onChange={(e) => updateDescription(item.id, e.target.value)}
                    maxLength={MAX_DESCRIPTION_LENGTH}
                    required={required}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    readOnly={disabled}
                  />
                  {error && (
                    <p id={errorId} className="mt-1 text-sm font-medium text-destructive">
                      {error}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {onRemoveExisting && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Remove this file?"
          description={
            removeTarget
              ? `${removeTarget.file_name} will be deleted from this problem. This cannot be undone.`
              : ""
          }
          confirmLabel="Remove file"
          busyLabel="Removing..."
          cancelLabel="Keep file"
          onConfirm={async () => {
            if (!removeTarget) return null;
            const problem = await onRemoveExisting(removeTarget);
            if (!problem) setStatus(`${removeTarget.file_name} removed.`);
            return problem;
          }}
          onClosed={(confirmed) => {
            if (confirmed) {
              (inputRef.current ?? regionRef.current)?.focus();
            } else {
              returnFocusRef.current?.focus();
            }
          }}
        />
      )}
    </div>
  );
};

export default MediaUploader;

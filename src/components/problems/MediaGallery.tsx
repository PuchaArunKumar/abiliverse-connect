import { FileText } from "lucide-react";
import { mediaPublicUrl } from "@/components/problems/media-upload";
import { mediaLinkText, type ProblemMedia } from "@/lib/media";

interface MediaGalleryProps {
  media: ProblemMedia[];
}

/**
 * Files attached to a problem. Every image and video was described by its
 * uploader (the database refuses one without), so the description is the
 * image's alt text and is shown in full under each video.
 */
const MediaGallery = ({ media }: MediaGalleryProps) => {
  const images = media.filter((m) => m.kind === "image");
  const videos = media.filter((m) => m.kind === "video");
  const documents = media.filter((m) => m.kind === "document");

  return (
    <div className="space-y-6">
      {images.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2" role="list" aria-label="Images">
          {images.map((m) => (
            <li key={m.id}>
              <img
                src={mediaPublicUrl(m.storage_path)}
                alt={m.description}
                loading="lazy"
                className="max-h-96 w-full rounded-lg border border-border bg-muted object-contain"
              />
            </li>
          ))}
        </ul>
      )}

      {videos.length > 0 && (
        <ul className="space-y-6" role="list" aria-label="Videos">
          {videos.map((m) => {
            const url = mediaPublicUrl(m.storage_path);
            const descriptionId = `media-video-desc-${m.id}`;
            return (
              <li key={m.id}>
                <figure>
                  {/* No autoplay, and metadata only: nothing moves or makes a
                      sound until the person chooses to play it. */}
                  <video
                    controls
                    preload="metadata"
                    aria-describedby={descriptionId}
                    className="w-full rounded-lg border border-border bg-muted"
                  >
                    <source src={url} type={m.mime_type} />
                    Your browser cannot play this video.{" "}
                    <a href={url}>Download {m.file_name}</a>.
                  </video>
                  <figcaption
                    id={descriptionId}
                    className="mt-2 whitespace-pre-wrap break-words text-sm text-foreground [overflow-wrap:anywhere]"
                  >
                    <span className="font-medium">What happens in this video: </span>
                    {m.description}
                  </figcaption>
                </figure>
              </li>
            );
          })}
        </ul>
      )}

      {documents.length > 0 && (
        <ul className="space-y-3" role="list" aria-label="Documents">
          {documents.map((m) => (
            <li key={m.id} className="flex items-start gap-2">
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <a
                  href={mediaPublicUrl(m.storage_path)}
                  className="break-words font-medium text-primary underline underline-offset-2 [overflow-wrap:anywhere]"
                >
                  {mediaLinkText(m)}
                </a>
                {m.description && (
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                    {m.description}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MediaGallery;

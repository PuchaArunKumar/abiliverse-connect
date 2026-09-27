import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineLoadingProps {
  /** What a screen reader hears, e.g. "Loading posts…". */
  label: string;
  className?: string;
}

/**
 * A busy indicator inside a page. The spinner is decorative; the status text
 * is what is announced, so the wait is not silent (WCAG 4.1.3).
 */
const InlineLoading = ({ label, className }: InlineLoadingProps) => (
  <div role="status" className={cn("flex justify-center py-10", className)}>
    <Loader2
      className="h-6 w-6 animate-spin text-primary motion-reduce:animate-none"
      aria-hidden="true"
    />
    <span className="sr-only">{label}</span>
  </div>
);

export default InlineLoading;

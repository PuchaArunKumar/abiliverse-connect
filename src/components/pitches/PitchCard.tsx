import { Link } from "react-router-dom";
import { Heart, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DISABILITY_TYPE_LABELS, formatDate } from "@/lib/problems";
import {
  PITCH_NEED_LABELS,
  PITCH_STAGE_LABELS,
  formatFunding,
  pitchTitleId,
  pluralise,
  type ListedPitch,
} from "@/lib/pitches";

/**
 * One pitch in the list. The title is an h2 because the cards sit directly
 * under the page's h1.
 */
const PitchCard = ({ pitch }: { pitch: ListedPitch }) => {
  const goal = pitch.needs.includes("funding") ? pitch.funding_goal : null;
  return (
    <Card className="transition-shadow hover:shadow-md motion-reduce:transition-none">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="min-w-0 font-heading text-lg font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">
            <Link
              id={pitchTitleId(pitch.id)}
              to={`/pitches/${pitch.id}`}
              className="hover:underline focus-visible:underline"
            >
              {pitch.title}
            </Link>
          </h2>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              <span className="sr-only">Stage: </span>
              {PITCH_STAGE_LABELS[pitch.stage]}
            </Badge>
            {!pitch.is_open && <Badge variant="outline">Closed</Badge>}
          </div>
        </div>
        <p className="text-foreground [overflow-wrap:anywhere]">{pitch.tagline}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {pitch.needs.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Looking for:</span>
            {pitch.needs.map((need) => (
              <Badge key={need} variant="outline">
                {PITCH_NEED_LABELS[need]}
              </Badge>
            ))}
          </div>
        )}
        {goal !== null && (
          <p className="text-sm text-muted-foreground">
            Funding goal: {formatFunding(goal, pitch.funding_currency)}
          </p>
        )}
        {pitch.disability_types.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">For:</span>
            {pitch.disability_types.map((d) => (
              <Badge key={d} variant="secondary">
                {DISABILITY_TYPE_LABELS[d]}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Heart className="h-4 w-4" aria-hidden="true" />
            {pluralise(pitch.support_count, "supporter", "supporters")}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            {pluralise(pitch.feedback_count, "piece of feedback", "pieces of feedback")}
          </span>
          <span>Shared {formatDate(pitch.created_at)}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default PitchCard;

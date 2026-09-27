import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import ProblemPicker from "@/components/pitches/ProblemPicker";
import { DISABILITY_TYPES, DISABILITY_TYPE_LABELS } from "@/lib/problems";
import {
  EMPTY_PITCH_FORM,
  PITCH_FORM_FIELD_ORDER,
  PITCH_LIMITS,
  PITCH_NEEDS,
  PITCH_NEED_LABELS,
  PITCH_STAGES,
  PITCH_STAGE_HINTS,
  PITCH_STAGE_LABELS,
  isPitchStage,
  validatePitchForm,
  type PitchFormErrors,
  type PitchFormField,
  type PitchFormValues,
} from "@/lib/pitches";

interface PitchFormProps {
  mode: "create" | "edit";
  initialValues?: PitchFormValues;
  submitting: boolean;
  /** Why the last save failed; shown above the buttons and announced. */
  submitError?: string | null;
  onSubmit: (values: PitchFormValues) => void;
  onCancel: () => void;
}

/** The element each field's error links to. */
const FIELD_IDS: Record<PitchFormField, string> = {
  title: "pitch-title",
  tagline: "pitch-tagline",
  description: "pitch-description",
  stage: "pitch-stage-idea",
  fundingGoal: "pitch-funding-goal",
  fundingCurrency: "pitch-funding-currency",
  websiteUrl: "pitch-website",
  demoUrl: "pitch-demo",
  tags: "pitch-tags",
};

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Space-separated ids for aria-describedby, skipping the absent ones. */
function describedBy(...ids: (string | false | undefined)[]): string | undefined {
  const present = ids.filter(Boolean);
  return present.length ? present.join(" ") : undefined;
}

const FieldError = ({ id, message }: { id: string; message?: string }) =>
  message ? (
    <p id={id} className="mt-1 text-sm font-medium text-destructive">
      <span className="sr-only">Error: </span>
      {message}
    </p>
  ) : null;

/**
 * Shared by "Submit a pitch" and "Edit pitch".
 *
 * Validation runs on submit, not on every keystroke: errors that appear while
 * someone is still typing are noise, and worse when read aloud.
 */
const PitchForm = ({
  mode,
  initialValues = EMPTY_PITCH_FORM,
  submitting,
  submitError,
  onSubmit,
  onCancel,
}: PitchFormProps) => {
  const [values, setValues] = useState<PitchFormValues>(initialValues);
  const [errors, setErrors] = useState<PitchFormErrors>({});
  const [summaryFocusTick, setSummaryFocusTick] = useState(0);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (summaryFocusTick > 0) summaryRef.current?.focus();
  }, [summaryFocusTick]);

  // After a failed submit, drop each error as soon as its field is fixed, and
  // keep the wording of the rest current. New errors wait for the next submit.
  useEffect(() => {
    setErrors((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const fresh = validatePitchForm(values);
      const kept: PitchFormErrors = {};
      for (const field of Object.keys(prev) as PitchFormField[]) {
        if (fresh[field]) kept[field] = fresh[field];
      }
      return kept;
    });
  }, [values]);

  const update = <K extends keyof PitchFormValues>(
    key: K,
    value: PitchFormValues[K] | ((prev: PitchFormValues[K]) => PitchFormValues[K]),
  ) => {
    setValues((prev) => ({
      ...prev,
      [key]:
        typeof value === "function"
          ? (value as (p: PitchFormValues[K]) => PitchFormValues[K])(prev[key])
          : value,
    }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const found = validatePitchForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setSummaryFocusTick((t) => t + 1);
      return;
    }
    onSubmit(values);
  };

  const jumpTo = (event: MouseEvent<HTMLAnchorElement>, field: PitchFormField) => {
    // A plain #hash link would go through the router; focus the field directly.
    event.preventDefault();
    const id =
      field === "stage" && isPitchStage(values.stage)
        ? `pitch-stage-${values.stage}`
        : FIELD_IDS[field];
    document.getElementById(id)?.focus();
  };

  const errorFields = PITCH_FORM_FIELD_ORDER.filter((f) => errors[f]);
  const wantsFunding = values.needs.includes("funding");
  const isEdit = mode === "edit";

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      {errorFields.length > 0 && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          aria-labelledby="pitch-error-summary-heading"
          className="rounded-lg border-2 border-destructive p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <h2
            id="pitch-error-summary-heading"
            className="font-heading text-lg font-semibold text-foreground"
          >
            {errorFields.length === 1
              ? "There is 1 thing to fix"
              : `There are ${errorFields.length} things to fix`}
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {errorFields.map((field) => (
              <li key={field}>
                <a
                  href={`#${FIELD_IDS[field]}`}
                  onClick={(e) => jumpTo(e, field)}
                  className="font-medium text-destructive underline underline-offset-4"
                >
                  {errors[field]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <Label htmlFor="pitch-title">Title</Label>
        <Input
          id="pitch-title"
          className="mt-1 min-h-11"
          value={values.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="Talking bus-stop signs for blind travellers"
          aria-required="true"
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={describedBy("pitch-title-hint", errors.title && "pitch-title-error")}
        />
        <p id="pitch-title-hint" className="mt-1 text-sm text-muted-foreground">
          {PITCH_LIMITS.titleMin} to {PITCH_LIMITS.titleMax} characters. Name the
          idea plainly.
        </p>
        <FieldError id="pitch-title-error" message={errors.title} />
      </div>

      <div>
        <Label htmlFor="pitch-tagline">Tagline</Label>
        <Input
          id="pitch-tagline"
          className="mt-1 min-h-11"
          value={values.tagline}
          onChange={(e) => update("tagline", e.target.value)}
          placeholder="Stops announce themselves to a phone, no app download needed."
          aria-required="true"
          aria-invalid={errors.tagline ? true : undefined}
          aria-describedby={describedBy("pitch-tagline-hint", errors.tagline && "pitch-tagline-error")}
        />
        <p id="pitch-tagline-hint" className="mt-1 text-sm text-muted-foreground">
          One sentence, {PITCH_LIMITS.taglineMin} to {PITCH_LIMITS.taglineMax}{" "}
          characters. This is what people see in the list of pitches.
        </p>
        <FieldError id="pitch-tagline-error" message={errors.tagline} />
      </div>

      <div>
        <Label htmlFor="pitch-description">Description</Label>
        <Textarea
          id="pitch-description"
          className="mt-1"
          rows={8}
          value={values.description}
          onChange={(e) => update("description", e.target.value)}
          aria-required="true"
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={describedBy(
            "pitch-description-hint",
            errors.description && "pitch-description-error",
          )}
        />
        <p id="pitch-description-hint" className="mt-1 text-sm text-muted-foreground">
          {PITCH_LIMITS.descriptionMin} to{" "}
          {PITCH_LIMITS.descriptionMax.toLocaleString()} characters. Who it is
          for, what it does, and what you have learned from disabled people so
          far.
        </p>
        <FieldError id="pitch-description-error" message={errors.description} />
      </div>

      <div>
        <p id="pitch-stage-label" className="text-sm font-medium text-foreground">
          Stage
        </p>
        <RadioGroup
          className="mt-2 gap-1"
          value={values.stage}
          onValueChange={(v) => {
            if (isPitchStage(v)) update("stage", v);
          }}
          aria-labelledby="pitch-stage-label"
          aria-describedby={errors.stage ? "pitch-stage-error" : undefined}
        >
          {PITCH_STAGES.map((stage) => (
            <div key={stage} className="flex min-h-11 items-start gap-3 py-1">
              <RadioGroupItem
                id={`pitch-stage-${stage}`}
                value={stage}
                className="mt-0.5"
                aria-describedby={`pitch-stage-${stage}-hint`}
              />
              <div>
                <Label htmlFor={`pitch-stage-${stage}`} className="cursor-pointer">
                  {PITCH_STAGE_LABELS[stage]}
                </Label>
                <p
                  id={`pitch-stage-${stage}-hint`}
                  className="mt-0.5 text-sm text-muted-foreground"
                >
                  {PITCH_STAGE_HINTS[stage]}
                </p>
              </div>
            </div>
          ))}
        </RadioGroup>
        <FieldError id="pitch-stage-error" message={errors.stage} />
      </div>

      <fieldset aria-describedby="pitch-needs-hint">
        <legend className="text-sm font-medium text-foreground">
          What would help (optional)
        </legend>
        <p id="pitch-needs-hint" className="mt-1 text-sm text-muted-foreground">
          Choose everything that applies. Choosing Funding adds a funding goal
          below.
        </p>
        <div className="mt-2 grid gap-x-4 sm:grid-cols-2">
          {PITCH_NEEDS.map((need) => (
            <div key={need} className="flex min-h-11 items-center gap-3">
              <Checkbox
                id={`pitch-need-${need}`}
                checked={values.needs.includes(need)}
                onCheckedChange={() => update("needs", (prev) => toggle(prev, need))}
              />
              <Label htmlFor={`pitch-need-${need}`} className="cursor-pointer py-3 font-normal">
                {PITCH_NEED_LABELS[need]}
              </Label>
            </div>
          ))}
        </div>
      </fieldset>

      {wantsFunding && (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">
            Abilitiverse does not process payments or hold money. People who can
            help with funding send you a private interest request with their
            contact details, and you take the conversation from there.
          </p>
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <div>
              <Label htmlFor="pitch-funding-goal">Funding goal (optional)</Label>
              <Input
                id="pitch-funding-goal"
                className="mt-1 min-h-11"
                inputMode="numeric"
                autoComplete="off"
                value={values.fundingGoal}
                onChange={(e) => update("fundingGoal", e.target.value)}
                aria-invalid={errors.fundingGoal ? true : undefined}
                aria-describedby={describedBy(
                  "pitch-funding-goal-hint",
                  errors.fundingGoal && "pitch-funding-goal-error",
                )}
              />
              <p id="pitch-funding-goal-hint" className="mt-1 text-sm text-muted-foreground">
                A whole number, for example 25000.
              </p>
              <FieldError id="pitch-funding-goal-error" message={errors.fundingGoal} />
            </div>
            <div>
              <Label htmlFor="pitch-funding-currency">Currency</Label>
              <Input
                id="pitch-funding-currency"
                className="mt-1 min-h-11 uppercase"
                maxLength={3}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                value={values.fundingCurrency}
                onChange={(e) => update("fundingCurrency", e.target.value.toUpperCase())}
                aria-invalid={errors.fundingCurrency ? true : undefined}
                aria-describedby={describedBy(
                  "pitch-funding-currency-hint",
                  errors.fundingCurrency && "pitch-funding-currency-error",
                )}
              />
              <p
                id="pitch-funding-currency-hint"
                className="mt-1 text-sm text-muted-foreground"
              >
                Three letters, such as USD.
              </p>
              <FieldError id="pitch-funding-currency-error" message={errors.fundingCurrency} />
            </div>
          </div>
        </div>
      )}

      <fieldset>
        <legend className="text-sm font-medium text-foreground">
          Who it is for (optional)
        </legend>
        <div className="mt-2 grid gap-x-4 sm:grid-cols-2">
          {DISABILITY_TYPES.map((d) => (
            <div key={d} className="flex min-h-11 items-center gap-3">
              <Checkbox
                id={`pitch-dt-${d}`}
                checked={values.disabilityTypes.includes(d)}
                onCheckedChange={() => update("disabilityTypes", (prev) => toggle(prev, d))}
              />
              <Label htmlFor={`pitch-dt-${d}`} className="cursor-pointer py-3 font-normal">
                {DISABILITY_TYPE_LABELS[d]}
              </Label>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <Label htmlFor="pitch-website">Website (optional)</Label>
          <Input
            id="pitch-website"
            type="url"
            inputMode="url"
            autoComplete="url"
            className="mt-1 min-h-11"
            value={values.websiteUrl}
            onChange={(e) => update("websiteUrl", e.target.value)}
            placeholder="https://"
            aria-invalid={errors.websiteUrl ? true : undefined}
            aria-describedby={describedBy("pitch-url-hint", errors.websiteUrl && "pitch-website-error")}
          />
          <FieldError id="pitch-website-error" message={errors.websiteUrl} />
        </div>
        <div>
          <Label htmlFor="pitch-demo">Demo or video (optional)</Label>
          <Input
            id="pitch-demo"
            type="url"
            inputMode="url"
            className="mt-1 min-h-11"
            value={values.demoUrl}
            onChange={(e) => update("demoUrl", e.target.value)}
            placeholder="https://"
            aria-invalid={errors.demoUrl ? true : undefined}
            aria-describedby={describedBy("pitch-url-hint", errors.demoUrl && "pitch-demo-error")}
          />
          <FieldError id="pitch-demo-error" message={errors.demoUrl} />
        </div>
        <p id="pitch-url-hint" className="-mt-4 text-sm text-muted-foreground sm:col-span-2">
          Full web addresses starting with https://. If your demo is a video,
          please make sure it has captions.
        </p>
      </div>

      <div>
        <Label htmlFor="pitch-tags">Tags (optional)</Label>
        <Input
          id="pitch-tags"
          className="mt-1 min-h-11"
          value={values.tags}
          onChange={(e) => update("tags", e.target.value)}
          placeholder="navigation, public-transport, low-cost"
          aria-invalid={errors.tags ? true : undefined}
          aria-describedby={describedBy("pitch-tags-hint", errors.tags && "pitch-tags-error")}
        />
        <p id="pitch-tags-hint" className="mt-1 text-sm text-muted-foreground">
          Separate tags with commas, up to {PITCH_LIMITS.tagsMax}.
        </p>
        <FieldError id="pitch-tags-error" message={errors.tags} />
      </div>

      <ProblemPicker
        value={values.problem}
        onChange={(problem) => update("problem", problem)}
      />

      {isEdit && (
        <div className="flex items-start gap-3">
          <Switch
            id="pitch-open"
            className="mt-0.5"
            checked={values.isOpen}
            onCheckedChange={(checked) => update("isOpen", checked)}
            aria-describedby="pitch-open-hint"
          />
          <div>
            <Label htmlFor="pitch-open" className="cursor-pointer">
              Open to new interest
            </Label>
            <p id="pitch-open-hint" className="mt-1 text-sm text-muted-foreground">
              When this is off, your pitch stays visible and people can still
              leave feedback, but no one can send you new interest requests.
            </p>
          </div>
        </div>
      )}

      {/* Always mounted, so a failed save is announced when the text appears. */}
      <div role="alert">
        {submitError && (
          <p className="text-sm font-medium text-destructive">{submitError}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {/* aria-disabled rather than disabled, so the button keeps focus while
            the save runs; submit() ignores repeat presses. */}
        <Button type="submit" className="min-h-11" aria-disabled={submitting}>
          {submitting ? (
            <>
              <Loader2
                className="mr-1 h-4 w-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              {isEdit ? "Saving…" : "Publishing…"}
            </>
          ) : isEdit ? (
            "Save changes"
          ) : (
            "Publish pitch"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => {
            if (!submitting) onCancel();
          }}
          aria-disabled={submitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
};

export default PitchForm;

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import {
  AGE_GROUPS,
  AGE_GROUP_LABELS,
  DISABILITY_TYPES,
  DISABILITY_TYPE_LABELS,
  SEVERITY_LABELS,
  SEVERITY_LEVELS,
  parseTags,
  type AgeGroup,
  type DisabilityType,
  type SeverityLevel,
} from "@/lib/problems";

interface SimilarProblem {
  id: string;
  title: string;
  vote_count: number;
}

const ProblemNew = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [country, setCountry] = useState("");
  const [severity, setSeverity] = useState<SeverityLevel | "unspecified">(
    "unspecified",
  );
  const [disabilityTypes, setDisabilityTypes] = useState<DisabilityType[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [existingSolutions, setExistingSolutions] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [similar, setSimilar] = useState<SimilarProblem[]>([]);

  // Duplicate detection. Ranked lexical match today; the same call site swaps to
  // an embedding search once problems carry vectors, without the form changing.
  useEffect(() => {
    const term = title.trim();
    if (term.length < 8) {
      setSimilar([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc("search_problems", {
        _query: term,
        _limit: 5,
      });
      if (!error && data) {
        setSimilar(
          data.map((d) => ({
            id: d.id,
            title: d.title,
            vote_count: d.vote_count,
          })),
        );
      }
    }, 400);
    return () => clearTimeout(t);
  }, [title]);

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const { data, error } = await supabase
      .from("problems")
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        country: country.trim(),
        severity: severity === "unspecified" ? null : severity,
        disability_types: disabilityTypes,
        age_groups: ageGroups,
        existing_solutions: existingSolutions.trim(),
        tags: parseTags(tags),
      })
      .select("id")
      .single();

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Problem documented. Thank you for contributing.");
    navigate(`/problems/${data.id}`);
  };

  if (!user) {
    return (
      <Layout>
        <section className="container max-w-md py-16 text-center">
          <h1 className="mb-3 font-heading text-2xl font-bold">
            Sign in to report a problem
          </h1>
          <p className="mb-6 text-muted-foreground">
            Documenting a problem requires an account so the community can follow
            up with you.
          </p>
          <Button asChild className="min-h-11">
            <Link to="/login?next=/problems/new">Sign in</Link>
          </Button>
        </section>
      </Layout>
    );
  }

  const canSubmit =
    title.trim().length >= 8 && description.trim().length >= 20 && !saving;

  return (
    <Layout>
      <section className="container max-w-2xl py-8">
        <h1 className="font-heading text-3xl font-bold text-foreground">
          Report a problem
        </h1>
        <p className="mt-1 text-muted-foreground">
          Describe a disability-related challenge. Be specific about who it
          affects and what makes it hard — that is what lets someone build the
          right solution.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-6">
          <div>
            <Label htmlFor="p-title">Title</Label>
            <Input
              id="p-title"
              className="mt-1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Public transport apps do not announce stops audibly"
              required
              minLength={8}
              maxLength={200}
              aria-describedby="p-title-hint"
            />
            <p id="p-title-hint" className="mt-1 text-sm text-muted-foreground">
              At least 8 characters. A clear, specific summary.
            </p>
          </div>

          {similar.length > 0 && (
            <Alert>
              <Lightbulb className="h-4 w-4" aria-hidden="true" />
              <AlertTitle>Similar problems already documented</AlertTitle>
              <AlertDescription>
                <p className="mb-2">
                  Adding to an existing report keeps the evidence together. Check
                  these before continuing:
                </p>
                <ul className="space-y-1" role="list">
                  {similar.map((s) => (
                    <li key={s.id}>
                      <Link
                        to={`/problems/${s.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {s.title}
                      </Link>{" "}
                      <span className="text-muted-foreground">
                        ({s.vote_count} affected)
                      </span>
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div>
            <Label htmlFor="p-description">Description</Label>
            <Textarea
              id="p-description"
              className="mt-1"
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              minLength={20}
              maxLength={20000}
              aria-describedby="p-description-hint"
            />
            <p
              id="p-description-hint"
              className="mt-1 text-sm text-muted-foreground"
            >
              At least 20 characters. What happens, who it affects, and why
              current options fall short.
            </p>
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-foreground">
              Disability types affected
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {DISABILITY_TYPES.map((d) => (
                <div key={d} className="flex items-center gap-2">
                  <Checkbox
                    id={`dt-${d}`}
                    checked={disabilityTypes.includes(d)}
                    onCheckedChange={() =>
                      setDisabilityTypes((prev) => toggle(prev, d))
                    }
                  />
                  <Label htmlFor={`dt-${d}`} className="font-normal">
                    {DISABILITY_TYPE_LABELS[d]}
                  </Label>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-foreground">
              Age groups affected
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {AGE_GROUPS.map((a) => (
                <div key={a} className="flex items-center gap-2">
                  <Checkbox
                    id={`ag-${a}`}
                    checked={ageGroups.includes(a)}
                    onCheckedChange={() => setAgeGroups((prev) => toggle(prev, a))}
                  />
                  <Label htmlFor={`ag-${a}`} className="font-normal">
                    {AGE_GROUP_LABELS[a]}
                  </Label>
                </div>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="p-category">Category</Label>
              <Input
                id="p-category"
                className="mt-1"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Transport"
                maxLength={100}
              />
            </div>
            <div>
              <Label htmlFor="p-country">Country</Label>
              <Input
                id="p-country"
                className="mt-1"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="India"
                maxLength={100}
              />
            </div>
            <div>
              <Label htmlFor="p-severity">Severity</Label>
              <Select
                value={severity}
                onValueChange={(v) =>
                  setSeverity(v as SeverityLevel | "unspecified")
                }
              >
                <SelectTrigger id="p-severity" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unspecified">Not specified</SelectItem>
                  {SEVERITY_LEVELS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SEVERITY_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="p-existing">Existing solutions you know of</Label>
            <Textarea
              id="p-existing"
              className="mt-1"
              rows={3}
              value={existingSolutions}
              onChange={(e) => setExistingSolutions(e.target.value)}
              maxLength={10000}
              placeholder="What people currently do, and where it falls short."
            />
          </div>

          <div>
            <Label htmlFor="p-tags">Tags</Label>
            <Input
              id="p-tags"
              className="mt-1"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="screen-reader, navigation, public-transport"
              aria-describedby="p-tags-hint"
            />
            <p id="p-tags-hint" className="mt-1 text-sm text-muted-foreground">
              Comma separated, up to 20.
            </p>
          </div>

          <div className="flex gap-3">
            <Button type="submit" className="min-h-11" disabled={!canSubmit}>
              {saving ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
                  Publishing...
                </>
              ) : (
                "Publish problem"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => navigate("/problems")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </section>
    </Layout>
  );
};

export default ProblemNew;

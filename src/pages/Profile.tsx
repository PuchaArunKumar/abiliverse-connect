import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import Layout from "@/components/layout/Layout";
import FormAlert from "@/components/auth/FormAlert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { supabase } from "@/integrations/supabase/client";

const NAME_MAX = 120;
const BIO_MAX = 2000;

/**
 * The public face of an account: the name and short bio other members see on
 * posts, problems, pitches and in the member directory.
 *
 * Profiles used to be created with the email address as the display name.
 * That was a privacy leak and has been removed, so members who never chose a
 * name now appear as "Community member" until they set one here.
 */
const Profile = () => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const inFlight = useRef(false);

  useDocumentTitle("Your profile");

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data, error: loadError } = await supabase
        .from("profiles")
        .select("display_name, bio")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (loadError) setError("Could not load your profile. Please try again.");
      setDisplayName(data?.display_name ?? "");
      setBio(data?.bio ?? "");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    setStatus("");

    const patch = { display_name: displayName.trim(), bio: bio.trim() };
    // Update first; a profile row is created at signup, but accounts from
    // before that trigger existed may not have one, so fall back to insert.
    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update(patch)
      .eq("user_id", userId)
      .select("user_id");
    let saveError = updateError;
    if (!saveError && (updated ?? []).length === 0) {
      ({ error: saveError } = await supabase
        .from("profiles")
        .insert({ user_id: userId, ...patch }));
    }

    inFlight.current = false;
    setSaving(false);
    if (saveError) {
      setError("Could not save your profile. Please try again.");
      return;
    }
    setDisplayName(patch.display_name);
    setBio(patch.bio);
    setStatus("Profile saved.");
    toast.success("Profile saved.");
  };

  return (
    <Layout>
      <section className="container max-w-xl py-8">
        <h1 className="font-heading text-3xl font-bold text-foreground">Your profile</h1>
        <p className="mt-1 text-muted-foreground">
          This is what other members see next to your posts, problems and pitches.
          Your email address is never shown.
        </p>

        {loading ? (
          <div role="status" className="mt-8 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Loading your profile…
          </div>
        ) : (
          <form onSubmit={save} className="mt-8 space-y-6" noValidate>
            <FormAlert id="profile-error" message={error} />
            <div>
              <label htmlFor="profile-name" className="mb-1 block text-sm font-medium text-foreground">
                Display name
              </label>
              <Input
                id="profile-name"
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={NAME_MAX}
                aria-describedby="profile-name-hint"
                className="min-h-11"
              />
              <p id="profile-name-hint" className="mt-1 text-sm text-muted-foreground">
                Leave it empty to appear as "Community member".
              </p>
            </div>
            <div>
              <label htmlFor="profile-bio" className="mb-1 block text-sm font-medium text-foreground">
                About you <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                id="profile-bio"
                rows={5}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={BIO_MAX}
                aria-describedby="profile-bio-hint"
              />
              <p id="profile-bio-hint" className="mt-1 text-sm text-muted-foreground">
                Up to {BIO_MAX.toLocaleString("en")} characters. Share only what you are
                comfortable with other members knowing.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" className="min-h-11" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    Saving…
                  </>
                ) : (
                  "Save profile"
                )}
              </Button>
              <p role="status" className="text-sm text-muted-foreground">
                {status}
              </p>
            </div>
          </form>
        )}
      </section>
    </Layout>
  );
};

export default Profile;

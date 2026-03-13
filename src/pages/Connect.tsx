import { useEffect, useState } from "react";
import Layout from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Users, UserCircle, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string;
  bio: string;
}

const Connect = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfiles = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setProfiles(data as Profile[]);
      }
      setLoading(false);
    };

    if (user) {
      fetchProfiles();
    } else {
      setLoading(false);
    }
  }, [user]);

  const getInitials = (name: string) => {
    return name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";
  };

  return (
    <Layout>
      <section className="container py-16">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-secondary text-primary">
            <Users className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="mb-3 font-heading text-3xl font-bold text-foreground">Connect</h1>
          <p className="mb-10 text-muted-foreground">
            Discover developers, investors, mentors, and advocates in the assistive technology space.
          </p>
        </div>

        {!user ? (
          <div className="mx-auto max-w-md text-center">
            <p className="mb-4 text-muted-foreground">Sign in to see community profiles.</p>
            <Button asChild>
              <Link to="/login">Sign In</Link>
            </Button>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : profiles.length === 0 ? (
          <p className="text-center text-muted-foreground">No profiles yet. Be the first to join!</p>
        ) : (
          <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile) => (
              <Card key={profile.id} className="transition-shadow hover:shadow-md">
                <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                  <Avatar className="h-16 w-16">
                    {profile.avatar_url ? (
                      <AvatarImage src={profile.avatar_url} alt={profile.display_name} />
                    ) : null}
                    <AvatarFallback className="bg-secondary text-primary text-lg">
                      {getInitials(profile.display_name)}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="font-semibold text-foreground">
                    {profile.display_name || "Anonymous"}
                  </h3>
                  {profile.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-3">{profile.bio}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
};

export default Connect;

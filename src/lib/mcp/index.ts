import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getProfileTool from "./tools/get-profile";
import updateProfileTool from "./tools/update-profile";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "abilitiverse-mcp",
  title: "Abilitiverse",
  version: "0.1.0",
  instructions:
    "Tools for Abilitiverse — the community platform for assistive technology. Use `get_my_profile` to read the signed-in user's profile and `update_my_profile` to update their display name, bio, or avatar URL.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getProfileTool, updateProfileTool],
});
import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "update_my_profile",
  title: "Update my profile",
  description: "Update the signed-in Abilitiverse user's profile fields (display name, bio, avatar URL). Only provided fields are changed.",
  inputSchema: {
    display_name: z.string().trim().min(1).max(120).optional().describe("Public display name."),
    bio: z.string().trim().max(2000).optional().describe("Short biography."),
    avatar_url: z.string().url().optional().describe("URL to an avatar image."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const patch: Record<string, unknown> = {};
    if (input.display_name !== undefined) patch.display_name = input.display_name;
    if (input.bio !== undefined) patch.bio = input.bio;
    if (input.avatar_url !== undefined) patch.avatar_url = input.avatar_url;
    if (Object.keys(patch).length === 0) {
      return { content: [{ type: "text", text: "No fields provided to update." }], isError: true };
    }
    const { data, error } = await supabaseForUser(ctx)
      .from("profiles")
      .update(patch)
      .eq("user_id", ctx.getUserId()!)
      .select()
      .maybeSingle();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { profile: data },
    };
  },
});
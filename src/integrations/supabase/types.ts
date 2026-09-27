export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      companion_completions: {
        Row: {
          completed_on: string
          created_at: string
          routine_id: string
          user_id: string
        }
        Insert: {
          completed_on: string
          created_at?: string
          routine_id: string
          user_id: string
        }
        Update: {
          completed_on?: string
          created_at?: string
          routine_id?: string
          user_id?: string
        }
        Relationships: []
      }
      companion_routines: {
        Row: {
          active: boolean
          created_at: string
          days: number[]
          id: string
          notes: string
          remind_at: string | null
          steps: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          days?: number[]
          id?: string
          notes?: string
          remind_at?: string | null
          steps?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          days?: number[]
          id?: string
          notes?: string
          remind_at?: string | null
          steps?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          topic: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          topic?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          topic?: string
          user_id?: string | null
        }
        Relationships: []
      }
      courses: {
        Row: {
          created_at: string
          description: string
          id: string
          level: string
          provider: string | null
          tags: string[]
          title: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          level?: string
          provider?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          level?: string
          provider?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          description: string
          id: string
          kind: string
          link: string | null
          location: string | null
          starts_at: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          kind: string
          link?: string | null
          location?: string | null
          starts_at?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          kind?: string
          link?: string | null
          location?: string | null
          starts_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          cover_note: string | null
          created_at: string
          id: string
          job_id: string
          user_id: string
        }
        Insert: {
          cover_note?: string | null
          created_at?: string
          id?: string
          job_id: string
          user_id: string
        }
        Update: {
          cover_note?: string | null
          created_at?: string
          id?: string
          job_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          accessibility_tags: string[]
          apply_url: string | null
          company: string
          created_at: string
          description: string
          id: string
          location: string | null
          remote: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accessibility_tags?: string[]
          apply_url?: string | null
          company: string
          created_at?: string
          description: string
          id?: string
          location?: string | null
          remote?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accessibility_tags?: string[]
          apply_url?: string | null
          company?: string
          created_at?: string
          description?: string
          id?: string
          location?: string | null
          remote?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      pitch_feedback: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          pitch_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind?: string
          pitch_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          pitch_id?: string
          user_id?: string
        }
        Relationships: []
      }
      pitch_interests: {
        Row: {
          contact: string
          created_at: string
          id: string
          message: string
          offering: Database["public"]["Enums"]["pitch_need"]
          pitch_id: string
          user_id: string
        }
        Insert: {
          contact: string
          created_at?: string
          id?: string
          message: string
          offering: Database["public"]["Enums"]["pitch_need"]
          pitch_id: string
          user_id: string
        }
        Update: {
          contact?: string
          created_at?: string
          id?: string
          message?: string
          offering?: Database["public"]["Enums"]["pitch_need"]
          pitch_id?: string
          user_id?: string
        }
        Relationships: []
      }
      pitch_supports: {
        Row: {
          created_at: string
          pitch_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          pitch_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          pitch_id?: string
          user_id?: string
        }
        Relationships: []
      }
      pitches: {
        Row: {
          created_at: string
          demo_url: string
          description: string
          disability_types: Database["public"]["Enums"]["disability_type"][]
          feedback_count: number
          funding_currency: string
          funding_goal: number | null
          id: string
          is_open: boolean
          needs: Database["public"]["Enums"]["pitch_need"][]
          problem_id: string | null
          search_vector: unknown | null
          stage: Database["public"]["Enums"]["pitch_stage"]
          support_count: number
          tagline: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
          website_url: string
        }
        Insert: {
          created_at?: string
          demo_url?: string
          description: string
          disability_types?: Database["public"]["Enums"]["disability_type"][]
          feedback_count?: number
          funding_currency?: string
          funding_goal?: number | null
          id?: string
          is_open?: boolean
          needs?: Database["public"]["Enums"]["pitch_need"][]
          problem_id?: string | null
          search_vector?: never
          stage?: Database["public"]["Enums"]["pitch_stage"]
          support_count?: number
          tagline: string
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
          website_url?: string
        }
        Update: {
          created_at?: string
          demo_url?: string
          description?: string
          disability_types?: Database["public"]["Enums"]["disability_type"][]
          feedback_count?: number
          funding_currency?: string
          funding_goal?: number | null
          id?: string
          is_open?: boolean
          needs?: Database["public"]["Enums"]["pitch_need"][]
          problem_id?: string | null
          search_vector?: never
          stage?: Database["public"]["Enums"]["pitch_stage"]
          support_count?: number
          tagline?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
          website_url?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          body: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      problem_bookmarks: {
        Row: {
          created_at: string
          problem_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          problem_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          problem_id?: string
          user_id?: string
        }
        Relationships: []
      }
      problem_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          problem_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          problem_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          problem_id?: string
          user_id?: string
        }
        Relationships: []
      }
      problem_media: {
        Row: {
          created_at: string
          description: string
          file_name: string
          id: string
          kind: Database["public"]["Enums"]["media_kind"]
          mime_type: string
          problem_id: string
          size_bytes: number
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          file_name: string
          id?: string
          kind: Database["public"]["Enums"]["media_kind"]
          mime_type: string
          problem_id: string
          size_bytes: number
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          file_name?: string
          id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          mime_type?: string
          problem_id?: string
          size_bytes?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      problem_reports: {
        Row: {
          created_at: string
          id: string
          problem_id: string
          reason: string
          resolved: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          problem_id: string
          reason: string
          resolved?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          problem_id?: string
          reason?: string
          resolved?: boolean
          user_id?: string
        }
        Relationships: []
      }
      problem_revisions: {
        Row: {
          created_at: string
          description: string
          editor_id: string | null
          id: string
          problem_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description: string
          editor_id?: string | null
          id?: string
          problem_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          editor_id?: string | null
          id?: string
          problem_id?: string
          title?: string
        }
        Relationships: []
      }
      problem_votes: {
        Row: {
          created_at: string
          problem_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          problem_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          problem_id?: string
          user_id?: string
        }
        Relationships: []
      }
      problems: {
        Row: {
          age_groups: Database["public"]["Enums"]["age_group"][]
          category: string
          comment_count: number
          country: string
          created_at: string
          description: string
          disability_types: Database["public"]["Enums"]["disability_type"][]
          document_urls: string[]
          existing_solutions: string
          id: string
          image_urls: string[]
          related_research: string[]
          search_vector: unknown | null
          severity: Database["public"]["Enums"]["severity_level"] | null
          status: Database["public"]["Enums"]["problem_status"]
          tags: string[]
          title: string
          updated_at: string
          user_id: string
          video_urls: string[]
          vote_count: number
        }
        Insert: {
          age_groups?: Database["public"]["Enums"]["age_group"][]
          category?: string
          comment_count?: number
          country?: string
          created_at?: string
          description: string
          disability_types?: Database["public"]["Enums"]["disability_type"][]
          document_urls?: string[]
          existing_solutions?: string
          id?: string
          image_urls?: string[]
          related_research?: string[]
          severity?: Database["public"]["Enums"]["severity_level"] | null
          status?: Database["public"]["Enums"]["problem_status"]
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
          video_urls?: string[]
          vote_count?: number
        }
        Update: {
          age_groups?: Database["public"]["Enums"]["age_group"][]
          category?: string
          comment_count?: number
          country?: string
          created_at?: string
          description?: string
          disability_types?: Database["public"]["Enums"]["disability_type"][]
          document_urls?: string[]
          existing_solutions?: string
          id?: string
          image_urls?: string[]
          related_research?: string[]
          severity?: Database["public"]["Enums"]["severity_level"] | null
          status?: Database["public"]["Enums"]["problem_status"]
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
          video_urls?: string[]
          vote_count?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      /**
       * Internal to the database: not executable by anon or authenticated, so
       * calling it through the API fails. Use is_admin() / is_moderator().
       */
      has_role: {
        Args: { _user_id: string; _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      /**
       * Helper behind the search_vector columns and a CHECK on
       * companion_routines. Callable because those expressions run with the
       * writer's privileges; there is no reason to call it from the app.
       */
      immutable_array_to_string: {
        Args: { _arr: string[]; _sep: string }
        Returns: string
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_moderator: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      mfa_satisfied: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      public_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          members: number
          problems: number
          countries: number
          opportunities: number
        }[]
      }
      search_problems: {
        Args: { _query: string; _limit?: number }
        Returns: {
          id: string
          title: string
          description: string
          vote_count: number
          status: Database["public"]["Enums"]["problem_status"]
          created_at: string
          rank: number
        }[]
      }
      send_contact_message: {
        Args: { _name: string; _email: string; _topic: string; _message: string }
        Returns: undefined
      }
      subscribe_to_newsletter: {
        Args: { _email: string }
        Returns: undefined
      }
    }
    Enums: {
      age_group:
        | "infant"
        | "child"
        | "adolescent"
        | "adult"
        | "older_adult"
        | "all_ages"
      app_role:
        | "person_with_disability"
        | "caregiver"
        | "parent"
        | "researcher"
        | "student"
        | "developer"
        | "designer"
        | "healthcare_professional"
        | "ngo"
        | "startup"
        | "company"
        | "university"
        | "government"
        | "volunteer"
        | "investor"
        | "mentor"
        | "admin"
        | "moderator"
      disability_type:
        | "visual"
        | "hearing"
        | "mobility"
        | "cognitive"
        | "speech"
        | "neurological"
        | "chronic_illness"
        | "mental_health"
        | "multiple"
        | "other"
      media_kind: "image" | "video" | "document"
      pitch_need:
        | "funding"
        | "mentorship"
        | "cofounder"
        | "testers"
        | "partners"
        | "feedback"
      pitch_stage: "idea" | "prototype" | "pilot" | "launched"
      problem_status: "open" | "in_progress" | "solved" | "archived"
      severity_level: "mild" | "moderate" | "severe" | "profound"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      age_group: [
        "infant",
        "child",
        "adolescent",
        "adult",
        "older_adult",
        "all_ages",
      ],
      app_role: [
        "person_with_disability",
        "caregiver",
        "parent",
        "researcher",
        "student",
        "developer",
        "designer",
        "healthcare_professional",
        "ngo",
        "startup",
        "company",
        "university",
        "government",
        "volunteer",
        "investor",
        "mentor",
        "admin",
        "moderator",
      ],
      disability_type: [
        "visual",
        "hearing",
        "mobility",
        "cognitive",
        "speech",
        "neurological",
        "chronic_illness",
        "mental_health",
        "multiple",
        "other",
      ],
      media_kind: ["image", "video", "document"],
      pitch_need: [
        "funding",
        "mentorship",
        "cofounder",
        "testers",
        "partners",
        "feedback",
      ],
      pitch_stage: ["idea", "prototype", "pilot", "launched"],
      problem_status: ["open", "in_progress", "solved", "archived"],
      severity_level: ["mild", "moderate", "severe", "profound"],
    },
  },
} as const

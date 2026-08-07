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
          search_vector: unknown
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
      has_role: {
        Args: { _user_id: string; _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_moderator: {
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
      problem_status: ["open", "in_progress", "solved", "archived"],
      severity_level: ["mild", "moderate", "severe", "profound"],
    },
  },
} as const

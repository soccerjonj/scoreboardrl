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
      friend_requests: {
        Row: {
          created_at: string
          id: string
          receiver_auto_approve: boolean
          receiver_id: string
          sender_auto_approve: boolean
          sender_id: string
          status: Database["public"]["Enums"]["friend_request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_auto_approve?: boolean
          receiver_id: string
          sender_auto_approve?: boolean
          sender_id: string
          status?: Database["public"]["Enums"]["friend_request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          receiver_auto_approve?: boolean
          receiver_id?: string
          sender_auto_approve?: boolean
          sender_id?: string
          status?: Database["public"]["Enums"]["friend_request_status"]
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          payload: Json
          read: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          payload?: Json
          read?: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          payload?: Json
          read?: boolean
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      game_players: {
        Row: {
          assists: number
          carry_score: number | null
          created_at: string
          game_id: string
          goals: number
          id: string
          is_mvp: boolean
          player_name: string
          saves: number
          score: number
          shots: number
          submission_status: Database["public"]["Enums"]["stat_submission_status"]
          submitted_by: string | null
          team: string | null
          user_id: string | null
        }
        Insert: {
          assists?: number
          carry_score?: number | null
          created_at?: string
          game_id: string
          goals?: number
          id?: string
          is_mvp?: boolean
          player_name: string
          saves?: number
          score?: number
          shots?: number
          submission_status?: Database["public"]["Enums"]["stat_submission_status"]
          submitted_by?: string | null
          team?: string | null
          user_id?: string | null
        }
        Update: {
          assists?: number
          carry_score?: number | null
          created_at?: string
          game_id?: string
          goals?: number
          id?: string
          is_mvp?: boolean
          player_name?: string
          saves?: number
          score?: number
          shots?: number
          submission_status?: Database["public"]["Enums"]["stat_submission_status"]
          submitted_by?: string | null
          team?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          created_at: string
          created_by: string
          division_change: string | null
          duplicate_of: string | null
          game_mode: Database["public"]["Enums"]["game_mode"]
          game_type: Database["public"]["Enums"]["game_type"]
          id: string
          played_at: string
          result: string
          screenshot_url: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          division_change?: string | null
          duplicate_of?: string | null
          game_mode: Database["public"]["Enums"]["game_mode"]
          game_type?: Database["public"]["Enums"]["game_type"]
          id?: string
          played_at?: string
          result: string
          screenshot_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          division_change?: string | null
          duplicate_of?: string | null
          game_mode?: Database["public"]["Enums"]["game_mode"]
          game_type?: Database["public"]["Enums"]["game_type"]
          id?: string
          played_at?: string
          result?: string
          screenshot_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          rl_account_name: string | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          rl_account_name?: string | null
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          rl_account_name?: string | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      ranks: {
        Row: {
          created_at: string
          game_mode: Database["public"]["Enums"]["game_mode"]
          game_type: Database["public"]["Enums"]["game_type"]
          id: string
          mmr: number | null
          rank_division: Database["public"]["Enums"]["rank_division"] | null
          rank_tier: Database["public"]["Enums"]["rank_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          game_mode: Database["public"]["Enums"]["game_mode"]
          game_type?: Database["public"]["Enums"]["game_type"]
          id?: string
          mmr?: number | null
          rank_division?: Database["public"]["Enums"]["rank_division"] | null
          rank_tier?: Database["public"]["Enums"]["rank_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          game_mode?: Database["public"]["Enums"]["game_mode"]
          game_type?: Database["public"]["Enums"]["game_type"]
          id?: string
          mmr?: number | null
          rank_division?: Database["public"]["Enums"]["rank_division"] | null
          rank_tier?: Database["public"]["Enums"]["rank_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      friend_request_status: "pending" | "accepted" | "rejected"
      game_mode: "1v1" | "2v2" | "3v3"
      game_type: "competitive" | "casual"
      notification_type: "game_shared" | "stat_conflict" | "stat_edit" | "friend_request"
      rank_division: "I" | "II" | "III" | "IV"
      rank_tier:
        | "unranked"
        | "bronze_1"
        | "bronze_2"
        | "bronze_3"
        | "silver_1"
        | "silver_2"
        | "silver_3"
        | "gold_1"
        | "gold_2"
        | "gold_3"
        | "platinum_1"
        | "platinum_2"
        | "platinum_3"
        | "diamond_1"
        | "diamond_2"
        | "diamond_3"
        | "champion_1"
        | "champion_2"
        | "champion_3"
        | "grand_champion_1"
        | "grand_champion_2"
        | "grand_champion_3"
        | "supersonic_legend"
      stat_submission_status: "pending" | "approved" | "rejected"
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
      friend_request_status: ["pending", "accepted", "rejected"],
      game_mode: ["1v1", "2v2", "3v3"],
      game_type: ["competitive", "casual"],
      notification_type: ["game_shared", "stat_conflict", "stat_edit", "friend_request"],
      rank_division: ["I", "II", "III", "IV"],
      rank_tier: [
        "unranked",
        "bronze_1",
        "bronze_2",
        "bronze_3",
        "silver_1",
        "silver_2",
        "silver_3",
        "gold_1",
        "gold_2",
        "gold_3",
        "platinum_1",
        "platinum_2",
        "platinum_3",
        "diamond_1",
        "diamond_2",
        "diamond_3",
        "champion_1",
        "champion_2",
        "champion_3",
        "grand_champion_1",
        "grand_champion_2",
        "grand_champion_3",
        "supersonic_legend",
      ],
      stat_submission_status: ["pending", "approved", "rejected"],
    },
  },
} as const

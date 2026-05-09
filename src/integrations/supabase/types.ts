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
      game_players: {
        Row: {
          assists: number
          carry_score: number | null
          created_at: string
          damage: number | null
          game_id: string
          goals: number
          id: string
          is_mvp: boolean
          mmr: number | null
          mmr_change: number | null
          player_name: string
          rank_division: Database["public"]["Enums"]["rank_division"] | null
          rank_tier: Database["public"]["Enums"]["rank_tier"] | null
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
          damage?: number | null
          game_id: string
          goals?: number
          id?: string
          is_mvp?: boolean
          mmr?: number | null
          mmr_change?: number | null
          player_name: string
          rank_division?: Database["public"]["Enums"]["rank_division"] | null
          rank_tier?: Database["public"]["Enums"]["rank_tier"] | null
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
          damage?: number | null
          game_id?: string
          goals?: number
          id?: string
          is_mvp?: boolean
          mmr?: number | null
          mmr_change?: number | null
          player_name?: string
          rank_division?: Database["public"]["Enums"]["rank_division"] | null
          rank_tier?: Database["public"]["Enums"]["rank_tier"] | null
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
          logged_via_photo: boolean
          played_at: string
          result: string
          screenshot_url: string | null
          tournament_type: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          division_change?: string | null
          duplicate_of?: string | null
          game_mode: Database["public"]["Enums"]["game_mode"]
          game_type?: Database["public"]["Enums"]["game_type"]
          id?: string
          logged_via_photo?: boolean
          played_at?: string
          result: string
          screenshot_url?: string | null
          tournament_type?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          division_change?: string | null
          duplicate_of?: string | null
          game_mode?: Database["public"]["Enums"]["game_mode"]
          game_type?: Database["public"]["Enums"]["game_type"]
          id?: string
          logged_via_photo?: boolean
          played_at?: string
          result?: string
          screenshot_url?: string | null
          tournament_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          payload: Json | null
          read: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          read?: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          read?: boolean
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      parse_usage: {
        Row: {
          id: string
          user_id: string
          month: string
          parse_count: number
        }
        Insert: {
          id?: string
          user_id: string
          month: string
          parse_count?: number
        }
        Update: {
          id?: string
          user_id?: string
          month?: string
          parse_count?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          tier: Database["public"]["Enums"]["subscription_tier"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tier?: Database["public"]["Enums"]["subscription_tier"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tier?: Database["public"]["Enums"]["subscription_tier"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          created_at: string
          favorite_car: string | null
          id: string
          rl_account_name: string | null
          show_on_leaderboard: boolean
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          favorite_car?: string | null
          id?: string
          rl_account_name?: string | null
          show_on_leaderboard?: boolean
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          favorite_car?: string | null
          id?: string
          rl_account_name?: string | null
          show_on_leaderboard?: boolean
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      tournament_games: {
        Row: {
          created_at: string
          game_id: string
          game_number: number
          id: string
          round: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          game_number?: number
          id?: string
          round: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          game_id?: string
          game_number?: number
          id?: string
          round?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_games_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_games_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string
          current_round: string
          game_mode: Database["public"]["Enums"]["game_mode"]
          id: string
          outcome: string | null
          status: string
          tournament_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_round?: string
          game_mode: Database["public"]["Enums"]["game_mode"]
          id?: string
          outcome?: string | null
          status?: string
          tournament_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_round?: string
          game_mode?: Database["public"]["Enums"]["game_mode"]
          id?: string
          outcome?: string | null
          status?: string
          tournament_type?: string
          user_id?: string
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
      seasons: {
        Row: {
          id: string
          number: number
          name: string
          starts_at: string
          ends_at: string | null
          is_current: boolean
          created_at: string
        }
        Insert: {
          id?: string
          number: number
          name: string
          starts_at: string
          ends_at?: string | null
          is_current?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          number?: number
          name?: string
          starts_at?: string
          ends_at?: string | null
          is_current?: boolean
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_leaderboard: {
        Args: { p_window: string; p_stat?: string }
        Returns: Array<{
          user_id: string
          rl_name: string
          avatar_url: string | null
          stat_value: number
          rank: number
        }>
      }
      increment_parse_count: {
        Args: { p_user_id: string; p_month: string; p_quota: number }
        Returns: { allowed: boolean; count: number }
      }
    }
    Enums: {
      friend_request_status: "pending" | "accepted" | "rejected"
      subscription_tier: "free" | "pro" | "lifetime"
      game_mode: "1v1" | "2v2" | "3v3" | "4v4" | "rumble_3v3" | "hoops_2v2" | "snowday_3v3" | "dropshot_3v3" | "heatseeker_2v2"
      game_type: "competitive" | "casual" | "tournament"
      notification_type:
        | "game_shared"
        | "stat_conflict"
        | "stat_edit"
        | "friend_request"
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
      game_mode: ["1v1", "2v2", "3v3", "4v4"],
      game_type: ["competitive", "casual"],
      notification_type: [
        "game_shared",
        "stat_conflict",
        "stat_edit",
        "friend_request",
      ],
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

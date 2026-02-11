export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          chips: number;
          is_admin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username?: string;
          chips?: number;
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          chips?: number;
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      game_history: {
        Row: {
          id: string;
          user_id: string;
          game_type: Database["public"]["Enums"]["game_type"];
          bet_amount: number;
          payout: number;
          multiplier: number;
          result_data: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          game_type: Database["public"]["Enums"]["game_type"];
          bet_amount: number;
          payout: number;
          multiplier: number;
          result_data?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          game_type?: Database["public"]["Enums"]["game_type"];
          bet_amount?: number;
          payout?: number;
          multiplier?: number;
          result_data?: Json;
          created_at?: string;
        };
      };
      leaderboard_cache: {
        Row: {
          id: string;
          user_id: string;
          username: string;
          game_type: Database["public"]["Enums"]["game_type"] | "all";
          period: "weekly" | "monthly" | "alltime";
          metric: "biggest_win" | "total_wagered" | "most_played" | "highest_multiplier";
          value: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          username: string;
          game_type: Database["public"]["Enums"]["game_type"] | "all";
          period: "weekly" | "monthly" | "alltime";
          metric: "biggest_win" | "total_wagered" | "most_played" | "highest_multiplier";
          value: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          username?: string;
          game_type?: Database["public"]["Enums"]["game_type"] | "all";
          period?: "weekly" | "monthly" | "alltime";
          metric?: "biggest_win" | "total_wagered" | "most_played" | "highest_multiplier";
          value?: number;
          updated_at?: string;
        };
      };
      settings: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          updated_at?: string;
        };
      };
    };
    Enums: {
      game_type: "slots" | "dice" | "crash" | "roulette" | "poker" | "blackjack";
    };
  };
}

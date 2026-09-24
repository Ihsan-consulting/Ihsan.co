export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      action_items: {
        Row: {
          assignee_email: string | null
          assignee_name: string | null
          assignee_team: string | null
          completed: boolean
          created_at: string
          description: string
          id: string
          recording_id: number
          recording_playback_url: string | null
          recording_timestamp: string | null
          user_generated: boolean | null
        }
        Insert: {
          assignee_email?: string | null
          assignee_name?: string | null
          assignee_team?: string | null
          completed?: boolean
          created_at?: string
          description: string
          id?: string
          recording_id: number
          recording_playback_url?: string | null
          recording_timestamp?: string | null
          user_generated?: boolean | null
        }
        Update: {
          assignee_email?: string | null
          assignee_name?: string | null
          assignee_team?: string | null
          completed?: boolean
          created_at?: string
          description?: string
          id?: string
          recording_id?: number
          recording_playback_url?: string | null
          recording_timestamp?: string | null
          user_generated?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "action_items_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["recording_id"]
          },
        ]
      }
      deliveries: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          error: string | null
          id: string
          recording_id: number
          sent_at: string | null
          status: string
          target: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          recording_id: number
          sent_at?: string | null
          status?: string
          target?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          recording_id?: number
          sent_at?: string | null
          status?: string
          target?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["recording_id"]
          },
        ]
      }
      meeting_insights: {
        Row: {
          created_at: string
          executive_summary: string | null
          headline: string | null
          id: string
          key_decisions: Json
          language: string
          model: string
          next_steps: Json
          raw_response: string | null
          recording_id: number
          risks: Json
          sentiment: string | null
        }
        Insert: {
          created_at?: string
          executive_summary?: string | null
          headline?: string | null
          id?: string
          key_decisions?: Json
          language?: string
          model: string
          next_steps?: Json
          raw_response?: string | null
          recording_id: number
          risks?: Json
          sentiment?: string | null
        }
        Update: {
          created_at?: string
          executive_summary?: string | null
          headline?: string | null
          id?: string
          key_decisions?: Json
          language?: string
          model?: string
          next_steps?: Json
          raw_response?: string | null
          recording_id?: number
          risks?: Json
          sentiment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_insights_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["recording_id"]
          },
        ]
      }
      meeting_invitees: {
        Row: {
          email: string | null
          id: string
          is_external: boolean | null
          name: string | null
          recording_id: number
        }
        Insert: {
          email?: string | null
          id?: string
          is_external?: boolean | null
          name?: string | null
          recording_id: number
        }
        Update: {
          email?: string | null
          id?: string
          is_external?: boolean | null
          name?: string | null
          recording_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "meeting_invitees_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["recording_id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          crm_matches: Json | null
          default_summary_markdown: string | null
          default_summary_template: string | null
          meeting_url: string | null
          recorded_by_email: string | null
          recorded_by_name: string | null
          recorded_by_team: string | null
          recording_end_time: string | null
          recording_id: number
          recording_start_time: string | null
          scheduled_end_time: string | null
          scheduled_start_time: string | null
          share_url: string | null
          shared_with: string | null
          title: string
          transcript: Json | null
          transcript_language: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          crm_matches?: Json | null
          default_summary_markdown?: string | null
          default_summary_template?: string | null
          meeting_url?: string | null
          recorded_by_email?: string | null
          recorded_by_name?: string | null
          recorded_by_team?: string | null
          recording_end_time?: string | null
          recording_id: number
          recording_start_time?: string | null
          scheduled_end_time?: string | null
          scheduled_start_time?: string | null
          share_url?: string | null
          shared_with?: string | null
          title: string
          transcript?: Json | null
          transcript_language?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          crm_matches?: Json | null
          default_summary_markdown?: string | null
          default_summary_template?: string | null
          meeting_url?: string | null
          recorded_by_email?: string | null
          recorded_by_name?: string | null
          recorded_by_team?: string | null
          recording_end_time?: string | null
          recording_id?: number
          recording_start_time?: string | null
          scheduled_end_time?: string | null
          scheduled_start_time?: string | null
          share_url?: string | null
          shared_with?: string | null
          title?: string
          transcript?: Json | null
          transcript_language?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          event_type: string
          id: string
          payload: Json
          process_error: string | null
          processed_at: string | null
          received_at: string
          recording_id: number | null
          signature_verified: boolean
          webhook_id: string
        }
        Insert: {
          event_type?: string
          id?: string
          payload: Json
          process_error?: string | null
          processed_at?: string | null
          received_at?: string
          recording_id?: number | null
          signature_verified?: boolean
          webhook_id: string
        }
        Update: {
          event_type?: string
          id?: string
          payload?: Json
          process_error?: string | null
          processed_at?: string | null
          received_at?: string
          recording_id?: number | null
          signature_verified?: boolean
          webhook_id?: string
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
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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

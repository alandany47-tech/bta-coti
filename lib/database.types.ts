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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          payload: Json
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_terms: {
        Row: {
          created_at: string
          kind: string
          term: string
        }
        Insert: {
          created_at?: string
          kind: string
          term: string
        }
        Update: {
          created_at?: string
          kind?: string
          term?: string
        }
        Relationships: []
      }
      blocked_terms_allow: {
        Row: {
          created_at: string
          created_by: string | null
          reason: string | null
          slug: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          reason?: string | null
          slug: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          reason?: string | null
          slug?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocked_terms_allow_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      disposable_email_domains: {
        Row: {
          added_at: string
          domain: string
        }
        Insert: {
          added_at?: string
          domain: string
        }
        Update: {
          added_at?: string
          domain?: string
        }
        Relationships: []
      }
      items: {
        Row: {
          attrs: Json
          category: string | null
          created_at: string
          description: string | null
          floor_plan_url: string | null
          id: string
          images: string[]
          kind: string
          price: number
          sku: string | null
          sort: number
          status: string
          tenant_id: string
          title: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          attrs?: Json
          category?: string | null
          created_at?: string
          description?: string | null
          floor_plan_url?: string | null
          id?: string
          images?: string[]
          kind: string
          price?: number
          sku?: string | null
          sort?: number
          status?: string
          tenant_id: string
          title: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          attrs?: Json
          category?: string | null
          created_at?: string
          description?: string | null
          floor_plan_url?: string | null
          id?: string
          images?: string[]
          kind?: string
          price?: number
          sku?: string | null
          sort?: number
          status?: string
          tenant_id?: string
          title?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          bytes: number
          content_type: string
          created_at: string
          height: number | null
          id: string
          item_id: string | null
          kind: string
          r2_key: string
          sort: number
          status: string
          tenant_id: string
          thumb_bytes: number
          thumb_key: string | null
          width: number | null
        }
        Insert: {
          bytes: number
          content_type: string
          created_at?: string
          height?: number | null
          id?: string
          item_id?: string | null
          kind: string
          r2_key: string
          sort?: number
          status?: string
          tenant_id: string
          thumb_bytes?: number
          thumb_key?: string | null
          width?: number | null
        }
        Update: {
          bytes?: number
          content_type?: string
          created_at?: string
          height?: number | null
          id?: string
          item_id?: string | null
          kind?: string
          r2_key?: string
          sort?: number
          status?: string
          tenant_id?: string
          thumb_bytes?: number
          thumb_key?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          channel: string
          module: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          body: string
          channel?: string
          module: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: string
          module?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          code: string
          id: string
          limits: Json
          modules: string[]
          name: string
          price_month: number
          price_year: number
          public: boolean
          sort: number
          stripe_price_month: string | null
          stripe_price_year: string | null
        }
        Insert: {
          code: string
          id?: string
          limits?: Json
          modules?: string[]
          name: string
          price_month?: number
          price_year?: number
          public?: boolean
          sort?: number
          stripe_price_month?: string | null
          stripe_price_year?: string | null
        }
        Update: {
          code?: string
          id?: string
          limits?: Json
          modules?: string[]
          name?: string
          price_month?: number
          price_year?: number
          public?: boolean
          sort?: number
          stripe_price_month?: string | null
          stripe_price_year?: string | null
        }
        Relationships: []
      }
      quotes: {
        Row: {
          client_id: string | null
          client_name: string
          client_phone: string
          created_at: string
          created_by: string | null
          discount_pct: number
          down_payment_amount: number
          down_payment_pct: number
          expires_at: string | null
          final_payment_amount: number
          id: string
          installments_count: number
          last_viewed_at: string | null
          monthly_payment_amount: number
          notes: string | null
          number: number
          property_id: string | null
          share_token: string
          snapshot: Json
          status: string
          tenant_id: string
          total_amount: number
          views: number
        }
        Insert: {
          client_id?: string | null
          client_name: string
          client_phone: string
          created_at?: string
          created_by?: string | null
          discount_pct?: number
          down_payment_amount?: number
          down_payment_pct?: number
          expires_at?: string | null
          final_payment_amount?: number
          id?: string
          installments_count?: number
          last_viewed_at?: string | null
          monthly_payment_amount?: number
          notes?: string | null
          number: number
          property_id?: string | null
          share_token?: string
          snapshot: Json
          status?: string
          tenant_id: string
          total_amount?: number
          views?: number
        }
        Update: {
          client_id?: string | null
          client_name?: string
          client_phone?: string
          created_at?: string
          created_by?: string | null
          discount_pct?: number
          down_payment_amount?: number
          down_payment_pct?: number
          expires_at?: string | null
          final_payment_amount?: number
          id?: string
          installments_count?: number
          last_viewed_at?: string | null
          monthly_payment_amount?: number
          notes?: string | null
          number?: number
          property_id?: string | null
          share_token?: string
          snapshot?: Json
          status?: string
          tenant_id?: string
          total_amount?: number
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rpc_rate_limit: {
        Row: {
          bucket: string
          hits: number
          key: string
          window_start: string
        }
        Insert: {
          bucket: string
          hits?: number
          key: string
          window_start: string
        }
        Update: {
          bucket?: string
          hits?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      tenant_members: {
        Row: {
          created_at: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          billing_mode: string
          brand_color: string
          created_at: string
          flagged: boolean
          id: string
          is_demo: boolean
          logo_url: string | null
          name: string
          notes: string | null
          plan_id: string
          settings: Json
          slug: string
          source: string | null
          status: string
          status_reason: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          theme: Json
          trial_ends_at: string | null
        }
        Insert: {
          billing_mode?: string
          brand_color?: string
          created_at?: string
          flagged?: boolean
          id?: string
          is_demo?: boolean
          logo_url?: string | null
          name: string
          notes?: string | null
          plan_id: string
          settings?: Json
          slug: string
          source?: string | null
          status?: string
          status_reason?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          theme?: Json
          trial_ends_at?: string | null
        }
        Update: {
          billing_mode?: string
          brand_color?: string
          created_at?: string
          flagged?: boolean
          id?: string
          is_demo?: boolean
          logo_url?: string | null
          name?: string
          notes?: string | null
          plan_id?: string
          settings?: Json
          slug?: string
          source?: string | null
          status?: string
          status_reason?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          theme?: Json
          trial_ends_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      usage: {
        Row: {
          items_count: number
          month_key: string
          quotes_this_month: number
          storage_bytes: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          items_count?: number
          month_key?: string
          quotes_this_month?: number
          storage_bytes?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          items_count?: number
          month_key?: string
          quotes_this_month?: number
          storage_bytes?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _demo_image: { Args: { p_n: number; p_slug: string }; Returns: string }
      _demo_quote: {
        Args: {
          p_client: string
          p_creator: string
          p_days_ago: number
          p_discount: number
          p_down: number
          p_final: number
          p_n: number
          p_notes: string
          p_sku: string
          p_status: string
          p_tenant: string
          p_views: number
        }
        Returns: undefined
      }
      _demo_user: {
        Args: { p_email: string; p_name: string; p_password: string }
        Returns: string
      }
      _slug_forms: { Args: { p_text: string }; Returns: string[] }
      _terms_hit: { Args: { p_forms: string[] }; Returns: boolean }
      admin_user_id_by_email: { Args: { p_email: string }; Returns: string }
      attach_media_url: {
        Args: {
          p_item: string
          p_kind: string
          p_tenant: string
          p_url: string
        }
        Returns: {
          floor_plan_url: string
          images: string[]
        }[]
      }
      can_read: {
        Args: { p_min_role?: string; p_tenant_id: string }
        Returns: boolean
      }
      can_write: {
        Args: { p_min_role?: string; p_tenant_id: string }
        Returns: boolean
      }
      check_rpc_rate_limit: {
        Args: {
          p_bucket: string
          p_key: string
          p_limit: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      clone_demo_items: {
        Args: { p_source: string; p_target: string }
        Returns: number
      }
      clone_demo_tenant: {
        Args: {
          p_name: string
          p_owner: string
          p_slug: string
          p_source: string
          p_trial_days: number
        }
        Returns: string
      }
      confirm_media: {
        Args: {
          p_bytes: number
          p_id: string
          p_tenant: string
          p_thumb_bytes: number
        }
        Returns: undefined
      }
      default_message_template: { Args: { p_module: string }; Returns: string }
      delete_media: {
        Args: { p_id: string; p_tenant: string }
        Returns: {
          r2_key: string
          thumb_key: string
        }[]
      }
      detach_media_url: {
        Args: { p_tenant: string; p_url: string }
        Returns: undefined
      }
      effective_limit: {
        Args: { p_key: string; p_tenant: string }
        Returns: number
      }
      expire_trials: {
        Args: never
        Returns: {
          slug: string
          tenant_id: string
        }[]
      }
      get_quote_tenant_slug: { Args: { p_token: string }; Returns: string }
      get_shared_quote: {
        Args: { p_token: string }
        Returns: {
          brand_color: string
          expired: boolean
          expires_at: string
          number: number
          snapshot: Json
          status: string
          tenant_logo_url: string
          tenant_name: string
          tenant_slug: string
          views: number
        }[]
      }
      is_app_admin: { Args: never; Returns: boolean }
      is_disposable_email: { Args: { p_email: string }; Returns: boolean }
      is_member: {
        Args: { p_min_role?: string; p_tenant_id: string }
        Returns: boolean
      }
      is_slug_blocked: { Args: { p_slug: string }; Returns: boolean }
      is_slug_reserved: { Args: { p_slug: string }; Returns: boolean }
      is_slug_valid: { Args: { p_slug: string }; Returns: boolean }
      is_text_flagged: { Args: { p_text: string }; Returns: boolean }
      normalize_slug: { Args: { p_text: string }; Returns: string }
      orphan_media_keys: { Args: { p_keys: string[] }; Returns: string[] }
      provision_tenant: {
        Args: {
          p_billing_mode?: string
          p_name: string
          p_owner: string
          p_plan_code: string
          p_slug: string
          p_source: string
          p_status: string
          p_trial_days: number
        }
        Returns: string
      }
      purge_stale_pending_media: {
        Args: { p_older_than?: unknown }
        Returns: {
          r2_key: string
          thumb_key: string
        }[]
      }
      request_ip: { Args: never; Returns: string }
      reserve_media: {
        Args: {
          p_bytes: number
          p_content_type: string
          p_height: number
          p_item: string
          p_kind: string
          p_tenant: string
          p_thumb_bytes: number
          p_width: number
        }
        Returns: {
          id: string
          r2_key: string
          thumb_key: string
        }[]
      }
      reset_demo_data: { Args: { p_password: string }; Returns: undefined }
      reset_monthly_quotes: { Args: never; Returns: number }
      rpc_limit_ok: {
        Args: { p_bucket: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      set_tenant_status: {
        Args: {
          p_actor: string
          p_reason: string
          p_status: string
          p_tenant: string
        }
        Returns: string
      }
      slug_available: { Args: { p_slug: string }; Returns: boolean }
      tenant_from_path: { Args: { p_name: string }; Returns: string }
      tenant_modules: { Args: { p_tenant: string }; Returns: string[] }
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

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

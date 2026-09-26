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
            foreignKeyName: "media_tenant_id_fkey"
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
      properties: {
        Row: {
          created_at: string
          floor_plan_url: string | null
          id: string
          images: string[]
          list_price: number
          m2_exterior: number
          m2_interior: number
          m2_total: number
          parking_spaces: number
          status: string
          tenant_id: string
          title: string
          unit_number: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          floor_plan_url?: string | null
          id?: string
          images?: string[]
          list_price?: number
          m2_exterior?: number
          m2_interior?: number
          m2_total?: number
          parking_spaces?: number
          status?: string
          tenant_id: string
          title: string
          unit_number: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          floor_plan_url?: string | null
          id?: string
          images?: string[]
          list_price?: number
          m2_exterior?: number
          m2_interior?: number
          m2_total?: number
          parking_spaces?: number
          status?: string
          tenant_id?: string
          title?: string
          unit_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          client_id: string | null
          client_name: string
          client_phone: string
          created_at: string
          discount_pct: number
          down_payment_amount: number
          down_payment_pct: number
          final_payment_amount: number
          id: string
          installments_count: number
          monthly_payment_amount: number
          notes: string | null
          pdf_url: string | null
          property_id: string | null
          status: string
          tenant_id: string
          total_amount: number
        }
        Insert: {
          client_id?: string | null
          client_name: string
          client_phone: string
          created_at?: string
          discount_pct?: number
          down_payment_amount?: number
          down_payment_pct?: number
          final_payment_amount?: number
          id?: string
          installments_count?: number
          monthly_payment_amount?: number
          notes?: string | null
          pdf_url?: string | null
          property_id?: string | null
          status?: string
          tenant_id: string
          total_amount?: number
        }
        Update: {
          client_id?: string | null
          client_name?: string
          client_phone?: string
          created_at?: string
          discount_pct?: number
          down_payment_amount?: number
          down_payment_pct?: number
          final_payment_amount?: number
          id?: string
          installments_count?: number
          monthly_payment_amount?: number
          notes?: string | null
          pdf_url?: string | null
          property_id?: string | null
          status?: string
          tenant_id?: string
          total_amount?: number
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
            referencedRelation: "properties"
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
      confirm_media: {
        Args: {
          p_bytes: number
          p_id: string
          p_tenant: string
          p_thumb_bytes: number
        }
        Returns: undefined
      }
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

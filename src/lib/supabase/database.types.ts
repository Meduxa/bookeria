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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          entity: string
          entity_id: string | null
          id: string
          ip: unknown
          meta: Json
          tenant_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          entity: string
          entity_id?: string | null
          id?: string
          ip?: unknown
          meta?: Json
          tenant_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          ip?: unknown
          meta?: Json
          tenant_id?: string
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
      client_consents: {
        Row: {
          at: string
          channel: string
          client_id: string
          granted: boolean
          id: string
          purpose: string
          recorded_by: string | null
          source: string
          tenant_id: string
        }
        Insert: {
          at?: string
          channel: string
          client_id: string
          granted: boolean
          id?: string
          purpose?: string
          recorded_by?: string | null
          source: string
          tenant_id: string
        }
        Update: {
          at?: string
          channel?: string
          client_id?: string
          granted?: boolean
          id?: string
          purpose?: string
          recorded_by?: string | null
          source?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_consents_client_id_tenant_id_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "client_consents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          anonymized_at: string | null
          birthday: string | null
          blocked_online: boolean
          created_at: string
          created_by: string | null
          email: string | null
          first_name: string
          gender: string | null
          id: string
          important_note: string | null
          last_name: string | null
          no_show_count: number
          notes: string | null
          phone_e164: string | null
          preferred_staff_id: string | null
          source: string | null
          tags: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          anonymized_at?: string | null
          birthday?: string | null
          blocked_online?: boolean
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name: string
          gender?: string | null
          id?: string
          important_note?: string | null
          last_name?: string | null
          no_show_count?: number
          notes?: string | null
          phone_e164?: string | null
          preferred_staff_id?: string | null
          source?: string | null
          tags?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          anonymized_at?: string | null
          birthday?: string | null
          blocked_online?: boolean
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          important_note?: string | null
          last_name?: string | null
          no_show_count?: number
          notes?: string | null
          phone_e164?: string | null
          preferred_staff_id?: string | null
          source?: string | null
          tags?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_preferred_staff_id_tenant_id_fkey"
            columns: ["preferred_staff_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      closures: {
        Row: {
          created_at: string
          date: string
          id: string
          location_id: string | null
          reason: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          location_id?: string | null
          reason?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          location_id?: string | null
          reason?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "closures_location_id_tenant_id_fkey"
            columns: ["location_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "closures_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          revoked_at: string | null
          role: string
          tenant_id: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role: string
          tenant_id: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: string
          tenant_id?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      location_hours: {
        Row: {
          created_at: string
          end_time: string
          id: string
          location_id: string
          start_time: string
          tenant_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          location_id: string
          start_time: string
          tenant_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          location_id?: string
          start_time?: string
          tenant_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "location_hours_location_id_tenant_id_fkey"
            columns: ["location_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "location_hours_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          id: string
          is_primary: boolean
          name: string
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          name: string
          phone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          role: string
          staff_id: string | null
          status: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          staff_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          staff_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_staff_fk"
            columns: ["staff_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          locale: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      resources: {
        Row: {
          active: boolean
          created_at: string
          id: string
          location_id: string | null
          name: string
          sort_order: number
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          location_id?: string | null
          name: string
          sort_order?: number
          tenant_id: string
          type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          location_id?: string | null
          name?: string
          sort_order?: number
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_location_id_tenant_id_fkey"
            columns: ["location_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "resources_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_addons: {
        Row: {
          created_at: string
          duration_min: number
          id: string
          name_i18n: Json
          price_minor: number
          service_id: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_min?: number
          id?: string
          name_i18n: Json
          price_minor: number
          service_id: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_min?: number
          id?: string
          name_i18n?: Json
          price_minor?: number
          service_id?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_addons_service_id_tenant_id_fkey"
            columns: ["service_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "service_addons_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string
          id: string
          name_i18n: Json
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name_i18n: Json
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name_i18n?: Json
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_variants: {
        Row: {
          created_at: string
          duration_min: number
          id: string
          name_i18n: Json
          price_minor: number
          service_id: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_min: number
          id?: string
          name_i18n: Json
          price_minor: number
          service_id: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_min?: number
          id?: string
          name_i18n?: Json
          price_minor?: number
          service_id?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_variants_service_id_tenant_id_fkey"
            columns: ["service_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "service_variants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          bookable_online: boolean
          buffer_after_min: number
          category_id: string | null
          color: string | null
          created_at: string
          currency: string
          deposit_type: string
          deposit_value: number
          description_i18n: Json
          duration_min: number
          id: string
          name_i18n: Json
          price_max_minor: number | null
          price_minor: number
          price_type: string
          resource_type: string | null
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          bookable_online?: boolean
          buffer_after_min?: number
          category_id?: string | null
          color?: string | null
          created_at?: string
          currency?: string
          deposit_type?: string
          deposit_value?: number
          description_i18n?: Json
          duration_min: number
          id?: string
          name_i18n: Json
          price_max_minor?: number | null
          price_minor: number
          price_type?: string
          resource_type?: string | null
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          bookable_online?: boolean
          buffer_after_min?: number
          category_id?: string | null
          color?: string | null
          created_at?: string
          currency?: string
          deposit_type?: string
          deposit_value?: number
          description_i18n?: Json
          duration_min?: number
          id?: string
          name_i18n?: Json
          price_max_minor?: number | null
          price_minor?: number
          price_type?: string
          resource_type?: string | null
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_tenant_id_fkey"
            columns: ["category_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          active: boolean
          bio: string | null
          bookable_online: boolean
          color: string
          commission_pct: number
          created_at: string
          display_name: string
          email: string | null
          id: string
          location_id: string | null
          phone: string | null
          photo_path: string | null
          position: string | null
          position_type: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          bio?: string | null
          bookable_online?: boolean
          color?: string
          commission_pct?: number
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          location_id?: string | null
          phone?: string | null
          photo_path?: string | null
          position?: string | null
          position_type?: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          bio?: string | null
          bookable_online?: boolean
          color?: string
          commission_pct?: number
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          location_id?: string | null
          phone?: string | null
          photo_path?: string | null
          position?: string | null
          position_type?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_location_id_tenant_id_fkey"
            columns: ["location_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "staff_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_schedule_overrides: {
        Row: {
          created_at: string
          date: string
          end_time: string | null
          id: string
          is_day_off: boolean
          staff_id: string
          start_time: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          end_time?: string | null
          id?: string
          is_day_off?: boolean
          staff_id: string
          start_time?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string | null
          id?: string
          is_day_off?: boolean
          staff_id?: string
          start_time?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_schedule_overrides_staff_id_tenant_id_fkey"
            columns: ["staff_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "staff_schedule_overrides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_schedules: {
        Row: {
          created_at: string
          end_time: string
          id: string
          staff_id: string
          start_time: string
          tenant_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          staff_id: string
          start_time: string
          tenant_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          staff_id?: string
          start_time?: string
          tenant_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "staff_schedules_staff_id_tenant_id_fkey"
            columns: ["staff_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "staff_schedules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_services: {
        Row: {
          created_at: string
          duration_min_override: number | null
          id: string
          price_minor_override: number | null
          service_id: string
          staff_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_min_override?: number | null
          id?: string
          price_minor_override?: number | null
          service_id: string
          staff_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_min_override?: number | null
          id?: string
          price_minor_override?: number | null
          service_id?: string
          staff_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_services_service_id_tenant_id_fkey"
            columns: ["service_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "staff_services_staff_id_tenant_id_fkey"
            columns: ["staff_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "staff_services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          cancel_window_min: number
          created_at: string
          email: string | null
          max_days_ahead: number
          min_notice_min: number
          online_requires_approval: boolean
          phone: string | null
          slot_step_min: number
          staff_sees_all_bookings: boolean
          staff_sees_all_clients: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cancel_window_min?: number
          created_at?: string
          email?: string | null
          max_days_ahead?: number
          min_notice_min?: number
          online_requires_approval?: boolean
          phone?: string | null
          slot_step_min?: number
          staff_sees_all_bookings?: boolean
          staff_sees_all_clients?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cancel_window_min?: number
          created_at?: string
          email?: string | null
          max_days_ahead?: number
          min_notice_min?: number
          online_requires_approval?: boolean
          phone?: string | null
          slot_step_min?: number
          staff_sees_all_bookings?: boolean
          staff_sees_all_clients?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          id: string
          locale_default: string
          name: string
          plan: string
          settings: Json
          slug: string
          status: string
          timezone: string
          trial_ends_at: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          locale_default?: string
          name: string
          plan?: string
          settings?: Json
          slug: string
          status?: string
          timezone?: string
          trial_ends_at?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          locale_default?: string
          name?: string
          plan?: string
          settings?: Json
          slug?: string
          status?: string
          timezone?: string
          trial_ends_at?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      time_off: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          note: string | null
          reason: string
          staff_id: string
          starts_at: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          note?: string | null
          reason?: string
          staff_id: string
          starts_at: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          note?: string | null
          reason?: string
          staff_id?: string
          starts_at?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_off_staff_id_tenant_id_fkey"
            columns: ["staff_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "time_off_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      client_consent_state: {
        Row: {
          at: string | null
          channel: string | null
          client_id: string | null
          granted: boolean | null
          source: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_consents_client_id_tenant_id_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "client_consents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string }
      anonymize_client: { Args: { p_client: string }; Returns: undefined }
      can_see_client: {
        Args: { p_preferred_staff: string; p_tenant: string }
        Returns: boolean
      }
      can_write_tenant_folder: { Args: { p_name: string }; Returns: boolean }
      create_invitation: {
        Args: { p_email: string; p_role: string; p_tenant: string }
        Returns: string
      }
      create_tenant: {
        Args: {
          p_locale?: string
          p_name: string
          p_slug: string
          p_type: string
        }
        Returns: string
      }
      current_staff_id: { Args: { p_tenant: string }; Returns: string }
      export_client: { Args: { p_client: string }; Returns: Json }
      get_invitation: {
        Args: { p_token: string }
        Returns: {
          business_name: string
          business_type: string
          email: string
          role: string
          status: string
        }[]
      }
      has_role: {
        Args: { p_roles: string[]; p_tenant: string }
        Returns: boolean
      }
      import_clients: {
        Args: { p_rows: Json; p_tenant: string }
        Returns: Json
      }
      import_services: {
        Args: { p_locale: string; p_rows: Json; p_tenant: string }
        Returns: number
      }
      link_staff_login: {
        Args: { p_membership: string; p_staff: string }
        Returns: undefined
      }
      log_audit: {
        Args: {
          p_action: string
          p_entity: string
          p_entity_id?: string
          p_meta?: Json
          p_tenant: string
        }
        Returns: undefined
      }
      merge_clients: {
        Args: { p_keep: string; p_remove: string }
        Returns: undefined
      }
      revoke_invitation: { Args: { p_invitation: string }; Returns: undefined }
      set_staff_schedule: {
        Args: { p_rows: Json; p_staff: string }
        Returns: undefined
      }
      set_staff_services: {
        Args: { p_rows: Json; p_staff: string }
        Returns: undefined
      }
      shares_tenant_with: { Args: { p_user: string }; Returns: boolean }
      user_tenant_ids: { Args: never; Returns: string[] }
      valid_i18n: { Args: { p: Json; p_required?: boolean }; Returns: boolean }
      valid_staff_color: { Args: { p: string }; Returns: boolean }
      write_audit: {
        Args: {
          p_action: string
          p_entity: string
          p_entity_id: string
          p_meta?: Json
          p_tenant: string
        }
        Returns: undefined
      }
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
  public: {
    Enums: {},
  },
} as const

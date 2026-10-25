// Hand-written until the dev project is linked; then regenerate with
// `npm run db:types` and this file is replaced by the generated one.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      tenants: Table<{
        id: string;
        name: string;
        type: "salon" | "dental";
        slug: string;
        timezone: string;
        currency: string;
        locale_default: "ka" | "en" | "ru";
        plan: string;
        status: "trial" | "active" | "past_due" | "suspended" | "cancelled";
        trial_ends_at: string;
        settings: Json;
        created_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      profiles: Table<{
        id: string;
        full_name: string;
        phone: string | null;
        locale: "ka" | "en" | "ru";
        created_at: string;
        updated_at: string;
      }>;
      memberships: Table<{
        id: string;
        tenant_id: string;
        user_id: string;
        role: "owner" | "admin" | "staff";
        staff_id: string | null;
        status: "active" | "disabled";
        created_at: string;
        updated_at: string;
      }>;
      invitations: Table<{
        id: string;
        tenant_id: string;
        email: string;
        role: "admin" | "staff";
        token_hash: string;
        invited_by: string | null;
        expires_at: string;
        accepted_at: string | null;
        accepted_by: string | null;
        revoked_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      audit_log: Table<{
        id: string;
        tenant_id: string;
        actor_id: string | null;
        action: string;
        entity: string;
        entity_id: string | null;
        meta: Json;
        ip: string | null;
        at: string;
      }>;
    };
    Views: Record<never, never>;
    Functions: {
      user_tenant_ids: { Args: Record<never, never>; Returns: string[] };
      has_role: { Args: { p_tenant: string; p_roles: string[] }; Returns: boolean };
      shares_tenant_with: { Args: { p_user: string }; Returns: boolean };
      log_audit: {
        Args: { p_tenant: string; p_action: string; p_entity: string; p_entity_id?: string; p_meta?: Json };
        Returns: undefined;
      };
      create_tenant: {
        Args: { p_name: string; p_type: string; p_slug: string; p_locale?: string };
        Returns: string;
      };
      create_invitation: { Args: { p_tenant: string; p_email: string; p_role: string }; Returns: string };
      revoke_invitation: { Args: { p_invitation: string }; Returns: undefined };
      get_invitation: {
        Args: { p_token: string };
        Returns: {
          business_name: string;
          business_type: "salon" | "dental";
          email: string;
          role: "admin" | "staff";
          status: "open" | "accepted" | "revoked" | "expired";
        }[];
      };
      accept_invitation: { Args: { p_token: string }; Returns: string };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

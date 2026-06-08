// Hand-written types matching supabase/migrations/*.sql.
// When a real Supabase project exists, replace with:
//   supabase gen types typescript --project-id <id> > src/lib/database.types.ts
//
// Keep field names + nullability in sync with the SQL migrations until the
// generated file replaces this one.

export type Role = 'super_admin' | 'coc_admin' | 'team_lead' | 'volunteer';
export type EventStatus = 'draft' | 'active' | 'closed';
export type ZoneStatus = 'not_started' | 'in_progress' | 'complete';
export type TeamRole = 'lead' | 'volunteer';
export type SubmissionType = 'tally' | 'survey';
export type SubmissionMode = 'tally_only' | 'survey_only' | 'both';
export type LocationType =
  | 'street'
  | 'encampment'
  | 'vehicle'
  | 'doorway'
  | 'park'
  | 'underpass'
  | 'abandoned'
  | 'other';
export type AgeRange =
  | 'under_18'
  | '18_24'
  | '25_34'
  | '35_44'
  | '45_54'
  | '55_64'
  | '65_plus';
export type Gender = 'male' | 'female' | 'non_binary' | 'unknown';
export type Race =
  | 'american_indian_alaska_native'
  | 'asian'
  | 'black_african_american'
  | 'native_hawaiian_pacific_islander'
  | 'white'
  | 'multi_racial'
  | 'unknown';
export type Ethnicity = 'hispanic' | 'not_hispanic' | 'unknown';
export type Language = 'en' | 'es';
export type HotspotType = 'sighting' | 'encampment' | 'hazard' | 'resource';
export type Severity = 'low' | 'medium' | 'high';

/** GeoJSON geometry — Polygon for zones/templates, Point for submissions.location */
export type GeoJSONPolygon = {
  type: 'Polygon';
  coordinates: number[][][];
};
export type GeoJSONPoint = {
  type: 'Point';
  coordinates: [number, number];
};

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          coc_code: string | null;
          city: string | null;
          state: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          coc_code?: string | null;
          city?: string | null;
          state?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          org_id: string;
          full_name: string;
          email: string;
          role: Role;
          preferred_language: Language;
          created_at: string;
        };
        Insert: {
          id: string;
          org_id: string;
          full_name: string;
          email: string;
          role: Role;
          preferred_language?: Language;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      count_events: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          count_date: string;
          description: string | null;
          status: EventStatus;
          enforce_zone_boundary: boolean;
          zone_buffer_meters: number;
          submission_mode: SubmissionMode;
          cloned_from_event_id: string | null;
          created_by: string | null;
          created_at: string;
          closed_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          count_date: string;
          description?: string | null;
          status?: EventStatus;
          enforce_zone_boundary?: boolean;
          zone_buffer_meters?: number;
          submission_mode?: SubmissionMode;
          cloned_from_event_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          closed_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['count_events']['Insert']>;
        Relationships: [];
      };
      zone_templates: {
        Row: {
          id: string;
          org_id: string | null;
          name: string;
          geometry: GeoJSONPolygon;
          default_color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id?: string | null;
          name: string;
          geometry: GeoJSONPolygon;
          default_color?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['zone_templates']['Insert']>;
        Relationships: [];
      };
      zones: {
        Row: {
          id: string;
          count_event_id: string;
          org_id: string;
          name: string;
          geometry: GeoJSONPolygon;
          color: string;
          status: ZoneStatus;
          template_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          count_event_id: string;
          org_id: string;
          name: string;
          geometry: GeoJSONPolygon;
          color?: string;
          status?: ZoneStatus;
          template_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['zones']['Insert']>;
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          count_event_id: string;
          org_id: string;
          zone_id: string;
          name: string;
          team_lead_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          count_event_id: string;
          org_id: string;
          zone_id: string;
          name: string;
          team_lead_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['teams']['Insert']>;
        Relationships: [];
      };
      team_members: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          role_in_team: TeamRole;
          last_seen_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          role_in_team: TeamRole;
          last_seen_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['team_members']['Insert']>;
        Relationships: [];
      };
      submissions: {
        Row: {
          id: string; // client-generated UUID
          count_event_id: string;
          team_id: string;
          zone_id: string;
          org_id: string;
          submitted_by: string;
          submission_type: SubmissionType;
          person_count: number;
          location_type: LocationType;
          gps_lat: number;
          gps_lng: number;
          gps_accuracy_meters: number | null;
          location: GeoJSONPoint; // generated
          estimated_age_range: AgeRange | null;
          observed_gender: Gender | null;
          observed_race: Race | null;
          observed_ethnicity: Ethnicity | null;
          notes: string | null;
          device_submitted_at: string;
          server_submitted_at: string;
          is_offline_submission: boolean;
          outside_zone: boolean;
          distance_to_zone_meters: number | null;
        };
        Insert: {
          id: string; // required
          count_event_id: string;
          team_id: string;
          zone_id: string;
          org_id: string;
          submitted_by: string;
          submission_type: SubmissionType;
          person_count: number;
          location_type: LocationType;
          gps_lat: number;
          gps_lng: number;
          gps_accuracy_meters?: number | null;
          estimated_age_range?: AgeRange | null;
          observed_gender?: Gender | null;
          observed_race?: Race | null;
          observed_ethnicity?: Ethnicity | null;
          notes?: string | null;
          device_submitted_at: string;
          server_submitted_at?: string;
          is_offline_submission?: boolean;
          // outside_zone + distance_to_zone_meters set by trigger; don't send.
        };
        Update: Partial<Database['public']['Tables']['submissions']['Insert']>;
        Relationships: [];
      };
      hotspots: {
        Row: {
          id: string;
          count_event_id: string;
          org_id: string;
          zone_id: string | null;
          name: string;
          description: string | null;
          hotspot_type: HotspotType;
          severity: Severity;
          expected_count: number | null;
          source: string | null;
          reported_at: string | null;
          gps_lat: number;
          gps_lng: number;
          location: GeoJSONPoint;
          resolved: boolean;
          resolved_by: string | null;
          resolved_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          count_event_id: string;
          org_id: string;
          zone_id?: string | null;
          name: string;
          description?: string | null;
          hotspot_type?: HotspotType;
          severity?: Severity;
          expected_count?: number | null;
          source?: string | null;
          reported_at?: string | null;
          gps_lat: number;
          gps_lng: number;
          resolved?: boolean;
          resolved_by?: string | null;
          resolved_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['hotspots']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      wp_user_org_id: { Args: Record<string, never>; Returns: string | null };
      wp_user_role: { Args: Record<string, never>; Returns: Role | null };
      wp_user_is_admin: { Args: Record<string, never>; Returns: boolean };
      wp_user_team_ids: { Args: Record<string, never>; Returns: string[] };
      wp_resolve_hotspot: { Args: { p_hotspot_id: string }; Returns: Database['public']['Tables']['hotspots']['Row'] };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

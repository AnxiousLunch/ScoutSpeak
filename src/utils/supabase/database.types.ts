export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      business_profiles: {
        Row: {
          business_name: string | null
          constraints: string | null
          created_at: string
          id: string
          owner_id: string
          services: string | null
          target_geography: string | null
          target_industry: string | null
          updated_at: string
          value_proposition: string | null
          version: number
        }
        Insert: {
          business_name?: string | null
          constraints?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          services?: string | null
          target_geography?: string | null
          target_industry?: string | null
          updated_at?: string
          value_proposition?: string | null
          version?: number
        }
        Update: {
          business_name?: string | null
          constraints?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          services?: string | null
          target_geography?: string | null
          target_industry?: string | null
          updated_at?: string
          value_proposition?: string | null
          version?: number
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          business_profile_id: string
          created_at: string
          id: string
          name: string
          objective: string | null
          owner_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          business_profile_id: string
          created_at?: string
          id?: string
          name: string
          objective?: string | null
          owner_id?: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          business_profile_id?: string
          created_at?: string
          id?: string
          name?: string
          objective?: string | null
          owner_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'campaigns_business_profile_id_fkey'
            columns: ['business_profile_id']
            isOneToOne: false
            referencedRelation: 'business_profiles'
            referencedColumns: ['id']
          },
        ]
      }
      conversation_messages: {
        Row: {
          created_at: string
          id: string
          message_text: string | null
          owner_id: string
          sequence_number: number
          session_id: string
          speaker_role: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_text?: string | null
          owner_id?: string
          sequence_number: number
          session_id: string
          speaker_role: string
        }
        Update: {
          created_at?: string
          id?: string
          message_text?: string | null
          owner_id?: string
          sequence_number?: number
          session_id?: string
          speaker_role?: string
        }
        Relationships: [
          {
            foreignKeyName: 'conversation_messages_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'conversation_sessions'
            referencedColumns: ['id']
          },
        ]
      }
      conversation_sessions: {
        Row: {
          brief: Json | null
          business_profile_version: number | null
          campaign_id: string
          created_at: string
          ended_at: string | null
          end_reason: string | null
          id: string
          input_method: string | null
          lead_id: string
          model: string | null
          objective: string | null
          objection_profile: string | null
          owner_id: string
          participant_consent_at: string | null
          prompt_version: string | null
          running_summary: string | null
          session_purpose: string
          session_status: string
          started_at: string | null
          strategy_key: string | null
          strategy_version: number | null
          updated_at: string
        }
        Insert: {
          brief?: Json | null
          business_profile_version?: number | null
          campaign_id: string
          created_at?: string
          ended_at?: string | null
          end_reason?: string | null
          id?: string
          input_method?: string | null
          lead_id: string
          model?: string | null
          objective?: string | null
          objection_profile?: string | null
          owner_id?: string
          participant_consent_at?: string | null
          prompt_version?: string | null
          running_summary?: string | null
          session_purpose: string
          session_status?: string
          started_at?: string | null
          strategy_key?: string | null
          strategy_version?: number | null
          updated_at?: string
        }
        Update: {
          brief?: Json | null
          business_profile_version?: number | null
          campaign_id?: string
          created_at?: string
          ended_at?: string | null
          end_reason?: string | null
          id?: string
          input_method?: string | null
          lead_id?: string
          model?: string | null
          objective?: string | null
          objection_profile?: string | null
          owner_id?: string
          participant_consent_at?: string | null
          prompt_version?: string | null
          running_summary?: string | null
          session_purpose?: string
          session_status?: string
          started_at?: string | null
          strategy_key?: string | null
          strategy_version?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'conversation_sessions_campaign_id_fkey'
            columns: ['campaign_id']
            isOneToOne: false
            referencedRelation: 'campaigns'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'conversation_sessions_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
        ]
      }
      counter: {
        Row: {
          id: number
          value: number
        }
        Insert: {
          id?: number
          value?: number
        }
        Update: {
          id?: number
          value?: number
        }
        Relationships: []
      }
      lead_evidence: {
        Row: {
          access_status: string | null
          canonical_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          lead_id: string
          observed_at: string | null
          owner_id: string
          page_title: string | null
          run_id: string | null
          source_url: string | null
          updated_at: string
        }
        Insert: {
          access_status?: string | null
          canonical_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          lead_id: string
          observed_at?: string | null
          owner_id?: string
          page_title?: string | null
          run_id?: string | null
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          access_status?: string | null
          canonical_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          lead_id?: string
          observed_at?: string | null
          owner_id?: string
          page_title?: string | null
          run_id?: string | null
          source_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lead_evidence_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
        ]
      }
      leads: {
        Row: {
          campaign_id: string
          citations: Json | null
          company_name: string
          company_summary: string | null
          created_at: string
          dedup_key: string | null
          discovery_query: Json | null
          discovery_source: string | null
          enriched_at: string | null
          enrichment_error: string | null
          fit_label: string | null
          fit_reason: string | null
          fit_score: number | null
          id: string
          inferred_need: string | null
          lead_status: string | null
          missing_fields: Json | null
          observed_signal: string | null
          owner_id: string
          personalization_hook: string | null
          provider_id: string | null
          research_status: string
          score_breakdown: Json | null
          source_attribution: Json | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          campaign_id: string
          citations?: Json | null
          company_name: string
          company_summary?: string | null
          created_at?: string
          dedup_key?: string | null
          discovery_query?: Json | null
          discovery_source?: string | null
          enriched_at?: string | null
          enrichment_error?: string | null
          fit_label?: string | null
          fit_reason?: string | null
          fit_score?: number | null
          id?: string
          inferred_need?: string | null
          lead_status?: string | null
          missing_fields?: Json | null
          observed_signal?: string | null
          owner_id?: string
          personalization_hook?: string | null
          provider_id?: string | null
          research_status?: string
          score_breakdown?: Json | null
          source_attribution?: Json | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          campaign_id?: string
          citations?: Json | null
          company_name?: string
          company_summary?: string | null
          created_at?: string
          dedup_key?: string | null
          discovery_query?: Json | null
          discovery_source?: string | null
          enriched_at?: string | null
          enrichment_error?: string | null
          fit_label?: string | null
          fit_reason?: string | null
          fit_score?: number | null
          id?: string
          inferred_need?: string | null
          lead_status?: string | null
          missing_fields?: Json | null
          observed_signal?: string | null
          owner_id?: string
          personalization_hook?: string | null
          provider_id?: string | null
          research_status?: string
          score_breakdown?: Json | null
          source_attribution?: Json | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'leads_campaign_id_fkey'
            columns: ['campaign_id']
            isOneToOne: false
            referencedRelation: 'campaigns'
            referencedColumns: ['id']
          },
        ]
      }
      session_invites: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          owner_id: string
          session_id: string
          token_hash: string
          updated_at: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          owner_id?: string
          session_id: string
          token_hash: string
          updated_at?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          owner_id?: string
          session_id?: string
          token_hash?: string
          updated_at?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'session_invites_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'conversation_sessions'
            referencedColumns: ['id']
          },
        ]
      }
      session_reviews: {
        Row: {
          created_at: string
          excerpts: Json | null
          id: string
          next_step: string | null
          note_text: string | null
          objection_tags: Json | null
          outcome_confirmed: string | null
          outcome_source: string | null
          outcome_suggested: string | null
          owner_id: string
          quality_notes: Json | null
          session_id: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          excerpts?: Json | null
          id?: string
          next_step?: string | null
          note_text?: string | null
          objection_tags?: Json | null
          outcome_confirmed?: string | null
          outcome_source?: string | null
          outcome_suggested?: string | null
          owner_id?: string
          quality_notes?: Json | null
          session_id: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          excerpts?: Json | null
          id?: string
          next_step?: string | null
          note_text?: string | null
          objection_tags?: Json | null
          outcome_confirmed?: string | null
          outcome_source?: string | null
          outcome_suggested?: string | null
          owner_id?: string
          quality_notes?: Json | null
          session_id?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'session_reviews_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'conversation_sessions'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      increment_counter: {
        Args: Record<string, never>
        Returns: number
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

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
      approval_matrices: {
        Row: {
          created_at: string
          id: string
          local_id: string
          mode: string | null
          name: string
          organization_id: string
          steps: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          local_id: string
          mode?: string | null
          name: string
          organization_id: string
          steps?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          local_id?: string
          mode?: string | null
          name?: string
          organization_id?: string
          steps?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_matrices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_queue: {
        Row: {
          approver_ids: Json
          created_at: string
          created_by: string | null
          current_step: number | null
          decisions: Json
          id: string
          kpi_card_local_id: string
          kpi_name: string
          local_id: string
          matrix_local_id: string | null
          organization_id: string
          status: string
          steps_chain: Json | null
          updated_at: string
        }
        Insert: {
          approver_ids?: Json
          created_at?: string
          created_by?: string | null
          current_step?: number | null
          decisions?: Json
          id?: string
          kpi_card_local_id: string
          kpi_name: string
          local_id: string
          matrix_local_id?: string | null
          organization_id: string
          status?: string
          steps_chain?: Json | null
          updated_at?: string
        }
        Update: {
          approver_ids?: Json
          created_at?: string
          created_by?: string | null
          current_step?: number | null
          decisions?: Json
          id?: string
          kpi_card_local_id?: string
          kpi_name?: string
          local_id?: string
          matrix_local_id?: string | null
          organization_id?: string
          status?: string
          steps_chain?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json
          module: string
          new_values: Json | null
          organization_id: string | null
          previous_values: Json | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          module: string
          new_values?: Json | null
          organization_id?: string | null
          previous_values?: Json | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          module?: string
          new_values?: Json | null
          organization_id?: string | null
          previous_values?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_runs: {
        Row: {
          achievement_pct: number
          base_salary: number
          bonus_amount: number
          bonus_pct: number
          cap_pct: number
          created_at: string
          created_by: string | null
          currency: string
          department: string | null
          employee_local_id: string | null
          employee_name: string
          id: string
          inputs: Json
          notes: string | null
          organization_id: string
          period_label: string
          updated_at: string
          weighted_score: number
        }
        Insert: {
          achievement_pct?: number
          base_salary?: number
          bonus_amount?: number
          bonus_pct?: number
          cap_pct?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          department?: string | null
          employee_local_id?: string | null
          employee_name: string
          id?: string
          inputs?: Json
          notes?: string | null
          organization_id: string
          period_label: string
          updated_at?: string
          weighted_score?: number
        }
        Update: {
          achievement_pct?: number
          base_salary?: number
          bonus_amount?: number
          bonus_pct?: number
          cap_pct?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          department?: string | null
          employee_local_id?: string | null
          employee_name?: string
          id?: string
          inputs?: Json
          notes?: string | null
          organization_id?: string
          period_label?: string
          updated_at?: string
          weighted_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "bonus_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cascade_matrices: {
        Row: {
          created_at: string
          id: string
          local_id: string
          name: string
          organization_id: string
          scope_name: string
          scope_type: string
          shared_persons: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          local_id: string
          name: string
          organization_id: string
          scope_name: string
          scope_type: string
          shared_persons?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          local_id?: string
          name?: string
          organization_id?: string
          scope_name?: string
          scope_type?: string
          shared_persons?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cascade_matrices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deletion_matrices: {
        Row: {
          approver: Json | null
          created_at: string
          id: string
          local_id: string
          min_approvals: number | null
          mode: string | null
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          approver?: Json | null
          created_at?: string
          id?: string
          local_id: string
          min_approvals?: number | null
          mode?: string | null
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          approver?: Json | null
          created_at?: string
          id?: string
          local_id?: string
          min_approvals?: number | null
          mode?: string | null
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deletion_matrices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_card_comments: {
        Row: {
          author_name: string
          author_user_id: string | null
          card_ref: string
          created_at: string
          id: string
          organization_id: string
          text: string
        }
        Insert: {
          author_name?: string
          author_user_id?: string | null
          card_ref: string
          created_at?: string
          id?: string
          organization_id: string
          text: string
        }
        Update: {
          author_name?: string
          author_user_id?: string | null
          card_ref?: string
          created_at?: string
          id?: string
          organization_id?: string
          text?: string
        }
        Relationships: []
      }
      kpi_card_history: {
        Row: {
          action: string
          actor: string | null
          id: string
          kpi_card_id: string
          note: string | null
          occurred_at: string
          organization_id: string
        }
        Insert: {
          action: string
          actor?: string | null
          id?: string
          kpi_card_id: string
          note?: string | null
          occurred_at?: string
          organization_id: string
        }
        Update: {
          action?: string
          actor?: string | null
          id?: string
          kpi_card_id?: string
          note?: string | null
          occurred_at?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_card_history_kpi_card_id_fkey"
            columns: ["kpi_card_id"]
            isOneToOne: false
            referencedRelation: "kpi_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_card_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_card_targets: {
        Row: {
          assigner: string | null
          cascading: boolean
          created_at: string
          created_by_mode: string | null
          evaluator: Json | null
          id: string
          kpi_card_id: string
          legacy_id: string | null
          limits: Json
          name: string
          organization_id: string
          ranges: Json
          score_descriptions: Json
          score_limit: number | null
          sort_order: number
          target_value: string | null
          type: string | null
          unit: string | null
          updated_at: string
          weight: number
        }
        Insert: {
          assigner?: string | null
          cascading?: boolean
          created_at?: string
          created_by_mode?: string | null
          evaluator?: Json | null
          id?: string
          kpi_card_id: string
          legacy_id?: string | null
          limits?: Json
          name: string
          organization_id: string
          ranges?: Json
          score_descriptions?: Json
          score_limit?: number | null
          sort_order?: number
          target_value?: string | null
          type?: string | null
          unit?: string | null
          updated_at?: string
          weight?: number
        }
        Update: {
          assigner?: string | null
          cascading?: boolean
          created_at?: string
          created_by_mode?: string | null
          evaluator?: Json | null
          id?: string
          kpi_card_id?: string
          legacy_id?: string | null
          limits?: Json
          name?: string
          organization_id?: string
          ranges?: Json
          score_descriptions?: Json
          score_limit?: number | null
          sort_order?: number
          target_value?: string | null
          type?: string | null
          unit?: string | null
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_card_targets_kpi_card_id_fkey"
            columns: ["kpi_card_id"]
            isOneToOne: false
            referencedRelation: "kpi_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_card_targets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_cards: {
        Row: {
          assignee_ids: string[]
          assignees: Json
          assignment_mode: string
          created_at: string
          created_by: string | null
          end_date: string | null
          evaluator_ids: string[]
          execution: Json
          frequency: string | null
          id: string
          legacy_numeric_id: number | null
          matrix_id: string | null
          name: string
          organization_id: string
          owner_employee_id: string | null
          position_ids: string[]
          rejected_at: string | null
          rejected_by: string | null
          rejected_reason: string | null
          scoring_system: string | null
          start_date: string | null
          status: string
          structure_ids: string[]
          submitted_for_approval: boolean
          team_ids: string[]
          updated_at: string
          use_matrix: boolean
        }
        Insert: {
          assignee_ids?: string[]
          assignees?: Json
          assignment_mode?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          evaluator_ids?: string[]
          execution?: Json
          frequency?: string | null
          id?: string
          legacy_numeric_id?: number | null
          matrix_id?: string | null
          name: string
          organization_id: string
          owner_employee_id?: string | null
          position_ids?: string[]
          rejected_at?: string | null
          rejected_by?: string | null
          rejected_reason?: string | null
          scoring_system?: string | null
          start_date?: string | null
          status?: string
          structure_ids?: string[]
          submitted_for_approval?: boolean
          team_ids?: string[]
          updated_at?: string
          use_matrix?: boolean
        }
        Update: {
          assignee_ids?: string[]
          assignees?: Json
          assignment_mode?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          evaluator_ids?: string[]
          execution?: Json
          frequency?: string | null
          id?: string
          legacy_numeric_id?: number | null
          matrix_id?: string | null
          name?: string
          organization_id?: string
          owner_employee_id?: string | null
          position_ids?: string[]
          rejected_at?: string | null
          rejected_by?: string | null
          rejected_reason?: string | null
          scoring_system?: string | null
          start_date?: string | null
          status?: string
          structure_ids?: string[]
          submitted_for_approval?: boolean
          team_ids?: string[]
          updated_at?: string
          use_matrix?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "kpi_cards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_lifecycles: {
        Row: {
          assignment: Json | null
          bonus: Json | null
          card_local_id: string
          card_name: string
          created_at: string
          evaluation: Json | null
          id: string
          organization_id: string
          reviews: Json
          updated_at: string
        }
        Insert: {
          assignment?: Json | null
          bonus?: Json | null
          card_local_id: string
          card_name: string
          created_at?: string
          evaluation?: Json | null
          id?: string
          organization_id: string
          reviews?: Json
          updated_at?: string
        }
        Update: {
          assignment?: Json | null
          bonus?: Json | null
          card_local_id?: string
          card_name?: string
          created_at?: string
          evaluation?: Json | null
          id?: string
          organization_id?: string
          reviews?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_lifecycles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lifecycle_templates: {
        Row: {
          active: boolean
          created_at: string
          data: Json
          description: string | null
          id: string
          is_system: boolean
          local_id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          data?: Json
          description?: string | null
          id?: string
          is_system?: boolean
          local_id: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          data?: Json
          description?: string | null
          id?: string
          is_system?: boolean
          local_id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lifecycle_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          channels: Json
          created_at: string
          description: string | null
          enabled: boolean
          frequency: string | null
          id: string
          local_id: string
          organization_id: string
          recipients: Json
          schedule: Json
          send_time: string | null
          template: string | null
          title: string
          updated_at: string
        }
        Insert: {
          channels?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          frequency?: string | null
          id?: string
          local_id: string
          organization_id: string
          recipients?: Json
          schedule?: Json
          send_time?: string | null
          template?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          channels?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          frequency?: string | null
          id?: string
          local_id?: string
          organization_id?: string
          recipients?: Json
          schedule?: Json
          send_time?: string | null
          template?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          organization_id: string
          read: boolean
          title: string
          to_employee_id: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          organization_id: string
          read?: boolean
          title: string
          to_employee_id: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          organization_id?: string
          read?: boolean
          title?: string
          to_employee_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_catalogs: {
        Row: {
          catalog_key: string
          created_at: string
          entries: Json
          id: string
          metadata: Json
          organization_id: string
          updated_at: string
        }
        Insert: {
          catalog_key: string
          created_at?: string
          entries?: Json
          id?: string
          metadata?: Json
          organization_id: string
          updated_at?: string
        }
        Update: {
          catalog_key?: string
          created_at?: string
          entries?: Json
          id?: string
          metadata?: Json
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_catalogs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_dropdown_catalogs: {
        Row: {
          created_at: string
          dropdown_key: string
          id: string
          metadata: Json
          options: Json
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dropdown_key: string
          id?: string
          metadata?: Json
          options?: Json
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dropdown_key?: string
          id?: string
          metadata?: Json
          options?: Json
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_dropdown_catalogs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_employees: {
        Row: {
          active: boolean
          auth_user_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          father_name: string | null
          fin: string | null
          first_name: string
          id: string
          is_star_person: boolean
          last_name: string
          organization_id: string
          phone: string | null
          position_name: string | null
          salary: number | null
          structure_path: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          father_name?: string | null
          fin?: string | null
          first_name: string
          id?: string
          is_star_person?: boolean
          last_name: string
          organization_id: string
          phone?: string | null
          position_name?: string | null
          salary?: number | null
          structure_path?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          father_name?: string | null
          fin?: string | null
          first_name?: string
          id?: string
          is_star_person?: boolean
          last_name?: string
          organization_id?: string
          phone?: string | null
          position_name?: string | null
          salary?: number | null
          structure_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_formula_assignments: {
        Row: {
          created_at: string
          formula_id: string
          id: string
          metadata: Json
          organization_id: string
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          formula_id: string
          id?: string
          metadata?: Json
          organization_id: string
          target_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          formula_id?: string
          id?: string
          metadata?: Json
          organization_id?: string
          target_id?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_formula_assignments_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "org_formulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_formula_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_formulas: {
        Row: {
          created_at: string
          description: string | null
          expression: string
          id: string
          is_active: boolean
          metadata: Json
          name: string
          organization_id: string
          updated_at: string
          variables: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          expression: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          organization_id: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          expression?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          organization_id?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "org_formulas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_matrices: {
        Row: {
          created_at: string
          id: string
          matrix_key: string
          organization_id: string
          payload: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          matrix_key: string
          organization_id: string
          payload?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          matrix_key?: string
          organization_id?: string
          payload?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_matrices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_positions: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          sort_order: number
          structure_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          sort_order?: number
          structure_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          sort_order?: number
          structure_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_positions_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "org_structures"
            referencedColumns: ["id"]
          },
        ]
      }
      org_salaries: {
        Row: {
          base_salary: number
          created_at: string
          currency: string
          effective_date: string | null
          employee_email: string | null
          employee_id: string | null
          id: string
          metadata: Json
          notes: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          base_salary?: number
          created_at?: string
          currency?: string
          effective_date?: string | null
          employee_email?: string | null
          employee_id?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          base_salary?: number
          created_at?: string
          currency?: string
          effective_date?: string | null
          employee_email?: string | null
          employee_id?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_salaries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_salaries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_salary_uploads: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          payload: Json
          rows_failed: number
          rows_success: number
          rows_total: number
          source_file: string | null
          status: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          payload?: Json
          rows_failed?: number
          rows_success?: number
          rows_total?: number
          source_file?: string | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          payload?: Json
          rows_failed?: number
          rows_success?: number
          rows_total?: number
          source_file?: string | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_salary_uploads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_slots: {
        Row: {
          created_at: string
          employee_id: string | null
          fraction: number
          id: string
          organization_id: string
          position_id: string
          salary: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          fraction?: number
          id?: string
          organization_id: string
          position_id: string
          salary?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          fraction?: number
          id?: string
          organization_id?: string
          position_id?: string
          salary?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_slots_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_slots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_slots_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "org_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      org_structures: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string
          parent_id: string | null
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id: string
          parent_id?: string | null
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string
          parent_id?: string | null
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_structures_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_structures_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "org_structures"
            referencedColumns: ["id"]
          },
        ]
      }
      org_teams: {
        Row: {
          created_at: string
          id: string
          manager_id: string | null
          members: Json
          metadata: Json
          name: string
          organization_id: string
          structure_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager_id?: string | null
          members?: Json
          metadata?: Json
          name: string
          organization_id: string
          structure_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          manager_id?: string | null
          members?: Json
          metadata?: Json
          name?: string
          organization_id?: string
          structure_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_teams_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "org_structures"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role_ids: string[]
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role_ids?: string[]
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role_ids?: string[]
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          joined_at: string
          organization_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          organization_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          organization_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          settings: Json
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          settings?: Json
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          settings?: Json
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          action: string
          code: string
          created_at: string
          description: string | null
          id: string
          module: string
          resource: string
        }
        Insert: {
          action: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          module: string
          resource: string
        }
        Update: {
          action?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          module?: string
          resource?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
          id: string
          is_platform_super_admin: boolean
          last_login_at: string | null
          last_name: string | null
          must_change_password: boolean
          phone: string | null
          preferred_language: string
          profile_photo: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          is_platform_super_admin?: boolean
          last_login_at?: string | null
          last_name?: string | null
          must_change_password?: boolean
          phone?: string | null
          preferred_language?: string
          profile_photo?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          is_platform_super_admin?: boolean
          last_login_at?: string | null
          last_name?: string | null
          must_change_password?: boolean
          phone?: string | null
          preferred_language?: string
          profile_photo?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          granted_at: string
          granted_by: string | null
          permission_id: string
          role_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          permission_id: string
          role_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_platform_role: boolean
          is_system_role: boolean
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_platform_role?: boolean
          is_system_role?: boolean
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_platform_role?: boolean
          is_system_role?: boolean
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_records: {
        Row: {
          created_at: string
          employee_id: string
          employee_legacy_id: number
          id: string
          legacy_id: number
          operator: string | null
          organization_id: string
          periods: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          employee_legacy_id: number
          id?: string
          legacy_id: number
          operator?: string | null
          organization_id: string
          periods?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          employee_legacy_id?: number
          id?: string
          legacy_id?: number
          operator?: string | null
          organization_id?: string
          periods?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_uploads: {
        Row: {
          created_at: string
          details: Json
          file_name: string | null
          id: string
          legacy_id: number
          matched: number | null
          month: string | null
          operator: string | null
          organization_id: string
          status: string | null
          title: string | null
          total_amount: number | null
          total_rows: number | null
          unmatched: number | null
          updated_at: string
          uploaded_by: string | null
          year: number | null
        }
        Insert: {
          created_at?: string
          details?: Json
          file_name?: string | null
          id?: string
          legacy_id: number
          matched?: number | null
          month?: string | null
          operator?: string | null
          organization_id: string
          status?: string | null
          title?: string | null
          total_amount?: number | null
          total_rows?: number | null
          unmatched?: number | null
          updated_at?: string
          uploaded_by?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string
          details?: Json
          file_name?: string | null
          id?: string
          legacy_id?: number
          matched?: number | null
          month?: string | null
          operator?: string | null
          organization_id?: string
          status?: string | null
          title?: string | null
          total_amount?: number | null
          total_rows?: number | null
          unmatched?: number | null
          updated_at?: string
          uploaded_by?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_uploads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          organization_member_id: string
          role_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          organization_member_id: string
          role_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          organization_member_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_member_id_fkey"
            columns: ["organization_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_auth_context: { Args: { _user_id: string }; Returns: Json }
      get_user_org_ids: { Args: { _user_id: string }; Returns: string[] }
      has_permission: {
        Args: { _org_id: string; _permission_code: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_platform_super_admin: { Args: { _user_id: string }; Returns: boolean }
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

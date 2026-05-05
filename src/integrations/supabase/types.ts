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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admin_activity_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string | null
          details: Json | null
          id: string
          target_teacher_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_teacher_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_teacher_id?: string | null
        }
        Relationships: []
      }
      app_internal_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      bug_reports: {
        Row: {
          admin_note: string | null
          attachment_paths: string[]
          console_errors: Json
          created_at: string
          description: string
          email_error: string | null
          email_status: string
          id: string
          page_url: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          teacher_id: string
          title: string
          updated_at: string
          user_agent: string | null
          viewport: string | null
        }
        Insert: {
          admin_note?: string | null
          attachment_paths?: string[]
          console_errors?: Json
          created_at?: string
          description: string
          email_error?: string | null
          email_status?: string
          id?: string
          page_url?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          teacher_id: string
          title: string
          updated_at?: string
          user_agent?: string | null
          viewport?: string | null
        }
        Update: {
          admin_note?: string | null
          attachment_paths?: string[]
          console_errors?: Json
          created_at?: string
          description?: string
          email_error?: string | null
          email_status?: string
          id?: string
          page_url?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          teacher_id?: string
          title?: string
          updated_at?: string
          user_agent?: string | null
          viewport?: string | null
        }
        Relationships: []
      }
      calendar_gcal_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          gcal_calendar_id: string | null
          id: string
          refresh_token: string
          teacher_id: string
          token_expires_at: string
          updated_at: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          gcal_calendar_id?: string | null
          id?: string
          refresh_token: string
          teacher_id: string
          token_expires_at: string
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          gcal_calendar_id?: string | null
          id?: string
          refresh_token?: string
          teacher_id?: string
          token_expires_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_gcal_tokens_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          is_resolved: boolean
          message: string
          metadata: Json | null
          notification_type: string
          resolved_action: string | null
          slot_id: string | null
          student_name: string | null
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          is_resolved?: boolean
          message: string
          metadata?: Json | null
          notification_type: string
          resolved_action?: string | null
          slot_id?: string | null
          student_name?: string | null
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          is_resolved?: boolean
          message?: string
          metadata?: Json | null
          notification_type?: string
          resolved_action?: string | null
          slot_id?: string | null
          student_name?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_notifications_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "calendar_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_notifications_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_payment_records: {
        Row: {
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          currency: string
          id: string
          is_confirmed: boolean
          lessons_count: number | null
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          payment_type: string
          slot_id: string | null
          student_id: string
          teacher_id: string
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_confirmed?: boolean
          lessons_count?: number | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_type?: string
          slot_id?: string | null
          student_id: string
          teacher_id: string
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_confirmed?: boolean
          lessons_count?: number | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_type?: string
          slot_id?: string | null
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_payment_records_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "calendar_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_payment_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_payment_records_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_recurrence_rules: {
        Row: {
          auto_generate_weeks_ahead: number
          created_at: string
          day_of_week: number
          effective_from: string
          effective_until: string | null
          end_time: string
          id: string
          is_active: boolean
          start_time: string
          student_id: string | null
          teacher_id: string
          title: string | null
        }
        Insert: {
          auto_generate_weeks_ahead?: number
          created_at?: string
          day_of_week: number
          effective_from?: string
          effective_until?: string | null
          end_time: string
          id?: string
          is_active?: boolean
          start_time: string
          student_id?: string | null
          teacher_id: string
          title?: string | null
        }
        Update: {
          auto_generate_weeks_ahead?: number
          created_at?: string
          day_of_week?: number
          effective_from?: string
          effective_until?: string | null
          end_time?: string
          id?: string
          is_active?: boolean
          start_time?: string
          student_id?: string | null
          teacher_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_recurrence_rules_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_recurrence_rules_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_settings: {
        Row: {
          allow_student_reschedule: boolean
          auto_create_meet_link: boolean | null
          auto_create_student_meeting_link: boolean
          buffer_minutes: number
          created_at: string
          currency: string | null
          default_booking_mode: string
          default_lesson_duration_minutes: number
          default_lesson_price: number | null
          default_meeting_link: string | null
          display_end_hour: number
          display_start_hour: number
          enforce_slot_limit: boolean
          gcal_color_available: string | null
          gcal_color_booked: string | null
          gcal_color_completed: string | null
          gcal_color_no_show: string | null
          gcal_color_pending: string | null
          gcal_default_color: string | null
          gcal_default_reminder_minutes: number | null
          gcal_integration_enabled: boolean
          gcal_on_cancel_action: string | null
          gcal_sync_available_new: boolean | null
          gcal_sync_available_on_cancel: boolean | null
          gcal_sync_booked: boolean | null
          gcal_sync_mode: string | null
          gcal_sync_pending: boolean | null
          hub_token: string | null
          id: string
          max_slots_per_student_per_week: number | null
          min_cancellation_hours: number | null
          notify_email_on_booking: boolean
          notify_email_on_cancellation: boolean
          notify_email_on_confirmation: boolean
          notify_email_on_lesson_created: boolean
          notify_email_on_rejection: boolean
          notify_email_on_reschedule: boolean
          notify_on_booking: boolean
          notify_on_cancellation: boolean
          notify_payment_reminder: boolean
          notify_student_reminder_hours: number | null
          payment_tracking_enabled: boolean
          public_calendar_enabled: boolean
          public_calendar_slug: string | null
          public_calendar_token: string | null
          teacher_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          allow_student_reschedule?: boolean
          auto_create_meet_link?: boolean | null
          auto_create_student_meeting_link?: boolean
          buffer_minutes?: number
          created_at?: string
          currency?: string | null
          default_booking_mode?: string
          default_lesson_duration_minutes?: number
          default_lesson_price?: number | null
          default_meeting_link?: string | null
          display_end_hour?: number
          display_start_hour?: number
          enforce_slot_limit?: boolean
          gcal_color_available?: string | null
          gcal_color_booked?: string | null
          gcal_color_completed?: string | null
          gcal_color_no_show?: string | null
          gcal_color_pending?: string | null
          gcal_default_color?: string | null
          gcal_default_reminder_minutes?: number | null
          gcal_integration_enabled?: boolean
          gcal_on_cancel_action?: string | null
          gcal_sync_available_new?: boolean | null
          gcal_sync_available_on_cancel?: boolean | null
          gcal_sync_booked?: boolean | null
          gcal_sync_mode?: string | null
          gcal_sync_pending?: boolean | null
          hub_token?: string | null
          id?: string
          max_slots_per_student_per_week?: number | null
          min_cancellation_hours?: number | null
          notify_email_on_booking?: boolean
          notify_email_on_cancellation?: boolean
          notify_email_on_confirmation?: boolean
          notify_email_on_lesson_created?: boolean
          notify_email_on_rejection?: boolean
          notify_email_on_reschedule?: boolean
          notify_on_booking?: boolean
          notify_on_cancellation?: boolean
          notify_payment_reminder?: boolean
          notify_student_reminder_hours?: number | null
          payment_tracking_enabled?: boolean
          public_calendar_enabled?: boolean
          public_calendar_slug?: string | null
          public_calendar_token?: string | null
          teacher_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          allow_student_reschedule?: boolean
          auto_create_meet_link?: boolean | null
          auto_create_student_meeting_link?: boolean
          buffer_minutes?: number
          created_at?: string
          currency?: string | null
          default_booking_mode?: string
          default_lesson_duration_minutes?: number
          default_lesson_price?: number | null
          default_meeting_link?: string | null
          display_end_hour?: number
          display_start_hour?: number
          enforce_slot_limit?: boolean
          gcal_color_available?: string | null
          gcal_color_booked?: string | null
          gcal_color_completed?: string | null
          gcal_color_no_show?: string | null
          gcal_color_pending?: string | null
          gcal_default_color?: string | null
          gcal_default_reminder_minutes?: number | null
          gcal_integration_enabled?: boolean
          gcal_on_cancel_action?: string | null
          gcal_sync_available_new?: boolean | null
          gcal_sync_available_on_cancel?: boolean | null
          gcal_sync_booked?: boolean | null
          gcal_sync_mode?: string | null
          gcal_sync_pending?: boolean | null
          hub_token?: string | null
          id?: string
          max_slots_per_student_per_week?: number | null
          min_cancellation_hours?: number | null
          notify_email_on_booking?: boolean
          notify_email_on_cancellation?: boolean
          notify_email_on_confirmation?: boolean
          notify_email_on_lesson_created?: boolean
          notify_email_on_rejection?: boolean
          notify_email_on_reschedule?: boolean
          notify_on_booking?: boolean
          notify_on_cancellation?: boolean
          notify_payment_reminder?: boolean
          notify_student_reminder_hours?: number | null
          payment_tracking_enabled?: boolean
          public_calendar_enabled?: boolean
          public_calendar_slug?: string | null
          public_calendar_token?: string | null
          teacher_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_settings_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_slot_logs: {
        Row: {
          action: string
          actor: string
          created_at: string
          details: Json | null
          id: string
          slot_id: string
          teacher_id: string
        }
        Insert: {
          action: string
          actor: string
          created_at?: string
          details?: Json | null
          id?: string
          slot_id: string
          teacher_id: string
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          details?: Json | null
          id?: string
          slot_id?: string
          teacher_id?: string
        }
        Relationships: []
      }
      calendar_slots: {
        Row: {
          booked_at: string | null
          booked_by: string | null
          booking_type: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          confirmed_at: string | null
          created_at: string
          discount_percent: number | null
          end_time: string
          gcal_event_id: string | null
          id: string
          is_paid: boolean
          meeting_link: string | null
          notes: string | null
          recurrence_rule_id: string | null
          reschedule_request_from_slot_id: string | null
          reschedule_request_to_slot_id: string | null
          slot_date: string
          slot_type: string
          start_time: string
          status: string
          student_id: string | null
          student_notes: string | null
          teacher_id: string
          title: string | null
          updated_at: string
          worksheet_id: string | null
        }
        Insert: {
          booked_at?: string | null
          booked_by?: string | null
          booking_type?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          confirmed_at?: string | null
          created_at?: string
          discount_percent?: number | null
          end_time: string
          gcal_event_id?: string | null
          id?: string
          is_paid?: boolean
          meeting_link?: string | null
          notes?: string | null
          recurrence_rule_id?: string | null
          reschedule_request_from_slot_id?: string | null
          reschedule_request_to_slot_id?: string | null
          slot_date: string
          slot_type?: string
          start_time: string
          status?: string
          student_id?: string | null
          student_notes?: string | null
          teacher_id: string
          title?: string | null
          updated_at?: string
          worksheet_id?: string | null
        }
        Update: {
          booked_at?: string | null
          booked_by?: string | null
          booking_type?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          confirmed_at?: string | null
          created_at?: string
          discount_percent?: number | null
          end_time?: string
          gcal_event_id?: string | null
          id?: string
          is_paid?: boolean
          meeting_link?: string | null
          notes?: string | null
          recurrence_rule_id?: string | null
          reschedule_request_from_slot_id?: string | null
          reschedule_request_to_slot_id?: string | null
          slot_date?: string
          slot_type?: string
          start_time?: string
          status?: string
          student_id?: string | null
          student_notes?: string | null
          teacher_id?: string
          title?: string | null
          updated_at?: string
          worksheet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_slots_recurrence_rule_id_fkey"
            columns: ["recurrence_rule_id"]
            isOneToOne: false
            referencedRelation: "calendar_recurrence_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_slots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_slots_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_slots_worksheet_id_fkey"
            columns: ["worksheet_id"]
            isOneToOne: false
            referencedRelation: "worksheets"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_student_settings: {
        Row: {
          booking_mode_override: string | null
          created_at: string
          default_meeting_link: string | null
          generated_meeting_link: string | null
          id: string
          lesson_price_override: number | null
          meeting_link_mode: string
          prepaid_lessons_remaining: number
          student_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          booking_mode_override?: string | null
          created_at?: string
          default_meeting_link?: string | null
          generated_meeting_link?: string | null
          id?: string
          lesson_price_override?: number | null
          meeting_link_mode?: string
          prepaid_lessons_remaining?: number
          student_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          booking_mode_override?: string | null
          created_at?: string
          default_meeting_link?: string | null
          generated_meeting_link?: string | null
          id?: string
          lesson_price_override?: number | null
          meeting_link_mode?: string
          prepaid_lessons_remaining?: number
          student_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_student_settings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_student_settings_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_teacher_vacations: {
        Row: {
          created_at: string
          end_date: string
          id: string
          label: string | null
          start_date: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          label?: string | null
          start_date: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          label?: string | null
          start_date?: string
          teacher_id?: string
        }
        Relationships: []
      }
      closed_loop_signals: {
        Row: {
          created_at: string
          id: string
          loop_id: string
          payload: Json
          resolution_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          loop_id: string
          payload?: Json
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          loop_id?: string
          payload?: Json
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      download_sessions: {
        Row: {
          created_at: string
          downloads_count: number | null
          expires_at: string
          id: string
          payment_id: string | null
          session_token: string
          worksheet_id: string | null
        }
        Insert: {
          created_at?: string
          downloads_count?: number | null
          expires_at?: string
          id?: string
          payment_id?: string | null
          session_token: string
          worksheet_id?: string | null
        }
        Update: {
          created_at?: string
          downloads_count?: number | null
          expires_at?: string
          id?: string
          payment_id?: string | null
          session_token?: string
          worksheet_id?: string | null
        }
        Relationships: []
      }
      dslm_curriculum_phases: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          estimated_weeks_end: number | null
          estimated_weeks_start: number | null
          focus_areas: string[] | null
          generation_context: Json | null
          id: string
          rationale: string | null
          sequence_number: number
          status: string
          student_id: string
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          estimated_weeks_end?: number | null
          estimated_weeks_start?: number | null
          focus_areas?: string[] | null
          generation_context?: Json | null
          id?: string
          rationale?: string | null
          sequence_number: number
          status?: string
          student_id: string
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          estimated_weeks_end?: number | null
          estimated_weeks_start?: number | null
          focus_areas?: string[] | null
          generation_context?: Json | null
          id?: string
          rationale?: string | null
          sequence_number?: number
          status?: string
          student_id?: string
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dslm_curriculum_phases_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dslm_curriculum_phases_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          provider_message_id: string | null
          recipient_email: string
          sent_at: string | null
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          provider_message_id?: string | null
          recipient_email: string
          sent_at?: string | null
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          provider_message_id?: string | null
          recipient_email?: string
          sent_at?: string | null
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          component: string | null
          context: Json
          created_at: string
          error_code: string | null
          id: string
          message: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          source: string
          source_name: string
          stack: string | null
          user_id: string | null
        }
        Insert: {
          component?: string | null
          context?: Json
          created_at?: string
          error_code?: string | null
          id?: string
          message: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source?: string
          source_name: string
          stack?: string | null
          user_id?: string | null
        }
        Update: {
          component?: string | null
          context?: Json
          created_at?: string
          error_code?: string | null
          id?: string
          message?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source?: string
          source_name?: string
          stack?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      export_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string | null
          id: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          updated_at: string
          user_email: string | null
          user_id: string | null
          user_identifier: string | null
          worksheet_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string | null
          id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_email?: string | null
          user_id?: string | null
          user_identifier?: string | null
          worksheet_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string | null
          id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_email?: string | null
          user_id?: string | null
          user_identifier?: string | null
          worksheet_id?: string | null
        }
        Relationships: []
      }
      feedbacks: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          status: string
          user_id: string | null
          worksheet_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          status?: string
          user_id?: string | null
          worksheet_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          status?: string
          user_id?: string | null
          worksheet_id?: string
        }
        Relationships: []
      }
      flashcard_cards: {
        Row: {
          back_text: string
          card_position: number
          cefr_level: string | null
          created_at: string | null
          deleted_at: string | null
          front_example: string | null
          front_text: string
          id: string
          set_id: string
          source_type: string
          source_worksheet_id: string | null
        }
        Insert: {
          back_text: string
          card_position?: number
          cefr_level?: string | null
          created_at?: string | null
          deleted_at?: string | null
          front_example?: string | null
          front_text: string
          id?: string
          set_id: string
          source_type?: string
          source_worksheet_id?: string | null
        }
        Update: {
          back_text?: string
          card_position?: number
          cefr_level?: string | null
          created_at?: string | null
          deleted_at?: string | null
          front_example?: string | null
          front_text?: string
          id?: string
          set_id?: string
          source_type?: string
          source_worksheet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_cards_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "flashcard_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcard_cards_source_worksheet_id_fkey"
            columns: ["source_worksheet_id"]
            isOneToOne: false
            referencedRelation: "worksheets"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_progress: {
        Row: {
          card_id: string
          correct_count: number | null
          created_at: string | null
          direction: number
          easiness_factor: number | null
          id: string
          incorrect_count: number | null
          interval_days: number | null
          last_quality_rating: number | null
          last_response_time_ms: number | null
          last_reviewed_at: string | null
          learner_identifier: string
          next_review_date: string | null
          repetition: number | null
          set_id: string
          total_reviews: number | null
          updated_at: string | null
        }
        Insert: {
          card_id: string
          correct_count?: number | null
          created_at?: string | null
          direction?: number
          easiness_factor?: number | null
          id?: string
          incorrect_count?: number | null
          interval_days?: number | null
          last_quality_rating?: number | null
          last_response_time_ms?: number | null
          last_reviewed_at?: string | null
          learner_identifier: string
          next_review_date?: string | null
          repetition?: number | null
          set_id: string
          total_reviews?: number | null
          updated_at?: string | null
        }
        Update: {
          card_id?: string
          correct_count?: number | null
          created_at?: string | null
          direction?: number
          easiness_factor?: number | null
          id?: string
          incorrect_count?: number | null
          interval_days?: number | null
          last_quality_rating?: number | null
          last_response_time_ms?: number | null
          last_reviewed_at?: string | null
          learner_identifier?: string
          next_review_date?: string | null
          repetition?: number | null
          set_id?: string
          total_reviews?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_progress_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "flashcard_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcard_progress_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "flashcard_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_sets: {
        Row: {
          back_type: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          id: string
          is_bidirectional: boolean | null
          share_expires_at: string | null
          share_token: string | null
          student_id: string
          teacher_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          back_type?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_bidirectional?: boolean | null
          share_expires_at?: string | null
          share_token?: string | null
          student_id: string
          teacher_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          back_type?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_bidirectional?: boolean | null
          share_expires_at?: string | null
          share_token?: string | null
          student_id?: string
          teacher_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_sets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcard_sets_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      future_worksheet_suggestions: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          difficulty_level: string | null
          estimated_impact: Json | null
          focus_elements: string[] | null
          focus_skill_names: string[] | null
          generation_context: Json | null
          id: string
          is_used: boolean | null
          phase_id: string | null
          rationale: string | null
          sequence_number: number
          source: string
          student_id: string
          suggested_additional_info: string | null
          suggested_exercise_focus_map: Json | null
          suggested_exercises: string[] | null
          suggested_goal: string | null
          suggested_grammar_focus: string | null
          suggested_topic: string
          suggestion_kind: string | null
          teacher_id: string
          updated_at: string | null
          used_at: string | null
          used_worksheet_id: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          difficulty_level?: string | null
          estimated_impact?: Json | null
          focus_elements?: string[] | null
          focus_skill_names?: string[] | null
          generation_context?: Json | null
          id?: string
          is_used?: boolean | null
          phase_id?: string | null
          rationale?: string | null
          sequence_number?: number
          source?: string
          student_id: string
          suggested_additional_info?: string | null
          suggested_exercise_focus_map?: Json | null
          suggested_exercises?: string[] | null
          suggested_goal?: string | null
          suggested_grammar_focus?: string | null
          suggested_topic: string
          suggestion_kind?: string | null
          teacher_id: string
          updated_at?: string | null
          used_at?: string | null
          used_worksheet_id?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          difficulty_level?: string | null
          estimated_impact?: Json | null
          focus_elements?: string[] | null
          focus_skill_names?: string[] | null
          generation_context?: Json | null
          id?: string
          is_used?: boolean | null
          phase_id?: string | null
          rationale?: string | null
          sequence_number?: number
          source?: string
          student_id?: string
          suggested_additional_info?: string | null
          suggested_exercise_focus_map?: Json | null
          suggested_exercises?: string[] | null
          suggested_goal?: string | null
          suggested_grammar_focus?: string | null
          suggested_topic?: string
          suggestion_kind?: string | null
          teacher_id?: string
          updated_at?: string | null
          used_at?: string | null
          used_worksheet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "future_worksheet_suggestions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "dslm_curriculum_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "future_worksheet_suggestions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "future_worksheet_suggestions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "future_worksheet_suggestions_used_worksheet_id_fkey"
            columns: ["used_worksheet_id"]
            isOneToOne: false
            referencedRelation: "worksheets"
            referencedColumns: ["id"]
          },
        ]
      }
      geolocation_cache: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          ip: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          ip: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          ip?: string
          updated_at?: string
        }
        Relationships: []
      }
      homework_assignments: {
        Row: {
          completed_at: string | null
          completed_by_teacher: boolean | null
          created_at: string
          deadline: string | null
          id: string
          prompt: string | null
          reminder_hours: number | null
          reminder_scheduled_at: string | null
          reminder_sent_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selected_exercises: Json
          share_token: string | null
          source_worksheet_id: string | null
          student_id: string | null
          teacher_id: string
          title: string
          updated_at: string
          view_count: number
          viewed_at: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_by_teacher?: boolean | null
          created_at?: string
          deadline?: string | null
          id?: string
          prompt?: string | null
          reminder_hours?: number | null
          reminder_scheduled_at?: string | null
          reminder_sent_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selected_exercises?: Json
          share_token?: string | null
          source_worksheet_id?: string | null
          student_id?: string | null
          teacher_id: string
          title: string
          updated_at?: string
          view_count?: number
          viewed_at?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_by_teacher?: boolean | null
          created_at?: string
          deadline?: string | null
          id?: string
          prompt?: string | null
          reminder_hours?: number | null
          reminder_scheduled_at?: string | null
          reminder_sent_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selected_exercises?: Json
          share_token?: string | null
          source_worksheet_id?: string | null
          student_id?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string
          view_count?: number
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homework_assignments_source_worksheet_id_fkey"
            columns: ["source_worksheet_id"]
            isOneToOne: false
            referencedRelation: "worksheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_notifications: {
        Row: {
          created_at: string | null
          homework_id: string | null
          id: string
          is_read: boolean | null
          message: string
          notification_type: string
          read_at: string | null
          student_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string | null
          homework_id?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          notification_type: string
          read_at?: string | null
          student_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string | null
          homework_id?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          notification_type?: string
          read_at?: string | null
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_notifications_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_student_answers: {
        Row: {
          ai_evaluation: Json | null
          answers: Json
          audio_answers: Json | null
          eval_trigger: string | null
          exercise_index: number
          exercise_type: string
          homework_id: string
          id: string
          is_submitted: boolean
          item_evaluations: Json | null
          last_saved_at: string
          mastery: number | null
          started_at: string
          student_email: string
          submitted_at: string | null
          time_spent_ms: number | null
        }
        Insert: {
          ai_evaluation?: Json | null
          answers?: Json
          audio_answers?: Json | null
          eval_trigger?: string | null
          exercise_index: number
          exercise_type: string
          homework_id: string
          id?: string
          is_submitted?: boolean
          item_evaluations?: Json | null
          last_saved_at?: string
          mastery?: number | null
          started_at?: string
          student_email: string
          submitted_at?: string | null
          time_spent_ms?: number | null
        }
        Update: {
          ai_evaluation?: Json | null
          answers?: Json
          audio_answers?: Json | null
          eval_trigger?: string | null
          exercise_index?: number
          exercise_type?: string
          homework_id?: string
          id?: string
          is_submitted?: boolean
          item_evaluations?: Json | null
          last_saved_at?: string
          mastery?: number | null
          started_at?: string
          student_email?: string
          submitted_at?: string | null
          time_spent_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "homework_student_answers_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_teacher_comments: {
        Row: {
          comment_text: string
          created_at: string
          exercise_index: number
          homework_id: string
          id: string
          student_email: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          comment_text: string
          created_at?: string
          exercise_index: number
          homework_id: string
          id?: string
          student_email: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          comment_text?: string
          created_at?: string
          exercise_index?: number
          homework_id?: string
          id?: string
          student_email?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_teacher_comments_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_teacher_comments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_teacher_corrections: {
        Row: {
          corrections: Json
          created_at: string | null
          exercise_index: number
          exercise_type: string
          homework_id: string
          id: string
          teacher_id: string
          updated_at: string | null
        }
        Insert: {
          corrections?: Json
          created_at?: string | null
          exercise_index: number
          exercise_type: string
          homework_id: string
          id?: string
          teacher_id: string
          updated_at?: string | null
        }
        Update: {
          corrections?: Json
          created_at?: string | null
          exercise_index?: number
          exercise_type?: string
          homework_id?: string
          id?: string
          teacher_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homework_teacher_corrections_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      pacing_proposals: {
        Row: {
          created_at: string
          current_pacing: number
          decided_at: string | null
          decided_by: string | null
          id: string
          proposed_pacing: number
          reasoning: Json
          status: string
          student_id: string
          teacher_id: string
          trigger_details: Json | null
          trigger_type: string
        }
        Insert: {
          created_at?: string
          current_pacing: number
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          proposed_pacing: number
          reasoning?: Json
          status?: string
          student_id: string
          teacher_id: string
          trigger_details?: Json | null
          trigger_type: string
        }
        Update: {
          created_at?: string
          current_pacing?: number
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          proposed_pacing?: number
          reasoning?: Json
          status?: string
          student_id?: string
          teacher_id?: string
          trigger_details?: Json | null
          trigger_type?: string
        }
        Relationships: []
      }
      pending_worksheet_ai_evaluations: {
        Row: {
          answers: Json
          context: Json | null
          created_at: string
          english_level: string | null
          error_message: string | null
          exercise_index: number
          exercise_type: string
          id: string
          processed_at: string | null
          status: string
          student_email: string
          worksheet_id: string
        }
        Insert: {
          answers: Json
          context?: Json | null
          created_at?: string
          english_level?: string | null
          error_message?: string | null
          exercise_index: number
          exercise_type: string
          id?: string
          processed_at?: string | null
          status?: string
          student_email: string
          worksheet_id: string
        }
        Update: {
          answers?: Json
          context?: Json | null
          created_at?: string
          english_level?: string | null
          error_message?: string | null
          exercise_index?: number
          exercise_type?: string
          id?: string
          processed_at?: string | null
          status?: string
          student_email?: string
          worksheet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_worksheet_ai_evaluations_worksheet_id_fkey"
            columns: ["worksheet_id"]
            isOneToOne: false
            referencedRelation: "worksheets"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_upgrade_sessions: {
        Row: {
          email: string | null
          id: string
          processed_at: string
          session_id: string
          teacher_id: string
          tokens_added: number
          upgrade_details: Json | null
        }
        Insert: {
          email?: string | null
          id?: string
          processed_at?: string
          session_id: string
          teacher_id: string
          tokens_added?: number
          upgrade_details?: Json | null
        }
        Update: {
          email?: string | null
          id?: string
          processed_at?: string
          session_id?: string
          teacher_id?: string
          tokens_added?: number
          upgrade_details?: Json | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          available_tokens: number
          created_at: string
          deleted_at: string | null
          email: string | null
          first_name: string | null
          id: string
          is_tokens_frozen: boolean
          last_limit_reset: string | null
          last_name: string | null
          monthly_worksheet_limit: number | null
          monthly_worksheets_used: number
          onboarding_progress: Json | null
          rollover_tokens: number
          school_institution: string | null
          subscription_expires_at: string | null
          subscription_status: string | null
          subscription_type: string | null
          teaching_preferences: Json | null
          total_tokens_consumed: number | null
          total_tokens_received: number | null
          total_worksheets_created: number | null
          updated_at: string
        }
        Insert: {
          available_tokens?: number
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          is_tokens_frozen?: boolean
          last_limit_reset?: string | null
          last_name?: string | null
          monthly_worksheet_limit?: number | null
          monthly_worksheets_used?: number
          onboarding_progress?: Json | null
          rollover_tokens?: number
          school_institution?: string | null
          subscription_expires_at?: string | null
          subscription_status?: string | null
          subscription_type?: string | null
          teaching_preferences?: Json | null
          total_tokens_consumed?: number | null
          total_tokens_received?: number | null
          total_worksheets_created?: number | null
          updated_at?: string
        }
        Update: {
          available_tokens?: number
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_tokens_frozen?: boolean
          last_limit_reset?: string | null
          last_name?: string | null
          monthly_worksheet_limit?: number | null
          monthly_worksheets_used?: number
          onboarding_progress?: Json | null
          rollover_tokens?: number
          school_institution?: string | null
          subscription_expires_at?: string | null
          subscription_status?: string | null
          subscription_type?: string | null
          teaching_preferences?: Json | null
          total_tokens_consumed?: number | null
          total_tokens_received?: number | null
          total_worksheets_created?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      student_events: {
        Row: {
          created_at: string
          element_type: string | null
          event_payload: Json
          event_source: string
          event_type: string
          id: string
          is_processed: boolean
          mastery: number | null
          session_id: string | null
          skill_ids: string[] | null
          source_id: string | null
          student_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          element_type?: string | null
          event_payload?: Json
          event_source: string
          event_type: string
          id?: string
          is_processed?: boolean
          mastery?: number | null
          session_id?: string | null
          skill_ids?: string[] | null
          source_id?: string | null
          student_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          element_type?: string | null
          event_payload?: Json
          event_source?: string
          event_type?: string
          id?: string
          is_processed?: boolean
          mastery?: number | null
          session_id?: string | null
          skill_ids?: string[] | null
          source_id?: string | null
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_gcal_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          gcal_calendar_id: string | null
          id: string
          refresh_token: string
          settings: Json | null
          student_email: string
          teacher_id: string
          token_expires_at: string
          updated_at: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          gcal_calendar_id?: string | null
          id?: string
          refresh_token: string
          settings?: Json | null
          student_email: string
          teacher_id: string
          token_expires_at: string
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          gcal_calendar_id?: string | null
          id?: string
          refresh_token?: string
          settings?: Json | null
          student_email?: string
          teacher_id?: string
          token_expires_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_gcal_tokens_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_knowledge_entries: {
        Row: {
          category: string
          content: string
          created_at: string | null
          deleted_at: string | null
          entry_source: string | null
          id: string
          is_outdated: boolean | null
          metadata: Json | null
          outdated_at: string | null
          outdated_reason: string | null
          student_id: string
          tags: string[] | null
          teacher_id: string
          updated_at: string | null
          worksheet_id: string | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          deleted_at?: string | null
          entry_source?: string | null
          id?: string
          is_outdated?: boolean | null
          metadata?: Json | null
          outdated_at?: string | null
          outdated_reason?: string | null
          student_id: string
          tags?: string[] | null
          teacher_id: string
          updated_at?: string | null
          worksheet_id?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          deleted_at?: string | null
          entry_source?: string | null
          id?: string
          is_outdated?: boolean | null
          metadata?: Json | null
          outdated_at?: string | null
          outdated_reason?: string | null
          student_id?: string
          tags?: string[] | null
          teacher_id?: string
          updated_at?: string | null
          worksheet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_knowledge_entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_knowledge_entries_worksheet_id_fkey"
            columns: ["worksheet_id"]
            isOneToOne: false
            referencedRelation: "worksheets"
            referencedColumns: ["id"]
          },
        ]
      }
      student_learning_elements: {
        Row: {
          created_at: string | null
          current_rating: number | null
          deleted_at: string | null
          description: string | null
          display_order: number
          element_type: string
          goal_id: string
          id: string
          last_rated_at: string | null
          source: string
          student_id: string
          target_rating: number | null
          teacher_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_rating?: number | null
          deleted_at?: string | null
          description?: string | null
          display_order?: number
          element_type: string
          goal_id: string
          id?: string
          last_rated_at?: string | null
          source?: string
          student_id: string
          target_rating?: number | null
          teacher_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_rating?: number | null
          deleted_at?: string | null
          description?: string | null
          display_order?: number
          element_type?: string
          goal_id?: string
          id?: string
          last_rated_at?: string | null
          source?: string
          student_id?: string
          target_rating?: number | null
          teacher_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_learning_elements_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "student_progress_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_learning_elements_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_learning_elements_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_learning_profiles: {
        Row: {
          ai_summary: string | null
          ambiguity_tolerance: string | null
          anxiety_level: string | null
          communication_score: number | null
          confidence_listening: number | null
          confidence_presenting: number | null
          confidence_reading: number | null
          confidence_small_talk: number | null
          confidence_speaking: number | null
          confidence_writing: number | null
          created_at: string
          error_attitude: string | null
          estimated_level: string | null
          evolution_summary: string | null
          feedback_preference: string | null
          grammar_score: number | null
          id: string
          interest_topics: string[] | null
          level_confidence: string | null
          motivation_type: string | null
          preferred_activities: string[] | null
          preferred_input_channel: string | null
          raw_answers: Json | null
          reading_score: number | null
          self_assessed_level: string | null
          speaking_score: number | null
          strongest_skill: string | null
          student_id: string
          teacher_id: string
          updated_at: string
          vocabulary_score: number | null
          weakest_skill: string | null
          weekly_study_time: string | null
          welcome_test_id: string | null
          writing_score: number | null
        }
        Insert: {
          ai_summary?: string | null
          ambiguity_tolerance?: string | null
          anxiety_level?: string | null
          communication_score?: number | null
          confidence_listening?: number | null
          confidence_presenting?: number | null
          confidence_reading?: number | null
          confidence_small_talk?: number | null
          confidence_speaking?: number | null
          confidence_writing?: number | null
          created_at?: string
          error_attitude?: string | null
          estimated_level?: string | null
          evolution_summary?: string | null
          feedback_preference?: string | null
          grammar_score?: number | null
          id?: string
          interest_topics?: string[] | null
          level_confidence?: string | null
          motivation_type?: string | null
          preferred_activities?: string[] | null
          preferred_input_channel?: string | null
          raw_answers?: Json | null
          reading_score?: number | null
          self_assessed_level?: string | null
          speaking_score?: number | null
          strongest_skill?: string | null
          student_id: string
          teacher_id: string
          updated_at?: string
          vocabulary_score?: number | null
          weakest_skill?: string | null
          weekly_study_time?: string | null
          welcome_test_id?: string | null
          writing_score?: number | null
        }
        Update: {
          ai_summary?: string | null
          ambiguity_tolerance?: string | null
          anxiety_level?: string | null
          communication_score?: number | null
          confidence_listening?: number | null
          confidence_presenting?: number | null
          confidence_reading?: number | null
          confidence_small_talk?: number | null
          confidence_speaking?: number | null
          confidence_writing?: number | null
          created_at?: string
          error_attitude?: string | null
          estimated_level?: string | null
          evolution_summary?: string | null
          feedback_preference?: string | null
          grammar_score?: number | null
          id?: string
          interest_topics?: string[] | null
          level_confidence?: string | null
          motivation_type?: string | null
          preferred_activities?: string[] | null
          preferred_input_channel?: string | null
          raw_answers?: Json | null
          reading_score?: number | null
          self_assessed_level?: string | null
          speaking_score?: number | null
          strongest_skill?: string | null
          student_id?: string
          teacher_id?: string
          updated_at?: string
          vocabulary_score?: number | null
          weakest_skill?: string | null
          weekly_study_time?: string | null
          welcome_test_id?: string | null
          writing_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_learning_profiles_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_learning_profiles_welcome_test_id_fkey"
            columns: ["welcome_test_id"]
            isOneToOne: false
            referencedRelation: "student_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      student_progress_goals: {
        Row: {
          achieved_at: string | null
          archived_at: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          display_order: number
          goal_type: string
          id: string
          is_achieved: boolean | null
          manual_progress_pct: number | null
          student_id: string
          target_date: string | null
          teacher_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          achieved_at?: string | null
          archived_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          display_order?: number
          goal_type: string
          id?: string
          is_achieved?: boolean | null
          manual_progress_pct?: number | null
          student_id: string
          target_date?: string | null
          teacher_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          achieved_at?: string | null
          archived_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          display_order?: number
          goal_type?: string
          id?: string
          is_achieved?: boolean | null
          manual_progress_pct?: number | null
          student_id?: string
          target_date?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_progress_goals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_progress_goals_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_skill_metrics: {
        Row: {
          created_at: string
          current_mastery: number | null
          first_event_at: string | null
          id: string
          last_event_at: string | null
          mastery_history: Json | null
          micro_skill: string | null
          skill_category: string
          skill_name: string
          student_id: string
          teacher_id: string
          total_events: number | null
          trend: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_mastery?: number | null
          first_event_at?: string | null
          id?: string
          last_event_at?: string | null
          mastery_history?: Json | null
          micro_skill?: string | null
          skill_category: string
          skill_name: string
          student_id: string
          teacher_id: string
          total_events?: number | null
          trend?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_mastery?: number | null
          first_event_at?: string | null
          id?: string
          last_event_at?: string | null
          mastery_history?: Json | null
          micro_skill?: string | null
          skill_category?: string
          skill_name?: string
          student_id?: string
          teacher_id?: string
          total_events?: number | null
          trend?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_skill_metrics_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_test_questions: {
        Row: {
          ai_feedback: string | null
          answered_at: string | null
          correct_answer: Json
          created_at: string | null
          difficulty_level: number | null
          element_type: string | null
          explanation: string | null
          id: string
          is_correct: boolean | null
          question_data: Json | null
          question_index: number
          question_text: string
          question_type: string
          skill_tags: string[] | null
          student_answer: Json | null
          test_id: string
          time_spent_seconds: number | null
        }
        Insert: {
          ai_feedback?: string | null
          answered_at?: string | null
          correct_answer: Json
          created_at?: string | null
          difficulty_level?: number | null
          element_type?: string | null
          explanation?: string | null
          id?: string
          is_correct?: boolean | null
          question_data?: Json | null
          question_index: number
          question_text: string
          question_type: string
          skill_tags?: string[] | null
          student_answer?: Json | null
          test_id: string
          time_spent_seconds?: number | null
        }
        Update: {
          ai_feedback?: string | null
          answered_at?: string | null
          correct_answer?: Json
          created_at?: string | null
          difficulty_level?: number | null
          element_type?: string | null
          explanation?: string | null
          id?: string
          is_correct?: boolean | null
          question_data?: Json | null
          question_index?: number
          question_text?: string
          question_type?: string
          skill_tags?: string[] | null
          student_answer?: Json | null
          test_id?: string
          time_spent_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_test_questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "student_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      student_tests: {
        Row: {
          ai_generated: boolean | null
          answered_count: number | null
          assigned_at: string | null
          attempt_number: number
          completed_at: string | null
          correct_answers: number | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          generation_params: Json | null
          id: string
          linked_element_ids: string[] | null
          linked_goal_id: string | null
          previous_attempt_id: string | null
          reviewed_at: string | null
          score_percentage: number | null
          share_expires_at: string | null
          share_token: string | null
          started_at: string | null
          status: string
          student_id: string
          teacher_id: string
          test_type: string
          time_spent_seconds: number | null
          title: string
          total_questions: number | null
          updated_at: string | null
        }
        Insert: {
          ai_generated?: boolean | null
          answered_count?: number | null
          assigned_at?: string | null
          attempt_number?: number
          completed_at?: string | null
          correct_answers?: number | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          generation_params?: Json | null
          id?: string
          linked_element_ids?: string[] | null
          linked_goal_id?: string | null
          previous_attempt_id?: string | null
          reviewed_at?: string | null
          score_percentage?: number | null
          share_expires_at?: string | null
          share_token?: string | null
          started_at?: string | null
          status?: string
          student_id: string
          teacher_id: string
          test_type: string
          time_spent_seconds?: number | null
          title: string
          total_questions?: number | null
          updated_at?: string | null
        }
        Update: {
          ai_generated?: boolean | null
          answered_count?: number | null
          assigned_at?: string | null
          attempt_number?: number
          completed_at?: string | null
          correct_answers?: number | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          generation_params?: Json | null
          id?: string
          linked_element_ids?: string[] | null
          linked_goal_id?: string | null
          previous_attempt_id?: string | null
          reviewed_at?: string | null
          score_percentage?: number | null
          share_expires_at?: string | null
          share_token?: string | null
          started_at?: string | null
          status?: string
          student_id?: string
          teacher_id?: string
          test_type?: string
          time_spent_seconds?: number | null
          title?: string
          total_questions?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_tests_linked_goal_id_fkey"
            columns: ["linked_goal_id"]
            isOneToOne: false
            referencedRelation: "student_progress_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_tests_previous_attempt_id_fkey"
            columns: ["previous_attempt_id"]
            isOneToOne: false
            referencedRelation: "student_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_tests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_tests_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          deleted_at: string | null
          dslm_pacing_mode: number
          dslm_use_roadmap: boolean
          english_level: string
          hub_password_hash: string | null
          id: string
          is_demo_student: boolean
          last_pacing_reasoning: Json | null
          last_pacing_recalc_at: string | null
          last_pacing_set_manually: boolean | null
          main_goal: string
          main_goal_target_date: string | null
          name: string
          native_language: string | null
          send_overdue_emails: boolean | null
          student_email: string | null
          teacher_email: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          dslm_pacing_mode?: number
          dslm_use_roadmap?: boolean
          english_level: string
          hub_password_hash?: string | null
          id?: string
          is_demo_student?: boolean
          last_pacing_reasoning?: Json | null
          last_pacing_recalc_at?: string | null
          last_pacing_set_manually?: boolean | null
          main_goal: string
          main_goal_target_date?: string | null
          name: string
          native_language?: string | null
          send_overdue_emails?: boolean | null
          student_email?: string | null
          teacher_email?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          dslm_pacing_mode?: number
          dslm_use_roadmap?: boolean
          english_level?: string
          hub_password_hash?: string | null
          id?: string
          is_demo_student?: boolean
          last_pacing_reasoning?: Json | null
          last_pacing_recalc_at?: string | null
          last_pacing_set_manually?: boolean | null
          main_goal?: string
          main_goal_target_date?: string | null
          name?: string
          native_language?: string | null
          send_overdue_emails?: boolean | null
          student_email?: string | null
          teacher_email?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_events: {
        Row: {
          created_at: string
          email: string | null
          event_data: Json | null
          event_type: string
          id: string
          new_plan_type: string | null
          old_plan_type: string | null
          stripe_event_id: string | null
          teacher_id: string
          tokens_added: number | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          new_plan_type?: string | null
          old_plan_type?: string | null
          stripe_event_id?: string | null
          teacher_id: string
          tokens_added?: number | null
        }
        Update: {
          created_at?: string
          email?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          new_plan_type?: string | null
          old_plan_type?: string | null
          stripe_event_id?: string | null
          teacher_id?: string
          tokens_added?: number | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string
          current_period_start: string
          email: string | null
          id: string
          monthly_limit: number
          stripe_customer_id: string
          stripe_subscription_id: string
          subscription_status: string
          subscription_type: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end: string
          current_period_start: string
          email?: string | null
          id?: string
          monthly_limit: number
          stripe_customer_id: string
          stripe_subscription_id: string
          subscription_status: string
          subscription_type: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          email?: string | null
          id?: string
          monthly_limit?: number
          stripe_customer_id?: string
          stripe_subscription_id?: string
          subscription_status?: string
          subscription_type?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_health_metrics: {
        Row: {
          alerts_emitted: number
          created_at: string
          error_message: string | null
          id: string
          loop_id: string
          metadata: Json | null
          rows_processed: number | null
          run_finished_at: string | null
          run_started_at: string
          signals_emitted: number
          status: string
        }
        Insert: {
          alerts_emitted?: number
          created_at?: string
          error_message?: string | null
          id?: string
          loop_id: string
          metadata?: Json | null
          rows_processed?: number | null
          run_finished_at?: string | null
          run_started_at?: string
          signals_emitted?: number
          status?: string
        }
        Update: {
          alerts_emitted?: number
          created_at?: string
          error_message?: string | null
          id?: string
          loop_id?: string
          metadata?: Json | null
          rows_processed?: number | null
          run_finished_at?: string | null
          run_started_at?: string
          signals_emitted?: number
          status?: string
        }
        Relationships: []
      }
      teacher_ai_eval_feedback: {
        Row: {
          created_at: string | null
          exercise_index: number
          exercise_type: string
          feedback_text: string | null
          id: string
          quality_score: number | null
          question_index: number
          teacher_id: string
          thumbs_up: boolean
          worksheet_id: string
        }
        Insert: {
          created_at?: string | null
          exercise_index: number
          exercise_type: string
          feedback_text?: string | null
          id?: string
          quality_score?: number | null
          question_index: number
          teacher_id: string
          thumbs_up: boolean
          worksheet_id: string
        }
        Update: {
          created_at?: string | null
          exercise_index?: number
          exercise_type?: string
          feedback_text?: string | null
          id?: string
          quality_score?: number | null
          question_index?: number
          teacher_id?: string
          thumbs_up?: boolean
          worksheet_id?: string
        }
        Relationships: []
      }
      teacher_alerts: {
        Row: {
          alert_type: string
          created_at: string
          cta_label: string | null
          cta_url: string | null
          expires_at: string | null
          id: string
          idempotency_key: string | null
          is_dismissed: boolean
          is_read: boolean
          message: string
          payload: Json
          severity: string
          source_loop_id: string | null
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          is_dismissed?: boolean
          is_read?: boolean
          message: string
          payload?: Json
          severity?: string
          source_loop_id?: string | null
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          is_dismissed?: boolean
          is_read?: boolean
          message?: string
          payload?: Json
          severity?: string
          source_loop_id?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      test_skill_results: {
        Row: {
          applied_at: string | null
          applied_to_element_id: string | null
          correct_answers: number
          created_at: string | null
          element_type: string
          id: string
          score_percentage: number | null
          skill_tags: string[] | null
          student_id: string
          suggested_rating: number | null
          test_id: string
          total_questions: number
        }
        Insert: {
          applied_at?: string | null
          applied_to_element_id?: string | null
          correct_answers?: number
          created_at?: string | null
          element_type: string
          id?: string
          score_percentage?: number | null
          skill_tags?: string[] | null
          student_id: string
          suggested_rating?: number | null
          test_id: string
          total_questions?: number
        }
        Update: {
          applied_at?: string | null
          applied_to_element_id?: string | null
          correct_answers?: number
          created_at?: string | null
          element_type?: string
          id?: string
          score_percentage?: number | null
          skill_tags?: string[] | null
          student_id?: string
          suggested_rating?: number | null
          test_id?: string
          total_questions?: number
        }
        Relationships: [
          {
            foreignKeyName: "test_skill_results_applied_to_element_id_fkey"
            columns: ["applied_to_element_id"]
            isOneToOne: false
            referencedRelation: "student_learning_elements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_skill_results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_skill_results_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "student_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      token_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          teacher_email: string | null
          teacher_id: string
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          teacher_email?: string | null
          teacher_id: string
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          teacher_email?: string | null
          teacher_id?: string
          transaction_type?: string
        }
        Relationships: []
      }
      user_events: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          ip_address: string | null
          session_id: string | null
          user_agent: string | null
          user_identifier: string
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_identifier: string
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_identifier?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      worksheet_drawings: {
        Row: {
          created_at: string
          drawing_data: Json
          id: string
          teacher_id: string
          updated_at: string
          worksheet_id: string
        }
        Insert: {
          created_at?: string
          drawing_data?: Json
          id?: string
          teacher_id: string
          updated_at?: string
          worksheet_id: string
        }
        Update: {
          created_at?: string
          drawing_data?: Json
          id?: string
          teacher_id?: string
          updated_at?: string
          worksheet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worksheet_drawings_worksheet_id_fkey"
            columns: ["worksheet_id"]
            isOneToOne: true
            referencedRelation: "worksheets"
            referencedColumns: ["id"]
          },
        ]
      }
      worksheet_student_answers: {
        Row: {
          ai_evaluation: Json | null
          answers: Json
          audio_answers: Json | null
          completed_at: string | null
          eval_trigger: string | null
          exercise_index: number
          exercise_type: string
          id: string
          is_completed: boolean
          item_evaluations: Json | null
          last_ai_eval_at: string | null
          last_saved_at: string
          mastery: number | null
          started_at: string
          student_email: string
          time_spent_ms: number | null
          worksheet_id: string
        }
        Insert: {
          ai_evaluation?: Json | null
          answers?: Json
          audio_answers?: Json | null
          completed_at?: string | null
          eval_trigger?: string | null
          exercise_index: number
          exercise_type: string
          id?: string
          is_completed?: boolean
          item_evaluations?: Json | null
          last_ai_eval_at?: string | null
          last_saved_at?: string
          mastery?: number | null
          started_at?: string
          student_email: string
          time_spent_ms?: number | null
          worksheet_id: string
        }
        Update: {
          ai_evaluation?: Json | null
          answers?: Json
          audio_answers?: Json | null
          completed_at?: string | null
          eval_trigger?: string | null
          exercise_index?: number
          exercise_type?: string
          id?: string
          is_completed?: boolean
          item_evaluations?: Json | null
          last_ai_eval_at?: string | null
          last_saved_at?: string
          mastery?: number | null
          started_at?: string
          student_email?: string
          time_spent_ms?: number | null
          worksheet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worksheet_student_answers_worksheet_id_fkey"
            columns: ["worksheet_id"]
            isOneToOne: false
            referencedRelation: "worksheets"
            referencedColumns: ["id"]
          },
        ]
      }
      worksheets: {
        Row: {
          ai_response: string
          audio_duration: number | null
          audio_transcript: string | null
          audio_url: string | null
          audio_voice: string | null
          city: string | null
          country: string | null
          created_at: string
          deleted_at: string | null
          download_count: number
          form_data: Json
          generation_time_seconds: number | null
          html_content: string
          id: string
          ip_address: string | null
          last_modified_at: string
          media_metadata: Json | null
          prompt: string
          referrer_url: string | null
          selected_audio: Json | null
          selected_image: Json | null
          sequence_number: number
          session_id: string | null
          share_expires_at: string | null
          share_recipient_email: string | null
          share_token: string | null
          status: string
          student_id: string | null
          teacher_email: string | null
          teacher_id: string | null
          title: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          ai_response: string
          audio_duration?: number | null
          audio_transcript?: string | null
          audio_url?: string | null
          audio_voice?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          download_count?: number
          form_data: Json
          generation_time_seconds?: number | null
          html_content: string
          id?: string
          ip_address?: string | null
          last_modified_at?: string
          media_metadata?: Json | null
          prompt: string
          referrer_url?: string | null
          selected_audio?: Json | null
          selected_image?: Json | null
          sequence_number?: number
          session_id?: string | null
          share_expires_at?: string | null
          share_recipient_email?: string | null
          share_token?: string | null
          status?: string
          student_id?: string | null
          teacher_email?: string | null
          teacher_id?: string | null
          title?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          ai_response?: string
          audio_duration?: number | null
          audio_transcript?: string | null
          audio_url?: string | null
          audio_voice?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          download_count?: number
          form_data?: Json
          generation_time_seconds?: number | null
          html_content?: string
          id?: string
          ip_address?: string | null
          last_modified_at?: string
          media_metadata?: Json | null
          prompt?: string
          referrer_url?: string | null
          selected_audio?: Json | null
          selected_image?: Json | null
          sequence_number?: number
          session_id?: string | null
          share_expires_at?: string | null
          share_recipient_email?: string | null
          share_token?: string | null
          status?: string
          student_id?: string | null
          teacher_email?: string | null
          teacher_id?: string | null
          title?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      conversion_funnel: {
        Row: {
          date: string | null
          download_attempts_locked: number | null
          download_attempts_unlocked: number | null
          form_abandons_page_leave: number | null
          form_abandons_tab_switch: number | null
          form_starts: number | null
          form_submits: number | null
          payment_button_clicks: number | null
          stripe_payments_success: number | null
          worksheet_generation_completes: number | null
          worksheet_generation_starts: number | null
          worksheet_view_ends_page_leave: number | null
          worksheet_view_ends_tab_switch: number | null
          worksheet_views: number | null
        }
        Relationships: []
      }
      popular_form_params: {
        Row: {
          avg_generation_time: number | null
          english_level: string | null
          lesson_goal: string | null
          lesson_time: string | null
          lesson_topic: string | null
          usage_count: number | null
        }
        Relationships: []
      }
      student_category_metrics: {
        Row: {
          avg_mastery: number | null
          category: string | null
          last_activity: string | null
          skill_count: number | null
          student_id: string | null
          teacher_id: string | null
          total_events: number | null
          trend: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_skill_metrics_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_micro_skill_metrics: {
        Row: {
          avg_mastery: number | null
          last_activity: string | null
          micro_skill: string | null
          nano_skill_count: number | null
          skill_category: string | null
          student_id: string | null
          teacher_id: string | null
          total_events: number | null
          trend: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_skill_metrics_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_student_event: {
        Args: {
          p_element_type?: string
          p_event_payload?: Json
          p_event_source: string
          p_event_type: string
          p_session_id?: string
          p_skill_ids?: string[]
          p_source_id?: string
          p_student_id: string
          p_teacher_id: string
        }
        Returns: string
      }
      add_tokens: {
        Args: {
          p_amount: number
          p_description: string
          p_reference_id?: string
          p_teacher_id: string
        }
        Returns: undefined
      }
      backfill_skill_metrics: {
        Args: { p_student_id?: string }
        Returns: number
      }
      calculate_test_results: { Args: { p_test_id: string }; Returns: Json }
      clean_old_geolocation_cache: { Args: never; Returns: undefined }
      cleanup_worksheet_base64: {
        Args: never
        Returns: {
          table_size_after: string
          table_size_before: string
          worksheets_cleaned: number
        }[]
      }
      compute_skill_metric: {
        Args: {
          p_skill_category: string
          p_skill_name: string
          p_student_id: string
          p_teacher_id: string
        }
        Returns: undefined
      }
      consume_token: {
        Args: { p_teacher_id: string; p_worksheet_id: string }
        Returns: boolean
      }
      extract_micro_skill: { Args: { skill_name: string }; Returns: string }
      extract_skill_category: { Args: { skill_name: string }; Returns: string }
      find_student_by_email: {
        Args: { p_email: string; p_teacher_id: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      generate_flashcard_share_token: {
        Args: {
          p_expires_hours?: number
          p_set_id: string
          p_teacher_id: string
        }
        Returns: string
      }
      generate_homework_share_token: {
        Args: { p_homework_id: string; p_teacher_id: string }
        Returns: string
      }
      generate_test_share_token: {
        Args: {
          p_expires_hours?: number
          p_teacher_id: string
          p_test_id: string
        }
        Returns: string
      }
      generate_worksheet_share_token: {
        Args: {
          p_expires_hours?: number
          p_teacher_id: string
          p_worksheet_id: string
        }
        Returns: string
      }
      get_flashcard_cards_for_learning: {
        Args: { p_learner_identifier: string; p_set_id: string }
        Returns: {
          back_text: string
          card_id: string
          card_position: number
          correct_count: number
          direction: number
          easiness_factor: number
          front_example: string
          front_text: string
          incorrect_count: number
          interval_days: number
          next_review_date: string
          repetition: number
          total_reviews: number
        }[]
      }
      get_flashcard_set_by_share_token: {
        Args: { p_share_token: string }
        Returns: {
          cards_count: number
          created_at: string
          description: string
          id: string
          is_bidirectional: boolean
          student_name: string
          student_native_language: string
          teacher_email: string
          teacher_first_name: string
          teacher_last_name: string
          title: string
        }[]
      }
      get_homework_by_share_token: {
        Args: { p_share_token: string }
        Returns: {
          audio_url: string
          created_at: string
          deadline: string
          id: string
          selected_audio: Json
          selected_exercises: Json
          selected_image: Json
          source_worksheet_title: string
          student_english_level: string
          student_name: string
          teacher_email: string
          teacher_first_name: string
          teacher_last_name: string
          title: string
        }[]
      }
      get_homework_comments: {
        Args: { p_homework_id: string; p_student_email: string }
        Returns: {
          comment_text: string
          created_at: string
          exercise_index: number
          id: string
          updated_at: string
        }[]
      }
      get_public_status: {
        Args: never
        Returns: {
          component: string
          error_count_24h: number
          last_incident_at: string
          status: string
        }[]
      }
      get_student_homework_answers: {
        Args: { p_homework_id: string; p_student_email: string }
        Returns: {
          ai_evaluation: Json
          answers: Json
          audio_answers: Json
          exercise_index: number
          exercise_type: string
          id: string
          is_submitted: boolean
          item_evaluations: Json
          last_saved_at: string
          mastery: number
          started_at: string
          submitted_at: string
        }[]
      }
      get_student_meeting_link: {
        Args: { p_student_id: string; p_teacher_id: string }
        Returns: string
      }
      get_student_tags: {
        Args: { p_student_id: string; p_teacher_id: string }
        Returns: string[]
      }
      get_test_by_share_token: {
        Args: { p_share_token: string }
        Returns: {
          created_at: string
          description: string
          id: string
          status: string
          student_name: string
          teacher_email: string
          teacher_first_name: string
          teacher_last_name: string
          test_type: string
          title: string
          total_questions: number
        }[]
      }
      get_test_status_by_share_token: {
        Args: { p_share_token: string }
        Returns: {
          is_expired: boolean
          teacher_email: string
          test_exists: boolean
        }[]
      }
      get_token_balance: { Args: { p_teacher_id: string }; Returns: number }
      get_worksheet_by_share_token: {
        Args: { p_share_token: string }
        Returns: {
          ai_response: string
          audio_url: string
          created_at: string
          html_content: string
          id: string
          selected_audio: Json
          selected_image: Json
          teacher_email: string
          title: string
        }[]
      }
      get_worksheet_live_answers: {
        Args: { p_worksheet_id: string }
        Returns: {
          ai_evaluation: Json
          answers: Json
          audio_answers: Json
          exercise_index: number
          exercise_type: string
          id: string
          item_evaluations: Json
          last_saved_at: string
          mastery: number
          student_email: string
        }[]
      }
      get_worksheet_student_answers: {
        Args: { p_student_email: string; p_worksheet_id: string }
        Returns: {
          ai_evaluation: Json
          answers: Json
          audio_answers: Json
          completed_at: string
          exercise_index: number
          exercise_type: string
          id: string
          is_completed: boolean
          item_evaluations: Json
          last_saved_at: string
          mastery: number
          started_at: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_worksheet_download_count: {
        Args: { p_worksheet_id: string }
        Returns: number
      }
      insert_homework_submission_notification: {
        Args: { p_homework_id: string; p_message?: string }
        Returns: undefined
      }
      insert_worksheet_bypass_limit:
        | {
            Args: {
              p_ai_response: string
              p_city?: string
              p_country?: string
              p_form_data: Json
              p_generation_time_seconds: number
              p_html_content: string
              p_ip_address: string
              p_prompt: string
              p_status: string
              p_title: string
              p_user_id: string
            }
            Returns: {
              created_at: string
              id: string
              title: string
            }[]
          }
        | {
            Args: {
              p_ai_response: string
              p_city?: string
              p_country?: string
              p_form_data: Json
              p_generation_time_seconds: number
              p_html_content: string
              p_ip_address: string
              p_prompt: string
              p_status: string
              p_teacher_email?: string
              p_title: string
              p_user_id: string
            }
            Returns: {
              created_at: string
              id: string
              title: string
            }[]
          }
      is_user_anonymous: { Args: { user_id: string }; Returns: boolean }
      mark_ai_evaluation_done: {
        Args: {
          p_exercise_index: number
          p_student_email: string
          p_worksheet_id: string
        }
        Returns: undefined
      }
      mark_homework_completed: {
        Args: {
          p_homework_id: string
          p_is_teacher?: boolean
          p_user_id: string
        }
        Returns: Json
      }
      mark_knowledge_current: {
        Args: { p_entry_id: string; p_teacher_id: string }
        Returns: boolean
      }
      mark_knowledge_outdated: {
        Args: { p_entry_id: string; p_reason?: string; p_teacher_id: string }
        Returns: boolean
      }
      needs_ai_evaluation: {
        Args: {
          p_exercise_index: number
          p_student_email: string
          p_worksheet_id: string
        }
        Returns: boolean
      }
      normalize_tag: { Args: { tag: string }; Returns: string }
      queue_worksheet_ai_evaluation: {
        Args: {
          p_answers: Json
          p_context?: Json
          p_english_level?: string
          p_exercise_index: number
          p_exercise_type: string
          p_student_email: string
          p_worksheet_id: string
        }
        Returns: string
      }
      reactivate_user_account: {
        Args: { user_email: string }
        Returns: boolean
      }
      save_homework_answer:
        | {
            Args: {
              p_answers: Json
              p_exercise_index: number
              p_exercise_type: string
              p_homework_id: string
              p_student_email: string
            }
            Returns: string
          }
        | {
            Args: {
              p_answers: Json
              p_exercise_index: number
              p_exercise_type: string
              p_homework_id: string
              p_student_email: string
              p_time_spent_ms?: number
            }
            Returns: string
          }
        | {
            Args: {
              p_answers: Json
              p_exercise_index: number
              p_exercise_type: string
              p_homework_id: string
              p_mastery?: number
              p_student_email: string
              p_time_spent_ms?: number
            }
            Returns: string
          }
        | {
            Args: {
              p_answers: Json
              p_exercise_index: number
              p_exercise_type: string
              p_homework_id: string
              p_item_evaluations?: Json
              p_mastery?: number
              p_student_email: string
              p_time_spent_ms?: number
            }
            Returns: string
          }
        | {
            Args: {
              p_answers: Json
              p_audio_answers?: Json
              p_exercise_index: number
              p_exercise_type: string
              p_homework_id: string
              p_item_evaluations?: Json
              p_mastery?: number
              p_student_email: string
              p_time_spent_ms?: number
            }
            Returns: string
          }
      save_teacher_comment: {
        Args: {
          p_comment_text: string
          p_exercise_index: number
          p_homework_id: string
          p_student_email: string
          p_teacher_id: string
        }
        Returns: string
      }
      save_worksheet_answer:
        | {
            Args: {
              p_answers: Json
              p_exercise_index: number
              p_exercise_type: string
              p_student_email: string
              p_worksheet_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_answers: Json
              p_exercise_index: number
              p_exercise_type: string
              p_student_email: string
              p_time_spent_ms?: number
              p_worksheet_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_answers: Json
              p_exercise_index: number
              p_exercise_type: string
              p_mastery?: number
              p_student_email: string
              p_time_spent_ms?: number
              p_worksheet_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_answers: Json
              p_exercise_index: number
              p_exercise_type: string
              p_item_evaluations?: Json
              p_mastery?: number
              p_student_email: string
              p_time_spent_ms?: number
              p_worksheet_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_answers: Json
              p_audio_answers?: Json
              p_exercise_index: number
              p_exercise_type: string
              p_item_evaluations?: Json
              p_mastery?: number
              p_student_email: string
              p_time_spent_ms?: number
              p_worksheet_id: string
            }
            Returns: string
          }
      should_show_onboarding: { Args: { user_id: string }; Returns: boolean }
      soft_delete_flashcard_set: {
        Args: { p_set_id: string; p_teacher_id: string }
        Returns: boolean
      }
      soft_delete_knowledge_entry: {
        Args: { p_entry_id: string; p_teacher_id: string }
        Returns: boolean
      }
      soft_delete_student: {
        Args: { p_student_id: string; p_teacher_id: string }
        Returns: boolean
      }
      soft_delete_user_account: { Args: { user_id: string }; Returns: boolean }
      soft_delete_worksheet: {
        Args: { p_teacher_id: string; p_worksheet_id: string }
        Returns: boolean
      }
      submit_homework_answers: {
        Args: { p_homework_id: string; p_student_email: string }
        Returns: boolean
      }
      track_user_event: {
        Args: {
          p_event_data?: Json
          p_event_type: string
          p_ip_address?: string
          p_session_id?: string
          p_user_agent?: string
          p_user_identifier: string
        }
        Returns: string
      }
      verify_homework_student_email: {
        Args: { p_email: string; p_homework_id: string }
        Returns: boolean
      }
      verify_worksheet_student_email: {
        Args: { p_email: string; p_worksheet_id: string }
        Returns: boolean
      }
      welcome_test_canonical_id: { Args: { p_legacy: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "teacher"
      english_level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
      main_goal:
        | "grammar"
        | "vocabulary"
        | "speaking"
        | "listening"
        | "reading"
        | "writing"
        | "pronunciation"
        | "fluency"
        | "confidence"
        | "exam_preparation"
        | "business_english"
        | "academic_english"
        | "travel_english"
        | "conversation"
        | "mixed"
      subscription_status:
        | "active"
        | "active_cancelled"
        | "cancelled"
        | "expired"
        | "paused"
        | "pending"
      user_role_enum: "user" | "admin"
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
      app_role: ["admin", "teacher"],
      english_level: ["A1", "A2", "B1", "B2", "C1", "C2"],
      main_goal: [
        "grammar",
        "vocabulary",
        "speaking",
        "listening",
        "reading",
        "writing",
        "pronunciation",
        "fluency",
        "confidence",
        "exam_preparation",
        "business_english",
        "academic_english",
        "travel_english",
        "conversation",
        "mixed",
      ],
      subscription_status: [
        "active",
        "active_cancelled",
        "cancelled",
        "expired",
        "paused",
        "pending",
      ],
      user_role_enum: ["user", "admin"],
    },
  },
} as const

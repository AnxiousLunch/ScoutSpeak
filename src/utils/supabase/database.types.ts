export type Database = {
  public: {
    Tables: {
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

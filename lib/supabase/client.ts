import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = 'https://bqzdefquikdxiqdgkgjp.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxemRlZnF1aWtkeGlxZGdrZ2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjE0MzYsImV4cCI6MjA5MDIzNzQzNn0.vTqtcEFvq30JGesxWXhgUFgKu8EOOdPvJRIrSLglKG4'

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}

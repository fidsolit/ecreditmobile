import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
const supabaseUrl = "https://ngbdnjimkuwicitgwrqh.supabase.co";
const supabasePublishableKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nYmRuamlta3V3aWNpdGd3cnFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxMTgxMzMsImV4cCI6MjA3MzY5NDEzM30.D_F3pfXC40Icl-NCg_WpUF4q-pNH0Izb5_vAAauGlzE";
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
// lib/supabase.ts

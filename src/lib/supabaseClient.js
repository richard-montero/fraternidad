import { createClient } from "@supabase/supabase-js";

// =====================================================================
// CONFIGURACIÓN DE CONEXIÓN A SUPABASE
// -----------------------------------------------------------------------
// Estas dos variables son las ÚNICAS que necesitas cambiar para conectar
// esta aplicación a tu propio proyecto de Supabase.
//
// Las tomas de tu panel de Supabase → Project Settings → API:
//   - VITE_SUPABASE_URL         = "Project URL"
//   - VITE_SUPABASE_ANON_KEY    = "Publishable key" (también llamada "anon key")
//
// En Netlify se configuran en: Site settings → Environment variables.
// En tu computadora se configuran en el archivo ".env" (ver ".env.example").
// =====================================================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    "Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. Revisa el archivo .env o las variables de entorno en Netlify."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "fraternidad-sesion-principal",
  },
});

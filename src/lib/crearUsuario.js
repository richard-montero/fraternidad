import { createClient } from "@supabase/supabase-js";

// =====================================================================
// CREAR UN NUEVO USUARIO DE ACCESO (SIN SALIR DE LA SESIÓN ACTUAL)
// -----------------------------------------------------------------------
// Supabase permite registrar usuarios nuevos usando la misma llave pública
// (anon key) que ya usa toda la aplicación — no se necesita ninguna llave
// secreta ni Edge Function.
//
// El único detalle técnico es que la función de registro (signUp) intenta
// iniciar sesión automáticamente como el usuario recién creado. Para que
// el administrador que está creando el socio NO pierda su propia sesión,
// usamos aquí un cliente de Supabase "temporal" e independiente, que no
// comparte el almacenamiento de sesión con el cliente principal de la app.
// =====================================================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function crearUsuarioDeAcceso(email, password) {
  const clienteTemporal = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await clienteTemporal.auth.signUp({
    email,
    password,
  });

  if (error) throw error;
  if (!data?.user?.id) {
    throw new Error("No se pudo crear el usuario de acceso. Intenta nuevamente.");
  }

  return data.user.id; // este id se guarda como auth_user_id en la tabla "socios"
}

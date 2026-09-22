import { supabase } from "./supabaseClient.js";

// Llama a la función en la nube que manda los correos (Edge Function
// "enviar-avisos"). Usa el mismo inicio de sesión del usuario actual —
// la función revisa del lado de la base de datos que sea administrador.
export async function invocarAviso(tipo, datosExtra = {}) {
  const { data, error } = await supabase.functions.invoke("enviar-avisos", {
    body: { tipo, ...datosExtra },
  });
  if (error) throw error;
  return data;
}

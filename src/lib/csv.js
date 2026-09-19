// =====================================================================
// Exportación simple a CSV, sin dependencias externas.
// =====================================================================

function escaparCelda(valor) {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  if (/[",\n;]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

/**
 * columnas: [{ label: "Fecha", get: (fila) => fila.fecha }]
 */
export function exportarCSV(nombreArchivo, columnas, filas) {
  const encabezado = columnas.map((c) => escaparCelda(c.label)).join(";");
  const cuerpo = filas.map((f) => columnas.map((c) => escaparCelda(c.get(f))).join(";")).join("\n");
  const contenido = "\uFEFF" + encabezado + "\n" + cuerpo;

  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo.endsWith(".csv") ? nombreArchivo : `${nombreArchivo}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

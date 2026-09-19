import * as XLSX from "xlsx";

// Exporta una o varias hojas a un archivo .xlsx real (no CSV).
// hojas: [{ nombre: "Resumen", columnas: [{label, get}], filas: [...] }]
export function exportarExcel(nombreArchivo, hojas) {
  const libro = XLSX.utils.book_new();
  hojas.forEach((hoja) => {
    const filasPlanas = hoja.filas.map((f) => {
      const obj = {};
      hoja.columnas.forEach((c) => { obj[c.label] = c.get(f); });
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(filasPlanas.length ? filasPlanas : [{}]);
    XLSX.utils.book_append_sheet(libro, ws, hoja.nombre.slice(0, 31));
  });
  XLSX.writeFile(libro, nombreArchivo.endsWith(".xlsx") ? nombreArchivo : `${nombreArchivo}.xlsx`);
}

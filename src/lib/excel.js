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

// Plantilla lista para llenar, con una fila de ejemplo en cada hoja, para
// la importación masiva de socios + aportes + gastos.
export function descargarPlantillaImportacion() {
  exportarExcel("plantilla_importacion_fraternidad", [
    {
      nombre: "Socios",
      columnas: [
        { label: "Nombre completo", get: (f) => f.nombre },
        { label: "Celular", get: (f) => f.celular },
        { label: "Correo electronico", get: (f) => f.email },
        { label: "Fecha de nacimiento", get: (f) => f.fechaNacimiento },
        { label: "Estado", get: (f) => f.estado },
        { label: "Rol", get: (f) => f.rol },
        { label: "Aporte patrimonial acordado", get: (f) => f.aporteAcordado },
        { label: "Contraseña inicial", get: (f) => f.password },
      ],
      filas: [
        { nombre: "Juan Pérez Rodríguez", celular: "71234567", email: "juan.perez@ejemplo.com", fechaNacimiento: "1985-04-12", estado: "Patrimonial", rol: "Socio", aporteAcordado: 5000, password: "" },
      ],
    },
    {
      nombre: "Aportes",
      columnas: [
        { label: "Celular", get: (f) => f.celular },
        { label: "Tipo", get: (f) => f.tipo },
        { label: "Fecha", get: (f) => f.fecha },
        { label: "Monto", get: (f) => f.monto },
        { label: "Concepto", get: (f) => f.concepto },
        { label: "Observaciones", get: (f) => f.observaciones },
      ],
      filas: [
        { celular: "71234567", tipo: "Patrimonial", fecha: "2024-03-10", monto: 1000, concepto: "Pago patrimonial", observaciones: "" },
        { celular: "71234567", tipo: "Mensual", fecha: "2024-03-10", monto: 50, concepto: "Mensualidad marzo 2024", observaciones: "" },
      ],
    },
    {
      nombre: "Gastos",
      columnas: [
        { label: "Fecha", get: (f) => f.fecha },
        { label: "Categoria", get: (f) => f.categoria },
        { label: "Concepto", get: (f) => f.concepto },
        { label: "Beneficiario", get: (f) => f.beneficiario },
        { label: "Monto", get: (f) => f.monto },
        { label: "Forma de pago", get: (f) => f.formaPago },
      ],
      filas: [
        { fecha: "2024-03-05", categoria: "Servicios básicos — Saguapac", concepto: "Factura de agua marzo", beneficiario: "Saguapac", monto: 120, formaPago: "Transferencia" },
      ],
    },
  ]);
}

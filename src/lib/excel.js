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
      nombre: "Instrucciones",
      columnas: [
        { label: "Hoja", get: (f) => f.hoja },
        { label: "Columna", get: (f) => f.columna },
        { label: "Valores permitidos / formato", get: (f) => f.valores },
      ],
      filas: [
        { hoja: "Socios", columna: "Celular", valores: "Obligatorio y único. Si no conoces el celular real de un socio, puedes inventar un número correlativo (ej. 70000001, 70000002...) — solo debe ser único." },
        { hoja: "Socios", columna: "Correo electronico", valores: "Opcional. Si lo dejas vacío, se genera un correo temporal a partir del celular (ej. 70000001@temporal.fraternidad) y ese socio deberá definir su correo real y su contraseña la primera vez que ingrese." },
        { hoja: "Socios", columna: "Estado", valores: "Patrimonial / Invitado / De baja (si se deja vacío: Patrimonial)" },
        { hoja: "Socios", columna: "Rol", valores: "Socio / Supervisor / Administrador / Súper administrador (si se deja vacío: Socio)" },
        { hoja: "Socios", columna: "Fecha de nacimiento", valores: "AAAA-MM-DD" },
        { hoja: "Socios", columna: "Turno", valores: "Ene / Feb / Mar / Abr / May / Jun / Jul / Ago / Sep / Oct / Nov / Dic (opcional)" },
        { hoja: "Socios", columna: "Aporte patrimonial acordado", valores: "Opcional — si se llena, crea automáticamente esa obligación patrimonial" },
        { hoja: "Aportes", columna: "Tipo", valores: "Patrimonial / Mensual / Voluntario / Obligación mensual" },
        { hoja: "Aportes", columna: "Tipo = Patrimonial o Mensual", valores: "Registra un PAGO (Haber) — reduce lo pendiente del socio" },
        { hoja: "Aportes", columna: "Tipo = Obligación mensual", valores: "Registra lo que se le CARGÓ al socio ese mes (Debe) — usa el año y mes de la columna Fecha. No confundir con un pago." },
        { hoja: "Aportes", columna: "Fecha", valores: "AAAA-MM-DD" },
        { hoja: "Ingresos institucionales", columna: "Tipo", valores: "Alquiler / Donación / Otro" },
        { hoja: "Ingresos institucionales", columna: "Origen", valores: "Opcional — de quién o qué proviene (ej. nombre del inquilino o donante)" },
        { hoja: "Ingresos institucionales", columna: "Fecha", valores: "AAAA-MM-DD" },
        { hoja: "Gastos", columna: "Categoria", valores: "Sueldos y salarios / Servicios básicos — Saguapac / Servicios básicos — Cre / Internet y telefonía / Mantenimientos / Otros" },
        { hoja: "Gastos", columna: "Fecha", valores: "AAAA-MM-DD" },
        { hoja: "(todas)", columna: "Celular", valores: "Debe coincidir exactamente entre las hojas Socios y Aportes para emparejar cada fila con su socio" },
      ],
    },
    {
      nombre: "Socios",
      columnas: [
        { label: "Nombre completo", get: (f) => f.nombre },
        { label: "Celular", get: (f) => f.celular },
        { label: "Correo electronico", get: (f) => f.email },
        { label: "Fecha de nacimiento", get: (f) => f.fechaNacimiento },
        { label: "Turno", get: (f) => f.turno },
        { label: "Estado", get: (f) => f.estado },
        { label: "Rol", get: (f) => f.rol },
        { label: "Aporte patrimonial acordado", get: (f) => f.aporteAcordado },
        { label: "Contraseña inicial", get: (f) => f.password },
      ],
      filas: [
        { nombre: "Juan Pérez Rodríguez", celular: "71234567", email: "juan.perez@ejemplo.com", fechaNacimiento: "1985-04-12", turno: "Mar", estado: "Patrimonial", rol: "Socio", aporteAcordado: 5000, password: "" },
        { nombre: "María Fernández Ríos", celular: "70000001", email: "", fechaNacimiento: "", turno: "", estado: "Patrimonial", rol: "Socio", aporteAcordado: 5000, password: "" },
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
        { celular: "71234567", tipo: "Obligación mensual", fecha: "2024-02-01", monto: 50, concepto: "Mensualidad febrero 2024", observaciones: "" },
        { celular: "71234567", tipo: "Mensual", fecha: "2024-02-05", monto: 50, concepto: "Pago mensualidad febrero 2024", observaciones: "" },
        { celular: "71234567", tipo: "Voluntario", fecha: "2024-04-20", monto: 200, concepto: "Aporte voluntario pro-fiesta", observaciones: "Entregado en efectivo" },
      ],
    },
    {
      nombre: "Ingresos institucionales",
      columnas: [
        { label: "Fecha", get: (f) => f.fecha },
        { label: "Tipo", get: (f) => f.tipo },
        { label: "Concepto", get: (f) => f.concepto },
        { label: "Origen", get: (f) => f.origen },
        { label: "Monto", get: (f) => f.monto },
        { label: "Observaciones", get: (f) => f.observaciones },
      ],
      filas: [
        { fecha: "2024-03-15", tipo: "Alquiler", concepto: "Alquiler salón de eventos", origen: "Familia Rodríguez", monto: 800, observaciones: "" },
        { fecha: "2024-03-20", tipo: "Donación", concepto: "Donación pro-mantenimiento", origen: "Empresa ABC S.R.L.", monto: 500, observaciones: "" },
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

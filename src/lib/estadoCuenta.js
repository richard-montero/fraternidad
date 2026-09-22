import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

function bsPdf(monto) {
  const v = Number(monto) || 0;
  return v.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fdatePdf(f) {
  if (!f) return "";
  const d = new Date(f + "T00:00:00");
  return d.toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Construye las filas de un mayor (Debe/Haber) con las columnas del
// estado de cuentas de referencia: Adeudado / Pagado / Saldo Deudor /
// Pago Adelantado — el saldo se reparte entre las dos últimas según el
// signo del saldo acumulado (positivo = debe, negativo = adelantado).
function filasMayor(movimientos) {
  let saldo = 0;
  return movimientos
    .slice()
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))
    .map((m) => {
      saldo += Number(m.debe) - Number(m.haber);
      return [
        fdatePdf(m.fecha),
        m.concepto,
        Number(m.debe) > 0 ? bsPdf(m.debe) : "",
        Number(m.haber) > 0 ? bsPdf(m.haber) : "",
        saldo > 0 ? bsPdf(saldo) : "",
        saldo < 0 ? bsPdf(-saldo) : "",
      ];
    });
}

const COLUMNAS_MAYOR = ["Fecha", "Concepto", "Adeudado", "Pagado", "Saldo Deudor", "Pago Adelantado"];
const ESTILOS_COLUMNA_MAYOR = { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } };

export function generarEstadoCuentaPDF({ nombreFraternidad, socio, movP, movM, aportesVol, acordadoPatrimonial, saldoPatrimonial, saldoMensual }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const hoy = new Date().toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");

  function encabezado() {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(nombreFraternidad, ancho / 2, 38, { align: "center" });
    doc.setFontSize(11.5);
    doc.text(`Estado de cuentas en Bs al ${hoy}`, ancho / 2, 56, { align: "center" });
    doc.setFontSize(10.5);
    doc.text(socio.nombre, ancho / 2, 72, { align: "center" });
    doc.setDrawColor(180, 180, 170);
    doc.line(40, 82, ancho - 40, 82);
  }

  const estiloEncabezadoTabla = { fillColor: [20, 46, 34], textColor: 255, fontStyle: "bold", halign: "center", fontSize: 8 };
  const margenTabla = { top: 96, left: 40, right: 40, bottom: 50 };

  function saltoDePaginaSiHaceFalta(yActual, alturaNecesaria) {
    if (yActual + alturaNecesaria > alto - 55) {
      doc.addPage();
      encabezado();
      return 100;
    }
    return yActual;
  }

  let y = 100;

  // ---------- Patrimonial ----------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Patrimonial", ancho / 2, y, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Monto total acordado: Bs ${bsPdf(acordadoPatrimonial)}`, 40, y + 16);

  autoTable(doc, {
    head: [COLUMNAS_MAYOR],
    body: filasMayor(movP),
    startY: y + 24,
    margin: margenTabla,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: estiloEncabezadoTabla,
    columnStyles: ESTILOS_COLUMNA_MAYOR,
    didDrawPage: encabezado,
    rowPageBreak: "avoid",
  });

  y = doc.lastAutoTable.finalY + 16;
  if (saldoPatrimonial > 0) {
    y = saltoDePaginaSiHaceFalta(y, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Para estar al día en el aporte patrimonial, debe cancelar Bs.${bsPdf(saldoPatrimonial)}`, 40, y);
    y += 26;
  } else {
    y += 6;
  }

  // ---------- Obligaciones mensuales ----------
  y = saltoDePaginaSiHaceFalta(y, 60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Obligaciones Mensuales Socios y/o Invitados", ancho / 2, y, { align: "center" });

  autoTable(doc, {
    head: [COLUMNAS_MAYOR],
    body: filasMayor(movM),
    startY: y + 14,
    margin: margenTabla,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: estiloEncabezadoTabla,
    columnStyles: ESTILOS_COLUMNA_MAYOR,
    didDrawPage: encabezado,
    rowPageBreak: "avoid",
  });

  y = doc.lastAutoTable.finalY + 16;
  if (saldoMensual > 0) {
    y = saltoDePaginaSiHaceFalta(y, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Para estar al día en las obligaciones mensuales, debe cancelar Bs.${bsPdf(saldoMensual)}`, 40, y);
    y += 26;
  } else {
    y += 6;
  }

  // ---------- Aportes voluntarios ----------
  if (aportesVol.length > 0) {
    y = saltoDePaginaSiHaceFalta(y, 60);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Aportes Voluntarios", ancho / 2, y, { align: "center" });

    let saldoVol = 0;
    const filasVol = aportesVol
      .slice()
      .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
      .map((a) => {
        saldoVol += Number(a.monto);
        return [fdatePdf(a.fecha), a.concepto, bsPdf(a.monto), bsPdf(saldoVol)];
      });

    autoTable(doc, {
      head: [["Fecha", "Concepto", "Pagado", "Saldo"]],
      body: filasVol,
      startY: y + 14,
      margin: margenTabla,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: estiloEncabezadoTabla,
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
      didDrawPage: encabezado,
      rowPageBreak: "avoid",
    });
  }

  // ---------- Numeración de páginas (se hace al final, cuando ya se sabe el total) ----------
  const totalPaginas = doc.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text(`Pág: ${i} de ${totalPaginas}`, ancho / 2, alto - 22, { align: "center" });
  }

  const nombreArchivo = `Estado_de_cuenta_${socio.nombre.replace(/\s+/g, "_")}.pdf`;
  doc.save(nombreArchivo);
}

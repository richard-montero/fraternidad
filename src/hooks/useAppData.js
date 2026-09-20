import { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "../lib/data.js";

function sumar(movs, campo) {
  return movs.reduce((a, m) => a + Number(m[campo]), 0);
}

export function useAppData(sesion) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [recargarContador, setRecargarContador] = useState(0);

  const [socios, setSocios] = useState([]);
  const [configAnual, setConfigAnual] = useState([]);
  const [obligPatrimoniales, setObligPatrimoniales] = useState({});
  const [movPatrimoniales, setMovPatrimoniales] = useState({});
  const [movMensuales, setMovMensuales] = useState({});
  const [oblMensualesGeneradas, setOblMensualesGeneradas] = useState([]);
  const [aportesVoluntarios, setAportesVoluntarios] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [ingresosExternos, setIngresosExternos] = useState([]);

  const recargar = useCallback(() => setRecargarContador((c) => c + 1), []);

  useEffect(() => {
    if (!sesion) return;
    let cancelado = false;
    setCargando(true);
    setError(null);

    const puedeVer = sesion.rol !== "socio";

    Promise.all([
      api.listarSocios(),
      api.listarConfigAnual(),
      api.listarObligacionesPatrimoniales(),
      api.listarMovimientos("movimientos_patrimoniales"),
      api.listarMovimientos("movimientos_mensuales"),
      api.listarObligacionesMensualesGeneradas(),
      api.listarAportesVoluntarios(),
      puedeVer ? api.listarGastos() : Promise.resolve([]),
      puedeVer ? api.listarIngresosExternos() : Promise.resolve([]),
    ])
      .then(([s, ca, op, mp, mm, omg, av, g, ie]) => {
        if (cancelado) return;
        setSocios(s);
        setConfigAnual(ca);
        setObligPatrimoniales(op);
        setMovPatrimoniales(mp);
        setMovMensuales(mm);
        setOblMensualesGeneradas(omg);
        setAportesVoluntarios(av);
        setGastos(g);
        setIngresosExternos(ie);
      })
      .catch((e) => { if (!cancelado) setError(e.message || "Ocurrió un error al cargar los datos."); })
      .finally(() => { if (!cancelado) setCargando(false); });

    return () => { cancelado = true; };
  }, [sesion, recargarContador]);

  const saldoPatrimonial = useCallback(
    (socioId) => {
      const m = movPatrimoniales[socioId] || [];
      return sumar(m, "debe") - sumar(m, "haber");
    },
    [movPatrimoniales]
  );
  const saldoMensual = useCallback(
    (socioId) => {
      const m = movMensuales[socioId] || [];
      return sumar(m, "debe") - sumar(m, "haber");
    },
    [movMensuales]
  );

  const ingresosConsolidados = useMemo(() => {
    const lista = [];
    Object.entries(movPatrimoniales).forEach(([socioId, movs]) => {
      movs.filter((m) => m.haber > 0).forEach((m) => lista.push({ id: m.id, fecha: m.fecha, tipo: "patrimonial", socioId, concepto: m.concepto, monto: Number(m.haber) }));
    });
    Object.entries(movMensuales).forEach(([socioId, movs]) => {
      movs.filter((m) => m.haber > 0).forEach((m) => lista.push({ id: m.id, fecha: m.fecha, tipo: "mensual", socioId, concepto: m.concepto, monto: Number(m.haber) }));
    });
    aportesVoluntarios.forEach((a) => lista.push({ id: a.id, fecha: a.fecha, tipo: "voluntario", socioId: a.socio_id, concepto: a.concepto, monto: Number(a.monto) }));
    return lista.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }, [movPatrimoniales, movMensuales, aportesVoluntarios]);

  const totalIngresosSocios = ingresosConsolidados.reduce((a, b) => a + b.monto, 0);
  const totalIngresosExternos = ingresosExternos.reduce((a, b) => a + Number(b.monto), 0);
  const totalIngresos = totalIngresosSocios + totalIngresosExternos;
  const totalGastos = gastos.reduce((a, b) => a + Number(b.monto), 0);

  // ---------- Acciones (envuelven la API y recargan al terminar) ----------
  async function accion(fn) {
    await fn();
    recargar();
  }

  const acciones = {
    crearSocio: (datos) => accion(() => api.crearSocio(datos)),
    editarSocio: (id, datos) => accion(() => api.editarSocio(id, datos)),
    activarAccesoSocio: (id, celular, datos) => accion(() => api.activarAccesoSocio(id, celular, datos)),
    cambiarEstadoSocio: (id, estado) => accion(() => api.cambiarEstadoSocio(id, estado)),
    cambiarRolSocio: (id, rol) => accion(() => api.cambiarRolSocio(id, rol)),
    enviarRestablecimientoPassword: (email) => api.enviarRestablecimientoPassword(email),
    crearObligacionPatrimonial: (socioId, monto, fecha) => accion(() => api.crearObligacionPatrimonial(socioId, monto, fecha)),
    registrarPagoPatrimonial: (socioId, monto, fecha, concepto) => accion(() => api.registrarPagoPatrimonial(socioId, monto, fecha, concepto)),
    registrarPagoMensual: (socioId, monto, fecha, concepto) => accion(() => api.registrarPagoMensual(socioId, monto, fecha, concepto)),
    registrarAjuste: (tabla, socioId, monto, fecha, concepto, tipo) => accion(() => api.registrarAjuste(tabla, socioId, monto, fecha, concepto, tipo)),
    generarMensualidades: async (anio, mes) => {
      const r = await api.generarMensualidades(anio, mes, socios, configAnual);
      recargar();
      return r;
    },
    guardarCuotaAnual: (anio, cuota) => accion(() => api.guardarCuotaAnual(anio, cuota)),
    registrarAporteVoluntario: (socioId, monto, fecha, concepto, observaciones) => accion(() => api.registrarAporteVoluntario(socioId, monto, fecha, concepto, observaciones)),
    registrarGasto: (gasto, archivo) => accion(() => api.registrarGasto(gasto, archivo)),
    editarGasto: (id, gasto) => accion(() => api.editarGasto(id, gasto)),
    eliminarGasto: (id) => accion(() => api.eliminarGasto(id)),
    obtenerUrlComprobante: (ruta) => api.obtenerUrlComprobante(ruta),
    registrarIngresoExterno: (datos) => accion(() => api.registrarIngresoExterno(datos)),
    editarIngresoExterno: (id, datos) => accion(() => api.editarIngresoExterno(id, datos)),
    eliminarIngresoExterno: (id) => accion(() => api.eliminarIngresoExterno(id)),
  };

  return {
    cargando,
    error,
    socios,
    configAnual,
    obligPatrimoniales,
    movPatrimoniales,
    movMensuales,
    oblMensualesGeneradas,
    aportesVoluntarios,
    gastos,
    ingresosExternos,
    ingresosConsolidados,
    totalIngresosSocios,
    totalIngresosExternos,
    totalIngresos,
    totalGastos,
    saldoPatrimonial,
    saldoMensual,
    ...acciones,
  };
}

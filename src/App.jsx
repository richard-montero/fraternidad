import { useEffect, useMemo, useState, Fragment } from "react";
import {
  LayoutDashboard, Users, ArrowDownCircle, ArrowUpCircle, BarChart3,
  Settings, LogOut, Plus, X, ChevronRight, Paperclip, Check
} from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";
import * as api from "./lib/data.js";
import { useAppData } from "./hooks/useAppData.js";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const ROLES_ACCESO = [
  { value: "socio", label: "Socio" },
  { value: "admin", label: "Administrador" },
  { value: "superadmin", label: "Súper administrador" },
];

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
function bs(monto) {
  const v = Number(monto) || 0;
  return "Bs " + v.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fdate(f) {
  if (!f) return "—";
  const d = new Date(f + "T00:00:00");
  return d.toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}
function sumar(movs, campo) {
  return movs.reduce((a, m) => a + Number(m[campo]), 0);
}
function esNivelAdmin(rol) {
  return rol === "admin" || rol === "superadmin";
}
function etiquetaRol(rol) {
  return ROLES_ACCESO.find((r) => r.value === rol)?.label || "Socio";
}
function tonoRol(rol) {
  if (rol === "superadmin") return "dorado";
  if (rol === "admin") return "verde";
  return "gris";
}

// =====================================================================
// COMPONENTE RAÍZ
// =====================================================================
export default function App() {
  const [sesion, setSesion] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);

  const [vista, setVista] = useState("dashboard");
  const [socioSeleccionado, setSocioSeleccionado] = useState(null);

  useEffect(() => {
    api.obtenerSesionActual()
      .then((socio) => setSesion(socio))
      .catch(() => setSesion(null))
      .finally(() => setCargandoSesion(false));

    const { data: sub } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "SIGNED_OUT") setSesion(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const ctxData = useAppData(sesion);

  if (cargandoSesion) {
    return <PantallaCarga texto="Cargando sesión…" />;
  }

  if (!sesion) {
    return (
      <Login
        onIngresar={(socio) => { setSesion(socio); setVista("dashboard"); }}
      />
    );
  }

  if (ctxData.cargando) {
    return <PantallaCarga texto="Cargando datos de la fraternidad…" />;
  }

  if (ctxData.error) {
    return (
      <PantallaCarga texto={`Ocurrió un error al cargar los datos: ${ctxData.error}`} esError />
    );
  }

  async function cerrarSesion() {
    await api.cerrarSesion();
    setSesion(null);
  }

  const ctx = { sesion, ...ctxData };
  const nivelAdmin = esNivelAdmin(sesion.rol);

  return (
    <div className="min-h-screen flex" style={{ background: PAPER, fontFamily: FONT_BODY, color: TEXT }}>
      <FontsAndStyles />
      <Sidebar
        sesion={sesion}
        vista={vista}
        setVista={(v) => { setVista(v); setSocioSeleccionado(null); }}
        onSalir={cerrarSesion}
      />
      <main className="flex-1 px-6 py-8 sm:px-10 sm:py-10" style={{ maxWidth: 1180 }}>
        {vista === "dashboard" && <Dashboard ctx={ctx} irASocio={(id) => { setSocioSeleccionado(id); setVista("ficha"); }} />}
        {vista === "socios" && nivelAdmin && (
          <Socios ctx={ctx} irAFicha={(id) => { setSocioSeleccionado(id); setVista("ficha"); }} />
        )}
        {vista === "ficha" && (
          <FichaSocio
            ctx={ctx}
            socioId={nivelAdmin ? socioSeleccionado : sesion.id}
            volver={() => setVista(nivelAdmin ? "socios" : "dashboard")}
          />
        )}
        {vista === "ingresos" && nivelAdmin && <Ingresos ctx={ctx} />}
        {vista === "gastos" && nivelAdmin && <Gastos ctx={ctx} />}
        {vista === "reportes" && nivelAdmin && <Reportes ctx={ctx} />}
        {vista === "configuracion" && nivelAdmin && <Configuracion ctx={ctx} />}
      </main>
    </div>
  );
}

function PantallaCarga({ texto, esError }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-5" style={{ background: PAPER, fontFamily: FONT_BODY }}>
      <FontsAndStyles />
      <div style={{ color: esError ? RUST : TEXT_MUTED, fontSize: "0.95rem", maxWidth: 420, textAlign: "center" }}>{texto}</div>
    </div>
  );
}

// =====================================================================
// TOKENS DE DISEÑO
// =====================================================================
const INK = "#142e22";
const INK_SOFT = "#204536";
const PAPER = "#f1f2ec";
const PAPER_CARD = "#fbfbf8";
const LINE = "#d8dbcf";
const LINE_STRONG = "#b9bdae";
const TEXT = "#1c2230";
const TEXT_MUTED = "#5b6472";
const GREEN = "#1f6f54";
const GREEN_BG = "#e7f0ea";
const RUST = "#8a3a26";
const RUST_BG = "#f3e6df";
const GOLD = "#a3782f";
const FONT_DISPLAY = "'Lora', Georgia, serif";
const FONT_BODY = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

function FontsAndStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Lora:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
      .monto { font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1; }
      table.ledger { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
      table.ledger th { text-align: left; font-weight: 600; color: ${TEXT_MUTED}; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid ${LINE_STRONG}; padding: 8px 10px; }
      table.ledger td { padding: 9px 10px; border-bottom: 1px solid ${LINE}; }
      table.ledger tbody tr:hover { background: rgba(22,33,61,0.03); }
      table.ledger th.num, table.ledger td.num { text-align: right; }
      table.ledger tfoot td { font-weight: 700; border-top: 2px solid ${LINE_STRONG}; border-bottom: none; }
      .field-input { border: 1px solid ${LINE_STRONG}; border-radius: 4px; padding: 8px 10px; background: #fff; color: ${TEXT}; width: 100%; }
      .field-input:focus { outline: 2px solid ${GOLD}; outline-offset: 1px; }
      .nav-link { display:block; padding: 9px 10px; border-radius: 4px; color: #c7d4cc; text-decoration:none; font-size:0.9rem; font-weight:500; cursor:pointer; }
      .nav-link:hover { background: rgba(255,255,255,0.06); color:#fff; }
      .nav-link.activo { background: ${INK_SOFT}; color:#fff; }
    `}</style>
  );
}

// =====================================================================
// LOGIN
// =====================================================================
function Login({ onIngresar }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const socio = await api.iniciarSesion(email.trim(), password);
      onIngresar(socio);
    } catch (err) {
      setError(err.message || "Correo o contraseña incorrectos.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5" style={{ background: PAPER, fontFamily: FONT_BODY }}>
      <FontsAndStyles />
      <div className="w-full" style={{ maxWidth: 380, background: PAPER_CARD, border: `1px solid ${LINE}`, borderRadius: 4, padding: "32px 28px", boxShadow: "0 1px 2px rgba(22,33,61,.06)" }}>
        <h1 style={{ fontFamily: FONT_DISPLAY, color: INK, fontSize: "1.4rem", margin: 0 }}>Fraternidad</h1>
        <p style={{ color: TEXT_MUTED, fontSize: "0.88rem", margin: "2px 0 22px" }}>Ingresa con tu correo y tu contraseña</p>

        {error && <Mensaje tipo="error">{error}</Mensaje>}

        <div>
          <div className="flex flex-col gap-3.5 mb-5">
            <Field label="Correo electrónico">
              <input className="field-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            </Field>
            <Field label="Contraseña">
              <input className="field-input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" onKeyDown={(e) => e.key === "Enter" && handleSubmit(e)} />
            </Field>
          </div>
          <button className="w-full" disabled={cargando} style={{ background: INK, color: "#fff", border: "none", borderRadius: 4, padding: "9px 16px", fontWeight: 600, cursor: cargando ? "not-allowed" : "pointer", opacity: cargando ? 0.7 : 1 }} onClick={handleSubmit}>
            {cargando ? "Ingresando…" : "Ingresar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// SIDEBAR
// =====================================================================
function Sidebar({ sesion, vista, setVista, onSalir }) {
  const NAV_ADMIN = [
    { id: "dashboard", label: "Panel general", icon: LayoutDashboard },
    { id: "socios", label: "Socios", icon: Users },
    { id: "ingresos", label: "Libro de ingresos", icon: ArrowDownCircle },
    { id: "gastos", label: "Libro de gastos", icon: ArrowUpCircle },
    { id: "reportes", label: "Reportes", icon: BarChart3 },
    { id: "configuracion", label: "Configuración anual", icon: Settings },
  ];
  const NAV_SOCIO = [{ id: "dashboard", label: "Mi resumen", icon: LayoutDashboard }];
  const items = esNivelAdmin(sesion.rol) ? NAV_ADMIN : NAV_SOCIO;

  return (
    <aside className="flex flex-col gap-6 flex-shrink-0" style={{ width: 232, background: INK, color: "#e2ece5", padding: "24px 16px" }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: "1.15rem", color: "#fff", padding: "0 8px" }}>
        Fraternidad
        <small style={{ display: "block", fontFamily: FONT_BODY, fontSize: "0.72rem", color: "#8fa89a", fontWeight: 500, marginTop: 4 }}>
          Gestión financiera
        </small>
      </div>
      <nav className="flex flex-col gap-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.id} className={`nav-link flex items-center gap-2 ${vista === item.id ? "activo" : ""}`} onClick={() => setVista(item.id)}>
              <Icon size={16} strokeWidth={2} />
              {item.label}
            </div>
          );
        })}
      </nav>
      <div style={{ marginTop: "auto", padding: "0 8px", fontSize: "0.8rem", color: "#84a091" }}>
        <div>{sesion.nombre}</div>
        <div style={{ opacity: 0.75 }}>{etiquetaRol(sesion.rol)}</div>
        <button
          onClick={onSalir}
          className="w-full flex items-center justify-center gap-1.5"
          style={{ marginTop: 8, background: "none", border: "1px solid #3d5c4c", color: "#dfe8e2", padding: "6px 10px", borderRadius: 4, cursor: "pointer" }}
        >
          <LogOut size={14} /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

// =====================================================================
// BLOQUES REUTILIZABLES
// =====================================================================
function Card({ children, style }) {
  return <div style={{ background: PAPER_CARD, border: `1px solid ${LINE}`, borderRadius: 4, padding: 20, boxShadow: "0 1px 2px rgba(22,33,61,.06)", ...style }}>{children}</div>;
}
function StatCard({ label, value, tono }) {
  const color = tono === "positivo" ? GREEN : tono === "negativo" ? RUST : INK;
  return (
    <div style={{ background: PAPER_CARD, border: `1px solid ${LINE}`, borderRadius: 4, padding: "16px 18px" }}>
      <div style={{ fontSize: "0.78rem", color: TEXT_MUTED, fontWeight: 500, marginBottom: 6 }}>{label}</div>
      <div className="monto" style={{ fontFamily: FONT_DISPLAY, fontSize: "1.5rem", color }}>{value}</div>
    </div>
  );
}
function Badge({ children, tono = "gris" }) {
  const map = {
    verde: { bg: GREEN_BG, color: GREEN },
    rojo: { bg: RUST_BG, color: RUST },
    gris: { bg: "#e6e7e0", color: TEXT_MUTED },
    dorado: { bg: "#f2e9d8", color: GOLD },
  };
  const s = map[tono];
  return <span style={{ background: s.bg, color: s.color, padding: "2px 8px", borderRadius: 100, fontSize: "0.75rem", fontWeight: 600 }}>{children}</span>;
}
function Btn({ children, onClick, variante = "primary", type = "button", disabled, icon: Icon }) {
  const primary = { background: INK, color: "#fff", border: "none" };
  const secondary = { background: "transparent", color: INK, border: `1px solid ${LINE_STRONG}` };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5"
      style={{ ...(variante === "primary" ? primary : secondary), borderRadius: 4, padding: "9px 16px", fontWeight: 600, fontSize: "0.88rem", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1 }}
    >
      {Icon && <Icon size={15} />}
      {children}
    </button>
  );
}
function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label style={{ fontSize: "0.82rem", fontWeight: 500, color: INK_SOFT }}>{label}</label>
      {children}
    </div>
  );
}
function PageHeader({ title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
      <div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: "1.7rem", color: INK, margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ color: TEXT_MUTED, margin: "4px 0 0", maxWidth: "60ch" }}>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
function Vacio({ children }) {
  return <div style={{ padding: "36px 0", textAlign: "center", color: TEXT_MUTED }}>{children}</div>;
}
function Mensaje({ tipo, children }) {
  const ok = tipo === "exito";
  return (
    <div style={{ background: ok ? GREEN_BG : RUST_BG, color: ok ? GREEN : RUST, padding: "9px 12px", borderRadius: 4, fontSize: "0.85rem", marginBottom: 14 }}>
      {children}
    </div>
  );
}

// Filtro de período reutilizable (rango / mensual / anual)
function useFiltroPeriodo() {
  const [modo, setModo] = useState("mensual");
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [desde, setDesde] = useState(`${new Date().getFullYear()}-01-01`);
  const [hasta, setHasta] = useState(hoyISO());

  const ultimoDia = (a, m) => new Date(a, m, 0).getDate();

  const periodo = useMemo(() => {
    if (modo === "anual") return { desde: `${anio}-01-01`, hasta: `${anio}-12-31`, etiqueta: `Año ${anio}` };
    if (modo === "mensual") {
      const ld = String(ultimoDia(anio, mes)).padStart(2, "0");
      return { desde: `${anio}-${String(mes).padStart(2, "0")}-01`, hasta: `${anio}-${String(mes).padStart(2, "0")}-${ld}`, etiqueta: `${MESES[mes - 1]} ${anio}` };
    }
    return { desde, hasta, etiqueta: `${fdate(desde)} — ${fdate(hasta)}` };
  }, [modo, anio, mes, desde, hasta]);

  function Render() {
    return (
      <div className="flex gap-3 items-end flex-wrap mb-5">
        <Field label="Tipo de consulta">
          <select className="field-input" value={modo} onChange={(e) => setModo(e.target.value)}>
            <option value="mensual">Mensual</option>
            <option value="anual">Anual</option>
            <option value="rango">Rango de fechas</option>
          </select>
        </Field>
        {modo === "mensual" && (
          <>
            <Field label="Mes">
              <select className="field-input" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
                {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </Field>
            <Field label="Año">
              <input className="field-input" type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={{ width: 100 }} />
            </Field>
          </>
        )}
        {modo === "anual" && (
          <Field label="Año">
            <input className="field-input" type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={{ width: 100 }} />
          </Field>
        )}
        {modo === "rango" && (
          <>
            <Field label="Desde"><input className="field-input" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></Field>
            <Field label="Hasta"><input className="field-input" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></Field>
          </>
        )}
      </div>
    );
  }

  return { periodo, Render };
}

// =====================================================================
// DASHBOARD
// =====================================================================
function Dashboard({ ctx, irASocio }) {
  if (esNivelAdmin(ctx.sesion.rol)) return <DashboardAdmin ctx={ctx} />;
  return <DashboardSocio ctx={ctx} irASocio={irASocio} />;
}

function DashboardAdmin({ ctx }) {
  const { periodo, Render } = useFiltroPeriodo();
  const enPeriodo = ctx.ingresosConsolidados.filter((i) => i.fecha >= periodo.desde && i.fecha <= periodo.hasta);
  const gastosPeriodo = ctx.gastos.filter((g) => g.fecha >= periodo.desde && g.fecha <= periodo.hasta);

  const porTipo = { patrimonial: 0, mensual: 0, voluntario: 0 };
  enPeriodo.forEach((i) => { porTipo[i.tipo] += i.monto; });
  const totalIngPeriodo = porTipo.patrimonial + porTipo.mensual + porTipo.voluntario;
  const totalGastoPeriodo = gastosPeriodo.reduce((a, b) => a + Number(b.monto), 0);
  const saldoPeriodo = totalIngPeriodo - totalGastoPeriodo;
  const saldoAcumulado = ctx.totalIngresos - ctx.totalGastos;

  const activos = ctx.socios.filter((s) => s.estado === "activo").length;
  const conPendientePatr = ctx.socios.filter((s) => ctx.saldoPatrimonial(s.id) > 0).length;
  const conPendienteMens = ctx.socios.filter((s) => ctx.saldoMensual(s.id) > 0).length;

  return (
    <div>
      <PageHeader title="Panel general" subtitle={`Resumen financiero de la fraternidad — ${periodo.etiqueta}`} />
      <Render />

      <div className="grid gap-3.5 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <StatCard label="Ingresos del período" value={bs(totalIngPeriodo)} tono="positivo" />
        <StatCard label="Egresos del período" value={bs(totalGastoPeriodo)} tono="negativo" />
        <StatCard label="Saldo del período" value={bs(saldoPeriodo)} tono={saldoPeriodo >= 0 ? "positivo" : "negativo"} />
        <StatCard label="Saldo acumulado histórico" value={bs(saldoAcumulado)} tono={saldoAcumulado >= 0 ? "positivo" : "negativo"} />
      </div>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ fontFamily: FONT_DISPLAY, color: INK, marginTop: 0 }}>Ingresos por origen</h3>
        <table className="ledger">
          <thead><tr><th>Origen</th><th className="num">Monto</th></tr></thead>
          <tbody>
            <tr><td>Aportes patrimoniales</td><td className="num monto">{bs(porTipo.patrimonial)}</td></tr>
            <tr><td>Aportes mensuales</td><td className="num monto">{bs(porTipo.mensual)}</td></tr>
            <tr><td>Aportes voluntarios</td><td className="num monto">{bs(porTipo.voluntario)}</td></tr>
          </tbody>
          <tfoot><tr><td>Total</td><td className="num monto">{bs(totalIngPeriodo)}</td></tr></tfoot>
        </table>
      </Card>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <StatCard label="Socios activos" value={activos} />
        <StatCard label="Con saldo patrimonial pendiente" value={conPendientePatr} />
        <StatCard label="Con mensualidades pendientes" value={conPendienteMens} />
      </div>
    </div>
  );
}

function DashboardSocio({ ctx, irASocio }) {
  const id = ctx.sesion.id;
  const sp = ctx.saldoPatrimonial(id);
  const sm = ctx.saldoMensual(id);
  return (
    <div>
      <PageHeader title="Mi resumen" subtitle={`Bienvenido, ${ctx.sesion.nombre}. Aquí ves el estado de tus dos cuentas individuales.`} />
      <div className="grid gap-3.5 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <StatCard label="Saldo pendiente — Aporte patrimonial" value={bs(sp)} tono={sp > 0 ? "negativo" : "positivo"} />
        <StatCard label="Saldo pendiente — Aportes mensuales" value={bs(sm)} tono={sm > 0 ? "negativo" : "positivo"} />
      </div>
      <Card>
        <p style={{ margin: 0 }}>
          Para ver el detalle completo de cada cuenta (Debe, Haber y movimientos), visita{" "}
          <span style={{ color: INK, textDecoration: "underline", cursor: "pointer", fontWeight: 600 }} onClick={() => irASocio(id)}>
            tu ficha de socio
          </span>.
        </p>
      </Card>
    </div>
  );
}

// =====================================================================
// SOCIOS
// =====================================================================
function Socios({ ctx, irAFicha }) {
  const [busqueda, setBusqueda] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [celular, setCelular] = useState("");
  const [email, setEmail] = useState("");
  const [rolNuevo, setRolNuevo] = useState("socio");
  const [passwordNuevo, setPasswordNuevo] = useState("");
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const [gestionandoId, setGestionandoId] = useState(null);
  const [rolEdit, setRolEdit] = useState("socio");
  const [mensajeAcceso, setMensajeAcceso] = useState(null);

  const esSuperadmin = ctx.sesion.rol === "superadmin";

  const filtrados = ctx.socios.filter((s) => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return s.nombre.toLowerCase().includes(q) || s.celular.includes(q) || s.codigo.toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q);
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!celular.trim()) { setError("El número de celular es obligatorio."); return; }
    if (!email.trim()) { setError("El correo electrónico es obligatorio: es lo que el socio usará para ingresar."); return; }
    if (ctx.socios.some((s) => s.celular === celular.trim())) {
      setError("Ya existe un socio registrado con ese número de celular.");
      return;
    }
    setGuardando(true);
    try {
      await ctx.crearSocio({
        nombre: nombre.trim(),
        celular: celular.trim(),
        email: email.trim(),
        rol: esSuperadmin ? rolNuevo : "socio",
        password: esSuperadmin ? passwordNuevo : "",
      });
      setNombre(""); setCelular(""); setEmail(""); setRolNuevo("socio"); setPasswordNuevo(""); setMostrarForm(false);
    } catch (err) {
      setError(err.message || "No se pudo registrar el socio.");
    } finally {
      setGuardando(false);
    }
  }

  function abrirGestionAcceso(socio) {
    setGestionandoId(gestionandoId === socio.id ? null : socio.id);
    setRolEdit(socio.rol);
    setMensajeAcceso(null);
  }

  async function guardarRol(socio) {
    await ctx.cambiarRolSocio(socio.id, rolEdit);
    setMensajeAcceso(`Rol de ${socio.nombre} actualizado a ${etiquetaRol(rolEdit)}.`);
  }

  async function enviarRestablecimiento(socio) {
    if (!socio.email) { setMensajeAcceso("Este socio no tiene correo registrado."); return; }
    try {
      await ctx.enviarRestablecimientoPassword(socio.email);
      setMensajeAcceso(`Se envió un enlace para restablecer la contraseña al correo ${socio.email}.`);
    } catch (err) {
      setMensajeAcceso(err.message || "No se pudo enviar el enlace.");
    }
  }

  return (
    <div>
      <PageHeader title="Socios" subtitle="Padrón de socios de la fraternidad. El correo electrónico se usa para iniciar sesión." />

      <div className="flex justify-between items-center gap-3 flex-wrap mb-4">
        <input className="field-input" style={{ maxWidth: 260 }} placeholder="Buscar por nombre, celular, correo o código…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <Btn icon={mostrarForm ? X : Plus} onClick={() => setMostrarForm((v) => !v)}>{mostrarForm ? "Cancelar" : "Nuevo socio"}</Btn>
      </div>

      {mostrarForm && (
        <Card style={{ marginBottom: 20 }}>
          <h3 style={{ fontFamily: FONT_DISPLAY, color: INK, marginTop: 0 }}>Registrar socio</h3>
          {error && <Mensaje tipo="error">{error}</Mensaje>}
          <div>
            <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <Field label="Nombre completo"><input className="field-input" required value={nombre} onChange={(e) => setNombre(e.target.value)} /></Field>
              <Field label="Número de celular"><input className="field-input" required value={celular} onChange={(e) => setCelular(e.target.value)} /></Field>
              <Field label="Correo electrónico (será su usuario para ingresar)"><input className="field-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              {esSuperadmin ? (
                <>
                  <Field label="Rol de acceso al sistema">
                    <select className="field-input" value={rolNuevo} onChange={(e) => setRolNuevo(e.target.value)}>
                      {ROLES_ACCESO.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Contraseña (opcional, mínimo 6 caracteres)">
                    <input className="field-input" placeholder="Si se deja vacío, será 123456" value={passwordNuevo} onChange={(e) => setPasswordNuevo(e.target.value)} />
                  </Field>
                </>
              ) : (
                <div style={{ gridColumn: "1 / -1", fontSize: "0.83rem", color: TEXT_MUTED, alignSelf: "end" }}>
                  El nuevo socio ingresará con rol <b>Socio</b> y contraseña por defecto <b>123456</b>. Solo un súper administrador puede cambiar esto.
                </div>
              )}
            </div>
            <div className="mt-4"><Btn onClick={handleSubmit} disabled={guardando}>{guardando ? "Guardando…" : "Guardar socio"}</Btn></div>
          </div>
        </Card>
      )}

      <Card>
        {filtrados.length === 0 ? <Vacio>No hay socios que coincidan con la búsqueda.</Vacio> : (
          <table className="ledger">
            <thead><tr><th>Nombre</th><th>Celular</th><th>Código</th><th>Estado</th><th>Rol de acceso</th><th></th></tr></thead>
            <tbody>
              {filtrados.map((s) => (
                <Fragment key={s.id}>
                  <tr>
                    <td>{s.nombre}</td>
                    <td>{s.celular}</td>
                    <td>{s.codigo}</td>
                    <td>
                      <span style={{ cursor: "pointer" }} onClick={() => ctx.toggleEstadoSocio(s)}>
                        <Badge tono={s.estado === "activo" ? "verde" : "gris"}>{s.estado === "activo" ? "Activo" : "Inactivo"}</Badge>
                      </span>
                    </td>
                    <td><Badge tono={tonoRol(s.rol)}>{etiquetaRol(s.rol)}</Badge></td>
                    <td>
                      <div className="flex items-center gap-3 justify-end">
                        {esSuperadmin && (
                          <span style={{ color: INK_SOFT, cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }} onClick={() => abrirGestionAcceso(s)}>
                            Gestionar acceso
                          </span>
                        )}
                        <span className="flex items-center gap-1" style={{ color: INK, cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }} onClick={() => irAFicha(s.id)}>
                          Ver ficha <ChevronRight size={14} />
                        </span>
                      </div>
                    </td>
                  </tr>
                  {gestionandoId === s.id && (
                    <tr>
                      <td colSpan={6} style={{ background: PAPER, borderBottom: `1px solid ${LINE}` }}>
                        <div style={{ padding: "14px 4px" }}>
                          <p style={{ margin: "0 0 10px", fontWeight: 600, color: INK }}>
                            Gestionar acceso de {s.nombre} <span style={{ fontWeight: 400, color: TEXT_MUTED }}>(solo súper administrador)</span>
                          </p>
                          {mensajeAcceso && <Mensaje tipo="exito">{mensajeAcceso}</Mensaje>}
                          <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                            <Field label="Rol de acceso">
                              <select className="field-input" value={rolEdit} onChange={(e) => setRolEdit(e.target.value)}>
                                {ROLES_ACCESO.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                              </select>
                            </Field>
                          </div>
                          <p style={{ fontSize: "0.8rem", color: TEXT_MUTED, marginTop: 8 }}>
                            Para cambiar la contraseña de un socio, se le envía un enlace de restablecimiento a su correo — por seguridad, la aplicación no puede fijarla directamente.
                          </p>
                          <div className="mt-3 flex gap-2">
                            <Btn onClick={() => guardarRol(s)}>Guardar rol</Btn>
                            <Btn variante="secondary" onClick={() => enviarRestablecimiento(s)}>Enviar enlace de restablecimiento</Btn>
                            <Btn variante="secondary" onClick={() => setGestionandoId(null)}>Cerrar</Btn>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// =====================================================================
// FICHA DE SOCIO (resumen, patrimonial, mensual)
// =====================================================================
function FichaSocio({ ctx, socioId, volver }) {
  const [tab, setTab] = useState("general");
  const socio = ctx.socios.find((s) => s.id === socioId);
  if (!socio) return <Vacio>Socio no encontrado.</Vacio>;

  const esAdmin = esNivelAdmin(ctx.sesion.rol);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          {esAdmin && (
            <span style={{ color: TEXT_MUTED, fontSize: "0.82rem", cursor: "pointer" }} onClick={volver}>&larr; Volver a socios</span>
          )}
          <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: "1.7rem", color: INK, margin: "4px 0 0" }}>{socio.nombre}</h1>
          <p style={{ color: TEXT_MUTED, margin: "4px 0 0" }}>
            {socio.celular} · Código {socio.codigo} ·{" "}
            <Badge tono={socio.estado === "activo" ? "verde" : "gris"}>{socio.estado === "activo" ? "Activo" : "Inactivo"}</Badge>{" "}
            <Badge tono={tonoRol(socio.rol)}>{etiquetaRol(socio.rol)}</Badge>
          </p>
        </div>
        {esAdmin && <Btn variante="secondary" onClick={() => ctx.toggleEstadoSocio(socio)}>{socio.estado === "activo" ? "Desactivar socio" : "Reactivar socio"}</Btn>}
      </div>

      <div className="flex gap-1 mb-5" style={{ borderBottom: `1px solid ${LINE_STRONG}` }}>
        {[["general", "Resumen general"], ["patrimonial", "Aporte patrimonial"], ["mensual", "Aportes mensuales"]].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              background: "none", border: "none", padding: "10px 16px", fontWeight: 600, fontSize: "0.88rem",
              color: tab === id ? INK : TEXT_MUTED, cursor: "pointer",
              borderBottom: tab === id ? `2px solid ${GOLD}` : "2px solid transparent", marginBottom: -1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "general" && <FichaGeneral ctx={ctx} socio={socio} />}
      {tab === "patrimonial" && <FichaPatrimonial ctx={ctx} socio={socio} esAdmin={esAdmin} />}
      {tab === "mensual" && <FichaMensual ctx={ctx} socio={socio} esAdmin={esAdmin} />}
    </div>
  );
}

function FichaGeneral({ ctx, socio }) {
  const acordado = ctx.obligPatrimoniales[socio.id] || 0;
  const movP = ctx.movPatrimoniales[socio.id] || [];
  const pagadoP = sumar(movP, "haber");
  const saldoP = acordado - pagadoP;
  const pct = acordado > 0 ? Math.min(100, Math.round((pagadoP / acordado) * 100)) : 0;

  const movM = ctx.movMensuales[socio.id] || [];
  const generadoM = sumar(movM, "debe");
  const pagadoM = sumar(movM, "haber");
  const saldoM = generadoM - pagadoM;

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ fontFamily: FONT_DISPLAY, color: INK, marginTop: 0 }}>1 · Aporte patrimonial</h3>
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <StatCard label="Acordado" value={bs(acordado)} />
          <StatCard label="Pagado" value={bs(pagadoP)} tono="positivo" />
          <StatCard label="Saldo pendiente" value={bs(saldoP)} tono={saldoP > 0 ? "negativo" : "positivo"} />
          <StatCard label="Porcentaje pagado" value={`${pct}%`} />
        </div>
      </Card>
      <Card>
        <h3 style={{ fontFamily: FONT_DISPLAY, color: INK, marginTop: 0 }}>2 · Aportes mensuales</h3>
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <StatCard label="Total generado" value={bs(generadoM)} />
          <StatCard label="Total pagado" value={bs(pagadoM)} tono="positivo" />
          <StatCard label="Saldo pendiente" value={bs(saldoM)} tono={saldoM > 0 ? "negativo" : "positivo"} />
        </div>
      </Card>
      <p style={{ marginTop: 16, color: TEXT_MUTED, fontSize: "0.85rem" }}>
        Estas son dos cuentas independientes: el saldo patrimonial y el saldo mensual nunca se mezclan entre sí.
      </p>
    </div>
  );
}

function LedgerConSaldo({ movimientos }) {
  let acumulado = 0;
  const filas = movimientos.map((m) => {
    acumulado += Number(m.debe) - Number(m.haber);
    return { ...m, saldo: acumulado };
  });
  const totalDebe = sumar(movimientos, "debe");
  const totalHaber = sumar(movimientos, "haber");
  if (filas.length === 0) return <Vacio>Aún no hay movimientos registrados en esta cuenta.</Vacio>;
  return (
    <table className="ledger">
      <thead><tr><th>Fecha</th><th>Concepto</th><th className="num">Debe</th><th className="num">Haber</th><th className="num">Saldo</th></tr></thead>
      <tbody>
        {filas.map((f) => (
          <tr key={f.id}>
            <td>{fdate(f.fecha)}</td>
            <td>{f.concepto}</td>
            <td className="num monto">{f.debe > 0 ? bs(f.debe) : "—"}</td>
            <td className="num monto">{f.haber > 0 ? bs(f.haber) : "—"}</td>
            <td className="num monto">{bs(f.saldo)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr><td colSpan={2}>Total</td><td className="num monto">{bs(totalDebe)}</td><td className="num monto">{bs(totalHaber)}</td><td className="num monto">{bs(totalDebe - totalHaber)}</td></tr>
      </tfoot>
    </table>
  );
}

function FichaPatrimonial({ ctx, socio, esAdmin }) {
  const [form, setForm] = useState(null); // 'obligacion' | 'pago' | null
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [concepto, setConcepto] = useState("Pago patrimonial");
  const [error, setError] = useState(null);
  const movs = ctx.movPatrimoniales[socio.id] || [];

  async function guardar(e) {
    e.preventDefault();
    setError(null);
    const m = Number(monto);
    if (!m || m <= 0) { setError("Ingresa un monto válido, mayor a cero."); return; }
    if (form === "obligacion") await ctx.crearObligacionPatrimonial(socio.id, m, fecha);
    else await ctx.registrarPagoPatrimonial(socio.id, m, fecha, concepto);
    setMonto(""); setForm(null);
  }

  return (
    <div>
      <div className="flex justify-between items-center gap-3 flex-wrap mb-4">
        <h3 style={{ fontFamily: FONT_DISPLAY, color: INK, margin: 0 }}>Mayor — Aporte patrimonial</h3>
        {esAdmin && (
          <div className="flex gap-2">
            <Btn variante="secondary" onClick={() => setForm(form === "obligacion" ? null : "obligacion")}>Definir obligación</Btn>
            <Btn onClick={() => setForm(form === "pago" ? null : "pago")}>Registrar pago</Btn>
          </div>
        )}
      </div>

      {form && (
        <Card style={{ marginBottom: 16 }}>
          <h3 style={{ fontFamily: FONT_DISPLAY, color: INK, marginTop: 0 }}>
            {form === "obligacion" ? "Definir monto patrimonial acordado" : "Registrar pago patrimonial"}
          </h3>
          {error && <Mensaje tipo="error">{error}</Mensaje>}
          <div>
            <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <Field label={form === "obligacion" ? "Monto acordado (Bs)" : "Monto pagado (Bs)"}>
                <input className="field-input" type="number" min="0" step="0.01" required value={monto} onChange={(e) => setMonto(e.target.value)} />
              </Field>
              <Field label="Fecha"><input className="field-input" type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
              {form === "pago" && <Field label="Concepto"><input className="field-input" value={concepto} onChange={(e) => setConcepto(e.target.value)} /></Field>}
            </div>
            <div className="mt-4"><Btn onClick={guardar}>{form === "obligacion" ? "Guardar obligación" : "Registrar pago"}</Btn></div>
          </div>
        </Card>
      )}

      <Card><LedgerConSaldo movimientos={movs} /></Card>
    </div>
  );
}

function FichaMensual({ ctx, socio, esAdmin }) {
  const [form, setForm] = useState(false);
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [concepto, setConcepto] = useState("Pago mensualidad");
  const [error, setError] = useState(null);
  const movs = ctx.movMensuales[socio.id] || [];
  const totalDebe = sumar(movs, "debe");
  const totalHaber = sumar(movs, "haber");
  const generados = movs.filter((m) => m.debe > 0).length;
  const pagos = movs.filter((m) => m.haber > 0).length;

  async function guardar(e) {
    e.preventDefault();
    setError(null);
    const m = Number(monto);
    if (!m || m <= 0) { setError("Ingresa un monto válido, mayor a cero."); return; }
    await ctx.registrarPagoMensual(socio.id, m, fecha, concepto);
    setMonto(""); setForm(false);
  }

  return (
    <div>
      <div className="flex justify-between items-center gap-3 flex-wrap mb-4">
        <h3 style={{ fontFamily: FONT_DISPLAY, color: INK, margin: 0 }}>Mayor — Aportes mensuales</h3>
        {esAdmin && <Btn onClick={() => setForm((v) => !v)}>{form ? "Cancelar" : "Registrar pago"}</Btn>}
      </div>

      <div className="grid gap-3.5 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <StatCard label="Meses con obligación generada" value={generados} />
        <StatCard label="Pagos registrados" value={pagos} />
        <StatCard label="Saldo pendiente" value={bs(totalDebe - totalHaber)} tono={totalDebe - totalHaber > 0 ? "negativo" : "positivo"} />
      </div>

      {form && (
        <Card style={{ marginBottom: 16 }}>
          <h3 style={{ fontFamily: FONT_DISPLAY, color: INK, marginTop: 0 }}>Registrar pago de mensualidad</h3>
          <p style={{ color: TEXT_MUTED, fontSize: "0.85rem" }}>Puedes registrar un pago que cubra uno o varios meses; ingresa el monto total pagado.</p>
          {error && <Mensaje tipo="error">{error}</Mensaje>}
          <div>
            <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <Field label="Monto pagado (Bs)"><input className="field-input" type="number" min="0" step="0.01" required value={monto} onChange={(e) => setMonto(e.target.value)} /></Field>
              <Field label="Fecha"><input className="field-input" type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
              <Field label="Concepto"><input className="field-input" value={concepto} onChange={(e) => setConcepto(e.target.value)} /></Field>
            </div>
            <div className="mt-4"><Btn onClick={guardar}>Registrar pago</Btn></div>
          </div>
        </Card>
      )}

      <Card>
        {movs.length === 0 ? (
          <Vacio>Aún no hay mensualidades generadas para este socio. Genéralas desde «Configuración anual».</Vacio>
        ) : <LedgerConSaldo movimientos={movs} />}
      </Card>
    </div>
  );
}

// =====================================================================
// INGRESOS
// =====================================================================
const ETIQUETA_TIPO = { patrimonial: "Patrimonial", mensual: "Mensual", voluntario: "Voluntario" };

const TIPOS_INGRESO = [
  { value: "patrimonial", label: "Aporte patrimonial", concepto: "Pago patrimonial", ayuda: "Se registra como Haber en el mayor patrimonial del socio y reduce su saldo pendiente." },
  { value: "mensual", label: "Aporte mensual", concepto: "Pago mensualidad", ayuda: "Se registra como Haber en el mayor de aportes mensuales del socio y reduce su saldo pendiente." },
  { value: "voluntario", label: "Aporte voluntario", concepto: "Aporte voluntario", ayuda: "Ingresa como aporte voluntario. No afecta el mayor patrimonial ni el mayor mensual del socio." },
];

function Ingresos({ ctx }) {
  const { periodo, Render } = useFiltroPeriodo();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [tipo, setTipo] = useState("patrimonial");
  const [socioId, setSocioId] = useState(ctx.socios[0]?.id || "");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [concepto, setConcepto] = useState("Pago patrimonial");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(null);

  const sociosPorId = Object.fromEntries(ctx.socios.map((s) => [s.id, s]));
  const filtrados = ctx.ingresosConsolidados.filter((i) => i.fecha >= periodo.desde && i.fecha <= periodo.hasta);
  const total = filtrados.reduce((a, b) => a + b.monto, 0);
  const tipoInfo = TIPOS_INGRESO.find((t) => t.value === tipo);

  function cambiarTipo(v) {
    setTipo(v);
    setConcepto(TIPOS_INGRESO.find((t) => t.value === v).concepto);
    setError(null);
  }

  const saldoRef = socioId ? (tipo === "patrimonial" ? ctx.saldoPatrimonial(socioId) : tipo === "mensual" ? ctx.saldoMensual(socioId) : null) : null;

  async function guardar(e) {
    e.preventDefault();
    setError(null);
    setExito(null);
    const m = Number(monto);
    if (!socioId) { setError("Selecciona el socio que realiza el aporte."); return; }
    if (!m || m <= 0) { setError("Ingresa un monto válido, mayor a cero."); return; }

    if (tipo === "patrimonial") await ctx.registrarPagoPatrimonial(socioId, m, fecha, concepto);
    else if (tipo === "mensual") await ctx.registrarPagoMensual(socioId, m, fecha, concepto);
    else await ctx.registrarAporteVoluntario(socioId, m, fecha, concepto, observaciones);

    setExito(`Ingreso de ${bs(m)} registrado como ${tipoInfo.label.toLowerCase()} para ${sociosPorId[socioId]?.nombre}.`);
    setMonto(""); setObservaciones("");
  }

  return (
    <div>
      <PageHeader
        title="Libro de ingresos"
        subtitle="Consolida los aportes patrimoniales, mensuales y voluntarios de la fraternidad."
        right={<Btn icon={mostrarForm ? X : Plus} onClick={() => setMostrarForm((v) => !v)}>{mostrarForm ? "Cancelar" : "Registrar ingreso"}</Btn>}
      />

      {mostrarForm && (
        <Card style={{ marginBottom: 20 }}>
          <h3 style={{ fontFamily: FONT_DISPLAY, color: INK, marginTop: 0 }}>Registrar ingreso de socio</h3>

          <div className="flex gap-1 mb-4" style={{ borderBottom: `1px solid ${LINE_STRONG}` }}>
            {TIPOS_INGRESO.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => cambiarTipo(t.value)}
                style={{
                  background: "none", border: "none", padding: "9px 14px", fontWeight: 600, fontSize: "0.85rem",
                  color: tipo === t.value ? INK : TEXT_MUTED, cursor: "pointer",
                  borderBottom: tipo === t.value ? `2px solid ${GOLD}` : "2px solid transparent", marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <p style={{ color: TEXT_MUTED, fontSize: "0.85rem" }}>{tipoInfo.ayuda}</p>
          {error && <Mensaje tipo="error">{error}</Mensaje>}
          {exito && <Mensaje tipo="exito">{exito}</Mensaje>}

          <div>
            <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              <Field label="Socio">
                <select className="field-input" value={socioId} onChange={(e) => setSocioId(e.target.value)}>
                  {ctx.socios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </Field>
              <Field label="Monto (Bs)"><input className="field-input" type="number" min="0" step="0.01" required value={monto} onChange={(e) => setMonto(e.target.value)} /></Field>
              <Field label="Fecha"><input className="field-input" type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
              <Field label="Concepto"><input className="field-input" value={concepto} onChange={(e) => setConcepto(e.target.value)} /></Field>
              {tipo === "voluntario" && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <Field label="Observaciones"><textarea className="field-input" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} /></Field>
                </div>
              )}
            </div>

            {saldoRef !== null && (
              <p style={{ marginTop: 10, fontSize: "0.83rem", color: TEXT_MUTED }}>
                Saldo pendiente actual en esta cuenta:{" "}
                <span className="monto" style={{ fontWeight: 700, color: saldoRef > 0 ? RUST : GREEN }}>{bs(saldoRef)}</span>
              </p>
            )}

            <div className="mt-4"><Btn onClick={guardar}>Registrar ingreso</Btn></div>
          </div>
        </Card>
      )}

      <Render />

      <Card>
        {filtrados.length === 0 ? <Vacio>No se registraron ingresos en este período.</Vacio> : (
          <table className="ledger">
            <thead><tr><th>Fecha</th><th>Tipo</th><th>Socio</th><th>Concepto</th><th className="num">Monto</th></tr></thead>
            <tbody>
              {filtrados.map((i) => (
                <tr key={i.id}>
                  <td>{fdate(i.fecha)}</td>
                  <td><Badge>{ETIQUETA_TIPO[i.tipo]}</Badge></td>
                  <td>{sociosPorId[i.socioId]?.nombre || "—"}</td>
                  <td>{i.concepto}</td>
                  <td className="num monto">{bs(i.monto)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={4}>Total del período</td><td className="num monto">{bs(total)}</td></tr></tfoot>
          </table>
        )}
      </Card>
    </div>
  );
}

// =====================================================================
// GASTOS
// =====================================================================
const CATEGORIAS_GASTO = [
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "servicios_basicos", label: "Servicios básicos" },
  { value: "mano_de_obra", label: "Mano de obra" },
  { value: "sueldos", label: "Sueldos" },
  { value: "gastos_varios", label: "Gastos varios" },
];

function EnlaceComprobante({ ctx, ruta }) {
  const [cargando, setCargando] = useState(false);
  async function abrir() {
    setCargando(true);
    try {
      const url = await ctx.obtenerUrlComprobante(ruta);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      alert("No se pudo abrir el comprobante.");
    } finally {
      setCargando(false);
    }
  }
  return (
    <span className="flex items-center gap-1" style={{ color: INK, cursor: "pointer" }} onClick={abrir}>
      <Paperclip size={13} />{cargando ? "Abriendo…" : "Ver comprobante"}
    </span>
  );
}

function Gastos({ ctx }) {
  const { periodo, Render } = useFiltroPeriodo();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [categoriaFiltro, setCategoriaFiltro] = useState("");

  const [fecha, setFecha] = useState(hoyISO());
  const [categoria, setCategoria] = useState("gastos_varios");
  const [concepto, setConcepto] = useState("");
  const [beneficiario, setBeneficiario] = useState("");
  const [monto, setMonto] = useState("");
  const [formaPago, setFormaPago] = useState("");
  const [archivo, setArchivo] = useState(null);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  let filtrados = ctx.gastos.filter((g) => g.fecha >= periodo.desde && g.fecha <= periodo.hasta);
  if (categoriaFiltro) filtrados = filtrados.filter((g) => g.categoria === categoriaFiltro);
  const total = filtrados.reduce((a, b) => a + Number(b.monto), 0);

  async function guardar(e) {
    e.preventDefault();
    setError(null);
    const m = Number(monto);
    if (!concepto.trim()) { setError("El concepto del gasto es obligatorio."); return; }
    if (!m || m <= 0) { setError("Ingresa un monto válido, mayor a cero."); return; }
    setGuardando(true);
    try {
      await ctx.registrarGasto({ fecha, categoria, concepto: concepto.trim(), beneficiario, monto: m, formaPago }, archivo);
      setConcepto(""); setBeneficiario(""); setMonto(""); setFormaPago(""); setArchivo(null); setMostrarForm(false);
    } catch (err) {
      setError(err.message || "No se pudo registrar el gasto.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Libro de gastos"
        subtitle="Registro de egresos de la fraternidad, clasificados por categoría."
        right={<Btn icon={mostrarForm ? X : Plus} onClick={() => setMostrarForm((v) => !v)}>{mostrarForm ? "Cancelar" : "Registrar gasto"}</Btn>}
      />

      {mostrarForm && (
        <Card style={{ marginBottom: 20 }}>
          <h3 style={{ fontFamily: FONT_DISPLAY, color: INK, marginTop: 0 }}>Registrar gasto</h3>
          {error && <Mensaje tipo="error">{error}</Mensaje>}
          <div>
            <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              <Field label="Fecha"><input className="field-input" type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
              <Field label="Categoría">
                <select className="field-input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                  {CATEGORIAS_GASTO.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Concepto / descripción"><input className="field-input" required value={concepto} onChange={(e) => setConcepto(e.target.value)} /></Field>
              </div>
              <Field label="Beneficiario / proveedor"><input className="field-input" value={beneficiario} onChange={(e) => setBeneficiario(e.target.value)} /></Field>
              <Field label="Monto (Bs)"><input className="field-input" type="number" min="0" step="0.01" required value={monto} onChange={(e) => setMonto(e.target.value)} /></Field>
              <Field label="Forma de pago"><input className="field-input" placeholder="Efectivo, transferencia…" value={formaPago} onChange={(e) => setFormaPago(e.target.value)} /></Field>
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Comprobante adjunto (opcional — PDF, JPG o PNG)">
                  <input className="field-input" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setArchivo(e.target.files?.[0] || null)} />
                </Field>
              </div>
            </div>
            <div className="mt-4"><Btn onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar gasto"}</Btn></div>
          </div>
        </Card>
      )}

      <Render />

      <div className="mb-4" style={{ maxWidth: 220 }}>
        <Field label="Filtrar por categoría">
          <select className="field-input" value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}>
            <option value="">Todas las categorías</option>
            {CATEGORIAS_GASTO.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
      </div>

      <Card>
        {filtrados.length === 0 ? <Vacio>No se registraron gastos en este período.</Vacio> : (
          <table className="ledger">
            <thead><tr><th>Fecha</th><th>Categoría</th><th>Concepto</th><th>Beneficiario</th><th>Comprobante</th><th className="num">Monto</th></tr></thead>
            <tbody>
              {filtrados.map((g) => (
                <tr key={g.id}>
                  <td>{fdate(g.fecha)}</td>
                  <td><Badge>{CATEGORIAS_GASTO.find((c) => c.value === g.categoria)?.label}</Badge></td>
                  <td>{g.concepto}</td>
                  <td>{g.beneficiario || "—"}</td>
                  <td>{g.comprobante_ruta ? <EnlaceComprobante ctx={ctx} ruta={g.comprobante_ruta} /> : "—"}</td>
                  <td className="num monto">{bs(g.monto)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={5}>Total del período</td><td className="num monto">{bs(total)}</td></tr></tfoot>
          </table>
        )}
      </Card>
    </div>
  );
}

// =====================================================================
// REPORTES
// =====================================================================
function Reportes({ ctx }) {
  const { periodo, Render } = useFiltroPeriodo();
  const ingresosPeriodo = ctx.ingresosConsolidados.filter((i) => i.fecha >= periodo.desde && i.fecha <= periodo.hasta);
  const gastosPeriodo = ctx.gastos.filter((g) => g.fecha >= periodo.desde && g.fecha <= periodo.hasta);

  const porTipo = { patrimonial: 0, mensual: 0, voluntario: 0 };
  ingresosPeriodo.forEach((i) => { porTipo[i.tipo] += i.monto; });
  const porCategoria = Object.fromEntries(CATEGORIAS_GASTO.map((c) => [c.value, 0]));
  gastosPeriodo.forEach((g) => { porCategoria[g.categoria] += Number(g.monto); });

  const totalIng = porTipo.patrimonial + porTipo.mensual + porTipo.voluntario;
  const totalGas = Object.values(porCategoria).reduce((a, b) => a + b, 0);

  const pendientes = ctx.socios
    .filter((s) => s.estado === "activo")
    .map((s) => ({ nombre: s.nombre, sp: ctx.saldoPatrimonial(s.id), sm: ctx.saldoMensual(s.id) }))
    .filter((s) => s.sp > 0 || s.sm > 0);

  return (
    <div>
      <PageHeader title="Reportes" subtitle="Resultados financieros por período, útiles para la administración de la fraternidad." />
      <Render />

      <div className="grid gap-3.5 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <StatCard label={`Ingresos — ${periodo.etiqueta}`} value={bs(totalIng)} tono="positivo" />
        <StatCard label={`Egresos — ${periodo.etiqueta}`} value={bs(totalGas)} tono="negativo" />
        <StatCard label="Saldo del período" value={bs(totalIng - totalGas)} tono={totalIng - totalGas >= 0 ? "positivo" : "negativo"} />
      </div>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ fontFamily: FONT_DISPLAY, color: INK, marginTop: 0 }}>Ingresos por tipo</h3>
        <table className="ledger">
          <tbody>
            <tr><td>Patrimoniales</td><td className="num monto">{bs(porTipo.patrimonial)}</td></tr>
            <tr><td>Mensuales</td><td className="num monto">{bs(porTipo.mensual)}</td></tr>
            <tr><td>Voluntarios</td><td className="num monto">{bs(porTipo.voluntario)}</td></tr>
          </tbody>
          <tfoot><tr><td>Total</td><td className="num monto">{bs(totalIng)}</td></tr></tfoot>
        </table>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ fontFamily: FONT_DISPLAY, color: INK, marginTop: 0 }}>Egresos por categoría</h3>
        <table className="ledger">
          <tbody>
            {CATEGORIAS_GASTO.map((c) => <tr key={c.value}><td>{c.label}</td><td className="num monto">{bs(porCategoria[c.value])}</td></tr>)}
          </tbody>
          <tfoot><tr><td>Total</td><td className="num monto">{bs(totalGas)}</td></tr></tfoot>
        </table>
      </Card>

      <Card>
        <h3 style={{ fontFamily: FONT_DISPLAY, color: INK, marginTop: 0 }}>Socios con saldo pendiente</h3>
        {pendientes.length === 0 ? <Vacio>No hay socios con saldos pendientes.</Vacio> : (
          <table className="ledger">
            <thead><tr><th>Socio</th><th className="num">Pendiente patrimonial</th><th className="num">Pendiente mensual</th></tr></thead>
            <tbody>
              {pendientes.map((s) => (
                <tr key={s.nombre}>
                  <td>{s.nombre}</td>
                  <td className="num monto">{s.sp > 0 ? bs(s.sp) : "—"}</td>
                  <td className="num monto">{s.sm > 0 ? bs(s.sm) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// =====================================================================
// CONFIGURACIÓN ANUAL
// =====================================================================
function Configuracion({ ctx }) {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [cuota, setCuota] = useState("");
  const [msg, setMsg] = useState(null);

  const [anioGen, setAnioGen] = useState(new Date().getFullYear());
  const [mesGen, setMesGen] = useState(new Date().getMonth() + 1);
  const [msgGen, setMsgGen] = useState(null);

  async function guardarCuota(e) {
    e.preventDefault();
    const c = Number(cuota);
    if (!c || c <= 0) { setMsg({ tipo: "error", texto: "Ingresa una cuota mensual válida." }); return; }
    await ctx.guardarCuotaAnual(anio, c);
    setMsg({ tipo: "exito", texto: `Cuota mensual de ${anio} guardada correctamente.` });
    setCuota("");
  }

  async function generar(e) {
    e.preventDefault();
    const r = await ctx.generarMensualidades(anioGen, mesGen);
    setMsgGen({ tipo: r.ok ? "exito" : "error", texto: r.mensaje });
  }

  return (
    <div>
      <PageHeader title="Configuración anual" subtitle="Define la cuota mensual de cada año. Los valores anteriores quedan preservados como historial." />

      <Card style={{ marginBottom: 20 }}>
        <h3 style={{ fontFamily: FONT_DISPLAY, color: INK, marginTop: 0 }}>Definir cuota mensual del año</h3>
        {msg && <Mensaje tipo={msg.tipo}>{msg.texto}</Mensaje>}
        <div>
          <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <Field label="Año"><input className="field-input" type="number" required value={anio} onChange={(e) => setAnio(Number(e.target.value))} /></Field>
            <Field label="Cuota mensual (Bs)"><input className="field-input" type="number" min="0" step="0.01" required value={cuota} onChange={(e) => setCuota(e.target.value)} /></Field>
          </div>
          <div className="mt-4"><Btn onClick={guardarCuota}>Guardar cuota</Btn></div>
        </div>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <h3 style={{ fontFamily: FONT_DISPLAY, color: INK, marginTop: 0 }}>Generar mensualidades</h3>
        <p style={{ color: TEXT_MUTED, fontSize: "0.85rem" }}>
          Genera la obligación mensual para todos los socios activos del mes y año seleccionados. No se duplican obligaciones ya generadas.
        </p>
        {msgGen && <Mensaje tipo={msgGen.tipo}>{msgGen.texto}</Mensaje>}
        <div>
          <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <Field label="Mes">
              <select className="field-input" value={mesGen} onChange={(e) => setMesGen(Number(e.target.value))}>
                {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </Field>
            <Field label="Año"><input className="field-input" type="number" required value={anioGen} onChange={(e) => setAnioGen(Number(e.target.value))} /></Field>
          </div>
          <div className="mt-4"><Btn onClick={generar}>Generar mensualidades</Btn></div>
        </div>
      </Card>

      <Card>
        <h3 style={{ fontFamily: FONT_DISPLAY, color: INK, marginTop: 0 }}>Historial de cuotas por año</h3>
        <table className="ledger">
          <thead><tr><th>Año</th><th className="num">Cuota mensual</th></tr></thead>
          <tbody>
            {ctx.configAnual.slice().sort((a, b) => b.anio - a.anio).map((c) => (
              <tr key={c.anio}><td>{c.anio}</td><td className="num monto">{bs(c.cuota)}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// =====================================================================
// FIN
// =====================================================================

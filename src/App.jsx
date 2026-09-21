import { useCallback, useEffect, useId, useMemo, useState, Fragment, cloneElement, Children } from "react";
import {
  LayoutDashboard, Users, ArrowDownCircle, ArrowUpCircle, BarChart3,
  Settings, LogOut, Plus, X, ChevronRight, ChevronUp, ChevronDown, Paperclip, Check,
  Menu, Eye, EyeOff, Trash2, Download, Printer, Pencil, AlertCircle,
} from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";
import * as api from "./lib/data.js";
import { useAppData } from "./hooks/useAppData.js";
import { exportarCSV } from "./lib/csv.js";
import { exportarExcel, descargarPlantillaImportacion } from "./lib/excel.js";
import { leerLibroExcel, importarDatos } from "./lib/importar.js";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const ROLES_ACCESO = [
  { value: "socio", label: "Socio" },
  { value: "supervisor", label: "Supervisor" },
  { value: "admin", label: "Administrador" },
  { value: "superadmin", label: "Súper administrador" },
];

const ESTADOS_SOCIO = [
  { value: "patrimonial", label: "Patrimonial" },
  { value: "invitado", label: "Invitado" },
  { value: "de_baja", label: "De baja" },
];

const TURNOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

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
// Puede VER las secciones administrativas (lectura): admin, superadmin y supervisor.
function puedeVer(rol) {
  return rol === "admin" || rol === "superadmin" || rol === "supervisor";
}
// Puede EDITAR / crear / registrar: solo admin y superadmin (nunca supervisor).
function puedeEditar(rol) {
  return rol === "admin" || rol === "superadmin";
}
function etiquetaRol(rol) {
  return ROLES_ACCESO.find((r) => r.value === rol)?.label || "Socio";
}
function tonoRol(rol) {
  if (rol === "superadmin") return "dorado";
  if (rol === "admin") return "verde";
  if (rol === "supervisor") return "azul";
  return "gris";
}
function etiquetaEstado(estado) {
  return ESTADOS_SOCIO.find((e) => e.value === estado)?.label || estado;
}
function tonoEstado(estado) {
  if (estado === "patrimonial") return "verde";
  if (estado === "invitado") return "dorado";
  if (estado === "de_baja") return "rojo";
  return "gris";
}

// =====================================================================
// AVISOS (toasts) — bus mínimo sin dependencias
// =====================================================================
let toastListeners = [];
let toastSeq = 0;
export const aviso = {
  exito: (texto) => emitirAviso("success", texto),
  error: (texto) => emitirAviso("error", texto),
};
function emitirAviso(tipo, texto) {
  const item = { id: ++toastSeq, tipo, texto };
  toastListeners.forEach((fn) => fn(item));
}
function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    function onAviso(item) {
      setItems((prev) => [...prev, item]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== item.id)), 4200);
    }
    toastListeners.push(onAviso);
    return () => { toastListeners = toastListeners.filter((f) => f !== onAviso); };
  }, []);
  if (items.length === 0) return null;
  return (
    <div className="toast-stack no-print">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.tipo}`} role="status">
          {t.tipo === "success" ? <Check size={16} /> : <AlertCircle size={16} />}
          <span>{t.texto}</span>
        </div>
      ))}
    </div>
  );
}

// =====================================================================
// CONFIRMACIÓN — modal imperativo para acciones sensibles
// =====================================================================
function useConfirmar() {
  const [estado, setEstado] = useState(null);
  const confirmar = useCallback((opts) => new Promise((resolve) => setEstado({ ...opts, resolver: resolve })), []);
  function cerrar(resultado) {
    estado?.resolver?.(resultado);
    setEstado(null);
  }
  const ConfirmUI = !estado ? null : (
    <div className="fixed inset-0 flex items-center justify-center p-4 drawer-backdrop" style={{ zIndex: 70 }} onClick={() => cerrar(false)}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full"
        style={{ maxWidth: 420, background: "var(--paper-card)", border: "1px solid var(--line)", borderRadius: 8, padding: 24, boxShadow: "0 12px 32px rgba(20,46,34,.22)" }}
      >
        <h3 style={{ fontFamily: "var(--font-display)", color: "var(--ink)", marginTop: 0 }}>{estado.titulo}</h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>{estado.mensaje}</p>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn btn-secondary" onClick={() => cerrar(false)}>Cancelar</button>
          <button className={`btn ${estado.peligro ? "btn-danger" : "btn-primary"}`} onClick={() => cerrar(true)}>
            {estado.textoConfirmar || "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
  return { confirmar, ConfirmUI };
}

// =====================================================================
// COMPONENTE RAÍZ
// =====================================================================
export default function App() {
  const [sesion, setSesion] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [nombreFraternidad, setNombreFraternidad] = useState("Fraternidad");

  const [vista, setVista] = useState("dashboard");
  const [socioSeleccionado, setSocioSeleccionado] = useState(null);
  const [menuAbierto, setMenuAbierto] = useState(false);

  const { confirmar, ConfirmUI } = useConfirmar();

  useEffect(() => {
    api.obtenerSesionActual()
      .then((socio) => setSesion(socio))
      .catch(() => setSesion(null))
      .finally(() => setCargandoSesion(false));

    // Se pide incluso antes de iniciar sesión, para que la pantalla de
    // ingreso ya muestre el nombre que haya definido el súper administrador.
    api.obtenerAjuste("nombre_fraternidad", "Fraternidad").then(setNombreFraternidad);

    const { data: sub } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "SIGNED_OUT") setSesion(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    document.title = `${nombreFraternidad} — Gestión financiera`;
  }, [nombreFraternidad]);

  const ctxData = useAppData(sesion);

  if (cargandoSesion) {
    return <PantallaCarga texto="Cargando sesión…" />;
  }

  if (!sesion) {
    return <Login onIngresar={(socio) => { setSesion(socio); setVista("dashboard"); }} nombreFraternidad={nombreFraternidad} />;
  }

  if (sesion.requiere_configuracion_inicial) {
    return (
      <ConfigurarCuentaInicial
        socioId={sesion.id}
        nombreFraternidad={nombreFraternidad}
        onListo={(datos) => setSesion((s) => ({ ...s, ...datos }))}
        onSalir={async () => { await api.cerrarSesion(); setSesion(null); }}
      />
    );
  }

  if (ctxData.cargando) {
    return <PantallaCarga texto="Cargando datos de la fraternidad…" />;
  }

  if (ctxData.error) {
    return <PantallaCarga texto={`Ocurrió un error al cargar los datos: ${ctxData.error}`} esError />;
  }

  async function cerrarSesion() {
    await api.cerrarSesion();
    setSesion(null);
  }

  function irA(v) {
    setVista(v);
    setSocioSeleccionado(null);
    setMenuAbierto(false);
  }

  const ctx = { sesion, confirmar, nombreFraternidad, setNombreFraternidad, ...ctxData };
  const verAdmin = puedeVer(sesion.rol);
  const NAV_ADMIN = [
    { id: "dashboard", label: "Panel general", icon: LayoutDashboard },
    { id: "socios", label: "Socios", icon: Users },
    { id: "ingresos", label: "Libro de ingresos", icon: ArrowDownCircle },
    { id: "gastos", label: "Libro de gastos", icon: ArrowUpCircle },
    { id: "reportes", label: "Reportes", icon: BarChart3 },
    ...(puedeEditar(sesion.rol) ? [{ id: "configuracion", label: "Configuración anual", icon: Settings }] : []),
  ];
  const NAV_SOCIO = [{ id: "dashboard", label: "Mi resumen", icon: LayoutDashboard }];
  const items = verAdmin ? NAV_ADMIN : NAV_SOCIO;
  const tituloVista = items.find((i) => i.id === vista)?.label || "Ficha de socio";

  return (
    <div className="min-h-screen flex" style={{ background: "var(--paper)", fontFamily: "var(--font-body)", color: "var(--text)" }}>
      <ToastHost />
      {ConfirmUI}

      <Sidebar sesion={sesion} vista={vista} items={items} irA={irA} onSalir={cerrarSesion} abierto={menuAbierto} cerrar={() => setMenuAbierto(false)} nombreFraternidad={nombreFraternidad} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden no-print flex items-center justify-between px-4 py-3 sticky top-0" style={{ background: "var(--ink)", color: "#fff", zIndex: 30 }}>
          <button className="btn-ghost" style={{ color: "#fff", padding: 4 }} onClick={() => setMenuAbierto(true)} aria-label="Abrir menú">
            <Menu size={22} />
          </button>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem" }}>{tituloVista}</span>
          <span style={{ width: 22 }} />
        </header>

        <main className="flex-1 w-full px-4 py-6 sm:px-8 sm:py-10" style={{ maxWidth: 1180 }}>
          {vista === "dashboard" && <Dashboard ctx={ctx} irASocio={(id) => { setSocioSeleccionado(id); setVista("ficha"); }} />}
          {vista === "socios" && verAdmin && (
            <Socios ctx={ctx} irAFicha={(id) => { setSocioSeleccionado(id); setVista("ficha"); }} />
          )}
          {vista === "ficha" && (
            <FichaSocio
              ctx={ctx}
              socioId={verAdmin ? socioSeleccionado : sesion.id}
              volver={() => setVista(verAdmin ? "socios" : "dashboard")}
            />
          )}
          {vista === "ingresos" && verAdmin && <Ingresos ctx={ctx} />}
          {vista === "gastos" && verAdmin && <Gastos ctx={ctx} />}
          {vista === "reportes" && verAdmin && <Reportes ctx={ctx} />}
          {vista === "configuracion" && puedeEditar(sesion.rol) && <Configuracion ctx={ctx} />}
        </main>
      </div>
    </div>
  );
}

function PantallaCarga({ texto, esError }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-5" style={{ background: "var(--paper)", fontFamily: "var(--font-body)" }}>
      <div className="flex flex-col items-center gap-3" style={{ maxWidth: 420, textAlign: "center" }}>
        {!esError && <div className="skeleton" style={{ width: 40, height: 40, borderRadius: "50%" }} />}
        <div style={{ color: esError ? "var(--rust)" : "var(--text-muted)", fontSize: "0.95rem" }}>{texto}</div>
      </div>
    </div>
  );
}

// =====================================================================
// LOGIN
// =====================================================================
function Login({ onIngresar, nombreFraternidad }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
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
    <div
      className="min-h-screen flex items-center justify-center px-5"
      style={{ background: "radial-gradient(circle at 20% 15%, #1d3f30 0%, var(--ink) 45%, #0e2118 100%)", fontFamily: "var(--font-body)" }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full"
        style={{ maxWidth: 380, background: "var(--paper-card)", border: "1px solid var(--line)", borderRadius: 10, padding: "36px 30px", boxShadow: "0 20px 60px rgba(0,0,0,.35)" }}
      >
        <div className="flex items-center gap-3 mb-1">
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 40, height: 40, borderRadius: 8, background: "var(--ink)", color: "var(--gold)", fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 700 }}
          >
            {(nombreFraternidad || "F").trim().charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", color: "var(--ink)", fontSize: "1.35rem", margin: 0, lineHeight: 1.1 }}>{nombreFraternidad}</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", margin: 0 }}>Gestión financiera</p>
          </div>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", margin: "18px 0 20px" }}>Ingresa con tu correo y tu contraseña.</p>

        {error && <Mensaje tipo="error">{error}</Mensaje>}

        <div className="flex flex-col gap-3.5 mb-5">
          <Field label="Correo electrónico">
            <input className="field-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus />
          </Field>
          <Field label="Contraseña">
            <div className="relative">
              <input
                className="field-input"
                style={{ paddingRight: 40 }}
                type={verPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setVerPassword((v) => !v)}
                className="absolute"
                style={{ right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
                aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {verPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </Field>
        </div>
        <button type="submit" className="btn btn-primary w-full justify-center" disabled={cargando}>
          {cargando ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </div>
  );
}

// =====================================================================
// PRIMER INGRESO — el socio con credenciales temporales define su
// correo real y su nueva contraseña antes de poder usar el resto de la app.
// =====================================================================
function ConfigurarCuentaInicial({ socioId, nombreFraternidad, onListo, onSalir }) {
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(null);
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!correo.trim() || !correo.includes("@")) { setError("Ingresa un correo válido."); return; }
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    if (password !== confirmarPassword) { setError("Las dos contraseñas no coinciden."); return; }

    setGuardando(true);
    try {
      await api.completarConfiguracionInicial(socioId, { nuevoCorreo: correo, nuevaPassword: password });
      setExito(
        `Tu contraseña ya quedó activa. Te enviamos un enlace de confirmación a ${correo.trim()} — ábrelo para terminar de activar tu acceso con ese correo. Mientras tanto, puedes seguir usando el sistema con normalidad.`
      );
      onListo({ email: correo.trim(), requiere_configuracion_inicial: false });
    } catch (err) {
      setError(err.message || "No se pudo guardar tus datos. Intenta nuevamente.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-5"
      style={{ background: "radial-gradient(circle at 20% 15%, #1d3f30 0%, var(--ink) 45%, #0e2118 100%)", fontFamily: "var(--font-body)" }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full"
        style={{ maxWidth: 420, background: "var(--paper-card)", border: "1px solid var(--line)", borderRadius: 10, padding: "36px 30px", boxShadow: "0 20px 60px rgba(0,0,0,.35)" }}
      >
        <h1 style={{ fontFamily: "var(--font-display)", color: "var(--ink)", fontSize: "1.3rem", margin: "0 0 4px" }}>Configura tu cuenta</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", margin: "0 0 20px" }}>
          Ingresaste con un correo y una contraseña temporales que te dio {nombreFraternidad}. Antes de continuar,
          define tu correo real y una contraseña propia.
        </p>

        {error && <Mensaje tipo="error">{error}</Mensaje>}
        {exito && <Mensaje tipo="exito">{exito}</Mensaje>}

        {!exito ? (
          <>
            <div className="flex flex-col gap-3.5 mb-5">
              <Field label="Tu correo real">
                <input className="field-input" type="email" required value={correo} onChange={(e) => setCorreo(e.target.value)} autoFocus />
              </Field>
              <Field label="Nueva contraseña (mínimo 6 caracteres)">
                <div className="relative">
                  <input
                    className="field-input"
                    style={{ paddingRight: 40 }}
                    type={verPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setVerPassword((v) => !v)}
                    className="absolute"
                    style={{ right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
                    aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {verPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </Field>
              <Field label="Confirmar nueva contraseña">
                <input className="field-input" type={verPassword ? "text" : "password"} required value={confirmarPassword} onChange={(e) => setConfirmarPassword(e.target.value)} />
              </Field>
            </div>
            <button type="submit" className="btn btn-primary w-full justify-center" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar y continuar"}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary w-full justify-center" onClick={() => window.location.reload()}>
            Entendido, continuar
          </button>
        )}

        <button type="button" onClick={onSalir} className="w-full mt-3" style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "0.82rem", cursor: "pointer" }}>
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}

// =====================================================================
// SIDEBAR (fija en escritorio, cajón deslizante en móvil)
// =====================================================================
function Sidebar({ sesion, vista, items, irA, onSalir, abierto, cerrar, nombreFraternidad }) {
  const contenido = (
    <div className="flex flex-col gap-6 h-full" style={{ width: "var(--sidebar-w)", background: "var(--ink)", color: "#e2ece5", padding: "24px 16px" }}>
      <div className="flex items-center justify-between">
        <div style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", color: "#fff" }}>
          {nombreFraternidad}
          <small style={{ display: "block", fontFamily: "var(--font-body)", fontSize: "0.72rem", color: "#8fa89a", fontWeight: 500, marginTop: 4 }}>
            Gestión financiera
          </small>
        </div>
        <button className="md:hidden btn-ghost" style={{ color: "#cbd8d0" }} onClick={cerrar} aria-label="Cerrar menú">
          <X size={20} />
        </button>
      </div>
      <nav className="flex flex-col gap-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.id} className={`nav-link ${vista === item.id ? "activo" : ""}`} onClick={() => irA(item.id)}>
              <Icon size={16} strokeWidth={2} />
              {item.label}
            </div>
          );
        })}
      </nav>
      <div className="mt-auto" style={{ fontSize: "0.8rem", color: "#84a091" }}>
        <div style={{ color: "#e2ece5", fontWeight: 500 }}>{sesion.nombre}</div>
        <div style={{ opacity: 0.85 }}>{etiquetaRol(sesion.rol)}</div>
        <button onClick={onSalir} className="w-full flex items-center justify-center gap-1.5 mt-2" style={{ background: "none", border: "1px solid #3d5c4c", color: "#dfe8e2", padding: "7px 10px", borderRadius: 6, cursor: "pointer" }}>
          <LogOut size={14} /> Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Escritorio: columna fija */}
      <aside className="hidden md:block flex-shrink-0 no-print">{contenido}</aside>

      {/* Móvil: cajón deslizante */}
      {abierto && (
        <div className="md:hidden fixed inset-0 no-print" style={{ zIndex: 50 }}>
          <div className="drawer-backdrop absolute inset-0" onClick={cerrar} />
          {/* z-index explícito y mayor al del fondo (z-index: 40 en .drawer-backdrop):
              sin esto, el fondo invisible quedaba pintado ENCIMA del menú y absorbía
              todos los toques, por eso no se podía seleccionar ninguna opción. */}
          <div className="absolute inset-y-0 left-0" style={{ animation: "slideIn 200ms ease", zIndex: 45 }}>
            {contenido}
          </div>
        </div>
      )}
    </>
  );
}

// =====================================================================
// BLOQUES REUTILIZABLES
// =====================================================================
function Card({ children, style, className = "" }) {
  return (
    <div
      className={`print-card ${className}`}
      style={{ background: "var(--paper-card)", border: "1px solid var(--line)", borderRadius: 8, padding: 20, boxShadow: "0 1px 2px rgba(22,33,61,.06)", ...style }}
    >
      {children}
    </div>
  );
}
function StatCard({ label, value, tono }) {
  const color = tono === "positivo" ? "var(--green)" : tono === "negativo" ? "var(--rust)" : "var(--ink)";
  return (
    <div className="print-card" style={{ background: "var(--paper-card)", border: "1px solid var(--line)", borderRadius: 8, padding: "16px 18px" }}>
      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 500, marginBottom: 6 }}>{label}</div>
      <div className="monto" style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", color }}>{value}</div>
    </div>
  );
}
function Badge({ children, tono = "gris" }) {
  const map = {
    verde: { bg: "var(--green-bg)", color: "var(--green)" },
    rojo: { bg: "var(--rust-bg)", color: "var(--rust)" },
    gris: { bg: "#e6e7e0", color: "var(--text-muted)" },
    dorado: { bg: "var(--gold-bg)", color: "var(--gold)" },
    azul: { bg: "#e4ecf1", color: "#2b5a7a" },
  };
  const s = map[tono];
  return <span style={{ background: s.bg, color: s.color, padding: "2px 9px", borderRadius: 100, fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap" }}>{children}</span>;
}
function Btn({ children, onClick, variante = "primary", type = "button", disabled, icon: Icon, className = "" }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`btn btn-${variante} ${className}`}>
      {Icon && <Icon size={15} />}
      {children}
    </button>
  );
}
function Field({ label, children }) {
  const autoId = useId();
  const child = Children.only(children);
  const id = child.props.id || autoId;
  const campo = cloneElement(child, { id });
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--ink-soft)" }}>{label}</label>
      {campo}
    </div>
  );
}
function PageHeader({ title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
      <div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", color: "var(--ink)", margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ color: "var(--text-muted)", margin: "4px 0 0", maxWidth: "60ch" }}>{subtitle}</p>}
      </div>
      {right && <div className="no-print">{right}</div>}
    </div>
  );
}
function Vacio({ children }) {
  return <div style={{ padding: "36px 0", textAlign: "center", color: "var(--text-muted)" }}>{children}</div>;
}
function Mensaje({ tipo, children }) {
  const ok = tipo === "exito";
  return (
    <div
      role="alert"
      className="flex items-start gap-2"
      style={{ background: ok ? "var(--green-bg)" : "var(--rust-bg)", color: ok ? "var(--green)" : "var(--rust)", padding: "9px 12px", borderRadius: 6, fontSize: "0.85rem", marginBottom: 14 }}
    >
      {ok ? <Check size={15} className="flex-shrink-0 mt-0.5" /> : <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />}
      <span>{children}</span>
    </div>
  );
}

// Botón para descargar CSV, coherente con el resto de acciones
function BotonCSV({ nombreArchivo, columnas, filas }) {
  return (
    <Btn variante="secondary" icon={Download} onClick={() => exportarCSV(nombreArchivo, columnas, filas)} disabled={filas.length === 0}>
      Descargar CSV
    </Btn>
  );
}

// Botón para descargar un archivo .xlsx real (una o varias hojas)
function BotonExcel({ nombreArchivo, hojas }) {
  const vacio = hojas.every((h) => h.filas.length === 0);
  return (
    <Btn variante="secondary" icon={Download} onClick={() => exportarExcel(nombreArchivo, hojas)} disabled={vacio}>
      Descargar Excel
    </Btn>
  );
}

// Paginación simple "mostrar más", para no renderizar tablas larguísimas de una vez
function useMostrarMas(lista, inicial = 25, paso = 25) {
  const [cantidad, setCantidad] = useState(inicial);
  const visibles = lista.slice(0, cantidad);
  const hayMas = lista.length > cantidad;
  function BotonMostrarMas() {
    if (!hayMas) return null;
    return (
      <div className="text-center mt-3">
        <button className="btn btn-secondary" onClick={() => setCantidad((c) => c + paso)}>
          Mostrar más ({lista.length - cantidad} restantes)
        </button>
      </div>
    );
  }
  return { visibles, hayMas, BotonMostrarMas };
}

// Orden de columnas para tablas tipo mayor
function useOrden(datos, columnaInicial, direccionInicial = "desc") {
  const [columna, setColumna] = useState(columnaInicial);
  const [direccion, setDireccion] = useState(direccionInicial);
  function ordenarPor(col) {
    if (col === columna) setDireccion((d) => (d === "asc" ? "desc" : "asc"));
    else { setColumna(col); setDireccion("asc"); }
  }
  const ordenados = useMemo(() => {
    const copia = [...datos];
    copia.sort((a, b) => {
      let va = a[columna]; let vb = b[columna];
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return direccion === "asc" ? -1 : 1;
      if (va > vb) return direccion === "asc" ? 1 : -1;
      return 0;
    });
    return copia;
  }, [datos, columna, direccion]);
  function Th({ col, children, className = "" }) {
    const activa = col === columna;
    return (
      <th className={`ordenable ${className}`} onClick={() => ordenarPor(col)}>
        <span className="inline-flex items-center gap-0.5">
          {children}
          {activa && (direccion === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
        </span>
      </th>
    );
  }
  return { ordenados, Th };
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
      <div className="flex gap-3 items-end flex-wrap mb-5 no-print">
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

// Barra horizontal comparativa (para Reportes)
function Barra({ label, valor, max, color, montoTexto }) {
  const pct = max > 0 ? Math.max(2, Math.round((valor / max) * 100)) : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1" style={{ fontSize: "0.82rem" }}>
        <span style={{ color: "var(--text)" }}>{label}</span>
        <span className="monto" style={{ fontWeight: 600, color: "var(--text)" }}>{montoTexto ?? bs(valor)}</span>
      </div>
      <div className="barra-track">
        <div className="barra-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// =====================================================================
// DASHBOARD
// =====================================================================
function Dashboard({ ctx, irASocio }) {
  if (puedeVer(ctx.sesion.rol)) return <DashboardAdmin ctx={ctx} />;
  return <DashboardSocio ctx={ctx} irASocio={irASocio} />;
}

function DashboardAdmin({ ctx }) {
  const { periodo, Render } = useFiltroPeriodo();
  const enPeriodo = ctx.ingresosConsolidados.filter((i) => i.fecha >= periodo.desde && i.fecha <= periodo.hasta);
  const externosPeriodo = ctx.ingresosExternos.filter((i) => i.fecha >= periodo.desde && i.fecha <= periodo.hasta);
  const gastosPeriodo = ctx.gastos.filter((g) => g.fecha >= periodo.desde && g.fecha <= periodo.hasta);

  const porTipo = { patrimonial: 0, mensual: 0, voluntario: 0 };
  enPeriodo.forEach((i) => { porTipo[i.tipo] += i.monto; });
  const totalExternoPeriodo = externosPeriodo.reduce((a, b) => a + Number(b.monto), 0);
  const totalIngPeriodo = porTipo.patrimonial + porTipo.mensual + porTipo.voluntario + totalExternoPeriodo;
  const totalGastoPeriodo = gastosPeriodo.reduce((a, b) => a + Number(b.monto), 0);
  const saldoPeriodo = totalIngPeriodo - totalGastoPeriodo;
  const saldoAcumulado = ctx.totalIngresos - ctx.totalGastos;

  const enBaja = ctx.socios.filter((s) => s.estado === "de_baja").length;
  const patrimoniales = ctx.socios.filter((s) => s.estado === "patrimonial").length;
  const invitados = ctx.socios.filter((s) => s.estado === "invitado").length;
  const conPendientePatr = ctx.socios.filter((s) => ctx.saldoPatrimonial(s.id) > 0).length;
  const conPendienteMens = ctx.socios.filter((s) => ctx.saldoMensual(s.id) > 0).length;
  const maxOrigen = Math.max(porTipo.patrimonial, porTipo.mensual, porTipo.voluntario, totalExternoPeriodo, 1);

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
        <h3 style={{ fontFamily: "var(--font-display)", color: "var(--ink)", marginTop: 0 }}>Ingresos por origen</h3>
        <Barra label="Aportes patrimoniales" valor={porTipo.patrimonial} max={maxOrigen} color="var(--green)" />
        <Barra label="Aportes mensuales" valor={porTipo.mensual} max={maxOrigen} color="var(--gold)" />
        <Barra label="Aportes voluntarios" valor={porTipo.voluntario} max={maxOrigen} color="var(--ink-soft)" />
        <Barra label="Otros ingresos (alquiler, donaciones...)" valor={totalExternoPeriodo} max={maxOrigen} color="#2b5a7a" />
      </Card>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <StatCard label="Socios patrimoniales" value={patrimoniales} />
        <StatCard label="Socios invitados" value={invitados} />
        <StatCard label="Socios de baja" value={enBaja} />
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
          <span style={{ color: "var(--ink)", textDecoration: "underline", cursor: "pointer", fontWeight: 600 }} onClick={() => irASocio(id)}>
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
  const [fechaNac, setFechaNac] = useState("");
  const [turnoNuevo, setTurnoNuevo] = useState("");
  const [estadoNuevo, setEstadoNuevo] = useState("patrimonial");
  const [rolNuevo, setRolNuevo] = useState("socio");
  const [passwordNuevo, setPasswordNuevo] = useState("");
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const [detalleId, setDetalleId] = useState(null);
  const [tabDetalle, setTabDetalle] = useState("datos");
  const [rolEdit, setRolEdit] = useState("socio");
  const [estadoEdit, setEstadoEdit] = useState("patrimonial");
  const [datosEdit, setDatosEdit] = useState({ nombre: "", celular: "", email: "", fechaNacimiento: "", turno: "" });
  const [mensajeDetalle, setMensajeDetalle] = useState(null);
  const [guardandoDetalle, setGuardandoDetalle] = useState(false);
  const [correoActivar, setCorreoActivar] = useState("");
  const [passwordActivar, setPasswordActivar] = useState("");
  const [activando, setActivando] = useState(false);

  const esSuperadmin = ctx.sesion.rol === "superadmin";
  const puedeEscribir = puedeEditar(ctx.sesion.rol);

  const filtrados = useMemo(() => ctx.socios.filter((s) => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return s.nombre.toLowerCase().includes(q) || s.celular.includes(q) || s.codigo.toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q);
  }), [ctx.socios, busqueda]);

  const { ordenados, Th } = useOrden(filtrados, "nombre", "asc");
  const { visibles, BotonMostrarMas } = useMostrarMas(ordenados, 30);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!celular.trim()) { setError("El número de celular es obligatorio."); return; }
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
        fechaNacimiento: fechaNac || null,
        turno: turnoNuevo || null,
        estado: esSuperadmin ? estadoNuevo : "patrimonial",
        rol: esSuperadmin ? rolNuevo : "socio",
        password: esSuperadmin ? passwordNuevo : "",
      });
      aviso.exito(`Socio ${nombre.trim()} registrado correctamente.`);
      setNombre(""); setCelular(""); setEmail(""); setFechaNac(""); setTurnoNuevo(""); setEstadoNuevo("patrimonial"); setRolNuevo("socio"); setPasswordNuevo(""); setMostrarForm(false);
    } catch (err) {
      setError(err.message || "No se pudo registrar el socio.");
    } finally {
      setGuardando(false);
    }
  }

  function abrirDetalle(socio) {
    if (detalleId === socio.id) { setDetalleId(null); return; }
    setDetalleId(socio.id);
    setTabDetalle(socio.auth_user_id ? "datos" : "crear_acceso");
    setRolEdit(socio.rol);
    setEstadoEdit(socio.estado);
    setDatosEdit({ nombre: socio.nombre, celular: socio.celular, email: socio.email || "", fechaNacimiento: socio.fecha_nacimiento || "", turno: socio.turno || "" });
    setCorreoActivar(""); setPasswordActivar("");
    setMensajeDetalle(null);
  }

  async function guardarDatos(socio) {
    setGuardandoDetalle(true);
    setMensajeDetalle(null);
    try {
      await ctx.editarSocio(socio.id, datosEdit);
      setMensajeDetalle({ tipo: "exito", texto: "Datos actualizados correctamente." });
      aviso.exito(`Datos de ${datosEdit.nombre} actualizados.`);
    } catch (err) {
      setMensajeDetalle({ tipo: "error", texto: err.message || "No se pudieron guardar los datos." });
    } finally {
      setGuardandoDetalle(false);
    }
  }

  async function activarAcceso(socio) {
    setActivando(true);
    setMensajeDetalle(null);
    try {
      await ctx.activarAccesoSocio(socio.id, socio.celular, { email: correoActivar, password: passwordActivar });
      const correoUsado = correoActivar.trim() || api.correoTemporalDesdeCelular(socio.celular);
      setMensajeDetalle({ tipo: "exito", texto: `Acceso creado. Correo: ${correoUsado} · Contraseña: ${passwordActivar.trim() || "123456"}` });
      aviso.exito(`Acceso creado para ${socio.nombre}.`);
    } catch (err) {
      setMensajeDetalle({ tipo: "error", texto: err.message || "No se pudo crear el acceso (revisa si llegaste al límite de cuentas por hora de Supabase)." });
    } finally {
      setActivando(false);
    }
  }

  async function guardarRol(socio) {
    await ctx.cambiarRolSocio(socio.id, rolEdit);
    setMensajeDetalle({ tipo: "exito", texto: `Rol de ${socio.nombre} actualizado a ${etiquetaRol(rolEdit)}.` });
    aviso.exito(`Rol de ${socio.nombre} actualizado.`);
  }

  async function guardarEstado(socio) {
    if (estadoEdit === "de_baja") {
      const ok = await ctx.confirmar({
        titulo: "Dar de baja al socio",
        mensaje: `${socio.nombre} no podrá iniciar sesión ni se le generarán nuevas mensualidades. Su historial se conserva intacto.`,
        textoConfirmar: "Dar de baja",
        peligro: true,
      });
      if (!ok) return;
    }
    await ctx.cambiarEstadoSocio(socio.id, estadoEdit);
    setMensajeDetalle({ tipo: "exito", texto: `Estado de ${socio.nombre} actualizado a ${etiquetaEstado(estadoEdit)}.` });
    aviso.exito(`Estado de ${socio.nombre} actualizado.`);
  }

  async function enviarRestablecimiento(socio) {
    if (!socio.email) { setMensajeDetalle({ tipo: "error", texto: "Este socio no tiene correo registrado." }); return; }
    try {
      await ctx.enviarRestablecimientoPassword(socio.email);
      setMensajeDetalle({ tipo: "exito", texto: `Se envió un enlace para restablecer la contraseña al correo ${socio.email}.` });
    } catch (err) {
      setMensajeDetalle({ tipo: "error", texto: err.message || "No se pudo enviar el enlace." });
    }
  }

  return (
    <div>
      <PageHeader title="Socios" subtitle="Padrón de socios de la fraternidad. El correo electrónico se usa para iniciar sesión." />

      <div className="flex justify-between items-center gap-3 flex-wrap mb-4">
        <input className="field-input" style={{ maxWidth: 280 }} placeholder="Buscar por nombre, celular, correo o código…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        {puedeEscribir && (
          <Btn icon={mostrarForm ? X : Plus} onClick={() => setMostrarForm((v) => !v)}>{mostrarForm ? "Cancelar" : "Nuevo socio"}</Btn>
        )}
      </div>

      {mostrarForm && puedeEscribir && (
        <Card style={{ marginBottom: 20 }}>
          <h3 style={{ fontFamily: "var(--font-display)", color: "var(--ink)", marginTop: 0 }}>Registrar socio</h3>
          {error && <Mensaje tipo="error">{error}</Mensaje>}
          <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <Field label="Nombre completo"><input className="field-input" required value={nombre} onChange={(e) => setNombre(e.target.value)} /></Field>
            <Field label="Número de celular"><input className="field-input" required value={celular} onChange={(e) => setCelular(e.target.value)} /></Field>
            <div>
              <Field label="Correo electrónico (opcional — déjalo vacío si no lo conoces)">
                <input className="field-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              {!email.trim() ? (
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: "4px 0 0" }}>
                  {celular.trim()
                    ? <>Se creará un correo temporal: <b className="monto">{api.correoTemporalDesdeCelular(celular)}</b>. En su primer ingreso, el socio define su correo real y su contraseña.</>
                    : "Sin correo ni celular, no se puede generar un correo temporal — completa al menos el celular."}
                </p>
              ) : (
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: "4px 0 0" }}>Este será su correo de acceso desde ya (no pasará por la pantalla de primer ingreso).</p>
              )}
            </div>
            <Field label="Fecha de nacimiento"><input className="field-input" type="date" value={fechaNac} onChange={(e) => setFechaNac(e.target.value)} /></Field>
            <Field label="Turno">
              <select className="field-input" value={turnoNuevo} onChange={(e) => setTurnoNuevo(e.target.value)}>
                <option value="">Sin asignar</option>
                {TURNOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            {esSuperadmin ? (
              <>
                <Field label="Estado del socio">
                  <select className="field-input" value={estadoNuevo} onChange={(e) => setEstadoNuevo(e.target.value)}>
                    {ESTADOS_SOCIO.map((es) => <option key={es.value} value={es.value}>{es.label}</option>)}
                  </select>
                </Field>
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
              <div style={{ gridColumn: "1 / -1", fontSize: "0.83rem", color: "var(--text-muted)", alignSelf: "end" }}>
                El nuevo socio ingresará como <b>Patrimonial</b>, con rol <b>Socio</b> y contraseña por defecto <b>123456</b>. Solo un súper administrador puede cambiar esto.
              </div>
            )}
          </div>
          <div className="mt-4"><Btn onClick={handleSubmit} disabled={guardando}>{guardando ? "Guardando…" : "Guardar socio"}</Btn></div>
        </Card>
      )}

      <Card>
        {visibles.length === 0 ? <Vacio>No hay socios que coincidan con la búsqueda.</Vacio> : (
          <div className="ledger-wrap">
            <table className="ledger">
              <thead>
                <tr>
                  <Th col="nombre">Nombre</Th>
                  <Th col="celular">Celular</Th>
                  <Th col="codigo">Código</Th>
                  <Th col="estado">Estado</Th>
                  <Th col="turno">Turno</Th>
                  <th>Rol de acceso</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((s) => (
                  <Fragment key={s.id}>
                    <tr>
                      <td>
                        <span className="flex items-center gap-1.5 flex-wrap">
                          {s.nombre}
                          {!s.auth_user_id && <Badge tono="rojo">Sin acceso</Badge>}
                          {s.requiere_configuracion_inicial && <Badge tono="dorado">Primer ingreso pendiente</Badge>}
                        </span>
                      </td>
                      <td>{s.celular}</td>
                      <td>{s.codigo}</td>
                      <td><Badge tono={tonoEstado(s.estado)}>{etiquetaEstado(s.estado)}</Badge></td>
                      <td>{s.turno || "—"}</td>
                      <td><Badge tono={tonoRol(s.rol)}>{etiquetaRol(s.rol)}</Badge></td>
                      <td>
                        <div className="flex items-center gap-3 justify-end">
                          {puedeEscribir && (
                            <span className="flex items-center gap-1" style={{ color: "var(--ink-soft)", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }} onClick={() => abrirDetalle(s)}>
                              <Pencil size={13} /> Gestionar
                            </span>
                          )}
                          <span className="flex items-center gap-1" style={{ color: "var(--ink)", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }} onClick={() => irAFicha(s.id)}>
                            Ver ficha <ChevronRight size={14} />
                          </span>
                        </div>
                      </td>
                    </tr>
                    {detalleId === s.id && puedeEscribir && (
                      <tr>
                        <td colSpan={7} style={{ background: "var(--paper)", borderBottom: "1px solid var(--line)" }}>
                          <div style={{ padding: "16px 4px" }}>
                            <div className="flex gap-1 mb-4" style={{ borderBottom: "1px solid var(--line-strong)" }}>
                              {["datos", ...(!s.auth_user_id ? ["crear_acceso"] : []), ...(esSuperadmin ? ["acceso"] : [])].map((t) => (
                                <button
                                  key={t}
                                  onClick={() => { setTabDetalle(t); setMensajeDetalle(null); }}
                                  style={{
                                    background: "none", border: "none", padding: "8px 14px", fontWeight: 600, fontSize: "0.85rem",
                                    color: tabDetalle === t ? "var(--ink)" : "var(--text-muted)", cursor: "pointer",
                                    borderBottom: tabDetalle === t ? "2px solid var(--gold)" : "2px solid transparent", marginBottom: -1,
                                  }}
                                >
                                  {t === "datos" ? "Editar datos" : t === "crear_acceso" ? "Crear acceso" : "Estado y rol de acceso"}
                                </button>
                              ))}
                            </div>

                            {mensajeDetalle && <Mensaje tipo={mensajeDetalle.tipo}>{mensajeDetalle.texto}</Mensaje>}

                            {tabDetalle === "crear_acceso" && !s.auth_user_id && (
                              <>
                                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 0 }}>
                                  Este socio todavía no tiene cuenta para iniciar sesión (así quedan los importados desde Excel).
                                  Créala aquí de a una — nunca en lote, porque Supabase limita cuántas cuentas se pueden crear por hora.
                                </p>
                                <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                                  <Field label="Correo real (opcional — vacío = correo temporal)">
                                    <input className="field-input" type="email" placeholder={api.correoTemporalDesdeCelular(s.celular)} value={correoActivar} onChange={(e) => setCorreoActivar(e.target.value)} />
                                  </Field>
                                  <Field label="Contraseña inicial (opcional, mín. 6 — vacío = 123456)">
                                    <input className="field-input" value={passwordActivar} onChange={(e) => setPasswordActivar(e.target.value)} />
                                  </Field>
                                </div>
                                <div className="mt-3"><Btn onClick={() => activarAcceso(s)} disabled={activando}>{activando ? "Creando…" : "Activar acceso"}</Btn></div>
                              </>
                            )}

                            {tabDetalle === "datos" && (
                              <>
                                <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                                  <Field label="Nombre completo"><input className="field-input" value={datosEdit.nombre} onChange={(e) => setDatosEdit((d) => ({ ...d, nombre: e.target.value }))} /></Field>
                                  <Field label="Celular"><input className="field-input" value={datosEdit.celular} onChange={(e) => setDatosEdit((d) => ({ ...d, celular: e.target.value }))} /></Field>
                                  <Field label="Correo electrónico"><input className="field-input" type="email" value={datosEdit.email} onChange={(e) => setDatosEdit((d) => ({ ...d, email: e.target.value }))} /></Field>
                                  <Field label="Fecha de nacimiento"><input className="field-input" type="date" value={datosEdit.fechaNacimiento || ""} onChange={(e) => setDatosEdit((d) => ({ ...d, fechaNacimiento: e.target.value }))} /></Field>
                                  <Field label="Turno">
                                    <select className="field-input" value={datosEdit.turno || ""} onChange={(e) => setDatosEdit((d) => ({ ...d, turno: e.target.value }))}>
                                      <option value="">Sin asignar</option>
                                      {TURNOS.map((t) => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                  </Field>
                                </div>
                                <div className="mt-3"><Btn onClick={() => guardarDatos(s)} disabled={guardandoDetalle}>{guardandoDetalle ? "Guardando…" : "Guardar datos"}</Btn></div>
                              </>
                            )}

                            {tabDetalle === "acceso" && esSuperadmin && (
                              <>
                                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 0 }}>
                                  Solo un súper administrador puede cambiar el estado o el rol de un socio.
                                </p>
                                <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                                  <Field label="Estado del socio">
                                    <select className="field-input" value={estadoEdit} onChange={(e) => setEstadoEdit(e.target.value)}>
                                      {ESTADOS_SOCIO.map((es) => <option key={es.value} value={es.value}>{es.label}</option>)}
                                    </select>
                                  </Field>
                                  <Field label="Rol de acceso">
                                    <select className="field-input" value={rolEdit} onChange={(e) => setRolEdit(e.target.value)}>
                                      {ROLES_ACCESO.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                                    </select>
                                  </Field>
                                </div>
                                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 8 }}>
                                  Para cambiar la contraseña de un socio, se le envía un enlace de restablecimiento a su correo — por seguridad, la aplicación no puede fijarla directamente.
                                </p>
                                <div className="mt-3 flex gap-2 flex-wrap">
                                  <Btn onClick={() => guardarEstado(s)}>Guardar estado</Btn>
                                  <Btn onClick={() => guardarRol(s)}>Guardar rol</Btn>
                                  <Btn variante="secondary" onClick={() => enviarRestablecimiento(s)}>Enviar enlace de restablecimiento</Btn>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <BotonMostrarMas />
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

  const verAdmin = puedeVer(ctx.sesion.rol);
  const editable = puedeEditar(ctx.sesion.rol);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          {verAdmin && (
            <span style={{ color: "var(--text-muted)", fontSize: "0.82rem", cursor: "pointer" }} onClick={volver}>&larr; Volver a socios</span>
          )}
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", color: "var(--ink)", margin: "4px 0 0" }}>{socio.nombre}</h1>
          <p style={{ color: "var(--text-muted)", margin: "4px 0 0" }}>
            {socio.celular} · Código {socio.codigo} ·{" "}
            <Badge tono={tonoEstado(socio.estado)}>{etiquetaEstado(socio.estado)}</Badge>{" "}
            <Badge tono={tonoRol(socio.rol)}>{etiquetaRol(socio.rol)}</Badge>
          </p>
        </div>
      </div>

      <div className="flex gap-1 mb-5 no-print" style={{ borderBottom: "1px solid var(--line-strong)", overflowX: "auto" }}>
        {[["general", "Resumen general"], ["patrimonial", "Aporte patrimonial"], ["mensual", "Aportes mensuales"], ["voluntario", "Aportes voluntarios"]].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              background: "none", border: "none", padding: "10px 16px", fontWeight: 600, fontSize: "0.88rem", whiteSpace: "nowrap",
              color: tab === id ? "var(--ink)" : "var(--text-muted)", cursor: "pointer",
              borderBottom: tab === id ? "2px solid var(--gold)" : "2px solid transparent", marginBottom: -1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "general" && <FichaGeneral ctx={ctx} socio={socio} />}
      {tab === "patrimonial" && <FichaPatrimonial ctx={ctx} socio={socio} esAdmin={editable} />}
      {tab === "mensual" && <FichaMensual ctx={ctx} socio={socio} esAdmin={editable} />}
      {tab === "voluntario" && <FichaVoluntario ctx={ctx} socio={socio} esAdmin={editable} />}
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

  const aportesVol = ctx.aportesVoluntarios
    .filter((a) => a.socio_id === socio.id)
    .slice()
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const totalVol = sumar(aportesVol, "monto");

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ fontFamily: "var(--font-display)", color: "var(--ink)", marginTop: 0 }}>Datos personales</h3>
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <div><div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Correo</div><div>{socio.email || "—"}</div></div>
          <div><div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Celular</div><div>{socio.celular}</div></div>
          <div><div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Fecha de nacimiento</div><div>{socio.fecha_nacimiento ? fdate(socio.fecha_nacimiento) : "—"}</div></div>
          <div><div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Turno</div><div>{socio.turno || "—"}</div></div>
          <div><div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Código</div><div>{socio.codigo}</div></div>
        </div>
      </Card>
      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ fontFamily: "var(--font-display)", color: "var(--ink)", marginTop: 0 }}>1 · Aporte patrimonial</h3>
        <div className="grid gap-3.5 mb-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <StatCard label="Acordado" value={bs(acordado)} />
          <StatCard label="Pagado" value={bs(pagadoP)} tono="positivo" />
          <StatCard label="Saldo pendiente" value={bs(saldoP)} tono={saldoP > 0 ? "negativo" : "positivo"} />
          <StatCard label="Porcentaje pagado" value={`${pct}%`} />
        </div>
        {acordado > 0 && (
          <div className="barra-track">
            <div className="barra-fill" style={{ width: `${pct}%`, background: "var(--green)" }} />
          </div>
        )}
      </Card>
      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ fontFamily: "var(--font-display)", color: "var(--ink)", marginTop: 0 }}>2 · Aportes mensuales</h3>
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <StatCard label="Total generado" value={bs(generadoM)} />
          <StatCard label="Total pagado" value={bs(pagadoM)} tono="positivo" />
          <StatCard label="Saldo pendiente" value={bs(saldoM)} tono={saldoM > 0 ? "negativo" : "positivo"} />
        </div>
      </Card>
      <Card>
        <h3 style={{ fontFamily: "var(--font-display)", color: "var(--ink)", marginTop: 0 }}>3 · Aportes voluntarios</h3>
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <StatCard label="Total aportado" value={bs(totalVol)} tono="positivo" />
          <StatCard label="Cantidad de aportes" value={aportesVol.length} />
        </div>
      </Card>
      <p style={{ marginTop: 16, color: "var(--text-muted)", fontSize: "0.85rem" }}>
        Estas son cuentas independientes: el saldo patrimonial, el saldo mensual y los aportes voluntarios nunca se mezclan entre sí.
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
    <div className="ledger-wrap">
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
    </div>
  );
}

// Formulario compartido: obligación/pago/ajuste sobre un mayor (patrimonial o mensual)
function FormularioMayor({ tabla, socio, ctx, opciones, onListo }) {
  const [form, setForm] = useState(null);
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [concepto, setConcepto] = useState(opciones.find((o) => o.value === "pago")?.conceptoDefault || "");
  const [tipoAjuste, setTipoAjuste] = useState("debe");
  const [error, setError] = useState(null);

  const opcionActiva = opciones.find((o) => o.value === form);

  function elegir(v) {
    setForm(form === v ? null : v);
    const op = opciones.find((o) => o.value === v);
    setConcepto(op?.conceptoDefault || "");
    setError(null);
  }

  async function guardar(e) {
    e.preventDefault();
    setError(null);
    const m = Number(monto);
    if (!m || m <= 0) { setError("Ingresa un monto válido, mayor a cero."); return; }

    if (form === "obligacion") await ctx.crearObligacionPatrimonial(socio.id, m, fecha);
    else if (form === "pago") {
      if (tabla === "movimientos_patrimoniales") await ctx.registrarPagoPatrimonial(socio.id, m, fecha, concepto);
      else await ctx.registrarPagoMensual(socio.id, m, fecha, concepto);
    } else if (form === "ajuste") {
      await ctx.registrarAjuste(tabla, socio.id, m, fecha, concepto || "Ajuste / corrección", tipoAjuste);
    }
    aviso.exito("Movimiento registrado correctamente.");
    setMonto(""); setForm(null);
    onListo?.();
  }

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-4 no-print">
        {opciones.map((o) => (
          <Btn key={o.value} variante={form === o.value ? "primary" : "secondary"} onClick={() => elegir(o.value)}>{o.label}</Btn>
        ))}
      </div>

      {form && (
        <Card style={{ marginBottom: 16 }}>
          <h3 style={{ fontFamily: "var(--font-display)", color: "var(--ink)", marginTop: 0 }}>{opcionActiva?.tituloForm}</h3>
          {form === "ajuste" && (
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              Se agrega un asiento nuevo (no se edita ni borra ningún movimiento existente), para conservar el historial completo del socio.
            </p>
          )}
          {error && <Mensaje tipo="error">{error}</Mensaje>}
          <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <Field label={form === "obligacion" ? "Monto acordado (Bs)" : "Monto (Bs)"}>
              <input className="field-input" type="number" min="0" step="0.01" required value={monto} onChange={(e) => setMonto(e.target.value)} />
            </Field>
            <Field label="Fecha"><input className="field-input" type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
            {form === "ajuste" && (
              <Field label="Tipo de ajuste">
                <select className="field-input" value={tipoAjuste} onChange={(e) => setTipoAjuste(e.target.value)}>
                  <option value="debe">Debe (aumenta lo pendiente — ej. anular un pago)</option>
                  <option value="haber">Haber (reduce lo pendiente — ej. anular una obligación)</option>
                </select>
              </Field>
            )}
            {(form === "pago" || form === "ajuste") && (
              <Field label="Concepto"><input className="field-input" value={concepto} onChange={(e) => setConcepto(e.target.value)} /></Field>
            )}
          </div>
          <div className="mt-4"><Btn onClick={guardar}>{opcionActiva?.tituloBoton}</Btn></div>
        </Card>
      )}
    </div>
  );
}

function FichaPatrimonial({ ctx, socio, esAdmin }) {
  const movs = ctx.movPatrimoniales[socio.id] || [];
  return (
    <div>
      <div className="flex justify-between items-center gap-3 flex-wrap mb-1">
        <h3 style={{ fontFamily: "var(--font-display)", color: "var(--ink)", margin: 0 }}>Mayor — Aporte patrimonial</h3>
      </div>
      {esAdmin && (
        <FormularioMayor
          tabla="movimientos_patrimoniales"
          socio={socio}
          ctx={ctx}
          opciones={[
            { value: "obligacion", label: "Definir obligación", tituloForm: "Definir monto patrimonial acordado", tituloBoton: "Guardar obligación" },
            { value: "pago", label: "Registrar pago", conceptoDefault: "Pago patrimonial", tituloForm: "Registrar pago patrimonial", tituloBoton: "Registrar pago" },
            { value: "ajuste", label: "Ajuste / anulación", conceptoDefault: "Corrección", tituloForm: "Registrar ajuste patrimonial", tituloBoton: "Guardar ajuste" },
          ]}
        />
      )}
      <Card><LedgerConSaldo movimientos={movs} /></Card>
    </div>
  );
}

function FichaMensual({ ctx, socio, esAdmin }) {
  const movs = ctx.movMensuales[socio.id] || [];
  const totalDebe = sumar(movs, "debe");
  const totalHaber = sumar(movs, "haber");
  const generados = movs.filter((m) => m.debe > 0).length;
  const pagos = movs.filter((m) => m.haber > 0).length;

  return (
    <div>
      <div className="flex justify-between items-center gap-3 flex-wrap mb-1">
        <h3 style={{ fontFamily: "var(--font-display)", color: "var(--ink)", margin: 0 }}>Mayor — Aportes mensuales</h3>
      </div>

      <div className="grid gap-3.5 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <StatCard label="Meses con obligación generada" value={generados} />
        <StatCard label="Pagos registrados" value={pagos} />
        <StatCard label="Saldo pendiente" value={bs(totalDebe - totalHaber)} tono={totalDebe - totalHaber > 0 ? "negativo" : "positivo"} />
      </div>

      {esAdmin && (
        <FormularioMayor
          tabla="movimientos_mensuales"
          socio={socio}
          ctx={ctx}
          opciones={[
            { value: "pago", label: "Registrar pago", conceptoDefault: "Pago mensualidad", tituloForm: "Registrar pago de mensualidad", tituloBoton: "Registrar pago" },
            { value: "ajuste", label: "Ajuste / anulación", conceptoDefault: "Corrección", tituloForm: "Registrar ajuste mensual", tituloBoton: "Guardar ajuste" },
          ]}
        />
      )}

      <Card>
        {movs.length === 0 ? (
          <Vacio>Aún no hay mensualidades generadas para este socio. Genéralas desde «Configuración anual».</Vacio>
        ) : <LedgerConSaldo movimientos={movs} />}
      </Card>
    </div>
  );
}

function FichaVoluntario({ ctx, socio, esAdmin }) {
  const aportes = useMemo(() => (
    ctx.aportesVoluntarios
      .filter((a) => a.socio_id === socio.id)
      .slice()
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
  ), [ctx.aportesVoluntarios, socio.id]);
  const total = sumar(aportes, "monto");

  const [mostrarForm, setMostrarForm] = useState(false);
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [concepto, setConcepto] = useState("Aporte voluntario");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState(null);

  async function guardar(e) {
    e.preventDefault();
    setError(null);
    const m = Number(monto);
    if (!m || m <= 0) { setError("Ingresa un monto válido, mayor a cero."); return; }
    await ctx.registrarAporteVoluntario(socio.id, m, fecha, concepto, observaciones);
    aviso.exito("Aporte voluntario registrado correctamente.");
    setMonto(""); setObservaciones(""); setMostrarForm(false);
  }

  return (
    <div>
      <div className="flex justify-between items-center gap-3 flex-wrap mb-1">
        <h3 style={{ fontFamily: "var(--font-display)", color: "var(--ink)", margin: 0 }}>Aportes voluntarios</h3>
      </div>

      <div className="grid gap-3.5 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <StatCard label="Total aportado" value={bs(total)} tono="positivo" />
        <StatCard label="Cantidad de aportes" value={aportes.length} />
      </div>

      {esAdmin && (
        <div className="mb-4">
          <Btn variante={mostrarForm ? "primary" : "secondary"} onClick={() => setMostrarForm((v) => !v)}>
            {mostrarForm ? "Cancelar" : "Registrar aporte voluntario"}
          </Btn>
          {mostrarForm && (
            <Card style={{ marginTop: 12 }}>
              {error && <Mensaje tipo="error">{error}</Mensaje>}
              <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <Field label="Monto (Bs)"><input className="field-input" type="number" min="0" step="0.01" required value={monto} onChange={(e) => setMonto(e.target.value)} /></Field>
                <Field label="Fecha"><input className="field-input" type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
                <Field label="Concepto"><input className="field-input" value={concepto} onChange={(e) => setConcepto(e.target.value)} /></Field>
                <div style={{ gridColumn: "1 / -1" }}>
                  <Field label="Observaciones"><textarea className="field-input" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} /></Field>
                </div>
              </div>
              <div className="mt-4"><Btn onClick={guardar}>Registrar aporte</Btn></div>
            </Card>
          )}
        </div>
      )}

      <Card>
        {aportes.length === 0 ? (
          <Vacio>Este socio aún no registró aportes voluntarios.</Vacio>
        ) : (
          <div className="ledger-wrap">
            <table className="ledger">
              <thead><tr><th>Fecha</th><th>Concepto</th><th>Observaciones</th><th className="num">Monto</th></tr></thead>
              <tbody>
                {aportes.map((a) => (
                  <tr key={a.id}>
                    <td>{fdate(a.fecha)}</td>
                    <td>{a.concepto}</td>
                    <td>{a.observaciones || "—"}</td>
                    <td className="num monto">{bs(a.monto)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={3}>Total</td><td className="num monto">{bs(total)}</td></tr></tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// =====================================================================
// INGRESOS
// =====================================================================
const ETIQUETA_TIPO = { patrimonial: "Patrimonial", mensual: "Mensual", voluntario: "Voluntario" };
const ETIQUETA_EXTERNO = { alquiler: "Alquiler / uso instalaciones", donacion: "Donación", otro: "Otro ingreso" };

const TIPOS_INGRESO = [
  { value: "patrimonial", label: "Aporte patrimonial", concepto: "Pago patrimonial", ayuda: "Se registra como Haber en el mayor patrimonial del socio y reduce su saldo pendiente." },
  { value: "mensual", label: "Aporte mensual", concepto: "Pago mensualidad", ayuda: "Se registra como Haber en el mayor de aportes mensuales del socio y reduce su saldo pendiente." },
  { value: "voluntario", label: "Aporte voluntario", concepto: "Aporte voluntario", ayuda: "Ingresa como aporte voluntario. No afecta el mayor patrimonial ni el mayor mensual del socio." },
  { value: "externo", label: "Ingreso institucional", concepto: "", ayuda: "Ingresos que no provienen de un socio: alquiler de instalaciones, donaciones u otros conceptos." },
];

function Ingresos({ ctx }) {
  const { periodo, Render } = useFiltroPeriodo();
  const editable = puedeEditar(ctx.sesion.rol);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [tipo, setTipo] = useState("patrimonial");
  const [socioId, setSocioId] = useState(ctx.socios[0]?.id || "");
  const [tipoExterno, setTipoExterno] = useState("alquiler");
  const [origen, setOrigen] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [concepto, setConcepto] = useState("Pago patrimonial");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(null);

  const sociosPorId = useMemo(() => Object.fromEntries(ctx.socios.map((s) => [s.id, s])), [ctx.socios]);

  const todosLosIngresos = useMemo(() => {
    const externos = ctx.ingresosExternos.map((e) => ({
      id: e.id, fecha: e.fecha, tipo: "externo", subtipo: e.tipo, concepto: e.concepto, monto: Number(e.monto), socioId: null, origen: e.origen,
    }));
    return [...ctx.ingresosConsolidados, ...externos];
  }, [ctx.ingresosConsolidados, ctx.ingresosExternos]);

  const filtrados = useMemo(() => todosLosIngresos.filter((i) => i.fecha >= periodo.desde && i.fecha <= periodo.hasta), [todosLosIngresos, periodo]);
  const total = filtrados.reduce((a, b) => a + b.monto, 0);
  const tipoInfo = TIPOS_INGRESO.find((t) => t.value === tipo);

  const { ordenados, Th } = useOrden(filtrados, "fecha", "desc");
  const { visibles, BotonMostrarMas } = useMostrarMas(ordenados, 30);

  function cambiarTipo(v) {
    setTipo(v);
    const info = TIPOS_INGRESO.find((t) => t.value === v);
    setConcepto(v === "externo" ? ETIQUETA_EXTERNO[tipoExterno] : info.concepto);
    setError(null);
  }

  const saldoRef = tipo !== "externo" && socioId ? (tipo === "patrimonial" ? ctx.saldoPatrimonial(socioId) : tipo === "mensual" ? ctx.saldoMensual(socioId) : null) : null;

  function etiquetaFila(fila) {
    return fila.tipo === "externo" ? ETIQUETA_EXTERNO[fila.subtipo] : ETIQUETA_TIPO[fila.tipo];
  }

  async function guardar(e) {
    e.preventDefault();
    setError(null);
    setExito(null);
    const m = Number(monto);
    if (!m || m <= 0) { setError("Ingresa un monto válido, mayor a cero."); return; }

    if (tipo === "externo") {
      if (!concepto.trim()) { setError("Ingresa un concepto para este ingreso."); return; }
      await ctx.registrarIngresoExterno({ fecha, tipo: tipoExterno, concepto, origen, monto: m, observaciones });
      setExito(`Ingreso de ${bs(m)} registrado como ${ETIQUETA_EXTERNO[tipoExterno].toLowerCase()}.`);
    } else {
      if (!socioId) { setError("Selecciona el socio que realiza el aporte."); return; }
      if (tipo === "patrimonial") await ctx.registrarPagoPatrimonial(socioId, m, fecha, concepto);
      else if (tipo === "mensual") await ctx.registrarPagoMensual(socioId, m, fecha, concepto);
      else await ctx.registrarAporteVoluntario(socioId, m, fecha, concepto, observaciones);
      setExito(`Ingreso de ${bs(m)} registrado como ${tipoInfo.label.toLowerCase()} para ${sociosPorId[socioId]?.nombre}.`);
    }

    aviso.exito("Ingreso registrado correctamente.");
    setMonto(""); setObservaciones(""); setOrigen("");
  }

  return (
    <div>
      <PageHeader
        title="Libro de ingresos"
        subtitle="Consolida los aportes de socios y los ingresos institucionales (alquiler, donaciones, otros) de la fraternidad."
        right={editable ? <Btn icon={mostrarForm ? X : Plus} onClick={() => setMostrarForm((v) => !v)}>{mostrarForm ? "Cancelar" : "Registrar ingreso"}</Btn> : null}
      />

      {mostrarForm && editable && (
        <Card style={{ marginBottom: 20 }}>
          <h3 style={{ fontFamily: "var(--font-display)", color: "var(--ink)", marginTop: 0 }}>Registrar ingreso</h3>

          <div className="flex gap-1 mb-4" style={{ borderBottom: "1px solid var(--line-strong)", overflowX: "auto" }}>
            {TIPOS_INGRESO.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => cambiarTipo(t.value)}
                style={{
                  background: "none", border: "none", padding: "9px 14px", fontWeight: 600, fontSize: "0.85rem", whiteSpace: "nowrap",
                  color: tipo === t.value ? "var(--ink)" : "var(--text-muted)", cursor: "pointer",
                  borderBottom: tipo === t.value ? "2px solid var(--gold)" : "2px solid transparent", marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{tipoInfo.ayuda}</p>
          {error && <Mensaje tipo="error">{error}</Mensaje>}
          {exito && <Mensaje tipo="exito">{exito}</Mensaje>}

          <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            {tipo === "externo" ? (
              <Field label="Origen del ingreso">
                <select className="field-input" value={tipoExterno} onChange={(e) => { setTipoExterno(e.target.value); setConcepto(ETIQUETA_EXTERNO[e.target.value]); }}>
                  {Object.entries(ETIQUETA_EXTERNO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
            ) : (
              <Field label="Socio">
                <select className="field-input" value={socioId} onChange={(e) => setSocioId(e.target.value)}>
                  {ctx.socios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </Field>
            )}
            <Field label="Monto (Bs)"><input className="field-input" type="number" min="0" step="0.01" required value={monto} onChange={(e) => setMonto(e.target.value)} /></Field>
            <Field label="Fecha"><input className="field-input" type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
            <Field label="Concepto"><input className="field-input" value={concepto} onChange={(e) => setConcepto(e.target.value)} /></Field>
            {tipo === "externo" && (
              <Field label="De quién / qué proviene (opcional)"><input className="field-input" placeholder="Ej. Inquilino, empresa donante…" value={origen} onChange={(e) => setOrigen(e.target.value)} /></Field>
            )}
            {(tipo === "voluntario" || tipo === "externo") && (
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Observaciones"><textarea className="field-input" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} /></Field>
              </div>
            )}
          </div>

          {saldoRef !== null && (
            <p style={{ marginTop: 10, fontSize: "0.83rem", color: "var(--text-muted)" }}>
              Saldo pendiente actual en esta cuenta:{" "}
              <span className="monto" style={{ fontWeight: 700, color: saldoRef > 0 ? "var(--rust)" : "var(--green)" }}>{bs(saldoRef)}</span>
            </p>
          )}

          <div className="mt-4"><Btn onClick={guardar}>Registrar ingreso</Btn></div>
        </Card>
      )}

      <Render />

      <div className="flex justify-end gap-2 mb-3 no-print">
        <BotonCSV
          nombreArchivo={`ingresos_${periodo.desde}_${periodo.hasta}`}
          filas={filtrados}
          columnas={[
            { label: "Fecha", get: (i) => i.fecha },
            { label: "Tipo", get: (i) => etiquetaFila(i) },
            { label: "Socio / origen", get: (i) => sociosPorId[i.socioId]?.nombre || i.origen || "" },
            { label: "Concepto", get: (i) => i.concepto },
            { label: "Monto", get: (i) => i.monto },
          ]}
        />
        <BotonExcel
          nombreArchivo={`ingresos_${periodo.desde}_${periodo.hasta}`}
          hojas={[{
            nombre: "Ingresos",
            filas: filtrados,
            columnas: [
              { label: "Fecha", get: (i) => i.fecha },
              { label: "Tipo", get: (i) => etiquetaFila(i) },
              { label: "Socio / origen", get: (i) => sociosPorId[i.socioId]?.nombre || i.origen || "" },
              { label: "Concepto", get: (i) => i.concepto },
              { label: "Monto", get: (i) => i.monto },
            ],
          }]}
        />
      </div>

      <Card>
        {visibles.length === 0 ? <Vacio>No se registraron ingresos en este período.</Vacio> : (
          <>
            <div className="ledger-wrap">
              <table className="ledger">
                <thead>
                  <tr>
                    <Th col="fecha">Fecha</Th>
                    <th>Tipo</th>
                    <th>Socio / origen</th>
                    <th>Concepto</th>
                    <Th col="monto" className="num">Monto</Th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((i) => (
                    <tr key={i.id}>
                      <td>{fdate(i.fecha)}</td>
                      <td><Badge tono={i.tipo === "externo" ? "azul" : "gris"}>{etiquetaFila(i)}</Badge></td>
                      <td>{sociosPorId[i.socioId]?.nombre || i.origen || "—"}</td>
                      <td>{i.concepto}</td>
                      <td className="num monto">{bs(i.monto)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan={4}>Total del período</td><td className="num monto">{bs(total)}</td></tr></tfoot>
              </table>
            </div>
            <BotonMostrarMas />
          </>
        )}
      </Card>
    </div>
  );
}

// =====================================================================
// GASTOS
// =====================================================================
const CATEGORIAS_GASTO = [
  { value: "sueldos_salarios", label: "Sueldos y salarios" },
  { value: "servicios_saguapac", label: "Servicios básicos — Saguapac" },
  { value: "servicios_cre", label: "Servicios básicos — Cre" },
  { value: "internet_telefonia", label: "Internet y telefonía" },
  { value: "mantenimientos", label: "Mantenimientos" },
  { value: "otros", label: "Otros" },
];
// Categorías anteriores, conservadas solo para que los gastos históricos
// sigan mostrando una etiqueta legible (no se pueden volver a elegir).
const CATEGORIAS_GASTO_ANTERIORES = {
  mantenimiento: "Mantenimientos", servicios_basicos: "Servicios básicos",
  mano_de_obra: "Sueldos y salarios", sueldos: "Sueldos y salarios", gastos_varios: "Otros",
};
function etiquetaCategoriaGasto(valor) {
  return CATEGORIAS_GASTO.find((c) => c.value === valor)?.label || CATEGORIAS_GASTO_ANTERIORES[valor] || valor;
}

function EnlaceComprobante({ ctx, ruta }) {
  const [cargando, setCargando] = useState(false);
  async function abrir() {
    setCargando(true);
    try {
      const url = await ctx.obtenerUrlComprobante(ruta);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      aviso.error("No se pudo abrir el comprobante.");
    } finally {
      setCargando(false);
    }
  }
  return (
    <span className="flex items-center gap-1" style={{ color: "var(--ink)", cursor: "pointer" }} onClick={abrir}>
      <Paperclip size={13} />{cargando ? "Abriendo…" : "Ver"}
    </span>
  );
}

function FormularioGasto({ ctx, inicial, onCancelar, onGuardado }) {
  const [fecha, setFecha] = useState(inicial?.fecha || hoyISO());
  const [categoria, setCategoria] = useState(inicial?.categoria || "otros");
  const [concepto, setConcepto] = useState(inicial?.concepto || "");
  const [beneficiario, setBeneficiario] = useState(inicial?.beneficiario || "");
  const [monto, setMonto] = useState(inicial?.monto ?? "");
  const [formaPago, setFormaPago] = useState(inicial?.forma_pago || "");
  const [archivo, setArchivo] = useState(null);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const esEdicion = Boolean(inicial);

  async function guardar(e) {
    e.preventDefault();
    setError(null);
    const m = Number(monto);
    if (!concepto.trim()) { setError("El concepto del gasto es obligatorio."); return; }
    if (!m || m <= 0) { setError("Ingresa un monto válido, mayor a cero."); return; }
    setGuardando(true);
    try {
      const datos = { fecha, categoria, concepto: concepto.trim(), beneficiario, monto: m, formaPago };
      if (esEdicion) await ctx.editarGasto(inicial.id, datos);
      else await ctx.registrarGasto(datos, archivo);
      aviso.exito(esEdicion ? "Gasto actualizado correctamente." : "Gasto registrado correctamente.");
      onGuardado();
    } catch (err) {
      setError(err.message || "No se pudo guardar el gasto.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card style={{ marginBottom: 20 }}>
      <h3 style={{ fontFamily: "var(--font-display)", color: "var(--ink)", marginTop: 0 }}>{esEdicion ? "Editar gasto" : "Registrar gasto"}</h3>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
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
        {!esEdicion && (
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Comprobante adjunto (opcional — PDF, JPG o PNG)">
              <input className="field-input" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setArchivo(e.target.files?.[0] || null)} />
            </Field>
          </div>
        )}
        {esEdicion && (
          <p style={{ gridColumn: "1 / -1", fontSize: "0.8rem", color: "var(--text-muted)", margin: 0 }}>
            El comprobante adjunto no se puede reemplazar desde aquí; si es necesario, registra un nuevo gasto.
          </p>
        )}
      </div>
      <div className="mt-4 flex gap-2">
        <Btn onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : esEdicion ? "Guardar cambios" : "Guardar gasto"}</Btn>
        {esEdicion && <Btn variante="secondary" onClick={onCancelar}>Cancelar</Btn>}
      </div>
    </Card>
  );
}

function Gastos({ ctx }) {
  const { periodo, Render } = useFiltroPeriodo();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [categoriaFiltro, setCategoriaFiltro] = useState("");

  const editable = puedeEditar(ctx.sesion.rol);
  const esSuperadmin = ctx.sesion.rol === "superadmin";

  let filtrados = ctx.gastos.filter((g) => g.fecha >= periodo.desde && g.fecha <= periodo.hasta);
  if (categoriaFiltro) filtrados = filtrados.filter((g) => g.categoria === categoriaFiltro);
  const total = filtrados.reduce((a, b) => a + Number(b.monto), 0);

  const { ordenados, Th } = useOrden(filtrados, "fecha", "desc");
  const { visibles, BotonMostrarMas } = useMostrarMas(ordenados, 30);

  async function eliminar(g) {
    const ok = await ctx.confirmar({
      titulo: "Eliminar gasto",
      mensaje: `Se eliminará permanentemente "${g.concepto}" por ${bs(g.monto)}. Esta acción no se puede deshacer.`,
      textoConfirmar: "Eliminar",
      peligro: true,
    });
    if (!ok) return;
    try {
      await ctx.eliminarGasto(g.id);
      aviso.exito("Gasto eliminado.");
    } catch (err) {
      aviso.error(err.message || "No se pudo eliminar el gasto.");
    }
  }

  const columnasExport = [
    { label: "Fecha", get: (g) => g.fecha },
    { label: "Categoría", get: (g) => etiquetaCategoriaGasto(g.categoria) },
    { label: "Concepto", get: (g) => g.concepto },
    { label: "Beneficiario", get: (g) => g.beneficiario || "" },
    { label: "Forma de pago", get: (g) => g.forma_pago || "" },
    { label: "Monto", get: (g) => g.monto },
  ];

  return (
    <div>
      <PageHeader
        title="Libro de gastos"
        subtitle="Registro de egresos de la fraternidad, clasificados por categoría."
        right={editable ? <Btn icon={mostrarForm ? X : Plus} onClick={() => { setEditando(null); setMostrarForm((v) => !v); }}>{mostrarForm ? "Cancelar" : "Registrar gasto"}</Btn> : null}
      />

      {mostrarForm && editable && !editando && <FormularioGasto ctx={ctx} onGuardado={() => setMostrarForm(false)} onCancelar={() => setMostrarForm(false)} />}
      {editando && editable && (
        <FormularioGasto
          ctx={ctx}
          inicial={editando}
          onGuardado={() => setEditando(null)}
          onCancelar={() => setEditando(null)}
        />
      )}

      <Render />

      <div className="flex justify-between items-end flex-wrap gap-3 mb-4 no-print">
        <div style={{ maxWidth: 260 }}>
          <Field label="Filtrar por categoría">
            <select className="field-input" value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}>
              <option value="">Todas las categorías</option>
              {CATEGORIAS_GASTO.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex gap-2">
          <BotonCSV nombreArchivo={`gastos_${periodo.desde}_${periodo.hasta}`} filas={filtrados} columnas={columnasExport} />
          <BotonExcel nombreArchivo={`gastos_${periodo.desde}_${periodo.hasta}`} hojas={[{ nombre: "Gastos", filas: filtrados, columnas: columnasExport }]} />
        </div>
      </div>

      <Card>
        {visibles.length === 0 ? <Vacio>No se registraron gastos en este período.</Vacio> : (
          <>
            <div className="ledger-wrap">
              <table className="ledger">
                <thead>
                  <tr>
                    <Th col="fecha">Fecha</Th>
                    <th>Categoría</th>
                    <th>Concepto</th>
                    <th>Beneficiario</th>
                    <th>Comprobante</th>
                    <Th col="monto" className="num">Monto</Th>
                    {esSuperadmin && <th className="no-print"></th>}
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((g) => (
                    <tr key={g.id}>
                      <td>{fdate(g.fecha)}</td>
                      <td><Badge>{etiquetaCategoriaGasto(g.categoria)}</Badge></td>
                      <td>{g.concepto}</td>
                      <td>{g.beneficiario || "—"}</td>
                      <td>{g.comprobante_ruta ? <EnlaceComprobante ctx={ctx} ruta={g.comprobante_ruta} /> : "—"}</td>
                      <td className="num monto">{bs(g.monto)}</td>
                      {esSuperadmin && (
                        <td className="no-print">
                          <div className="flex items-center gap-2 justify-end">
                            <button className="btn-ghost" onClick={() => { setEditando(g); setMostrarForm(false); }} aria-label="Editar gasto"><Pencil size={14} /></button>
                            <button className="btn-ghost" style={{ color: "var(--rust)" }} onClick={() => eliminar(g)} aria-label="Eliminar gasto"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan={5}>Total del período</td><td className="num monto">{bs(total)}</td>{esSuperadmin && <td></td>}</tr></tfoot>
              </table>
            </div>
            <BotonMostrarMas />
          </>
        )}
      </Card>
    </div>
  );
}

// =====================================================================
// REPORTES
// =====================================================================
const REPORTES_TABS = [
  ["resumen", "Resumen general"],
  ["ingresos_socios", "Ingresos de socios"],
  ["detalle_socio", "Detalle por socio"],
  ["mov_ingresos", "Movimientos de ingresos"],
  ["mov_egresos", "Movimientos de egresos"],
  ["resumen_periodo", "Resumen mensual y anual"],
  ["estado_resultado", "Estado de resultado"],
];

function Reportes({ ctx }) {
  const [tab, setTab] = useState("resumen");

  return (
    <div>
      <PageHeader
        title="Reportes"
        subtitle="Resultados financieros de la fraternidad. Todos los reportes se pueden imprimir o guardar como PDF, y exportar a Excel/CSV."
        right={<Btn variante="secondary" icon={Printer} onClick={() => window.print()}>Imprimir / PDF</Btn>}
      />

      <div className="flex gap-1 mb-5 no-print" style={{ borderBottom: "1px solid var(--line-strong)", overflowX: "auto" }}>
        {REPORTES_TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              background: "none", border: "none", padding: "9px 14px", fontWeight: 600, fontSize: "0.85rem", whiteSpace: "nowrap",
              color: tab === id ? "var(--ink)" : "var(--text-muted)", cursor: "pointer",
              borderBottom: tab === id ? "2px solid var(--gold)" : "2px solid transparent", marginBottom: -1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "resumen" && <ReporteResumen ctx={ctx} />}
      {tab === "ingresos_socios" && <ReporteIngresosSocios ctx={ctx} />}
      {tab === "detalle_socio" && <ReporteDetallePorSocio ctx={ctx} />}
      {tab === "mov_ingresos" && <ReporteMovimientos ctx={ctx} tipo="ingresos" />}
      {tab === "mov_egresos" && <ReporteMovimientos ctx={ctx} tipo="egresos" />}
      {tab === "resumen_periodo" && <ReporteResumenPeriodo ctx={ctx} />}
      {tab === "estado_resultado" && <ReporteEstadoResultado ctx={ctx} />}
    </div>
  );
}

// ---------- 1) Resumen general (vista original, con ingresos institucionales) ----------
function ReporteResumen({ ctx }) {
  const { periodo, Render } = useFiltroPeriodo();
  const ingresosPeriodo = ctx.ingresosConsolidados.filter((i) => i.fecha >= periodo.desde && i.fecha <= periodo.hasta);
  const externosPeriodo = ctx.ingresosExternos.filter((i) => i.fecha >= periodo.desde && i.fecha <= periodo.hasta);
  const gastosPeriodo = ctx.gastos.filter((g) => g.fecha >= periodo.desde && g.fecha <= periodo.hasta);

  const porTipo = { patrimonial: 0, mensual: 0, voluntario: 0 };
  ingresosPeriodo.forEach((i) => { porTipo[i.tipo] += i.monto; });
  const totalExterno = externosPeriodo.reduce((a, b) => a + Number(b.monto), 0);
  const porCategoria = Object.fromEntries(CATEGORIAS_GASTO.map((c) => [c.value, 0]));
  gastosPeriodo.forEach((g) => { porCategoria[g.categoria] = (porCategoria[g.categoria] || 0) + Number(g.monto); });

  const totalIng = porTipo.patrimonial + porTipo.mensual + porTipo.voluntario + totalExterno;
  const totalGas = gastosPeriodo.reduce((a, b) => a + Number(b.monto), 0);
  const maxIngGas = Math.max(totalIng, totalGas, 1);
  const maxCategoria = Math.max(...Object.values(porCategoria), 1);

  const pendientes = ctx.socios
    .filter((s) => s.estado !== "de_baja")
    .map((s) => ({ nombre: s.nombre, sp: ctx.saldoPatrimonial(s.id), sm: ctx.saldoMensual(s.id) }))
    .filter((s) => s.sp > 0 || s.sm > 0);

  return (
    <div>
      <Render />
      <div className="grid gap-3.5 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <StatCard label={`Ingresos — ${periodo.etiqueta}`} value={bs(totalIng)} tono="positivo" />
        <StatCard label={`Egresos — ${periodo.etiqueta}`} value={bs(totalGas)} tono="negativo" />
        <StatCard label="Saldo del período" value={bs(totalIng - totalGas)} tono={totalIng - totalGas >= 0 ? "positivo" : "negativo"} />
      </div>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ fontFamily: "var(--font-display)", color: "var(--ink)", marginTop: 0 }}>Ingresos vs. egresos</h3>
        <Barra label="Ingresos" valor={totalIng} max={maxIngGas} color="var(--green)" />
        <Barra label="Egresos" valor={totalGas} max={maxIngGas} color="var(--rust)" />
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ fontFamily: "var(--font-display)", color: "var(--ink)", marginTop: 0 }}>Ingresos por tipo</h3>
        <table className="ledger">
          <tbody>
            <tr><td>Aportes patrimoniales</td><td className="num monto">{bs(porTipo.patrimonial)}</td></tr>
            <tr><td>Aportes mensuales</td><td className="num monto">{bs(porTipo.mensual)}</td></tr>
            <tr><td>Aportes voluntarios</td><td className="num monto">{bs(porTipo.voluntario)}</td></tr>
            <tr><td>Ingresos institucionales (alquiler, donaciones, otros)</td><td className="num monto">{bs(totalExterno)}</td></tr>
          </tbody>
          <tfoot><tr><td>Total</td><td className="num monto">{bs(totalIng)}</td></tr></tfoot>
        </table>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ fontFamily: "var(--font-display)", color: "var(--ink)", marginTop: 0 }}>Egresos por categoría</h3>
        {CATEGORIAS_GASTO.map((c) => (
          <Barra key={c.value} label={c.label} valor={porCategoria[c.value] || 0} max={maxCategoria} color="var(--rust)" />
        ))}
        <table className="ledger" style={{ marginTop: 8 }}>
          <tfoot><tr><td>Total</td><td className="num monto">{bs(totalGas)}</td></tr></tfoot>
        </table>
      </Card>

      <Card>
        <h3 style={{ fontFamily: "var(--font-display)", color: "var(--ink)", marginTop: 0 }}>Socios con saldo pendiente</h3>
        {pendientes.length === 0 ? <Vacio>No hay socios con saldos pendientes.</Vacio> : (
          <div className="ledger-wrap">
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
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------- 2) Ingresos que provienen SOLO de socios (mensual/anual/rango) ----------
function ReporteIngresosSocios({ ctx }) {
  const { periodo, Render } = useFiltroPeriodo();
  const enPeriodo = ctx.ingresosConsolidados.filter((i) => i.fecha >= periodo.desde && i.fecha <= periodo.hasta);
  const porTipo = { patrimonial: 0, mensual: 0, voluntario: 0 };
  enPeriodo.forEach((i) => { porTipo[i.tipo] += i.monto; });
  const total = porTipo.patrimonial + porTipo.mensual + porTipo.voluntario;
  const filas = [
    { concepto: "Aportes patrimoniales", monto: porTipo.patrimonial },
    { concepto: "Aportes mensuales", monto: porTipo.mensual },
    { concepto: "Aportes voluntarios", monto: porTipo.voluntario },
  ];

  return (
    <div>
      <Render />
      <div className="flex justify-between items-start flex-wrap gap-3 mb-4">
        <StatCard label={`Total ingresos de socios — ${periodo.etiqueta}`} value={bs(total)} tono="positivo" />
        <div className="flex gap-2 no-print">
          <BotonCSV nombreArchivo={`ingresos_socios_${periodo.desde}_${periodo.hasta}`} filas={filas} columnas={[{ label: "Concepto", get: (r) => r.concepto }, { label: "Monto", get: (r) => r.monto }]} />
          <BotonExcel nombreArchivo={`ingresos_socios_${periodo.desde}_${periodo.hasta}`} hojas={[{ nombre: "Ingresos de socios", filas, columnas: [{ label: "Concepto", get: (r) => r.concepto }, { label: "Monto", get: (r) => r.monto }] }]} />
        </div>
      </div>
      <Card>
        <table className="ledger">
          <thead><tr><th>Concepto</th><th className="num">Monto</th></tr></thead>
          <tbody>{filas.map((f) => <tr key={f.concepto}><td>{f.concepto}</td><td className="num monto">{bs(f.monto)}</td></tr>)}</tbody>
          <tfoot><tr><td>Total</td><td className="num monto">{bs(total)}</td></tr></tfoot>
        </table>
      </Card>
    </div>
  );
}

// ---------- 3) Detalle de pagos por socio, con subtotales ----------
function ReporteDetallePorSocio({ ctx }) {
  const { periodo, Render } = useFiltroPeriodo();

  const filas = useMemo(() => {
    return ctx.socios.map((s) => {
      const patrimonial = (ctx.movPatrimoniales[s.id] || []).filter((m) => m.haber > 0 && m.fecha >= periodo.desde && m.fecha <= periodo.hasta).reduce((a, m) => a + Number(m.haber), 0);
      const mensual = (ctx.movMensuales[s.id] || []).filter((m) => m.haber > 0 && m.fecha >= periodo.desde && m.fecha <= periodo.hasta).reduce((a, m) => a + Number(m.haber), 0);
      const voluntario = ctx.aportesVoluntarios.filter((a) => a.socio_id === s.id && a.fecha >= periodo.desde && a.fecha <= periodo.hasta).reduce((a, m) => a + Number(m.monto), 0);
      return { socio: s.nombre, patrimonial, mensual, voluntario, total: patrimonial + mensual + voluntario };
    }).filter((f) => f.total > 0);
  }, [ctx.socios, ctx.movPatrimoniales, ctx.movMensuales, ctx.aportesVoluntarios, periodo]);

  const totales = filas.reduce((a, f) => ({ patrimonial: a.patrimonial + f.patrimonial, mensual: a.mensual + f.mensual, voluntario: a.voluntario + f.voluntario, total: a.total + f.total }), { patrimonial: 0, mensual: 0, voluntario: 0, total: 0 });

  const columnasExport = [
    { label: "Socio", get: (f) => f.socio },
    { label: "Patrimonial", get: (f) => f.patrimonial },
    { label: "Mensual", get: (f) => f.mensual },
    { label: "Voluntario", get: (f) => f.voluntario },
    { label: "Total", get: (f) => f.total },
  ];

  return (
    <div>
      <Render />
      <div className="flex justify-end gap-2 mb-3 no-print">
        <BotonCSV nombreArchivo={`detalle_pagos_socio_${periodo.desde}_${periodo.hasta}`} filas={filas} columnas={columnasExport} />
        <BotonExcel nombreArchivo={`detalle_pagos_socio_${periodo.desde}_${periodo.hasta}`} hojas={[{ nombre: "Detalle por socio", filas, columnas: columnasExport }]} />
      </div>
      <Card>
        {filas.length === 0 ? <Vacio>Ningún socio realizó pagos en este período.</Vacio> : (
          <div className="ledger-wrap">
            <table className="ledger">
              <thead><tr><th>Socio</th><th className="num">Patrimonial</th><th className="num">Mensual</th><th className="num">Voluntario</th><th className="num">Total</th></tr></thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.socio}>
                    <td>{f.socio}</td>
                    <td className="num monto">{f.patrimonial > 0 ? bs(f.patrimonial) : "—"}</td>
                    <td className="num monto">{f.mensual > 0 ? bs(f.mensual) : "—"}</td>
                    <td className="num monto">{f.voluntario > 0 ? bs(f.voluntario) : "—"}</td>
                    <td className="num monto" style={{ fontWeight: 700 }}>{bs(f.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="num monto">{bs(totales.patrimonial)}</td>
                  <td className="num monto">{bs(totales.mensual)}</td>
                  <td className="num monto">{bs(totales.voluntario)}</td>
                  <td className="num monto">{bs(totales.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------- 4 y 5) Movimientos de ingresos / egresos: resumen y detalle ----------
function ReporteMovimientos({ ctx, tipo }) {
  const { periodo, Render } = useFiltroPeriodo();
  const [vista, setVista] = useState("resumen");
  const esIngresos = tipo === "ingresos";

  const sociosPorId = useMemo(() => Object.fromEntries(ctx.socios.map((s) => [s.id, s])), [ctx.socios]);

  const detalle = useMemo(() => {
    if (esIngresos) {
      const externos = ctx.ingresosExternos.map((e) => ({ id: e.id, fecha: e.fecha, categoria: ETIQUETA_EXTERNO[e.tipo], concepto: e.concepto, origen: sociosPorId[e.socio_id]?.nombre || e.origen || "—", monto: Number(e.monto) }));
      const socios = ctx.ingresosConsolidados.map((i) => ({ id: i.id, fecha: i.fecha, categoria: ETIQUETA_TIPO[i.tipo], concepto: i.concepto, origen: sociosPorId[i.socioId]?.nombre || "—", monto: i.monto }));
      return [...socios, ...externos].filter((f) => f.fecha >= periodo.desde && f.fecha <= periodo.hasta);
    }
    return ctx.gastos.filter((g) => g.fecha >= periodo.desde && g.fecha <= periodo.hasta)
      .map((g) => ({ id: g.id, fecha: g.fecha, categoria: etiquetaCategoriaGasto(g.categoria), concepto: g.concepto, origen: g.beneficiario || "—", monto: Number(g.monto) }));
  }, [ctx, periodo, esIngresos, sociosPorId]);

  const resumen = useMemo(() => {
    const mapa = {};
    detalle.forEach((f) => { mapa[f.categoria] = (mapa[f.categoria] || 0) + f.monto; });
    return Object.entries(mapa).map(([categoria, monto]) => ({ categoria, monto })).sort((a, b) => b.monto - a.monto);
  }, [detalle]);

  const total = detalle.reduce((a, f) => a + f.monto, 0);
  const { ordenados, Th } = useOrden(detalle, "fecha", "desc");
  const { visibles, BotonMostrarMas } = useMostrarMas(ordenados, 30);

  const nombreArchivo = `movimientos_${tipo}_${vista}_${periodo.desde}_${periodo.hasta}`;
  const columnasResumen = [{ label: "Categoría", get: (r) => r.categoria }, { label: "Monto", get: (r) => r.monto }];
  const columnasDetalle = [
    { label: "Fecha", get: (r) => r.fecha }, { label: "Categoría", get: (r) => r.categoria },
    { label: esIngresos ? "Socio / origen" : "Beneficiario", get: (r) => r.origen }, { label: "Concepto", get: (r) => r.concepto }, { label: "Monto", get: (r) => r.monto },
  ];

  return (
    <div>
      <Render />
      <div className="flex justify-between items-center flex-wrap gap-3 mb-4">
        <div className="flex gap-2 no-print">
          <Btn variante={vista === "resumen" ? "primary" : "secondary"} onClick={() => setVista("resumen")}>Resumen</Btn>
          <Btn variante={vista === "detalle" ? "primary" : "secondary"} onClick={() => setVista("detalle")}>Detalle</Btn>
        </div>
        <div className="flex gap-2 no-print">
          <BotonCSV nombreArchivo={nombreArchivo} filas={vista === "resumen" ? resumen : detalle} columnas={vista === "resumen" ? columnasResumen : columnasDetalle} />
          <BotonExcel nombreArchivo={nombreArchivo} hojas={[{ nombre: vista === "resumen" ? "Resumen" : "Detalle", filas: vista === "resumen" ? resumen : detalle, columnas: vista === "resumen" ? columnasResumen : columnasDetalle }]} />
        </div>
      </div>

      <Card>
        {vista === "resumen" ? (
          resumen.length === 0 ? <Vacio>No hay movimientos en este período.</Vacio> : (
            <table className="ledger">
              <thead><tr><th>Categoría</th><th className="num">Monto</th></tr></thead>
              <tbody>{resumen.map((r) => <tr key={r.categoria}><td>{r.categoria}</td><td className="num monto">{bs(r.monto)}</td></tr>)}</tbody>
              <tfoot><tr><td>Total</td><td className="num monto">{bs(total)}</td></tr></tfoot>
            </table>
          )
        ) : visibles.length === 0 ? <Vacio>No hay movimientos en este período.</Vacio> : (
          <>
            <div className="ledger-wrap">
              <table className="ledger">
                <thead>
                  <tr>
                    <Th col="fecha">Fecha</Th><th>Categoría</th><th>{esIngresos ? "Socio / origen" : "Beneficiario"}</th><th>Concepto</th><Th col="monto" className="num">Monto</Th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((f) => (
                    <tr key={f.id}><td>{fdate(f.fecha)}</td><td><Badge>{f.categoria}</Badge></td><td>{f.origen}</td><td>{f.concepto}</td><td className="num monto">{bs(f.monto)}</td></tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan={4}>Total del período</td><td className="num monto">{bs(total)}</td></tr></tfoot>
              </table>
            </div>
            <BotonMostrarMas />
          </>
        )}
      </Card>
    </div>
  );
}

// ---------- 6) Resumen mensual y anual de ingresos y egresos ----------
function ReporteResumenPeriodo({ ctx }) {
  const [anio, setAnio] = useState(new Date().getFullYear());

  const filas = useMemo(() => {
    return MESES.map((nombreMes, idx) => {
      const mes = idx + 1;
      const desde = `${anio}-${String(mes).padStart(2, "0")}-01`;
      const hasta = `${anio}-${String(mes).padStart(2, "0")}-${String(new Date(anio, mes, 0).getDate()).padStart(2, "0")}`;
      const ingSocios = ctx.ingresosConsolidados.filter((i) => i.fecha >= desde && i.fecha <= hasta).reduce((a, b) => a + b.monto, 0);
      const ingExt = ctx.ingresosExternos.filter((i) => i.fecha >= desde && i.fecha <= hasta).reduce((a, b) => a + Number(b.monto), 0);
      const egresos = ctx.gastos.filter((g) => g.fecha >= desde && g.fecha <= hasta).reduce((a, b) => a + Number(b.monto), 0);
      const ingresos = ingSocios + ingExt;
      return { mes: nombreMes, ingresos, egresos, saldo: ingresos - egresos };
    });
  }, [ctx, anio]);

  const totales = filas.reduce((a, f) => ({ ingresos: a.ingresos + f.ingresos, egresos: a.egresos + f.egresos, saldo: a.saldo + f.saldo }), { ingresos: 0, egresos: 0, saldo: 0 });
  const columnasExport = [{ label: "Mes", get: (f) => f.mes }, { label: "Ingresos", get: (f) => f.ingresos }, { label: "Egresos", get: (f) => f.egresos }, { label: "Saldo", get: (f) => f.saldo }];

  return (
    <div>
      <div className="flex justify-between items-end flex-wrap gap-3 mb-4">
        <Field label="Año"><input className="field-input" type="number" style={{ width: 120 }} value={anio} onChange={(e) => setAnio(Number(e.target.value))} /></Field>
        <div className="flex gap-2 no-print">
          <BotonCSV nombreArchivo={`resumen_mensual_${anio}`} filas={filas} columnas={columnasExport} />
          <BotonExcel nombreArchivo={`resumen_mensual_${anio}`} hojas={[{ nombre: `Resumen ${anio}`, filas, columnas: columnasExport }]} />
        </div>
      </div>
      <div className="grid gap-3.5 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <StatCard label={`Ingresos ${anio}`} value={bs(totales.ingresos)} tono="positivo" />
        <StatCard label={`Egresos ${anio}`} value={bs(totales.egresos)} tono="negativo" />
        <StatCard label={`Saldo ${anio}`} value={bs(totales.saldo)} tono={totales.saldo >= 0 ? "positivo" : "negativo"} />
      </div>
      <Card>
        <table className="ledger">
          <thead><tr><th>Mes</th><th className="num">Ingresos</th><th className="num">Egresos</th><th className="num">Saldo</th></tr></thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.mes}><td>{f.mes}</td><td className="num monto">{bs(f.ingresos)}</td><td className="num monto">{bs(f.egresos)}</td><td className="num monto" style={{ color: f.saldo >= 0 ? "var(--green)" : "var(--rust)" }}>{bs(f.saldo)}</td></tr>
            ))}
          </tbody>
          <tfoot><tr><td>Total {anio}</td><td className="num monto">{bs(totales.ingresos)}</td><td className="num monto">{bs(totales.egresos)}</td><td className="num monto">{bs(totales.saldo)}</td></tr></tfoot>
        </table>
      </Card>
    </div>
  );
}

// ---------- 7) Estado de resultado por gestión (año) ----------
function ReporteEstadoResultado({ ctx }) {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const desde = `${anio}-01-01`;
  const hasta = `${anio}-12-31`;

  const porTipo = { patrimonial: 0, mensual: 0, voluntario: 0 };
  ctx.ingresosConsolidados.filter((i) => i.fecha >= desde && i.fecha <= hasta).forEach((i) => { porTipo[i.tipo] += i.monto; });
  const totalExterno = ctx.ingresosExternos.filter((i) => i.fecha >= desde && i.fecha <= hasta).reduce((a, b) => a + Number(b.monto), 0);
  const totalIngresos = porTipo.patrimonial + porTipo.mensual + porTipo.voluntario + totalExterno;

  const porCategoria = {};
  ctx.gastos.filter((g) => g.fecha >= desde && g.fecha <= hasta).forEach((g) => {
    const l = etiquetaCategoriaGasto(g.categoria);
    porCategoria[l] = (porCategoria[l] || 0) + Number(g.monto);
  });
  const totalEgresos = Object.values(porCategoria).reduce((a, b) => a + b, 0);
  const resultado = totalIngresos - totalEgresos;

  const filasExport = [
    { concepto: "Aportes patrimoniales", monto: porTipo.patrimonial },
    { concepto: "Aportes mensuales", monto: porTipo.mensual },
    { concepto: "Aportes voluntarios", monto: porTipo.voluntario },
    { concepto: "Ingresos institucionales", monto: totalExterno },
    { concepto: "Total ingresos", monto: totalIngresos },
    ...Object.entries(porCategoria).map(([concepto, monto]) => ({ concepto: `Egreso — ${concepto}`, monto: -monto })),
    { concepto: "Total egresos", monto: -totalEgresos },
    { concepto: "Resultado del ejercicio", monto: resultado },
  ];
  const columnasExport = [{ label: "Concepto", get: (f) => f.concepto }, { label: "Monto", get: (f) => f.monto }];

  return (
    <div>
      <div className="flex justify-between items-end flex-wrap gap-3 mb-5">
        <Field label="Gestión (año)"><input className="field-input" type="number" style={{ width: 120 }} value={anio} onChange={(e) => setAnio(Number(e.target.value))} /></Field>
        <div className="flex gap-2 no-print">
          <BotonCSV nombreArchivo={`estado_resultado_${anio}`} filas={filasExport} columnas={columnasExport} />
          <BotonExcel nombreArchivo={`estado_resultado_${anio}`} hojas={[{ nombre: `Estado de resultado ${anio}`, filas: filasExport, columnas: columnasExport }]} />
        </div>
      </div>

      <Card>
        <h3 style={{ fontFamily: "var(--font-display)", color: "var(--ink)", marginTop: 0 }}>Estado de resultado — Gestión {anio}</h3>
        <table className="ledger">
          <thead><tr><th>Ingresos</th><th className="num">Monto</th></tr></thead>
          <tbody>
            <tr><td>Aportes patrimoniales</td><td className="num monto">{bs(porTipo.patrimonial)}</td></tr>
            <tr><td>Aportes mensuales</td><td className="num monto">{bs(porTipo.mensual)}</td></tr>
            <tr><td>Aportes voluntarios</td><td className="num monto">{bs(porTipo.voluntario)}</td></tr>
            <tr><td>Ingresos institucionales</td><td className="num monto">{bs(totalExterno)}</td></tr>
          </tbody>
          <tfoot><tr><td>Total ingresos</td><td className="num monto">{bs(totalIngresos)}</td></tr></tfoot>
        </table>

        <table className="ledger" style={{ marginTop: 20 }}>
          <thead><tr><th>Egresos</th><th className="num">Monto</th></tr></thead>
          <tbody>
            {Object.entries(porCategoria).map(([cat, monto]) => <tr key={cat}><td>{cat}</td><td className="num monto">{bs(monto)}</td></tr>)}
            {Object.keys(porCategoria).length === 0 && <tr><td colSpan={2} style={{ color: "var(--text-muted)" }}>Sin egresos registrados.</td></tr>}
          </tbody>
          <tfoot><tr><td>Total egresos</td><td className="num monto">{bs(totalEgresos)}</td></tr></tfoot>
        </table>

        <div className="mt-5" style={{ borderTop: "2px solid var(--line-strong)", paddingTop: 14 }}>
          <div className="flex justify-between" style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem" }}>
            <span style={{ color: "var(--ink)" }}>Resultado del ejercicio</span>
            <span className="monto" style={{ color: resultado >= 0 ? "var(--green)" : "var(--rust)", fontWeight: 700 }}>{bs(resultado)}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

// =====================================================================
// CONFIGURACIÓN ANUAL
// =====================================================================
function Configuracion({ ctx }) {
  const esSuperadmin = ctx.sesion.rol === "superadmin";

  const [nombreEdit, setNombreEdit] = useState(ctx.nombreFraternidad || "");
  const [msgNombre, setMsgNombre] = useState(null);
  const [guardandoNombre, setGuardandoNombre] = useState(false);

  const [anio, setAnio] = useState(new Date().getFullYear());
  const [cuota, setCuota] = useState("");
  const [msg, setMsg] = useState(null);

  const [anioGen, setAnioGen] = useState(new Date().getFullYear());
  const [mesGen, setMesGen] = useState(new Date().getMonth() + 1);
  const [msgGen, setMsgGen] = useState(null);
  const [generando, setGenerando] = useState(false);

  async function guardarNombre(e) {
    e.preventDefault();
    const valor = nombreEdit.trim();
    if (!valor) { setMsgNombre({ tipo: "error", texto: "El nombre no puede quedar vacío." }); return; }
    setGuardandoNombre(true);
    try {
      await api.guardarAjuste("nombre_fraternidad", valor);
      ctx.setNombreFraternidad(valor);
      setMsgNombre({ tipo: "exito", texto: "Nombre actualizado correctamente." });
      aviso.exito("Nombre de la fraternidad actualizado.");
    } catch (err) {
      setMsgNombre({ tipo: "error", texto: err.message || "No se pudo guardar el nombre." });
    } finally {
      setGuardandoNombre(false);
    }
  }

  async function guardarCuota(e) {
    e.preventDefault();
    const c = Number(cuota);
    if (!c || c <= 0) { setMsg({ tipo: "error", texto: "Ingresa una cuota mensual válida." }); return; }
    await ctx.guardarCuotaAnual(anio, c);
    setMsg({ tipo: "exito", texto: `Cuota mensual de ${anio} guardada correctamente.` });
    aviso.exito("Cuota anual guardada.");
    setCuota("");
  }

  async function generar(e) {
    e.preventDefault();
    const ok = await ctx.confirmar({
      titulo: "Generar mensualidades",
      mensaje: `Se creará la obligación de ${MESES[mesGen - 1]} de ${anioGen} para todos los socios activos que aún no la tengan.`,
      textoConfirmar: "Generar",
    });
    if (!ok) return;
    setGenerando(true);
    try {
      const r = await ctx.generarMensualidades(anioGen, mesGen);
      setMsgGen({ tipo: r.ok ? "exito" : "error", texto: r.mensaje });
      if (r.ok) aviso.exito(r.mensaje);
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div>
      <PageHeader title="Configuración anual" subtitle="Define la cuota mensual de cada año. Los valores anteriores quedan preservados como historial." />

      {esSuperadmin && (
        <Card style={{ marginBottom: 20 }}>
          <h3 style={{ fontFamily: "var(--font-display)", color: "var(--ink)", marginTop: 0 }}>Nombre de la fraternidad</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Se usa en el menú lateral y en la pantalla de ingreso. Solo el súper administrador puede cambiarlo.
          </p>
          {msgNombre && <Mensaje tipo={msgNombre.tipo}>{msgNombre.texto}</Mensaje>}
          <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <Field label="Nombre"><input className="field-input" required value={nombreEdit} onChange={(e) => setNombreEdit(e.target.value)} /></Field>
          </div>
          <div className="mt-4"><Btn onClick={guardarNombre} disabled={guardandoNombre}>{guardandoNombre ? "Guardando…" : "Guardar nombre"}</Btn></div>
        </Card>
      )}

      <Card style={{ marginBottom: 20 }}>
        <h3 style={{ fontFamily: "var(--font-display)", color: "var(--ink)", marginTop: 0 }}>Definir cuota mensual del año</h3>
        {msg && <Mensaje tipo={msg.tipo}>{msg.texto}</Mensaje>}
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <Field label="Año"><input className="field-input" type="number" required value={anio} onChange={(e) => setAnio(Number(e.target.value))} /></Field>
          <Field label="Cuota mensual (Bs)"><input className="field-input" type="number" min="0" step="0.01" required value={cuota} onChange={(e) => setCuota(e.target.value)} /></Field>
        </div>
        <div className="mt-4"><Btn onClick={guardarCuota}>Guardar cuota</Btn></div>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <h3 style={{ fontFamily: "var(--font-display)", color: "var(--ink)", marginTop: 0 }}>Generar mensualidades</h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
          Genera la obligación mensual para todos los socios activos del mes y año seleccionados. No se duplican obligaciones ya generadas.
        </p>
        {msgGen && <Mensaje tipo={msgGen.tipo}>{msgGen.texto}</Mensaje>}
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <Field label="Mes">
            <select className="field-input" value={mesGen} onChange={(e) => setMesGen(Number(e.target.value))}>
              {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </Field>
          <Field label="Año"><input className="field-input" type="number" required value={anioGen} onChange={(e) => setAnioGen(Number(e.target.value))} /></Field>
        </div>
        <div className="mt-4"><Btn onClick={generar} disabled={generando}>{generando ? "Generando…" : "Generar mensualidades"}</Btn></div>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <h3 style={{ fontFamily: "var(--font-display)", color: "var(--ink)", marginTop: 0 }}>Historial de cuotas por año</h3>
        {ctx.configAnual.length === 0 ? <Vacio>Aún no se definió ninguna cuota.</Vacio> : (
          <table className="ledger">
            <thead><tr><th>Año</th><th className="num">Cuota mensual</th></tr></thead>
            <tbody>
              {ctx.configAnual.slice().sort((a, b) => b.anio - a.anio).map((c) => (
                <tr key={c.anio}><td>{c.anio}</td><td className="num monto">{bs(c.cuota)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <ImportadorExcel ctx={ctx} />
    </div>
  );
}

// =====================================================================
// IMPORTAR DATOS DESDE EXCEL
// =====================================================================
function ImportadorExcel({ ctx }) {
  const [archivo, setArchivo] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  const esSuperadmin = ctx.sesion.rol === "superadmin";

  async function iniciar() {
    if (!archivo) return;
    setError(null);
    setResultado(null);

    const ok = await ctx.confirmar({
      titulo: "Importar datos desde Excel",
      mensaje: "Se crearán socios, aportes y/o gastos según las filas del archivo. Esta acción no se puede deshacer automáticamente (aunque siempre puedes editar o anular cada registro después). ¿Continuar?",
      textoConfirmar: "Importar",
    });
    if (!ok) return;

    setProcesando(true);
    setProgreso({ hechos: 0, total: 1 });
    try {
      const libro = await leerLibroExcel(archivo);
      const r = await importarDatos({
        libro,
        socios: ctx.socios,
        esSuperadmin,
        estados: ESTADOS_SOCIO,
        roles: ROLES_ACCESO,
        turnos: TURNOS,
        categoriasGasto: CATEGORIAS_GASTO,
        onProgreso: (hechos, total) => setProgreso({ hechos, total }),
      });
      setResultado(r);
      if (r.errores.length === 0) aviso.exito("Importación completada sin errores.");
      else aviso.error(`Importación completada con ${r.errores.length} fila(s) con problemas — revisa el detalle abajo.`);
    } catch (err) {
      setError(err.message || "No se pudo procesar el archivo.");
    } finally {
      setProcesando(false);
      setArchivo(null);
    }
  }

  return (
    <Card style={{ marginTop: 20 }}>
      <h3 style={{ fontFamily: "var(--font-display)", color: "var(--ink)", marginTop: 0 }}>Importar datos desde Excel</h3>
      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
        Sube un Excel con hasta 4 hojas — <b>Socios</b>, <b>Aportes</b>, <b>Ingresos institucionales</b> y{" "}
        <b>Gastos</b> — para cargar varios registros de una sola vez. Los socios se identifican por su
        celular: si no conoces el celular real de alguno, puedes inventar un número correlativo único
        (ej. 70000001, 70000002…). Un socio importado <b>todavía no tiene cuenta de acceso</b> — Supabase
        limita cuántas cuentas se pueden crear por hora, así que la importación nunca las crea en lote;
        actívalas de a una desde la tabla de Socios (botón "Activar acceso") cuando cada socio esté listo
        para usar el sistema. En Aportes, usa el tipo{" "}
        <b>"Obligación mensual"</b> para cargar lo que se le cargó al socio ese mes (Debe), y{" "}
        <b>"Mensual"</b> para el pago que hizo (Haber) — son dos cosas distintas. Los ingresos que no
        vienen de un socio (alquiler, donaciones, otros) van en su propia hoja. La hoja "Instrucciones"
        de la plantilla explica cada valor permitido.
        {!esSuperadmin && " Como no eres súper administrador, todos los socios nuevos se crearán como Patrimonial / Socio, sin importar lo que diga el Excel."}
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <Btn variante="secondary" icon={Download} onClick={descargarPlantillaImportacion}>Descargar plantilla</Btn>
      </div>

      {error && <Mensaje tipo="error">{error}</Mensaje>}

      <div className="flex items-end gap-3 flex-wrap">
        <Field label="Archivo Excel (.xlsx) ya llenado">
          <input
            className="field-input"
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => { setArchivo(e.target.files?.[0] || null); setResultado(null); setError(null); }}
          />
        </Field>
        <Btn onClick={iniciar} disabled={!archivo || procesando}>
          {procesando ? "Importando…" : "Iniciar importación"}
        </Btn>
      </div>

      {procesando && progreso && (
        <div className="mt-4">
          <div className="barra-track"><div className="barra-fill" style={{ width: `${Math.round((progreso.hechos / Math.max(progreso.total, 1)) * 100)}%`, background: "var(--gold)" }} /></div>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 6 }}>Procesando fila {progreso.hechos} de {progreso.total}…</p>
        </div>
      )}

      {resultado && (
        <div className="mt-5">
          <div className="grid gap-3.5 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            <StatCard label="Socios creados" value={resultado.sociosCreados} tono="positivo" />
            <StatCard label="Sin acceso todavía (activar en Socios)" value={resultado.sociosSinAcceso} />
            <StatCard label="Socios ya existentes (omitidos)" value={resultado.sociosExistentes} />
            <StatCard label="Obligaciones mensuales generadas" value={resultado.obligacionesMensualesGeneradas} tono="positivo" />
            <StatCard label="Aportes (pagos) registrados" value={resultado.aportesCreados} tono="positivo" />
            <StatCard label="Ingresos institucionales" value={resultado.ingresosExternosCreados} tono="positivo" />
            <StatCard label="Gastos registrados" value={resultado.gastosCreados} tono="positivo" />
          </div>
          {resultado.errores.length > 0 && (
            <div>
              <h4 style={{ color: "var(--rust)", fontSize: "0.9rem", marginBottom: 6 }}>Filas con problemas ({resultado.errores.length})</h4>
              <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 6, padding: "8px 12px" }}>
                {resultado.errores.map((e, i) => (
                  <div key={i} style={{ fontSize: "0.82rem", color: "var(--text-muted)", padding: "4px 0", borderBottom: i < resultado.errores.length - 1 ? "1px solid var(--line)" : "none" }}>{e}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// =====================================================================
// FIN
// =====================================================================

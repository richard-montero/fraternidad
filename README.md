# Fraternidad — Gestión financiera

Esta es la versión funcional y conectada a base de datos real del software que
me pasaste como vista previa. Funciona en computadora y en celular (el diseño
se adapta automáticamente), y está lista para publicarse en Netlify.

## ⚠️ Tres cosas que cambié respecto a la vista previa (y por qué)

La vista previa que me enviaste era solo una maqueta visual, sin conexión
real. Para conectarla a una base de datos de verdad, de forma segura y **sin
usar claves secretas ni funciones avanzadas de Supabase**, tuve que ajustar
tres detalles:

1. **El inicio de sesión ahora es con correo electrónico, no con celular.**
   Supabase (el sistema que guarda los usuarios y contraseñas de forma
   segura) solo permite iniciar sesión con correo y contraseña usando la
   llave pública. El número de celular se sigue guardando y mostrando en
   cada socio, pero ya no sirve para entrar al sistema.
2. **La contraseña por defecto de un socio nuevo es `123456`, no `12345`.**
   Supabase exige un mínimo de 6 caracteres.
3. **Cambiar la contraseña de OTRO socio ya no es un campo de texto.** Ahora
   es un botón "Enviar enlace de restablecimiento" que le manda un correo al
   socio para que él mismo defina su nueva contraseña. Fijar la contraseña de
   otra persona directamente requiere una llave secreta de administrador, que
   decidimos no usar por seguridad (si alguna vez se filtrara esa llave,
   cualquiera podría entrar como cualquier socio).

Todo lo demás funciona igual que en tu vista previa: socios, aporte
patrimonial, aportes mensuales, aportes voluntarios, gastos con comprobante
adjunto, reportes y configuración anual.

---

## 🆕 Mejoras de esta versión

**Corrección de fondo:** el proyecto usaba clases de Tailwind CSS
(`flex`, `grid`, `gap-3.5`, etc.) en todo el diseño, pero Tailwind nunca se
instaló como dependencia. Por eso en Netlify el menú lateral y el contenido
no quedaban realmente en fila, ni las grillas de tarjetas funcionaban — todo
dependía únicamente de los estilos en línea. Ya quedó instalado y
configurado correctamente (ver `vite.config.js` y `src/index.css`).

**Diseño:**
- Menú lateral fijo en pantallas grandes; en el celular se convierte en un
  panel deslizante con botón de menú, con una barra superior propia.
- Tablas largas con scroll horizontal en pantallas angostas, para que nunca
  se rompan.
- Avisos ("toasts") para confirmar acciones, además de los mensajes en cada
  formulario.
- Cuadros de confirmación antes de acciones sensibles (desactivar un socio,
  eliminar un gasto, generar mensualidades).
- Barras comparativas simples en el Panel general y en Reportes (ingresos
  por origen, ingresos vs. egresos, egresos por categoría).
- Etiquetas de formulario conectadas a su campo (accesibilidad), botón para
  mostrar/ocultar la contraseña en el login, favicon y tipografía
  precargada.

**Funciones nuevas:**
- **Editar datos de un socio** (nombre, celular, correo) desde "Socios → Gestionar".
- **Ajuste / anulación** en el mayor patrimonial y en el de mensualidades:
  agrega un asiento de corrección sin borrar el historial (útil si se
  registró mal un monto).
- **Editar y eliminar un gasto** (solo súper administrador) — requiere
  ejecutar el nuevo script `supabase/03_mejoras.sql` (ver Parte 1, Paso 7).
- **Exportar a CSV** desde Libro de ingresos, Libro de gastos y Reportes.
- **Imprimir / guardar como PDF** el reporte del período, con un botón
  dedicado.
- Búsqueda y **orden de columnas** (clic en el encabezado) en Socios,
  Ingresos y Gastos, con paginación "Mostrar más" para historiales largos.

Nada de esto cambia el esquema de datos existente: tu base de datos de
Supabase actual sigue funcionando igual, solo se agregan dos permisos
nuevos y unos índices (paso 7 abajo).

---

## 🆕 Cambios solicitados (segunda ronda)

**Socios:**
- Se agregó **fecha de nacimiento**.
- El estado del socio ahora es **Patrimonial / Invitado / De baja**
  (reemplaza a Activo/Inactivo). Solo un **súper administrador** puede
  cambiarlo — la regla está aplicada dentro de la base de datos, así que
  se cumple aunque alguien intente saltarse la interfaz.
- A un socio **de baja** ya no se le generan mensualidades nuevas al usar
  "Generar mensualidades".

**Nuevo rol — Supervisor:**
- Ve el Panel general, Socios, Libro de ingresos, Libro de gastos y
  Reportes, y puede generar/exportar/imprimir todos los reportes.
- No puede crear, editar ni eliminar nada — ni siquiera si manipula la
  aplicación directamente, porque la base de datos rechaza esos cambios a
  nivel de permisos (RLS), no solo se ocultan los botones.

**Ingresos institucionales (que no provienen de socios):**
- Nueva pestaña "Ingreso institucional" en el Libro de ingresos, con tres
  orígenes: Alquiler/uso de instalaciones, Donaciones, Otros.
- Aparecen junto con los aportes de socios en el mismo libro, mezclados
  y a la vez diferenciados con una etiqueta, y se incluyen en todos los
  reportes generales.

**Gastos reclasificados:**
Sueldos y salarios · Servicios básicos — Saguapac · Servicios básicos — Cre
· Internet y telefonía · Mantenimientos · Otros.
Los gastos históricos con la categoría anterior siguen mostrando una
etiqueta legible automáticamente (no hace falta volver a clasificarlos).

**Reportes — ahora con 7 pestañas, todas imprimibles y exportables a Excel
(.xlsx real) y CSV:**
1. Resumen general (el que ya existía, ahora incluye ingresos institucionales)
2. Ingresos de socios (mensual / anual / rango de fechas)
3. Detalle de pagos por socio, con subtotales de Patrimonial / Mensual /
   Voluntario
4. Movimientos de ingresos — Resumen y Detalle
5. Movimientos de egresos — Resumen y Detalle
6. Resumen mensual y anual de ingresos y egresos (las 12 filas del año)
7. Estado de resultado por gestión (ingresos − egresos = resultado del
   ejercicio, para el año que elijas)

"Exportar a PDF" se hace con el botón **Imprimir / PDF** de cada reporte:
abre el diálogo de impresión del navegador, donde puedes elegir "Guardar
como PDF" — así el PDF sale siempre con el diseño ya ajustado para
imprimir, sin depender de una librería adicional.

---

## 🆕 Importar datos desde Excel

Desde **Configuración anual** (solo administrador/súper administrador) hay
una sección **"Importar datos desde Excel"**:

1. Descarga la plantilla con el botón correspondiente — trae 3 hojas
   (**Socios**, **Aportes**, **Gastos**) con los encabezados correctos y
   una fila de ejemplo en cada una.
2. Llena la plantilla con tus datos (puedes dejar hojas vacías si no las
   necesitas) y guárdala.
3. Súbela y presiona "Iniciar importación".

Cómo funciona:
- Los socios se identifican por su **celular**: si ya existe un socio con
  ese celular, esa fila se omite (nunca se duplica).
- Si en la hoja Socios pones un monto en "Aporte patrimonial acordado",
  se crea automáticamente esa obligación patrimonial para ese socio.
- En la hoja Aportes, la columna "Celular" debe coincidir con el celular
  de un socio ya existente o recién creado en la hoja Socios.
- La hoja Aportes distingue **dos cosas distintas** para lo mensual:
  - **"Obligación mensual"** — lo que se le *cargó* al socio ese mes
    (lado Debe). Usa el año y mes de la columna Fecha. Si ese socio ya
    tenía ese mes marcado como generado, la fila se omite para no
    duplicar (y ya no aparecerá disponible para "Generar mensualidades"
    en Configuración).
  - **"Mensual"** — el *pago* que hizo el socio (lado Haber). Igual que
    "Patrimonial" y "Voluntario".
  - Para reconstruir el historial completo de un mes, normalmente pones
    una fila de "Obligación mensual" (lo que se le cargó) y, si ya pagó,
    otra fila de "Mensual" (lo que pagó) — la hoja "Instrucciones" de la
    plantilla trae el detalle y un ejemplo de las dos juntas.
- Si no eres súper administrador, todo socio nuevo se crea como
  Patrimonial/Socio sin importar lo que diga el Excel (misma regla que el
  formulario manual).
- Al terminar, se muestra un resumen y el detalle de cualquier fila que no
  se pudo procesar (con el número de fila y el motivo), sin que eso
  detenga el resto de la importación.
- Como cada socio nuevo requiere crear su usuario de acceso, la
  importación hace una breve pausa entre cada uno — para muchos socios
  puede tardar uno o dos minutos; no cierres la pestaña mientras dice
  "Importando…".

---

## PARTE 1 — Configurar la base de datos en Supabase

### Paso 1: Crear el proyecto
Si todavía no tienes uno, crea un proyecto nuevo en [supabase.com](https://supabase.com).
Guarda la contraseña de base de datos que te pida (no la necesitarás para
este software, pero consérvala).

### Paso 2: Ejecutar el script de la base de datos
1. En el panel de Supabase, ve a **SQL Editor** (ícono de una hoja) → **New query**.
2. Abre el archivo `supabase/01_schema.sql` de esta entrega, copia todo su
   contenido y pégalo en el editor.
3. Presiona **Run**. Esto crea todas las tablas, y las reglas de seguridad
   que protegen los datos de cada socio.

### Paso 3: Crear tu usuario administrador
1. Ve a **Authentication** → **Users** → **Add user**.
2. Escribe el correo y la contraseña que tú quieras usar como administrador
   principal (súper administrador). Si aparece la opción **"Auto Confirm
   User"**, actívala.
3. Ve a **Authentication** → **Sign In / Providers** → **Email**, y
   **desactiva** la opción "Confirm email" (para que los socios que crees
   después puedan entrar de inmediato, sin tener que confirmar su correo).
   Guarda los cambios.

### Paso 4: Vincular ese usuario como súper administrador
1. Vuelve a **SQL Editor** → **New query**.
2. Abre el archivo `supabase/02_crear_admin.sql`, reemplaza el correo de
   ejemplo por el correo que usaste en el Paso 3 (aparece dos veces en el
   archivo), y pega todo el contenido en el editor.
3. Presiona **Run**. Al final debe mostrarte una fila con tu nombre y el rol
   "superadmin" — eso confirma que quedó bien.

### Paso 5: Crear la carpeta de almacenamiento para comprobantes de gastos
1. Ve a **Storage** → **New bucket**.
2. Nombre exacto: `comprobantes-gastos`
3. Déjalo como bucket **privado** (no actives "Public bucket") — son
   comprobantes de pagos, es mejor que no sean públicos. La aplicación ya
   sabe cómo mostrarlos igual, de forma segura, a los administradores.
4. Presiona **Save**.

### Paso 6: Copiar tus dos claves de conexión
1. Ve a **Project Settings** (ícono de engranaje) → **API**.
2. Copia el **Project URL**.
3. Copia la **Publishable key** (también llamada "anon / public key").
   Guarda las dos, las necesitas en la Parte 2.

### Paso 7: Ejecutar el script de mejoras
1. Vuelve a **SQL Editor** → **New query**.
2. Abre `supabase/03_mejoras.sql`, copia todo su contenido y pégalo.
3. Presiona **Run**. Esto habilita que un súper administrador pueda editar o
   eliminar un gasto ya registrado, y agrega índices para que los libros
   contables carguen rápido aunque crezca el historial. Si ya tenías la base
   de datos configurada de antes (Pasos 2–6), solo te falta este paso.

### Paso 8: Ejecutar el script de cambios (nuevo)
1. Vuelve a **SQL Editor** → **New query**.
2. Abre `supabase/04_cambios.sql`, copia todo su contenido y pégalo.
3. Presiona **Run**. Este script agrega:
   - Fecha de nacimiento del socio.
   - Los nuevos estados de socio (Patrimonial / Invitado / De baja), migrando
     automáticamente los valores que ya tenías (Activo → Patrimonial,
     Inactivo → De baja).
   - El nuevo rol Supervisor.
   - La tabla de ingresos que no provienen de socios (alquiler, donaciones,
     otros).
   - La regla de que solo un súper administrador puede cambiar el estado o
     el rol de un socio (aplicada dentro de la base de datos, no solo en la
     pantalla).

---

## PARTE 2 — Publicar la aplicación en Netlify

### Opción A — Arrastrar y soltar (la más simple)
1. En tu computadora, dentro de la carpeta del proyecto, crea un archivo
   llamado `.env` (copia `.env.example` y renómbralo) y pega ahí tus dos
   claves del Paso 6.
2. Abre una terminal dentro de la carpeta del proyecto y ejecuta:
   ```
   npm install
   npm run build
   ```
   Esto crea una carpeta llamada `dist`.
3. Ve a [app.netlify.com](https://app.netlify.com) → **Add new site** →
   **Deploy manually**, y arrastra la carpeta `dist` completa.

### Opción B — Conectando tu repositorio de GitHub (recomendada a futuro)
1. Sube esta carpeta a un repositorio de GitHub.
2. En Netlify: **Add new site** → **Import an existing project** → elige tu
   repositorio.
3. Netlify detectará automáticamente el comando de build (`npm run build`) y
   la carpeta `dist` gracias al archivo `netlify.toml` incluido.
4. Antes de publicar, ve a **Site settings** → **Environment variables** y
   agrega:
   - `VITE_SUPABASE_URL` = (tu Project URL)
   - `VITE_SUPABASE_ANON_KEY` = (tu Publishable key)
5. Presiona **Deploy site**.

Con cualquiera de las dos opciones, cada vez que cambies de proyecto de
Supabase, solo necesitas actualizar esas dos variables — nunca tienes que
tocar el código.

---

## PARTE 3 — Usar la aplicación

1. Entra a la URL que te dio Netlify.
2. Inicia sesión con el correo y contraseña que definiste en el Paso 3.
3. Ve a **Socios** → **Nuevo socio** para registrar a los demás miembros de
   la fraternidad. Como eres súper administrador, puedes elegir su rol
   (Socio / Supervisor / Administrador / Súper administrador) y, si
   quieres, una
   contraseña para esa persona; si la dejas en blanco, será `123456` y se
   recomienda que la cambien luego con "Enviar enlace de restablecimiento".
4. Desde **Configuración anual**, define la cuota mensual del año y genera
   las mensualidades para los socios (los que estén "de baja" no reciben
   mensualidades nuevas).
5. Registra pagos desde **Libro de ingresos**, o desde la ficha de cada
   socio.
6. Registra gastos con su comprobante desde **Libro de gastos**.

---

## ✅ Resumen rápido — solo lo que tienes que hacer

**En Supabase:**
1. Ejecutar `supabase/01_schema.sql` en el SQL Editor.
2. Crear el usuario administrador en Authentication → Users (y desactivar
   "Confirm email" en Authentication → Providers → Email).
3. Editar el correo en `supabase/02_crear_admin.sql` y ejecutarlo.
4. Crear el bucket privado `comprobantes-gastos` en Storage.
5. Copiar el Project URL y la Publishable key desde Project Settings → API.
5.b. Ejecutar `supabase/03_mejoras.sql` (habilita editar/eliminar gastos y
   agrega índices).
5.c. Ejecutar `supabase/04_cambios.sql` (nuevo — fecha de nacimiento, nuevos
   estados de socio, rol Supervisor, ingresos institucionales).

**En Netlify:**
6. Pegar esas dos claves como variables de entorno (o en un archivo `.env`
   si vas a compilar en tu computadora).
7. Publicar la carpeta `dist` (o conectar tu repositorio de GitHub).

Y listo — la aplicación queda funcionando con tu propia base de datos.

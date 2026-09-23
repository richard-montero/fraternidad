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

1. Descarga la plantilla con el botón correspondiente — trae 4 hojas
   (**Socios**, **Aportes**, **Ingresos institucionales**, **Gastos**) con
   los encabezados correctos y una fila de ejemplo en cada una.
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
- La hoja **"Ingresos institucionales"** es para los ingresos que NO
  provienen de un socio: Alquiler, Donación u Otro — no lleva celular, es
  independiente de la hoja Socios.
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

### Paso 9: Ejecutar el script del campo Turno (nuevo)
1. Vuelve a **SQL Editor** → **New query**.
2. Abre `supabase/05_turno.sql`, copia todo su contenido y pégalo.
3. Presiona **Run**. Agrega el campo "Turno" a cada socio, con los doce
   meses abreviados (Ene…Dic) como valores posibles. Es opcional: puede
   quedar sin asignar.

### Paso 10: Ejecutar el script del nombre editable (nuevo)
1. Vuelve a **SQL Editor** → **New query**.
2. Abre `supabase/06_nombre_fraternidad.sql`, copia todo su contenido y
   pégalo.
3. Presiona **Run**. Agrega una tabla de ajustes generales para que el
   título "Fraternidad" del menú y de la pantalla de ingreso pueda
   cambiarse desde Configuración anual (solo súper administrador).

### Paso 11: Ejecutar el script de credenciales temporales (nuevo)
1. Vuelve a **SQL Editor** → **New query**.
2. Abre `supabase/07_primer_ingreso.sql`, copia todo su contenido y
   pégalo.
3. Presiona **Run**.
4. Ve a **Authentication → Providers → Email** y desactiva **"Secure
   email change"** (junto a "Confirm email", que ya desactivaste antes).

### Paso 12: Ejecutar el script de importación robusta (nuevo)
1. Vuelve a **SQL Editor** → **New query**.
2. Abre `supabase/08_importacion_robusta.sql`, copia todo su contenido y
   pégalo.
3. Presiona **Run**. Agrega una función que la importación de Excel usa
   para cargar las obligaciones mensuales de forma más confiable (ver
   más abajo).

### Paso 13: Ejecutar el script de Saldo caja y Pagos con QR (nuevo)
1. Vuelve a **SQL Editor** → **New query**.
2. Abre `supabase/09_saldo_caja_qr.sql`, copia todo su contenido y
   pégalo.
3. Presiona **Run**.
4. Ve a **Storage** → **New bucket**. Nombre exacto: `qr-pagos`. Déjalo
   **privado** (igual que `comprobantes-gastos`). Presiona **Save**.

---

## 🆕 Saldo caja, Pagos con QR, e historial de cuotas por año

**Saldo caja (Panel general):** una tarjeta destacada, separada de los
filtros de período, con el total de todos los ingresos menos todos los
egresos desde siempre — no cambia según el mes/año/rango que elijas
consultar.

**Pagos con QR:** nueva opción de menú (entre Socios y Libro de
ingresos), visible para **todos los socios**, con dos pestañas —
"Alquiler / Uso fraternidad" y "Patrimonial" — cada una muestra el
código QR correspondiente con un botón para descargarlo. Un
administrador o súper administrador sube o reemplaza esas dos imágenes
desde **Configuración anual → Pagos con QR**.

**Historial de cuotas por año:** ahora un mismo año puede tener varias
cuotas guardadas a lo largo del tiempo (por ejemplo, si sube a mitad de
año) — no se pierden las anteriores, y tanto "Generar mensualidades"
como el resto de la aplicación siempre usan la **última** que se guardó
para ese año. La tabla de historial marca con una etiqueta "Vigente"
cuál es la que está en uso para cada año.

La fecha de las mensualidades generadas por el botón "Generar
mensualidades" ya quedaba fijada al día 1 de cada mes — no hizo falta
ningún cambio ahí.

---

## 🆕 Estado de cuenta en PDF, desde la ficha de cada socio

En la ficha de cualquier socio hay un botón **"Estado de cuenta (PDF)"**
(arriba, junto al nombre) que genera y descarga un PDF con el mismo
formato que usabas en tu sistema anterior:

- Encabezado con el nombre de la fraternidad, la fecha del reporte y el
  nombre del socio, repetido en cada página.
- **Patrimonial**: monto total acordado y el mayor completo, con
  columnas Adeudado / Pagado / Saldo Deudor / Pago Adelantado (el
  saldo se reparte entre estas dos últimas según si el socio debe o
  pagó de más).
- **Obligaciones Mensuales Socios y/o Invitados**: el mismo formato de
  mayor, con la nota "Para estar al día... debe cancelar Bs.X" al pie,
  si corresponde.
- **Aportes Voluntarios**: fecha, concepto, pagado y saldo acumulado.
- Numeración de página ("Pág: X de Y") en todas las páginas, calculada
  al final una vez que se sabe cuántas páginas tiene el documento en
  total, y con saltos de página que nunca cortan una fila de la tabla
  por la mitad.

El botón está disponible tanto para un administrador viendo la ficha de
cualquier socio, como para un socio viendo su propia ficha. El PDF se
genera enteramente en el navegador (no depende de ningún servidor
externo).

---

## 🆕 Se eliminó la generación de correos temporales

Supabase empezó a avisar que estaba detectando una tasa alta de
**correos rebotados** desde el proyecto — la causa era que, al activar
el acceso de un socio dejando el correo vacío, se generaba
automáticamente uno temporal (`<celular>@gmail.com`) que **no existe de
verdad**, y cada intento de mandarle algo ahí (una confirmación, un
restablecimiento de contraseña) rebotaba. Con suficientes rebotes,
Supabase puede llegar a restringir el envío de correos de todo el
proyecto — no solo el temporal, también los reales.

**La corrección:** se eliminó por completo la generación de correos
temporales. Ahora, tanto en **"Nuevo socio"** como en **"Activar
acceso"**, el correo real es **obligatorio** — no se puede dejar vacío.
La importación desde Excel no cambia (nunca creó accesos en lote,
seguirá siendo así), pero al activar el acceso de alguien más adelante,
vas a necesitar su correo real desde ese momento.

Las cuentas que ya habían quedado en "Primer ingreso pendiente" (con un
correo temporal ya generado antes de este cambio) siguen funcionando
igual que antes — ese mecanismo no se tocó, solo se dejó de usar para
cuentas nuevas.

Revisa también que **"Confirm email"** esté desactivado en
Authentication → Providers → Email (esto ya se explicó antes, pero es
importante confirmarlo de nuevo si acabas de recibir el aviso de
Supabase sobre rebotes).

---

## 🆕 Nuevo rol: Pasivo

**Paso 15:** en Supabase → SQL Editor, ejecuta `supabase/13_rol_pasivo.sql`.

Un socio con rol **Pasivo** solo ve, en todo el sistema, **"Pagar con
QR"** y **"Turno/Cumpleaños"** — ni siquiera ve su propio resumen
financiero ("Mi resumen"). Es el rol más restringido que existe (más
que "Socio").

Para asignarlo: **Socios → Gestionar → Estado y rol de acceso**
(solo lo puede hacer el súper administrador, igual que con los demás
roles) → elige "Pasivo" en el selector de Rol → Guardar rol.

A nivel de permisos de base de datos, un socio Pasivo tiene exactamente
los mismos permisos que un Socio normal — la restricción de qué ve es
del lado de la aplicación (el menú y las pantallas), no cambia nada de
seguridad adicional.

**Además:** al usar "Generar mensualidades" (Configuración anual), los
socios con rol Pasivo quedan excluidos — igual que los socios "de
baja", no se les genera ninguna obligación mensual nueva.

---

## 🆕 Tercer QR: Obligaciones Mensuales

**Paso 14:** en Supabase → SQL Editor, ejecuta `supabase/12_qr_mensual.sql`
(amplía los permisos de subida para incluir la nueva clave del QR).

"Pagar con QR" ahora tiene 3 pestañas, en este orden:
1. **Obligaciones Mensuales** (nueva — pestaña que se abre por defecto)
2. Alquiler / Uso fraternidad
3. Patrimonial

Se sube igual que los otros dos, desde **Configuración anual → Pagos con
QR** — no hace falta crear ningún bucket nuevo, usa el mismo `qr-pagos`
que ya tenías configurado.

---

## 🆕 Avisos por correo (recordatorios, confirmaciones, cumpleaños, anuncios)

Esta es la primera función de la aplicación que necesita algo más que
pegar SQL o hacer `git push` — necesita una **función en la nube**
(Edge Function de Supabase) porque mandar un correo real requiere una
llave secreta que nunca debe estar en el navegador. Son pasos nuevos,
pero cada uno es una sola vez.

### Qué hace

- **Confirmación de pago** — se manda sola, automáticamente, apenas se
  registra un aporte patrimonial, mensual o voluntario de un socio.
- **Recordatorio de saldo pendiente** — a pedido (botón en Configuración
  anual) o programado (por ejemplo, el día 1 de cada mes).
- **Aviso general** (reuniones, eventos, anuncios) — a pedido, con
  asunto y mensaje libres, a todos los socios.
- **Cumpleaños del día** — a pedido o programado a diario, felicita a
  quien cumpla años ese día.

Nunca se manda nada al correo temporal de un socio que todavía no
completó su primer ingreso — solo a quien ya tiene su correo real
confirmado.

### Paso A: Crear tu cuenta de Resend (el servicio que manda los correos)

1. Entra a **[resend.com](https://resend.com)** y crea una cuenta gratis (alcanza de sobra para esto).
2. Ve a **API Keys** → **Create API Key** → cópiala (la vas a necesitar en el Paso C).
3. (Opcional pero recomendado) En **Domains**, agrega y verifica tu propio dominio para que los correos salgan de una dirección con el nombre de tu fraternidad. Si no tienes dominio propio, puedes usar el remitente de prueba de Resend mientras tanto (`onboarding@resend.dev`) — funciona, pero es menos profesional.

### Paso B: Instalar la Supabase CLI en tu computadora

Esto se instala una sola vez en tu computadora (no en el proyecto).

1. Instala **Node.js** si no lo tienes ([nodejs.org](https://nodejs.org)).
2. Abre una terminal y ejecuta:
   ```bash
   npm install -g supabase
   supabase login
   ```
   (Te abre el navegador para iniciar sesión con tu cuenta de Supabase.)
3. Dentro de la carpeta de tu proyecto (la misma donde está `package.json`), ejecuta:
   ```bash
   supabase link --project-ref TU-PROJECT-REF
   ```
   El `TU-PROJECT-REF` lo encuentras en tu proyecto de Supabase → Project Settings → General → "Reference ID".

### Paso C: Configurar las claves secretas de la función

En una terminal, dentro de la carpeta del proyecto:

```bash
supabase secrets set RESEND_API_KEY=tu_api_key_de_resend
supabase secrets set CLAVE_CRON=inventa-una-clave-larga-y-secreta-aqui
supabase secrets set REMITENTE="Fraternidad <avisos@tudominio.com>"
```

`CLAVE_CRON` es una clave que inventas tú (como una contraseña larga) —
solo la usan los envíos automáticos programados, para demostrar que son
legítimos. Guárdala, la necesitas en el Paso E.

Si todavía no tienes dominio propio verificado en Resend, usa
`REMITENTE="Fraternidad <onboarding@resend.dev>"` mientras tanto.

### Paso D: Desplegar la función y ejecutar el script SQL

```bash
supabase functions deploy enviar-avisos
```

Y en Supabase → SQL Editor, ejecuta `supabase/11_avisos.sql` (para la
tabla que evita mandar el mismo aviso dos veces el mismo día).

### Paso E (opcional): Programar los envíos automáticos

Si quieres que los recordatorios y los cumpleaños se manden solos, sin
que tengas que apretar el botón, ejecuta esto en el SQL Editor
(reemplaza `TU-PROJECT-REF` y `TU-CLAVE-CRON` por los tuyos):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'recordatorio-mensual',
  '0 13 1 * *', -- día 1 de cada mes, 13:00 UTC (09:00 hora Bolivia)
  $$
  select net.http_post(
    url := 'https://TU-PROJECT-REF.supabase.co/functions/v1/enviar-avisos',
    headers := jsonb_build_object('Content-Type','application/json','x-clave-cron','TU-CLAVE-CRON'),
    body := jsonb_build_object('tipo','recordatorio_pendientes')
  );
  $$
);

select cron.schedule(
  'cumpleanos-diario',
  '0 12 * * *', -- todos los días, 12:00 UTC (08:00 hora Bolivia)
  $$
  select net.http_post(
    url := 'https://TU-PROJECT-REF.supabase.co/functions/v1/enviar-avisos',
    headers := jsonb_build_object('Content-Type','application/json','x-clave-cron','TU-CLAVE-CRON'),
    body := jsonb_build_object('tipo','cumpleanos_hoy')
  );
  $$
);
```

Ajusta los horarios (los números `'minuto hora día mes día-semana'`) a
tu gusto — estos están en horario UTC, que en Bolivia va 4 horas
adelantado (UTC-4), por eso "13:00 UTC" es "09:00 en Bolivia".

### Cómo probarlo

1. Ve a **Configuración anual → Avisos por correo**.
2. Prueba primero "Enviar saludos de hoy" o "Enviar recordatorios ahora"
   con pocos socios con correo real confirmado — revisa que te llegue
   bien antes de mandar el aviso general a todos.
3. Registra un pago de prueba desde **Libro de ingresos** y confirma que
   llega el correo de confirmación automáticamente.

### Si algo falla

El botón te muestra el resultado ("Se enviaron X correos, Y fallaron")
— si hay errores, casi siempre es porque falta un secreto (revisa el
Paso C) o porque la función todavía no se desplegó (Paso D). Puedes ver
los registros de la función en Supabase → Edge Functions →
"enviar-avisos" → Logs.

---

## 🆕 Cambiar mi contraseña — disponible siempre, no solo en el primer ingreso

Se detectó un vacío real: si a un socio se le da acceso con su correo
real directo (en vez de uno temporal), nunca pasa por la pantalla
obligatoria de "Configura tu cuenta" — así que se quedaba para siempre
con la contraseña `123456`, sin ninguna forma de cambiarla por su
cuenta.

**La corrección:** ahora hay un botón **"Cambiar mi contraseña"** debajo
de "Cerrar sesión", en el menú lateral — visible para cualquier persona
con sesión activa, en cualquier momento, sin importar cómo haya
ingresado la primera vez. Solo pide la contraseña nueva (mínimo 6
caracteres) dos veces, y queda activa al instante.

No hace falta ningún script SQL para esto — es puro código.

---

## 🆕 Ícono en la pantalla de inicio (iOS y Android)

Cualquier socio puede agregar un ícono de la app a su celular, para
abrirla directo sin pasar por el navegador cada vez. Es una acción que
hace cada persona desde su propio teléfono — no hay nada que instalar
"desde la aplicación".

**En iPhone / iPad (Safari):**
1. Abre el enlace de la aplicación en **Safari** (tiene que ser Safari, no Chrome — en iOS solo Safari puede hacer esto).
2. Toca el botón de **Compartir** (el cuadrado con la flecha hacia arriba), en la barra inferior.
3. Baja y toca **"Agregar a inicio"** (Add to Home Screen).
4. Confirma el nombre (por defecto dice "Fraternidad") y toca **"Agregar"**.
5. Aparece un ícono nuevo en la pantalla de inicio — al tocarlo, abre la app a pantalla completa, sin la barra de direcciones de Safari.

**En Android (Chrome):**
1. Abre el enlace de la aplicación en **Chrome**.
2. Toca el menú de **tres puntos** (arriba a la derecha).
3. Toca **"Instalar aplicación"** o **"Agregar a pantalla de inicio"** (el texto exacto varía un poco según la versión de Chrome).
4. Confirma — aparece el ícono, y se abre como una app independiente.

Ya preparé el ícono (mismo diseño que el favicon: fondo verde tintero,
"F" dorada) y la configuración necesaria para que ambos casos funcionen
bien — sin esto, "Agregar a inicio" igual funciona, pero deja una
captura de pantalla genérica en vez de un ícono propio, y abre dentro
del navegador en vez de a pantalla completa.

**Una limitación a tener en cuenta:** el nombre que se ve bajo el ícono
(y el que se le sugiere a cada socio al agregarlo) sale de un archivo
fijo, no del nombre editable de Configuración anual. Si cambias el
nombre de la fraternidad ahí, los íconos que la gente ya agregó a su
pantalla de inicio van a seguir mostrando el nombre anterior debajo —
solo se actualiza para quien lo agregue de nuevo después de que
despliegues un cambio al archivo `public/manifest.webmanifest` (y a
`apple-mobile-web-app-title` en `index.html`) con el nombre nuevo.

---

## 🆕 Corrección: "Activar acceso" fallaba con "Email address ... is invalid"

Esto tuvo dos intentos — el primero (usar `example.com`) no fue suficiente, así que va la explicación completa.

Supabase no solo revisa que el correo tenga buen formato: también valida
que el dominio pueda recibir correo de verdad (existe un registro
técnico llamado "MX" que indica eso). El dominio inventado
(`temporal.fraternidad`) fallaba por eso, y `example.com` **también**
falla — aunque es un dominio real y reservado, deliberadamente no tiene
esa configuración de correo.

**La corrección definitiva:** el correo temporal ahora se genera como
`<celular>@gmail.com` — Gmail sí tiene esa configuración, así que el
formato pasa la validación de Supabase sin problema.

**Importante:** esa dirección `@gmail.com` nunca es una casilla de
correo real que controle la fraternidad ni el socio — es solo un
formato que Supabase acepta. Nunca se envía nada ahí porque la
confirmación de correo está desactivada al crear la cuenta. Por eso,
mientras un socio no haya completado su "primer ingreso" (o mientras no
le hayas puesto su correo real), **nunca uses "Enviar enlace de
restablecimiento"** para ese socio — iría a un `@gmail.com` que no le
pertenece. Una vez que el socio registra su correo real (en su primer
ingreso, o si tú se lo cambias directamente), ya no hay ningún riesgo:
los enlaces van a su correo real.

No hace falta ningún script SQL para esto — es puro código.

---

## 🆕 Corrección: un bloque que fallaba abandonaba el resto silenciosamente

El arreglo anterior (escribir en bloques) hizo la importación mucho más
rápida, pero tenía una falla: si UN bloque de 500 filas fallaba por
cualquier motivo, el código completo se detenía ahí — los bloques
siguientes nunca se llegaban a intentar, y en pantalla solo quedaba un
mensaje de error genérico entre docenas de otros, fácil de pasar por
alto.

**La corrección:**
- Un bloque que falla **ya no detiene a los demás** — cada bloque se
  intenta de forma independiente, y al final ves exactamente cuántas
  filas entraron y cuántas no, con el motivo.
- Las obligaciones mensuales ahora se cargan con una función dentro de
  la propia base de datos (`importar_obligaciones_mensuales`, instalada
  por `08_importacion_robusta.sql`) que inserta la obligación y su
  movimiento correspondiente **en una sola operación**, y descarta las
  que ya existían usando la propia base de datos en vez de consultarlo
  primero desde el navegador — más rápido y sin los límites de tamaño de
  consulta que podían fallar con archivos grandes.

---

## 🆕 Corrección importante: los datos no faltaban, se estaban leyendo incompletos

Esta es la causa real de que las obligaciones y pagos mensuales
parecieran incompletos, y probablemente **tus datos ya estaban bien
guardados** — el problema era de lectura, no de importación.

**La causa:** Supabase nunca devuelve más de 1000 filas en una sola
consulta (es un límite de seguridad por defecto de su API), sin avisar
que recortó el resultado. La aplicación pedía "todos los movimientos
mensuales" en una sola consulta — con más de 1000 filas en total entre
todos los socios (en tu caso, cerca de 4.370: 3999 obligaciones + 371
pagos), Supabase silenciosamente devolvía solo las primeras 1000,
ordenadas por fecha — es decir, únicamente las más antiguas. Por eso el
corte caía siempre en la misma fecha, sin importar qué corrigiera en la
importación: el dato faltante nunca fue un problema de guardado, sino
de lectura.

Las demás tablas (gastos, ingresos institucionales, aportes
patrimoniales, aportes voluntarios) se veían completas porque, en tu
caso, cada una tiene menos de 1000 filas — nunca llegaron a tropezar con
el límite.

**La corrección:** toda consulta que pide "todo" ahora pide los datos en
páginas de 1000 y las junta, así nunca queda nada afuera sin importar
cuántas filas haya. No hace falta ningún script SQL — es puramente un
cambio de cómo la aplicación lee los datos.

Si después de desplegar esto todavía faltara algo, **ahí sí** sería una
señal de que realmente no se terminó de guardar en la importación (y no
un problema de lectura) — pero antes de volver a importar nada, primero
actualiza el código y revisa si ya aparece todo.

---

## 🆕 Credenciales temporales y primer ingreso

Ya no hace falta conocer el correo real de cada socio para registrarlo.

**Al crear un socio** (manual o por Excel), si dejas el correo vacío:
- Se genera automáticamente un correo temporal a partir de su celular:
  `<celular>@gmail.com`.
- Si tampoco conoces su celular real, puedes inventar un número
  correlativo único (ej. `70000001`, `70000002`, `70000003`…) — solo
  tiene que no repetirse. El correo temporal saldría entonces
  `70000001@gmail.com`.
- Ese socio queda marcado como "Primer ingreso pendiente" (se ve en la
  tabla de Socios).

**Lo que le compartes al socio:** su correo temporal + la contraseña
(por defecto `123456`, salvo que hayas puesto otra al crearlo) y el
enlace de la aplicación.

**En su primer ingreso:**
1. Entra con el correo temporal y la contraseña que le diste.
2. Antes de poder usar el resto del sistema, una pantalla obligatoria le
   pide su **correo real** y una **contraseña nueva** (definida por él).
3. La contraseña queda activa al instante.
4. El correo queda pendiente de confirmación: Supabase le envía un
   enlace a su correo real. Mientras no lo confirme, sigue pudiendo usar
   el sistema con normalidad (con la contraseña ya nueva) — el enlace
   solo termina de "mudar" su acceso a ese correo real.

No se necesita ningún servidor adicional para esto: todo corre con las
reglas de seguridad de la base de datos (cada socio solo puede tocar su
propio correo, nunca su rol, estado u otros datos).

---

## 🆕 Corrección: la importación masiva fallaba por un límite de Supabase

Si importaste muchos socios de una vez y viste errores como **"email rate
limit exceeded"** (y en cascada, "no se encontró ningún socio con
celular..." en Aportes), no era un error de la aplicación: es que
Supabase, sin un proveedor de correo propio configurado, solo deja crear
un puñado de cuentas de acceso por hora (documentado oficialmente en 2 por
hora con el correo integrado, o 30/hora si configuras tu propio SMTP) —
y cada intento de crear una cuenta cuenta contra ese límite, aunque no
llegue a enviarse ningún correo de verdad. Como antes la importación
creaba una cuenta de acceso por cada socio, con cientos de socios el
límite se alcanzaba casi de inmediato y todo lo demás fallaba en cadena.

**La corrección:** ahora importar desde Excel **nunca crea cuentas de
acceso** — solo crea los registros de los socios (instantáneo, sin
límite alguno). Cada socio importado queda con la etiqueta **"Sin
acceso"** en la tabla de Socios. Cuando quieras darle acceso a alguno
(cuando esté listo para usar el sistema), entra a **Socios → Gestionar
→ Crear acceso** y créaselo ahí, de a uno — puedes dejar el correo vacío
para generarle uno temporal (mismo mecanismo de siempre: él define su
correo real y su contraseña en su primer ingreso).

Si necesitas activar accesos más rápido que de a uno por vez, la forma
correcta es configurar un proveedor de correo propio en Supabase
(Authentication → Settings → SMTP Settings) — con eso el límite sube a
30 cuentas por hora en vez de 2.

No hace falta ejecutar ningún script SQL para esta corrección — la
columna que vincula al socio con su cuenta de acceso ya admitía quedar
vacía, así que solo cambió el código.

---

## 🆕 Corrección: la importación quedaba a medias en archivos grandes

Si notaste que a algunos socios les faltaban meses o pagos después de
importar (y esto le pasaba a **todos** los socios, siempre cortado más
o menos en la misma fecha), tampoco era un error de datos: la
importación procesaba **una fila a la vez**, cada una con su propia
llamada a internet. Con un archivo de miles de filas eso podía tardar
muchos minutos — y si el navegador quedaba en segundo plano, la
computadora entraba en reposo, o había un corte de red en el medio, el
proceso se detenía ahí mismo, sin ningún aviso de error, dejando todo lo
anterior a esa fila cargado y todo lo posterior sin cargar.

**La corrección:** ahora la importación arma todo en memoria primero
(validando cada fila) y recién al final escribe todo **en bloques** —
unas pocas llamadas a internet en vez de miles. Una importación que
antes podía tardar 20-30 minutos ahora toma unos segundos, lo que hace
prácticamente imposible que quede interrumpida a la mitad.

De paso, esto también resuelve el error "column
obligaciones_mensuales_generadas.id does not exist" que viste antes —
esa consulta puntual también se reescribió como parte de este cambio.

---

## 🆕 Correcciones al menú lateral

**1. El menú no se podía usar en el celular** — se corrigió un problema
de superposición (z-index): el fondo oscuro que aparece detrás del menú
desplegable tenía prioridad de dibujo más alta que el menú mismo, así que
cualquier toque terminaba interactuando con ese fondo invisible (que solo
cierra el menú) en vez de con la opción tocada. En pantallas grandes no
pasaba porque ahí el menú está siempre fijo, sin ese fondo superpuesto.

**2. Nombre de la fraternidad editable** — en **Configuración anual**
(solo súper administrador) hay ahora una sección "Nombre de la
fraternidad": lo que se escriba ahí reemplaza el texto "Fraternidad" en
el menú lateral y en la pantalla de ingreso, para todos los usuarios.

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
5.c. Ejecutar `supabase/04_cambios.sql` (fecha de nacimiento, nuevos
   estados de socio, rol Supervisor, ingresos institucionales).
5.d. Ejecutar `supabase/05_turno.sql` (campo Turno del socio).
5.e. Ejecutar `supabase/06_nombre_fraternidad.sql` (nombre editable).
5.f. Ejecutar `supabase/07_primer_ingreso.sql` (credenciales temporales)
   y desactivar "Secure email change" en Authentication → Providers →
   Email.
5.g. Ejecutar `supabase/08_importacion_robusta.sql` (importación de
   Excel más confiable).
5.h. Ejecutar `supabase/09_saldo_caja_qr.sql` (nuevo — historial de
   cuotas y Pagos con QR) y crear el bucket privado `qr-pagos` en
   Storage.

**En Netlify:**
6. Pegar esas dos claves como variables de entorno (o en un archivo `.env`
   si vas a compilar en tu computadora).
7. Publicar la carpeta `dist` (o conectar tu repositorio de GitHub).

Y listo — la aplicación queda funcionando con tu propia base de datos.

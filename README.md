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
   (Socio / Administrador / Súper administrador) y, si quieres, una
   contraseña para esa persona; si la dejas en blanco, será `123456` y se
   recomienda que la cambien luego con "Enviar enlace de restablecimiento".
4. Desde **Configuración anual**, define la cuota mensual del año y genera
   las mensualidades para todos los socios activos.
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

**En Netlify:**
6. Pegar esas dos claves como variables de entorno (o en un archivo `.env`
   si vas a compilar en tu computadora).
7. Publicar la carpeta `dist` (o conectar tu repositorio de GitHub).

Y listo — la aplicación queda funcionando con tu propia base de datos.

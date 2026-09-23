# Registro de Actualizaciones - CONDONIS

Este documento registra todos los cambios realizados en el proyecto.

---

## Fase 1 - Cimientos
**Fecha:** 24 de septiembre de 2026  
**Versión:** FASE-1-V1.0-2026-09-24

### Archivos Creados:

#### 1. SQL Completo (Tablas + RLS + RPCs)
- **Propósito:** Crear estructura de base de datos completa con políticas de seguridad
- **Contenido:**
  - 15 tablas principales (profiles, role_details, agencies, video_calls, show_offers, messages, conversations, user_blocks, call_ratings, token_transactions, kyc_documents, app_settings, agency_payments, model_payouts, show_offer_responses)
  - Row Level Security (RLS) habilitado en todas las tablas
  - Políticas de acceso granulares por rol (cliente, modelo, admin, agencia)
  - 12 funciones RPC principales:
    - `is_admin()` - Verifica si el usuario es administrador
    - `get_active_models()` - Obtiene modelos activos y en línea
    - `start_call_with_status()` - Inicia videollamada con verificación de bloqueo
    - `accept_call()` - Modelo acepta llamada
    - `tick_call()` - Actualiza tiempo y costo de llamada cada segundo
    - `end_call()` - Finaliza llamada y libera usuarios
    - `block_user()` / `unblock_user()` - Sistema de bloqueos
    - `is_blocked_between()` - Verifica bloqueo bidireccional
    - `create_agency()` - Crea agencia (solo admin)
    - `assign_model_to_agency()` - Asigna modelo a agencia (solo admin)
    - `get_agency_report()` - Genera reporte de ganancias por agencia
    - `register_agency_payment()` / `register_model_payout()` - Sistema de pagos
  - Trigger automático para crear perfil al registrarse
- **Verificación:** Ejecutar el script completo en SQL Editor de Supabase. No debe haber errores. Verificar que todas las tablas y funciones se crearon correctamente.

#### 2. js/config.js
- **Propósito:** Configuración global y credenciales de Supabase
- **Contenido:**
  - Credenciales de Supabase (URL + anon key) incrustadas
  - Cliente Supabase global (`window.supabase`)
  - Configuración de ICE Servers para WebRTC (solo STUN públicos gratuitos)
  - Constantes globales de la aplicación (`window.CND_CONFIG`)
  - Marcador de build (`window.CND_BUILD = 'FASE-1-V1.0-2026-09-24'`)
- **Verificación:** Abrir consola del navegador y ejecutar `window.CND_BUILD`. Debe mostrar "FASE-1-V1.0-2026-09-24". Ejecutar `window.supabase` debe mostrar la instancia del cliente.

#### 3. index.html
- **Propósito:** Página de login/registro con TyC y Privacidad
- **Contenido:**
  - Diseño oscuro profesional sin emojis
  - Formulario de inicio de sesión
  - Formulario de registro con selección de rol (cliente/modelo)
  - Checkbox de aceptación de Términos y Condiciones
  - Checkbox de mayoría de edad (solo para modelos)
  - Modales con texto completo de TyC y Política de Privacidad en español
  - Responsive mobile-first
  - Tipografías: Space Grotesk (títulos) + Inter (cuerpo)
  - Paleta de colores: fondo #0B0F17, acentos cian (#00D4FF) y magenta (#FF006E)
- **Verificación:** 
  - Abrir index.html en navegador
  - Cambiar entre tabs de login/registro
  - Verificar que los modales de TyC y Privacidad se abren y cierran correctamente
  - Intentar registrarse sin aceptar TyC (debe mostrar error)
  - Registrarse como modelo sin marcar mayoría de edad (debe mostrar error)
  - Registrarse con datos válidos (debe redirigir a app.html)

#### 4. app.html
- **Propósito:** Shell principal de la aplicación (SPA)
- **Contenido:**
  - Header con logo y balance de tokens
  - Secciones principales: Home (modelos), Perfil, Historial, Admin
  - Bottom navigation con iconos SVG
  - Sistema de toasts para notificaciones
  - Contenedores vacíos para cargar contenido dinámico
  - Diseño responsive
- **Verificación:**
  - Acceder después de login
  - Verificar que se muestra el header con balance "0 tokens"
  - Navegar entre secciones usando bottom-nav
  - Verificar que la sección Admin solo aparece para usuarios admin

#### 5. js/core.js
- **Propósito:** Lógica central de la aplicación
- **Contenido:**
  - Estado global (`window.appState`)
  - `initApp()` - Inicializa aplicación y verifica sesión
  - `loadUserProfile()` - Carga perfil desde Supabase
  - `updateUserUI()` - Actualiza interfaz con datos del usuario
  - `setupUIForRole()` - Configura UI según rol
  - `startPresenceSystem()` - Inicia heartbeat de presencia (modelos)
  - `updatePresence()` - Actualiza estado online/offline
  - `setupRealtimeSubscriptions()` - Suscripciones a cambios en tiempo real
  - `handleProfileUpdate()` - Maneja actualizaciones de perfiles
  - `showSection()` - Navegación SPA entre secciones
  - `loadSectionContent()` - Carga contenido específico de cada sección
  - `showToast()` - Sistema de notificaciones
  - `logout()` - Cierra sesión
- **Verificación:**
  - Abrir consola después de login
  - Ejecutar `window.appState.currentUser` (debe mostrar usuario)
  - Verificar que el heartbeat actualiza `last_seen` cada 20s (solo modelos)
  - Cerrar sesión y verificar redirección a index.html

#### 6. js/auth.js
- **Propósito:** Lógica de autenticación
- **Contenido:**
  - `initAuth()` - Inicializa sistema de autenticación
  - `checkExistingSession()` - Verifica sesión existente
  - `setupAuthTabs()` - Cambio entre login/registro
  - `setupLoginForm()` - Manejo de login
  - `setupRegisterForm()` - Manejo de registro con validaciones
  - `setupModals()` - Modales de TyC y Privacidad
  - `closeModal()` - Cierra modales
  - `showAlert()` / `hideAlert()` - Mensajes de alerta
- **Verificación:**
  - Login con credenciales inválidas (debe mostrar error)
  - Login con credenciales válidas (debe redirigir a app.html)
  - Registro con email duplicado (debe mostrar error)
  - Registro exitoso (debe crear usuario y redirigir)

### Archivos NO Modificados:
- Ninguno (primera entrega)

### Notas Técnicas:
- Todos los archivos SQL son idempotentes (seguros para ejecutar múltiples veces)
- Comentarios en español en todo el código
- Cero emojis en la interfaz (solo SVG inline)
- Variables globales en `window.*` para evitar colisiones
- Un solo script JS por HTML (sin duplicados)
- Diseño oscuro profesional con paleta cian/magenta
- RLS estricto en todas las tablas
- Trigger automático crea perfil al registrarse
- Sistema de presencia con heartbeat cada 20s
- Realtime configurado para actualizaciones de perfiles

### Próximos Pasos:
- **Fase 2:** Implementar listado de modelos, perfiles, galería y sistema de presencia completo
- **Verificación de Fase 1:** El dueño debe confirmar que:
  1. Puede registrarse como cliente
  2. Puede registrarse como modelo
  3. Puede iniciar sesión con ambos tipos de cuenta
  4. Ve el shell principal después del login
  5. Puede navegar entre secciones
  6. Puede cerrar sesión

---

*Este archivo se actualiza en cada entrega. Nunca se borra historial.*


# Registro de Actualizaciones - CONDONIS

Este documento registra todos los cambios realizados en el proyecto.

---

## Fase 1 - Cimientos
**Fecha:** 24 de septiembre de 2026  
**Versión:** FASE-1-V1.0-2026-09-24

### Archivos Creados:

#### 1. SQL Completo (Tablas + RLS + RPCs)
- **Propósito:** Crear estructura de base de datos completa con políticas de seguridad
- **Contenido:**
  - 15 tablas principales (profiles, role_details, agencies, video_calls, show_offers, messages, conversations, user_blocks, call_ratings, token_transactions, kyc_documents, app_settings, agency_payments, model_payouts, show_offer_responses)
  - Row Level Security (RLS) habilitado en todas las tablas
  - Políticas de acceso granulares por rol (cliente, modelo, admin, agencia)
  - 12 funciones RPC principales:
    - `is_admin()` - Verifica si el usuario es administrador
    - `get_active_models()` - Obtiene modelos activos y en línea
    - `start_call_with_status()` - Inicia videollamada con verificación de bloqueo
    - `accept_call()` - Modelo acepta llamada
    - `tick_call()` - Actualiza tiempo y costo de llamada cada segundo
    - `end_call()` - Finaliza llamada y libera usuarios
    - `block_user()` / `unblock_user()` - Sistema de bloqueos
    - `is_blocked_between()` - Verifica bloqueo bidireccional
    - `create_agency()` - Crea agencia (solo admin)
    - `assign_model_to_agency()` - Asigna modelo a agencia (solo admin)
    - `get_agency_report()` - Genera reporte de ganancias por agencia
    - `register_agency_payment()` / `register_model_payout()` - Sistema de pagos
  - Trigger automático para crear perfil al registrarse
- **Verificación:** Ejecutar el script completo en SQL Editor de Supabase. No debe haber errores. Verificar que todas las tablas y funciones se crearon correctamente.

#### 2. js/config.js
- **Propósito:** Configuración global y credenciales de Supabase
- **Contenido:**
  - Credenciales de Supabase (URL + anon key) incrustadas
  - Cliente Supabase global (`window.supabase`)
  - Configuración de ICE Servers para WebRTC (solo STUN públicos gratuitos)
  - Constantes globales de la aplicación (`window.CND_CONFIG`)
  - Marcador de build (`window.CND_BUILD = 'FASE-1-V1.0-2026-09-24'`)
- **Verificación:** Abrir consola del navegador y ejecutar `window.CND_BUILD`. Debe mostrar "FASE-1-V1.0-2026-09-24". Ejecutar `window.supabase` debe mostrar la instancia del cliente.

#### 3. index.html
- **Propósito:** Página de login/registro con TyC y Privacidad
- **Contenido:**
  - Diseño oscuro profesional sin emojis
  - Formulario de inicio de sesión
  - Formulario de registro con selección de rol (cliente/modelo)
  - Checkbox de aceptación de Términos y Condiciones
  - Checkbox de mayoría de edad (solo para modelos)
  - Modales con texto completo de TyC y Política de Privacidad en español
  - Responsive mobile-first
  - Tipografías: Space Grotesk (títulos) + Inter (cuerpo)
  - Paleta de colores: fondo #0B0F17, acentos cian (#00D4FF) y magenta (#FF006E)
- **Verificación:** 
  - Abrir index.html en navegador
  - Cambiar entre tabs de login/registro
  - Verificar que los modales de TyC y Privacidad se abren y cierran correctamente
  - Intentar registrarse sin aceptar TyC (debe mostrar error)
  - Registrarse como modelo sin marcar mayoría de edad (debe mostrar error)
  - Registrarse con datos válidos (debe redirigir a app.html)

#### 4. app.html
- **Propósito:** Shell principal de la aplicación (SPA)
- **Contenido:**
  - Header con logo y balance de tokens
  - Secciones principales: Home (modelos), Perfil, Historial, Admin
  - Bottom navigation con iconos SVG
  - Sistema de toasts para notificaciones
  - Contenedores vacíos para cargar contenido dinámico
  - Diseño responsive
- **Verificación:**
  - Acceder después de login
  - Verificar que se muestra el header con balance "0 tokens"
  - Navegar entre secciones usando bottom-nav
  - Verificar que la sección Admin solo aparece para usuarios admin

#### 5. js/core.js
- **Propósito:** Lógica central de la aplicación
- **Contenido:**
  - Estado global (`window.appState`)
  - `initApp()` - Inicializa aplicación y verifica sesión
  - `loadUserProfile()` - Carga perfil desde Supabase
  - `updateUserUI()` - Actualiza interfaz con datos del usuario
  - `setupUIForRole()` - Configura UI según rol
  - `startPresenceSystem()` - Inicia heartbeat de presencia (modelos)
  - `updatePresence()` - Actualiza estado online/offline
  - `setupRealtimeSubscriptions()` - Suscripciones a cambios en tiempo real
  - `handleProfileUpdate()` - Maneja actualizaciones de perfiles
  - `showSection()` - Navegación SPA entre secciones
  - `loadSectionContent()` - Carga contenido específico de cada sección
  - `showToast()` - Sistema de notificaciones
  - `logout()` - Cierra sesión
- **Verificación:**
  - Abrir consola después de login
  - Ejecutar `window.appState.currentUser` (debe mostrar usuario)
  - Verificar que el heartbeat actualiza `last_seen` cada 20s (solo modelos)
  - Cerrar sesión y verificar redirección a index.html

#### 6. js/auth.js
- **Propósito:** Lógica de autenticación
- **Contenido:**
  - `initAuth()` - Inicializa sistema de autenticación
  - `checkExistingSession()` - Verifica sesión existente
  - `setupAuthTabs()` - Cambio entre login/registro
  - `setupLoginForm()` - Manejo de login
  - `setupRegisterForm()` - Manejo de registro con validaciones
  - `setupModals()` - Modales de TyC y Privacidad
  - `closeModal()` - Cierra modales
  - `showAlert()` / `hideAlert()` - Mensajes de alerta
- **Verificación:**
  - Login con credenciales inválidas (debe mostrar error)
  - Login con credenciales válidas (debe redirigir a app.html)
  - Registro con email duplicado (debe mostrar error)
  - Registro exitoso (debe crear usuario y redirigir)

### Archivos NO Modificados:
- Ninguno (primera entrega)

### Notas Técnicas:
- Todos los archivos SQL son idempotentes (seguros para ejecutar múltiples veces)
- Comentarios en español en todo el código
- Cero emojis en la interfaz (solo SVG inline)
- Variables globales en `window.*` para evitar colisiones
- Un solo script JS por HTML (sin duplicados)
- Diseño oscuro profesional con paleta cian/magenta
- RLS estricto en todas las tablas
- Trigger automático crea perfil al registrarse
- Sistema de presencia con heartbeat cada 20s
- Realtime configurado para actualizaciones de perfiles

### Próximos Pasos:
- **Fase 2:** Implementar listado de modelos, perfiles, galería y sistema de presencia completo

---

## HOTFIX Fase 1 - V1.1 (registro roto corregido)
**Fecha:** 24 de septiembre de 2026  
**Versión:** FASE-1-V1.1-2026-09-24

### Problema reportado por el dueño:
- Registro devolvía HTTP 500 en `/auth/v1/signup` con mensaje
  "Database error saving new user" (AuthRetryableFetchError).
- 404 de `assets/logo.svg` (favicon inexistente).
- app.html cargaba scripts inexistentes (models.js, profile.js, admin.js).

### Causa raíz identificada:
- El trigger `handle_new_user()` estaba creado SIN `SET search_path = public`
  y SIN nombres calificados (`public.profiles`). La sesión interna de Auth de
  Supabase no resolvía las tablas y abortaba la transacción de registro.

### Archivos tocados:

#### 1. SQL V1.1 (script completo re-entregado)
- **Funciones modificadas:** `handle_new_user()` ahora usa
  `SECURITY DEFINER SET search_path = public` + tablas calificadas `public.*`
  + inserciones idempotentes (`ON CONFLICT DO NOTHING/UPDATE`) + saneamiento
  de rol y nombre.
- **Función modificada:** `get_active_models()` ahora es `SECURITY DEFINER`
  (necesario para leer `role_details` de todas las modelos bajo RLS).
- **Añadido:** curación de columnas (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)
  para profiles y role_details por si el script V1.0 quedó a medias.
- **Añadido:** índices de rendimiento (presencia, llamadas, transacciones,
  ofertas, mensajes).
- **Añadido:** función de diagnóstico `public.verify_schema()`.
- **Recreado:** trigger `on_auth_user_created` (DROP + CREATE limpio).
- **Verificación:** ejecutar `SELECT public.verify_schema();` → todos los
  valores deben ser `true`. Luego registrar un usuario nuevo: debe crear
  auth.users + profiles + role_details sin error 500.

#### 2. assets/logo.svg (NUEVO)
- **Propósito:** eliminar el 404 del favicon y servir de logo base (regla D5).
- **Verificación:** recargar index.html; el 404 de logo.svg desaparece y se ve
  el icono en la pestaña.

#### 3. js/config.js (re-entregado completo)
- **Línea modificada:** `window.CND_BUILD = 'FASE-1-V1.1-2026-09-24'`.
- **Verificación:** consola → `window.CND_BUILD` muestra el nuevo tag.

#### 4. index.html (re-entregado completo)
- **Corregido:** caracteres intrusos en el punto 8 de los TyC.
- **Verificación:** abrir modal de TyC y leer el punto 8 sin caracteres raros.

#### 5. js/auth.js (re-entregado completo)
- **Añadido:** manejo del caso "confirmación de email activada" (si no hay
  sesión tras signUp, muestra mensaje de verificar correo en vez de redirigir
  a app.html y quedar en bucle).
- **Añadido:** detección de email duplicado (identities vacío).
- **Añadido:** mensajes amigables para credenciales inválidas y correo no
  confirmado.
- **Verificación:** registrarse con email nuevo → o entra directo (confirmación
  desactivada) o muestra mensaje de confirmar correo (confirmación activada).

#### 6. app.html (re-entregado completo)
- **Eliminado:** script tags de models.js, profile.js y admin.js (aún no
  existen; se reincorporarán en sus fases correspondientes, regla R10).
- **Añadido:** estilos de filas de información del perfil.
- **Verificación:** consola sin 404 de scripts; navegación funciona.

#### 7. js/core.js (re-entregado completo)
- **Añadido:** `renderProfileSection()` autocontenido (muestra nombre, correo,
  rol, saldo, retenido y KYC en la sección Perfil).
- **Añadido:** placeholders informativos para Historial y Admin.
- **Añadido:** listener `pagehide` para marcar offline (regla P3).
- **Corregido:** `setupUIForRole()` no duplica el botón Admin (regla A12).
- **Verificación:** entrar a Perfil muestra los datos propios; cerrar sesión
  funciona; sin errores rojos en consola.

### Cómo verificar el hotfix completo (checklist):
1. Ejecutar SQL V1.1 completo en SQL Editor → sin errores.
2. `SELECT public.verify_schema();` → todo `true`.
3. Recargar index.html → sin 404 de logo.svg.
4. Consola → `window.CND_BUILD` = 'FASE-1-V1.1-2026-09-24'.
5. Registrar cliente nuevo → éxito (o mensaje de confirmar correo).
6. Registrar modelo nuevo → éxito (o mensaje de confirmar correo).
7. Login con ambas cuentas → entra a app.html.
8. Sección Perfil muestra datos; cerrar sesión vuelve a index.html.

### Nota sobre confirmación de correo:
Si Supabase tiene "Confirm email" ACTIVADO (Dashboard → Authentication →
Sign In / Up → Email), el registro mostrará el mensaje de verificar correo y
habrá que confirmar desde la bandeja de entrada antes del login. Para pruebas
rápidas puede DESACTIVARSE temporalmente esa opción; el código ya maneja ambos
casos correctamente.

---

*Este archivo se actualiza en cada entrega. Nunca se borra historial.*

# Registro de Actualizaciones - CONDONIS

Este documento registra todos los cambios realizados en el proyecto.

---

## Fase 1 - Cimientos
**Fecha:** 24 de septiembre de 2026  
**Versión:** FASE-1-V1.0-2026-09-24

### Archivos Creados:

#### 1. SQL Completo (Tablas + RLS + RPCs)
- **Propósito:** Crear estructura de base de datos completa con políticas de seguridad
- **Contenido:**
  - 15 tablas principales (profiles, role_details, agencies, video_calls, show_offers, messages, conversations, user_blocks, call_ratings, token_transactions, kyc_documents, app_settings, agency_payments, model_payouts, show_offer_responses)
  - Row Level Security (RLS) habilitado en todas las tablas
  - Políticas de acceso granulares por rol (cliente, modelo, admin, agencia)
  - 12 funciones RPC principales:
    - `is_admin()` - Verifica si el usuario es administrador
    - `get_active_models()` - Obtiene modelos activos y en línea
    - `start_call_with_status()` - Inicia videollamada con verificación de bloqueo
    - `accept_call()` - Modelo acepta llamada
    - `tick_call()` - Actualiza tiempo y costo de llamada cada segundo
    - `end_call()` - Finaliza llamada y libera usuarios
    - `block_user()` / `unblock_user()` - Sistema de bloqueos
    - `is_blocked_between()` - Verifica bloqueo bidireccional
    - `create_agency()` - Crea agencia (solo admin)
    - `assign_model_to_agency()` - Asigna modelo a agencia (solo admin)
    - `get_agency_report()` - Genera reporte de ganancias por agencia
    - `register_agency_payment()` / `register_model_payout()` - Sistema de pagos
  - Trigger automático para crear perfil al registrarse
- **Verificación:** Ejecutar el script completo en SQL Editor de Supabase. No debe haber errores. Verificar que todas las tablas y funciones se crearon correctamente.

#### 2. js/config.js
- **Propósito:** Configuración global y credenciales de Supabase
- **Contenido:**
  - Credenciales de Supabase (URL + anon key) incrustadas
  - Cliente Supabase global (`window.supabase`)
  - Configuración de ICE Servers para WebRTC (solo STUN públicos gratuitos)
  - Constantes globales de la aplicación (`window.CND_CONFIG`)
  - Marcador de build (`window.CND_BUILD = 'FASE-1-V1.0-2026-09-24'`)
- **Verificación:** Abrir consola del navegador y ejecutar `window.CND_BUILD`. Debe mostrar "FASE-1-V1.0-2026-09-24". Ejecutar `window.supabase` debe mostrar la instancia del cliente.

#### 3. index.html
- **Propósito:** Página de login/registro con TyC y Privacidad
- **Contenido:**
  - Diseño oscuro profesional sin emojis
  - Formulario de inicio de sesión
  - Formulario de registro con selección de rol (cliente/modelo)
  - Checkbox de aceptación de Términos y Condiciones
  - Checkbox de mayoría de edad (solo para modelos)
  - Modales con texto completo de TyC y Política de Privacidad en español
  - Responsive mobile-first
  - Tipografías: Space Grotesk (títulos) + Inter (cuerpo)
  - Paleta de colores: fondo #0B0F17, acentos cian (#00D4FF) y magenta (#FF006E)
- **Verificación:** 
  - Abrir index.html en navegador
  - Cambiar entre tabs de login/registro
  - Verificar que los modales de TyC y Privacidad se abren y cierran correctamente
  - Intentar registrarse sin aceptar TyC (debe mostrar error)
  - Registrarse como modelo sin marcar mayoría de edad (debe mostrar error)
  - Registrarse con datos válidos (debe redirigir a app.html)

#### 4. app.html
- **Propósito:** Shell principal de la aplicación (SPA)
- **Contenido:**
  - Header con logo y balance de tokens
  - Secciones principales: Home (modelos), Perfil, Historial, Admin
  - Bottom navigation con iconos SVG
  - Sistema de toasts para notificaciones
  - Contenedores vacíos para cargar contenido dinámico
  - Diseño responsive
- **Verificación:**
  - Acceder después de login
  - Verificar que se muestra el header con balance "0 tokens"
  - Navegar entre secciones usando bottom-nav
  - Verificar que la sección Admin solo aparece para usuarios admin

#### 5. js/core.js
- **Propósito:** Lógica central de la aplicación
- **Contenido:**
  - Estado global (`window.appState`)
  - `initApp()` - Inicializa aplicación y verifica sesión
  - `loadUserProfile()` - Carga perfil desde Supabase
  - `updateUserUI()` - Actualiza interfaz con datos del usuario
  - `setupUIForRole()` - Configura UI según rol
  - `startPresenceSystem()` - Inicia heartbeat de presencia (modelos)
  - `updatePresence()` - Actualiza estado online/offline
  - `setupRealtimeSubscriptions()` - Suscripciones a cambios en tiempo real
  - `handleProfileUpdate()` - Maneja actualizaciones de perfiles
  - `showSection()` - Navegación SPA entre secciones
  - `loadSectionContent()` - Carga contenido específico de cada sección
  - `showToast()` - Sistema de notificaciones
  - `logout()` - Cierra sesión
- **Verificación:**
  - Abrir consola después de login
  - Ejecutar `window.appState.currentUser` (debe mostrar usuario)
  - Verificar que el heartbeat actualiza `last_seen` cada 20s (solo modelos)
  - Cerrar sesión y verificar redirección a index.html

#### 6. js/auth.js
- **Propósito:** Lógica de autenticación
- **Contenido:**
  - `initAuth()` - Inicializa sistema de autenticación
  - `checkExistingSession()` - Verifica sesión existente
  - `setupAuthTabs()` - Cambio entre login/registro
  - `setupLoginForm()` - Manejo de login
  - `setupRegisterForm()` - Manejo de registro con validaciones
  - `setupModals()` - Modales de TyC y Privacidad
  - `closeModal()` - Cierra modales
  - `showAlert()` / `hideAlert()` - Mensajes de alerta
- **Verificación:**
  - Login con credenciales inválidas (debe mostrar error)
  - Login con credenciales válidas (debe redirigir a app.html)
  - Registro con email duplicado (debe mostrar error)
  - Registro exitoso (debe crear usuario y redirigir)

### Archivos NO Modificados:
- Ninguno (primera entrega)

### Notas Técnicas:
- Todos los archivos SQL son idempotentes (seguros para ejecutar múltiples veces)
- Comentarios en español en todo el código
- Cero emojis en la interfaz (solo SVG inline)
- Variables globales en `window.*` para evitar colisiones
- Un solo script JS por HTML (sin duplicados)
- Diseño oscuro profesional con paleta cian/magenta
- RLS estricto en todas las tablas
- Trigger automático crea perfil al registrarse
- Sistema de presencia con heartbeat cada 20s
- Realtime configurado para actualizaciones de perfiles

### Próximos Pasos:
- **Fase 2:** Implementar listado de modelos, perfiles, galería y sistema de presencia completo

---

## HOTFIX Fase 1 - V1.1 (registro roto corregido)
**Fecha:** 24 de septiembre de 2026  
**Versión:** FASE-1-V1.1-2026-09-24

### Problema reportado por el dueño:
- Registro devolvía HTTP 500 en `/auth/v1/signup` con mensaje
  "Database error saving new user" (AuthRetryableFetchError).
- 404 de `assets/logo.svg` (favicon inexistente).
- app.html cargaba scripts inexistentes (models.js, profile.js, admin.js).

### Causa raíz identificada:
- El trigger `handle_new_user()` estaba creado SIN `SET search_path = public`
  y SIN nombres calificados (`public.profiles`). La sesión interna de Auth de
  Supabase no resolvía las tablas y abortaba la transacción de registro.

### Archivos tocados:

#### 1. SQL V1.1 (script completo re-entregado)
- **Funciones modificadas:** `handle_new_user()` ahora usa
  `SECURITY DEFINER SET search_path = public` + tablas calificadas `public.*`
  + inserciones idempotentes (`ON CONFLICT DO NOTHING/UPDATE`) + saneamiento
  de rol y nombre.
- **Función modificada:** `get_active_models()` ahora es `SECURITY DEFINER`
  (necesario para leer `role_details` de todas las modelos bajo RLS).
- **Añadido:** curación de columnas (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)
  para profiles y role_details por si el script V1.0 quedó a medias.
- **Añadido:** índices de rendimiento (presencia, llamadas, transacciones,
  ofertas, mensajes).
- **Añadido:** función de diagnóstico `public.verify_schema()`.
- **Recreado:** trigger `on_auth_user_created` (DROP + CREATE limpio).
- **Verificación:** ejecutar `SELECT public.verify_schema();` → todos los
  valores deben ser `true`. Luego registrar un usuario nuevo: debe crear
  auth.users + profiles + role_details sin error 500.

#### 2. assets/logo.svg (NUEVO)
- **Propósito:** eliminar el 404 del favicon y servir de logo base (regla D5).
- **Verificación:** recargar index.html; el 404 de logo.svg desaparece y se ve
  el icono en la pestaña.

#### 3. js/config.js (re-entregado completo)
- **Línea modificada:** `window.CND_BUILD = 'FASE-1-V1.1-2026-09-24'`.
- **Verificación:** consola → `window.CND_BUILD` muestra el nuevo tag.

#### 4. index.html (re-entregado completo)
- **Corregido:** caracteres intrusos en el punto 8 de los TyC.
- **Verificación:** abrir modal de TyC y leer el punto 8 sin caracteres raros.

#### 5. js/auth.js (re-entregado completo)
- **Añadido:** manejo del caso "confirmación de email activada" (si no hay
  sesión tras signUp, muestra mensaje de verificar correo en vez de redirigir
  a app.html y quedar en bucle).
- **Añadido:** detección de email duplicado (identities vacío).
- **Añadido:** mensajes amigables para credenciales inválidas y correo no
  confirmado.
- **Verificación:** registrarse con email nuevo → o entra directo (confirmación
  desactivada) o muestra mensaje de confirmar correo (confirmación activada).

#### 6. app.html (re-entregado completo)
- **Eliminado:** script tags de models.js, profile.js y admin.js (aún no
  existen; se reincorporarán en sus fases correspondientes, regla R10).
- **Añadido:** estilos de filas de información del perfil.
- **Verificación:** consola sin 404 de scripts; navegación funciona.

#### 7. js/core.js (re-entregado completo)
- **Añadido:** `renderProfileSection()` autocontenido (muestra nombre, correo,
  rol, saldo, retenido y KYC en la sección Perfil).
- **Añadido:** placeholders informativos para Historial y Admin.
- **Añadido:** listener `pagehide` para marcar offline (regla P3).
- **Corregido:** `setupUIForRole()` no duplica el botón Admin (regla A12).
- **Verificación:** entrar a Perfil muestra los datos propios; cerrar sesión
  funciona; sin errores rojos en consola.

### Cómo verificar el hotfix completo (checklist):
1. Ejecutar SQL V1.1 completo en SQL Editor → sin errores.
2. `SELECT public.verify_schema();` → todo `true`.
3. Recargar index.html → sin 404 de logo.svg.
4. Consola → `window.CND_BUILD` = 'FASE-1-V1.1-2026-09-24'.
5. Registrar cliente nuevo → éxito (o mensaje de confirmar correo).
6. Registrar modelo nuevo → éxito (o mensaje de confirmar correo).
7. Login con ambas cuentas → entra a app.html.
8. Sección Perfil muestra datos; cerrar sesión vuelve a index.html.

### Nota sobre confirmación de correo:
Si Supabase tiene "Confirm email" ACTIVADO (Dashboard → Authentication →
Sign In / Up → Email), el registro mostrará el mensaje de verificar correo y
habrá que confirmar desde la bandeja de entrada antes del login. Para pruebas
rápidas puede DESACTIVARSE temporalmente esa opción; el código ya maneja ambos
casos correctamente.

---

## V1.2 - Verificación de correo profesional (OTP + página confirm.html)
**Fecha:** 24 de septiembre de 2026  
**Versión:** FASE-1-V1.2-2026-09-24

### Problema reportado por el dueño:
- El enlace de confirmación del correo redirigía a `localhost:3000`
  (Site URL por defecto de Supabase), página inexistente para el dueño.
- Se solicitó verificación por código OTP sin servicios externos de pago.

### Solución implementada (doble mecanismo, 100% plan gratuito):
1. **OTP de 6 dígitos** en el propio index.html: la plantilla de correo de
   Supabase mostraría `{{ .Token }}` y la app verificaría con
   `supabase.auth.verifyOtp({ type: 'signup' })`.
2. **confirm.html** propia y profesional para el enlace de respaldo: se
   registró como Redirect URL en Supabase y se pasa `emailRedirectTo` desde
   el registro, por lo que el enlace ya nunca cae en localhost.

### Configuración externa realizada por el dueño (Dashboard Supabase):
- Authentication → URL Configuration:
  - Site URL = `https://ferminprioridadprofesional-cmyk.github.io/condonis/`
  - Redirect URLs += `https://ferminprioridadprofesional-cmyk.github.io/condonis/confirm.html`
- Authentication → Email Templates → Confirm signup:
  - Subject = `CONDONIS - Tu codigo de verificacion`
  - Cuerpo reemplazado por plantilla HTML con `{{ .Token }}` y
    `{{ .ConfirmationURL }}`.

### Archivos tocados:

#### 1. confirm.html (NUEVO)
- **Propósito:** página de confirmación de correo con tres estados
  (verificando / confirmado / error), check SVG animado, sacudida de error,
  cuenta regresiva de 5s y redirección a app.html. Sin emojis (regla D1).
- **Verificación:** abrir el enlace del correo → ver check animado y entrada
  automática a app.html; abrir confirm.html sin tokens → estado de error
  amigable con botón de volver.

#### 2. js/confirm.js (NUEVO)
- **Funciones:** `setState()`, `cleanUrl()`, `showSuccess()`, `showError()`,
  `initConfirm()`, `irAlApp()`, `irAlLogin()`.
- **Detalles:** lee `#error` del hash, escucha `onAuthStateChange`
  (SIGNED_IN / INITIAL_SESSION), timeout de seguridad de 3s, limpia tokens
  del hash con `history.replaceState`, resuelve una sola vez (regla A12).
- **Verificación:** consola sin errores; estados conmutan correctamente.

#### 3. index.html (re-entregado completo)
- **Añadido:** sección `#otpSection` con 6 cajas `.otp-box`, alerta propia,
  botón verificar, enlaces Reenviar código y Volver al registro.
- **Añadido:** estilos `.otp-inputs`, `.otp-box`, `.otp-links`.
- **Verificación:** tras registrarse aparece la pantalla de código; las cajas
  avanzan solas, aceptan pegado de 6 dígitos y retroceden con Backspace.

#### 4. js/auth.js (re-entregado completo)
- **Añadido:** `window.authPendingEmail`, `showOtpSection()`,
  `clearOtpBoxes()`, `collectOtp()`, `setupOtpSection()`, `verifyOtpCode()`,
  `resendCode()`, `showOtpAlert()`, `hideOtpAlert()`.
- **Modificado:** `setupRegisterForm()` ahora pasa `emailRedirectTo`
  apuntando a confirm.html y muestra la sección OTP si no hay sesión.
- **Modificado:** mensaje de login para correo no confirmado guía a pedir un
  código nuevo desde el registro.
- **Verificación:** registro → OTP correcto entra a app.html; OTP erróneo
  muestra mensaje claro; Reenviar código genera correo nuevo.

#### 5. js/config.js (re-entregado completo)
- **Línea modificada:** `window.CND_BUILD = 'FASE-1-V1.2-2026-09-24'`.
- **Verificación:** consola → `window.CND_BUILD` muestra el nuevo tag.

### Archivos NO tocados en V1.2:
- app.html, js/core.js, SQL (sin cambios necesarios; regla R10).

### Checklist de verificación V1.2:
1. Dashboard: Site URL y Redirect URL guardados; plantilla de correo pegada.
2. Commit y push de confirm.html, js/confirm.js, index.html, js/auth.js,
   js/config.js.
3. Consola: `window.CND_BUILD` = 'FASE-1-V1.2-2026-09-24'.
4. Registrar un correo NUEVO → aparece pantalla de 6 cajas.
5. Llegan correo con código de 6 dígitos y enlace de respaldo.
6. Escribir código → entra a app.html (cuenta verificada).
7. Probar también el enlace del correo → abre confirm.html con check animado
   y redirige a app.html (nunca más localhost).
8. Cuenta pendiente anterior (ferminram24@gmail.com): ir a Registrarse con
   esos mismos datos → recibe código nuevo → verificar → entra.
9. Cero errores rojos en consola en todo el flujo.

### Nota de límites del plan gratuito:
El proveedor de correo integrado de Supabase tiene límites anti-spam por hora
(suficientes para desarrollo y pruebas). Para producción masiva se configurará
SMTP propio más adelante, sin cambiar nada del código.

---

## V1.3 - Confirmación SOLO por enlace (OTP retirado por limitación del plan Free)
**Fecha:** 24 de septiembre de 2026  
**Versión:** FASE-1-V1.3-2026-09-24

### Motivo del cambio:
Desde mediados de 2026, en el plan Free de Supabase los campos Subject y Body
de las plantillas de correo quedan BLOQUEADOS con el mailer integrado; la
personalización solo se desbloquea configurando un SMTP propio. Sin plantilla
personalizable no hay forma de mostrar `{{ .Token }}` al usuario, por lo que
el flujo OTP quedó inviable. Se decide continuar SOLO con el flujo de enlace
de confirmación + confirm.html, 100% compatible con el plan Free.

### Archivos tocados:

#### 1. index.html (re-entregado completo)
- **Eliminado:** sección OTP completa (`#otpSection`, cajas, estilos
  `.otp-inputs/.otp-box/.otp-links`) por quedar muerta sin plantilla propia.
- **Añadido:** enlace `#resendConfirmationLink` bajo el botón de login
  ("¿No confirmaste tu correo? Reenviar enlace") y estilo `.link-row`.
- **Verificación:** el login muestra el enlace de reenvío; ya no existen
  cajas OTP en el DOM.

#### 2. js/auth.js (re-entregado completo)
- **Eliminado:** todo el bloque OTP (`window.authPendingEmail`,
  `showOtpSection`, `clearOtpBoxes`, `collectOtp`, `setupOtpSection`,
  `verifyOtpCode`, `resendCode`, `showOtpAlert`, `hideOtpAlert`).
- **Añadido:** `switchTab()` reutilizable y `setupResendConfirmation()` que
  usa `supabase.auth.resend({ type: 'signup', email })` con el correo del
  campo de login.
- **Modificado:** registro sin sesión → mensaje de "revisa tu bandeja y abre
  el enlace", prellenado del login con el correo y salto a la pestaña login.
- **Modificado:** duplicado (identities vacío) → mensaje guía + prellenado +
  salto a login en lugar de bloqueo seco.
- **Mantenido:** `emailRedirectTo` hacia confirm.html en signUp.
- **Verificación:** registro nuevo → mensaje claro y login prellenado;
  cuenta pendiente → Reenviar enlace genera correo nuevo; el enlace abre
  confirm.html.

#### 3. js/config.js (re-entregado completo)
- **Línea modificada:** `window.CND_BUILD = 'FASE-1-V1.3-2026-09-24'`.
- **Verificación:** consola → `window.CND_BUILD` muestra el nuevo tag.

### Archivos NO tocados en V1.3 (siguen vigentes de V1.2):
- confirm.html, js/confirm.js, app.html, js/core.js, SQL.

### Configuración requerida en Dashboard (sin tocar plantillas):
- Authentication → URL Configuration:
  - Site URL = `https://ferminprioridadprofesional-cmyk.github.io/condonis/`
  - Redirect URLs += `https://ferminprioridadprofesional-cmyk.github.io/condonis/confirm.html`
- Authentication → Providers → Email: Confirm email ACTIVADO.
- Email Templates: NO tocar (bloqueadas en Free; ya no se necesitan).

### Checklist de verificación V1.3:
1. URLs guardadas en Dashboard (Site URL + Redirect URL).
2. Commit y push de index.html, js/auth.js, js/config.js.
3. Consola: `window.CND_BUILD` = 'FASE-1-V1.3-2026-09-24'.
4. Registro con correo nuevo → mensaje de "revisa tu bandeja" y login
   prellenado con el correo.
5. Abrir el enlace del correo → confirm.html con check animado → app.html.
6. Login inmediato tras confirmar → entra sin errores.
7. Cuenta pendiente (ferminram24@gmail.com): escribir el correo en login y
   pulsar "Reenviar enlace" → llega correo nuevo → abrir enlace → confirmar →
   login exitoso.
8. Cero errores rojos en consola en todo el flujo.

---

*Este archivo se actualiza en cada entrega. Nunca se borra historial.*

# Registro de Actualizaciones - CONDONIS

Este documento registra todos los cambios realizados en el proyecto.

---

## Fase 1 - Cimientos
**Fecha:** 24 de septiembre de 2026  
**Versión:** FASE-1-V1.0-2026-09-24

### Archivos Creados:

#### 1. SQL Completo (Tablas + RLS + RPCs)
- **Propósito:** Crear estructura de base de datos completa con políticas de seguridad
- **Contenido:**
  - 15 tablas principales (profiles, role_details, agencies, video_calls, show_offers, messages, conversations, user_blocks, call_ratings, token_transactions, kyc_documents, app_settings, agency_payments, model_payouts, show_offer_responses)
  - Row Level Security (RLS) habilitado en todas las tablas
  - Políticas de acceso granulares por rol (cliente, modelo, admin, agencia)
  - 12 funciones RPC principales:
    - `is_admin()` - Verifica si el usuario es administrador
    - `get_active_models()` - Obtiene modelos activos y en línea
    - `start_call_with_status()` - Inicia videollamada con verificación de bloqueo
    - `accept_call()` - Modelo acepta llamada
    - `tick_call()` - Actualiza tiempo y costo de llamada cada segundo
    - `end_call()` - Finaliza llamada y libera usuarios
    - `block_user()` / `unblock_user()` - Sistema de bloqueos
    - `is_blocked_between()` - Verifica bloqueo bidireccional
    - `create_agency()` - Crea agencia (solo admin)
    - `assign_model_to_agency()` - Asigna modelo a agencia (solo admin)
    - `get_agency_report()` - Genera reporte de ganancias por agencia
    - `register_agency_payment()` / `register_model_payout()` - Sistema de pagos
  - Trigger automático para crear perfil al registrarse
- **Verificación:** Ejecutar el script completo en SQL Editor de Supabase. No debe haber errores. Verificar que todas las tablas y funciones se crearon correctamente.

#### 2. js/config.js
- **Propósito:** Configuración global y credenciales de Supabase
- **Contenido:**
  - Credenciales de Supabase (URL + anon key) incrustadas
  - Cliente Supabase global (`window.supabase`)
  - Configuración de ICE Servers para WebRTC (solo STUN públicos gratuitos)
  - Constantes globales de la aplicación (`window.CND_CONFIG`)
  - Marcador de build (`window.CND_BUILD = 'FASE-1-V1.0-2026-09-24'`)
- **Verificación:** Abrir consola del navegador y ejecutar `window.CND_BUILD`. Debe mostrar "FASE-1-V1.0-2026-09-24". Ejecutar `window.supabase` debe mostrar la instancia del cliente.

#### 3. index.html
- **Propósito:** Página de login/registro con TyC y Privacidad
- **Contenido:**
  - Diseño oscuro profesional sin emojis
  - Formulario de inicio de sesión
  - Formulario de registro con selección de rol (cliente/modelo)
  - Checkbox de aceptación de Términos y Condiciones
  - Checkbox de mayoría de edad (solo para modelos)
  - Modales con texto completo de TyC y Política de Privacidad en español
  - Responsive mobile-first
  - Tipografías: Space Grotesk (títulos) + Inter (cuerpo)
  - Paleta de colores: fondo #0B0F17, acentos cian (#00D4FF) y magenta (#FF006E)
- **Verificación:** 
  - Abrir index.html en navegador
  - Cambiar entre tabs de login/registro
  - Verificar que los modales de TyC y Privacidad se abren y cierran correctamente
  - Intentar registrarse sin aceptar TyC (debe mostrar error)
  - Registrarse como modelo sin marcar mayoría de edad (debe mostrar error)
  - Registrarse con datos válidos (debe redirigir a app.html)

#### 4. app.html
- **Propósito:** Shell principal de la aplicación (SPA)
- **Contenido:**
  - Header con logo y balance de tokens
  - Secciones principales: Home (modelos), Perfil, Historial, Admin
  - Bottom navigation con iconos SVG
  - Sistema de toasts para notificaciones
  - Contenedores vacíos para cargar contenido dinámico
  - Diseño responsive
- **Verificación:**
  - Acceder después de login
  - Verificar que se muestra el header con balance "0 tokens"
  - Navegar entre secciones usando bottom-nav
  - Verificar que la sección Admin solo aparece para usuarios admin

#### 5. js/core.js
- **Propósito:** Lógica central de la aplicación
- **Contenido:**
  - Estado global (`window.appState`)
  - `initApp()` - Inicializa aplicación y verifica sesión
  - `loadUserProfile()` - Carga perfil desde Supabase
  - `updateUserUI()` - Actualiza interfaz con datos del usuario
  - `setupUIForRole()` - Configura UI según rol
  - `startPresenceSystem()` - Inicia heartbeat de presencia (modelos)
  - `updatePresence()` - Actualiza estado online/offline
  - `setupRealtimeSubscriptions()` - Suscripciones a cambios en tiempo real
  - `handleProfileUpdate()` - Maneja actualizaciones de perfiles
  - `showSection()` - Navegación SPA entre secciones
  - `loadSectionContent()` - Carga contenido específico de cada sección
  - `showToast()` - Sistema de notificaciones
  - `logout()` - Cierra sesión
- **Verificación:**
  - Abrir consola después de login
  - Ejecutar `window.appState.currentUser` (debe mostrar usuario)
  - Verificar que el heartbeat actualiza `last_seen` cada 20s (solo modelos)
  - Cerrar sesión y verificar redirección a index.html

#### 6. js/auth.js
- **Propósito:** Lógica de autenticación
- **Contenido:**
  - `initAuth()` - Inicializa sistema de autenticación
  - `checkExistingSession()` - Verifica sesión existente
  - `setupAuthTabs()` - Cambio entre login/registro
  - `setupLoginForm()` - Manejo de login
  - `setupRegisterForm()` - Manejo de registro con validaciones
  - `setupModals()` - Modales de TyC y Privacidad
  - `closeModal()` - Cierra modales
  - `showAlert()` / `hideAlert()` - Mensajes de alerta
- **Verificación:**
  - Login con credenciales inválidas (debe mostrar error)
  - Login con credenciales válidas (debe redirigir a app.html)
  - Registro con email duplicado (debe mostrar error)
  - Registro exitoso (debe crear usuario y redirigir)

### Archivos NO Modificados:
- Ninguno (primera entrega)

### Notas Técnicas:
- Todos los archivos SQL son idempotentes (seguros para ejecutar múltiples veces)
- Comentarios en español en todo el código
- Cero emojis en la interfaz (solo SVG inline)
- Variables globales en `window.*` para evitar colisiones
- Un solo script JS por HTML (sin duplicados)
- Diseño oscuro profesional con paleta cian/magenta
- RLS estricto en todas las tablas
- Trigger automático crea perfil al registrarse
- Sistema de presencia con heartbeat cada 20s
- Realtime configurado para actualizaciones de perfiles

### Próximos Pasos:
- **Fase 2:** Implementar listado de modelos, perfiles, galería y sistema de presencia completo

---

## HOTFIX Fase 1 - V1.1 (registro roto corregido)
**Fecha:** 24 de septiembre de 2026  
**Versión:** FASE-1-V1.1-2026-09-24

### Problema reportado por el dueño:
- Registro devolvía HTTP 500 en `/auth/v1/signup` con mensaje
  "Database error saving new user" (AuthRetryableFetchError).
- 404 de `assets/logo.svg` (favicon inexistente).
- app.html cargaba scripts inexistentes (models.js, profile.js, admin.js).

### Causa raíz identificada:
- El trigger `handle_new_user()` estaba creado SIN `SET search_path = public`
  y SIN nombres calificados (`public.profiles`). La sesión interna de Auth de
  Supabase no resolvía las tablas y abortaba la transacción de registro.

### Archivos tocados:

#### 1. SQL V1.1 (script completo re-entregado)
- **Funciones modificadas:** `handle_new_user()` ahora usa
  `SECURITY DEFINER SET search_path = public` + tablas calificadas `public.*`
  + inserciones idempotentes (`ON CONFLICT DO NOTHING/UPDATE`) + saneamiento
  de rol y nombre.
- **Función modificada:** `get_active_models()` ahora es `SECURITY DEFINER`
  (necesario para leer `role_details` de todas las modelos bajo RLS).
- **Añadido:** curación de columnas (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)
  para profiles y role_details por si el script V1.0 quedó a medias.
- **Añadido:** índices de rendimiento (presencia, llamadas, transacciones,
  ofertas, mensajes).
- **Añadido:** función de diagnóstico `public.verify_schema()`.
- **Recreado:** trigger `on_auth_user_created` (DROP + CREATE limpio).
- **Verificación:** ejecutar `SELECT public.verify_schema();` → todos los
  valores deben ser `true`. Luego registrar un usuario nuevo: debe crear
  auth.users + profiles + role_details sin error 500.

#### 2. assets/logo.svg (NUEVO)
- **Propósito:** eliminar el 404 del favicon y servir de logo base (regla D5).
- **Verificación:** recargar index.html; el 404 de logo.svg desaparece y se ve
  el icono en la pestaña.

#### 3. js/config.js (re-entregado completo)
- **Línea modificada:** `window.CND_BUILD = 'FASE-1-V1.1-2026-09-24'`.
- **Verificación:** consola → `window.CND_BUILD` muestra el nuevo tag.

#### 4. index.html (re-entregado completo)
- **Corregido:** caracteres intrusos en el punto 8 de los TyC.
- **Verificación:** abrir modal de TyC y leer el punto 8 sin caracteres raros.

#### 5. js/auth.js (re-entregado completo)
- **Añadido:** manejo del caso "confirmación de email activada" (si no hay
  sesión tras signUp, muestra mensaje de verificar correo en vez de redirigir
  a app.html y quedar en bucle).
- **Añadido:** detección de email duplicado (identities vacío).
- **Añadido:** mensajes amigables para credenciales inválidas y correo no
  confirmado.
- **Verificación:** registrarse con email nuevo → o entra directo (confirmación
  desactivada) o muestra mensaje de confirmar correo (confirmación activada).

#### 6. app.html (re-entregado completo)
- **Eliminado:** script tags de models.js, profile.js y admin.js (aún no
  existen; se reincorporarán en sus fases correspondientes, regla R10).
- **Añadido:** estilos de filas de información del perfil.
- **Verificación:** consola sin 404 de scripts; navegación funciona.

#### 7. js/core.js (re-entregado completo)
- **Añadido:** `renderProfileSection()` autocontenido (muestra nombre, correo,
  rol, saldo, retenido y KYC en la sección Perfil).
- **Añadido:** placeholders informativos para Historial y Admin.
- **Añadido:** listener `pagehide` para marcar offline (regla P3).
- **Corregido:** `setupUIForRole()` no duplica el botón Admin (regla A12).
- **Verificación:** entrar a Perfil muestra los datos propios; cerrar sesión
  funciona; sin errores rojos en consola.

### Cómo verificar el hotfix completo (checklist):
1. Ejecutar SQL V1.1 completo en SQL Editor → sin errores.
2. `SELECT public.verify_schema();` → todo `true`.
3. Recargar index.html → sin 404 de logo.svg.
4. Consola → `window.CND_BUILD` = 'FASE-1-V1.1-2026-09-24'.
5. Registrar cliente nuevo → éxito (o mensaje de confirmar correo).
6. Registrar modelo nuevo → éxito (o mensaje de confirmar correo).
7. Login con ambas cuentas → entra a app.html.
8. Sección Perfil muestra datos; cerrar sesión vuelve a index.html.

### Nota sobre confirmación de correo:
Si Supabase tiene "Confirm email" ACTIVADO (Dashboard → Authentication →
Sign In / Up → Email), el registro mostrará el mensaje de verificar correo y
habrá que confirmar desde la bandeja de entrada antes del login. Para pruebas
rápidas puede DESACTIVARSE temporalmente esa opción; el código ya maneja ambos
casos correctamente.

---

## V1.2 - Verificación de correo profesional (OTP + página confirm.html)
**Fecha:** 24 de septiembre de 2026  
**Versión:** FASE-1-V1.2-2026-09-24

### Problema reportado por el dueño:
- El enlace de confirmación del correo redirigía a `localhost:3000`
  (Site URL por defecto de Supabase), página inexistente para el dueño.
- Se solicitó verificación por código OTP sin servicios externos de pago.

### Solución implementada (doble mecanismo, 100% plan gratuito):
1. **OTP de 6 dígitos** en el propio index.html: la plantilla de correo de
   Supabase mostraría `{{ .Token }}` y la app verificaría con
   `supabase.auth.verifyOtp({ type: 'signup' })`.
2. **confirm.html** propia y profesional para el enlace de respaldo: se
   registró como Redirect URL en Supabase y se pasa `emailRedirectTo` desde
   el registro, por lo que el enlace ya nunca cae en localhost.

### Configuración externa realizada por el dueño (Dashboard Supabase):
- Authentication → URL Configuration:
  - Site URL = `https://ferminprioridadprofesional-cmyk.github.io/condonis/`
  - Redirect URLs += `https://ferminprioridadprofesional-cmyk.github.io/condonis/confirm.html`
- Authentication → Email Templates → Confirm signup:
  - Subject = `CONDONIS - Tu codigo de verificacion`
  - Cuerpo reemplazado por plantilla HTML con `{{ .Token }}` y
    `{{ .ConfirmationURL }}`.

### Archivos tocados:

#### 1. confirm.html (NUEVO)
- **Propósito:** página de confirmación de correo con tres estados
  (verificando / confirmado / error), check SVG animado, sacudida de error,
  cuenta regresiva de 5s y redirección a app.html. Sin emojis (regla D1).
- **Verificación:** abrir el enlace del correo → ver check animado y entrada
  automática a app.html; abrir confirm.html sin tokens → estado de error
  amigable con botón de volver.

#### 2. js/confirm.js (NUEVO)
- **Funciones:** `setState()`, `cleanUrl()`, `showSuccess()`, `showError()`,
  `initConfirm()`, `irAlApp()`, `irAlLogin()`.
- **Detalles:** lee `#error` del hash, escucha `onAuthStateChange`
  (SIGNED_IN / INITIAL_SESSION), timeout de seguridad de 3s, limpia tokens
  del hash con `history.replaceState`, resuelve una sola vez (regla A12).
- **Verificación:** consola sin errores; estados conmutan correctamente.

#### 3. index.html (re-entregado completo)
- **Añadido:** sección `#otpSection` con 6 cajas `.otp-box`, alerta propia,
  botón verificar, enlaces Reenviar código y Volver al registro.
- **Añadido:** estilos `.otp-inputs`, `.otp-box`, `.otp-links`.
- **Verificación:** tras registrarse aparece la pantalla de código; las cajas
  avanzan solas, aceptan pegado de 6 dígitos y retroceden con Backspace.

#### 4. js/auth.js (re-entregado completo)
- **Añadido:** `window.authPendingEmail`, `showOtpSection()`,
  `clearOtpBoxes()`, `collectOtp()`, `setupOtpSection()`, `verifyOtpCode()`,
  `resendCode()`, `showOtpAlert()`, `hideOtpAlert()`.
- **Modificado:** `setupRegisterForm()` ahora pasa `emailRedirectTo`
  apuntando a confirm.html y muestra la sección OTP si no hay sesión.
- **Modificado:** mensaje de login para correo no confirmado guía a pedir un
  código nuevo desde el registro.
- **Verificación:** registro → OTP correcto entra a app.html; OTP erróneo
  muestra mensaje claro; Reenviar código genera correo nuevo.

#### 5. js/config.js (re-entregado completo)
- **Línea modificada:** `window.CND_BUILD = 'FASE-1-V1.2-2026-09-24'`.
- **Verificación:** consola → `window.CND_BUILD` muestra el nuevo tag.

### Archivos NO tocados en V1.2:
- app.html, js/core.js, SQL (sin cambios necesarios; regla R10).

### Checklist de verificación V1.2:
1. Dashboard: Site URL y Redirect URL guardados; plantilla de correo pegada.
2. Commit y push de confirm.html, js/confirm.js, index.html, js/auth.js,
   js/config.js.
3. Consola: `window.CND_BUILD` = 'FASE-1-V1.2-2026-09-24'.
4. Registrar un correo NUEVO → aparece pantalla de 6 cajas.
5. Llegan correo con código de 6 dígitos y enlace de respaldo.
6. Escribir código → entra a app.html (cuenta verificada).
7. Probar también el enlace del correo → abre confirm.html con check animado
   y redirige a app.html (nunca más localhost).
8. Cuenta pendiente anterior (ferminram24@gmail.com): ir a Registrarse con
   esos mismos datos → recibe código nuevo → verificar → entra.
9. Cero errores rojos en consola en todo el flujo.

### Nota de límites del plan gratuito:
El proveedor de correo integrado de Supabase tiene límites anti-spam por hora
(suficientes para desarrollo y pruebas). Para producción masiva se configurará
SMTP propio más adelante, sin cambiar nada del código.

---

## V1.3 - Confirmación SOLO por enlace (OTP retirado por limitación del plan Free)
**Fecha:** 24 de septiembre de 2026  
**Versión:** FASE-1-V1.3-2026-09-24

### Motivo del cambio:
Desde mediados de 2026, en el plan Free de Supabase los campos Subject y Body
de las plantillas de correo quedan BLOQUEADOS con el mailer integrado; la
personalización solo se desbloquea configurando un SMTP propio. Sin plantilla
personalizable no hay forma de mostrar `{{ .Token }}` al usuario, por lo que
el flujo OTP quedó inviable. Se decide continuar SOLO con el flujo de enlace
de confirmación + confirm.html, 100% compatible con el plan Free.

### Archivos tocados:

#### 1. index.html (re-entregado completo)
- **Eliminado:** sección OTP completa (`#otpSection`, cajas, estilos
  `.otp-inputs/.otp-box/.otp-links`) por quedar muerta sin plantilla propia.
- **Añadido:** enlace `#resendConfirmationLink` bajo el botón de login
  ("¿No confirmaste tu correo? Reenviar enlace") y estilo `.link-row`.
- **Verificación:** el login muestra el enlace de reenvío; ya no existen
  cajas OTP en el DOM.

#### 2. js/auth.js (re-entregado completo)
- **Eliminado:** todo el bloque OTP (`window.authPendingEmail`,
  `showOtpSection`, `clearOtpBoxes`, `collectOtp`, `setupOtpSection`,
  `verifyOtpCode`, `resendCode`, `showOtpAlert`, `hideOtpAlert`).
- **Añadido:** `switchTab()` reutilizable y `setupResendConfirmation()` que
  usa `supabase.auth.resend({ type: 'signup', email })` con el correo del
  campo de login.
- **Modificado:** registro sin sesión → mensaje de "revisa tu bandeja y abre
  el enlace", prellenado del login con el correo y salto a la pestaña login.
- **Modificado:** duplicado (identities vacío) → mensaje guía + prellenado +
  salto a login en lugar de bloqueo seco.
- **Mantenido:** `emailRedirectTo` hacia confirm.html en signUp.
- **Verificación:** registro nuevo → mensaje claro y login prellenado;
  cuenta pendiente → Reenviar enlace genera correo nuevo; el enlace abre
  confirm.html.

#### 3. js/config.js (re-entregado completo)
- **Línea modificada:** `window.CND_BUILD = 'FASE-1-V1.3-2026-09-24'`.
- **Verificación:** consola → `window.CND_BUILD` muestra el nuevo tag.

### Archivos NO tocados en V1.3 (siguen vigentes de V1.2):
- confirm.html, js/confirm.js, app.html, js/core.js, SQL.

### Configuración requerida en Dashboard (sin tocar plantillas):
- Authentication → URL Configuration:
  - Site URL = `https://ferminprioridadprofesional-cmyk.github.io/condonis/`
  - Redirect URLs += `https://ferminprioridadprofesional-cmyk.github.io/condonis/confirm.html`
- Authentication → Providers → Email: Confirm email ACTIVADO.
- Email Templates: NO tocar (bloqueadas en Free; ya no se necesitan).

### Checklist de verificación V1.3:
1. URLs guardadas en Dashboard (Site URL + Redirect URL).
2. Commit y push de index.html, js/auth.js, js/config.js.
3. Consola: `window.CND_BUILD` = 'FASE-1-V1.3-2026-09-24'.
4. Registro con correo nuevo → mensaje de "revisa tu bandeja" y login
   prellenado con el correo.
5. Abrir el enlace del correo → confirm.html con check animado → app.html.
6. Login inmediato tras confirmar → entra sin errores.
7. Cuenta pendiente (ferminram24@gmail.com): escribir el correo en login y
   pulsar "Reenviar enlace" → llega correo nuevo → abrir enlace → confirmar →
   login exitoso.
8. Cero errores rojos en consola en todo el flujo.

---

## V1.3.2 - Reparación de recursión RLS (42P17) y archivos faltantes
**Fecha:** 24 de septiembre de 2026  
**Versión:** FASE-1-V1.3.2-2026-09-24

### Problemas reportados por el dueño:
1. 404 "File not found" al abrir el enlace de confirmación: los archivos
   `confirm.html` y `js/confirm.js` nunca se crearon en el repositorio.
2. Al iniciar sesión (cliente y modelo): GET /profiles 500 con
   `{code: 42P17, message: "infinite recursion detected in policy for
   relation \"profiles\""}` y toast "Error al cargar tu perfil".

### Causa raíz del 42P17:
Las políticas RLS de `profiles` (y de otras tablas) usaban subconsultas
`EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = ...)`
dentro de sus propias condiciones. Al evaluar la política sobre `profiles`,
la subconsulta vuelve a pasar por RLS de `profiles`, que re-evalúa la misma
política: recursión infinita que Postgres aborta con error 42P17.

### Solución aplicada (SQL V1.3.2, script completo e idempotente):
- **Funciones auxiliares nuevas (SECURITY DEFINER, bypassean RLS):**
  - `public.has_role(p_role TEXT)` → bool
  - `public.my_owned_agency_id()` → uuid o NULL
  - `public.is_admin()` re-entregada (ya era DEFINER, se mantiene)
- **Políticas de profiles reescritas** usando `is_admin()`,
  `has_role('client')` y `my_owned_agency_id()` en lugar de subconsultas.
- **Políticas de TODAS las demás tablas reescritas** usando `is_admin()`
  (antes usaban EXISTS sobre profiles).
- **Políticas nuevas añadidas** donde faltaban: agency_payments,
  model_payouts, show_offer_responses, call_ratings; y política de UPDATE
  para admin sobre profiles (necesaria en Fase 5).
- **verify_schema() ampliada** con has_role y my_owned_agency_id.
- Tablas, datos, RPCs de negocio y trigger: SIN cambios (no se tocaron).

### Archivos tocados:
1. **SQL V1.3.2** (ejecutar una vez en SQL Editor).
2. **confirm.html** (CREADO en raíz del repo; estaba faltando).
3. **js/confirm.js** (CREADO en js/; estaba faltando).
4. **js/config.js** (re-entregado; solo build tag V1.3.2).

### Decisión registrada:
- V1.4 "Iniciar con Google" (OAuth) fue DESCARTADA por decisión del dueño
  antes de desplegarse (requería Google Cloud Console + pantalla de
  consentimiento). No se aplicó ningún cambio de ese borrador. El proyecto
  permanece con autenticación email/contraseña + confirmación por enlace.

### Checklist de verificación V1.3.2:
1. Ejecutar SQL V1.3.2 en SQL Editor → "Success".
2. `SELECT public.verify_schema();` → todo true.
3. Crear en el repo `confirm.html` (raíz) y `js/confirm.js`; commit y push.
4. Reemplazar `js/config.js`; commit y push; esperar deploy de Pages.
5. Consola: `window.CND_BUILD` = 'FASE-1-V1.3.2-2026-09-24'.
6. Login de CLIENTE y de MODELO: sin 500, sin 42P17, sin toast de error;
   el header muestra saldo y la sección Perfil pinta los datos.
7. Abrir `https://.../condonis/confirm.html` directamente: ya no da 404
   (muestra estado de error amigable si no hay tokens, es lo esperado).
8. Reenviar enlace a un correo pendiente y abrirlo: check animado y entrada
   automática a app.html.
9. Cero errores rojos en consola.

---

*Este archivo se actualiza en cada entrega. Nunca se borra historial.*

# Registro de Actualizaciones - CONDONIS

Este documento registra todos los cambios realizados en el proyecto.

---

## Fase 1 - Cimientos
**Fecha:** 24 de septiembre de 2026  
**Versión:** FASE-1-V1.0-2026-09-24

### Archivos Creados:

#### 1. SQL Completo (Tablas + RLS + RPCs)
- **Propósito:** Crear estructura de base de datos completa con políticas de seguridad
- **Contenido:**
  - 15 tablas principales (profiles, role_details, agencies, video_calls, show_offers, messages, conversations, user_blocks, call_ratings, token_transactions, kyc_documents, app_settings, agency_payments, model_payouts, show_offer_responses)
  - Row Level Security (RLS) habilitado en todas las tablas
  - Políticas de acceso granulares por rol (cliente, modelo, admin, agencia)
  - 12 funciones RPC principales:
    - `is_admin()` - Verifica si el usuario es administrador
    - `get_active_models()` - Obtiene modelos activos y en línea
    - `start_call_with_status()` - Inicia videollamada con verificación de bloqueo
    - `accept_call()` - Modelo acepta llamada
    - `tick_call()` - Actualiza tiempo y costo de llamada cada segundo
    - `end_call()` - Finaliza llamada y libera usuarios
    - `block_user()` / `unblock_user()` - Sistema de bloqueos
    - `is_blocked_between()` - Verifica bloqueo bidireccional
    - `create_agency()` - Crea agencia (solo admin)
    - `assign_model_to_agency()` - Asigna modelo a agencia (solo admin)
    - `get_agency_report()` - Genera reporte de ganancias por agencia
    - `register_agency_payment()` / `register_model_payout()` - Sistema de pagos
  - Trigger automático para crear perfil al registrarse
- **Verificación:** Ejecutar el script completo en SQL Editor de Supabase. No debe haber errores. Verificar que todas las tablas y funciones se crearon correctamente.

#### 2. js/config.js
- **Propósito:** Configuración global y credenciales de Supabase
- **Contenido:**
  - Credenciales de Supabase (URL + anon key) incrustadas
  - Cliente Supabase global (`window.supabase`)
  - Configuración de ICE Servers para WebRTC (solo STUN públicos gratuitos)
  - Constantes globales de la aplicación (`window.CND_CONFIG`)
  - Marcador de build (`window.CND_BUILD = 'FASE-1-V1.0-2026-09-24'`)
- **Verificación:** Abrir consola del navegador y ejecutar `window.CND_BUILD`. Debe mostrar "FASE-1-V1.0-2026-09-24". Ejecutar `window.supabase` debe mostrar la instancia del cliente.

#### 3. index.html
- **Propósito:** Página de login/registro con TyC y Privacidad
- **Contenido:**
  - Diseño oscuro profesional sin emojis
  - Formulario de inicio de sesión
  - Formulario de registro con selección de rol (cliente/modelo)
  - Checkbox de aceptación de Términos y Condiciones
  - Checkbox de mayoría de edad (solo para modelos)
  - Modales con texto completo de TyC y Política de Privacidad en español
  - Responsive mobile-first
  - Tipografías: Space Grotesk (títulos) + Inter (cuerpo)
  - Paleta de colores: fondo #0B0F17, acentos cian (#00D4FF) y magenta (#FF006E)
- **Verificación:** 
  - Abrir index.html en navegador
  - Cambiar entre tabs de login/registro
  - Verificar que los modales de TyC y Privacidad se abren y cierran correctamente
  - Intentar registrarse sin aceptar TyC (debe mostrar error)
  - Registrarse como modelo sin marcar mayoría de edad (debe mostrar error)
  - Registrarse con datos válidos (debe redirigir a app.html)

#### 4. app.html
- **Propósito:** Shell principal de la aplicación (SPA)
- **Contenido:**
  - Header con logo y balance de tokens
  - Secciones principales: Home (modelos), Perfil, Historial, Admin
  - Bottom navigation con iconos SVG
  - Sistema de toasts para notificaciones
  - Contenedores vacíos para cargar contenido dinámico
  - Diseño responsive
- **Verificación:**
  - Acceder después de login
  - Verificar que se muestra el header con balance "0 tokens"
  - Navegar entre secciones usando bottom-nav
  - Verificar que la sección Admin solo aparece para usuarios admin

#### 5. js/core.js
- **Propósito:** Lógica central de la aplicación
- **Contenido:**
  - Estado global (`window.appState`)
  - `initApp()` - Inicializa aplicación y verifica sesión
  - `loadUserProfile()` - Carga perfil desde Supabase
  - `updateUserUI()` - Actualiza interfaz con datos del usuario
  - `setupUIForRole()` - Configura UI según rol
  - `startPresenceSystem()` - Inicia heartbeat de presencia (modelos)
  - `updatePresence()` - Actualiza estado online/offline
  - `setupRealtimeSubscriptions()` - Suscripciones a cambios en tiempo real
  - `handleProfileUpdate()` - Maneja actualizaciones de perfiles
  - `showSection()` - Navegación SPA entre secciones
  - `loadSectionContent()` - Carga contenido específico de cada sección
  - `showToast()` - Sistema de notificaciones
  - `logout()` - Cierra sesión
- **Verificación:**
  - Abrir consola después de login
  - Ejecutar `window.appState.currentUser` (debe mostrar usuario)
  - Verificar que el heartbeat actualiza `last_seen` cada 20s (solo modelos)
  - Cerrar sesión y verificar redirección a index.html

#### 6. js/auth.js
- **Propósito:** Lógica de autenticación
- **Contenido:**
  - `initAuth()` - Inicializa sistema de autenticación
  - `checkExistingSession()` - Verifica sesión existente
  - `setupAuthTabs()` - Cambio entre login/registro
  - `setupLoginForm()` - Manejo de login
  - `setupRegisterForm()` - Manejo de registro con validaciones
  - `setupModals()` - Modales de TyC y Privacidad
  - `closeModal()` - Cierra modales
  - `showAlert()` / `hideAlert()` - Mensajes de alerta
- **Verificación:**
  - Login con credenciales inválidas (debe mostrar error)
  - Login con credenciales válidas (debe redirigir a app.html)
  - Registro con email duplicado (debe mostrar error)
  - Registro exitoso (debe crear usuario y redirigir)

### Archivos NO Modificados:
- Ninguno (primera entrega)

### Notas Técnicas:
- Todos los archivos SQL son idempotentes (seguros para ejecutar múltiples veces)
- Comentarios en español en todo el código
- Cero emojis en la interfaz (solo SVG inline)
- Variables globales en `window.*` para evitar colisiones
- Un solo script JS por HTML (sin duplicados)
- Diseño oscuro profesional con paleta cian/magenta
- RLS estricto en todas las tablas
- Trigger automático crea perfil al registrarse
- Sistema de presencia con heartbeat cada 20s
- Realtime configurado para actualizaciones de perfiles

### Próximos Pasos:
- **Fase 2:** Implementar listado de modelos, perfiles, galería y sistema de presencia completo

---

## HOTFIX Fase 1 - V1.1 (registro roto corregido)
**Fecha:** 24 de septiembre de 2026  
**Versión:** FASE-1-V1.1-2026-09-24

### Problema reportado por el dueño:
- Registro devolvía HTTP 500 en `/auth/v1/signup` con mensaje
  "Database error saving new user" (AuthRetryableFetchError).
- 404 de `assets/logo.svg` (favicon inexistente).
- app.html cargaba scripts inexistentes (models.js, profile.js, admin.js).

### Causa raíz identificada:
- El trigger `handle_new_user()` estaba creado SIN `SET search_path = public`
  y SIN nombres calificados (`public.profiles`). La sesión interna de Auth de
  Supabase no resolvía las tablas y abortaba la transacción de registro.

### Archivos tocados:

#### 1. SQL V1.1 (script completo re-entregado)
- **Funciones modificadas:** `handle_new_user()` ahora usa
  `SECURITY DEFINER SET search_path = public` + tablas calificadas `public.*`
  + inserciones idempotentes (`ON CONFLICT DO NOTHING/UPDATE`) + saneamiento
  de rol y nombre.
- **Función modificada:** `get_active_models()` ahora es `SECURITY DEFINER`
  (necesario para leer `role_details` de todas las modelos bajo RLS).
- **Añadido:** curación de columnas (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)
  para profiles y role_details por si el script V1.0 quedó a medias.
- **Añadido:** índices de rendimiento (presencia, llamadas, transacciones,
  ofertas, mensajes).
- **Añadido:** función de diagnóstico `public.verify_schema()`.
- **Recreado:** trigger `on_auth_user_created` (DROP + CREATE limpio).
- **Verificación:** ejecutar `SELECT public.verify_schema();` → todos los
  valores deben ser `true`. Luego registrar un usuario nuevo: debe crear
  auth.users + profiles + role_details sin error 500.

#### 2. assets/logo.svg (NUEVO)
- **Propósito:** eliminar el 404 del favicon y servir de logo base (regla D5).
- **Verificación:** recargar index.html; el 404 de logo.svg desaparece y se ve
  el icono en la pestaña.

#### 3. js/config.js (re-entregado completo)
- **Línea modificada:** `window.CND_BUILD = 'FASE-1-V1.1-2026-09-24'`.
- **Verificación:** consola → `window.CND_BUILD` muestra el nuevo tag.

#### 4. index.html (re-entregado completo)
- **Corregido:** caracteres intrusos en el punto 8 de los TyC.
- **Verificación:** abrir modal de TyC y leer el punto 8 sin caracteres raros.

#### 5. js/auth.js (re-entregado completo)
- **Añadido:** manejo del caso "confirmación de email activada" (si no hay
  sesión tras signUp, muestra mensaje de verificar correo en vez de redirigir
  a app.html y quedar en bucle).
- **Añadido:** detección de email duplicado (identities vacío).
- **Añadido:** mensajes amigables para credenciales inválidas y correo no
  confirmado.
- **Verificación:** registrarse con email nuevo → o entra directo (confirmación
  desactivada) o muestra mensaje de confirmar correo (confirmación activada).

#### 6. app.html (re-entregado completo)
- **Eliminado:** script tags de models.js, profile.js y admin.js (aún no
  existen; se reincorporarán en sus fases correspondientes, regla R10).
- **Añadido:** estilos de filas de información del perfil.
- **Verificación:** consola sin 404 de scripts; navegación funciona.

#### 7. js/core.js (re-entregado completo)
- **Añadido:** `renderProfileSection()` autocontenido (muestra nombre, correo,
  rol, saldo, retenido y KYC en la sección Perfil).
- **Añadido:** placeholders informativos para Historial y Admin.
- **Añadido:** listener `pagehide` para marcar offline (regla P3).
- **Corregido:** `setupUIForRole()` no duplica el botón Admin (regla A12).
- **Verificación:** entrar a Perfil muestra los datos propios; cerrar sesión
  funciona; sin errores rojos en consola.

### Cómo verificar el hotfix completo (checklist):
1. Ejecutar SQL V1.1 completo en SQL Editor → sin errores.
2. `SELECT public.verify_schema();` → todo `true`.
3. Recargar index.html → sin 404 de logo.svg.
4. Consola → `window.CND_BUILD` = 'FASE-1-V1.1-2026-09-24'.
5. Registrar cliente nuevo → éxito (o mensaje de confirmar correo).
6. Registrar modelo nuevo → éxito (o mensaje de confirmar correo).
7. Login con ambas cuentas → entra a app.html.
8. Sección Perfil muestra datos; cerrar sesión vuelve a index.html.

### Nota sobre confirmación de correo:
Si Supabase tiene "Confirm email" ACTIVADO (Dashboard → Authentication →
Sign In / Up → Email), el registro mostrará el mensaje de verificar correo y
habrá que confirmar desde la bandeja de entrada antes del login. Para pruebas
rápidas puede DESACTIVARSE temporalmente esa opción; el código ya maneja ambos
casos correctamente.

---

## V1.2 - Verificación de correo profesional (OTP + página confirm.html)
**Fecha:** 24 de septiembre de 2026  
**Versión:** FASE-1-V1.2-2026-09-24

### Problema reportado por el dueño:
- El enlace de confirmación del correo redirigía a `localhost:3000`
  (Site URL por defecto de Supabase), página inexistente para el dueño.
- Se solicitó verificación por código OTP sin servicios externos de pago.

### Solución implementada (doble mecanismo, 100% plan gratuito):
1. **OTP de 6 dígitos** en el propio index.html: la plantilla de correo de
   Supabase mostraría `{{ .Token }}` y la app verificaría con
   `supabase.auth.verifyOtp({ type: 'signup' })`.
2. **confirm.html** propia y profesional para el enlace de respaldo: se
   registró como Redirect URL en Supabase y se pasa `emailRedirectTo` desde
   el registro, por lo que el enlace ya nunca cae en localhost.

### Configuración externa realizada por el dueño (Dashboard Supabase):
- Authentication → URL Configuration:
  - Site URL = `https://ferminprioridadprofesional-cmyk.github.io/condonis/`
  - Redirect URLs += `https://ferminprioridadprofesional-cmyk.github.io/condonis/confirm.html`
- Authentication → Email Templates → Confirm signup:
  - Subject = `CONDONIS - Tu codigo de verificacion`
  - Cuerpo reemplazado por plantilla HTML con `{{ .Token }}` y
    `{{ .ConfirmationURL }}`.

### Archivos tocados:

#### 1. confirm.html (NUEVO)
- **Propósito:** página de confirmación de correo con tres estados
  (verificando / confirmado / error), check SVG animado, sacudida de error,
  cuenta regresiva de 5s y redirección a app.html. Sin emojis (regla D1).
- **Verificación:** abrir el enlace del correo → ver check animado y entrada
  automática a app.html; abrir confirm.html sin tokens → estado de error
  amigable con botón de volver.

#### 2. js/confirm.js (NUEVO)
- **Funciones:** `setState()`, `cleanUrl()`, `showSuccess()`, `showError()`,
  `initConfirm()`, `irAlApp()`, `irAlLogin()`.
- **Detalles:** lee `#error` del hash, escucha `onAuthStateChange`
  (SIGNED_IN / INITIAL_SESSION), timeout de seguridad de 3s, limpia tokens
  del hash con `history.replaceState`, resuelve una sola vez (regla A12).
- **Verificación:** consola sin errores; estados conmutan correctamente.

#### 3. index.html (re-entregado completo)
- **Añadido:** sección `#otpSection` con 6 cajas `.otp-box`, alerta propia,
  botón verificar, enlaces Reenviar código y Volver al registro.
- **Añadido:** estilos `.otp-inputs`, `.otp-box`, `.otp-links`.
- **Verificación:** tras registrarse aparece la pantalla de código; las cajas
  avanzan solas, aceptan pegado de 6 dígitos y retroceden con Backspace.

#### 4. js/auth.js (re-entregado completo)
- **Añadido:** `window.authPendingEmail`, `showOtpSection()`,
  `clearOtpBoxes()`, `collectOtp()`, `setupOtpSection()`, `verifyOtpCode()`,
  `resendCode()`, `showOtpAlert()`, `hideOtpAlert()`.
- **Modificado:** `setupRegisterForm()` ahora pasa `emailRedirectTo`
  apuntando a confirm.html y muestra la sección OTP si no hay sesión.
- **Modificado:** mensaje de login para correo no confirmado guía a pedir un
  código nuevo desde el registro.
- **Verificación:** registro → OTP correcto entra a app.html; OTP erróneo
  muestra mensaje claro; Reenviar código genera correo nuevo.

#### 5. js/config.js (re-entregado completo)
- **Línea modificada:** `window.CND_BUILD = 'FASE-1-V1.2-2026-09-24'`.
- **Verificación:** consola → `window.CND_BUILD` muestra el nuevo tag.

### Archivos NO tocados en V1.2:
- app.html, js/core.js, SQL (sin cambios necesarios; regla R10).

### Checklist de verificación V1.2:
1. Dashboard: Site URL y Redirect URL guardados; plantilla de correo pegada.
2. Commit y push de confirm.html, js/confirm.js, index.html, js/auth.js,
   js/config.js.
3. Consola: `window.CND_BUILD` = 'FASE-1-V1.2-2026-09-24'.
4. Registrar un correo NUEVO → aparece pantalla de 6 cajas.
5. Llegan correo con código de 6 dígitos y enlace de respaldo.
6. Escribir código → entra a app.html (cuenta verificada).
7. Probar también el enlace del correo → abre confirm.html con check animado
   y redirige a app.html (nunca más localhost).
8. Cuenta pendiente anterior (ferminram24@gmail.com): ir a Registrarse con
   esos mismos datos → recibe código nuevo → verificar → entra.
9. Cero errores rojos en consola en todo el flujo.

### Nota de límites del plan gratuito:
El proveedor de correo integrado de Supabase tiene límites anti-spam por hora
(suficientes para desarrollo y pruebas). Para producción masiva se configurará
SMTP propio más adelante, sin cambiar nada del código.

---

## V1.3 - Confirmación SOLO por enlace (OTP retirado por limitación del plan Free)
**Fecha:** 24 de septiembre de 2026  
**Versión:** FASE-1-V1.3-2026-09-24

### Motivo del cambio:
Desde mediados de 2026, en el plan Free de Supabase los campos Subject y Body
de las plantillas de correo quedan BLOQUEADOS con el mailer integrado; la
personalización solo se desbloquea configurando un SMTP propio. Sin plantilla
personalizable no hay forma de mostrar `{{ .Token }}` al usuario, por lo que
el flujo OTP quedó inviable. Se decide continuar SOLO con el flujo de enlace
de confirmación + confirm.html, 100% compatible con el plan Free.

### Archivos tocados:

#### 1. index.html (re-entregado completo)
- **Eliminado:** sección OTP completa (`#otpSection`, cajas, estilos
  `.otp-inputs/.otp-box/.otp-links`) por quedar muerta sin plantilla propia.
- **Añadido:** enlace `#resendConfirmationLink` bajo el botón de login
  ("¿No confirmaste tu correo? Reenviar enlace") y estilo `.link-row`.
- **Verificación:** el login muestra el enlace de reenvío; ya no existen
  cajas OTP en el DOM.

#### 2. js/auth.js (re-entregado completo)
- **Eliminado:** todo el bloque OTP (`window.authPendingEmail`,
  `showOtpSection`, `clearOtpBoxes`, `collectOtp`, `setupOtpSection`,
  `verifyOtpCode`, `resendCode`, `showOtpAlert`, `hideOtpAlert`).
- **Añadido:** `switchTab()` reutilizable y `setupResendConfirmation()` que
  usa `supabase.auth.resend({ type: 'signup', email })` con el correo del
  campo de login.
- **Modificado:** registro sin sesión → mensaje de "revisa tu bandeja y abre
  el enlace", prellenado del login con el correo y salto a la pestaña login.
- **Modificado:** duplicado (identities vacío) → mensaje guía + prellenado +
  salto a login en lugar de bloqueo seco.
- **Mantenido:** `emailRedirectTo` hacia confirm.html en signUp.
- **Verificación:** registro nuevo → mensaje claro y login prellenado;
  cuenta pendiente → Reenviar enlace genera correo nuevo; el enlace abre
  confirm.html.

#### 3. js/config.js (re-entregado completo)
- **Línea modificada:** `window.CND_BUILD = 'FASE-1-V1.3-2026-09-24'`.
- **Verificación:** consola → `window.CND_BUILD` muestra el nuevo tag.

### Archivos NO tocados en V1.3 (siguen vigentes de V1.2):
- confirm.html, js/confirm.js, app.html, js/core.js, SQL.

### Configuración requerida en Dashboard (sin tocar plantillas):
- Authentication → URL Configuration:
  - Site URL = `https://ferminprioridadprofesional-cmyk.github.io/condonis/`
  - Redirect URLs += `https://ferminprioridadprofesional-cmyk.github.io/condonis/confirm.html`
- Authentication → Providers → Email: Confirm email ACTIVADO.
- Email Templates: NO tocar (bloqueadas en Free; ya no se necesitan).

### Checklist de verificación V1.3:
1. URLs guardadas en Dashboard (Site URL + Redirect URL).
2. Commit y push de index.html, js/auth.js, js/config.js.
3. Consola: `window.CND_BUILD` = 'FASE-1-V1.3-2026-09-24'.
4. Registro con correo nuevo → mensaje de "revisa tu bandeja" y login
   prellenado con el correo.
5. Abrir el enlace del correo → confirm.html con check animado → app.html.
6. Login inmediato tras confirmar → entra sin errores.
7. Cuenta pendiente (ferminram24@gmail.com): escribir el correo en login y
   pulsar "Reenviar enlace" → llega correo nuevo → abrir enlace → confirmar →
   login exitoso.
8. Cero errores rojos en consola en todo el flujo.

---

## V1.3.2 - Reparación de recursión RLS (42P17) y archivos faltantes
**Fecha:** 24 de septiembre de 2026  
**Versión:** FASE-1-V1.3.2-2026-09-24

### Problemas reportados por el dueño:
1. 404 "File not found" al abrir el enlace de confirmación: los archivos
   `confirm.html` y `js/confirm.js` nunca se crearon en el repositorio.
2. Al iniciar sesión (cliente y modelo): GET /profiles 500 con
   `{code: 42P17, message: "infinite recursion detected in policy for
   relation \"profiles\""}` y toast "Error al cargar tu perfil".

### Causa raíz del 42P17:
Las políticas RLS de `profiles` (y de otras tablas) usaban subconsultas
`EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = ...)`
dentro de sus propias condiciones. Al evaluar la política sobre `profiles`,
la subconsulta vuelve a pasar por RLS de `profiles`, que re-evalúa la misma
política: recursión infinita que Postgres aborta con error 42P17.

### Solución aplicada (SQL V1.3.2, script completo e idempotente):
- **Funciones auxiliares nuevas (SECURITY DEFINER, bypassean RLS):**
  - `public.has_role(p_role TEXT)` → bool
  - `public.my_owned_agency_id()` → uuid o NULL
  - `public.is_admin()` re-entregada (ya era DEFINER, se mantiene)
- **Políticas de profiles reescritas** usando `is_admin()`,
  `has_role('client')` y `my_owned_agency_id()` en lugar de subconsultas.
- **Políticas de TODAS las demás tablas reescritas** usando `is_admin()`
  (antes usaban EXISTS sobre profiles).
- **Políticas nuevas añadidas** donde faltaban: agency_payments,
  model_payouts, show_offer_responses, call_ratings; y política de UPDATE
  para admin sobre profiles (necesaria en Fase 5).
- **verify_schema() ampliada** con has_role y my_owned_agency_id.
- Tablas, datos, RPCs de negocio y trigger: SIN cambios (no se tocaron).

### Archivos tocados:
1. **SQL V1.3.2** (ejecutar una vez en SQL Editor).
2. **confirm.html** (CREADO en raíz del repo; estaba faltando).
3. **js/confirm.js** (CREADO en js/; estaba faltando).
4. **js/config.js** (re-entregado; solo build tag V1.3.2).

### Decisión registrada:
- V1.4 "Iniciar con Google" (OAuth) fue DESCARTADA por decisión del dueño
  antes de desplegarse (requería Google Cloud Console + pantalla de
  consentimiento). No se aplicó ningún cambio de ese borrador. El proyecto
  permanece con autenticación email/contraseña + confirmación por enlace.

### Checklist de verificación V1.3.2:
1. Ejecutar SQL V1.3.2 en SQL Editor → "Success".
2. `SELECT public.verify_schema();` → todo true.
3. Crear en el repo `confirm.html` (raíz) y `js/confirm.js`; commit y push.
4. Reemplazar `js/config.js`; commit y push; esperar deploy de Pages.
5. Consola: `window.CND_BUILD` = 'FASE-1-V1.3.2-2026-09-24'.
6. Login de CLIENTE y de MODELO: sin 500, sin 42P17, sin toast de error;
   el header muestra saldo y la sección Perfil pinta los datos.
7. Abrir `https://.../condonis/confirm.html` directamente: ya no da 404
   (muestra estado de error amigable si no hay tokens, es lo esperado).
8. Reenviar enlace a un correo pendiente y abrirlo: check animado y entrada
   automática a app.html.
9. Cero errores rojos en consola.

---

## V1.3.3 - Anon key restaurada (401 Invalid API key)
**Fecha:** 24 de septiembre de 2026  
**Versión:** FASE-1-V1.3.3-2026-09-24

### Problema reportado por el dueño:
- GET /rest/v1/profiles → 401 con `{message: 'Invalid API key', hint:
  'Double check your Supabase anon or service_role API key.'}`
- Múltiples fallos de WebSocket Realtime: `HTTP Authentication failed; no
  valid credentials available`.
- Pregunta del dueño: ¿es normal o se repara antes de la Fase 2? Respuesta:
  se repara antes; era un defecto de transcripción de la entrega V1.3.2.

### Causa raíz:
El `js/config.js` entregado en V1.3.2 contenía la anon key con UN carácter
alterado en el payload base64 (`...MjIwNTc0OTQwOA...` en lugar de
`...MjEwNTc0OTQwOA...`), lo que invalida la firma JWT del token. Supabase
rechaza la key en REST (401) y en el handshake de Realtime (WebSocket).
Error imputable a la transcripción de la IA, no al proyecto del dueño.

### Solución aplicada:
- **js/config.js re-entregado completo** con la anon key EXACTA original
  proporcionada por el dueño al inicio del proyecto.
- Build tag subido a `FASE-1-V1.3.3-2026-09-24` para confirmar el despliegue.
- Sin cambios en SQL, HTML ni demás JS (regla R10: nada más se tocó).

### Archivos tocados:
1. **js/config.js** (único archivo modificado en esta entrega).

### Checklist de verificación V1.3.3:
1. Reemplazar `js/config.js` en el repo; commit y push; esperar deploy.
2. Recarga dura (Ctrl+Shift+R) en app.html.
3. Consola: `window.CND_BUILD` = 'FASE-1-V1.3.3-2026-09-24'.
4. Desaparecen el 401 'Invalid API key' y los errores de WebSocket Realtime.
5. El perfil carga sin toast de error; la sección Perfil pinta los datos.
6. Login de cliente y de modelo sin errores rojos en consola.

---

*Este archivo se actualiza en cada entrega. Nunca se borra historial.*


---

## FASE 2 - Modelos y Presencia (V2.0)
**Fecha:** 24 de septiembre de 2026  
**Versión:** FASE-2-V2.0-2026-09-24

### Alcance cumplido (Sección 13, Fase 2):
- Listado de modelos SOLO online (RPC get_active_models + fallback A11).
- Perfil público con galería (modal único reutilizable, regla A12).
- Presencia completa: toggle inmediato (P1), heartbeat 20s (P2),
  beacon offline con fetch keepalive en pagehide (P3), filtro <90s (P4),
  Realtime con debounce 150ms y innerHTML= (P5/A6/A7), refresco <2s (P6).
- Editor de perfil público de modelo: tarifa (cliente ve el doble),
  especialidad y bio, guardados en role_details propio.
- Galería en Storage: bucket público model-gallery, subida/borrado por
  carpeta propia ({model_id}/archivo), políticas RLS de storage.

### SQL Fase 2 (script completo e idempotente):
- ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles (con guardia
  idempotente) y REPLICA IDENTITY FULL para payload.new completo.
- Bucket storage 'model-gallery' público + 3 políticas (lectura pública,
  insert y delete solo dueña con has_role('model')).
- RPC get_model_profile(uuid) con to_jsonb (regla A5).
- verify_schema() ampliada: fn_get_model_profile, bucket_galeria,
  realtime_profiles.

### Archivos tocados:
1. **js/models.js (NUEVO):** initModels, loadActiveModels, fetchActiveModels,
   cardHtml, starsHtml, renderModelHome, bindModelHomeEvents, setPresence,
   startHeartbeat, stopHeartbeat, touchPresence, beaconOffline,
   loadOwnDetails, saveModelProfile, renderGallery, uploadGalleryFile,
   deleteGalleryFile, openModelProfile, closeModelModal.
2. **app.html (re-entregado completo):** zona #availabilityZone, modal
   #modelModal único, estilos de switch/galería/estrellas/modal, script
   js/models.js añadido UNA vez.
3. **js/core.js (re-entregado completo):** se retira la presencia automática
   (ahora la controla models.js con toggle explícito), se añade el gancho
   window.onAppReady() tras cargar perfil; Realtime y debounce intactos.
4. **js/config.js (re-entregado completo):** build tag FASE-2-V2.0-2026-09-24.

### Archivos NO tocados (regla R10):
- index.html, js/auth.js, confirm.html, js/confirm.js, tablas y RPCs de
  negocio (start_call, tick_call, etc. siguen intactas de V1.1/V1.3.2).

### Checklist de verificación Fase 2:
1. SQL Fase 2 ejecutado → Success; verify_schema() todo true.
2. Archivos subidos; consola muestra FASE-2-V2.0-2026-09-24.
3. Login MODELO: tarjeta Disponibilidad con switch; al activarlo, toast y
   estado "En linea"; heartbeat renueva last_seen cada 20s (verificable en
   Table Editor viendo last_seen avanzar).
4. Login CLIENTE (otra ventana/incognito): la modelo aparece en <2s.
5. MODELO desactiva el switch: desaparece del cliente en <2s.
6. MODELO guarda tarifa 10 → cliente ve 20 tokens/min en tarjeta y modal.
7. MODELO sube una foto → aparece en su galería y en el modal del cliente.
8. MODELO cierra la pestaña → cliente la ve desaparecer (beacon offline).
9. Cero errores rojos en consola en ambos roles.

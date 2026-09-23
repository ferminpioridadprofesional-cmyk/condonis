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

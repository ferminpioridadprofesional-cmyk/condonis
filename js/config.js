// ============================================================================
// CONDONIS - CONFIGURACIÓN GLOBAL
// Credenciales de Supabase, cliente, constantes y marcador de build.
// ÚNICO lugar del proyecto donde viven las credenciales (regla R4).
// ============================================================================

// URL del proyecto Supabase entregada por el dueño
const SUPABASE_URL = 'https://xvnefjjufadwkhzavgni.supabase.co';

// Clave pública anon entregada por el dueño (segura para cliente)
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2bmVmamp1ZmFkd2toemF2Z25pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNzM0MDgsImV4cCI6MjIwNTc0OTQwOH0.yW-g_DNL9DMOlWI8tkLyHSNofZCgrXdLGgzfu4XjPFQ';

// Importar el cliente oficial de Supabase desde CDN (módulo ES)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Instancia global del cliente: todos los módulos usan window.supabase
window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ICE Servers GRATUITOS para WebRTC (solo STUN públicos, sin TURN de pago)
window.CND_ICE_SERVERS = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.services.mozilla.com' },
    { urls: 'stun:openrelay.metered.ca:80' } // STUN público (NO es TURN)
];

// Constantes globales de comportamiento de la app
window.CND_CONFIG = {
    APP_NAME: 'CONDONIS',              // Nombre visible de la aplicación
    COMMISSION_PCT: 50,                // Comisión por defecto de la app (%)
    MIN_RECHARGE: 10,                  // Recarga mínima de tokens
    KYC_REQUIRED: true,                // KYC obligatorio para modelos
    HEARTBEAT_INTERVAL: 20000,         // Heartbeat de presencia cada 20s
    PRESENCE_TIMEOUT: 90000,           // Presencia válida si last_seen < 90s
    CALL_TIMEOUT: 15000,               // Corte automático de llamada a los 15s
    DEBOUNCE_DELAY: 150,               // Debounce de refrescos Realtime (150ms)
    TICK_INTERVAL: 10000               // Tick de cobro acumulado cada 10s
};

// Marcador de build (regla R7): verificar en consola tras cada entrega
window.CND_BUILD = 'FASE-1-V1.3.2-2026-09-24';

// Exportación para módulos que prefieran import explícito
export { SUPABASE_URL, SUPABASE_ANON_KEY };

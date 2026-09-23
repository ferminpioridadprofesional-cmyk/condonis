// ============================================================================
// CONDONIS - CONFIGURACIÓN GLOBAL
// Este archivo contiene credenciales de Supabase y constantes globales
// ============================================================================

// Credenciales de Supabase (únicas credenciales del sistema)
const SUPABASE_URL = 'https://xvnefjjufadwkhzavgni.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2bmVmamp1ZmFkd2toemF2Z25pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNzM0MDgsImV4cCI6MjEwNTc0OTQwOH0.yW-g_DNL9DMOlWI8tkLyHSNofZCgrXdLGgzfu4XjPFQ';

// Importar cliente de Supabase desde CDN
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Crear instancia global del cliente Supabase
window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Configuración de ICE Servers para WebRTC (solo STUN públicos gratuitos)
window.CND_ICE_SERVERS = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.services.mozilla.com' },
    { urls: 'stun:openrelay.metered.ca:80' }
];

// Constantes globales de la aplicación
window.CND_CONFIG = {
    APP_NAME: 'CONDONIS',
    COMMISSION_PCT: 50, // Comisión por defecto de la app
    MIN_RECHARGE: 10, // Recarga mínima de tokens
    KYC_REQUIRED: true, // KYC obligatorio para modelos
    HEARTBEAT_INTERVAL: 20000, // Intervalo de heartbeat en ms (20s)
    PRESENCE_TIMEOUT: 90000, // Timeout de presencia en ms (90s)
    CALL_TIMEOUT: 15000, // Timeout de conexión de llamada en ms (15s)
    DEBOUNCE_DELAY: 150, // Delay de debounce para actualizaciones en ms
    TICK_INTERVAL: 10000 // Intervalo de tick de llamada en ms (10s)
};

// Marcador de versión del build
window.CND_BUILD = 'FASE-1-V1.0-2026-09-24';

// Exportar para uso en módulos
export { SUPABASE_URL, SUPABASE_ANON_KEY };

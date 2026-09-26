// ============================================================================
// CONDONIS - CONFIGURACIÓN GLOBAL
// ============================================================================

const SUPABASE_URL = 'https://xvnefjjufadwkhzavgni.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2bmVmamp1ZmFkd2toemF2Z25pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNzM0MDgsImV4cCI6MjEwNTc0OTQwOH0.yW-g_DNL9DMOlWI8tkLyHSNofZCgrXdLGgzfu4XjPFQ';

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.CND_ICE_SERVERS = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.services.mozilla.com' },
    { urls: 'stun:openrelay.metered.ca:80' }
];

window.CND_CONFIG = {
    APP_NAME: 'CONDONIS',
    COMMISSION_PCT: 50,
    MIN_RECHARGE: 10,
    KYC_REQUIRED: true,
    HEARTBEAT_INTERVAL: 20000,
    PRESENCE_TIMEOUT: 90000,
    CALL_TIMEOUT: 15000,
    DEBOUNCE_DELAY: 150,
    TICK_INTERVAL: 10000
};

// 'full' = PWA/web completa | 'store' = bundle nativo (oculta retiros/agencias)
window.CND_BUILD_MODE = 'full';

// Rebrand opcional: true => la UI dice "Creadores" en vez de "Modelos"
window.CND_REBRAND = false;

// Idioma por defecto (i18n lo sobreescribe con el del dispositivo)
window.CND_LOCALE = 'es';

window.CND_BUILD = 'FASE-8-V8.0-2026-09-25';

export { SUPABASE_URL, SUPABASE_ANON_KEY };

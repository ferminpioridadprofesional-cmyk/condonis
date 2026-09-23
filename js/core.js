// ============================================================================
// CONDONIS - CORE: Sesión, Navegación SPA, Presencia, Realtime y Utilidades
// Lógica central compartida por todas las secciones de app.html
// ============================================================================

// Estado global de la aplicación (única fuente de verdad en memoria)
window.appState = {
    currentUser: null,          // usuario autenticado + perfil cargado
    currentSection: 'sectionHome', // sección visible de la SPA
    models: [],                 // cache de modelos activos (Fase 2)
    callActive: false,          // true mientras haya videollamada viva
    heartbeatInterval: null,    // id del intervalo de heartbeat
    realtimeSubscription: null  // canal Realtime activo
};

// ============================================================================
// FUNCIÓN: initApp()
// Arranque de la aplicación: sesión, perfil, UI, presencia y Realtime
// ============================================================================
async function initApp() {
    try {
        // Verificar que exista sesión de Supabase Auth
        const { data: { session } } = await window.supabase.auth.getSession();

        if (!session) {
            window.location.href = 'index.html'; // sin sesión: ir al login
            return;
        }

        window.appState.currentUser = session.user; // guardar usuario base

        await loadUserProfile();   // cargar fila de profiles
        setupUIForRole();          // ajustar navegación según rol
        startPresenceSystem();     // heartbeat de presencia (modelos)
        setupRealtimeSubscriptions(); // escuchar cambios en vivo
        showSection('sectionHome');   // sección inicial

        console.log('Aplicación inicializada. Build:', window.CND_BUILD);
    } catch (error) {
        console.error('Error al inicializar la aplicación:', error);
        showToast('Error al cargar la aplicación', 'error');
    }
}

// ============================================================================
// FUNCIÓN: loadUserProfile()
// Lee la fila propia de profiles y la adjunta al estado global
// ============================================================================
async function loadUserProfile() {
    try {
        const { data: profile, error } = await window.supabase
            .from('profiles')
            .select('*')
            .eq('id', window.appState.currentUser.id)
            .single();

        if (error) throw error;

        window.appState.currentUser.profile = profile; // adjuntar perfil
        updateUserUI(); // reflejar saldo y avatar en el header
    } catch (error) {
        console.error('Error al cargar perfil:', error);
        showToast('Error al cargar tu perfil', 'error');
    }
}

// ============================================================================
// FUNCIÓN: updateUserUI()
// Pinta avatar (inicial del nombre) y balance de tokens en el header
// ============================================================================
function updateUserUI() {
    const profile = window.appState.currentUser && window.appState.currentUser.profile;
    if (!profile) return;

    const avatarElement = document.getElementById('userAvatar');
    if (avatarElement) {
        avatarElement.textContent = (profile.full_name || 'U').charAt(0).toUpperCase();
    }

    const balanceElement = document.getElementById('userBalance');
    if (balanceElement) {
        balanceElement.textContent = `${Number(profile.tokens_balance || 0)} tokens`;
    }
}

// ============================================================================
// FUNCIÓN: setupUIForRole()
// Añade el botón de navegación Admin solo si el rol es admin
// ============================================================================
function setupUIForRole() {
    const profile = window.appState.currentUser.profile;
    if (!profile) return;

    const navContainer = document.querySelector('.bottom-nav');
    if (!navContainer) return;

    // Evitar duplicar el botón si ya existe (regla A12)
    if (document.querySelector('[data-section="sectionAdmin"]')) return;

    if (profile.role === 'admin') {
        const adminBtn = document.createElement('button');
        adminBtn.className = 'nav-item';
        adminBtn.dataset.section = 'sectionAdmin';
        adminBtn.setAttribute('aria-label', 'Panel de administración');
        adminBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span class="nav-label">Admin</span>
        `;
        // Clic navega a la sección admin
        adminBtn.addEventListener('click', () => showSection('sectionAdmin'));
        navContainer.appendChild(adminBtn);
    }
}

// ============================================================================
// FUNCIÓN: startPresenceSystem()
// Modelos: marca online inmediato + heartbeat cada 20s + offline al salir
// ============================================================================
function startPresenceSystem() {
    const profile = window.appState.currentUser.profile;
    if (!profile || profile.role !== 'model') return; // solo modelos

    updatePresence(true); // P1: toggle inmediato

    // P2: heartbeat que renueva last_seen mientras la pestaña viva
    window.appState.heartbeatInterval = setInterval(() => {
        updatePresence(true);
    }, window.CND_CONFIG.HEARTBEAT_INTERVAL);

    // P3: al cerrar/ocultar la pestaña, marcar offline
    window.addEventListener('pagehide', () => updatePresence(false));
    window.addEventListener('beforeunload', () => updatePresence(false));
}

// ============================================================================
// FUNCIÓN: updatePresence()
// Escribe is_online y last_seen propios en profiles
// ============================================================================
async function updatePresence(isOnline) {
    try {
        await window.supabase
            .from('profiles')
            .update({
                is_online: isOnline,
                last_seen: new Date().toISOString()
            })
            .eq('id', window.appState.currentUser.id);
    } catch (error) {
        console.error('Error al actualizar presencia:', error);
    }
}

// ============================================================================
// FUNCIÓN: setupRealtimeSubscriptions()
// Suscripción a UPDATE de profiles para refrescar presencia en vivo
// ============================================================================
function setupRealtimeSubscriptions() {
    window.appState.realtimeSubscription = window.supabase
        .channel('profiles-changes')
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'profiles' },
            (payload) => handleProfileUpdate(payload)
        )
        .subscribe();
}

// ============================================================================
// FUNCIÓN: handleProfileUpdate()
// Debounce de 150ms y re-render solo del contenedor de modelos (reglas A6/A7)
// ============================================================================
function handleProfileUpdate(payload) {
    const updatedProfile = payload.new;
    if (!updatedProfile || updatedProfile.role !== 'model') return;

    if (window.profileUpdateTimeout) {
        clearTimeout(window.profileUpdateTimeout); // reinicia el debounce
    }

    window.profileUpdateTimeout = setTimeout(() => {
        if (typeof window.loadActiveModels === 'function') {
            window.loadActiveModels(); // existe desde Fase 2
        }
    }, window.CND_CONFIG.DEBOUNCE_DELAY);
}

// ============================================================================
// FUNCIÓN: showSection()
// Navegación SPA: muestra una sección y marca el nav activo
// ============================================================================
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active'); // oculta todas
    });

    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active'); // muestra la pedida
        window.appState.currentSection = sectionId;
    }

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === sectionId);
    });

    loadSectionContent(sectionId); // carga datos de la sección
}

// ============================================================================
// FUNCIÓN: loadSectionContent()
// Enruta el render de cada sección a su función correspondiente
// ============================================================================
function loadSectionContent(sectionId) {
    if (sectionId === 'sectionHome' && typeof window.loadActiveModels === 'function') {
        window.loadActiveModels(); // Fase 2
    } else if (sectionId === 'sectionProfile') {
        renderProfileSection(); // render básico propio de core.js
    } else if (sectionId === 'sectionHistory') {
        renderHistoryPlaceholder(); // placeholder hasta Fase 4
    } else if (sectionId === 'sectionAdmin') {
        renderAdminPlaceholder(); // placeholder hasta Fase 5
    }
}

// ============================================================================
// FUNCIÓN: renderProfileSection()
// Pinta los datos básicos del propio perfil en la sección Perfil
// ============================================================================
function renderProfileSection() {
    const container = document.getElementById('profileContent');
    if (!container) return;

    const profile = window.appState.currentUser && window.appState.currentUser.profile;
    if (!profile) {
        container.innerHTML = '<p style="color:#94A3B8;">Cargando perfil...</p>';
        return;
    }

    // innerHTML = completo (nunca +=, regla A6)
    container.innerHTML = `
        <div class="info-row"><span class="info-label">Nombre</span><span class="info-value">${profile.full_name}</span></div>
        <div class="info-row"><span class="info-label">Correo</span><span class="info-value">${profile.email}</span></div>
        <div class="info-row"><span class="info-label">Rol</span><span class="info-value">${profile.role}</span></div>
        <div class="info-row"><span class="info-label">Saldo</span><span class="info-value">${Number(profile.tokens_balance || 0)} tokens</span></div>
        <div class="info-row"><span class="info-label">Ganancias retenidas</span><span class="info-value">${Number(profile.tokens_retained || 0)} tokens</span></div>
        <div class="info-row"><span class="info-label">Estado KYC</span><span class="info-value">${profile.kyc_status}</span></div>
    `;
}

// ============================================================================
// FUNCIÓN: renderHistoryPlaceholder()
// Mensaje informativo hasta que el historial exista (Fase 4)
// ============================================================================
function renderHistoryPlaceholder() {
    const container = document.getElementById('historyContent');
    if (!container) return;
    container.innerHTML = '<p style="color:#94A3B8;">El historial de llamadas y transacciones estará disponible en las próximas fases.</p>';
}

// ============================================================================
// FUNCIÓN: renderAdminPlaceholder()
// Mensaje informativo hasta que el panel admin exista (Fase 5)
// ============================================================================
function renderAdminPlaceholder() {
    const container = document.getElementById('adminContent');
    if (!container) return;
    container.innerHTML = '<p style="color:#94A3B8;">El panel de administración completo se habilitará en la Fase 5.</p>';
}

// ============================================================================
// FUNCIÓN: showToast()
// Notificación flotante autoeliminable (success | error | info)
// ============================================================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';          // fade out
        setTimeout(() => toast.remove(), 300); // retirar del DOM
    }, 4000);
}

// ============================================================================
// FUNCIÓN: logout()
// Limpia intervalos, canal Realtime y sesión; vuelve al login
// ============================================================================
async function logout() {
    try {
        if (window.appState.heartbeatInterval) {
            clearInterval(window.appState.heartbeatInterval); // detener heartbeat
        }

        if (window.appState.realtimeSubscription) {
            window.supabase.removeChannel(window.appState.realtimeSubscription); // cerrar canal
        }

        await window.supabase.auth.signOut(); // cerrar sesión Auth
        window.location.href = 'index.html';  // volver al login
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        showToast('Error al cerrar sesión', 'error');
    }
}

// ============================================================================
// EVENT LISTENERS: navegación y arranque
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Clic en cualquier ítem del bottom-nav navega a su sección
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const sectionId = item.dataset.section;
            if (sectionId) showSection(sectionId);
        });
    });

    initApp(); // arranque principal
});

// ============================================================================
// EXPOSICIÓN GLOBAL (regla A2: nombres únicos, vía window.*)
// ============================================================================
window.initApp = initApp;
window.loadUserProfile = loadUserProfile;
window.updateUserUI = updateUserUI;
window.showSection = showSection;
window.showToast = showToast;
window.logout = logout;

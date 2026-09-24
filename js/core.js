// ============================================================================
// CONDONIS - CORE: sesión, navegación, Realtime, utilidades
// V4.0: bloqueo de cuentas baneadas, saldo infinito visual para admin,
// reconexión Realtime al restaurar desde Back-Forward Cache, y hook de
// historial para js/tokens.js.
// ============================================================================

window.appState = {
    currentUser: null,
    currentSection: 'sectionHome',
    models: [],
    callActive: false,
    heartbeatInterval: null,
    realtimeSubscription: null
};

async function initApp() {
    try {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session) {
            window.location.href = 'index.html';
            return;
        }
        window.appState.currentUser = session.user;

        await loadUserProfile();

        // Bloqueo de cuentas baneadas: se expulsa y no entra
        const profile = window.appState.currentUser.profile;
        if (profile && profile.is_banned) {
            showToast('Tu cuenta esta suspendida. Razon: ' + (profile.ban_reason || 'consulta a soporte'), 'error');
            await window.supabase.auth.signOut();
            window.location.href = 'index.html';
            return;
        }

        setupUIForRole();
        setupRealtimeSubscriptions();
        showSection('sectionHome');

        if (typeof window.onAppReady === 'function') window.onAppReady();
        if (typeof window.onAppReadyAdmin === 'function' && profile.role === 'admin') {
            window.onAppReadyAdmin();
        }

        console.log('Aplicación inicializada. Build:', window.CND_BUILD);
    } catch (error) {
        console.error('Error al inicializar:', error);
        showToast('Error al cargar la aplicación', 'error');
    }
}

async function loadUserProfile() {
    try {
        const { data: profile, error } = await window.supabase
            .from('profiles').select('*').eq('id', window.appState.currentUser.id).single();
        if (error) throw error;
        window.appState.currentUser.profile = profile;
        updateUserUI();
    } catch (error) {
        console.error('Error al cargar perfil:', error);
        showToast('Error al cargar tu perfil', 'error');
    }
}

function updateUserUI() {
    const profile = window.appState.currentUser && window.appState.currentUser.profile;
    if (!profile) return;
    const avatar = document.getElementById('userAvatar');
    if (avatar) avatar.textContent = (profile.full_name || 'U').charAt(0).toUpperCase();
    const balance = document.getElementById('userBalance');
    if (balance) {
        // El admin tiene saldo ilimitado: se muestra infinito, no cifras
        balance.textContent = profile.role === 'admin'
            ? 'tokens: ilimitados'
            : `${Number(profile.tokens_balance || 0)} tokens`;
    }
}

function setupUIForRole() {
    const profile = window.appState.currentUser.profile;
    if (!profile) return;
    const nav = document.querySelector('.bottom-nav');
    if (!nav) return;
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
        adminBtn.addEventListener('click', () => showSection('sectionAdmin'));
        nav.appendChild(adminBtn);
    }
}

function setupRealtimeSubscriptions() {
    window.appState.realtimeSubscription = window.supabase
        .channel('profiles-changes')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' },
            (payload) => handleProfileUpdate(payload))
        .subscribe();
}

function handleProfileUpdate(payload) {
    const updated = payload.new;
    if (!updated || updated.role !== 'model') return;
    if (window.profileUpdateTimeout) clearTimeout(window.profileUpdateTimeout);
    window.profileUpdateTimeout = setTimeout(() => {
        if (typeof window.loadActiveModels === 'function') window.loadActiveModels();
    }, window.CND_CONFIG.DEBOUNCE_DELAY);
}

// Reconexión Realtime al restaurar la página desde Back-Forward Cache:
// elimina el canal muerto del bfcache y crea uno nuevo (mitiga rojos)
window.addEventListener('pageshow', (e) => {
    if (e.persisted && window.appState.realtimeSubscription) {
        try { window.supabase.removeChannel(window.appState.realtimeSubscription); } catch (err) {}
        window.appState.realtimeSubscription = null;
        setupRealtimeSubscriptions();
    }
});

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(sectionId);
    if (target) {
        target.classList.add('active');
        window.appState.currentSection = sectionId;
    }
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === sectionId);
    });
    loadSectionContent(sectionId);
}

function loadSectionContent(sectionId) {
    if (sectionId === 'sectionHome' && typeof window.loadActiveModels === 'function') {
        window.loadActiveModels();
    } else if (sectionId === 'sectionProfile') {
        renderProfileSection();
    } else if (sectionId === 'sectionHistory') {
        // Historial económico real si tokens.js está cargado
        if (typeof window.renderHistorySection === 'function') {
            window.renderHistorySection();
        } else {
            renderHistoryPlaceholder();
        }
    } else if (sectionId === 'sectionAdmin') {
        if (typeof window.renderAdminSection === 'function') {
            window.renderAdminSection();
        } else {
            renderAdminPlaceholder();
        }
    }
}

function renderProfileSection() {
    const container = document.getElementById('profileContent');
    if (!container) return;
    const profile = window.appState.currentUser && window.appState.currentUser.profile;
    if (!profile) {
        container.innerHTML = '<p style="color:#94A3B8;">Cargando...</p>';
        return;
    }
    container.innerHTML = `
        <div class="info-row"><span class="info-label">Nombre</span><span class="info-value">${profile.full_name}</span></div>
        <div class="info-row"><span class="info-label">Correo</span><span class="info-value">${profile.email}</span></div>
        <div class="info-row"><span class="info-label">Rol</span><span class="info-value">${profile.role}</span></div>
        <div class="info-row"><span class="info-label">Saldo</span><span class="info-value">${profile.role === 'admin' ? 'ilimitado' : Number(profile.tokens_balance || 0) + ' tokens'}</span></div>
        <div class="info-row"><span class="info-label">Ganancias retenidas</span><span class="info-value">${Number(profile.tokens_retained || 0)} tokens</span></div>
        <div class="info-row"><span class="info-label">Estado KYC</span><span class="info-value">${profile.kyc_status}</span></div>
    `;
}

function renderHistoryPlaceholder() {
    const c = document.getElementById('historyContent');
    if (c) c.innerHTML = '<p style="color:#94A3B8;">El historial estará disponible próximamente.</p>';
}

function renderAdminPlaceholder() {
    const c = document.getElementById('adminContent');
    if (c) c.innerHTML = '<p style="color:#94A3B8;">Panel de administración en carga...</p>';
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

async function logout() {
    try {
        if (window.appState.realtimeSubscription) {
            window.supabase.removeChannel(window.appState.realtimeSubscription);
        }
        await window.supabase.auth.signOut();
        window.location.href = 'index.html';
    } catch (error) {
        showToast('Error al cerrar sesión', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const s = item.dataset.section;
            if (s) showSection(s);
        });
    });
    initApp();
});

window.initApp = initApp;
window.loadUserProfile = loadUserProfile;
window.updateUserUI = updateUserUI;
window.showSection = showSection;
window.showToast = showToast;
window.logout = logout;

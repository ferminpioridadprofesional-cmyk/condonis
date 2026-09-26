// ============================================================================
// CONDONIS - CORE: sesión, navegación, Realtime, perfil, avatar, eliminación
// V8.1: el header muestra para la MODELO sus ganancias acumuladas
// (tokens_retained) con el mismo formato que los clientes; para clientes su
// tokens_balance y para admin "ilimitados".
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
        if (!session) { window.location.href = 'index.html'; return; }
        window.appState.currentUser = session.user;

        await loadUserProfile();

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
        if (typeof window.onAppReadyAdmin === 'function' && profile.role === 'admin') window.onAppReadyAdmin();

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

// ----------------------------------------------------------------------------
// updateUserUI: header. Modelo -> ganancias acumuladas; cliente -> saldo;
// admin -> ilimitados. Mismo formato visual para todos ("X tokens").
// ----------------------------------------------------------------------------
function updateUserUI() {
    const profile = window.appState.currentUser && window.appState.currentUser.profile;
    if (!profile) return;

    const avatar = document.getElementById('userAvatar');
    if (avatar) {
        if (profile.avatar_url) {
            avatar.textContent = '';
            avatar.style.backgroundImage = `url('${profile.avatar_url}')`;
            avatar.style.backgroundSize = 'cover';
            avatar.style.backgroundPosition = 'center';
        } else {
            avatar.style.backgroundImage = '';
            avatar.textContent = (profile.full_name || 'U').charAt(0).toUpperCase();
        }
    }

    const balance = document.getElementById('userBalance');
    if (balance) {
        if (profile.role === 'admin') {
            balance.textContent = 'tokens: ilimitados';
        } else if (profile.role === 'model') {
            // La modelo ve arriba sus ganancias acumuladas (como el cliente ve su saldo)
            balance.textContent = Number(profile.tokens_retained || 0) + ' tokens';
            balance.title = 'Ganancias acumuladas';
        } else {
            balance.textContent = Number(profile.tokens_balance || 0) + ' tokens';
            balance.title = 'Saldo disponible';
        }
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
            <span class="nav-label">Admin</span>`;
        adminBtn.addEventListener('click', () => showSection('sectionAdmin'));
        nav.appendChild(adminBtn);
    }
}

function setupRealtimeSubscriptions() {
    window.appState.realtimeSubscription = window.supabase
        .channel('profiles-changes')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' },
            (p) => handleProfileUpdate(p))
        .subscribe();
}

function handleProfileUpdate(payload) {
    const u = payload.new;
    if (!u || u.role !== 'model') return;
    if (window.profileUpdateTimeout) clearTimeout(window.profileUpdateTimeout);
    window.profileUpdateTimeout = setTimeout(() => {
        if (typeof window.loadActiveModels === 'function') window.loadActiveModels();
    }, window.CND_CONFIG.DEBOUNCE_DELAY);
}

window.addEventListener('pageshow', (e) => {
    if (e.persisted && window.appState.realtimeSubscription) {
        try { window.supabase.removeChannel(window.appState.realtimeSubscription); } catch (err) {}
        window.appState.realtimeSubscription = null;
        setupRealtimeSubscriptions();
    }
});

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const t = document.getElementById(sectionId);
    if (t) { t.classList.add('active'); window.appState.currentSection = sectionId; }
    document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.section === sectionId));
    loadSectionContent(sectionId);
}

function loadSectionContent(sectionId) {
    if (sectionId === 'sectionHome' && typeof window.loadActiveModels === 'function') window.loadActiveModels();
    else if (sectionId === 'sectionProfile') renderProfileSection();
    else if (sectionId === 'sectionHistory') {
        if (typeof window.renderHistorySection === 'function') window.renderHistorySection();
        else renderHistoryPlaceholder();
    }
    else if (sectionId === 'sectionAdmin') {
        if (typeof window.renderAdminSection === 'function') window.renderAdminSection();
        else renderAdminPlaceholder();
    }
}

function renderProfileSection() {
    const c = document.getElementById('profileContent');
    if (!c) return;
    const p = window.appState.currentUser && window.appState.currentUser.profile;
    if (!p) { c.innerHTML = '<p style="color:#94A3B8;">Cargando...</p>'; return; }
    c.innerHTML = `
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
            <div class="user-avatar" id="profileAvatarBig" style="width:72px;height:72px;font-size:28px;">${(p.full_name || 'U').charAt(0).toUpperCase()}</div>
            <div>
                <button class="btn btn-secondary" id="avatarPick">Subir foto de perfil</button>
                <input type="file" id="avatarFile" accept="image/png,image/jpeg,image/webp" style="display:none">
                <p class="hint">Formatos: PNG, JPG o WEBP.</p>
            </div>
        </div>
        <div class="info-row"><span class="info-label">Nombre</span><span class="info-value">${p.full_name}</span></div>
        <div class="info-row"><span class="info-label">Correo</span><span class="info-value">${p.email}</span></div>
        <div class="info-row"><span class="info-label">Rol</span><span class="info-value">${p.role}</span></div>
        <div class="info-row"><span class="info-label">${p.role === 'model' ? 'Ganancias acumuladas' : 'Saldo disponible'}</span><span class="info-value">${p.role === 'admin' ? 'ilimitado' : Number(p.role === 'model' ? p.tokens_retained : p.tokens_balance || 0) + ' tokens'}</span></div>
        ${p.role === 'model' ? `<div class="info-row"><span class="info-label">Saldo disponible</span><span class="info-value">${Number(p.tokens_balance || 0)} tokens</span></div>` : ''}
        <div class="info-row"><span class="info-label">Estado KYC</span><span class="info-value">${p.kyc_status}</span></div>
        <button class="btn btn-danger" id="deleteAccountBtn" style="margin-top:16px;">Eliminar mi cuenta</button>
        <p class="hint">Al eliminar tu cuenta se borran para siempre tu perfil, datos, documentos y historial.</p>`;

    const big = document.getElementById('profileAvatarBig');
    if (p.avatar_url && big) {
        big.textContent = '';
        big.style.backgroundImage = `url('${p.avatar_url}')`;
        big.style.backgroundSize = 'cover'; big.style.backgroundPosition = 'center';
    }
    document.getElementById('avatarPick').addEventListener('click', () => document.getElementById('avatarFile').click());
    document.getElementById('avatarFile').addEventListener('change', (e) => uploadAvatar(e.target));
    document.getElementById('deleteAccountBtn').addEventListener('click', deleteOwnAccount);
}

async function uploadAvatar(input) {
    const user = window.appState.currentUser;
    const file = input.files && input.files[0];
    if (!file) return;
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    try {
        const { error } = await window.supabase.storage.from('avatars').upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        const url = window.supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
        const { error: db } = await window.supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
        if (db) throw db;
        user.profile.avatar_url = url;
        updateUserUI(); renderProfileSection();
        window.showToast('Foto de perfil actualizada', 'success');
    } catch (e) { window.showToast('No se pudo subir la foto', 'error'); }
    input.value = '';
}

async function deleteOwnAccount() {
    const conf = window.prompt('Esto borrara TODOS tus datos para siempre. Escribe ELIMINAR para confirmar:');
    if (conf !== 'ELIMINAR') { showToast('Cancelado', 'error'); return; }
    try {
        const { error } = await window.supabase.rpc('self_delete_account');
        if (error) throw error;
        try { await window.supabase.auth.signOut(); } catch (e) {}
        window.location.href = 'index.html';
    } catch (e) { showToast('No se pudo eliminar la cuenta', 'error'); }
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
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = 'toast ' + type; t.textContent = message;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 4000);
}

async function logout() {
    try {
        if (window.appState.realtimeSubscription) window.supabase.removeChannel(window.appState.realtimeSubscription);
        await window.supabase.auth.signOut();
        window.location.href = 'index.html';
    } catch (e) { showToast('Error al cerrar sesión', 'error'); }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-item').forEach(i => i.addEventListener('click', () => { const s = i.dataset.section; if (s) showSection(s); }));
    initApp();
});

window.initApp = initApp;
window.loadUserProfile = loadUserProfile;
window.updateUserUI = updateUserUI;
window.showSection = showSection;
window.showToast = showToast;
window.logout = logout;

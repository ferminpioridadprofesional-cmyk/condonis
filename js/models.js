// ============================================================================
// CONDONIS - MODELS: listado con foto, KYC, nivel, galería, ofertas de show
// y solicitud de retiros. V6.0.
// ============================================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const KYC_DOC_TYPES = [
    { id: 'id_front',        label: 'Cedula / ID (frente)',            required: true },
    { id: 'id_back',         label: 'Cedula / ID (reverso)',           required: true },
    { id: 'passport',        label: 'Pasaporte (pagina con foto)',     required: false },
    { id: 'license',         label: 'Licencia de conduccion',          required: false },
    { id: 'protection_card', label: 'Carnet de proteccion temporal',   required: false },
    { id: 'selfie_with_id',  label: 'Selfie sosteniendo tu documento', required: true }
];

let modelsClickBound = false;
let presenceOnline = false;
let heartbeatTimer = null;
let accessToken = '';
let ownDetails = null;

async function initModels() {
    const user = window.appState.currentUser;
    if (!user || !user.profile) return;

    if (user.profile.role === 'model') {
        const { data } = await window.supabase.auth.getSession();
        accessToken = data.session ? data.session.access_token : '';
        presenceOnline = !!user.profile.is_online;
        await loadOwnDetails();
        if (presenceOnline) startHeartbeat();
        window.addEventListener('pagehide', beaconOffline);
    }

    if (!modelsClickBound) {
        const container = document.getElementById('modelsContainer');
        if (container) {
            container.addEventListener('click', (e) => {
                const card = e.target.closest('.model-card');
                if (card && card.dataset.id) openModelProfile(card.dataset.id);
            });
            modelsClickBound = true;
        }
    }

    const overlay = document.getElementById('modelModal');
    const closeBtn = document.getElementById('modelModalClose');
    if (closeBtn) closeBtn.addEventListener('click', closeModelModal);
    if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModelModal(); });

    await loadActiveModels();
}
window.onAppReady = initModels;

async function loadActiveModels() {
    const user = window.appState.currentUser;
    if (!user || !user.profile) return;
    const container = document.getElementById('modelsContainer');
    if (!container) return;
    if (user.profile.role === 'model') { await renderModelHome(); return; }

    const models = await fetchActiveModels();
    window.appState.models = models || [];
    container.innerHTML = (models && models.length)
        ? models.map(cardHtml).join('')
        : '<p class="empty-note">No hay modelos disponibles en este momento.</p>';
}
window.loadActiveModels = loadActiveModels;

async function fetchActiveModels() {
    try {
        const { data, error } = await window.supabase.rpc('get_active_models');
        if (error) throw error;
        return data || [];
    } catch (err) {
        const since = new Date(Date.now() - window.CND_CONFIG.PRESENCE_TIMEOUT).toISOString();
        const { data } = await window.supabase.from('profiles')
            .select('id, full_name, avatar_url, rating, is_online, in_call')
            .eq('role', 'model').eq('kyc_status', 'approved').eq('is_banned', false)
            .eq('is_active', true).eq('is_online', true).gte('last_seen', since);
        return (data || []).map(p => ({ id: p.id, full_name: p.full_name, avatar_url: p.avatar_url,
            rating: p.rating, is_online: p.is_online, in_call: p.in_call,
            client_rate: 0, level_name: 'Sin nivel', worker_level: 1 }));
    }
}

// Tarjeta con FOTO de perfil si existe (V6.0)
function cardHtml(m) {
    const inner = m.avatar_url
        ? `<img src="${m.avatar_url}" alt="${m.full_name}" style="width:100%;height:100%;object-fit:cover;display:block;">`
        : (m.full_name || 'M').charAt(0).toUpperCase();
    const rate = Number(m.client_rate || 0);
    const badge = m.in_call
        ? '<span class="model-status badge-incall">En llamada</span>'
        : '<span class="model-status status-online">En linea</span>';
    return `
        <div class="model-card" data-id="${m.id}" role="button" tabindex="0" aria-label="Ver perfil de ${m.full_name}">
            <div class="model-avatar">${inner}</div>
            <div class="model-info">
                <div class="model-name">${m.full_name}</div>
                <div class="model-rate">${rate} tokens/min</div>
                <div class="model-meta"><span class="level-badge">${m.level_name || 'Modelo'}</span> ${starsHtml(m.rating)}</div>
                ${badge}
            </div>
        </div>`;
}

function starsHtml(rating) {
    const full = Math.round(Number(rating || 0));
    let out = '<span class="stars" aria-label="Calificacion ' + full + ' de 5">';
    for (let i = 1; i <= 5; i++) {
        out += `<svg${i <= full ? '' : ' class="off"'} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z"/></svg>`;
    }
    return out + '</span>';
}

// ============================================================================
// Home de modelo: KYC, disponibilidad, nivel (solo su ganancia), retiros,
// ofertas recibidas, bio y galería
// ============================================================================
async function renderModelHome() {
    const user = window.appState.currentUser;
    const profile = user.profile;
    const zone = document.getElementById('availabilityZone');
    const container = document.getElementById('modelsContainer');
    if (!zone || !container) return;

    const kycOk = profile.kyc_status === 'approved';
    const level = ownDetails && ownDetails.level_id ? await fetchLevel(ownDetails.level_id) : null;
    const modelRate = level ? Number(level.rate_per_minute) * 0.5 : 0;

    let kycBlock = '';
    if (kycOk) kycBlock = `<div class="card kyc-card kyc-ok"><div class="card-header"><span class="card-title">Verificacion KYC</span><span class="kyc-badge kyc-approved">Aprobada</span></div><button class="btn btn-secondary" id="btnViewKycDocs">Ver mis documentos</button></div>`;
    else if (profile.kyc_status === 'pending') kycBlock = `<div class="card kyc-card kyc-pending"><div class="card-header"><span class="card-title">Verificacion KYC</span><span class="kyc-badge kyc-pending">En revision</span></div><button class="btn btn-secondary" id="btnViewKycDocs">Ver mis documentos</button></div>`;
    else if (profile.kyc_status === 'rejected') kycBlock = `<div class="card kyc-card kyc-rejected"><div class="card-header"><span class="card-title">Verificacion KYC</span><span class="kyc-badge kyc-rejected">Rechazada</span></div><button class="btn" id="btnOpenKyc">Reenviar documentos</button></div>`;
    else kycBlock = `<div class="card kyc-card kyc-none"><div class="card-header"><span class="card-title">Verificacion KYC obligatoria</span><span class="kyc-badge kyc-none">Pendiente</span></div><p class="hint">Verifica tu identidad para ser visible.</p><button class="btn" id="btnOpenKyc">Iniciar verificacion</button></div>`;

    const availBlock = kycOk ? `
        <div class="card avail-card">
            <div class="card-header"><span class="card-title">Disponibilidad</span><span class="avail-state ${presenceOnline ? 'on' : 'off'}">${presenceOnline ? 'En linea' : 'Desconectada'}</span></div>
            <label class="switch"><input type="checkbox" id="availSwitch" ${presenceOnline ? 'checked' : ''}><span class="slider"></span></label>
        </div>` : '';

    const levelBlock = `
        <div class="card">
            <div class="card-header"><span class="card-title">Mi nivel</span>${level ? `<span class="level-badge big">${level.name}</span>` : '<span class="kyc-badge kyc-none">Sin nivel</span>'}</div>
            ${level ? `<div class="info-row"><span class="info-label">Ganas por minuto</span><span class="info-value">${modelRate} tokens/min</span></div>
            <p class="hint">Tarifa de ganancia asignada a tu nivel.</p>` : '<p class="hint">El administrador asignara tu nivel al aprobar tu KYC.</p>'}
        </div>`;

    // Retiros: saldo retenido y solicitudes
    const payouts = await myPayouts();
    const payoutBlock = `
        <div class="card">
            <div class="card-header"><span class="card-title">Mis ganancias</span><span class="info-value">${Number(profile.tokens_retained || 0)} retenidos</span></div>
            <button class="btn" id="btnRequestPayout">Solicitar retiro</button>
            <div id="payoutsList" style="margin-top:10px;">
                ${payouts.length === 0 ? '<p class="hint">Sin solicitudes de retiro.</p>' : payouts.map(p =>
                    `<div class="info-row"><span class="info-label">${new Date(p.created_at).toLocaleDateString()} · ${p.amount} tokens</span><span class="info-value">${p.status}</span></div>`).join('')}
            </div>
        </div>`;

    // Ofertas de show pendientes
    const offers = await myOffers();
    const offersBlock = `
        <div class="card">
            <div class="card-header"><span class="card-title">Ofertas de show</span></div>
            <div id="offersList">
                ${offers.length === 0 ? '<p class="hint">Sin ofertas pendientes.</p>' : offers.map(o => `
                    <div class="card" style="margin-bottom:8px;">
                        <div class="info-row"><span class="info-label">${o.minutes} min · ${o.amount} tokens (tu ganancia)</span><span class="info-value">${new Date(o.expires_at).toLocaleTimeString()}</span></div>
                        <p class="hint">${o.description || 'Sin descripcion'}</p>
                        <div style="display:flex;gap:8px;">
                            <button class="btn" data-accept="${o.id}" style="flex:1;">Aceptar</button>
                            <button class="btn btn-danger" data-reject="${o.id}" style="flex:1;">Rechazar</button>
                        </div>
                    </div>`).join('')}
            </div>
        </div>`;

    const bioBlock = `
        <div class="card">
            <div class="card-header"><span class="card-title">Mi perfil publico</span></div>
            <div class="form-row"><label for="editSpecialty">Especialidad</label><input id="editSpecialty" type="text" maxlength="60" value="${ownDetails && ownDetails.specialty ? ownDetails.specialty : ''}"></div>
            <div class="form-row"><label for="editBio">Biografia corta</label><textarea id="editBio" rows="3" maxlength="240">${ownDetails && ownDetails.bio ? ownDetails.bio : ''}</textarea></div>
            <button class="btn" id="saveProfileBtn">Guardar cambios</button>
        </div>`;

    const galleryBlock = `
        <div class="card">
            <div class="card-header"><span class="card-title">Mi galeria</span></div>
            <button class="btn btn-secondary" id="galleryPick">Subir foto</button>
            <input type="file" id="galleryFile" accept="image/png,image/jpeg,image/webp" style="display:none">
            <div id="galleryGrid" class="gallery-grid"></div>
        </div>`;

    zone.innerHTML = kycBlock + availBlock + levelBlock + payoutBlock + offersBlock + bioBlock + galleryBlock;

    if (kycOk && level) {
        container.innerHTML = cardHtml({ id: profile.id, full_name: profile.full_name, avatar_url: profile.avatar_url,
            rating: profile.rating, is_online: presenceOnline, in_call: profile.in_call,
            client_rate: modelRate, level_name: level.name, worker_level: ownDetails ? ownDetails.worker_level : 1 })
            + '<p class="hint" style="grid-column:1/-1;">Vista previa: la cifra es tu ganancia por minuto.</p>';
    } else {
        container.innerHTML = '<p class="hint" style="margin-top:20px;">Previsualizacion disponible con KYC aprobado y nivel asignado.</p>';
    }

    bindModelHomeEvents();
    await renderGallery();
}

async function myPayouts() {
    const { data } = await window.supabase.from('model_payouts')
        .select('*').eq('model_id', window.appState.currentUser.id)
        .order('created_at', { ascending: false }).limit(10);
    return data || [];
}

async function myOffers() {
    const { data } = await window.supabase.from('show_offers')
        .select('*').eq('model_id', window.appState.currentUser.id)
        .eq('status', 'pending').gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
    return data || [];
}

async function fetchLevel(id) {
    const { data } = await window.supabase.from('kyc_levels').select('*').eq('id', id).single();
    return data;
}

function bindModelHomeEvents() {
    const openKyc = document.getElementById('btnOpenKyc');
    const viewDocs = document.getElementById('btnViewKycDocs');
    if (openKyc) openKyc.addEventListener('click', openKycModal);
    if (viewDocs) viewDocs.addEventListener('click', openKycModal);

    const sw = document.getElementById('availSwitch');
    if (sw) sw.addEventListener('change', () => setPresence(sw.checked));

    const save = document.getElementById('saveProfileBtn');
    if (save) save.addEventListener('click', saveModelProfile);

    const pick = document.getElementById('galleryPick');
    const file = document.getElementById('galleryFile');
    if (pick && file) { pick.addEventListener('click', () => file.click()); file.addEventListener('change', () => uploadGalleryFile(file)); }

    const rp = document.getElementById('btnRequestPayout');
    if (rp) rp.addEventListener('click', async () => {
        const raw = window.prompt('Cuanto quieres retirar de tu saldo retenido?');
        if (raw === null) return;
        const amount = Number(raw);
        if (!amount || amount < 1) { window.showToast('Monto invalido', 'error'); return; }
        try {
            const { error } = await window.supabase.rpc('request_model_payout', { p_amount: amount });
            if (error) throw error;
            window.showToast('Solicitud de retiro enviada', 'success');
            await renderModelHome();
        } catch (err) { window.showToast(err.message || 'No se pudo solicitar', 'error'); }
    });

    document.querySelectorAll('[data-accept]').forEach(b => b.addEventListener('click', async () => {
        try {
            const { error } = await window.supabase.rpc('respond_show_offer', { p_offer_id: b.dataset.accept, p_accept: true });
            if (error) throw error;
            window.showToast('Oferta aceptada: ganancia acreditada', 'success');
            await loadUserProfileRefresh();
            await renderModelHome();
        } catch (err) { window.showToast(err.message || 'No se pudo aceptar', 'error'); }
    }));
    document.querySelectorAll('[data-reject]').forEach(b => b.addEventListener('click', async () => {
        try {
            const { error } = await window.supabase.rpc('respond_show_offer', { p_offer_id: b.dataset.reject, p_accept: false });
            if (error) throw error;
            window.showToast('Oferta rechazada', 'info');
            await renderModelHome();
        } catch (err) { window.showToast(err.message, 'error'); }
    }));
}

async function loadUserProfileRefresh() {
    if (typeof window.loadUserProfile === 'function') await window.loadUserProfile();
}

// ============================================================================
// KYC (igual que V4/V5)
// ============================================================================
async function openKycModal() {
    const overlay = document.getElementById('modelModal');
    const body = document.getElementById('modelModalBody');
    if (!overlay || !body) return;
    body.innerHTML = `<h3 class="modal-title">Verificacion de identidad (KYC)</h3>
        <p class="hint" style="margin-bottom:16px;">Sube documentos validos y legibles.</p>
        <div id="kycDocsList"></div>
        <button class="btn" id="kycSubmitBtn" style="margin-top:16px;">Enviar para revision</button>`;
    overlay.classList.add('active');
    await renderKycDocs();
    document.getElementById('kycSubmitBtn').addEventListener('click', submitKyc);
}

async function renderKycDocs() {
    const user = window.appState.currentUser;
    const list = document.getElementById('kycDocsList');
    if (!list) return;
    const { data: docs } = await window.supabase.from('kyc_documents').select('*')
        .eq('model_id', user.id).order('created_at', { ascending: false });

    list.innerHTML = KYC_DOC_TYPES.map(t => {
        const doc = docs && docs.find(d => d.doc_type === t.id);
        let st = '';
        if (doc) st = doc.status === 'approved' ? '<span class="kyc-badge kyc-approved">Aprobado</span>'
            : doc.status === 'rejected' ? `<span class="kyc-badge kyc-rejected">Rechazado${doc.rejection_reason ? ': ' + doc.rejection_reason : ''}</span>`
            : '<span class="kyc-badge kyc-pending">En revision</span>';
        return `<div class="kyc-doc-row">
            <div class="kyc-doc-info"><div class="kyc-doc-label">${t.label} ${t.required ? '<span class="required">*</span>' : ''}</div><div>${st}</div></div>
            <div style="display:flex;gap:8px;">
                <input type="file" class="kyc-file-input" data-type="${t.id}" accept="image/png,image/jpeg,image/webp" style="display:none">
                <button class="btn btn-secondary kyc-upload-btn" data-type="${t.id}">${doc ? 'Reemplazar' : 'Subir'}</button>
            </div></div>`;
    }).join('');

    list.querySelectorAll('.kyc-upload-btn').forEach(b => b.addEventListener('click', () => {
        const inp = list.querySelector(`.kyc-file-input[data-type="${b.dataset.type}"]`);
        if (inp) inp.click();
    }));
    list.querySelectorAll('.kyc-file-input').forEach(i => i.addEventListener('change', () => uploadKycFile(i, i.dataset.type)));
}

async function uploadKycFile(input, docType) {
    const user = window.appState.currentUser;
    const file = input.files && input.files[0];
    if (!file) return;
    const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const path = `${user.id}/${docType}-${Date.now()}-${safe}`;
    try {
        const { error: up } = await window.supabase.storage.from('kyc-docs').upload(path, file, { contentType: file.type, upsert: false });
        if (up) throw up;
        await window.supabase.from('kyc_documents').delete().eq('model_id', user.id).eq('doc_type', docType);
        const { error: db } = await window.supabase.from('kyc_documents').insert({ model_id: user.id, doc_type: docType, file_url: path, status: 'pending' });
        if (db) throw db;
        if (user.profile.kyc_status === 'none') {
            await window.supabase.from('profiles').update({ kyc_status: 'pending' }).eq('id', user.id);
            user.profile.kyc_status = 'pending';
        }
        window.showToast('Documento subido', 'success');
        await renderKycDocs(); await renderModelHome();
    } catch (err) { window.showToast('No se pudo subir el documento', 'error'); }
    input.value = '';
}

async function submitKyc() {
    const user = window.appState.currentUser;
    const { data: docs } = await window.supabase.from('kyc_documents').select('doc_type').eq('model_id', user.id);
    const submitted = (docs || []).map(d => d.doc_type);
    const missing = KYC_DOC_TYPES.filter(t => t.required && !submitted.includes(t.id));
    if (missing.length) { window.showToast('Faltan: ' + missing.map(m => m.label).join(', '), 'error'); return; }
    if (user.profile.kyc_status !== 'pending' && user.profile.kyc_status !== 'approved') {
        await window.supabase.from('profiles').update({ kyc_status: 'pending' }).eq('id', user.id);
        user.profile.kyc_status = 'pending';
    }
    window.showToast('Enviado para revision', 'success');
    closeModelModal(); await renderModelHome();
}
window.openKycModal = openKycModal;

// ============================================================================
// Presencia
// ============================================================================
async function setPresence(on) {
    const user = window.appState.currentUser;
    if (user.profile.kyc_status !== 'approved') {
        window.showToast('No puedes activarte hasta que tu KYC sea aprobado', 'error');
        await renderModelHome(); return;
    }
    presenceOnline = on;
    try {
        await window.supabase.from('profiles').update({ is_online: on, last_seen: new Date().toISOString() }).eq('id', user.id);
        if (on) startHeartbeat(); else stopHeartbeat();
        window.showToast(on ? 'Estas en linea' : 'Te has desconectado', 'success');
        await renderModelHome();
    } catch (err) { window.showToast('No se pudo cambiar tu disponibilidad', 'error'); await renderModelHome(); }
}
function startHeartbeat() { stopHeartbeat(); heartbeatTimer = setInterval(() => touchPresence(true), window.CND_CONFIG.HEARTBEAT_INTERVAL); }
function stopHeartbeat() { if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; } }
async function touchPresence(on) {
    const user = window.appState.currentUser;
    if (!user) return;
    try { await window.supabase.from('profiles').update({ is_online: on, last_seen: new Date().toISOString() }).eq('id', user.id); } catch (e) {}
}
function beaconOffline() {
    if (!presenceOnline) return;
    presenceOnline = false; stopHeartbeat();
    const user = window.appState.currentUser;
    if (!user || !accessToken) return;
    fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
        method: 'PATCH', keepalive: true,
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ is_online: false, last_seen: new Date().toISOString() })
    }).catch(() => {});
}

// ============================================================================
// Perfil público, galería
// ============================================================================
async function loadOwnDetails() {
    const user = window.appState.currentUser;
    try {
        const { data } = await window.supabase.from('role_details').select('*').eq('user_id', user.id).single();
        ownDetails = data || null;
    } catch (e) { ownDetails = null; }
}

async function saveModelProfile() {
    const user = window.appState.currentUser;
    const specialty = document.getElementById('editSpecialty').value.trim();
    const bio = document.getElementById('editBio').value.trim();
    try {
        const { error } = await window.supabase.from('role_details').update({ specialty, bio }).eq('user_id', user.id);
        if (error) throw error;
        ownDetails = { ...(ownDetails || {}), specialty, bio };
        window.showToast('Perfil publico actualizado', 'success');
    } catch (err) { window.showToast('No se pudo guardar', 'error'); }
}

async function renderGallery() {
    const user = window.appState.currentUser;
    const grid = document.getElementById('galleryGrid');
    if (!grid || user.profile.role !== 'model') return;
    const { data, error } = await window.supabase.storage.from('model-gallery')
        .list(user.id, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
    if (error || !data || !data.length) { grid.innerHTML = '<p class="hint">Aun no tienes fotos.</p>'; return; }
    const bucket = window.supabase.storage.from('model-gallery');
    grid.innerHTML = data.map(i => {
        const path = `${user.id}/${i.name}`;
        return `<div class="gallery-item"><img src="${bucket.getPublicUrl(path).data.publicUrl}" alt="Foto">
            <button class="gallery-del" data-path="${path}" aria-label="Eliminar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>`;
    }).join('');
    grid.querySelectorAll('.gallery-del').forEach(b => b.addEventListener('click', () => deleteGalleryFile(b.dataset.path)));
}

async function uploadGalleryFile(input) {
    const user = window.appState.currentUser;
    const file = input.files && input.files[0];
    if (!file) return;
    const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    try {
        const { error } = await window.supabase.storage.from('model-gallery').upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        window.showToast('Foto subida', 'success');
        await renderGallery();
    } catch (e) { window.showToast('No se pudo subir', 'error'); }
    input.value = '';
}

async function deleteGalleryFile(path) {
    try {
        const { error } = await window.supabase.storage.from('model-gallery').remove([path]);
        if (error) throw error;
        window.showToast('Foto eliminada', 'success');
        await renderGallery();
    } catch (e) { window.showToast('No se pudo eliminar', 'error'); }
}

// ============================================================================
// Modal de perfil público + envío de oferta de show (cliente)
// ============================================================================
async function openModelProfile(modelId) {
    const body = document.getElementById('modelModalBody');
    const overlay = document.getElementById('modelModal');
    if (!body || !overlay) return;
    body.innerHTML = '<p class="hint">Cargando perfil...</p>';
    overlay.classList.add('active');

    let payload = null;
    try {
        const { data, error } = await window.supabase.rpc('get_model_profile', { p_model_id: modelId });
        if (error) throw error;
        payload = data;
    } catch (e) {
        const { data } = await window.supabase.from('profiles').select('*').eq('id', modelId).single();
        payload = { profile: data, details: null };
    }
    const p = payload && payload.profile;
    if (!p) { body.innerHTML = '<p class="hint">Perfil no disponible.</p>'; return; }

    const viewer = window.appState.currentUser;
    const isClient = viewer.profile.role === 'client';
    const d = payload.details || {};
    const level = d.level_id ? await fetchLevel(d.level_id) : null;
    const clientRate = level ? Number(level.rate_per_minute) : 0;

    let galleryHtml = '<p class="hint">Sin fotos publicas.</p>';
    try {
        const { data: items } = await window.supabase.storage.from('model-gallery')
            .list(modelId, { limit: 50, sortBy: { column: 'created_at', order: 'desc' } });
        if (items && items.length) {
            const bucket = window.supabase.storage.from('model-gallery');
            galleryHtml = '<div class="gallery-grid">' + items.map(i =>
                `<div class="gallery-item"><img src="${bucket.getPublicUrl(`${modelId}/${i.name}`).data.publicUrl}" alt="Foto"></div>`).join('') + '</div>';
        }
    } catch (e) {}

    const headAvatar = p.avatar_url
        ? `<img src="${p.avatar_url}" alt="${p.full_name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
        : (p.full_name || 'M').charAt(0).toUpperCase();

    const canCall = isClient && p.is_online && !p.in_call && level;
    const canOffer = isClient && level;

    body.innerHTML = `
        <div class="modal-head">
            <div class="model-avatar modal-avatar">${headAvatar}</div>
            <div><h3 class="modal-title">${p.full_name}</h3>
            <div class="model-meta">${level ? `<span class="level-badge">${level.name}</span> ` : ''}${starsHtml(p.rating)}</div></div>
        </div>
        <div class="info-row"><span class="info-label">Tarifa</span><span class="info-value">${clientRate} tokens/min</span></div>
        <div class="info-row"><span class="info-label">Especialidad</span><span class="info-value">${d.specialty || 'General'}</span></div>
        <div class="info-row"><span class="info-label">Estado</span><span class="info-value">${p.in_call ? 'En llamada' : (p.is_online ? 'En linea' : 'Desconectada')}</span></div>
        ${d.bio ? `<p class="modal-bio">${d.bio}</p>` : ''}
        <h4 class="gallery-title">Galeria</h4>${galleryHtml}
        ${canCall ? '<button class="btn" style="margin-top:16px;width:100%;" id="callBtn">Iniciar llamada (' + clientRate + ' tokens/min)</button>' : ''}
        ${canOffer ? `
            <h4 class="gallery-title">Enviar oferta de show</h4>
            <div class="form-row"><label for="offerAmount">Monto total (tokens)</label><input id="offerAmount" type="number" min="1" value="50"></div>
            <div class="form-row"><label for="offerMinutes">Minutos</label><input id="offerMinutes" type="number" min="1" value="10"></div>
            <div class="form-row"><label for="offerDesc">Descripcion (opcional)</label><input id="offerDesc" type="text" maxlength="120"></div>
            <button class="btn btn-secondary" style="width:100%;" id="offerBtn">Enviar oferta</button>` : ''}
    `;

    const cb = document.getElementById('callBtn');
    if (cb) cb.addEventListener('click', () => { closeModelModal(); if (window.CND_startCall) window.CND_startCall(modelId); });

    const ob = document.getElementById('offerBtn');
    if (ob) ob.addEventListener('click', async () => {
        const amount = Number(document.getElementById('offerAmount').value);
        const minutes = Number(document.getElementById('offerMinutes').value);
        const desc = document.getElementById('offerDesc').value.trim();
        if (!amount || !minutes) { window.showToast('Monto y minutos obligatorios', 'error'); return; }
        try {
            const { error } = await window.supabase.rpc('create_show_offer', {
                p_model: modelId, p_amount: amount, p_minutes: minutes, p_desc: desc });
            if (error) throw error;
            window.showToast('Oferta enviada a la modelo', 'success');
            closeModelModal();
        } catch (err) { window.showToast(err.message || 'No se pudo enviar', 'error'); }
    });
}
window.openModelProfile = openModelProfile;

function closeModelModal() {
    const o = document.getElementById('modelModal');
    if (o) o.classList.remove('active');
}
window.closeModelModal = closeModelModal;

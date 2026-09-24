// ============================================================================
// CONDONIS - MODELS: Panel de modelo, KYC con URLs firmadas, listado, galería
// V2A.1: fix getPublicUrl (v2 devuelve {data:{publicUrl}}) y KYC privado
// con createSignedUrl para visualización segura.
// ============================================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Tipos de documento KYC aceptados (reflejados legalmente en los TyC)
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

// ============================================================================
// initModels: arranque del módulo (lo llama core.js vía onAppReady)
// ============================================================================
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

    // Delegación de clics en tarjetas (una sola vez, regla A12)
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

    // Cierre del modal único: botón X y clic en el fondo
    const overlay = document.getElementById('modelModal');
    const closeBtn = document.getElementById('modelModalClose');
    if (closeBtn) closeBtn.addEventListener('click', closeModelModal);
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModelModal();
        });
    }

    await loadActiveModels();
}

window.onAppReady = initModels;

// ============================================================================
// loadActiveModels: refresca según rol (panel modelo o listado cliente)
// ============================================================================
async function loadActiveModels() {
    const user = window.appState.currentUser;
    if (!user || !user.profile) return;
    const container = document.getElementById('modelsContainer');
    if (!container) return;

    if (user.profile.role === 'model') {
        renderModelHome();
        return;
    }

    const models = await fetchActiveModels();
    window.appState.models = models || [];

    if (models && models.length > 0) {
        container.innerHTML = models.map(cardHtml).join(''); // reemplazo total
    } else {
        container.innerHTML = '<p class="empty-note">No hay modelos disponibles en este momento. Vuelve en unos minutos.</p>';
    }
}

window.loadActiveModels = loadActiveModels;

// ============================================================================
// fetchActiveModels: RPC con fallback (regla A11)
// ============================================================================
async function fetchActiveModels() {
    try {
        const { data, error } = await window.supabase.rpc('get_active_models');
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.warn('RPC get_active_models no disponible, usando fallback:', err);
        const since = new Date(Date.now() - window.CND_CONFIG.PRESENCE_TIMEOUT).toISOString();
        const { data } = await window.supabase
            .from('profiles')
            .select('id, full_name, avatar_url, rating, is_online, in_call')
            .eq('role', 'model')
            .eq('kyc_status', 'approved')
            .eq('is_banned', false)
            .eq('is_active', true)
            .eq('is_online', true)
            .gte('last_seen', since);

        return (data || []).map(p => ({
            id: p.id, full_name: p.full_name, avatar_url: p.avatar_url,
            rating: p.rating, is_online: p.is_online, in_call: p.in_call,
            client_rate: 0, model_rate: 0, level_name: 'Sin nivel', worker_level: 1
        }));
    }
}

// ============================================================================
// cardHtml: tarjeta de modelo del grid (sin emojis, regla D1)
// ============================================================================
function cardHtml(m) {
    const initial = (m.full_name || 'M').charAt(0).toUpperCase();
    const rate = Number(m.client_rate || 0);
    const badge = m.in_call
        ? '<span class="model-status badge-incall">En llamada</span>'
        : '<span class="model-status status-online">En linea</span>';

    return `
        <div class="model-card" data-id="${m.id}" role="button" tabindex="0" aria-label="Ver perfil de ${m.full_name}">
            <div class="model-avatar">${initial}</div>
            <div class="model-info">
                <div class="model-name">${m.full_name}</div>
                <div class="model-rate">${rate} tokens/min</div>
                <div class="model-meta">
                    <span class="level-badge">${m.level_name || 'Modelo'}</span>
                    ${starsHtml(m.rating)}
                </div>
                ${badge}
            </div>
        </div>
    `;
}

// ============================================================================
// starsHtml: cinco estrellas SVG según rating redondeado
// ============================================================================
function starsHtml(rating) {
    const full = Math.round(Number(rating || 0));
    let out = '<span class="stars" aria-label="Calificacion ' + full + ' de 5">';
    for (let i = 1; i <= 5; i++) {
        const cls = i <= full ? '' : ' class="off"';
        out += `<svg${cls} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z"/></svg>`;
    }
    return out + '</span>';
}

// ============================================================================
// renderModelHome: home de modelo (KYC + disponibilidad + nivel + galería)
// ============================================================================
async function renderModelHome() {
    const user = window.appState.currentUser;
    const profile = user.profile;
    const zone = document.getElementById('availabilityZone');
    const container = document.getElementById('modelsContainer');
    if (!zone || !container) return;

    const kycStatus = profile.kyc_status;
    const kycOk = kycStatus === 'approved';
    const level = ownDetails && ownDetails.level_id
        ? await fetchLevel(ownDetails.level_id) : null;

    const clientRate = level ? Number(level.rate_per_minute) : 0;
    const modelRate = level ? Number(level.rate_per_minute) * 0.5 : 0;

    // Bloque KYC según estado actual
    let kycBlock = '';
    if (kycOk) {
        kycBlock = `
            <div class="card kyc-card kyc-ok">
                <div class="card-header">
                    <span class="card-title">Verificacion KYC</span>
                    <span class="kyc-badge kyc-approved">Aprobada</span>
                </div>
                <p class="hint">Tu identidad esta verificada. Ya eres visible para los clientes.</p>
                <button class="btn btn-secondary" id="btnViewKycDocs">Ver mis documentos</button>
            </div>
        `;
    } else if (kycStatus === 'pending') {
        kycBlock = `
            <div class="card kyc-card kyc-pending">
                <div class="card-header">
                    <span class="card-title">Verificacion KYC</span>
                    <span class="kyc-badge kyc-pending">En revision</span>
                </div>
                <p class="hint">Tus documentos estan en revision por un administrador.</p>
                <button class="btn btn-secondary" id="btnViewKycDocs">Ver mis documentos</button>
            </div>
        `;
    } else if (kycStatus === 'rejected') {
        kycBlock = `
            <div class="card kyc-card kyc-rejected">
                <div class="card-header">
                    <span class="card-title">Verificacion KYC</span>
                    <span class="kyc-badge kyc-rejected">Rechazada</span>
                </div>
                <p class="hint kyc-warn">Tus documentos fueron rechazados. Sube documentos validos y vuelve a enviarlos.</p>
                <button class="btn" id="btnOpenKyc">Reenviar documentos</button>
            </div>
        `;
    } else {
        kycBlock = `
            <div class="card kyc-card kyc-none">
                <div class="card-header">
                    <span class="card-title">Verificacion KYC obligatoria</span>
                    <span class="kyc-badge kyc-none">Pendiente</span>
                </div>
                <p class="hint">Por seguridad y cumplimiento legal, debes verificar tu identidad antes de recibir llamadas. Solo seras visible cuando un administrador apruebe tus documentos.</p>
                <button class="btn" id="btnOpenKyc">Iniciar verificacion</button>
            </div>
        `;
    }

    // Disponibilidad: solo si KYC aprobado
    const availBlock = kycOk ? `
        <div class="card avail-card">
            <div class="card-header">
                <span class="card-title">Disponibilidad</span>
                <span class="avail-state ${presenceOnline ? 'on' : 'off'}">${presenceOnline ? 'En linea' : 'Desconectada'}</span>
            </div>
            <label class="switch" aria-label="Alternar disponibilidad">
                <input type="checkbox" id="availSwitch" ${presenceOnline ? 'checked' : ''}>
                <span class="slider"></span>
            </label>
            <p class="hint">Al activarte, los clientes te ven en menos de 2 segundos.</p>
        </div>
    ` : '';

    // Nivel asignado por admin (solo lectura para la modelo)
    const levelBlock = `
        <div class="card">
            <div class="card-header">
                <span class="card-title">Mi nivel</span>
                ${level ? `<span class="level-badge big">${level.name}</span>` : '<span class="kyc-badge kyc-none">Sin nivel</span>'}
            </div>
            ${level ? `
                <div class="info-row">
                    <span class="info-label">El cliente paga</span>
                    <span class="info-value">${Number(level.rate_per_minute)} tokens/min</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Tu ganas (50%)</span>
                    <span class="info-value">${modelRate} tokens/min</span>
                </div>
                <p class="hint">El administrador asigna y modifica los niveles y tarifas.</p>
            ` : `
                <p class="hint">Aun no tienes un nivel asignado. El administrador debe asignartelo cuando apruebe tu KYC.</p>
            `}
        </div>
    `;

    // Bio y especialidad editables por la modelo
    const bioBlock = `
        <div class="card">
            <div class="card-header"><span class="card-title">Mi perfil publico</span></div>
            <div class="form-row">
                <label for="editSpecialty">Especialidad</label>
                <input id="editSpecialty" type="text" maxlength="60" value="${ownDetails && ownDetails.specialty ? ownDetails.specialty : ''}">
            </div>
            <div class="form-row">
                <label for="editBio">Biografia corta</label>
                <textarea id="editBio" rows="3" maxlength="240">${ownDetails && ownDetails.bio ? ownDetails.bio : ''}</textarea>
            </div>
            <button class="btn" id="saveProfileBtn">Guardar cambios</button>
        </div>
    `;

    // Galería pública de la modelo
    const galleryBlock = `
        <div class="card">
            <div class="card-header"><span class="card-title">Mi galeria</span></div>
            <button class="btn btn-secondary" id="galleryPick">Subir foto</button>
            <input type="file" id="galleryFile" accept="image/png,image/jpeg,image/webp" style="display:none">
            <div id="galleryGrid" class="gallery-grid"></div>
        </div>
    `;

    zone.innerHTML = kycBlock + availBlock + levelBlock + bioBlock + galleryBlock;

    // Vista previa de cómo te ve el cliente
    if (kycOk && level) {
        container.innerHTML = cardHtml({
            id: profile.id, full_name: profile.full_name,
            rating: profile.rating, is_online: presenceOnline,
            in_call: profile.in_call, client_rate: clientRate,
            model_rate: modelRate, level_name: level.name,
            worker_level: ownDetails ? ownDetails.worker_level : 1
        });
    } else {
        container.innerHTML = '<p class="hint" style="margin-top:20px;">Previsualizacion disponible cuando tengas KYC aprobado y nivel asignado.</p>';
    }

    bindModelHomeEvents();
    await renderGallery();
}

// ============================================================================
// fetchLevel: datos de un nivel por id
// ============================================================================
async function fetchLevel(levelId) {
    const { data } = await window.supabase
        .from('kyc_levels')
        .select('*')
        .eq('id', levelId)
        .single();
    return data;
}

// ============================================================================
// bindModelHomeEvents: listeners del panel de modelo
// ============================================================================
function bindModelHomeEvents() {
    const openKyc = document.getElementById('btnOpenKyc');
    const viewDocs = document.getElementById('btnViewKycDocs');
    if (openKyc) openKyc.addEventListener('click', openKycModal);
    if (viewDocs) viewDocs.addEventListener('click', openKycModal);

    const switchEl = document.getElementById('availSwitch');
    if (switchEl) switchEl.addEventListener('change', () => setPresence(switchEl.checked));

    const saveBtn = document.getElementById('saveProfileBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveModelProfile);

    const pickBtn = document.getElementById('galleryPick');
    const fileInput = document.getElementById('galleryFile');
    if (pickBtn && fileInput) {
        pickBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => uploadGalleryFile(fileInput));
    }
}

// ============================================================================
// KYC: modal de subida y estado de documentos
// ============================================================================
async function openKycModal() {
    const overlay = document.getElementById('modelModal');
    const body = document.getElementById('modelModalBody');
    if (!overlay || !body) return;

    body.innerHTML = `
        <h3 class="modal-title">Verificacion de identidad (KYC)</h3>
        <p class="hint" style="margin-bottom:16px;">
            Sube documentos validos y legibles. Toda la informacion es tratada
            de forma confidencial segun nuestra Politica de Privacidad y los
            Terminos y Condiciones que aceptaste al registrarte.
        </p>
        <div id="kycDocsList"></div>
        <button class="btn" id="kycSubmitBtn" style="margin-top:16px;">Enviar para revision</button>
    `;
    overlay.classList.add('active');

    await renderKycDocs();

    const submitBtn = document.getElementById('kycSubmitBtn');
    if (submitBtn) submitBtn.addEventListener('click', submitKyc);
}

// ============================================================================
// renderKycDocs: filas por tipo de documento con estado y acciones
// ============================================================================
async function renderKycDocs() {
    const user = window.appState.currentUser;
    const list = document.getElementById('kycDocsList');
    if (!list) return;

    const { data: docs } = await window.supabase
        .from('kyc_documents')
        .select('*')
        .eq('model_id', user.id)
        .order('created_at', { ascending: false });

    list.innerHTML = KYC_DOC_TYPES.map(t => {
        const doc = docs && docs.find(d => d.doc_type === t.id);
        let statusHtml = '';
        let viewBtn = '';
        if (doc) {
            if (doc.status === 'approved') {
                statusHtml = '<span class="kyc-badge kyc-approved">Aprobado</span>';
            } else if (doc.status === 'rejected') {
                statusHtml = `<span class="kyc-badge kyc-rejected">Rechazado${doc.rejection_reason ? ': ' + doc.rejection_reason : ''}</span>`;
            } else {
                statusHtml = '<span class="kyc-badge kyc-pending">En revision</span>';
            }
            // Ver documento propio mediante URL firmada (bucket privado)
            viewBtn = `<button class="btn btn-secondary kyc-view-btn" data-path="${doc.file_url}">Ver</button>`;
        }
        return `
            <div class="kyc-doc-row">
                <div class="kyc-doc-info">
                    <div class="kyc-doc-label">${t.label} ${t.required ? '<span class="required">*</span>' : ''}</div>
                    <div>${statusHtml}</div>
                </div>
                <div class="kyc-doc-action" style="display:flex;gap:8px;">
                    ${viewBtn}
                    <input type="file" class="kyc-file-input" data-type="${t.id}" accept="image/png,image/jpeg,image/webp" style="display:none">
                    <button class="btn btn-secondary kyc-upload-btn" data-type="${t.id}">${doc ? 'Reemplazar' : 'Subir'}</button>
                </div>
            </div>
        `;
    }).join('');

    // Botones de subida
    list.querySelectorAll('.kyc-upload-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            const input = list.querySelector(`.kyc-file-input[data-type="${type}"]`);
            if (input) input.click();
        });
    });

    // Inputs de archivo
    list.querySelectorAll('.kyc-file-input').forEach(input => {
        input.addEventListener('change', () => uploadKycFile(input, input.dataset.type));
    });

    // Botones Ver (URL firmada)
    list.querySelectorAll('.kyc-view-btn').forEach(btn => {
        btn.addEventListener('click', () => viewKycDoc(btn.dataset.path));
    });
}

// ============================================================================
// viewKycDoc: abre un documento propio con URL firmada de 1 hora
// ============================================================================
async function viewKycDoc(path) {
    try {
        const { data, error } = await window.supabase.storage
            .from('kyc-docs')
            .createSignedUrl(path, 3600);
        if (error) throw error;
        window.open(data.signedUrl, '_blank', 'noopener');
    } catch (err) {
        console.error('Error al abrir documento KYC:', err);
        window.showToast('No se pudo abrir el documento', 'error');
    }
}

// ============================================================================
// uploadKycFile: sube al bucket privado y guarda la RUTA en file_url
// ============================================================================
async function uploadKycFile(input, docType) {
    const user = window.appState.currentUser;
    const file = input.files && input.files[0];
    if (!file) return;

    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const path = `${user.id}/${docType}-${Date.now()}-${safeName}`;

    try {
        // 1) Subir el archivo al bucket privado kyc-docs
        const { error: upErr } = await window.supabase.storage
            .from('kyc-docs')
            .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;

        // 2) Reemplazar registro previo del mismo tipo
        await window.supabase
            .from('kyc_documents')
            .delete()
            .eq('model_id', user.id)
            .eq('doc_type', docType);

        // 3) Insertar registro con la RUTA (no URL pública: bucket privado)
        const { error: dbErr } = await window.supabase
            .from('kyc_documents')
            .insert({
                model_id: user.id,
                doc_type: docType,
                file_url: path,
                status: 'pending'
            });
        if (dbErr) throw dbErr;

        // 4) Primera subida: el perfil pasa a pending
        if (window.appState.currentUser.profile.kyc_status === 'none') {
            await window.supabase
                .from('profiles')
                .update({ kyc_status: 'pending' })
                .eq('id', user.id);
            window.appState.currentUser.profile.kyc_status = 'pending';
        }

        window.showToast('Documento subido correctamente', 'success');
        await renderKycDocs();
        await renderModelHome();
    } catch (err) {
        console.error('Error al subir documento KYC:', err);
        window.showToast('No se pudo subir el documento', 'error');
    }

    input.value = '';
}

// ============================================================================
// submitKyc: valida obligatorios y deja el perfil en pending
// ============================================================================
async function submitKyc() {
    const user = window.appState.currentUser;

    const { data: docs } = await window.supabase
        .from('kyc_documents')
        .select('doc_type, status')
        .eq('model_id', user.id);

    const submitted = (docs || []).map(d => d.doc_type);
    const missing = KYC_DOC_TYPES.filter(t => t.required && !submitted.includes(t.id));

    if (missing.length > 0) {
        window.showToast('Faltan documentos obligatorios: ' + missing.map(m => m.label).join(', '), 'error');
        return;
    }

    if (user.profile.kyc_status !== 'pending' && user.profile.kyc_status !== 'approved') {
        await window.supabase
            .from('profiles')
            .update({ kyc_status: 'pending' })
            .eq('id', user.id);
        user.profile.kyc_status = 'pending';
    }

    window.showToast('Documentos enviados para revision', 'success');
    closeModelModal();
    await renderModelHome();
}

window.openKycModal = openKycModal;

// ============================================================================
// Presencia: toggle inmediato + heartbeat + beacon offline (P1-P3)
// ============================================================================
async function setPresence(on) {
    const user = window.appState.currentUser;
    if (!user.profile || user.profile.kyc_status !== 'approved') {
        window.showToast('No puedes activarte hasta que tu KYC sea aprobado', 'error');
        await renderModelHome();
        return;
    }
    presenceOnline = on;
    try {
        await window.supabase
            .from('profiles')
            .update({ is_online: on, last_seen: new Date().toISOString() })
            .eq('id', user.id);
        if (on) startHeartbeat(); else stopHeartbeat();
        window.showToast(on ? 'Estas en linea' : 'Te has desconectado', 'success');
        await renderModelHome();
    } catch (err) {
        console.error('Error al cambiar disponibilidad:', err);
        window.showToast('No se pudo cambiar tu disponibilidad', 'error');
        await renderModelHome();
    }
}

function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => touchPresence(true), window.CND_CONFIG.HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
}

async function touchPresence(on) {
    const user = window.appState.currentUser;
    if (!user) return;
    try {
        await window.supabase
            .from('profiles')
            .update({ is_online: on, last_seen: new Date().toISOString() })
            .eq('id', user.id);
    } catch (err) {
        console.error('Heartbeat fallo:', err);
    }
}

function beaconOffline() {
    if (!presenceOnline) return;
    presenceOnline = false;
    stopHeartbeat();
    const user = window.appState.currentUser;
    if (!user || !accessToken) return;
    fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
        method: 'PATCH',
        keepalive: true,
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ is_online: false, last_seen: new Date().toISOString() })
    }).catch(() => {});
}

// ============================================================================
// Perfil público editable (bio/especialidad) y galería pública
// ============================================================================
async function loadOwnDetails() {
    const user = window.appState.currentUser;
    try {
        const { data } = await window.supabase
            .from('role_details')
            .select('*')
            .eq('user_id', user.id)
            .single();
        ownDetails = data || null;
    } catch (err) {
        ownDetails = null;
    }
}

async function saveModelProfile() {
    const user = window.appState.currentUser;
    const specialty = document.getElementById('editSpecialty').value.trim();
    const bio = document.getElementById('editBio').value.trim();

    try {
        const { error } = await window.supabase
            .from('role_details')
            .update({ specialty, bio })
            .eq('user_id', user.id);
        if (error) throw error;
        ownDetails = { ...(ownDetails || {}), specialty, bio };
        window.showToast('Perfil publico actualizado', 'success');
    } catch (err) {
        console.error('Error al guardar perfil:', err);
        window.showToast('No se pudo guardar tu perfil', 'error');
    }
}

async function renderGallery() {
    const user = window.appState.currentUser;
    const grid = document.getElementById('galleryGrid');
    if (!grid || !user || user.profile.role !== 'model') return;

    const { data, error } = await window.supabase.storage
        .from('model-gallery')
        .list(user.id, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

    if (error || !data || data.length === 0) {
        grid.innerHTML = '<p class="hint">Aun no tienes fotos en tu galeria.</p>';
        return;
    }

    const bucket = window.supabase.storage.from('model-gallery');
    grid.innerHTML = data.map(item => {
        const path = `${user.id}/${item.name}`;
        // v2: getPublicUrl devuelve { data: { publicUrl } }
        const url = bucket.getPublicUrl(path).data.publicUrl;
        return `
            <div class="gallery-item">
                <img src="${url}" alt="Foto de galeria">
                <button class="gallery-del" data-path="${path}" aria-label="Eliminar foto">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>
        `;
    }).join('');

    grid.querySelectorAll('.gallery-del').forEach(btn => {
        btn.addEventListener('click', () => deleteGalleryFile(btn.dataset.path));
    });
}

async function uploadGalleryFile(input) {
    const user = window.appState.currentUser;
    const file = input.files && input.files[0];
    if (!file) return;
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const path = `${user.id}/${Date.now()}-${safeName}`;
    try {
        const { error } = await window.supabase.storage
            .from('model-gallery')
            .upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        window.showToast('Foto subida', 'success');
        await renderGallery();
    } catch (err) {
        console.error('Error al subir foto:', err);
        window.showToast('No se pudo subir la foto', 'error');
    }
    input.value = '';
}

async function deleteGalleryFile(path) {
    try {
        const { error } = await window.supabase.storage.from('model-gallery').remove([path]);
        if (error) throw error;
        window.showToast('Foto eliminada', 'success');
        await renderGallery();
    } catch (err) {
        window.showToast('No se pudo eliminar la foto', 'error');
    }
}

// ============================================================================
// openModelProfile: modal único con perfil público (vista del cliente)
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
    } catch (err) {
        const { data } = await window.supabase
            .from('profiles').select('*').eq('id', modelId).single();
        payload = { profile: data, details: null };
    }

    const p = payload && payload.profile;
    if (!p) {
        body.innerHTML = '<p class="hint">Este perfil ya no esta disponible.</p>';
        return;
    }

    const d = payload.details || {};
    const level = d.level_id ? await fetchLevel(d.level_id) : null;
    const clientRate = level ? Number(level.rate_per_minute) : 0;

    let galleryHtml = '<p class="hint">Sin fotos publicas todavia.</p>';
    try {
        const { data: items } = await window.supabase.storage
            .from('model-gallery')
            .list(modelId, { limit: 50, sortBy: { column: 'created_at', order: 'desc' } });
        if (items && items.length > 0) {
            const bucket = window.supabase.storage.from('model-gallery');
            galleryHtml = '<div class="gallery-grid">' + items.map(item => {
                // v2: getPublicUrl devuelve { data: { publicUrl } }
                const url = bucket.getPublicUrl(`${modelId}/${item.name}`).data.publicUrl;
                return `<div class="gallery-item"><img src="${url}" alt="Foto de galeria"></div>`;
            }).join('') + '</div>';
        }
    } catch (err) {
        galleryHtml = '<p class="hint">Galeria no disponible por ahora.</p>';
    }

    body.innerHTML = `
        <div class="modal-head">
            <div class="model-avatar modal-avatar">${(p.full_name || 'M').charAt(0).toUpperCase()}</div>
            <div>
                <h3 class="modal-title">${p.full_name}</h3>
                <div class="model-meta">${level ? `<span class="level-badge">${level.name}</span> ` : ''}${starsHtml(p.rating)}</div>
            </div>
        </div>
        <div class="info-row"><span class="info-label">Tarifa</span><span class="info-value">${clientRate} tokens/min</span></div>
        <div class="info-row"><span class="info-label">Especialidad</span><span class="info-value">${d.specialty || 'General'}</span></div>
        <div class="info-row"><span class="info-label">Estado</span><span class="info-value">${p.in_call ? 'En llamada' : 'En linea'}</span></div>
        ${d.bio ? `<p class="modal-bio">${d.bio}</p>` : ''}
        <h4 class="gallery-title">Galeria</h4>
        ${galleryHtml}
        ${!p.in_call ? '<button class="btn" style="margin-top:16px;width:100%;" id="callBtn">Iniciar llamada</button>' : ''}
    `;

    const callBtn = document.getElementById('callBtn');
    if (callBtn) callBtn.addEventListener('click', () => {
        window.showToast('Llamadas disponibles en la proxima entrega', 'info');
    });
}

window.openModelProfile = openModelProfile;

function closeModelModal() {
    const overlay = document.getElementById('modelModal');
    if (overlay) overlay.classList.remove('active');
}

window.closeModelModal = closeModelModal;

// ============================================================================
// CONDONIS - MODELS: Listado en vivo, perfil público con galería y presencia
// Reglas que cumple: P1-P6 (presencia), A5-A7 (RPC robusta, innerHTML=,
// debounce), A11 (fallback si RPC falta), A12 (modal único reutilizable).
// ============================================================================

// Credenciales para el beacon offline (fetch keepalive al cerrar pestaña)
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Estado LOCAL del módulo (no global, para no colisionar, regla A2)
let modelsClickBound = false;  // delegación de clics atada una sola vez
let presenceOnline = false;    // disponibilidad propia de la modelo
let heartbeatTimer = null;     // id del intervalo de heartbeat (20s)
let accessToken = '';          // JWT vigente para el beacon de salida
let ownDetails = null;         // role_details propio cacheado (editor)

// ============================================================================
// FUNCIÓN: initModels()
// Arranque del módulo: lo invoca core.js vía window.onAppReady cuando el
// perfil ya está cargado. Configura presencia (modelos) y primer render.
// ============================================================================
async function initModels() {
    const user = window.appState.currentUser;
    if (!user || !user.profile) return; // seguridad: sin perfil aún

    if (user.profile.role === 'model') {
        // Guardar JWT para el beacon offline de pagehide (regla P3)
        const { data } = await window.supabase.auth.getSession();
        accessToken = data.session ? data.session.access_token : '';

        // Estado inicial de presencia leído del perfil (sin auto-encender)
        presenceOnline = !!user.profile.is_online;

        // Cargar role_details propio para prellenar el editor
        await loadOwnDetails();

        // Si entró ya marcada online (sesión previa), reanudar heartbeat
        if (presenceOnline) startHeartbeat();

        // Al cerrar/ocultar pestaña: marcar offline de inmediato (P3)
        window.addEventListener('pagehide', beaconOffline);
    }

    // Delegación de clics en las tarjetas (una sola vez, regla A12)
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

    // Cerrar modal de perfil: botón X y clic fuera de la tarjeta
    const overlay = document.getElementById('modelModal');
    const closeBtn = document.getElementById('modelModalClose');
    if (closeBtn) closeBtn.addEventListener('click', closeModelModal);
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModelModal(); // clic en el fondo
        });
    }

    await loadActiveModels(); // primer pintado del listado o del home modelo
}

// core.js llama a esta función cuando la sesión y el perfil están listos
window.onAppReady = initModels;

// ============================================================================
// FUNCIÓN: loadActiveModels()
// Refresca el contenedor según rol: modelos ven su panel; el resto ve el
// listado de modelos online. Siempre innerHTML = completo (regla A6).
// ============================================================================
async function loadActiveModels() {
    const user = window.appState.currentUser;
    if (!user || !user.profile) return; // aún no listo: core reintentará

    const container = document.getElementById('modelsContainer');
    if (!container) return;

    // Rol modelo: su panel de disponibilidad, editor y galería
    if (user.profile.role === 'model') {
        renderModelHome();
        return;
    }

    // Cliente/admin/agencia: listado de modelos activas ahora
    const models = await fetchActiveModels();
    window.appState.models = models || [];

    if (models && models.length > 0) {
        container.innerHTML = models.map(cardHtml).join(''); // reemplazo total
    } else {
        container.innerHTML = '<p class="empty-note">No hay modelos disponibles en este momento. Vuelve en unos minutos.</p>';
    }
}

// Expuesta global: core.js la llama con debounce de 150ms en cada UPDATE
// de profiles recibido por Realtime (reglas P5/A7)
window.loadActiveModels = loadActiveModels;

// ============================================================================
// FUNCIÓN: fetchActiveModels()
// Obtiene modelos online vía RPC get_active_models; si la RPC faltara,
// aplica fallback directo sobre profiles (regla A11).
// ============================================================================
async function fetchActiveModels() {
    try {
        const { data, error } = await window.supabase.rpc('get_active_models');
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.warn('RPC get_active_models no disponible, usando fallback:', err);

        // Fallback: mismas condiciones de presencia, sin tarifa (RLS)
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
            id: p.id,
            full_name: p.full_name,
            avatar_url: p.avatar_url,
            rating: p.rating,
            is_online: p.is_online,
            in_call: p.in_call,
            client_rate: null,   // sin tarifa en fallback: se muestra guion
            worker_level: 1
        }));
    }
}

// ============================================================================
// FUNCIÓN: cardHtml()
// Construye el HTML de una tarjeta de modelo (sin emojis, regla D1)
// ============================================================================
function cardHtml(m) {
    const initial = (m.full_name || 'M').charAt(0).toUpperCase();
    const rate = (m.client_rate === null || m.client_rate === undefined)
        ? '--'
        : Number(m.client_rate);
    const badge = m.in_call
        ? '<span class="model-status badge-incall">En llamada</span>'
        : '<span class="model-status status-online">En linea</span>';

    return `
        <div class="model-card" data-id="${m.id}" role="button" tabindex="0" aria-label="Ver perfil de ${m.full_name}">
            <div class="model-avatar">${initial}</div>
            <div class="model-info">
                <div class="model-name">${m.full_name}</div>
                <div class="model-rate">${rate} tokens/min</div>
                <div class="model-meta">Nivel ${m.worker_level || 1} ${starsHtml(m.rating)}</div>
                ${badge}
            </div>
        </div>
    `;
}

// ============================================================================
// FUNCIÓN: starsHtml()
// Cinco estrellas SVG; las llenas según el rating redondeado (regla D4)
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
// FUNCIÓN: renderModelHome()
// Home exclusivo de modelos: disponibilidad, editor público y galería,
// más la vista previa de cómo la ven los clientes.
// ============================================================================
async function renderModelHome() {
    const user = window.appState.currentUser;
    const profile = user.profile;
    const zone = document.getElementById('availabilityZone');
    const container = document.getElementById('modelsContainer');
    if (!zone || !container) return;

    const kycOk = profile.kyc_status === 'approved';
    const clientRate = ownDetails ? Number(ownDetails.rate_per_minute || 0) * 2 : 0;

    // Aviso honesto de KYC pendiente (no aparece en listados hasta aprobar)
    const kycNotice = kycOk ? '' : `
        <p class="hint kyc-warn">Tu KYC esta en estado "${profile.kyc_status}". No apareceras en los listados hasta que un administrador lo apruebe.</p>
    `;

    zone.innerHTML = `
        <div class="card avail-card">
            <div class="card-header">
                <span class="card-title">Disponibilidad</span>
                <span class="avail-state ${presenceOnline ? 'on' : 'off'}">${presenceOnline ? 'En linea' : 'Desconectada'}</span>
            </div>
            <label class="switch" aria-label="Alternar disponibilidad">
                <input type="checkbox" id="availSwitch" ${presenceOnline ? 'checked' : ''}>
                <span class="slider"></span>
            </label>
            <p class="hint">Al activarte, los clientes te ven en menos de 2 segundos. Al desactivarte, desapareces al instante. Tu estado se renueva solo cada 20 segundos mientras estes en linea.</p>
            ${kycNotice}
        </div>

        <div class="card">
            <div class="card-header"><span class="card-title">Mi perfil publico</span></div>
            <div class="form-row">
                <label for="editRate">Tarifa por minuto (tokens que tu recibes)</label>
                <input id="editRate" type="number" min="1" step="1" value="${ownDetails ? Number(ownDetails.rate_per_minute || 0) : 0}">
            </div>
            <p class="hint">El cliente vera el doble: <strong id="previewClientRate">${clientRate}</strong> tokens/min (comision de la app incluida).</p>
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

        <div class="card">
            <div class="card-header"><span class="card-title">Mi galeria</span></div>
            <button class="btn btn-secondary" id="galleryPick">Subir foto</button>
            <input type="file" id="galleryFile" accept="image/png,image/jpeg,image/webp" style="display:none">
            <div id="galleryGrid" class="gallery-grid"></div>
        </div>
    `;

    // Vista previa: así te ve el cliente cuando estás en línea
    container.innerHTML = cardHtml({
        id: profile.id,
        full_name: profile.full_name,
        rating: profile.rating,
        is_online: presenceOnline,
        in_call: profile.in_call,
        client_rate: clientRate,
        worker_level: ownDetails ? ownDetails.worker_level : 1
    });

    bindModelHomeEvents(); // listeners sobre nodos recién creados
    await renderGallery(); // pintar miniaturas existentes
}

// ============================================================================
// FUNCIÓN: bindModelHomeEvents()
// Ata listeners del panel de modelo (switch, editor, galería). Los nodos
// se recrean en cada render, por lo que no hay listeners duplicados.
// ============================================================================
function bindModelHomeEvents() {
    const switchEl = document.getElementById('availSwitch');
    if (switchEl) {
        switchEl.addEventListener('change', () => setPresence(switchEl.checked));
    }

    const rateEl = document.getElementById('editRate');
    const previewEl = document.getElementById('previewClientRate');
    if (rateEl && previewEl) {
        // Reflejo en vivo del precio que verá el cliente (tarifa x2)
        rateEl.addEventListener('input', () => {
            previewEl.textContent = String(Number(rateEl.value || 0) * 2);
        });
    }

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
// FUNCIÓN: setPresence()
// Toggle de disponibilidad: escribe is_online + last_seen DE INMEDIATO (P1)
// y arranca o detiene el heartbeat de 20s (P2).
// ============================================================================
async function setPresence(on) {
    const user = window.appState.currentUser;
    presenceOnline = on;

    try {
        const { error } = await window.supabase
            .from('profiles')
            .update({ is_online: on, last_seen: new Date().toISOString() })
            .eq('id', user.id);
        if (error) throw error;

        if (on) startHeartbeat(); else stopHeartbeat();

        window.showToast(on ? 'Estas en linea: los clientes ya pueden verte' : 'Te has desconectado del listado', 'success');
        await renderModelHome(); // refrescar switch, aviso y vista previa
    } catch (err) {
        console.error('Error al cambiar disponibilidad:', err);
        window.showToast('No se pudo cambiar tu disponibilidad', 'error');
        await renderModelHome(); // revertir visualmente al estado real
    }
}

// ============================================================================
// FUNCIÓN: startHeartbeat() / stopHeartbeat()
// Renuevan last_seen cada 20s mientras is_online === true (regla P2)
// ============================================================================
function startHeartbeat() {
    stopHeartbeat(); // evita intervalos apilados (regla A12)
    heartbeatTimer = setInterval(() => {
        touchPresence(true);
    }, window.CND_CONFIG.HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
}

// ============================================================================
// FUNCIÓN: touchPresence()
// Escritura simple de presencia (is_online + last_seen) sin UI
// ============================================================================
async function touchPresence(on) {
    const user = window.appState.currentUser;
    if (!user) return;
    try {
        await window.supabase
            .from('profiles')
            .update({ is_online: on, last_seen: new Date().toISOString() })
            .eq('id', user.id);
    } catch (err) {
        console.error('Heartbeat de presencia falló:', err);
    }
}

// ============================================================================
// FUNCIÓN: beaconOffline()
// Al cerrar u ocultar la pestaña marca offline con fetch keepalive, que
// sobrevive a la descarga de la página (regla P3).
// ============================================================================
function beaconOffline() {
    if (!presenceOnline) return; // ya estaba offline: nada que hacer
    presenceOnline = false;
    stopHeartbeat();

    const user = window.appState.currentUser;
    if (!user || !accessToken) return;

    // PATCH directo a PostgREST con keepalive: no requiere esperar respuesta
    fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
        method: 'PATCH',
        keepalive: true,
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ is_online: false, last_seen: new Date().toISOString() })
    }).catch(() => {}); // silencioso: la página ya se está cerrando
}

// ============================================================================
// FUNCIÓN: loadOwnDetails()
// Lee el role_details propio para prellenar tarifa, bio y especialidad
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
        ownDetails = null; // sin detalles aún: el editor partirá de cero
    }
}

// ============================================================================
// FUNCIÓN: saveModelProfile()
// Guarda tarifa, especialidad y bio en role_details propio (RLS: solo yo)
// ============================================================================
async function saveModelProfile() {
    const user = window.appState.currentUser;
    const rate = Number(document.getElementById('editRate').value || 0);
    const specialty = document.getElementById('editSpecialty').value.trim();
    const bio = document.getElementById('editBio').value.trim();

    if (!rate || rate < 1) {
        window.showToast('La tarifa debe ser al menos 1 token por minuto', 'error');
        return;
    }

    try {
        const { error } = await window.supabase
            .from('role_details')
            .update({ rate_per_minute: rate, specialty, bio })
            .eq('user_id', user.id);
        if (error) throw error;

        ownDetails = { ...(ownDetails || {}), rate_per_minute: rate, specialty, bio };
        window.showToast('Perfil publico actualizado', 'success');
        await renderModelHome(); // reflejar nuevo precio en la vista previa
    } catch (err) {
        console.error('Error al guardar perfil:', err);
        window.showToast('No se pudo guardar tu perfil', 'error');
    }
}

// ============================================================================
// FUNCIÓN: renderGallery()
// Lista los objetos de la carpeta propia en el bucket y pinta miniaturas
// ============================================================================
async function renderGallery() {
    const user = window.appState.currentUser;
    const grid = document.getElementById('galleryGrid');
    if (!grid || !user) return;

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
        const url = bucket.getPublicUrl(path).publicUrl;
        return `
            <div class="gallery-item">
                <img src="${url}" alt="Foto de galeria">
                <button class="gallery-del" data-path="${path}" aria-label="Eliminar foto">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>
        `;
    }).join('');

    // Delegación de borrado dentro de la galería
    grid.querySelectorAll('.gallery-del').forEach(btn => {
        btn.addEventListener('click', () => deleteGalleryFile(btn.dataset.path));
    });
}

// ============================================================================
// FUNCIÓN: uploadGalleryFile()
// Sube una imagen a la carpeta propia del bucket y refresca la galería
// ============================================================================
async function uploadGalleryFile(input) {
    const user = window.appState.currentUser;
    const file = input.files && input.files[0];
    if (!file) return;

    // Nombre seguro: marca de tiempo + nombre saneado sin espacios
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const path = `${user.id}/${Date.now()}-${safeName}`;

    try {
        const { error } = await window.supabase.storage
            .from('model-gallery')
            .upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;

        window.showToast('Foto subida a tu galeria', 'success');
        await renderGallery();
    } catch (err) {
        console.error('Error al subir foto:', err);
        window.showToast('No se pudo subir la foto', 'error');
    }

    input.value = ''; // permite re-subir el mismo archivo después
}

// ============================================================================
// FUNCIÓN: deleteGalleryFile()
// Borra un objeto de la galería propia (RLS de storage: solo la dueña)
// ============================================================================
async function deleteGalleryFile(path) {
    try {
        const { error } = await window.supabase.storage
            .from('model-gallery')
            .remove([path]);
        if (error) throw error;

        window.showToast('Foto eliminada', 'success');
        await renderGallery();
    } catch (err) {
        console.error('Error al eliminar foto:', err);
        window.showToast('No se pudo eliminar la foto', 'error');
    }
}

// ============================================================================
// FUNCIÓN: openModelProfile()
// Abre el modal único (regla A12) con perfil, tarifa, estrellas y galería
// ============================================================================
async function openModelProfile(modelId) {
    const body = document.getElementById('modelModalBody');
    const overlay = document.getElementById('modelModal');
    if (!body || !overlay) return;

    body.innerHTML = '<p class="hint">Cargando perfil...</p>';
    overlay.classList.add('active');

    // Perfil robusto vía RPC; fallback directo si la RPC faltara (A11)
    let payload = null;
    try {
        const { data, error } = await window.supabase.rpc('get_model_profile', { p_model_id: modelId });
        if (error) throw error;
        payload = data;
    } catch (err) {
        const { data } = await window.supabase
            .from('profiles')
            .select('*')
            .eq('id', modelId)
            .single();
        payload = { profile: data, details: null };
    }

    const p = payload && payload.profile;
    if (!p) {
        body.innerHTML = '<p class="hint">Este perfil ya no esta disponible.</p>';
        return;
    }

    const d = payload.details || {};
    const clientRate = Number(d.rate_per_minute || 0) * 2;

    // Galería pública de la modelo (bucket público: cualquier sesión lee)
    let galleryHtml = '<p class="hint">Sin fotos publicas todavia.</p>';
    try {
        const { data: items } = await window.supabase.storage
            .from('model-gallery')
            .list(modelId, { limit: 50, sortBy: { column: 'created_at', order: 'desc' } });

        if (items && items.length > 0) {
            const bucket = window.supabase.storage.from('model-gallery');
            galleryHtml = '<div class="gallery-grid">' + items.map(item => {
                const url = bucket.getPublicUrl(`${modelId}/${item.name}`).publicUrl;
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
                <div class="model-meta">Nivel ${d.worker_level || 1} ${starsHtml(p.rating)}</div>
            </div>
        </div>
        <div class="info-row"><span class="info-label">Tarifa cliente</span><span class="info-value">${clientRate} tokens/min</span></div>
        <div class="info-row"><span class="info-label">Gana la modelo</span><span class="info-value">${Number(d.rate_per_minute || 0)} tokens/min</span></div>
        <div class="info-row"><span class="info-label">Especialidad</span><span class="info-value">${d.specialty || 'General'}</span></div>
        <div class="info-row"><span class="info-label">Estado</span><span class="info-value">${p.in_call ? 'En llamada' : 'En linea'}</span></div>
        ${d.bio ? `<p class="modal-bio">${d.bio}</p>` : ''}
        <h4 class="gallery-title">Galeria</h4>
        ${galleryHtml}
    `;
}

// Expuesta global para tarjetas y futuros módulos
window.openModelProfile = openModelProfile;

// ============================================================================
// FUNCIÓN: closeModelModal()
// Cierra el modal de perfil (botón X o clic en el fondo)
// ============================================================================
function closeModelModal() {
    const overlay = document.getElementById('modelModal');
    if (overlay) overlay.classList.remove('active');
}

window.closeModelModal = closeModelModal;

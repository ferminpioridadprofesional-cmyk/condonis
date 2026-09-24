// ============================================================================
// CONDONIS - ADMIN: panel con KYC (URLs firmadas), niveles y modelos
// V2A.1: los documentos KYC se visualizan con createSignedUrl porque el
// bucket kyc-docs es privado por cumplimiento legal.
// ============================================================================

async function initAdmin() {
    const user = window.appState.currentUser;
    if (!user || !user.profile || user.profile.role !== 'admin') return;
    await renderAdminSection();
}

window.onAppReadyAdmin = initAdmin;

// ============================================================================
// renderAdminSection: contenedor con 3 pestañas
// ============================================================================
async function renderAdminSection() {
    const container = document.getElementById('adminContent');
    if (!container) return;

    container.innerHTML = `
        <div class="admin-tabs">
            <button class="admin-tab active" data-tab="kyc">KYC pendientes</button>
            <button class="admin-tab" data-tab="levels">Niveles y tarifas</button>
            <button class="admin-tab" data-tab="models">Todas las modelos</button>
        </div>
        <div id="adminTabContent"></div>
    `;

    container.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', async () => {
            container.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            await loadAdminTab(tab.dataset.tab);
        });
    });

    await loadAdminTab('kyc');
}

async function loadAdminTab(tab) {
    const content = document.getElementById('adminTabContent');
    if (!content) return;

    if (tab === 'kyc') await renderKycTab(content);
    else if (tab === 'levels') await renderLevelsTab(content);
    else if (tab === 'models') await renderModelsTab(content);
}

// ============================================================================
// Pestaña KYC: modelos pendientes o rechazadas
// ============================================================================
async function renderKycTab(content) {
    content.innerHTML = '<p class="hint">Cargando...</p>';

    let pending = [];
    try {
        const { data, error } = await window.supabase.rpc('list_kyc_pending');
        if (error) throw error;
        pending = data || [];
    } catch (err) {
        content.innerHTML = '<p class="hint">No se pudo cargar la lista.</p>';
        return;
    }

    if (pending.length === 0) {
        content.innerHTML = '<p class="hint">No hay modelos pendientes de revision.</p>';
        return;
    }

    content.innerHTML = pending.map(m => `
        <div class="card">
            <div class="card-header">
                <div>
                    <div class="card-title">${m.full_name}</div>
                    <div class="hint">${m.email}</div>
                </div>
                <span class="kyc-badge kyc-${m.kyc_status}">${m.kyc_status}</span>
            </div>
            <button class="btn btn-secondary" data-action="review" data-id="${m.id}">Revisar documentos</button>
        </div>
    `).join('');

    content.querySelectorAll('[data-action="review"]').forEach(btn => {
        btn.addEventListener('click', () => openKycReview(btn.dataset.id));
    });
}

// ============================================================================
// openKycReview: modal con imágenes firmadas + aprobar/rechazar + nivel
// ============================================================================
async function openKycReview(modelId) {
    const overlay = document.getElementById('modelModal');
    const body = document.getElementById('modelModalBody');
    if (!overlay || !body) return;

    body.innerHTML = '<p class="hint">Cargando documentos...</p>';
    overlay.classList.add('active');

    let docs = [];
    try {
        const { data, error } = await window.supabase.rpc('get_kyc_documents', { p_model_id: modelId });
        if (error) throw error;
        docs = data || [];
    } catch (err) {
        body.innerHTML = '<p class="hint">No se pudo cargar los documentos.</p>';
        return;
    }

    // Generar URL firmada por documento (bucket privado)
    const docsWithUrls = await Promise.all((docs).map(async d => {
        let url = d.file_url;
        // Si ya fuera una URL http legada, se usa tal cual
        if (!String(d.file_url).startsWith('http')) {
            try {
                const { data } = await window.supabase.storage
                    .from('kyc-docs')
                    .createSignedUrl(d.file_url, 3600);
                if (data && data.signedUrl) url = data.signedUrl;
            } catch (e) {
                console.warn('No se pudo firmar URL de', d.file_url);
            }
        }
        return Object.assign({}, d, { view_url: url });
    }));

    const { data: model } = await window.supabase
        .from('profiles').select('full_name, email').eq('id', modelId).single();

    const { data: levels } = await window.supabase
        .from('kyc_levels').select('*').eq('is_active', true).order('sort_order');
    const levelOptions = (levels || []).map(l =>
        `<option value="${l.id}">${l.name} (${Number(l.rate_per_minute)} tokens/min)</option>`
    ).join('');

    body.innerHTML = `
        <h3 class="modal-title">Revision KYC</h3>
        <p class="hint">${model ? model.full_name + ' — ' + model.email : ''}</p>
        <div class="kyc-review-list">
            ${docsWithUrls.length === 0 ? '<p class="hint">No hay documentos subidos.</p>' :
                docsWithUrls.map(d => `
                    <div class="kyc-review-item">
                        <div class="kyc-review-label">${d.doc_type}</div>
                        <a href="${d.view_url}" target="_blank" rel="noopener">
                            <img src="${d.view_url}" alt="${d.doc_type}" class="kyc-review-img">
                        </a>
                    </div>
                `).join('')
            }
        </div>
        <div class="form-row" style="margin-top:16px;">
            <label for="kycLevel">Asignar nivel (al aprobar)</label>
            <select id="kycLevel">${levelOptions}</select>
        </div>
        <div class="form-row">
            <label for="kycRejectReason">Motivo de rechazo (solo si rechazas)</label>
            <input id="kycRejectReason" type="text" placeholder="Ej: documento ilegible, selfie no coincide...">
        </div>
        <div style="display:flex;gap:12px;margin-top:16px;">
            <button class="btn" id="kycApprove" style="flex:1;">Aprobar</button>
            <button class="btn btn-danger" id="kycReject" style="flex:1;">Rechazar</button>
        </div>
    `;

    document.getElementById('kycApprove').addEventListener('click', async () => {
        const levelId = parseInt(document.getElementById('kycLevel').value);
        try {
            const { error: e1 } = await window.supabase.rpc('set_model_level', { p_model_id: modelId, p_level_id: levelId });
            if (e1) throw e1;
            const { error: e2 } = await window.supabase.rpc('approve_model', { p_model_id: modelId });
            if (e2) throw e2;
            window.showToast('Modelo aprobada y nivel asignado', 'success');
            closeModelModal();
            await renderAdminSection();
            if (typeof window.loadActiveModels === 'function') window.loadActiveModels();
        } catch (err) {
            window.showToast('Error al aprobar: ' + err.message, 'error');
        }
    });

    document.getElementById('kycReject').addEventListener('click', async () => {
        const reason = document.getElementById('kycRejectReason').value.trim();
        if (!reason) {
            window.showToast('Escribe un motivo de rechazo', 'error');
            return;
        }
        try {
            const { error } = await window.supabase.rpc('reject_model', { p_model_id: modelId, p_reason: reason });
            if (error) throw error;
            window.showToast('Modelo rechazada', 'success');
            closeModelModal();
            await renderAdminSection();
        } catch (err) {
            window.showToast('Error al rechazar: ' + err.message, 'error');
        }
    });
}

// Modal close helper local (existe en models.js; se usa el global)
function closeModelModal() {
    if (typeof window.closeModelModal === 'function') window.closeModelModal();
}

// ============================================================================
// Pestaña Niveles: editar nombre y tarifa de cada nivel
// ============================================================================
async function renderLevelsTab(content) {
    const { data: levels } = await window.supabase
        .from('kyc_levels').select('*').order('sort_order');

    if (!levels || levels.length === 0) {
        content.innerHTML = '<p class="hint">No hay niveles configurados.</p>';
        return;
    }

    content.innerHTML = `
        <div class="card">
            <div class="card-header"><span class="card-title">Niveles y tarifas</span></div>
            <p class="hint">Cada modelo gana el 50% del precio del nivel. Puedes cambiar nombres y tarifas en cualquier momento.</p>
            <table class="levels-table">
                <thead>
                    <tr>
                        <th>Nivel</th>
                        <th>Nombre</th>
                        <th>Precio (tokens/min)</th>
                        <th>Modelo gana</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${levels.map(l => `
                        <tr data-id="${l.id}">
                            <td>${l.id}</td>
                            <td><input type="text" class="lvl-name" value="${l.name}"></td>
                            <td><input type="number" class="lvl-rate" value="${l.rate_per_minute}" min="1" step="1"></td>
                            <td>${Number(l.rate_per_minute) * 0.5}</td>
                            <td><button class="btn btn-secondary lvl-save">Guardar</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    content.querySelectorAll('.lvl-save').forEach(btn => {
        btn.addEventListener('click', async () => {
            const row = btn.closest('tr');
            const id = parseInt(row.dataset.id);
            const name = row.querySelector('.lvl-name').value.trim();
            const rate = Number(row.querySelector('.lvl-rate').value);
            if (!name || !rate || rate < 1) {
                window.showToast('Nombre y tarifa son obligatorios', 'error');
                return;
            }
            try {
                const { error } = await window.supabase.rpc('update_kyc_level', {
                    p_level_id: id, p_name: name, p_rate: rate
                });
                if (error) throw error;
                window.showToast('Nivel actualizado', 'success');
                await renderLevelsTab(content);
                if (typeof window.loadActiveModels === 'function') window.loadActiveModels();
            } catch (err) {
                window.showToast('Error: ' + err.message, 'error');
            }
        });
    });
}

// ============================================================================
// Pestaña Modelos: listar todas y cambiar nivel asignado
// ============================================================================
async function renderModelsTab(content) {
    const { data: models } = await window.supabase
        .from('profiles').select('*, role_details(*)').eq('role', 'model');

    const { data: levels } = await window.supabase
        .from('kyc_levels').select('*').eq('is_active', true).order('sort_order');

    if (!models || models.length === 0) {
        content.innerHTML = '<p class="hint">Aun no hay modelos registradas.</p>';
        return;
    }

    content.innerHTML = models.map(m => {
        const rd = m.role_details || {};
        return `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">${m.full_name}</div>
                        <div class="hint">${m.email} · KYC: ${m.kyc_status}</div>
                    </div>
                </div>
                <div class="form-row">
                    <label>Nivel asignado</label>
                    <select class="model-level" data-id="${m.id}">
                        <option value="">Sin nivel</option>
                        ${(levels || []).map(l =>
                            `<option value="${l.id}" ${rd.level_id === l.id ? 'selected' : ''}>${l.name}</option>`
                        ).join('')}
                    </select>
                </div>
            </div>
        `;
    }).join('');

    content.querySelectorAll('.model-level').forEach(sel => {
        sel.addEventListener('change', async () => {
            const modelId = sel.dataset.id;
            const levelId = sel.value ? parseInt(sel.value) : null;
            try {
                if (levelId) {
                    const { error } = await window.supabase.rpc('set_model_level', { p_model_id: modelId, p_level_id: levelId });
                    if (error) throw error;
                    window.showToast('Nivel asignado', 'success');
                } else {
                    await window.supabase
                        .from('role_details').update({ level_id: null }).eq('user_id', modelId);
                    window.showToast('Nivel removido', 'success');
                }
                if (typeof window.loadActiveModels === 'function') window.loadActiveModels();
            } catch (err) {
                window.showToast('Error: ' + err.message, 'error');
            }
        });
    });
}

window.initAdmin = initAdmin;
window.renderAdminSection = renderAdminSection;

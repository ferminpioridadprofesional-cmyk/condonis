// ============================================================================
// CONDONIS - ADMIN: Alertas (violaciones de chat), Usuarios, KYC, Niveles
// V5.0: notificación en vivo al admin con la conversación completa del chat.
// ============================================================================

let usersSearchTimer = null;
let alertsChannel = null;

async function initAdmin() {
    const user = window.appState.currentUser;
    if (!user || !user.profile || user.profile.role !== 'admin') return;

    // Notificación en vivo de nuevas alertas
    if (!alertsChannel) {
        alertsChannel = window.supabase
            .channel('admin-alerts')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_alerts' }, () => {
                window.showToast('Nueva alerta de moderacion recibida', 'error');
                const badge = document.getElementById('alertsBadge');
                if (badge) badge.textContent = String((parseInt(badge.textContent || '0', 10) || 0) + 1);
                const active = document.querySelector('.admin-tab.active');
                if (active && active.dataset.tab === 'alerts') {
                    const content = document.getElementById('adminTabContent');
                    if (content) renderAlertsTab(content);
                }
            })
            .subscribe();
    }

    await renderAdminSection();
}

window.onAppReadyAdmin = initAdmin;

async function renderAdminSection() {
    const container = document.getElementById('adminContent');
    if (!container) return;

    container.innerHTML = `
        <div class="admin-tabs">
            <button class="admin-tab active" data-tab="alerts">Alertas <span id="alertsBadge" class="kyc-badge kyc-rejected"></span></button>
            <button class="admin-tab" data-tab="users">Usuarios</button>
            <button class="admin-tab" data-tab="kyc">KYC pendientes</button>
            <button class="admin-tab" data-tab="levels">Niveles y tarifas</button>
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

    await loadAdminTab('alerts');
}

async function loadAdminTab(tab) {
    const content = document.getElementById('adminTabContent');
    if (!content) return;
    if (tab === 'alerts') await renderAlertsTab(content);
    else if (tab === 'users') await renderUsersTab(content);
    else if (tab === 'kyc') await renderKycTab(content);
    else if (tab === 'levels') await renderLevelsTab(content);
}

// ============================================================================
// Alertas: listado + visor de conversación + marcar leída
// ============================================================================
async function renderAlertsTab(content) {
    content.innerHTML = '<p class="hint">Cargando alertas...</p>';

    const { data, error } = await window.supabase
        .from('admin_alerts').select('*').order('created_at', { ascending: false }).limit(50);

    // Contador de no leídas para el badge
    const unread = (data || []).filter(a => !a.read).length;
    const badge = document.getElementById('alertsBadge');
    if (badge) badge.textContent = unread ? String(unread) : '';

    if (error || !data || data.length === 0) {
        content.innerHTML = '<p class="hint">No hay alertas de moderacion.</p>';
        return;
    }

    content.innerHTML = data.map(a => `
        <div class="card">
            <div class="card-header">
                <div>
                    <div class="card-title">${a.title}</div>
                    <div class="hint">${new Date(a.created_at).toLocaleString()}</div>
                </div>
                ${a.read ? '' : '<span class="kyc-badge kyc-rejected">Nueva</span>'}
            </div>
            <p class="hint">${a.body || ''}</p>
            <button class="btn btn-secondary" data-alert="${a.id}">Ver conversacion completa</button>
        </div>
    `).join('');

    content.querySelectorAll('[data-alert]').forEach(btn => {
        btn.addEventListener('click', () => openAlert(data.find(x => x.id === btn.dataset.alert)));
    });
}

async function openAlert(alert) {
    const overlay = document.getElementById('modelModal');
    const body = document.getElementById('modelModalBody');
    if (!overlay || !body) return;

    const conv = alert.conversation || [];
    body.innerHTML = `
        <h3 class="modal-title">${alert.title}</h3>
        <p class="hint">${new Date(alert.created_at).toLocaleString()} · ${alert.body || ''}</p>
        <h4 class="gallery-title">Conversacion completa del chat</h4>
        <div class="chat-log" style="max-height:300px;background:rgba(30,41,59,.4);border-radius:8px;">
            ${conv.length === 0 ? '<p class="hint">Sin mensajes registrados.</p>' :
              conv.map(m => `<div class="chat-line${m.sender === alert.related_user_id ? ' own' : ''}">${m.sender === alert.related_user_id ? '[Infractor] ' : ''}${m.body}</div>`).join('')}
        </div>
    `;
    overlay.classList.add('active');

    // Marcar como leída
    if (!alert.read) {
        await window.supabase.from('admin_alerts').update({ read: true }).eq('id', alert.id);
    }
}

// ============================================================================
// Usuarios: búsqueda + ficha + acciones (V4)
// ============================================================================
async function renderUsersTab(content) {
    content.innerHTML = `
        <div class="card">
            <div class="card-header"><span class="card-title">Todos los usuarios</span></div>
            <div class="form-row">
                <label for="userSearch">Buscar por nombre, ID o correo</label>
                <input id="userSearch" type="text" placeholder="Ej: Pamela o dc384d54... o correo@x.com">
            </div>
            <div id="usersList"></div>
        </div>
    `;
    const search = document.getElementById('userSearch');
    search.addEventListener('input', () => {
        if (usersSearchTimer) clearTimeout(usersSearchTimer);
        usersSearchTimer = setTimeout(() => loadUsers(search.value.trim()), 300);
    });
    await loadUsers('');
}

async function loadUsers(search) {
    const list = document.getElementById('usersList');
    if (!list) return;
    list.innerHTML = '<p class="hint">Cargando...</p>';
    let users = [];
    try {
        const { data, error } = await window.supabase.rpc('admin_list_users', { p_search: search || null });
        if (error) throw error;
        users = data || [];
    } catch (err) { list.innerHTML = '<p class="hint">No se pudo cargar usuarios.</p>'; return; }

    if (users.length === 0) { list.innerHTML = '<p class="hint">Sin resultados.</p>'; return; }

    list.innerHTML = users.map(u => `
        <div class="card user-row">
            <div class="card-header">
                <div>
                    <div class="card-title">${u.full_name}</div>
                    <div class="hint">${u.email} · ${u.role}${u.level_name ? ' · Nivel ' + u.level_name : ''}</div>
                    <div class="hint" style="font-size:11px;">ID: ${u.id}</div>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
                    ${u.is_banned ? '<span class="kyc-badge kyc-rejected">Baneado</span>' : ''}
                    ${u.role === 'model' ? `<span class="kyc-badge kyc-${u.kyc_status}">${u.kyc_status}</span>` : ''}
                </div>
            </div>
            <button class="btn btn-secondary" data-action="info" data-id="${u.id}">Ver informacion</button>
        </div>
    `).join('');

    list.querySelectorAll('[data-action="info"]').forEach(btn => {
        btn.addEventListener('click', () => openUserModal(btn.dataset.id));
    });
}

async function openUserModal(userId) {
    const overlay = document.getElementById('modelModal');
    const body = document.getElementById('modelModalBody');
    if (!overlay || !body) return;
    body.innerHTML = '<p class="hint">Cargando ficha...</p>';
    overlay.classList.add('active');

    let payload = null;
    try {
        const { data, error } = await window.supabase.rpc('admin_get_user', { p_user_id: userId });
        if (error) throw error;
        payload = data;
    } catch (err) { body.innerHTML = '<p class="hint">No se pudo cargar la ficha.</p>'; return; }

    const p = payload.profile || {};
    const d = payload.details || {};
    const docs = payload.docs || [];

    const docsWithUrls = await Promise.all(docs.map(async doc => {
        let url = doc.file_url;
        if (!String(doc.file_url).startsWith('http')) {
            try {
                const { data } = await window.supabase.storage.from('kyc-docs').createSignedUrl(doc.file_url, 3600);
                if (data && data.signedUrl) url = data.signedUrl;
            } catch (e) {}
        }
        return Object.assign({}, doc, { view_url: url });
    }));

    const { data: levels } = await window.supabase.from('kyc_levels').select('*').eq('is_active', true).order('sort_order');

    body.innerHTML = `
        <h3 class="modal-title">${p.full_name}</h3>
        <div class="info-row"><span class="info-label">ID</span><span class="info-value" style="font-size:11px;">${p.id}</span></div>
        <div class="info-row"><span class="info-label">Correo</span><span class="info-value">${p.email}</span></div>
        <div class="info-row"><span class="info-label">Rol</span><span class="info-value">${p.role}</span></div>
        <div class="info-row"><span class="info-label">Registro</span><span class="info-value">${new Date(p.created_at).toLocaleString()}</span></div>
        <div class="info-row"><span class="info-label">Saldo</span><span class="info-value">${Number(p.tokens_balance || 0)} tokens</span></div>
        <div class="info-row"><span class="info-label">Retenido</span><span class="info-value">${Number(p.tokens_retained || 0)} tokens</span></div>
        <div class="info-row"><span class="info-label">KYC</span><span class="info-value">${p.kyc_status}</span></div>
        <div class="info-row"><span class="info-label">Ban</span><span class="info-value">${p.is_banned ? 'SI: ' + (p.ban_reason || '') : 'No'}</span></div>
        ${p.role === 'model' ? `
            <div class="form-row" style="margin-top:12px;">
                <label for="modalLevel">Nivel de la modelo</label>
                <select id="modalLevel">
                    <option value="">Sin nivel</option>
                    ${(levels || []).map(l => `<option value="${l.id}" ${d.level_id === l.id ? 'selected' : ''}>${l.name} (${Number(l.rate_per_minute)} tokens/min)</option>`).join('')}
                </select>
            </div>` : ''}
        ${docsWithUrls.length ? `
            <h4 class="gallery-title">Documentos KYC</h4>
            <div class="kyc-review-list">
                ${docsWithUrls.map(doc => `
                    <div class="kyc-review-item">
                        <div class="kyc-review-label">${doc.doc_type} · ${doc.status}</div>
                        <a href="${doc.view_url}" target="_blank" rel="noopener"><img src="${doc.view_url}" alt="${doc.doc_type}" class="kyc-review-img"></a>
                    </div>`).join('')}
            </div>` : ''}
        <h4 class="gallery-title">Tokens</h4>
        <div class="form-row" style="display:flex;gap:8px;align-items:end;">
            <div style="flex:1;"><label for="modalTokens">Cantidad (negativo resta)</label><input id="modalTokens" type="number" value="100"></div>
            <button class="btn btn-secondary" id="modalAddTokens" style="flex:1;">Aplicar</button>
        </div>
        <h4 class="gallery-title">Acciones</h4>
        <div style="display:flex;flex-direction:column;gap:10px;">
            <button class="btn btn-secondary" id="modalPass">Cambiar contrasena</button>
            ${p.is_banned ? '<button class="btn btn-secondary" id="modalUnban">Desbanear</button>' : '<button class="btn btn-danger" id="modalBan">Banear (con razon)</button>'}
            <button class="btn btn-danger" id="modalDelete">Eliminar cuenta por completo</button>
        </div>
    `;

    const levelSel = document.getElementById('modalLevel');
    if (levelSel) levelSel.addEventListener('change', async () => {
        const lv = levelSel.value ? parseInt(levelSel.value, 10) : null;
        try {
            if (lv) {
                const { error } = await window.supabase.rpc('set_model_level', { p_model_id: userId, p_level_id: lv });
                if (error) throw error;
            } else {
                await window.supabase.from('role_details').update({ level_id: null }).eq('user_id', userId);
            }
            window.showToast('Nivel actualizado', 'success');
            if (window.loadActiveModels) window.loadActiveModels();
        } catch (err) { window.showToast('Error: ' + err.message, 'error'); }
    });

    document.getElementById('modalAddTokens').addEventListener('click', async () => {
        const amount = Number(document.getElementById('modalTokens').value);
        if (!amount) { window.showToast('Cantidad distinta de 0', 'error'); return; }
        try {
            const { data, error } = await window.supabase.rpc('admin_adjust_tokens', { p_user_id: userId, p_amount: amount });
            if (error) throw error;
            window.showToast('Nuevo saldo: ' + Number(data.balance) + ' tokens', 'success');
            closeAdminModal(); await renderAdminSection();
        } catch (err) { window.showToast('Error: ' + err.message, 'error'); }
    });

    document.getElementById('modalPass').addEventListener('click', async () => {
        const np = window.prompt('Nueva contrasena (minimo 6 caracteres):');
        if (np === null) return;
        try {
            const { error } = await window.supabase.rpc('admin_reset_password', { p_user_id: userId, p_new_password: np });
            if (error) throw error;
            window.showToast('Contrasena cambiada y sesiones cerradas', 'success');
        } catch (err) { window.showToast('Error: ' + err.message, 'error'); }
    });

    const banBtn = document.getElementById('modalBan');
    if (banBtn) banBtn.addEventListener('click', async () => {
        const reason = window.prompt('Razon del ban (obligatoria):');
        if (reason === null || reason.trim() === '') { window.showToast('Razon obligatoria', 'error'); return; }
        try {
            const { error } = await window.supabase.rpc('admin_set_ban', { p_user_id: userId, p_banned: true, p_reason: reason.trim() });
            if (error) throw error;
            window.showToast('Usuario baneado', 'success');
            closeAdminModal(); await renderAdminSection();
        } catch (err) { window.showToast('Error: ' + err.message, 'error'); }
    });

    const unbanBtn = document.getElementById('modalUnban');
    if (unbanBtn) unbanBtn.addEventListener('click', async () => {
        try {
            const { error } = await window.supabase.rpc('admin_set_ban', { p_user_id: userId, p_banned: false, p_reason: '' });
            if (error) throw error;
            window.showToast('Usuario desbaneado', 'success');
            closeAdminModal(); await renderAdminSection();
        } catch (err) { window.showToast('Error: ' + err.message, 'error'); }
    });

    document.getElementById('modalDelete').addEventListener('click', async () => {
        const conf = window.prompt('Escribe ELIMINAR para borrar todo y liberar el correo:');
        if (conf !== 'ELIMINAR') { window.showToast('Cancelado', 'error'); return; }
        try {
            const { error } = await window.supabase.rpc('admin_delete_user', { p_user_id: userId });
            if (error) throw error;
            window.showToast('Cuenta eliminada', 'success');
            closeAdminModal(); await renderAdminSection();
        } catch (err) { window.showToast('Error: ' + err.message, 'error'); }
    });
}

function closeAdminModal() { if (window.closeModelModal) window.closeModelModal(); }

// ============================================================================
// KYC pendientes (sin cambios)
// ============================================================================
async function renderKycTab(content) {
    content.innerHTML = '<p class="hint">Cargando...</p>';
    let pending = [];
    try {
        const { data, error } = await window.supabase.rpc('list_kyc_pending');
        if (error) throw error;
        pending = data || [];
    } catch (err) { content.innerHTML = '<p class="hint">No se pudo cargar.</p>'; return; }

    if (pending.length === 0) { content.innerHTML = '<p class="hint">No hay modelos pendientes.</p>'; return; }

    content.innerHTML = pending.map(m => `
        <div class="card">
            <div class="card-header">
                <div><div class="card-title">${m.full_name}</div><div class="hint">${m.email}</div></div>
                <span class="kyc-badge kyc-${m.kyc_status}">${m.kyc_status}</span>
            </div>
            <button class="btn btn-secondary" data-action="review" data-id="${m.id}">Revisar documentos</button>
        </div>`).join('');

    content.querySelectorAll('[data-action="review"]').forEach(btn => {
        btn.addEventListener('click', () => openKycReview(btn.dataset.id));
    });
}

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
    } catch (err) { body.innerHTML = '<p class="hint">No se pudo cargar.</p>'; return; }

    const docsWithUrls = await Promise.all(docs.map(async d => {
        let url = d.file_url;
        if (!String(d.file_url).startsWith('http')) {
            try {
                const { data } = await window.supabase.storage.from('kyc-docs').createSignedUrl(d.file_url, 3600);
                if (data && data.signedUrl) url = data.signedUrl;
            } catch (e) {}
        }
        return Object.assign({}, d, { view_url: url });
    }));

    const { data: model } = await window.supabase.from('profiles').select('full_name, email').eq('id', modelId).single();
    const { data: levels } = await window.supabase.from('kyc_levels').select('*').eq('is_active', true).order('sort_order');

    body.innerHTML = `
        <h3 class="modal-title">Revision KYC</h3>
        <p class="hint">${model ? model.full_name + ' — ' + model.email : ''}</p>
        <div class="kyc-review-list">
            ${docsWithUrls.length === 0 ? '<p class="hint">Sin documentos.</p>' : docsWithUrls.map(d => `
                <div class="kyc-review-item">
                    <div class="kyc-review-label">${d.doc_type}</div>
                    <a href="${d.view_url}" target="_blank" rel="noopener"><img src="${d.view_url}" alt="${d.doc_type}" class="kyc-review-img"></a>
                </div>`).join('')}
        </div>
        <div class="form-row" style="margin-top:16px;">
            <label for="kycLevel">Asignar nivel (al aprobar)</label>
            <select id="kycLevel">${(levels || []).map(l => `<option value="${l.id}">${l.name} (${Number(l.rate_per_minute)} tokens/min)</option>`).join('')}</select>
        </div>
        <div class="form-row"><label for="kycRejectReason">Motivo de rechazo</label><input id="kycRejectReason" type="text"></div>
        <div style="display:flex;gap:12px;margin-top:16px;">
            <button class="btn" id="kycApprove" style="flex:1;">Aprobar</button>
            <button class="btn btn-danger" id="kycReject" style="flex:1;">Rechazar</button>
        </div>`;

    document.getElementById('kycApprove').addEventListener('click', async () => {
        const levelId = parseInt(document.getElementById('kycLevel').value, 10);
        try {
            const { error: e1 } = await window.supabase.rpc('set_model_level', { p_model_id: modelId, p_level_id: levelId });
            if (e1) throw e1;
            const { error: e2 } = await window.supabase.rpc('approve_model', { p_model_id: modelId });
            if (e2) throw e2;
            window.showToast('Modelo aprobada', 'success');
            closeAdminModal(); await renderAdminSection();
            if (window.loadActiveModels) window.loadActiveModels();
        } catch (err) { window.showToast('Error: ' + err.message, 'error'); }
    });

    document.getElementById('kycReject').addEventListener('click', async () => {
        const reason = document.getElementById('kycRejectReason').value.trim();
        if (!reason) { window.showToast('Motivo obligatorio', 'error'); return; }
        try {
            const { error } = await window.supabase.rpc('reject_model', { p_model_id: modelId, p_reason: reason });
            if (error) throw error;
            window.showToast('Modelo rechazada', 'success');
            closeAdminModal(); await renderAdminSection();
        } catch (err) { window.showToast('Error: ' + err.message, 'error'); }
    });
}

// ============================================================================
// Niveles (sin cambios)
// ============================================================================
async function renderLevelsTab(content) {
    const { data: levels } = await window.supabase.from('kyc_levels').select('*').order('sort_order');
    if (!levels || levels.length === 0) { content.innerHTML = '<p class="hint">Sin niveles.</p>'; return; }

    content.innerHTML = `
        <div class="card">
            <div class="card-header"><span class="card-title">Niveles y tarifas</span></div>
            <p class="hint">Cada modelo gana el 50% del precio del nivel.</p>
            <table class="levels-table">
                <thead><tr><th>Nivel</th><th>Nombre</th><th>Precio</th><th>Modelo gana</th><th></th></tr></thead>
                <tbody>
                    ${levels.map(l => `
                        <tr data-id="${l.id}">
                            <td>${l.id}</td>
                            <td><input type="text" class="lvl-name" value="${l.name}"></td>
                            <td><input type="number" class="lvl-rate" value="${l.rate_per_minute}" min="1"></td>
                            <td>${Number(l.rate_per_minute) * 0.5}</td>
                            <td><button class="btn btn-secondary lvl-save">Guardar</button></td>
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>`;

    content.querySelectorAll('.lvl-save').forEach(btn => {
        btn.addEventListener('click', async () => {
            const row = btn.closest('tr');
            const id = parseInt(row.dataset.id, 10);
            const name = row.querySelector('.lvl-name').value.trim();
            const rate = Number(row.querySelector('.lvl-rate').value);
            if (!name || !rate || rate < 1) { window.showToast('Nombre y tarifa obligatorios', 'error'); return; }
            try {
                const { error } = await window.supabase.rpc('update_kyc_level', { p_level_id: id, p_name: name, p_rate: rate });
                if (error) throw error;
                window.showToast('Nivel actualizado', 'success');
                await renderLevelsTab(content);
                if (window.loadActiveModels) window.loadActiveModels();
            } catch (err) { window.showToast('Error: ' + err.message, 'error'); }
        });
    });
}

window.initAdmin = initAdmin;
window.renderAdminSection = renderAdminSection;

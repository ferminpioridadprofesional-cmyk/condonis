// ============================================================================
// CONDONIS - ADMIN: Usuarios (búsqueda + ficha + acciones), KYC y Niveles
// V4.0: búsqueda por nombre/id/email, ver información completa, cambiar
// contraseña, banear/desbanear con razón, eliminar cuenta, ajustar tokens.
// ============================================================================

let usersSearchTimer = null;

async function initAdmin() {
    const user = window.appState.currentUser;
    if (!user || !user.profile || user.profile.role !== 'admin') return;
    await renderAdminSection();
}

window.onAppReadyAdmin = initAdmin;

// ============================================================================
// renderAdminSection: 3 pestañas
// ============================================================================
async function renderAdminSection() {
    const container = document.getElementById('adminContent');
    if (!container) return;

    container.innerHTML = `
        <div class="admin-tabs">
            <button class="admin-tab active" data-tab="users">Usuarios</button>
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

    await loadAdminTab('users');
}

async function loadAdminTab(tab) {
    const content = document.getElementById('adminTabContent');
    if (!content) return;
    if (tab === 'users') await renderUsersTab(content);
    else if (tab === 'kyc') await renderKycTab(content);
    else if (tab === 'levels') await renderLevelsTab(content);
}

// ============================================================================
// Pestaña Usuarios: barra de búsqueda + listado + acciones
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
        // Debounce de 300ms para no saturar consultas
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
    } catch (err) {
        list.innerHTML = '<p class="hint">No se pudo cargar usuarios.</p>';
        return;
    }

    if (users.length === 0) {
        list.innerHTML = '<p class="hint">Sin resultados para esa búsqueda.</p>';
        return;
    }

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

// ============================================================================
// openUserModal: ficha completa + acciones de administración
// ============================================================================
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
    } catch (err) {
        body.innerHTML = '<p class="hint">No se pudo cargar la ficha.</p>';
        return;
    }

    const p = payload.profile || {};
    const d = payload.details || {};
    const docs = payload.docs || [];

    // URLs firmadas de documentos KYC (bucket privado)
    const docsWithUrls = await Promise.all(docs.map(async doc => {
        let url = doc.file_url;
        if (!String(doc.file_url).startsWith('http')) {
            try {
                const { data } = await window.supabase.storage.from('kyc-docs').createSignedUrl(doc.file_url, 3600);
                if (data && data.signedUrl) url = data.signedUrl;
            } catch (e) { /* se muestra sin imagen */ }
        }
        return Object.assign({}, doc, { view_url: url });
    }));

    // Niveles para el selector (solo modelos)
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
            </div>
        ` : ''}
        ${docsWithUrls.length ? `
            <h4 class="gallery-title">Documentos KYC</h4>
            <div class="kyc-review-list">
                ${docsWithUrls.map(doc => `
                    <div class="kyc-review-item">
                        <div class="kyc-review-label">${doc.doc_type} · ${doc.status}</div>
                        <a href="${doc.view_url}" target="_blank" rel="noopener">
                            <img src="${doc.view_url}" alt="${doc.doc_type}" class="kyc-review-img">
                        </a>
                    </div>
                `).join('')}
            </div>
        ` : ''}

        <h4 class="gallery-title">Tokens</h4>
        <div class="form-row" style="display:flex;gap:8px;align-items:end;">
            <div style="flex:1;">
                <label for="modalTokens">Cantidad (negativo para restar)</label>
                <input id="modalTokens" type="number" value="100" step="1">
            </div>
            <button class="btn btn-secondary" id="modalAddTokens" style="flex:1;">Aplicar ajuste</button>
        </div>

        <h4 class="gallery-title">Acciones de cuenta</h4>
        <div style="display:flex;flex-direction:column;gap:10px;">
            <button class="btn btn-secondary" id="modalPass">Cambiar contrasena</button>
            ${p.is_banned
                ? '<button class="btn btn-secondary" id="modalUnban">Desbanear</button>'
                : '<button class="btn btn-danger" id="modalBan">Banear (con razon)</button>'}
            <button class="btn btn-danger" id="modalDelete">Eliminar cuenta por completo</button>
        </div>
    `;

    // --- Nivel (modelos) ---
    const levelSel = document.getElementById('modalLevel');
    if (levelSel) {
        levelSel.addEventListener('change', async () => {
            const lv = levelSel.value ? parseInt(levelSel.value) : null;
            try {
                if (lv) {
                    const { error } = await window.supabase.rpc('set_model_level', { p_model_id: userId, p_level_id: lv });
                    if (error) throw error;
                } else {
                    await window.supabase.from('role_details').update({ level_id: null }).eq('user_id', userId);
                }
                window.showToast('Nivel actualizado', 'success');
                if (typeof window.loadActiveModels === 'function') window.loadActiveModels();
            } catch (err) {
                window.showToast('Error: ' + err.message, 'error');
            }
        });
    }

    // --- Ajuste de tokens ---
    const addBtn = document.getElementById('modalAddTokens');
    if (addBtn) {
        addBtn.addEventListener('click', async () => {
            const amount = Number(document.getElementById('modalTokens').value);
            if (!amount) { window.showToast('Escribe una cantidad distinta de 0', 'error'); return; }
            try {
                const { data, error } = await window.supabase.rpc('admin_adjust_tokens', { p_user_id: userId, p_amount: amount });
                if (error) throw error;
                window.showToast('Nuevo saldo: ' + Number(data.balance) + ' tokens', 'success');
                closeUserModal();
                await renderAdminSection();
            } catch (err) {
                window.showToast('Error: ' + err.message, 'error');
            }
        });
    }

    // --- Cambiar contraseña ---
    const passBtn = document.getElementById('modalPass');
    if (passBtn) {
        passBtn.addEventListener('click', async () => {
            const np = window.prompt('Nueva contrasena para ' + p.email + ' (minimo 6 caracteres):');
            if (np === null) return;
            try {
                const { error } = await window.supabase.rpc('admin_reset_password', { p_user_id: userId, p_new_password: np });
                if (error) throw error;
                window.showToast('Contrasena cambiada y sesiones cerradas', 'success');
            } catch (err) {
                window.showToast('Error: ' + err.message, 'error');
            }
        });
    }

    // --- Ban / Desban ---
    const banBtn = document.getElementById('modalBan');
    if (banBtn) {
        banBtn.addEventListener('click', async () => {
            const reason = window.prompt('Razon del ban (obligatoria):');
            if (reason === null || reason.trim() === '') { window.showToast('La razon es obligatoria', 'error'); return; }
            try {
                const { error } = await window.supabase.rpc('admin_set_ban', { p_user_id: userId, p_banned: true, p_reason: reason.trim() });
                if (error) throw error;
                window.showToast('Usuario baneado', 'success');
                closeUserModal();
                await renderAdminSection();
            } catch (err) {
                window.showToast('Error: ' + err.message, 'error');
            }
        });
    }
    const unbanBtn = document.getElementById('modalUnban');
    if (unbanBtn) {
        unbanBtn.addEventListener('click', async () => {
            try {
                const { error } = await window.supabase.rpc('admin_set_ban', { p_user_id: userId, p_banned: false, p_reason: '' });
                if (error) throw error;
                window.showToast('Usuario desbaneado', 'success');
                closeUserModal();
                await renderAdminSection();
            } catch (err) {
                window.showToast('Error: ' + err.message, 'error');
            }
        });
    }

    // --- Eliminar cuenta ---
    const delBtn = document.getElementById('modalDelete');
    if (delBtn) {
        delBtn.addEventListener('click', async () => {
            const conf = window.prompt('Esto borrara TODO (perfil, llamadas, tokens, KYC) y liberara el correo para re-registro. Escribe ELIMINAR para confirmar:');
            if (conf !== 'ELIMINAR') { window.showToast('Cancelado: debes escribir ELIMINAR', 'error'); return; }
            try {
                const { error } = await window.supabase.rpc('admin_delete_user', { p_user_id: userId });
                if (error) throw error;
                window.showToast('Cuenta eliminada por completo', 'success');
                closeUserModal();
                await renderAdminSection();
            } catch (err) {
                window.showToast('Error: ' + err.message, 'error');
            }
        });
    }
}

function closeUserModal() {
    if (typeof window.closeModelModal === 'function') window.closeModelModal();
}

// ============================================================================
// Pestaña KYC pendientes (sin cambios de comportamiento)
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

    const docsWithUrls = await Promise.all(docs.map(async d => {
        let url = d.file_url;
        if (!String(d.file_url).startsWith('http')) {
            try {
                const { data } = await window.supabase.storage.from('kyc-docs').createSignedUrl(d.file_url, 3600);
                if (data && data.signedUrl) url = data.signedUrl;
            } catch (e) { /* sin imagen */ }
        }
        return Object.assign({}, d, { view_url: url });
    }));

    const { data: model } = await window.supabase.from('profiles').select('full_name, email').eq('id', modelId).single();
    const { data: levels } = await window.supabase.from('kyc_levels').select('*').eq('is_active', true).order('sort_order');

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
            <select id="kycLevel">${(levels || []).map(l => `<option value="${l.id}">${l.name} (${Number(l.rate_per_minute)} tokens/min)</option>`).join('')}</select>
        </div>
        <div class="form-row">
            <label for="kycRejectReason">Motivo de rechazo (solo si rechazas)</label>
            <input id="kycRejectReason" type="text" placeholder="Ej: documento ilegible...">
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
            closeUserModal();
            await renderAdminSection();
            if (typeof window.loadActiveModels === 'function') window.loadActiveModels();
        } catch (err) {
            window.showToast('Error al aprobar: ' + err.message, 'error');
        }
    });

    document.getElementById('kycReject').addEventListener('click', async () => {
        const reason = document.getElementById('kycRejectReason').value.trim();
        if (!reason) { window.showToast('Escribe un motivo de rechazo', 'error'); return; }
        try {
            const { error } = await window.supabase.rpc('reject_model', { p_model_id: modelId, p_reason: reason });
            if (error) throw error;
            window.showToast('Modelo rechazada', 'success');
            closeUserModal();
            await renderAdminSection();
        } catch (err) {
            window.showToast('Error al rechazar: ' + err.message, 'error');
        }
    });
}

// ============================================================================
// Pestaña Niveles: editar nombres y tarifas
// ============================================================================
async function renderLevelsTab(content) {
    const { data: levels } = await window.supabase.from('kyc_levels').select('*').order('sort_order');

    if (!levels || levels.length === 0) {
        content.innerHTML = '<p class="hint">No hay niveles configurados.</p>';
        return;
    }

    content.innerHTML = `
        <div class="card">
            <div class="card-header"><span class="card-title">Niveles y tarifas</span></div>
            <p class="hint">Cada modelo gana el 50% del precio del nivel.</p>
            <table class="levels-table">
                <thead>
                    <tr><th>Nivel</th><th>Nombre</th><th>Precio (tokens/min)</th><th>Modelo gana</th><th></th></tr>
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
            if (!name || !rate || rate < 1) { window.showToast('Nombre y tarifa obligatorios', 'error'); return; }
            try {
                const { error } = await window.supabase.rpc('update_kyc_level', { p_level_id: id, p_name: name, p_rate: rate });
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

window.initAdmin = initAdmin;
window.renderAdminSection = renderAdminSection;

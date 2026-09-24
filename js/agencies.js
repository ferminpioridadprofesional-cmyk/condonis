// ============================================================================
// CONDONIS - AGENCIAS: panel del dueño de agencia + tabs extra del admin
// (Agencias y Retiros) inyectados sin reescribir admin.js.
// ============================================================================

let agencyBoot = false;

document.addEventListener('DOMContentLoaded', () => {
    waitProfileAg().then(() => { if (!agencyBoot) { agencyBoot = true; bootAgencies(); } });
});

async function waitProfileAg() {
    for (let i = 0; i < 50; i++) {
        if (window.appState && window.appState.currentUser && window.appState.currentUser.profile) return true;
        await new Promise(r => setTimeout(r, 200));
    }
    return false;
}

function bootAgencies() {
    const role = window.appState.currentUser.profile.role;

    // Dueño de agencia: sección propia + botón de navegación
    if (role === 'agency') {
        injectAgencySection();
        patchAdminTabs(); // por si también tuviera permisos admin en el futuro
    }

    // Admin: tabs extra de Agencias y Retiros
    if (role === 'admin') patchAdminTabs();
}

// ============================================================================
// Sección propia de agencia (inyectada en el shell)
// ============================================================================
function injectAgencySection() {
    if (!document.getElementById('sectionAgency')) {
        const main = document.querySelector('.app-content');
        const sec = document.createElement('section');
        sec.id = 'sectionAgency'; sec.className = 'section';
        sec.innerHTML = '<h2>Mi Agencia</h2><div id="agencyContent" style="margin-top:20px;"></div>';
        main.appendChild(sec);

        const nav = document.querySelector('.bottom-nav');
        const btn = document.createElement('button');
        btn.className = 'nav-item'; btn.dataset.section = 'sectionAgency';
        btn.setAttribute('aria-label', 'Panel de agencia');
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"></path><path d="M5 21V7l7-4 7 4v14"></path><path d="M9 21v-6h6v6"></path></svg><span class="nav-label">Agencia</span>`;
        btn.addEventListener('click', () => {
            window.showSection('sectionAgency');
            renderAgencyPanel();
        });
        nav.appendChild(btn);
    }
}

async function renderAgencyPanel() {
    const cont = document.getElementById('agencyContent');
    if (!cont) return;
    cont.innerHTML = '<p class="hint">Cargando...</p>';

    const { data: agency } = await window.supabase.from('agencies')
        .select('*').eq('owner_id', window.appState.currentUser.id).single();
    if (!agency) { cont.innerHTML = '<p class="hint">No tienes agencia asignada.</p>'; return; }

    const desde = new Date(new Date().setDate(1)).toISOString().slice(0, 10);
    const hasta = new Date().toISOString().slice(0, 10);

    let report = [];
    try {
        const { data } = await window.supabase.rpc('get_agency_report', {
            p_agency_id: agency.id, p_desde: desde, p_hasta: hasta });
        report = data || [];
    } catch (e) {}

    const { data: payouts } = await window.supabase.from('model_payouts')
        .select('*').eq('agency_id', agency.id).eq('status', 'pending')
        .order('created_at', { ascending: false });

    const { data: myPayments } = await window.supabase.from('agency_payments')
        .select('*').eq('agency_id', agency.id).order('created_at', { ascending: false }).limit(10);

    cont.innerHTML = `
        <div class="card">
            <div class="card-header"><span class="card-title">${agency.name}</span></div>
            <p class="hint">Reporte del mes en curso (${desde} a ${hasta})</p>
            ${report.length === 0 ? '<p class="hint">Sin ganancias registradas este mes.</p>' : report.map(r => `
                <div class="info-row"><span class="info-label">${r.model_name}</span>
                <span class="info-value">${Number(r.total_earned)} tokens · ${r.total_calls} llamadas</span></div>`).join('')}
        </div>
        <div class="card">
            <div class="card-header"><span class="card-title">Retiros pendientes de mis modelos</span></div>
            ${(payouts || []).length === 0 ? '<p class="hint">Sin retiros pendientes.</p>' : payouts.map(p => `
                <div class="card" style="margin-bottom:8px;">
                    <div class="info-row"><span class="info-label">Modelo ${p.model_id.slice(0, 8)}...</span><span class="info-value">${p.amount} tokens</span></div>
                    <div style="display:flex;gap:8px;">
                        <button class="btn" data-pay="${p.id}" style="flex:1;">Pagar</button>
                        <button class="btn btn-danger" data-deny="${p.id}" style="flex:1;">Rechazar</button>
                    </div>
                </div>`).join('')}
        </div>
        <div class="card">
            <div class="card-header"><span class="card-title">Pagos recibidos del admin</span></div>
            ${(myPayments || []).length === 0 ? '<p class="hint">Sin pagos registrados.</p>' : myPayments.map(p => `
                <div class="info-row"><span class="info-label">${p.period_start} a ${p.period_end}</span>
                <span class="info-value">${p.amount} · ${p.status}</span></div>`).join('')}
        </div>`;

    cont.querySelectorAll('[data-pay]').forEach(b => b.addEventListener('click', async () => {
        try {
            const { error } = await window.supabase.rpc('approve_payout', { p_payout_id: b.dataset.pay, p_approve: true });
            if (error) throw error;
            window.showToast('Retiro pagado a la modelo', 'success');
            renderAgencyPanel();
        } catch (err) { window.showToast(err.message, 'error'); }
    }));
    cont.querySelectorAll('[data-deny]').forEach(b => b.addEventListener('click', async () => {
        try {
            const { error } = await window.supabase.rpc('approve_payout', { p_payout_id: b.dataset.deny, p_approve: false });
            if (error) throw error;
            window.showToast('Retiro rechazado y devuelto', 'info');
            renderAgencyPanel();
        } catch (err) { window.showToast(err.message, 'error'); }
    }));
}
window.renderAgencyPanel = renderAgencyPanel;

// ============================================================================
// patchAdminTabs(): añade tabs Agencias y Retiros al panel admin existente
// ============================================================================
function patchAdminTabs() {
    if (!window.renderAdminSection || window.__agTabsPatched) return;
    window.__agTabsPatched = true;
    const orig = window.renderAdminSection;

    window.renderAdminSection = async function (...args) {
        await orig.apply(this, args);
        const tabs = document.querySelector('.admin-tabs');
        if (!tabs) return;
        if (!tabs.querySelector('[data-tab="agencies"]')) {
            const t1 = document.createElement('button');
            t1.className = 'admin-tab'; t1.dataset.tab = 'agencies'; t1.textContent = 'Agencias';
            const t2 = document.createElement('button');
            t2.className = 'admin-tab'; t2.dataset.tab = 'payouts'; t2.textContent = 'Retiros';
            tabs.appendChild(t1); tabs.appendChild(t2);
            [t1, t2].forEach(t => t.addEventListener('click', async () => {
                tabs.querySelectorAll('.admin-tab').forEach(x => x.classList.remove('active'));
                t.classList.add('active');
                const content = document.getElementById('adminTabContent');
                if (t.dataset.tab === 'agencies') await renderAgenciesAdmin(content);
                else await renderPayoutsAdmin(content);
            }));
        }
    };
}

// ============================================================================
// Admin: gestión de agencias
// ============================================================================
async function renderAgenciesAdmin(content) {
    if (!content) return;
    const { data: agencies } = await window.supabase.from('agencies').select('*').order('created_at', { ascending: false });
    const { data: models } = await window.supabase.from('profiles').select('id, full_name, agency_id').eq('role', 'model');
    const { data: payments } = await window.supabase.from('agency_payments').select('*').order('created_at', { ascending: false }).limit(15);

    content.innerHTML = `
        <div class="card">
            <div class="card-header"><span class="card-title">Crear agencia</span></div>
            <div class="form-row"><label for="agName">Nombre</label><input id="agName" type="text"></div>
            <div class="form-row"><label for="agOwner">Correo del dueno (ya registrado)</label><input id="agOwner" type="email"></div>
            <button class="btn" id="agCreate">Crear agencia</button>
        </div>
        <div class="card">
            <div class="card-header"><span class="card-title">Asignar modelos a agencia</span></div>
            ${models.map(m => `
                <div class="form-row" style="display:flex;gap:8px;align-items:center;">
                    <span style="flex:1;font-size:13px;">${m.full_name}</span>
                    <select class="ag-assign" data-model="${m.id}" style="flex:1;">
                        <option value="">Sin agencia</option>
                        ${(agencies || []).map(a => `<option value="${a.id}" ${m.agency_id === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                    </select>
                </div>`).join('')}
        </div>
        <div class="card">
            <div class="card-header"><span class="card-title">Registrar pago a agencia</span></div>
            <div class="form-row"><label for="payAg">Agencia</label><select id="payAg">${(agencies || []).map(a => `<option value="${a.id}">${a.name}</option>`).join('')}</select></div>
            <div class="form-row"><label for="payAmount">Monto</label><input id="payAmount" type="number" min="1"></div>
            <div class="form-row"><label for="payFrom">Desde</label><input id="payFrom" type="date"></div>
            <div class="form-row"><label for="payTo">Hasta</label><input id="payTo" type="date"></div>
            <button class="btn" id="payReg">Registrar pago</button>
        </div>
        <div class="card">
            <div class="card-header"><span class="card-title">Historial de pagos</span></div>
            ${(payments || []).length === 0 ? '<p class="hint">Sin pagos.</p>' : payments.map(p => `
                <div class="info-row"><span class="info-label">${p.period_start} a ${p.period_end}</span>
                <span class="info-value">${p.amount} · ${p.status}</span></div>`).join('')}
        </div>`;

    document.getElementById('agCreate').addEventListener('click', async () => {
        const name = document.getElementById('agName').value.trim();
        const owner = document.getElementById('agOwner').value.trim();
        if (!name || !owner) { window.showToast('Nombre y correo obligatorios', 'error'); return; }
        try {
            const { error } = await window.supabase.rpc('create_agency', { p_name: name, p_owner_email: owner });
            if (error) throw error;
            window.showToast('Agencia creada', 'success');
            renderAgenciesAdmin(content);
        } catch (err) { window.showToast(err.message, 'error'); }
    });

    content.querySelectorAll('.ag-assign').forEach(sel => sel.addEventListener('change', async () => {
        const modelId = sel.dataset.model;
        const ag = sel.value || null;
        try {
            if (ag) {
                const { error } = await window.supabase.rpc('assign_model_to_agency', { p_model_id: modelId, p_agency_id: ag });
                if (error) throw error;
            } else {
                await window.supabase.from('profiles').update({ agency_id: null }).eq('id', modelId);
            }
            window.showToast('Asignacion actualizada', 'success');
        } catch (err) { window.showToast(err.message, 'error'); }
    }));

    document.getElementById('payReg').addEventListener('click', async () => {
        const ag = document.getElementById('payAg').value;
        const amount = Number(document.getElementById('payAmount').value);
        const from = document.getElementById('payFrom').value;
        const to = document.getElementById('payTo').value;
        if (!ag || !amount) { window.showToast('Agencia y monto obligatorios', 'error'); return; }
        try {
            const { error } = await window.supabase.rpc('register_agency_payment', {
                p_agency_id: ag, p_amount: amount, p_period_start: from || null, p_period_end: to || null });
            if (error) throw error;
            window.showToast('Pago registrado', 'success');
            renderAgenciesAdmin(content);
        } catch (err) { window.showToast(err.message, 'error'); }
    });
}

// ============================================================================
// Admin: retiros pendientes (modelos sin agencia los ve admin)
// ============================================================================
async function renderPayoutsAdmin(content) {
    if (!content) return;
    const { data } = await window.supabase.from('model_payouts')
        .select('*').eq('status', 'pending').order('created_at', { ascending: false });

    content.innerHTML = `
        <div class="card">
            <div class="card-header"><span class="card-title">Retiros pendientes</span></div>
            ${(data || []).length === 0 ? '<p class="hint">Sin retiros pendientes.</p>' : data.map(p => `
                <div class="card" style="margin-bottom:8px;">
                    <div class="info-row"><span class="info-label">Modelo ${p.model_id.slice(0, 8)}... ${p.agency_id ? '(con agencia)' : '(sin agencia)'}</span>
                    <span class="info-value">${p.amount} tokens</span></div>
                    <div style="display:flex;gap:8px;">
                        <button class="btn" data-apay="${p.id}" style="flex:1;">Aprobar y pagar</button>
                        <button class="btn btn-danger" data-adeny="${p.id}" style="flex:1;">Rechazar</button>
                    </div>
                </div>`).join('')}
        </div>`;

    content.querySelectorAll('[data-apay]').forEach(b => b.addEventListener('click', async () => {
        try {
            const { error } = await window.supabase.rpc('approve_payout', { p_payout_id: b.dataset.apay, p_approve: true });
            if (error) throw error;
            window.showToast('Retiro pagado', 'success');
            renderPayoutsAdmin(content);
        } catch (err) { window.showToast(err.message, 'error'); }
    }));
    content.querySelectorAll('[data-adeny]').forEach(b => b.addEventListener('click', async () => {
        try {
            const { error } = await window.supabase.rpc('approve_payout', { p_payout_id: b.dataset.adeny, p_approve: false });
            if (error) throw error;
            window.showToast('Retiro rechazado y devuelto', 'info');
            renderPayoutsAdmin(content);
        } catch (err) { window.showToast(err.message, 'error'); }
    }));
}

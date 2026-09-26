// ============================================================================
// CONDONIS - COMPLIANCE: requisitos de Google Play / App Store
// Reporte de usuarios y contenido, contacto de soporte, y tab de reportes
// para el admin. Se carga en AMBOS bundles (store y web).
// ============================================================================

// Correo de soporte visible (cámbialo por el tuyo real antes de publicar)
const SUPPORT_EMAIL = 'soporte@condonis.com';

let complianceBoot = false;

document.addEventListener('DOMContentLoaded', () => {
    waitProfileC().then(() => { if (!complianceBoot) { complianceBoot = true; bootCompliance(); } });
});

async function waitProfileC() {
    for (let i = 0; i < 50; i++) {
        if (window.appState && window.appState.currentUser && window.appState.currentUser.profile) return true;
        await new Promise(r => setTimeout(r, 200));
    }
    return false;
}

function bootCompliance() {
    injectSupportLink();   // contacto de soporte en Perfil
    patchProfileModal();   // botón Reportar en el modal de perfil
    patchAdminReports();   // tab Reportes en el panel admin
}

// ----------------------------------------------------------------------------
// Contacto de soporte (requisito de ambas tiendas)
// ----------------------------------------------------------------------------
function injectSupportLink() {
    const cont = document.getElementById('profileContent');
    if (!cont || document.getElementById('supportRow')) return;
    const row = document.createElement('div');
    row.id = 'supportRow';
    row.className = 'info-row';
    row.innerHTML = `<span class="info-label">Soporte y contacto</span>
        <span class="info-value"><a href="mailto:${SUPPORT_EMAIL}" style="color:#00D4FF;">${SUPPORT_EMAIL}</a></span>`;
    cont.appendChild(row);
}

// ----------------------------------------------------------------------------
// Botón Reportar dentro del modal de perfil (UGC policy)
// ----------------------------------------------------------------------------
function patchProfileModal() {
    if (window.__cmpProfilePatched) return;
    window.__cmpProfilePatched = true;
    const orig = window.openModelProfile;
    if (!orig) return;

    window.openModelProfile = async function (...args) {
        await orig.apply(this, args);
        const body = document.getElementById('modelModalBody');
        if (!body || body.querySelector('#reportBtn')) return;
        const modelId = args[0];

        const btn = document.createElement('button');
        btn.id = 'reportBtn';
        btn.className = 'btn btn-secondary';
        btn.style.marginTop = '12px';
        btn.style.width = '100%';
        btn.textContent = 'Reportar usuario o contenido';
        body.appendChild(btn);

        btn.addEventListener('click', () => openReportDialog(modelId, 'profile', null));
    };
}

// ----------------------------------------------------------------------------
// Diálogo de reporte (razones predefinidas = moderación estructurada)
// ----------------------------------------------------------------------------
const REPORT_REASONS = [
    'Contenido sexual explícito o prohibido',
    'Posible menor de edad',
    'Acoso, abuso o amenazas',
    'Intento de llevar la conversación fuera (datos de contacto/pago)',
    'Fraude o estafa',
    'Spam o publicidad',
    'Otro (especificar)'
];

function openReportDialog(reportedId, context, mediaPath) {
    const overlay = document.getElementById('modelModal');
    const body = document.getElementById('modelModalBody');
    if (!overlay || !body) return;

    body.innerHTML = `
        <h3 class="modal-title">Reportar</h3>
        <p class="hint">Tu reporte es confidencial y lo revisa el equipo de moderación.</p>
        <div class="form-row">
            <label for="repReason">Motivo</label>
            <select id="repReason">${REPORT_REASONS.map(r => `<option>${r}</option>`).join('')}</select>
        </div>
        <div class="form-row">
            <label for="repDetail">Detalles (opcional)</label>
            <textarea id="repDetail" rows="3" maxlength="300"></textarea>
        </div>
        <button class="btn" id="repSend">Enviar reporte</button>
    `;
    overlay.classList.add('active');

    document.getElementById('repSend').addEventListener('click', async () => {
        const reason = document.getElementById('repReason').value;
        const detail = document.getElementById('repDetail').value.trim();
        try {
            const { error } = await window.supabase.rpc('report_user', {
                p_reported: reportedId,
                p_reason: reason + (detail ? ' | ' + detail : ''),
                p_context: context,
                p_media_path: mediaPath
            });
            if (error) throw error;
            window.showToast('Reporte enviado. Gracias por ayudar a mantener la comunidad segura.', 'success');
            if (window.closeModelModal) window.closeModelModal();
        } catch (err) {
            window.showToast('No se pudo enviar el reporte', 'error');
        }
    });
}
window.openReportDialog = openReportDialog;

// ----------------------------------------------------------------------------
// Tab "Reportes" en el panel admin (inyectada sin reescribir admin.js)
// ----------------------------------------------------------------------------
function patchAdminReports() {
    if (!window.renderAdminSection || window.__cmpAdminPatched) return;
    window.__cmpAdminPatched = true;
    const orig = window.renderAdminSection;

    window.renderAdminSection = async function (...args) {
        await orig.apply(this, args);
        const tabs = document.querySelector('.admin-tabs');
        if (!tabs || tabs.querySelector('[data-tab="reports"]')) return;

        const t = document.createElement('button');
        t.className = 'admin-tab'; t.dataset.tab = 'reports'; t.textContent = 'Reportes';
        tabs.appendChild(t);
        t.addEventListener('click', async () => {
            tabs.querySelectorAll('.admin-tab').forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            await renderReportsAdmin(document.getElementById('adminTabContent'));
        });
    };
}

async function renderReportsAdmin(content) {
    if (!content) return;
    const { data } = await window.supabase.from('user_reports')
        .select('*').order('created_at', { ascending: false }).limit(60);

    content.innerHTML = `
        <div class="card">
            <div class="card-header"><span class="card-title">Reportes de usuarios y contenido</span></div>
            ${(data || []).length === 0 ? '<p class="hint">Sin reportes.</p>' : data.map(r => `
                <div class="card" style="margin-bottom:8px;">
                    <div class="info-row"><span class="info-label">${r.context} · ${new Date(r.created_at).toLocaleString()}</span>
                    <span class="info-value">${r.status}</span></div>
                    <p class="hint">${r.reason}</p>
                    <div class="hint" style="font-size:11px;">Reportado: ${r.reported_id} · Por: ${r.reporter_id}</div>
                    <div style="display:flex;gap:8px;margin-top:8px;">
                        <button class="btn btn-secondary" data-rv="${r.id}" style="flex:1;">Marcar revisado</button>
                        <button class="btn btn-secondary" data-rd="${r.id}" style="flex:1;">Descartar</button>
                    </div>
                </div>`).join('')}
        </div>`;

    content.querySelectorAll('[data-rv]').forEach(b => b.addEventListener('click', async () => {
        await window.supabase.from('user_reports').update({ status: 'reviewed' }).eq('id', b.dataset.rv);
        renderReportsAdmin(content);
    }));
    content.querySelectorAll('[data-rd]').forEach(b => b.addEventListener('click', async () => {
        await window.supabase.from('user_reports').update({ status: 'dismissed' }).eq('id', b.dataset.rd);
        renderReportsAdmin(content);
    }));
}

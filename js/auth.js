// ============================================================================
// CONDONIS - AUTH: registro por género (Hombre->cliente, Mujer->modelo)
// y validación de edad. Branding desde CND_APP_NAME.
// ============================================================================

function initAuth() {
    applyBrand();
    setupAuthTabs(); setupLoginForm(); setupRegisterForm();
    setupResendConfirmation(); setupModals(); checkExistingSession();
}

// Aplica el nombre público de la app al título y al logo
function applyBrand() {
    const name = window.CND_APP_NAME || 'LinguaMeet';
    document.title = name + ' - Inicio';
    const h = document.getElementById('brandTitle');
    if (h) h.textContent = name;
}

async function checkExistingSession() {
    try { const { data: { session } } = await window.supabase.auth.getSession(); if (session) window.location.href = 'app.html'; } catch (e) {}
}

function switchTab(t) {
    document.querySelectorAll('.auth-tab').forEach(x => x.classList.toggle('active', x.dataset.tab === t));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.toggle('active', f.id === t + 'Form'));
}
function setupAuthTabs() {
    document.querySelectorAll('.auth-tab').forEach(t => t.addEventListener('click', () => { switchTab(t.dataset.tab); hideAlert(); }));
}

function setupLoginForm() {
    const f = document.getElementById('loginForm'); if (!f) return;
    f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const pass = document.getElementById('loginPassword').value;
        const b = document.getElementById('loginBtn');
        b.disabled = true; b.innerHTML = '<span class="spinner"></span>';
        try {
            const { error } = await window.supabase.auth.signInWithPassword({ email, password: pass });
            if (error) throw error;
            showAlert('Inicio de sesión exitoso', 'success');
            setTimeout(() => window.location.href = 'app.html', 800);
        } catch (err) {
            showAlert(String(err.message).includes('Invalid') ? 'Credenciales inválidas.' :
                        String(err.message).includes('not confirmed') ? 'Correo sin confirmar. Usa Reenviar enlace.' : err.message, 'error');
            b.disabled = false; b.textContent = 'Iniciar Sesión';
        }
    });
}

function setupResendConfirmation() {
    const l = document.getElementById('resendConfirmationLink'); if (!l) return;
    l.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        if (!email) { showAlert('Escribe tu correo arriba.', 'error'); return; }
        try { const { error } = await window.supabase.auth.resend({ type: 'signup', email }); if (error) throw error;
            showAlert('Enlace reenviado.', 'success'); } catch (e2) { showAlert('No se pudo reenviar.', 'error'); }
    });
}

function isAdult(b) {
    if (!b) return false;
    const d = new Date(b); if (isNaN(d)) return false;
    const t = new Date(); let a = t.getFullYear() - d.getFullYear();
    const m = t.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--;
    return a >= 18;
}

function setupRegisterForm() {
    const f = document.getElementById('registerForm'); if (!f) return;
    const gender = document.getElementById('registerGender');
    const ageCheck = document.getElementById('ageCheck');

    // El checkbox KYC/+18 reforzado solo aplica a mujeres (creadoras)
    gender.addEventListener('change', () => {
        const fem = gender.value === 'female';
        ageCheck.style.display = fem ? 'flex' : 'none';
        document.getElementById('isAdult').required = fem;
    });

    f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const pass = document.getElementById('registerPassword').value;
        const birth = document.getElementById('registerBirth').value;
        const gen = gender.value;
        const terms = document.getElementById('acceptTerms').checked;
        const adult = document.getElementById('isAdult').checked;
        const b = document.getElementById('registerBtn');

        // Mapeo de género a rol interno (sin cambiar la base de datos)
        const role = (gen === 'female') ? 'model' : 'client';

        if (!terms) { showAlert('Debes aceptar los Términos.', 'error'); return; }
        if (!isAdult(birth)) { showAlert('Debes ser mayor de 18 años.', 'error'); return; }
        if (role === 'model' && !adult) { showAlert('Confirma que eres +18 y aceptas la verificación de creadora.', 'error'); return; }

        b.disabled = true; b.innerHTML = '<span class="spinner"></span>';
        try {
            const confirmUrl = new URL('confirm.html', window.location.href).toString();
            const { data, error } = await window.supabase.auth.signUp({
                email, password: pass,
                options: { data: { full_name: name, role, birth_date: birth }, emailRedirectTo: confirmUrl }
            });
            if (error) throw error;
            if (data.user) await window.supabase.from('profiles').update({ birth_date: birth }).eq('id', data.user.id);

            if (data.user && data.user.identities && data.user.identities.length === 0) {
                showAlert('Correo ya registrado. Inicia sesión.', 'error');
                document.getElementById('loginEmail').value = email; switchTab('login');
            } else if (data.session) {
                showAlert('Cuenta creada. Redirigiendo...', 'success');
                setTimeout(() => window.location.href = 'app.html', 1200);
            } else {
                showAlert('Cuenta creada. Revisa tu correo y abre el enlace.', 'success');
                document.getElementById('loginEmail').value = email; switchTab('login'); f.reset();
            }
        } catch (err) { showAlert(err.message || 'Error al crear la cuenta', 'error'); }
        b.disabled = false; b.textContent = 'Crear Cuenta';
    });
}

function setupModals() {
    const t = document.getElementById('showTerms');
    if (t) t.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('termsModal').classList.add('active'); });
    const p = document.getElementById('showPrivacy');
    if (p) p.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('privacyModal').classList.add('active'); });
}
function closeModal(id) { const m = document.getElementById(id); if (m) m.classList.remove('active'); }
function showAlert(m, t) { const a = document.getElementById('authAlert'); if (!a) return; a.textContent = m; a.className = 'alert ' + t; a.style.display = 'block'; }
function hideAlert() { const a = document.getElementById('authAlert'); if (a) a.style.display = 'none'; }

document.addEventListener('DOMContentLoaded', initAuth);
window.closeModal = closeModal;

// ============================================================================
// CONDONIS - CONFIRM: página de confirmación de correo por enlace.
// Estados: verificando / confirmado / error. Sin onclick inline (CSP).
// ============================================================================

let resolved = false;   // evita resolver dos veces (regla A12)
let countdownTimer = null;

function setState(kind) {
    const icon = document.getElementById('stateIcon');
    const title = document.getElementById('confirmTitle');
    const msg = document.getElementById('confirmMsg');
    const goApp = document.getElementById('goAppBtn');
    const goLogin = document.getElementById('goLoginBtn');
    const cd = document.getElementById('countdown');

    if (kind === 'loading') {
        icon.innerHTML = '<div class="spin"></div>';
        title.textContent = 'Verificando tu correo...';
        msg.textContent = 'Estamos confirmando tu cuenta. No cierres esta ventana.';
        goApp.style.display = 'none'; goLogin.style.display = 'none'; cd.style.display = 'none';
    } else if (kind === 'success') {
        icon.innerHTML = '<svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        title.textContent = 'Correo confirmado';
        msg.textContent = 'Tu cuenta está verificada. Entrando a la aplicación...';
        goApp.style.display = 'block'; goLogin.style.display = 'none'; cd.style.display = 'block';
        startCountdown();
    } else {
        icon.innerHTML = '<svg class="cross" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        title.textContent = 'No pudimos confirmar';
        msg.textContent = 'El enlace es inválido o ya expiró. Vuelve al inicio e inicia sesión, o pide un enlace nuevo.';
        goApp.style.display = 'none'; goLogin.style.display = 'block'; cd.style.display = 'none';
    }
}

function startCountdown() {
    let s = 5;
    const cd = document.getElementById('countdown');
    cd.textContent = 'Entrando en ' + s + 's...';
    countdownTimer = setInterval(() => {
        s -= 1;
        if (s <= 0) { clearInterval(countdownTimer); irAlApp(); }
        else cd.textContent = 'Entrando en ' + s + 's...';
    }, 1000);
}

function cleanUrl() {
    // Quita tokens del hash/URL sin recargar (no deja credenciales en historial)
    try { history.replaceState(null, '', window.location.pathname); } catch (e) {}
}

function showSuccess() {
    if (resolved) return;
    resolved = true;
    cleanUrl();
    setState('success');
}

function showError() {
    if (resolved) return;
    resolved = true;
    cleanUrl();
    setState('error');
}

function irAlApp() {
    if (countdownTimer) clearInterval(countdownTimer);
    window.location.href = 'app.html';
}

function irAlLogin() {
    window.location.href = 'index.html';
}

async function initConfirm() {
    setState('loading');

    // 1) Si la URL trae tokens en el hash, supabase-js los detecta al iniciar.
    try {
        const { data } = await window.supabase.auth.getSession();
        if (data && data.session) { showSuccess(); return; }
    } catch (e) {}

    // 2) Esperar evento de autenticación (confirmación por enlace).
    let done = false;
    window.supabase.auth.onAuthStateChange((event, session) => {
        if (done) return;
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
            done = true; showSuccess();
        }
    });

    // 3) Timeout de seguridad: si en 4s no hay sesión, es un enlace inválido.
    setTimeout(() => { if (!done && !resolved) showError(); }, 4000);
}

document.addEventListener('DOMContentLoaded', initConfirm);

// Expuestas en window para que security.js ate los botones sin onclick
window.irAlApp = irAlApp;
window.irAlLogin = irAlLogin;

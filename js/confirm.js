// ============================================================================
// CONDONIS - CONFIRM: procesa el enlace de confirmación de correo
// El enlace de Supabase llega con tokens en el hash (#access_token=...).
// supabase-js los detecta automáticamente al crear el cliente (config.js).
// ============================================================================

// Bandera para resolver una sola vez (evita dobles renders, regla A12)
let confirmResolved = false;

// Id del intervalo de cuenta regresiva (para poder limpiarlo)
let countdownInterval = null;

// ============================================================================
// FUNCIÓN: setState()
// Muestra un único bloque de estado y oculta los demás
// ============================================================================
function setState(stateId) {
    document.querySelectorAll('.state').forEach(block => {
        block.classList.remove('active'); // oculta todos
    });
    const target = document.getElementById(stateId);
    if (target) target.classList.add('active'); // muestra el pedido
}

// ============================================================================
// FUNCIÓN: cleanUrl()
// Retira los tokens del hash de la URL por seguridad y estética
// ============================================================================
function cleanUrl() {
    history.replaceState(null, '', window.location.pathname);
}

// ============================================================================
// FUNCIÓN: showSuccess()
// Muestra el check animado y arranca la cuenta regresiva hacia app.html
// ============================================================================
function showSuccess() {
    setState('stateSuccess');

    let seconds = 5; // segundos antes de redirigir automáticamente
    const counter = document.getElementById('countdown');

    countdownInterval = setInterval(() => {
        seconds -= 1;
        if (counter) counter.textContent = String(seconds);

        if (seconds <= 0) {
            clearInterval(countdownInterval); // detener contador
            window.location.href = 'app.html'; // entrar a la app
        }
    }, 1000);
}

// ============================================================================
// FUNCIÓN: showError()
// Muestra el estado de error con un mensaje amigable
// ============================================================================
function showError(message) {
    const card = document.getElementById('confirmCard');
    const text = document.getElementById('errorMessage');

    if (text && message) text.textContent = message; // mensaje específico
    setState('stateError');

    if (card) {
        card.classList.add('shake'); // sacudida visual de error
        setTimeout(() => card.classList.remove('shake'), 600);
    }
}

// ============================================================================
// FUNCIÓN: initConfirm()
// Arranque: revisa errores en el hash, escucha la sesión y pone timeout
// ============================================================================
function initConfirm() {
    // Leer parámetros del hash (#error=...&error_description=...)
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const hashError = hashParams.get('error');

    // Caso: Supabase respondió un error explícito (token expirado, etc.)
    if (hashError) {
        confirmResolved = true;
        cleanUrl();
        showError(hashParams.get('error_description') || 'El enlace de confirmación es inválido o expiró.');
        return;
    }

    // Escuchar el cambio de estado de auth (el cliente ya procesó el hash)
    window.supabase.auth.onAuthStateChange((event, session) => {
        const isSessionEvent = (event === 'SIGNED_IN' || event === 'INITIAL_SESSION');
        if (!confirmResolved && isSessionEvent && session) {
            confirmResolved = true; // resolver una sola vez
            cleanUrl();
            showSuccess();
        }
    });

    // Red de seguridad: si en 3s no hubo sesión, el enlace no sirvió
    setTimeout(async () => {
        if (confirmResolved) return;

        const { data } = await window.supabase.auth.getSession();

        if (data.session) {
            confirmResolved = true;
            cleanUrl();
            showSuccess();
        } else {
            confirmResolved = true;
            cleanUrl();
            showError('El enlace de confirmación es inválido o expiró. Solicita un enlace nuevo desde la pantalla de inicio.');
        }
    }, 3000);
}

// ============================================================================
// FUNCIÓN: irAlApp()
// Navegación inmediata a la aplicación (botón del estado éxito)
// ============================================================================
function irAlApp() {
    if (countdownInterval) clearInterval(countdownInterval); // limpiar timer
    window.location.href = 'app.html';
}

// ============================================================================
// FUNCIÓN: irAlLogin()
// Vuelve a la pantalla de inicio (botón del estado error)
// ============================================================================
function irAlLogin() {
    window.location.href = 'index.html';
}

// ============================================================================
// INICIALIZACIÓN al cargar el DOM
// ============================================================================
document.addEventListener('DOMContentLoaded', initConfirm);

// Exposición global para onclick inline del HTML (regla A2)
window.irAlApp = irAlApp;
window.irAlLogin = irAlLogin;

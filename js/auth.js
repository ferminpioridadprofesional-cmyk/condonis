// ============================================================================
// CONDONIS - AUTH: login/registro + TyC vivos actualizados por versión
// V5.0: inyecta las cláusulas nuevas (chat seguro, regalos, eliminación de
// cuenta) dentro de los modales existentes sin reescribir index.html.
// ============================================================================

function initAuth() {
    setupAuthTabs();
    setupLoginForm();
    setupRegisterForm();
    setupResendConfirmation();
    setupModals();
    injectLegalV5();
    checkExistingSession();
}

async function checkExistingSession() {
    try {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (session) window.location.href = 'app.html';
    } catch (error) { console.error('Error al verificar sesión:', error); }
}

function switchTab(tabName) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.toggle('active', f.id === tabName + 'Form'));
}

function setupAuthTabs() {
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => { switchTab(tab.dataset.tab); hideAlert(); });
    });
}

function setupLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const button = document.getElementById('loginBtn');
        button.disabled = true; button.innerHTML = '<span class="spinner"></span>';
        try {
            const { data, error } = await window.supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            showAlert('Inicio de sesión exitoso', 'success');
            setTimeout(() => { window.location.href = 'app.html'; }, 800);
        } catch (error) {
            if (String(error.message).includes('Invalid login credentials')) showAlert('Credenciales inválidas.', 'error');
            else if (String(error.message).includes('not confirmed')) showAlert('Correo sin confirmar. Usa Reenviar enlace.', 'error');
            else showAlert(error.message || 'Error al iniciar sesión', 'error');
            button.disabled = false; button.textContent = 'Iniciar Sesión';
        }
    });
}

function setupResendConfirmation() {
    const link = document.getElementById('resendConfirmationLink');
    if (!link) return;
    link.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        if (!email) { showAlert('Escribe tu correo arriba primero.', 'error'); return; }
        try {
            const { error } = await window.supabase.auth.resend({ type: 'signup', email });
            if (error) throw error;
            showAlert('Enlace reenviado. Revisa tu bandeja.', 'success');
        } catch (error) { showAlert('No se pudo reenviar ahora.', 'error'); }
    });
}

function setupRegisterForm() {
    const form = document.getElementById('registerForm');
    if (!form) return;
    const roleSelect = document.getElementById('registerRole');
    const ageCheck = document.getElementById('ageCheck');

    roleSelect.addEventListener('change', () => {
        if (roleSelect.value === 'model') { ageCheck.style.display = 'flex'; document.getElementById('isAdult').required = true; }
        else { ageCheck.style.display = 'none'; document.getElementById('isAdult').required = false; document.getElementById('isAdult').checked = false; }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const role = roleSelect.value;
        const acceptTerms = document.getElementById('acceptTerms').checked;
        const isAdult = document.getElementById('isAdult').checked;
        const button = document.getElementById('registerBtn');

        if (!acceptTerms) { showAlert('Debes aceptar los Términos y Condiciones', 'error'); return; }
        if (role === 'model' && !isAdult) { showAlert('Debes confirmar que eres mayor de 18 años', 'error'); return; }

        button.disabled = true; button.innerHTML = '<span class="spinner"></span>';
        try {
            const confirmUrl = new URL('confirm.html', window.location.href).toString();
            const { data, error } = await window.supabase.auth.signUp({
                email, password,
                options: { data: { full_name: name, role }, emailRedirectTo: confirmUrl }
            });
            if (error) throw error;

            if (data.user && data.user.identities && data.user.identities.length === 0) {
                showAlert('Este correo ya está registrado. Inicia sesión o reenvía el enlace.', 'error');
                document.getElementById('loginEmail').value = email;
                switchTab('login');
            } else if (data.session) {
                showAlert('Cuenta creada. Redirigiendo...', 'success');
                setTimeout(() => { window.location.href = 'app.html'; }, 1200);
            } else {
                showAlert('Cuenta creada. Revisa tu correo y abre el enlace de confirmación.', 'success');
                document.getElementById('loginEmail').value = email;
                switchTab('login');
                form.reset();
            }
        } catch (error) {
            showAlert(error.message || 'Error al crear la cuenta', 'error');
        }
        button.disabled = false; button.textContent = 'Crear Cuenta';
    });
}

function setupModals() {
    const showTerms = document.getElementById('showTerms');
    if (showTerms) showTerms.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('termsModal').classList.add('active'); });
    const showPrivacy = document.getElementById('showPrivacy');
    if (showPrivacy) showPrivacy.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('privacyModal').classList.add('active'); });
}

// ============================================================================
// injectLegalV5(): añade cláusulas nuevas a TyC y Privacidad (idempotente)
// ============================================================================
function injectLegalV5() {
    const terms = document.querySelector('#termsModal .modal-content');
    if (terms && !document.getElementById('legalV5Terms')) {
        const block = document.createElement('div');
        block.id = 'legalV5Terms';
        block.innerHTML = `
            <p><strong>13. Chat dentro de las llamadas y protección de datos</strong></p>
            <p>Durante las videollamadas existe un chat destinado únicamente a la comunicación entre cliente y modelo. Queda estrictamente prohibido compartir o solicitar: numeros de telefono, WhatsApp, Telegram, correos electronicos, usuarios de redes sociales, direcciones de domicilio, datos bancarios, cuentas de pago (PayPal, Zelle, Binance, Cash App u otras) y enlaces o URLs. El sistema detecta y bloquea automaticamente este tipo de contenido y genera una alerta inmediata al equipo de administración con la conversación completa. Las cuentas que intenten evadir esta regla podran ser suspendidas o eliminadas sin previo aviso.</p>
            <p><strong>14. Regalos y artículos virtuales</strong></p>
            <p>Los clientes pueden enviar regalos virtuales durante las llamadas. Cada regalo tiene un precio en tokens que se descuenta del saldo del cliente y acredita a la modelo el porcentaje que la plataforma define para su nivel. Los regalos y tokens son artículos virtuales: no tienen valor monetario fuera de la plataforma, no son transferibles entre usuarios y no son reembolsables una vez enviados o consumidos.</p>
            <p><strong>15. Eliminación de cuenta</strong></p>
            <p>Cualquier usuario puede eliminar su cuenta de forma definitiva desde su perfil, o solicitarlo al soporte. La eliminación borra de manera permanente el perfil, los datos personales, los documentos de verificación, el historial de llamadas y transacciones, y libera el correo para un registro futuro, salvo la información que la ley obligue a conservar. Esta opción cumple con los requisitos de las tiendas de aplicaciones.</p>
        `;
        const closeBtn = terms.querySelector('.modal-close');
        terms.insertBefore(block, closeBtn);
    }

    const privacy = document.querySelector('#privacyModal .modal-content');
    if (privacy && !document.getElementById('legalV5Privacy')) {
        const block = document.createElement('div');
        block.id = 'legalV5Privacy';
        block.innerHTML = `
            <p><strong>11. Moderación del chat de llamadas</strong></p>
            <p>Para proteger a la comunidad y cumplir la ley, los mensajes del chat dentro de las llamadas son analizados automaticamente en busca de datos personales o de pago. Cuando se detecta una infracción, el mensaje se bloquea y se conserva una copia de la conversación para revisión exclusiva del equipo de administración. No se lee ni conserva el contenido de las videollamadas.</p>
        `;
        const closeBtn = privacy.querySelector('.modal-close');
        privacy.insertBefore(block, closeBtn);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

function showAlert(message, type) {
    const alert = document.getElementById('authAlert');
    if (!alert) return;
    alert.textContent = message; alert.className = 'alert ' + type; alert.style.display = 'block';
}
function hideAlert() {
    const alert = document.getElementById('authAlert');
    if (alert) alert.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', initAuth);
window.closeModal = closeModal;

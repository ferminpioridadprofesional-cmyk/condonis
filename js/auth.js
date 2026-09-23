// ============================================================================
// CONDONIS - AUTH: Login, Registro y Confirmación por Enlace
// Flujo sin OTP: el correo por defecto de Supabase trae el enlace, y ese
// enlace cae en confirm.html gracias a emailRedirectTo + Redirect URLs.
// ============================================================================

// ============================================================================
// FUNCIÓN: initAuth()
// Inicializa todos los bloques de autenticación al cargar index.html
// ============================================================================
function initAuth() {
    setupAuthTabs();            // cambio login/registro
    setupLoginForm();           // envío de login
    setupRegisterForm();        // envío de registro
    setupResendConfirmation();  // reenvío de enlace para pendientes
    setupModals();              // modales TyC y Privacidad
    checkExistingSession();     // redirección si ya hay sesión
}

// ============================================================================
// FUNCIÓN: checkExistingSession()
// Si ya hay sesión activa (incluye llegada con tokens en el hash), entra
// ============================================================================
async function checkExistingSession() {
    try {
        const { data: { session } } = await window.supabase.auth.getSession();

        if (session) {
            window.location.href = 'app.html'; // sesión viva: entrar
        }
    } catch (error) {
        console.error('Error al verificar sesión:', error);
    }
}

// ============================================================================
// FUNCIÓN: switchTab()
// Activa un tab ('login' | 'register') y su formulario correspondiente
// ============================================================================
function switchTab(tabName) {
    const tabs = document.querySelectorAll('.auth-tab');
    const forms = document.querySelectorAll('.auth-form');

    tabs.forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabName);
    });

    forms.forEach(form => {
        form.classList.toggle('active', form.id === `${tabName}Form`);
    });
}

// ============================================================================
// FUNCIÓN: setupAuthTabs()
// Configura el clic en los tabs de login y registro
// ============================================================================
function setupAuthTabs() {
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            switchTab(tab.dataset.tab); // conmuta tab y formulario
            hideAlert();                // limpia mensajes al cambiar
        });
    });
}

// ============================================================================
// FUNCIÓN: setupLoginForm()
// Procesa el inicio de sesión con email y contraseña
// ============================================================================
function setupLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault(); // sin recarga de página

        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const button = document.getElementById('loginBtn');

        button.disabled = true;
        button.innerHTML = '<span class="spinner"></span>';

        try {
            const { data, error } = await window.supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            showAlert('Inicio de sesión exitoso', 'success');
            setTimeout(() => {
                window.location.href = 'app.html';
            }, 800);

        } catch (error) {
            console.error('Error en login:', error);

            if (String(error.message).includes('Invalid login credentials')) {
                showAlert('Credenciales inválidas. Verifica tu correo y contraseña.', 'error');
            } else if (String(error.message).includes('not confirmed')) {
                showAlert('Tu correo aún no está confirmado. Pulsa "Reenviar enlace" aquí abajo y abre el correo que te llegue.', 'error');
            } else {
                showAlert(error.message || 'Error al iniciar sesión', 'error');
            }

            button.disabled = false;
            button.textContent = 'Iniciar Sesión';
        }
    });
}

// ============================================================================
// FUNCIÓN: setupResendConfirmation()
// Reenvía el correo de confirmación usando el email escrito en el login
// ============================================================================
function setupResendConfirmation() {
    const link = document.getElementById('resendConfirmationLink');
    if (!link) return;

    link.addEventListener('click', async (e) => {
        e.preventDefault(); // no navegar

        const email = document.getElementById('loginEmail').value.trim();

        // Sin correo escrito no hay a quién reenviar
        if (!email) {
            showAlert('Escribe tu correo arriba y luego pulsa Reenviar enlace.', 'error');
            return;
        }

        try {
            // Supabase reenvía el correo de confirmación de signup
            const { error } = await window.supabase.auth.resend({
                type: 'signup',
                email: email
            });

            if (error) throw error;

            showAlert('Enlace de confirmación reenviado. Revisa tu bandeja de entrada y ábrelo.', 'success');
        } catch (error) {
            console.error('Error al reenviar confirmación:', error);
            showAlert('No pudimos reenviar el enlace. Verifica que el correo esté bien escrito o espera un minuto.', 'error');
        }
    });
}

// ============================================================================
// FUNCIÓN: setupRegisterForm()
// Registro con validaciones legales y arranque del flujo de enlace
// ============================================================================
function setupRegisterForm() {
    const form = document.getElementById('registerForm');
    if (!form) return;

    const roleSelect = document.getElementById('registerRole');
    const ageCheck = document.getElementById('ageCheck');

    // El checkbox de mayoría de edad solo aplica a modelos (regla L1)
    roleSelect.addEventListener('change', () => {
        if (roleSelect.value === 'model') {
            ageCheck.style.display = 'flex';
            document.getElementById('isAdult').required = true;
        } else {
            ageCheck.style.display = 'none';
            document.getElementById('isAdult').required = false;
            document.getElementById('isAdult').checked = false;
        }
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

        if (!acceptTerms) {
            showAlert('Debes aceptar los Términos y Condiciones', 'error');
            return;
        }

        if (role === 'model' && !isAdult) {
            showAlert('Debes confirmar que eres mayor de 18 años', 'error');
            return;
        }

        button.disabled = true;
        button.innerHTML = '<span class="spinner"></span>';

        try {
            // Página propia donde debe caer el enlace de confirmación
            const confirmUrl = new URL('confirm.html', window.location.href).toString();

            // Crear usuario con metadata para el trigger de perfiles
            const { data, error } = await window.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: name,
                        role: role
                    },
                    emailRedirectTo: confirmUrl // el enlace abre confirm.html
                }
            });

            if (error) throw error;

            // identities vacío = correo ya registrado previamente
            if (data.user && data.user.identities && data.user.identities.length === 0) {
                showAlert('Este correo ya está registrado. Si no lo confirmaste, pulsa "Reenviar enlace" en Iniciar Sesión.', 'error');
                document.getElementById('loginEmail').value = email; // prellenar
                switchTab('login'); // llevar al login con el correo listo
                button.disabled = false;
                button.textContent = 'Crear Cuenta';
                return;
            }

            if (data.session) {
                // Confirmación desactivada en el proyecto: entrar directo
                showAlert('Cuenta creada exitosamente. Redirigiendo...', 'success');
                setTimeout(() => {
                    window.location.href = 'app.html';
                }, 1200);
            } else {
                // Confirmación activada: guiar al correo y preparar login
                showAlert('Cuenta creada. Revisa tu bandeja de entrada y abre el enlace de confirmación para activar tu cuenta.', 'success');
                document.getElementById('loginEmail').value = email; // prellenar
                switchTab('login'); // queda listo para entrar al confirmar
                form.reset();       // limpiar formulario de registro
            }

        } catch (error) {
            console.error('Error en registro:', error);
            showAlert(error.message || 'Error al crear la cuenta', 'error');
        }

        button.disabled = false;
        button.textContent = 'Crear Cuenta';
    });
}

// ============================================================================
// FUNCIÓN: setupModals()
// Abre los modales de TyC y Privacidad desde los enlaces del registro
// ============================================================================
function setupModals() {
    const showTerms = document.getElementById('showTerms');
    if (showTerms) {
        showTerms.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('termsModal').classList.add('active');
        });
    }

    const showPrivacy = document.getElementById('showPrivacy');
    if (showPrivacy) {
        showPrivacy.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('privacyModal').classList.add('active');
        });
    }
}

// ============================================================================
// FUNCIÓN: closeModal()
// Cierra un modal por su id (onclick inline del HTML)
// ============================================================================
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

// ============================================================================
// FUNCIÓN: showAlert() / hideAlert()
// Alertas globales del contenedor de autenticación
// ============================================================================
function showAlert(message, type) {
    const alert = document.getElementById('authAlert');
    if (!alert) return;
    alert.textContent = message;
    alert.className = `alert ${type}`;
    alert.style.display = 'block';
}

function hideAlert() {
    const alert = document.getElementById('authAlert');
    if (alert) alert.style.display = 'none';
}

// ============================================================================
// INICIALIZACIÓN al cargar el DOM
// ============================================================================
document.addEventListener('DOMContentLoaded', initAuth);

// Exposición global para onclick inline (regla A2: sin colisiones)
window.closeModal = closeModal;

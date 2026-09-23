// ============================================================================
// CONDONIS - AUTH: Lógica de Autenticación (Login/Registro)
// Maneja el flujo completo de autenticación en index.html
// ============================================================================

// ============================================================================
// FUNCIÓN: initAuth()
// Inicializa el sistema de autenticación al cargar index.html
// ============================================================================
function initAuth() {
    setupAuthTabs();      // Cambio entre login y registro
    setupLoginForm();     // Envío del formulario de login
    setupRegisterForm();  // Envío del formulario de registro
    setupModals();        // Modales de TyC y Privacidad
    checkExistingSession(); // Redirige si ya hay sesión activa
}

// ============================================================================
// FUNCIÓN: checkExistingSession()
// Si ya existe sesión activa, salta directo a la aplicación
// ============================================================================
async function checkExistingSession() {
    try {
        const { data: { session } } = await window.supabase.auth.getSession();

        if (session) {
            window.location.href = 'app.html'; // sesión viva: entrar directo
        }
    } catch (error) {
        console.error('Error al verificar sesión:', error);
    }
}

// ============================================================================
// FUNCIÓN: setupAuthTabs()
// Alterna entre formularios de login y registro
// ============================================================================
function setupAuthTabs() {
    const tabs = document.querySelectorAll('.auth-tab');
    const forms = document.querySelectorAll('.auth-form');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;

            // Activar el tab clicado y desactivar el resto
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Mostrar solo el formulario correspondiente
            forms.forEach(form => {
                form.classList.remove('active');
                if (form.id === `${targetTab}Form`) {
                    form.classList.add('active');
                }
            });

            hideAlert(); // limpiar mensajes al cambiar de tab
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
        e.preventDefault(); // evitar recarga del formulario

        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const button = document.getElementById('loginBtn');

        button.disabled = true;                 // bloquear doble envío
        button.innerHTML = '<span class="spinner"></span>'; // feedback visual

        try {
            const { data, error } = await window.supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error; // credenciales inválidas u otro error

            showAlert('Inicio de sesión exitoso', 'success');
            setTimeout(() => {
                window.location.href = 'app.html'; // entrar a la app
            }, 800);

        } catch (error) {
            console.error('Error en login:', error);
            // Mensajes amigables para errores comunes de Auth
            if (String(error.message).includes('Invalid login credentials')) {
                showAlert('Credenciales inválidas. Verifica tu correo y contraseña.', 'error');
            } else if (String(error.message).includes('not confirmed')) {
                showAlert('Tu correo aún no está confirmado. Revisa tu bandeja de entrada.', 'error');
            } else {
                showAlert(error.message || 'Error al iniciar sesión', 'error');
            }
            button.disabled = false;
            button.textContent = 'Iniciar Sesión';
        }
    });
}

// ============================================================================
// FUNCIÓN: setupRegisterForm()
// Procesa el registro con validaciones de TyC y mayoría de edad
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
        e.preventDefault(); // evitar recarga

        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const role = roleSelect.value;
        const acceptTerms = document.getElementById('acceptTerms').checked;
        const isAdult = document.getElementById('isAdult').checked;
        const button = document.getElementById('registerBtn');

        // Validación: TyC obligatorias (regla L2)
        if (!acceptTerms) {
            showAlert('Debes aceptar los Términos y Condiciones', 'error');
            return;
        }

        // Validación: mayoría de edad obligatoria para modelos (regla L1)
        if (role === 'model' && !isAdult) {
            showAlert('Debes confirmar que eres mayor de 18 años', 'error');
            return;
        }

        button.disabled = true;
        button.innerHTML = '<span class="spinner"></span>';

        try {
            // Crear usuario en Supabase Auth con metadata para el trigger
            const { data, error } = await window.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: name, // lo lee handle_new_user()
                        role: role       // lo lee handle_new_user()
                    }
                }
            });

            if (error) throw error;

            // Caso: email duplicado (Supabase devuelve user sin identidades)
            if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
                showAlert('Este correo ya está registrado. Intenta iniciar sesión.', 'error');
                button.disabled = false;
                button.textContent = 'Crear Cuenta';
                return;
            }

            if (data.session) {
                // Confirmación de email DESACTIVADA: entrar directo
                showAlert('Cuenta creada exitosamente. Redirigiendo...', 'success');
                setTimeout(() => {
                    window.location.href = 'app.html';
                }, 1200);
            } else {
                // Confirmación de email ACTIVADA: pedir verificación
                showAlert('Cuenta creada. Revisa tu correo y confirma tu cuenta para iniciar sesión.', 'success');
                button.disabled = false;
                button.textContent = 'Crear Cuenta';
                form.reset(); // limpiar formulario para el login posterior
            }

        } catch (error) {
            console.error('Error en registro:', error);
            showAlert(error.message || 'Error al crear la cuenta', 'error');
            button.disabled = false;
            button.textContent = 'Crear Cuenta';
        }
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
            e.preventDefault(); // no navegar
            document.getElementById('termsModal').classList.add('active');
        });
    }

    const showPrivacy = document.getElementById('showPrivacy');
    if (showPrivacy) {
        showPrivacy.addEventListener('click', (e) => {
            e.preventDefault(); // no navegar
            document.getElementById('privacyModal').classList.add('active');
        });
    }
}

// ============================================================================
// FUNCIÓN: closeModal()
// Cierra un modal por su id (usada por onclick inline en index.html)
// ============================================================================
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// ============================================================================
// FUNCIÓN: showAlert()
// Muestra un mensaje de alerta visible en el formulario
// ============================================================================
function showAlert(message, type) {
    const alert = document.getElementById('authAlert');
    if (!alert) return;

    alert.textContent = message;
    alert.className = `alert ${type}`;
    alert.style.display = 'block';
}

// ============================================================================
// FUNCIÓN: hideAlert()
// Oculta el mensaje de alerta actual
// ============================================================================
function hideAlert() {
    const alert = document.getElementById('authAlert');
    if (alert) {
        alert.style.display = 'none';
    }
}

// ============================================================================
// INICIALIZACIÓN al cargar el DOM
// ============================================================================
document.addEventListener('DOMContentLoaded', initAuth);

// Exposición global para onclick inline del HTML (regla A2: sin colisiones)
window.closeModal = closeModal;

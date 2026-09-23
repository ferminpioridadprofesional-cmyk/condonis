// ============================================================================
// CONDONIS - AUTH: Lógica de Autenticación (Login/Registro)
// Este archivo maneja el flujo de autenticación de usuarios
// ============================================================================

// ============================================================================
// FUNCIÓN: initAuth()
// Inicializa el sistema de autenticación
// ============================================================================
function initAuth() {
    // Configurar tabs de autenticación
    setupAuthTabs();

    // Configurar formularios
    setupLoginForm();
    setupRegisterForm();

    // Configurar modales de TyC y Privacidad
    setupModals();

    // Verificar si ya hay sesión activa
    checkExistingSession();
}

// ============================================================================
// FUNCIÓN: checkExistingSession()
// Verifica si ya existe una sesión activa y redirige si es necesario
// ============================================================================
async function checkExistingSession() {
    try {
        const { data: { session } } = await window.supabase.auth.getSession();
        
        if (session) {
            // Ya hay sesión activa, redirigir a la aplicación
            window.location.href = 'app.html';
        }
    } catch (error) {
        console.error('Error al verificar sesión:', error);
    }
}

// ============================================================================
// FUNCIÓN: setupAuthTabs()
// Configura el cambio entre tabs de login y registro
// ============================================================================
function setupAuthTabs() {
    const tabs = document.querySelectorAll('.auth-tab');
    const forms = document.querySelectorAll('.auth-form');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;

            // Actualizar tabs activos
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Actualizar formularios activos
            forms.forEach(form => {
                form.classList.remove('active');
                if (form.id === `${targetTab}Form`) {
                    form.classList.add('active');
                }
            });

            // Limpiar mensajes de error
            hideAlert();
        });
    });
}

// ============================================================================
// FUNCIÓN: setupLoginForm()
// Configura el formulario de inicio de sesión
// ============================================================================
function setupLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const button = document.getElementById('loginBtn');

        // Deshabilitar botón y mostrar loading
        button.disabled = true;
        button.innerHTML = '<span class="spinner"></span>';

        try {
            // Intentar iniciar sesión
            const { data, error } = await window.supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            // Éxito: redirigir a la aplicación
            showAlert('Inicio de sesión exitoso', 'success');
            setTimeout(() => {
                window.location.href = 'app.html';
            }, 1000);

        } catch (error) {
            console.error('Error en login:', error);
            showAlert(error.message || 'Error al iniciar sesión', 'error');
            button.disabled = false;
            button.textContent = 'Iniciar Sesión';
        }
    });
}

// ============================================================================
// FUNCIÓN: setupRegisterForm()
// Configura el formulario de registro
// ============================================================================
function setupRegisterForm() {
    const form = document.getElementById('registerForm');
    if (!form) return;

    // Mostrar checkbox de edad solo para modelos
    const roleSelect = document.getElementById('registerRole');
    const ageCheck = document.getElementById('ageCheck');

    roleSelect.addEventListener('change', () => {
        if (roleSelect.value === 'model') {
            ageCheck.style.display = 'flex';
            document.getElementById('isAdult').required = true;
        } else {
            ageCheck.style.display = 'none';
            document.getElementById('isAdult').required = false;
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const role = document.getElementById('registerRole').value;
        const acceptTerms = document.getElementById('acceptTerms').checked;
        const isAdult = document.getElementById('isAdult').checked;
        const button = document.getElementById('registerBtn');

        // Validaciones
        if (!acceptTerms) {
            showAlert('Debes aceptar los Términos y Condiciones', 'error');
            return;
        }

        if (role === 'model' && !isAdult) {
            showAlert('Debes confirmar que eres mayor de 18 años', 'error');
            return;
        }

        // Deshabilitar botón y mostrar loading
        button.disabled = true;
        button.innerHTML = '<span class="spinner"></span>';

        try {
            // Registrar usuario en Supabase Auth
            const { data, error } = await window.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: name,
                        role: role
                    }
                }
            });

            if (error) throw error;

            // Éxito: mostrar mensaje y redirigir
            showAlert('Cuenta creada exitosamente. Redirigiendo...', 'success');
            setTimeout(() => {
                window.location.href = 'app.html';
            }, 2000);

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
// Configura los modales de TyC y Privacidad
// ============================================================================
function setupModals() {
    // Modal de Términos y Condiciones
    const showTerms = document.getElementById('showTerms');
    if (showTerms) {
        showTerms.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('termsModal').classList.add('active');
        });
    }

    // Modal de Política de Privacidad
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
// Cierra un modal específico
// ============================================================================
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// ============================================================================
// FUNCIÓN: showAlert()
// Muestra un mensaje de alerta en el formulario
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
// Oculta el mensaje de alerta
// ============================================================================
function hideAlert() {
    const alert = document.getElementById('authAlert');
    if (alert) {
        alert.style.display = 'none';
    }
}

// ============================================================================
// INICIALIZACIÓN
// ============================================================================
document.addEventListener('DOMContentLoaded', initAuth);

// Exportar función closeModal para uso en HTML
window.closeModal = closeModal;

// ============================================================================
// CONDONIS - CORE: Sesión, Navegación, Utilidades y Realtime
// Este archivo maneja la lógica central de la aplicación
// ============================================================================

// Estado global de la aplicación
window.appState = {
    currentUser: null, // Usuario autenticado actual
    currentSection: 'sectionHome', // Sección activa de la SPA
    models: [], // Lista de modelos activos
    callActive: false, // Indica si hay una llamada activa
    heartbeatInterval: null, // Intervalo del heartbeat de presencia
    realtimeSubscription: null // Suscripción a cambios en tiempo real
};

// ============================================================================
// FUNCIÓN: initApp()
// Inicializa la aplicación al cargar la página
// ============================================================================
async function initApp() {
    try {
        // Verificar sesión activa
        const { data: { session } } = await window.supabase.auth.getSession();
        
        if (!session) {
            // No hay sesión, redirigir a login
            window.location.href = 'index.html';
            return;
        }

        // Guardar usuario actual
        window.appState.currentUser = session.user;

        // Cargar perfil completo del usuario
        await loadUserProfile();

        // Configurar interfaz según rol
        setupUIForRole();

        // Iniciar sistema de presencia (heartbeat)
        startPresenceSystem();

        // Suscribirse a cambios en tiempo real
        setupRealtimeSubscriptions();

        // Mostrar sección inicial
        showSection('sectionHome');

        console.log('✅ Aplicación inicializada correctamente');
    } catch (error) {
        console.error('❌ Error al inicializar la aplicación:', error);
        showToast('Error al cargar la aplicación', 'error');
    }
}

// ============================================================================
// FUNCIÓN: loadUserProfile()
// Carga el perfil completo del usuario desde la base de datos
// ============================================================================
async function loadUserProfile() {
    try {
        const { data: profile, error } = await window.supabase
            .from('profiles')
            .select('*')
            .eq('id', window.appState.currentUser.id)
            .single();

        if (error) throw error;

        // Actualizar estado global con datos del perfil
        window.appState.currentUser.profile = profile;

        // Actualizar UI con información del usuario
        updateUserUI();
    } catch (error) {
        console.error('Error al cargar perfil:', error);
        showToast('Error al cargar tu perfil', 'error');
    }
}

// ============================================================================
// FUNCIÓN: updateUserUI()
// Actualiza la interfaz con los datos del usuario actual
// ============================================================================
function updateUserUI() {
    const profile = window.appState.currentUser.profile;
    if (!profile) return;

    // Actualizar avatar
    const avatarElement = document.getElementById('userAvatar');
    if (avatarElement) {
        const initial = profile.full_name.charAt(0).toUpperCase();
        avatarElement.textContent = initial;
    }

    // Actualizar balance de tokens
    const balanceElement = document.getElementById('userBalance');
    if (balanceElement) {
        balanceElement.textContent = `${profile.tokens_balance} tokens`;
    }
}

// ============================================================================
// FUNCIÓN: setupUIForRole()
// Configura la interfaz según el rol del usuario (cliente, modelo, admin, agencia)
// ============================================================================
function setupUIForRole() {
    const profile = window.appState.currentUser.profile;
    if (!profile) return;

    const navContainer = document.querySelector('.bottom-nav');
    
    // Agregar botón de admin si es administrador
    if (profile.role === 'admin') {
        const adminBtn = document.createElement('button');
        adminBtn.className = 'nav-item';
        adminBtn.dataset.section = 'sectionAdmin';
        adminBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span class="nav-label">Admin</span>
        `;
        navContainer.appendChild(adminBtn);
    }
}

// ============================================================================
// FUNCIÓN: startPresenceSystem()
// Inicia el sistema de presencia (heartbeat + toggle online)
// ============================================================================
function startPresenceSystem() {
    const profile = window.appState.currentUser.profile;
    
    // Solo modelos necesitan sistema de presencia activo
    if (profile.role !== 'model') return;

    // Marcar como en línea inmediatamente
    updatePresence(true);

    // Iniciar heartbeat cada 20 segundos
    window.appState.heartbeatInterval = setInterval(() => {
        updatePresence(true);
    }, window.CND_CONFIG.HEARTBEAT_INTERVAL);

    // Marcar como desconectado al cerrar la página
    window.addEventListener('beforeunload', () => {
        updatePresence(false);
    });
}

// ============================================================================
// FUNCIÓN: updatePresence()
// Actualiza el estado de presencia del usuario en la base de datos
// ============================================================================
async function updatePresence(isOnline) {
    try {
        await window.supabase
            .from('profiles')
            .update({
                is_online: isOnline,
                last_seen: new Date().toISOString()
            })
            .eq('id', window.appState.currentUser.id);
    } catch (error) {
        console.error('Error al actualizar presencia:', error);
    }
}

// ============================================================================
// FUNCIÓN: setupRealtimeSubscriptions()
// Configura suscripciones a cambios en tiempo real
// ============================================================================
function setupRealtimeSubscriptions() {
    // Suscribirse a cambios en perfiles (presencia de modelos)
    window.appState.realtimeSubscription = window.supabase
        .channel('profiles-changes')
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles'
            },
            (payload) => {
                handleProfileUpdate(payload);
            }
        )
        .subscribe();
}

// ============================================================================
// FUNCIÓN: handleProfileUpdate()
// Maneja actualizaciones de perfiles en tiempo real
// ============================================================================
function handleProfileUpdate(payload) {
    const updatedProfile = payload.new;
    
    // Si es una modelo, actualizar la lista de modelos activos
    if (updatedProfile.role === 'model') {
        // Debounce para evitar actualizaciones excesivas
        if (window.profileUpdateTimeout) {
            clearTimeout(window.profileUpdateTimeout);
        }
        
        window.profileUpdateTimeout = setTimeout(() => {
            if (typeof loadActiveModels === 'function') {
                loadActiveModels();
            }
        }, window.CND_CONFIG.DEBOUNCE_DELAY);
    }
}

// ============================================================================
// FUNCIÓN: showSection()
// Muestra una sección específica de la SPA
// ============================================================================
function showSection(sectionId) {
    // Ocultar todas las secciones
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    // Mostrar la sección solicitada
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
        window.appState.currentSection = sectionId;
    }

    // Actualizar navegación activa
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.section === sectionId) {
            item.classList.add('active');
        }
    });

    // Cargar contenido específico de la sección
    loadSectionContent(sectionId);
}

// ============================================================================
// FUNCIÓN: loadSectionContent()
// Carga el contenido específico de cada sección
// ============================================================================
function loadSectionContent(sectionId) {
    switch (sectionId) {
        case 'sectionHome':
            if (typeof loadActiveModels === 'function') {
                loadActiveModels();
            }
            break;
        case 'sectionProfile':
            if (typeof loadProfileSection === 'function') {
                loadProfileSection();
            }
            break;
        case 'sectionHistory':
            if (typeof loadHistorySection === 'function') {
                loadHistorySection();
            }
            break;
        case 'sectionAdmin':
            if (typeof loadAdminSection === 'function') {
                loadAdminSection();
            }
            break;
    }
}

// ============================================================================
// FUNCIÓN: showToast()
// Muestra un mensaje toast en la interfaz
// ============================================================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Eliminar toast después de 4 segundos
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============================================================================
// FUNCIÓN: logout()
// Cierra la sesión del usuario
// ============================================================================
async function logout() {
    try {
        // Detener heartbeat
        if (window.appState.heartbeatInterval) {
            clearInterval(window.appState.heartbeatInterval);
        }

        // Desuscribirse de tiempo real
        if (window.appState.realtimeSubscription) {
            window.supabase.removeChannel(window.appState.realtimeSubscription);
        }

        // Cerrar sesión en Supabase
        await window.supabase.auth.signOut();

        // Redirigir a login
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        showToast('Error al cerrar sesión', 'error');
    }
}

// ============================================================================
// EVENT LISTENERS: Configuración de navegación
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Configurar botones de navegación
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const sectionId = item.dataset.section;
            if (sectionId) {
                showSection(sectionId);
            }
        });
    });

    // Inicializar aplicación
    initApp();
});

// ============================================================================
// EXPORTAR FUNCIONES GLOBALES
// ============================================================================
window.initApp = initApp;
window.loadUserProfile = loadUserProfile;
window.updateUserUI = updateUserUI;
window.showSection = showSection;
window.showToast = showToast;
window.logout = logout;

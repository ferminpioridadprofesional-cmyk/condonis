// ============================================================================
// CONDONIS - STORE: ajustes exclusivos del bundle NATIVO (modo 'store').
// En modo 'store' (Google Play / App Store) se ocultan los módulos que no
// deben verse en la revisión: retiros, agencias, ofertas y recarga externa.
// En modo 'full' (PWA/web) este archivo no hace nada.
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    if (window.CND_BUILD_MODE !== 'store') return; // web/PWA: sin gates
    applyStoreGates();
});

function applyStoreGates() {
    // Observar el DOM y limpiar bloques sensibles tras cada render
    const observer = new MutationObserver(() => scrubSensitive());
    observer.observe(document.body, { childList: true, subtree: true });
    scrubSensitive();
}

// Oculta por contenido las cards de retiros, ofertas y agencias
function scrubSensitive() {
    const keywords = ['Mis ganancias', 'Solicitar retiro', 'Ofertas de show', 'retiro', 'Retiros', 'Agencias', 'Mi Agencia'];
    document.querySelectorAll('.card, .admin-tab, .nav-item').forEach(el => {
        const txt = el.textContent || '';
        if (keywords.some(k => txt.includes(k))) {
            // No ocultar el nav de inicio/perfil; solo bloques y tabs sensibles
            if (el.classList.contains('nav-item') && el.dataset.section === 'sectionHome') return;
            el.style.display = 'none';
        }
    });
}

// En modo store, la recarga de tokens se hace por IAP nativo (V9), no externa.
// Reemplaza el render de historial para mostrar el puente de compra de tienda.
if (window.CND_BUILD_MODE === 'store') {
    const origHistory = () => window.renderHistorySection;
    const patchHistory = setInterval(() => {
        if (typeof window.renderHistorySection === 'function' && !window.__storeHistPatched) {
            window.__storeHistPatched = true;
            const orig = window.renderHistorySection;
            window.renderHistorySection = async function (...a) {
                await orig.apply(this, a);
                // Sustituir botones de recarga simulada por puente IAP
                document.querySelectorAll('.pkg-btn').forEach(b => {
                    b.textContent = b.textContent + ' (tienda)';
                    b.onclick = async () => {
                        const amount = parseInt(b.dataset.amount, 10);
                        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Purchases) {
                            // Puente IAP nativo (se implementa en V9)
                            try { await window.Capacitor.Plugins.Purchases.buy({ productId: 'tokens_' + amount }); }
                            catch (e) { window.showToast('Compra cancelada', 'info'); }
                        } else {
                            window.showToast('Las compras se procesan por la tienda en la versión instalada', 'info');
                        }
                    };
                });
            };
            clearInterval(patchHistory);
        }
    }, 500);
}

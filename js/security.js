// ============================================================================
// CONDONIS - SECURITY: protección contra XSS y utilidades de saneamiento.
// Capa de SALIDA: neutraliza <script>, iframes, handlers on* y urls
// javascript: que puedan venir de datos guardados, sin tocar otros módulos.
// También ata botones de cierre/salida SIN onclick inline (requerido por CSP).
// ============================================================================

// Escape HTML para interpolaciones seguras
window.CND_esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
};

// Limpieza de ENTRADA: quita etiquetas y caracteres de inyección
window.CND_clean = function (s, max) {
    max = max || 300;
    let x = String(s == null ? '' : s);
    x = x.replace(/<[^>]*>/g, ' ');        // strip de etiquetas
    x = x.replace(/[<>"'`\\]/g, '');       // quita caracteres de inyección
    x = x.replace(/javascript:/gi, '');    // quita scheme peligroso
    x = x.replace(/\s+/g, ' ').trim();     // colapsa espacios
    return x.slice(0, max);
};

// Validadores reutilizables
window.CND_validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || ''));
window.CND_validNumber = (n, min, max) => { const v = Number(n); return Number.isFinite(v) && v >= min && v <= max; };

// Limitador de clics rápidos (anti-spam de botones sensibles)
window.CND_throttle = function (fn, ms) {
    ms = ms || 1000; let last = 0;
    return function (...a) {
        const now = Date.now();
        if (now - last < ms) return;
        last = now; return fn.apply(this, a);
    };
};

// ----------------------------------------------------------------------------
// Endurecedor de SALIDA: vigila todo lo insertado en el DOM y elimina
// vectores de XSS (scripts, iframes, handlers on*, urls javascript:).
// ----------------------------------------------------------------------------
const BANNED_TAGS = ['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'FORM'];

function cleanNode(el) {
    if (!el || el.nodeType !== 1) return;
    if (BANNED_TAGS.includes(el.tagName)) { el.remove(); return; }
    for (const attr of Array.from(el.attributes || [])) {
        const n = attr.name.toLowerCase();
        const v = (attr.value || '').toLowerCase().replace(/\s/g, '');
        if (n.startsWith('on')) el.removeAttribute(attr.name);
        else if ((n === 'href' || n === 'src') && v.startsWith('javascript:')) el.removeAttribute(attr.name);
    }
}

function hardenOutputs() {
    const obs = new MutationObserver(muts => {
        muts.forEach(m => m.addedNodes.forEach(node => {
            if (node.nodeType !== 1) return;
            cleanNode(node);
            if (node.querySelectorAll) node.querySelectorAll('*').forEach(cleanNode);
        });
    });
    obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
}

// ----------------------------------------------------------------------------
// Ata botones de cierre/salida SIN onclick inline (los busca por id/data).
// ----------------------------------------------------------------------------
function bindSecurityUI() {
    document.querySelectorAll('[data-close]').forEach(b =>
        b.addEventListener('click', () => { if (window.closeModal) window.closeModal(b.dataset.close); }));

    const lb = document.getElementById('logoutBtn');
    if (lb) lb.addEventListener('click', () => { if (window.logout) window.logout(); });

    const ga = document.getElementById('goAppBtn');
    if (ga) ga.addEventListener('click', () => { if (window.irAlApp) window.irAlApp(); });

    const gl = document.getElementById('goLoginBtn');
    if (gl) gl.addEventListener('click', () => { if (window.irAlLogin) window.irAlLogin(); });
}

// Arranque
if (document.body) { hardenOutputs(); bindSecurityUI(); }
else document.addEventListener('DOMContentLoaded', () => { hardenOutputs(); bindSecurityUI(); });

// ============================================================================
// CONDONIS - SECURITY: sanitización de entradas y endurecedor de salidas.
// Capa 1: CND_clean en todo lo que el usuario escribe (entra limpio a la DB).
// Capa 2: hardenOutputs() neutraliza <script>/on*/javascript: inyectados en
//         el DOM (defensa en profundidad contra XSS almacenado/reflejado).
// Capa 3: CSP por meta-tag en cada HTML (ver entrega).
// ============================================================================

// Escape HTML de un valor (para interpolaciones seguras)
window.CND_esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
};

// Limpieza de entrada: quita tags, caracteres de inyección, colapsa espacios,
// limita longitud. Úsalo en TODO dato que el usuario escriba.
window.CND_clean = function (s, max) {
    max = max || 300;
    let x = String(s == null ? '' : s);
    x = x.replace(/<[^>]*>/g, ' ');        // strip de etiquetas
    x = x.replace(/[<>"'`\\]/g, '');       // quita caracteres de inyección
    x = x.replace(/javascript:/gi, '');    // quita scheme peligroso
    x = x.replace(/\s+/g, ' ').trim();     // colapsa espacios
    return x.slice(0, max);
};

// Validadores
window.CND_validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || ''));
window.CND_validNumber = (n, min, max) => { const v = Number(n); return Number.isFinite(v) && v >= min && v <= max; };

// ----------------------------------------------------------------------------
// hardenOutputs(): recorre nodos nuevos del DOM y neutraliza vectores XSS.
// ----------------------------------------------------------------------------
const BANNED_TAGS = ['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'FORM'];

function cleanNode(el) {
    if (!el || el.nodeType !== 1) return;
    if (BANNED_TAGS.includes(el.tagName)) { el.remove(); return; }
    // quitar handlers inline on*
    for (const attr of Array.from(el.attributes || [])) {
        const n = attr.name.toLowerCase();
        const v = (attr.value || '').toLowerCase().replace(/\s/g, '');
        if (n.startsWith('on')) el.removeAttribute(attr.name);
        else if ((n === 'href' || n === 'src' || n === 'xlink:href') && v.startsWith('javascript:')) el.removeAttribute(attr.name);
    }
}

function hardenOutputs() {
    const obs = new MutationObserver(muts => {
        muts.forEach(m => {
            m.addedNodes.forEach(node => {
                if (node.nodeType !== 1) return;
                cleanNode(node);
                if (node.querySelectorAll) node.querySelectorAll('*').forEach(cleanNode);
            });
        });
    });
    obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
}

// Arranca lo antes posible
if (document.body) hardenOutputs();
else document.addEventListener('DOMContentLoaded', hardenOutputs);

// Limitador de tasa simple para acciones sensibles (anti-spam de clics)
window.CND_throttle = function (fn, ms) {
    ms = ms || 1000; let last = 0;
    return function (...a) {
        const now = Date.now();
        if (now - last < ms) return;
        last = now; return fn.apply(this, a);
    };
};

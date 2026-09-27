// ============================================================================
// CONDONIS - SECURITY: anti-XSS de salida + saneamiento + botones sin onclick.
// V9-SEC-fix: el botón Cerrar Sesión lo ata core.js (evita doble listener).
// security.js ata solo: [data-close], #goAppBtn y #goLoginBtn.
// ============================================================================

window.CND_esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
};

window.CND_clean = function (s, max) {
    max = max || 300;
    let x = String(s == null ? '' : s);
    x = x.replace(/<[^>]*>/g, ' ');
    x = x.replace(/[<>"'`\\]/g, '');
    x = x.replace(/javascript:/gi, '');
    x = x.replace(/\s+/g, ' ').trim();
    return x.slice(0, max);
};

window.CND_validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || ''));
window.CND_validNumber = (n, min, max) => { const v = Number(n); return Number.isFinite(v) && v >= min && v <= max; };

window.CND_throttle = function (fn, ms) {
    ms = ms || 1000; let last = 0;
    return function (...a) {
        const now = Date.now();
        if (now - last < ms) return;
        last = now; return fn.apply(this, a);
    };
};

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

// Ata botones sin onclick inline (cierre de modales y navegación de confirm).
// NOTA: el logout lo ata core.js, aquí NO para evitar doble listener.
function bindSecurityUI() {
    document.querySelectorAll('[data-close]').forEach(b =>
        b.addEventListener('click', () => { if (window.closeModal) window.closeModal(b.dataset.close); }));

    const ga = document.getElementById('goAppBtn');
    if (ga && !ga.dataset.bound) { ga.dataset.bound = '1'; ga.addEventListener('click', () => { if (window.irAlApp) window.irAlApp(); }); }

    const gl = document.getElementById('goLoginBtn');
    if (gl && !gl.dataset.bound) { gl.dataset.bound = '1'; gl.addEventListener('click', () => { if (window.irAlLogin) window.irAlLogin(); }); }
}

if (document.body) { hardenOutputs(); bindSecurityUI(); }
else document.addEventListener('DOMContentLoaded', () => { hardenOutputs(); bindSecurityUI(); });

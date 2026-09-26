// ============================================================================
// CONDONIS - I18N: interfaz multi-idioma + traducción automática del chat
// Idiomas: es / en / pt. Detección del dispositivo + selector manual.
// Traducción de chat vía MyMemory (gratis, sin clave). Bidireccional:
// cada usuario define el "idioma de su pareja" y ve lo entrante traducido.
// ============================================================================

// Diccionarios de UI (ampliables). Las claves apuntan a selectores concretos.
const I18N_DICT = {
    es: {
        nav_home: 'Inicio', nav_tokens: 'Tokens', nav_profile: 'Perfil', nav_admin: 'Admin', nav_agency: 'Agencia',
        home_title: 'Modelos en Línea', home_sub: 'Conecta con modelos disponibles ahora',
        profile_title: 'Mi Perfil', history_title: 'Tokens y Movimientos', admin_title: 'Panel de Administración',
        lang_label: 'Idioma'
    },
    en: {
        nav_home: 'Home', nav_tokens: 'Tokens', nav_profile: 'Profile', nav_admin: 'Admin', nav_agency: 'Agency',
        home_title: 'Creators Online', home_sub: 'Connect with available creators now',
        profile_title: 'My Profile', history_title: 'Tokens & Activity', admin_title: 'Admin Panel',
        lang_label: 'Language'
    },
    pt: {
        nav_home: 'Início', nav_tokens: 'Tokens', nav_profile: 'Perfil', nav_admin: 'Admin', nav_agency: 'Agência',
        home_title: 'Criadores Online', home_sub: 'Conecte-se com criadores disponíveis agora',
        profile_title: 'Meu Perfil', history_title: 'Tokens e Movimentos', admin_title: 'Painel de Administração',
        lang_label: 'Idioma'
    }
};

// Mapeo selector -> clave de diccionario
const I18N_SELECTORS = [
    ['.nav-item[data-section="sectionHome"] .nav-label', 'nav_home'],
    ['.nav-item[data-section="sectionHistory"] .nav-label', 'nav_tokens'],
    ['.nav-item[data-section="sectionProfile"] .nav-label', 'nav_profile'],
    ['.nav-item[data-section="sectionAdmin"] .nav-label', 'nav_admin'],
    ['.nav-item[data-section="sectionAgency"] .nav-label', 'nav_agency'],
    ['#sectionHome h2', 'home_title'],
    ['#sectionHome > p', 'home_sub'],
    ['#sectionProfile h2', 'profile_title'],
    ['#sectionHistory h2', 'history_title'],
    ['#sectionAdmin h2', 'admin_title']
];

let locale = 'es';
let remoteLang = 'es';      // idioma de la otra persona en el chat
let autoTranslateIn = true; // traducir mensajes entrantes

// ----------------------------------------------------------------------------
// Arranque
// ----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    locale = detectLocale();
    applyUI();
    injectLangSelector();
    watchChatForTranslation();
});

function detectLocale() {
    const saved = localStorage.getItem('cnd_locale');
    if (saved && I18N_DICT[saved]) return saved;
    const nav = (navigator.language || 'es').slice(0, 2).toLowerCase();
    return I18N_DICT[nav] ? nav : 'es';
}

function t(key) {
    return (I18N_DICT[locale] && I18N_DICT[locale][key]) || I18N_DICT.es[key] || key;
}

function setLocale(l) {
    if (!I18N_DICT[l]) return;
    locale = l;
    localStorage.setItem('cnd_locale', l);
    applyUI();
}

// ----------------------------------------------------------------------------
// applyUI(): traduce nodos estáticos + rebrand opcional "modelo"->"creador"
// ----------------------------------------------------------------------------
function applyUI() {
    I18N_SELECTORS.forEach(([sel, key]) => {
        document.querySelectorAll(sel).forEach(el => { el.textContent = t(key); });
    });
    if (window.CND_REBRAND) applyRebrand();
}

// Rebrand seguro: solo nodos de TEXTO (no atributos ni valores de input)
function applyRebrand() {
    const map = [/modelos/gi, 'creadores'];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
        let s = n.nodeValue;
        s = s.replace(/Modelos/g, 'Creadores').replace(/modelos/g, 'creadores')
             .replace(/Modelo/g, 'Creador').replace(/modelo/g, 'creador');
        if (s !== n.nodeValue) n.nodeValue = s;
    });
}

// ----------------------------------------------------------------------------
// Selector de idioma inyectado en el header
// ----------------------------------------------------------------------------
function injectLangSelector() {
    const info = document.querySelector('.user-info');
    if (!info || document.getElementById('langSelect')) return;
    const wrap = document.createElement('select');
    wrap.id = 'langSelect';
    wrap.setAttribute('aria-label', 'Idioma');
    wrap.style.cssText = 'background:rgba(30,41,59,.6);color:#E2E8F0;border:1px solid rgba(100,116,139,.4);border-radius:8px;padding:6px;font-size:13px;';
    wrap.innerHTML = '<option value="es">ES</option><option value="en">EN</option><option value="pt">PT</option>';
    wrap.value = locale;
    wrap.addEventListener('change', () => setLocale(wrap.value));
    info.insertBefore(wrap, info.firstChild);
}

// ----------------------------------------------------------------------------
// Traducción de texto (MyMemory, gratis, sin clave)
// ----------------------------------------------------------------------------
async function CND_translate(text, from, to) {
    if (!text || from === to) return text;
    try {
        const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=' + from + '|' + to;
        const res = await fetch(url);
        const json = await res.json();
        if (json && json.responseData && json.responseData.translatedText) {
            return json.responseData.translatedText;
        }
        return text;
    } catch (e) {
        return text; // sin conexión de traducción: mostrar original
    }
}
window.CND_translate = CND_translate;

// ----------------------------------------------------------------------------
// Chat: controles de idioma + traducción automática de mensajes entrantes
// ----------------------------------------------------------------------------
let chatObserver = null;

function watchChatForTranslation() {
    // Esperar a que exista el panel de chat (lo crea calls.js al conectar)
    const tryAttach = setInterval(() => {
        const head = document.querySelector('.chat-head');
        const log = document.getElementById('chatLog');
        if (head && log && !chatObserver) {
            clearInterval(tryAttach);
            injectChatControls(head);
            startChatObserver(log);
        }
    }, 800);
}

function injectChatControls(head) {
    if (head.querySelector('#chatLangRow')) return;
    const row = document.createElement('div');
    row.id = 'chatLangRow';
    row.style.cssText = 'display:flex;gap:6px;align-items:center;padding:6px 10px;border-bottom:1px solid rgba(100,116,139,.3);';
    row.innerHTML = `
        <span style="font-size:11px;color:#94A3B8;">Idioma de la otra persona:</span>
        <select id="chatRemoteLang" style="background:rgba(30,41,59,.6);color:#E2E8F0;border:1px solid rgba(100,116,139,.4);border-radius:6px;font-size:12px;padding:3px;">
            <option value="es">ES</option><option value="en">EN</option><option value="pt">PT</option>
        </select>
        <label style="display:flex;gap:4px;align-items:center;font-size:11px;color:#94A3B8;">
            <input type="checkbox" id="chatAutoTr" checked> Traducir
        </label>`;
    head.appendChild(row);

    remoteLang = localStorage.getItem('cnd_remote_lang') || 'es';
    row.querySelector('#chatRemoteLang').value = remoteLang;
    row.querySelector('#chatRemoteLang').addEventListener('change', (e) => {
        remoteLang = e.target.value;
        localStorage.setItem('cnd_remote_lang', remoteLang);
    });
    row.querySelector('#chatAutoTr').addEventListener('change', (e) => { autoTranslateIn = e.target.checked; });
}

function startChatObserver(log) {
    chatObserver = new MutationObserver((muts) => {
        muts.forEach(m => {
            m.addedNodes.forEach(node => {
                if (node.nodeType !== 1) return;
                const line = node.classList && node.classList.contains('chat-line') ? node : node.querySelector && node.querySelector('.chat-line');
                if (line && !line.dataset.mt && !line.classList.contains('own')) {
                    line.dataset.mt = '1';
                    translateLine(line);
                }
            });
        });
    });
    chatObserver.observe(log, { childList: true, subtree: true });
}

async function translateLine(line) {
    if (!autoTranslateIn || remoteLang === locale) return;
    const original = line.textContent.replace(/^\s*/, '');
    const translated = await CND_translate(original, remoteLang, locale);
    if (translated && translated !== original) {
        const sub = document.createElement('div');
        sub.className = 'chat-line';
        sub.style.cssText = 'font-size:11px;opacity:.75;font-style:italic;';
        sub.textContent = '↳ ' + translated;
        line.parentNode && line.parentNode.insertBefore(sub, line.nextSibling);
    }
}

// Exposición global
window.CND_i18n = { t, getLocale: () => locale, setLocale, translate: CND_translate };

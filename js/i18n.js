// ============================================================================
// CONDONIS - I18N: multi-idioma + traducción de chat + BRANDING y REBRAND
// V8.2: aplica CND_APP_NAME al título/header; rebrand femenino
// (modelo->creadora) y cliente->miembro, con MutationObserver para cubrir
// renders dinámicos.
// ============================================================================

const I18N_DICT = {
    es: { nav_home:'Inicio', nav_tokens:'Tokens', nav_profile:'Perfil', nav_admin:'Admin', nav_agency:'Agencia',
          home_title:'Creadoras en Línea', home_sub:'Conecta con creadoras disponibles ahora',
          profile_title:'Mi Perfil', history_title:'Tokens y Movimientos', admin_title:'Panel de Administración', lang_label:'Idioma' },
    en: { nav_home:'Home', nav_tokens:'Tokens', nav_profile:'Profile', nav_admin:'Admin', nav_agency:'Agency',
          home_title:'Creators Online', home_sub:'Connect with available creators now',
          profile_title:'My Profile', history_title:'Tokens & Activity', admin_title:'Admin Panel', lang_label:'Language' },
    pt: { nav_home:'Início', nav_tokens:'Tokens', nav_profile:'Perfil', nav_admin:'Admin', nav_agency:'Agência',
          home_title:'Criadoras Online', home_sub:'Conecte-se com criadoras disponíveis',
          profile_title:'Meu Perfil', history_title:'Tokens e Movimentos', admin_title:'Painel Admin', lang_label:'Idioma' }
};

const I18N_SELECTORS = [
    ['.nav-item[data-section="sectionHome"] .nav-label','nav_home'],
    ['.nav-item[data-section="sectionHistory"] .nav-label','nav_tokens'],
    ['.nav-item[data-section="sectionProfile"] .nav-label','nav_profile'],
    ['.nav-item[data-section="sectionAdmin"] .nav-label','nav_admin'],
    ['.nav-item[data-section="sectionAgency"] .nav-label','nav_agency'],
    ['#sectionHome h2','home_title'], ['#sectionHome > p','home_sub'],
    ['#sectionProfile h2','profile_title'], ['#sectionHistory h2','history_title'], ['#sectionAdmin h2','admin_title']
];

let locale='es', remoteLang='es', autoTranslateIn=true, rebrandObserver=null;

document.addEventListener('DOMContentLoaded', () => {
    locale = detectLocale();
    applyBrand();
    applyUI();
    injectLangSelector();
    watchChatForTranslation();
    if (window.CND_REBRAND) startRebrandObserver();
});

function detectLocale() {
    const s = localStorage.getItem('cnd_locale'); if (s && I18N_DICT[s]) return s;
    const n = (navigator.language||'es').slice(0,2).toLowerCase();
    return I18N_DICT[n] ? n : 'es';
}
function t(k){ return (I18N_DICT[locale]&&I18N_DICT[locale][k]) || I18N_DICT.es[k] || k; }
function setLocale(l){ if(!I18N_DICT[l])return; locale=l; localStorage.setItem('cnd_locale',l); applyUI(); if(window.CND_REBRAND) applyRebrand(); }

// Branding: nombre público de la app en title y headers
function applyBrand() {
    const name = window.CND_APP_NAME || 'LinguaMeet';
    document.title = name;
    const appH = document.querySelector('.app-header h1'); if (appH) appH.textContent = name;
    const logoH = document.getElementById('brandTitle'); if (logoH) logoH.textContent = name;
}

function applyUI() {
    I18N_SELECTORS.forEach(([sel,key]) => document.querySelectorAll(sel).forEach(el => el.textContent = t(key)));
    if (window.CND_REBRAND) applyRebrand();
}

// Rebrand seguro: solo nodos de TEXTO. modelo->creadora, cliente->miembro.
function applyRebrand() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
        let s = n.nodeValue;
        s = s.replace(/Modelos/g,'Creadoras').replace(/modelos/g,'creadoras')
             .replace(/Modelo/g,'Creadora').replace(/modelo/g,'creadora')
             .replace(/Clientes/g,'Miembros').replace(/clientes/g,'miembros')
             .replace(/Cliente/g,'Miembro').replace(/cliente/g,'miembro');
        if (s !== n.nodeValue) n.nodeValue = s;
    });
}

// Re-aplica rebrand a contenido renderizado dinámicamente (debounce)
function startRebrandObserver() {
    let timer=null;
    rebrandObserver = new MutationObserver(() => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => applyRebrand(), 250);
    });
    rebrandObserver.observe(document.body, { childList:true, subtree:true });
}

function injectLangSelector() {
    const info = document.querySelector('.user-info');
    if (!info || document.getElementById('langSelect')) return;
    const s = document.createElement('select');
    s.id='langSelect'; s.setAttribute('aria-label','Idioma');
    s.style.cssText='background:rgba(30,41,59,.6);color:#E2E8F0;border:1px solid rgba(100,116,139,.4);border-radius:8px;padding:6px;font-size:13px;';
    s.innerHTML='<option value="es">ES</option><option value="en">EN</option><option value="pt">PT</option>';
    s.value=locale; s.addEventListener('change',()=>setLocale(s.value));
    info.insertBefore(s, info.firstChild);
}

async function CND_translate(text, from, to) {
    if (!text || from===to) return text;
    try {
        const r = await fetch('https://api.mymemory.translated.net/get?q='+encodeURIComponent(text)+'&langpair='+from+'|'+to);
        const j = await r.json();
        return (j && j.responseData && j.responseData.translatedText) || text;
    } catch(e){ return text; }
}
window.CND_translate = CND_translate;

let chatObserver=null;
function watchChatForTranslation() {
    const iv = setInterval(() => {
        const head = document.querySelector('.chat-head');
        const log = document.getElementById('chatLog');
        if (head && log && !chatObserver) { clearInterval(iv); injectChatControls(head); startChatObserver(log); }
    }, 800);
}
function injectChatControls(head) {
    if (head.querySelector('#chatLangRow')) return;
    const row = document.createElement('div');
    row.id='chatLangRow';
    row.style.cssText='display:flex;gap:6px;align-items:center;padding:6px 10px;border-bottom:1px solid rgba(100,116,139,.3);';
    row.innerHTML = `<span style="font-size:11px;color:#94A3B8;">Idioma de la otra persona:</span>
        <select id="chatRemoteLang" style="background:rgba(30,41,59,.6);color:#E2E8F0;border:1px solid rgba(100,116,139,.4);border-radius:6px;font-size:12px;padding:3px;">
        <option value="es">ES</option><option value="en">EN</option><option value="pt">PT</option></select>
        <label style="display:flex;gap:4px;align-items:center;font-size:11px;color:#94A3B8;"><input type="checkbox" id="chatAutoTr" checked> Traducir</label>`;
    head.appendChild(row);
    remoteLang = localStorage.getItem('cnd_remote_lang')||'es';
    row.querySelector('#chatRemoteLang').value = remoteLang;
    row.querySelector('#chatRemoteLang').addEventListener('change', e => { remoteLang=e.target.value; localStorage.setItem('cnd_remote_lang', remoteLang); });
    row.querySelector('#chatAutoTr').addEventListener('change', e => { autoTranslateIn=e.target.checked; });
}
function startChatObserver(log) {
    chatObserver = new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(node => {
        if (node.nodeType!==1) return;
        const line = (node.classList&&node.classList.contains('chat-line')) ? node : (node.querySelector&&node.querySelector('.chat-line'));
        if (line && !line.dataset.mt && !line.classList.contains('own')) { line.dataset.mt='1'; translateLine(line); }
    })));
    chatObserver.observe(log, { childList:true, subtree:true });
}
async function translateLine(line) {
    if (!autoTranslateIn || remoteLang===locale) return;
    const orig = line.textContent;
    const tr = await CND_translate(orig, remoteLang, locale);
    if (tr && tr!==orig) {
        const sub = document.createElement('div');
        sub.className='chat-line'; sub.style.cssText='font-size:11px;opacity:.75;font-style:italic;';
        sub.textContent='↳ '+tr;
        line.parentNode && line.parentNode.insertBefore(sub, line.nextSibling);
    }
}

window.CND_i18n = { t, getLocale:()=>locale, setLocale, translate:CND_translate };

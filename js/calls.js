// ============================================================================
// CONDONIS - CALLS: Videollamadas + UI reorganizada + liquidación correcta
// V6.0: dock inferior en columna (chat plegable, regalos, barra de control)
// para que nada se tape; al colgar se llama settle_call: si cuelga el cliente
// la modelo cobra su 50%; si cuelga la modelo, la plataforma retiene su parte.
// ============================================================================

let callState = null;
let ringing = null;
let callsChannelDb = null;
let bootDone = false;
let giftsCache = null;
let callUIBuilt = false;

document.addEventListener('DOMContentLoaded', () => {
    waitProfile().then(() => { if (!bootDone) { bootDone = true; initCalls(); } });
});

async function waitProfile() {
    for (let i = 0; i < 50; i++) {
        if (window.appState && window.appState.currentUser && window.appState.currentUser.profile) return true;
        await new Promise(r => setTimeout(r, 200));
    }
    return false;
}

function initCalls() {
    buildCallUI();
    document.getElementById('hangupBtn').addEventListener('click', () => endCall('local'));
    const uid = window.appState.currentUser.id;
    callsChannelDb = window.supabase
        .channel('calls-' + uid)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'video_calls' },
            (p) => handleCallEvent(p))
        .subscribe();
}

// ============================================================================
// buildCallUI(): layout en dock vertical: topbar / chat / regalos / barra
// ============================================================================
function buildCallUI() {
    if (callUIBuilt) return;
    callUIBuilt = true;

    const style = document.createElement('style');
    style.textContent = `
        .call-topbar{position:absolute;top:12px;left:12px;right:12px;display:none;align-items:center;justify-content:space-between;gap:10px;z-index:4;}
        .call-overlay.live .call-topbar{display:flex;}
        .topbar-left,.topbar-right{display:flex;align-items:center;gap:8px;}
        .hud-pill{background:rgba(11,15,23,.75);padding:8px 12px;border-radius:10px;font-size:13px;font-weight:600;}
        .ctrl-btn{width:46px;height:46px;border-radius:50%;border:1px solid rgba(100,116,139,.5);background:rgba(11,15,23,.75);color:#E2E8F0;cursor:pointer;display:flex;align-items:center;justify-content:center;}
        .ctrl-btn.off{background:#EF4444;color:#fff;}
        .ctrl-btn svg{width:20px;height:20px;}
        .call-dock{position:absolute;left:0;right:0;bottom:0;display:none;flex-direction:column;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));z-index:4;background:linear-gradient(transparent,rgba(0,0,0,.85) 30%);}
        .call-overlay.live .call-dock{display:flex;}
        .chat-panel{display:flex;flex-direction:column;background:rgba(11,15,23,.8);border:1px solid rgba(100,116,139,.4);border-radius:12px;overflow:hidden;}
        .chat-head{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-bottom:1px solid rgba(100,116,139,.3);}
        .chat-head button{background:transparent;border:none;color:#00D4FF;font-size:12px;font-weight:700;cursor:pointer;}
        .chat-log{overflow-y:auto;padding:8px 10px;display:flex;flex-direction:column;gap:5px;max-height:110px;min-height:44px;}
        .chat-panel.collapsed .chat-log{display:none;}
        .chat-line{font-size:13px;line-height:1.35;color:#E2E8F0;}
        .chat-line.own{color:#7DD3FC;}
        .chat-input-row{display:flex;gap:8px;padding:8px;border-top:1px solid rgba(100,116,139,.3);}
        .chat-input-row input{flex:1;padding:9px;border-radius:8px;border:1px solid rgba(100,116,139,.4);background:rgba(30,41,59,.6);color:#E2E8F0;font-size:14px;}
        .chat-send{width:42px;border:none;border-radius:8px;background:#00D4FF;color:#0B0F17;cursor:pointer;display:flex;align-items:center;justify-content:center;}
        .chat-send svg{width:18px;height:18px;}
        .gifts-row{display:flex;gap:8px;overflow-x:auto;padding:2px 0;}
        .gift-btn{flex:0 0 auto;border:1px solid rgba(100,116,139,.5);background:rgba(15,23,42,.85);color:#E2E8F0;border-radius:10px;padding:7px 9px;cursor:pointer;font-size:11px;font-weight:600;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:70px;}
        .gift-btn small{color:#00D4FF;}
        .gift-btn svg{width:18px;height:18px;}
        .call-bar{display:flex;align-items:center;justify-content:center;gap:16px;}
        .hangup-btn{width:60px;height:60px;border-radius:50%;border:none;background:#EF4444;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;}
        .hangup-btn svg{width:26px;height:26px;}
        .gift-fx{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:6;}
        .gift-anim{max-width:55vw;max-height:45vh;border-radius:12px;}
        .gift-fallback{width:170px;height:170px;border-radius:50%;background:radial-gradient(circle,rgba(0,212,255,.85),rgba(255,0,110,.15));animation:giftPop 1s ease-in-out 3;}
        @keyframes giftPop{0%,100%{transform:scale(.8);opacity:.7}50%{transform:scale(1.15);opacity:1}}
        .call-overlay.live .call-hud{display:none;}
    `;
    document.head.appendChild(style);

    const overlay = document.getElementById('callOverlay');

    // Capa de animaciones de regalo
    const fx = document.createElement('div');
    fx.id = 'giftFx'; fx.className = 'gift-fx';
    overlay.appendChild(fx);

    // Barra superior: controles a la izquierda, timer/costo a la derecha
    const topbar = document.createElement('div');
    topbar.className = 'call-topbar';
    topbar.innerHTML = `
        <div class="topbar-left">
            <button id="micBtn" class="ctrl-btn" aria-label="Microfono">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line></svg>
            </button>
            <button id="camBtn" class="ctrl-btn" aria-label="Cambiar camara">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            </button>
        </div>
        <div class="topbar-right">
            <span class="hud-pill" id="callTimer">00:00</span>
            <span class="hud-pill" id="callCost"></span>
        </div>
    `;
    overlay.appendChild(topbar);

    // Dock inferior en columna: chat plegable, regalos y barra de colgar
    const dock = document.createElement('div');
    dock.className = 'call-dock';
    dock.innerHTML = `
        <div class="chat-panel" id="chatPanel">
            <div class="chat-head">
                <span style="font-size:12px;font-weight:700;color:#94A3B8;">Chat de la llamada</span>
                <button id="chatToggle" aria-label="Plegar o expandir chat">Ocultar</button>
            </div>
            <div id="chatLog" class="chat-log"></div>
            <div class="chat-input-row">
                <input id="chatInput" type="text" maxlength="300" placeholder="Escribe un mensaje..." aria-label="Mensaje de chat">
                <button id="chatSendBtn" class="chat-send" aria-label="Enviar mensaje">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
            </div>
        </div>
        <div class="gifts-row" id="giftsRow"></div>
        <div class="call-bar" id="callBar"></div>
    `;
    overlay.appendChild(dock);

    // Mover el botón de colgar existente a la barra inferior
    const hang = document.getElementById('hangupBtn');
    if (hang) document.getElementById('callBar').appendChild(hang);

    // Modal genérico de solicitudes
    const req = document.createElement('div');
    req.id = 'callRequestModal'; req.className = 'modal-overlay';
    req.setAttribute('role', 'dialog');
    req.innerHTML = `
        <div class="modal-card incoming-card">
            <h3 id="reqTitle" class="modal-title">Solicitud</h3>
            <p id="reqText" class="hint"></p>
            <div class="incoming-actions">
                <button id="reqDeny" class="btn btn-danger">Rechazar</button>
                <button id="reqAccept" class="btn">Aceptar</button>
            </div>
        </div>`;
    document.body.appendChild(req);

    // Listeners fijos
    document.getElementById('micBtn').addEventListener('click', toggleMic);
    document.getElementById('camBtn').addEventListener('click', switchCamera);
    document.getElementById('chatToggle').addEventListener('click', () => {
        const panel = document.getElementById('chatPanel');
        panel.classList.toggle('collapsed');
        document.getElementById('chatToggle').textContent =
            panel.classList.contains('collapsed') ? 'Mostrar' : 'Ocultar';
    });
    const doSend = () => {
        const input = document.getElementById('chatInput');
        window.CND_chat.send(input.value).then(ok => { if (ok) input.value = ''; });
    };
    document.getElementById('chatSendBtn').addEventListener('click', doSend);
    document.getElementById('chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
}

// ============================================================================
// Eventos de llamada
// ============================================================================
function handleCallEvent(payload) {
    const uid = window.appState.currentUser.id;
    const row = payload.new;
    if (!row || (row.client_id !== uid && row.model_id !== uid)) return;

    if (payload.eventType === 'INSERT' && row.model_id === uid && row.status === 'waiting') {
        showIncoming(row); return;
    }
    if (payload.eventType === 'UPDATE') {
        if (ringing && row.id === ringing.callId && (row.status === 'missed' || row.status === 'ended')) {
            hideIncoming(); window.showToast('La llamada fue cancelada', 'info'); return;
        }
        if (callState && row.id === callState.callId && row.status === 'ended' && !callState.ending) {
            endCall('remote-ended'); return;
        }
        if (callState && row.id === callState.callId && row.status === 'missed' && callState.isCaller) {
            endCall('rejected'); return;
        }
    }
}

async function showIncoming(row) {
    if (ringing || callState) return;
    ringing = { callId: row.id, roomId: row.room_id, clientId: row.client_id,
                clientRate: Number(row.client_rate_per_minute), modelRate: Number(row.model_rate_per_minute) };
    let name = 'Un cliente';
    try {
        const { data } = await window.supabase.rpc('get_display_name', { p_user_id: row.client_id });
        if (data) name = data;
    } catch (e) {}
    document.getElementById('incomingTitle').textContent = 'Llamada entrante de ' + name;
    document.getElementById('incomingInfo').textContent = 'Ganas ' + ringing.modelRate + ' tokens por minuto.';
    document.getElementById('incomingModal').classList.add('active');
}

function hideIncoming() {
    ringing = null;
    document.getElementById('incomingModal').classList.remove('active');
}

async function acceptIncoming() {
    if (!ringing) return;
    const info = ringing; hideIncoming();
    try {
        const { error } = await window.supabase.rpc('accept_call', { p_call_id: info.callId });
        if (error) throw error;
    } catch (err) { window.showToast('No se pudo aceptar la llamada', 'error'); return; }
    await setupCall(info.callId, info.roomId, false, info.clientId, info.clientRate, info.modelRate);
    sigSend('ready', {});
    startEarnTimer();
}

async function rejectIncoming() {
    if (!ringing) return;
    const info = ringing; hideIncoming();
    try { await window.supabase.rpc('reject_call', { p_call_id: info.callId }); } catch (e) {}
}

async function CND_startCall(modelId) {
    if (callState) { window.showToast('Ya tienes una llamada en curso', 'error'); return; }
    const profile = window.appState.currentUser.profile;
    if (Number(profile.tokens_balance || 0) <= 0) {
        window.showToast('No tienes tokens suficientes para llamar', 'error'); return;
    }
    const roomId = 'room-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    try {
        const { data: callId, error } = await window.supabase.rpc('start_call_with_status', { p_model: modelId, p_room: roomId });
        if (error) throw error;
        const { data: row } = await window.supabase.from('video_calls').select('*').eq('id', callId).single();
        await setupCall(callId, roomId, true, modelId, Number(row.client_rate_per_minute), Number(row.model_rate_per_minute));
        sigSend('ready-request', {});
    } catch (err) { window.showToast(err.message || 'No se pudo iniciar la llamada', 'error'); }
}
window.CND_startCall = CND_startCall;

// ============================================================================
// setupCall
// ============================================================================
async function setupCall(callId, roomId, isCaller, peerId, clientRate, modelRate) {
    const stream = await getMediaWithRetry();
    if (!stream) {
        window.showToast('No se pudo acceder a tu camara o microfono', 'error');
        if (isCaller) { try { await window.supabase.rpc('end_call', { p_call_id: callId }); } catch (e) {} }
        return;
    }
    const pc = new RTCPeerConnection({ iceServers: window.CND_ICE_SERVERS });
    callState = { callId, roomId, pc, isCaller, peerId, clientRate, modelRate,
        localStream: stream, remoteStream: null, facing: 'user', micOn: true,
        seconds: 0, timers: {}, ending: false, connected: false,
        iceRestarted: false, channel: null };

    callState.channel = window.supabase.channel('call-' + roomId);
    callState.channel.on('broadcast', { event: 'sig' }, (m) => handleSignal(m.payload));
    callState.channel.subscribe();

    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    preferCodecs(pc);
    document.getElementById('localVideo').srcObject = stream;
    document.getElementById('chatLog').innerHTML = '';

    pc.onicecandidate = (e) => { if (e.candidate) sigSend('ice', { candidate: e.candidate }); };
    pc.ontrack = (e) => {
        const rv = document.getElementById('remoteVideo');
        if (rv && !callState.remoteStream) {
            callState.remoteStream = e.streams[0] || new MediaStream();
            if (!e.streams[0]) callState.remoteStream.addTrack(e.track);
            rv.srcObject = callState.remoteStream;
        }
        clearTimer('mediaWatch'); hideConnecting();
    };
    pc.oniceconnectionstatechange = () => {
        const st = pc.iceConnectionState;
        if (st === 'connected' || st === 'completed') {
            callState.connected = true;
            hideConnecting(); clearTimer('connectWatch'); clearTimer('connectFail');
            onCallLive(); startMediaWatch();
            if (isCaller) startBillTimer();
        } else if (st === 'disconnected') {
            setTimer('disco', 3000, () => {
                if (callState && callState.pc.iceConnectionState === 'disconnected') {
                    try { callState.pc.restartIce(); } catch (e) {}
                }
            });
        } else if (st === 'failed') { endCall('network'); }
    };

    showConnecting();
    setTimer('connectWatch', 5000, () => {
        if (callState && !callState.connected && !callState.iceRestarted) {
            callState.iceRestarted = true;
            try { callState.pc.restartIce(); } catch (e) {}
        }
    });
    setTimer('connectFail', 10000, () => { if (callState && !callState.connected) endCall('network'); });
    applyBitrate(250000);
    setTimer('stats', 5000, monitorQuality, true);
}

function onCallLive() {
    document.getElementById('callOverlay').classList.add('live');
    window.CND_chat.attach(callState.callId, callState.peerId, (text, own) => appendChatLine(text, own));
    renderGiftsRow();
}

function appendChatLine(text, own) {
    const log = document.getElementById('chatLog');
    if (!log) return;
    const line = document.createElement('div');
    line.className = 'chat-line' + (own ? ' own' : '');
    line.textContent = (own ? 'Tu: ' : '') + text;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
    // Si estaba plegado, mostrar indicador simple
    const panel = document.getElementById('chatPanel');
    if (panel && panel.classList.contains('collapsed')) panel.classList.remove('collapsed');
}

// ============================================================================
// Controles
// ============================================================================
function toggleMic() {
    if (!callState) return;
    callState.micOn = !callState.micOn;
    callState.localStream.getAudioTracks().forEach(t => { t.enabled = callState.micOn; });
    document.getElementById('micBtn').classList.toggle('off', !callState.micOn);
    window.showToast(callState.micOn ? 'Microfono activado' : 'Microfono silenciado', 'info');
}

async function switchCamera() {
    if (!callState) return;
    const next = callState.facing === 'user' ? 'environment' : 'user';
    try {
        const ns = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: next } }, audio: false });
        const nt = ns.getVideoTracks()[0];
        const sender = callState.pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) await sender.replaceTrack(nt);
        const old = callState.localStream.getVideoTracks()[0];
        if (old) { callState.localStream.removeTrack(old); old.stop(); }
        callState.localStream.addTrack(nt);
        document.getElementById('localVideo').srcObject = callState.localStream;
        callState.facing = next;
        window.showToast(next === 'environment' ? 'Camara trasera' : 'Camara frontal', 'info');
    } catch (err) {
        window.showToast('Este dispositivo no tiene otra camara disponible', 'error');
    }
}

// ============================================================================
// Regalos y solicitudes
// ============================================================================
async function loadGifts() {
    if (giftsCache) return giftsCache;
    const { data } = await window.supabase.from('gifts').select('*').order('sort_order');
    giftsCache = data || [];
    return giftsCache;
}

async function renderGiftsRow() {
    const row = document.getElementById('giftsRow');
    if (!row || !callState) return;
    const gifts = await loadGifts();
    const isClient = callState.isCaller;
    row.innerHTML = gifts.map(g => {
        const price = isClient ? Number(g.client_price) : Number(g.client_price) * 0.5;
        return `
            <button class="gift-btn" data-gift="${g.id}" aria-label="${g.name}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>
                ${g.name}<small>${price} tokens</small>
            </button>`;
    }).join('');
    if (!isClient) {
        row.innerHTML += `
            <button class="gift-btn" id="tokenReqBtn" aria-label="Solicitar tokens">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                Pedir tokens<small>max 500</small>
            </button>`;
        document.getElementById('tokenReqBtn').addEventListener('click', askTokensRequest);
    }
    row.querySelectorAll('[data-gift]').forEach(b => {
        b.addEventListener('click', () => onGiftClick(parseInt(b.dataset.gift, 10)));
    });
}

async function onGiftClick(giftId) {
    if (callState.isCaller) await sendGiftRpc(giftId, true);
    else { sigSend('gift-request', { giftId }); window.showToast('Solicitud de regalo enviada', 'info'); }
}

async function sendGiftRpc(giftId, playFx) {
    try {
        const { data, error } = await window.supabase.rpc('send_gift', { p_call_id: callState.callId, p_gift_id: giftId });
        if (error) throw error;
        window.appState.currentUser.profile.tokens_balance = Number(data.balance);
        if (window.updateUserUI) window.updateUserUI();
        const g = (await loadGifts()).find(x => x.id === giftId);
        window.showToast(callState.isCaller
            ? 'Regalo enviado: -' + Number(g.client_price) + ' tokens'
            : 'Regalo recibido: +' + Number(data.earn) + ' tokens', 'success');
        sigSend('gift', { giftId });
        if (playFx) playGiftFx(g.asset);
    } catch (err) { window.showToast(err.message || 'No se pudo enviar el regalo', 'error'); }
}

function askTokensRequest() {
    const raw = window.prompt('Cuantos tokens quieres solicitar? (1 a 500). Recibes esa cantidad.');
    if (raw === null) return;
    const amount = parseInt(raw, 10);
    if (!amount || amount < 1 || amount > 500) { window.showToast('Entre 1 y 500', 'error'); return; }
    sigSend('token-request', { amount });
    window.showToast('Solicitud de ' + amount + ' tokens enviada', 'info');
}

function showRequestModal(title, text, onAccept) {
    const modal = document.getElementById('callRequestModal');
    document.getElementById('reqTitle').textContent = title;
    document.getElementById('reqText').textContent = text;
    modal.classList.add('active');
    const accept = document.getElementById('reqAccept');
    const deny = document.getElementById('reqDeny');
    const ca = accept.cloneNode(true); const cd = deny.cloneNode(true);
    accept.replaceWith(ca); deny.replaceWith(cd);
    ca.addEventListener('click', () => { modal.classList.remove('active'); onAccept(); });
    cd.addEventListener('click', () => { modal.classList.remove('active'); sigSend('request-denied', {}); });
}

async function playGiftFx(assetBase) {
    const fx = document.getElementById('giftFx');
    if (!fx) return;
    const base = 'assets/gifts/' + assetBase;
    let chosen = null;
    for (const ext of ['mp4','webm','gif','webp','json','glb','gltf']) {
        try { const r = await fetch(base + '.' + ext, { method: 'HEAD' }); if (r.ok) { chosen = ext; break; } } catch (e) {}
    }
    let node = null;
    if (chosen === 'mp4' || chosen === 'webm') {
        node = document.createElement('video');
        node.src = base + '.' + chosen; node.className = 'gift-anim';
        node.autoplay = true; node.muted = true; node.playsInline = true;
    } else if (chosen === 'gif' || chosen === 'webp') {
        node = document.createElement('img'); node.src = base + '.' + chosen; node.className = 'gift-anim'; node.alt = 'Regalo';
    } else if (chosen === 'json') {
        node = document.createElement('div'); node.className = 'gift-anim';
        node.style.width = '280px'; node.style.height = '280px';
        fx.appendChild(node);
        try {
            const lottie = await import('https://cdn.jsdelivr.net/npm/lottie-web@5/+esm');
            lottie.default.loadAnimation({ container: node, renderer: 'svg', loop: false, autoplay: true, path: base + '.json' });
        } catch (e) { node.className = 'gift-fallback'; }
    } else if (chosen === 'glb' || chosen === 'gltf') {
        node = document.createElement('model-viewer');
        node.src = base + '.' + chosen;
        node.setAttribute('auto-rotate', '');
        node.className = 'gift-anim';
        node.style.width = '280px'; node.style.height = '280px';
        fx.appendChild(node);
        try { await import('https://cdn.jsdelivr.net/npm/@google/model-viewer@3/dist/model-viewer.min.js'); } catch (e) { node.className = 'gift-fallback'; }
    }
    if (node && !node.parentNode) fx.appendChild(node);
    if (!node) { node = document.createElement('div'); node.className = 'gift-fallback'; fx.appendChild(node); }
    setTimeout(() => { if (node && node.parentNode) node.parentNode.removeChild(node); }, 6000);
}

// ============================================================================
// Señalización
// ============================================================================
function sigSend(type, payload) {
    if (!callState || !callState.channel) return;
    callState.channel.send({ type: 'broadcast', event: 'sig', payload: Object.assign({ type }, payload) });
}

async function handleSignal(msg) {
    if (!callState) return;
    const pc = callState.pc;
    if (msg.type === 'ready' && callState.isCaller) {
        try { const o = await pc.createOffer(); await pc.setLocalDescription(o); sigSend('offer', { sdp: o.sdp }); } catch (e) {}
    } else if (msg.type === 'offer' && !callState.isCaller) {
        try {
            await pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
            const a = await pc.createAnswer(); await pc.setLocalDescription(a); sigSend('answer', { sdp: a.sdp });
        } catch (e) {}
    } else if (msg.type === 'answer' && callState.isCaller) {
        try { await pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp }); } catch (e) {}
    } else if (msg.type === 'ice') {
        try { await pc.addIceCandidate(msg.candidate); } catch (e) {}
    } else if (msg.type === 'hangup') {
        endCall('remote-ended');
    } else if (msg.type === 'gift-request' && callState.isCaller) {
        const g = (await loadGifts()).find(x => x.id === msg.giftId);
        if (!g) return;
        showRequestModal('Solicitud de regalo',
            'La modelo solicita "' + g.name + '" por ' + Number(g.client_price) + ' tokens.',
            () => sendGiftRpc(msg.giftId, true));
    } else if (msg.type === 'token-request' && callState.isCaller) {
        showRequestModal('Solicitud de tokens',
            'La modelo solicita ' + msg.amount + ' tokens. Se descontaran de tu saldo.',
            async () => {
                try {
                    const { data, error } = await window.supabase.rpc('send_token_tip', { p_call_id: callState.callId, p_amount: msg.amount });
                    if (error) throw error;
                    window.appState.currentUser.profile.tokens_balance = Number(data.balance);
                    if (window.updateUserUI) window.updateUserUI();
                    window.showToast('Solicitud aceptada: -' + msg.amount + ' tokens', 'success');
                    sigSend('tip', { amount: msg.amount });
                } catch (err) { window.showToast(err.message || 'No se pudo aceptar', 'error'); }
            });
    } else if (msg.type === 'gift') {
        const g = (await loadGifts()).find(x => x.id === msg.giftId);
        if (g) playGiftFx(g.asset);
    } else if (msg.type === 'tip') {
        if (!callState.isCaller) window.showToast('Solicitud aceptada: +' + (msg.amount * 0.5) + ' tokens', 'success');
    } else if (msg.type === 'request-denied') {
        window.showToast('La solicitud fue rechazada', 'info');
    }
}

// ============================================================================
// Códecs / bitrate / calidad
// ============================================================================
function preferCodecs(pc) {
    try {
        const caps = RTCRtpSender.getCapabilities('video');
        if (!caps) return;
        const ordered = caps.codecs.filter(c => c.mimeType.toLowerCase() === 'video/h264')
            .concat(caps.codecs.filter(c => c.mimeType.toLowerCase() === 'video/vp8'))
            .concat(caps.codecs.filter(c => c.mimeType.toLowerCase() === 'video/rtx'));
        pc.getTransceivers().forEach(tr => {
            if (tr.receiver.track.kind === 'video' && ordered.length && tr.setCodecPreferences) tr.setCodecPreferences(ordered);
        });
    } catch (e) {}
}

function applyBitrate(bps) {
    if (!callState) return;
    callState.pc.getSenders().forEach(s => {
        if (s.track && s.track.kind === 'video') {
            const p = s.getParameters();
            if (!p.encodings || p.encodings.length === 0) p.encodings = [{}];
            p.encodings[0].maxBitrate = bps;
            s.setParameters(p).catch(() => {});
        }
    });
}

async function monitorQuality() {
    if (!callState || !callState.connected) return;
    try {
        const stats = await callState.pc.getStats();
        let rtt = 0, lost = 0, recv = 0;
        stats.forEach(r => {
            if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.currentRoundTripTime) rtt = r.currentRoundTripTime * 1000;
            if (r.type === 'inbound-rtp' && r.kind === 'video') { lost = r.packetsLost || 0; recv = r.packetsReceived || 0; }
        });
        const loss = recv > 0 ? (lost / (lost + recv)) * 100 : 0;
        applyBitrate(loss > 5 || rtt > 500 ? 150000 : 250000);
    } catch (e) {}
}

async function getMediaWithRetry() {
    for (let i = 0; i < 3; i++) {
        try { return await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); }
        catch (e) { if (i < 2) await new Promise(r => setTimeout(r, 500)); }
    }
    return null;
}

// ============================================================================
// Cobro en vivo
// ============================================================================
function startBillTimer() { setTimer('ui', 1000, tickUi, true); setTimer('bill', 10000, tickBill, true); }
function startEarnTimer() { setTimer('ui', 1000, tickUi, true); }

function tickUi() {
    if (!callState) return;
    callState.seconds += 1;
    const mm = String(Math.floor(callState.seconds / 60)).padStart(2, '0');
    const ss = String(callState.seconds % 60).padStart(2, '0');
    const t = document.getElementById('callTimer');
    const c = document.getElementById('callCost');
    if (t) t.textContent = mm + ':' + ss;
    if (c) {
        c.textContent = callState.isCaller
            ? 'Costo: ' + ((callState.seconds * callState.clientRate) / 60).toFixed(1)
            : 'Ganancia: ' + ((callState.seconds * callState.modelRate) / 60).toFixed(1);
    }
}

async function tickBill() {
    if (!callState || !callState.isCaller || !callState.connected) return;
    try {
        const { data, error } = await window.supabase.rpc('tick_call', { p_call_id: callState.callId, p_seconds: 10 });
        if (error) throw error;
        if (data && data.client_balance !== undefined) {
            window.appState.currentUser.profile.tokens_balance = Number(data.client_balance);
            if (window.updateUserUI) window.updateUserUI();
            if (Number(data.client_balance) < (10 * callState.clientRate) / 60) {
                window.showToast('Te quedaste sin tokens: llamada finalizada', 'error');
                endCall('saldo');
            }
        }
    } catch (err) { console.error('tick_call fallo:', err); }
}

function showConnecting() {
    document.getElementById('callOverlay').classList.add('active');
    document.getElementById('callConnecting').style.display = 'flex';
}
function hideConnecting() {
    const c = document.getElementById('callConnecting');
    if (c) c.style.display = 'none';
}
function startMediaWatch() {
    setTimer('mediaWatch', 15000, () => {
        if (callState && (!callState.remoteStream || callState.remoteStream.getTracks().length === 0)) endCall('sin-medios');
    });
}

// ============================================================================
// endCall(): quien cuelga LIQUIDA la llamada con settle_call
// ============================================================================
async function endCall(reason) {
    if (!callState || callState.ending) return;
    callState.ending = true;

    sigSend('hangup', {});
    window.CND_chat.detach();
    Object.keys(callState.timers).forEach(k => clearTimer(k));
    if (callState.localStream) callState.localStream.getTracks().forEach(t => t.stop());
    if (callState.remoteStream) callState.remoteStream.getTracks().forEach(t => t.stop());
    try { callState.pc.close(); } catch (e) {}
    try { if (callState.channel) window.supabase.removeChannel(callState.channel); } catch (e) {}

    // Liquidación: solo quien cuelga y solo si estuvo conectada
    const wasConnected = callState.connected;
    const myRole = callState.isCaller ? 'client' : 'model';
    const callId = callState.callId;
    try {
        if (wasConnected && (reason === 'local' || reason === 'saldo' || reason === 'network' || reason === 'sin-medios')) {
            await window.supabase.rpc('settle_call', { p_call_id: callId, p_hung_by: myRole });
        } else if (!wasConnected) {
            await window.supabase.rpc('end_call', { p_call_id: callId });
        }
        // reason remote-ended: la otra parte ya liquidó
    } catch (e) { console.error('Error al liquidar llamada:', e); }

    const overlay = document.getElementById('callOverlay');
    if (overlay) { overlay.classList.remove('active'); overlay.classList.remove('live'); }
    document.getElementById('remoteVideo').srcObject = null;
    document.getElementById('localVideo').srcObject = null;
    const rm = document.getElementById('callRequestModal');
    if (rm) rm.classList.remove('active');
    const mb = document.getElementById('micBtn');
    if (mb) mb.classList.remove('off');

    callState = null;

    if (reason === 'rejected') window.showToast('La modelo rechazo la llamada. No se te cobro nada.', 'info');
    else if (reason === 'network') window.showToast('Tu red parece estar detras de una NAT restrictiva. Recomendamos: usar WiFi, desactivar VPN o intentar mas tarde.', 'error');
    else if (reason === 'sin-medios') window.showToast('No se recibio video ni audio de la otra parte.', 'error');
    else if (reason === 'remote-ended') window.showToast('La otra parte finalizo la llamada. Liquidacion aplicada.', 'info');
    else window.showToast('Llamada finalizada y liquidada', 'info');
}

function setTimer(name, ms, fn, repeat) {
    if (!callState) return;
    clearTimer(name);
    callState.timers[name] = repeat ? setInterval(fn, ms) : setTimeout(fn, ms);
}
function clearTimer(name) {
    if (!callState) return;
    const t = callState.timers[name];
    if (t) { clearInterval(t); clearTimeout(t); delete callState.timers[name]; }
}

document.addEventListener('DOMContentLoaded', () => {
    const a = document.getElementById('acceptCallBtn');
    const r = document.getElementById('rejectCallBtn');
    if (a) a.addEventListener('click', acceptIncoming);
    if (r) r.addEventListener('click', rejectIncoming);
});

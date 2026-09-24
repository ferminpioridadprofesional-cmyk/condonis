// ============================================================================
// CONDONIS - CALLS: Videollamadas 1:1 WebRTC P2P con STUN gratuitos
// Cumple Sección 8: sin TURN de pago, overlay conectando, corte 15s,
// ICE restart a los 5s, mensaje claro a los 10s, adaptive bitrate,
// cobro por tick_call cada 10s, rechazo sin cobro, bloqueo pre-llamada.
// Señalización por Realtime broadcast (gratis) + postgres_changes.
// ============================================================================

// Estado local del módulo (no global para evitar colisiones, regla A2)
let callState = null;    // llamada activa actual
let ringing = null;      // llamada entrante sonando
let callsChannelDb = null; // canal postgres_changes de llamadas
let bootDone = false;

// ============================================================================
// Arranque: espera a que core.js deje el perfil listo y entonces init
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    waitProfile().then(() => {
        if (!bootDone) {
            bootDone = true;
            initCalls();
        }
    });
});

// ============================================================================
// waitProfile(): sondea el estado global hasta que core.js cargue el perfil
// ============================================================================
async function waitProfile() {
    for (let i = 0; i < 50; i++) {
        if (window.appState && window.appState.currentUser && window.appState.currentUser.profile) {
            return true;
        }
        await new Promise(r => setTimeout(r, 200)); // 200ms entre intentos
    }
    return false;
}

// ============================================================================
// initCalls(): ata botones fijos y suscribe eventos de llamadas
// ============================================================================
function initCalls() {
    const uid = window.appState.currentUser.id;

    // Botones fijos del DOM (una sola vez, regla A12)
    const hangup = document.getElementById('hangupBtn');
    if (hangup) hangup.addEventListener('click', () => endCall('local'));

    const accept = document.getElementById('acceptCallBtn');
    if (accept) accept.addEventListener('click', acceptIncoming);

    const reject = document.getElementById('rejectCallBtn');
    if (reject) reject.addEventListener('click', rejectIncoming);

    // Suscripción a INSERT/UPDATE de video_calls propios (entrantes y propias)
    callsChannelDb = window.supabase
        .channel('calls-' + uid)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'video_calls' },
            (payload) => handleCallEvent(payload)
        )
        .subscribe();
}

// ============================================================================
// handleCallEvent(): eventos de llamada (entrante, rechazo, fin remoto)
// ============================================================================
function handleCallEvent(payload) {
    const uid = window.appState.currentUser.id;
    const row = payload.new;
    if (!row) return;
    if (row.client_id !== uid && row.model_id !== uid) return; // no es mía

    // Llamada entrante nueva para mí (soy la modelo y está esperando)
    if (payload.eventType === 'INSERT' && row.model_id === uid && row.status === 'waiting') {
        showIncoming(row);
        return;
    }

    if (payload.eventType === 'UPDATE') {
        // Si estaba sonando y ya no aplica, cerrar modal entrante
        if (ringing && row.id === ringing.callId && (row.status === 'missed' || row.status === 'ended')) {
            hideIncoming();
            window.showToast('La llamada fue cancelada', 'info');
            return;
        }
        // Si estoy en llamada y pasó a ended: colgó la otra parte
        if (callState && row.id === callState.callId && row.status === 'ended' && !callState.ending) {
            endCall('remote-ended');
            return;
        }
        // Si soy el cliente y pasó a missed: la modelo rechazó (S7)
        if (callState && row.id === callState.callId && row.status === 'missed' && callState.isCaller) {
            endCall('rejected');
            return;
        }
    }
}

// ============================================================================
// showIncoming(): modal de llamada entrante con pulso (modelo)
// ============================================================================
async function showIncoming(row) {
    if (ringing || callState) return; // ya ocupada o sonando (regla A12)

    ringing = { callId: row.id, roomId: row.room_id, clientRate: Number(row.client_rate_per_minute), modelRate: Number(row.model_rate_per_minute) };

    // Nombre del cliente vía RPC segura
    let name = 'Un cliente';
    try {
        const { data } = await window.supabase.rpc('get_display_name', { p_user_id: row.client_id });
        if (data) name = data;
    } catch (e) { /* nombre genérico si falla */ }

    const title = document.getElementById('incomingTitle');
    const info = document.getElementById('incomingInfo');
    const modal = document.getElementById('incomingModal');
    if (title) title.textContent = 'Llamada entrante de ' + name;
    if (info) info.textContent = 'Ganas ' + ringing.modelRate + ' tokens por minuto en esta llamada.';
    if (modal) modal.classList.add('active');
}

function hideIncoming() {
    ringing = null;
    const modal = document.getElementById('incomingModal');
    if (modal) modal.classList.remove('active');
}

// ============================================================================
// acceptIncoming(): la modelo acepta y queda como respondedora WebRTC
// ============================================================================
async function acceptIncoming() {
    if (!ringing) return;
    const info = ringing;
    hideIncoming();

    try {
        const { error } = await window.supabase.rpc('accept_call', { p_call_id: info.callId });
        if (error) throw error;
    } catch (err) {
        window.showToast('No se pudo aceptar la llamada', 'error');
        return;
    }

    await setupCall(info.callId, info.roomId, false, info.clientRate, info.modelRate);
    // Aviso al cliente para que genere la oferta WebRTC
    sigSend('ready', {});
    startEarnTimer();
}

// ============================================================================
// rejectIncoming(): rechazo sin cobro (S7)
// ============================================================================
async function rejectIncoming() {
    if (!ringing) return;
    const info = ringing;
    hideIncoming();
    try {
        await window.supabase.rpc('reject_call', { p_call_id: info.callId });
    } catch (err) {
        console.error('Error al rechazar:', err);
    }
}

// ============================================================================
// CND_startCall(): el cliente inicia la llamada (botón del perfil)
// ============================================================================
async function CND_startCall(modelId) {
    if (callState) {
        window.showToast('Ya tienes una llamada en curso', 'error');
        return;
    }

    const profile = window.appState.currentUser.profile;
    if (Number(profile.tokens_balance || 0) <= 0) {
        window.showToast('No tienes tokens suficientes para llamar', 'error');
        return;
    }

    const roomId = 'room-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

    try {
        // RPC con bloqueo pre-llamada y verificación de disponibilidad (S8)
        const { data: callId, error } = await window.supabase.rpc('start_call_with_status', {
            p_model: modelId,
            p_room: roomId
        });
        if (error) throw error;

        // Leer tarifas de la llamada creada
        const { data: row } = await window.supabase
            .from('video_calls').select('*').eq('id', callId).single();

        await setupCall(callId, roomId, true, Number(row.client_rate_per_minute), Number(row.model_rate_per_minute));

        // Aviso a la modelo para que se una al canal y acepte
        sigSend('ready-request', {});
    } catch (err) {
        console.error('Error al iniciar llamada:', err);
        window.showToast(err.message || 'No se pudo iniciar la llamada', 'error');
    }
}

window.CND_startCall = CND_startCall;

// ============================================================================
// setupCall(): crea stream, PeerConnection y canal de señalización
// S5: getUserMedia ANTES de createPC, con 2 reintentos
// ============================================================================
async function setupCall(callId, roomId, isCaller, clientRate, modelRate) {
    const stream = await getMediaWithRetry();
    if (!stream) {
        window.showToast('No se pudo acceder a tu cámara o micrófono', 'error');
        if (isCaller) {
            try { await window.supabase.rpc('end_call', { p_call_id: callId }); } catch (e) {}
        }
        return;
    }

    // PeerConnection con SOLO STUN públicos gratuitos (Sección 8 S1)
    const pc = new RTCPeerConnection({ iceServers: window.CND_ICE_SERVERS });

    callState = {
        callId, roomId, pc, isCaller, clientRate, modelRate,
        localStream: stream,
        remoteStream: null,
        seconds: 0,
        tickAccum: 0,
        timers: {},
        ending: false,
        connected: false,
        iceRestarted: false,
        channel: null
    };

    // Canal de señalización broadcast (gratis, sin servidor propio)
    callState.channel = window.supabase.channel('call-' + roomId);
    callState.channel.on('broadcast', { event: 'sig' }, (msg) => handleSignal(msg.payload));
    callState.channel.subscribe();

    // Pistas locales al PC
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    // Preferencia de códecs: H264 primero, VP8 de respaldo (S2c)
    preferCodecs(pc);

    // Videos en el overlay
    const localVideo = document.getElementById('localVideo');
    if (localVideo) localVideo.srcObject = stream;

    // Eventos del PeerConnection
    pc.onicecandidate = (e) => {
        if (e.candidate) sigSend('ice', { candidate: e.candidate });
    };

    pc.ontrack = (e) => {
        // Primer track remoto: conectar al video y cancelar corte por medios
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo && !callState.remoteStream) {
            callState.remoteStream = e.streams[0] || new MediaStream();
            if (!e.streams[0]) callState.remoteStream.addTrack(e.track);
            remoteVideo.srcObject = callState.remoteStream;
        }
        clearTimer('mediaWatch');
        hideConnecting();
    };

    pc.oniceconnectionstatechange = () => {
        const st = pc.iceConnectionState;
        if (st === 'connected' || st === 'completed') {
            callState.connected = true;
            hideConnecting();
            clearTimer('connectWatch');
            startMediaWatch(); // S4: 15s sin medios remotos => corte
            if (isCaller) startBillTimer(); // cobro desde conexión activa
        } else if (st === 'disconnected') {
            // No reconectar aún: esperar 3s por recuperación (A9)
            setTimer('disco', 3000, () => {
                if (callState && callState.pc && callState.pc.iceConnectionState === 'disconnected') {
                    try { callState.pc.restartIce(); } catch (e) {}
                }
            });
        } else if (st === 'failed') {
            endCall('network'); // S10: mensaje de NAT restrictiva
        }
    };

    // Vigía de conexión: ICE restart a los 5s, mensaje y corte a los 10s (S2d/e)
    showConnecting();
    setTimer('connectWatch', 5000, () => {
        if (callState && !callState.connected && !callState.iceRestarted) {
            callState.iceRestarted = true;
            try { callState.pc.restartIce(); } catch (e) {}
        }
    });
    setTimer('connectFail', 10000, () => {
        if (callState && !callState.connected) {
            endCall('network');
        }
    });

    // Bitrate inicial BAJO para redes lentas (S2b): 250kbps video
    applyBitrate(250000);

    // Monitor de calidad cada 5s (adaptive bitrate, S9)
    setTimer('stats', 5000, monitorQuality, true);
}

// ============================================================================
// getMediaWithRetry(): cámara+mic con 2 reintentos separados 500ms (S5)
// ============================================================================
async function getMediaWithRetry() {
    for (let i = 0; i < 3; i++) {
        try {
            return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (err) {
            if (i < 2) await new Promise(r => setTimeout(r, 500));
        }
    }
    return null;
}

// ============================================================================
// preferCodecs(): H264 primero y VP8 después en transceivers de video (S2c)
// ============================================================================
function preferCodecs(pc) {
    try {
        const caps = RTCRtpSender.getCapabilities('video');
        if (!caps) return;
        const h264 = caps.codecs.filter(c => c.mimeType.toLowerCase() === 'video/h264');
        const vp8 = caps.codecs.filter(c => c.mimeType.toLowerCase() === 'video/vp8');
        const rtx = caps.codecs.filter(c => c.mimeType.toLowerCase() === 'video/rtx');
        const ordered = h264.concat(vp8, rtx);
        pc.getTransceivers().forEach(tr => {
            if (tr.receiver.track.kind === 'video' && ordered.length && tr.setCodecPreferences) {
                tr.setCodecPreferences(ordered);
            }
        });
    } catch (e) {
        // Si el navegador no lo soporta, continuar con códecs por defecto
    }
}

// ============================================================================
// Señalización broadcast
// ============================================================================
function sigSend(type, payload) {
    if (!callState || !callState.channel) return;
    callState.channel.send({
        type: 'broadcast',
        event: 'sig',
        payload: Object.assign({ type }, payload)
    });
}

async function handleSignal(msg) {
    if (!callState) return;
    const pc = callState.pc;

    if (msg.type === 'ready' && callState.isCaller) {
        // La modelo aceptó: generar oferta
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sigSend('offer', { sdp: offer.sdp });
        } catch (e) { console.error('offer', e); }
    }
    else if (msg.type === 'offer' && !callState.isCaller) {
        try {
            await pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sigSend('answer', { sdp: answer.sdp });
        } catch (e) { console.error('answer', e); }
    }
    else if (msg.type === 'answer' && callState.isCaller) {
        try {
            await pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
        } catch (e) { console.error('setAnswer', e); }
    }
    else if (msg.type === 'ice') {
        try {
            await pc.addIceCandidate(msg.candidate);
        } catch (e) { /* candidato obsoleto: ignorar */ }
    }
    else if (msg.type === 'hangup') {
        endCall('remote-ended');
    }
}

// ============================================================================
// applyBitrate(): limita el bitrate del sender de video (S2b y S9)
// ============================================================================
function applyBitrate(bps) {
    if (!callState) return;
    callState.pc.getSenders().forEach(sender => {
        if (sender.track && sender.track.kind === 'video') {
            const p = sender.getParameters();
            if (!p.encodings || p.encodings.length === 0) p.encodings = [{}];
            p.encodings[0].maxBitrate = bps;
            sender.setParameters(p).catch(() => {});
        }
    });
}

// ============================================================================
// monitorQuality(): pérdida >5% o RTT >500ms => bajar a 150kbps (S9)
// ============================================================================
async function monitorQuality() {
    if (!callState || !callState.connected) return;
    try {
        const stats = await callState.pc.getStats();
        let loss = 0, rtt = 0, prevLost = null, prevRecv = null;
        stats.forEach(report => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.currentRoundTripTime) {
                rtt = report.currentRoundTripTime * 1000; // ms
            }
            if (report.type === 'inbound-rtp' && report.kind === 'video') {
                prevLost = report.packetsLost || 0;
                prevRecv = report.packetsReceived || 0;
            }
        });
        if (prevRecv && prevRecv > 0) {
            loss = (prevLost / (prevLost + prevRecv)) * 100;
        }
        if (loss > 5 || rtt > 500) {
            applyBitrate(150000); // red mala: 150kbps y menos resolución
        } else {
            applyBitrate(250000); // red buena: restaurar
        }
    } catch (e) { /* stats no disponibles: continuar */ }
}

// ============================================================================
// Cobro: contador UI cada 1s y tick_call cada 10s (S6)
// ============================================================================
function startBillTimer() {
    setTimer('ui', 1000, tickUi, true);
    setTimer('bill', 10000, tickBill, true);
}

function startEarnTimer() {
    setTimer('ui', 1000, tickUi, true);
}

function tickUi() {
    if (!callState) return;
    callState.seconds += 1;
    const timer = document.getElementById('callTimer');
    const cost = document.getElementById('callCost');
    const mm = String(Math.floor(callState.seconds / 60)).padStart(2, '0');
    const ss = String(callState.seconds % 60).padStart(2, '0');
    if (timer) timer.textContent = mm + ':' + ss;
    if (cost) {
        if (callState.isCaller) {
            const c = (callState.seconds * callState.clientRate) / 60;
            cost.textContent = 'Costo: ' + c.toFixed(1) + ' tokens';
        } else {
            const g = (callState.seconds * callState.modelRate) / 60;
            cost.textContent = 'Ganancia: ' + g.toFixed(1) + ' tokens';
        }
    }
}

async function tickBill() {
    if (!callState || !callState.isCaller || !callState.connected) return;
    try {
        const { data, error } = await window.supabase.rpc('tick_call', {
            p_call_id: callState.callId,
            p_seconds: 10
        });
        if (error) throw error;

        // Refrescar saldo del header con el valor real devuelto
        if (data && data.client_balance !== undefined) {
            window.appState.currentUser.profile.tokens_balance = Number(data.client_balance);
            if (typeof window.updateUserUI === 'function') window.updateUserUI();

            // Saldo insuficiente para el siguiente tramo: cortar (economía)
            const nextCost = (10 * callState.clientRate) / 60;
            if (Number(data.client_balance) < nextCost) {
                window.showToast('Te quedaste sin tokens: llamada finalizada', 'error');
                endCall('saldo');
            }
        }
    } catch (err) {
        console.error('tick_call fallo:', err);
    }
}

// ============================================================================
// Overlays: conectando / llamada activa
// ============================================================================
function showConnecting() {
    const overlay = document.getElementById('callOverlay');
    const conn = document.getElementById('callConnecting');
    if (overlay) overlay.classList.add('active');
    if (conn) conn.style.display = 'flex';
}

function hideConnecting() {
    const conn = document.getElementById('callConnecting');
    if (conn) conn.style.display = 'none';
}

function startMediaWatch() {
    // S4: si a los 15s conectados no hay medios remotos, cortar limpio
    setTimer('mediaWatch', 15000, () => {
        if (callState && (!callState.remoteStream || callState.remoteStream.getTracks().every(t => !t.enabled && t.readyState === 'live'))) {
            endCall('sin-medios');
        }
    });
}

// ============================================================================
// endCall(): limpieza total S5 + RPC end_call + mensajes claros (S10)
// ============================================================================
async function endCall(reason) {
    if (!callState || callState.ending) return;
    callState.ending = true;

    // Avisar a la otra parte antes de cerrar el canal
    sigSend('hangup', {});

    // Limpiar timers propios
    Object.keys(callState.timers).forEach(k => clearTimer(k));

    // Cerrar pistas y conexión (S5: limpiar tracks al colgar)
    if (callState.localStream) {
        callState.localStream.getTracks().forEach(t => t.stop());
    }
    if (callState.remoteStream) {
        callState.remoteStream.getTracks().forEach(t => t.stop());
    }
    try { callState.pc.close(); } catch (e) {}

    // Cerrar canal de señalización
    try {
        if (callState.channel) window.supabase.removeChannel(callState.channel);
    } catch (e) {}

    // Cerrar la llamada en base de datos (libera in_call de ambos)
    try {
        await window.supabase.rpc('end_call', { p_call_id: callState.callId });
    } catch (e) { /* ya cerrada por el otro lado */ }

    // Limpiar UI
    const overlay = document.getElementById('callOverlay');
    if (overlay) overlay.classList.remove('active');
    const remoteVideo = document.getElementById('remoteVideo');
    const localVideo = document.getElementById('localVideo');
    if (remoteVideo) remoteVideo.srcObject = null;
    if (localVideo) localVideo.srcObject = null;

    callState = null;

    // Mensajes claros según motivo (S7 y S10)
    if (reason === 'rejected') {
        window.showToast('La modelo rechazo la llamada. No se te cobro nada.', 'info');
    } else if (reason === 'network') {
        window.showToast('Tu red parece estar detras de una NAT restrictiva. Recomendamos: usar WiFi en lugar de datos moviles, desactivar VPN si esta activa, o intentar mas tarde.', 'error');
    } else if (reason === 'sin-medios') {
        window.showToast('No se recibio video ni audio de la otra parte. Llamada finalizada.', 'error');
    } else if (reason === 'remote-ended') {
        window.showToast('La otra parte finalizo la llamada.', 'info');
    } else if (reason === 'saldo') {
        // el toast ya se mostró en tickBill
    } else {
        window.showToast('Llamada finalizada', 'info');
    }
}

// ============================================================================
// Utilidades de timers con nombre (evita apilar intervalos, regla A12)
// ============================================================================
function setTimer(name, ms, fn, repeat) {
    if (!callState) return;
    clearTimer(name);
    if (repeat) {
        callState.timers[name] = setInterval(fn, ms);
    } else {
        callState.timers[name] = setTimeout(fn, ms);
    }
}

function clearTimer(name) {
    if (!callState) return;
    const t = callState.timers[name];
    if (t) {
        clearInterval(t);
        clearTimeout(t);
        delete callState.timers[name];
    }
}

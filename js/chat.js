// ============================================================================
// CONDONIS - CHAT: mensajería dentro de la llamada con filtro de datos
// personales. Si se detecta contacto/pago/URL: se bloquea el mensaje y se
// notifica al admin con la conversación completa (RPC report_chat_violation).
// conv_id = id de la llamada (UUID).
// ============================================================================

let chatCallId = null;   // id de llamada activa como conversación
let chatPeerId = null;   // id del otro participante
let chatChannel = null;  // canal realtime de mensajes
let chatOnMessage = null; // callback que pinta líneas (lo pone calls.js)

// Patrones prohibidos: email, URL, teléfono, handles, redes, pagos, bancos,
// direcciones y frases típicas de intercambio de contacto (es/en).
const CHAT_BANNED = [
    /[\w.+-]+@[\w-]+\.[\w.]{2,}/,                                   // email
    /(https?:\/\/|www\.)\S+/i,                                     // urls
    /\b[\w-]+\.(com|net|org|io|ve|co|me|link|xyz|info|biz)\b/i,     // dominios
    /(\+?\d[\d\s().-]{6,}\d)/,                                     // teléfonos
    /@[\w.]{3,}/,                                                  // handles
    /\b(whats?app|telegram|insta(gram)?|facebook|messenger|tik\s?tok|twitter|snapchat|onlyfans|paypal|pay\s?pal|zelle|venmo|cash\s?app|binance|crypto|usdt|iban|clabe|banco|bank|transferencia|pago\s?movil|pagomovil|cuenta\s+bancaria|numero\s+de\s+cuenta|direcci(on|ó)n|mi\s+casa|te\s+paso\s+mi|te\s+doy\s+mi|mi\s+numero)\b/i
];

// ============================================================================
// scanChatText(): true si el texto contiene datos prohibidos
// ============================================================================
function scanChatText(text) {
    const t = String(text || '');
    return CHAT_BANNED.some(rx => rx.test(t));
}

// ============================================================================
// attachChat(): suscribe mensajes de la llamada y prepara callback
// ============================================================================
function attachChat(callId, peerId, onMessage) {
    detachChat(); // limpia sesión anterior (regla A12)
    chatCallId = callId;
    chatPeerId = peerId;
    chatOnMessage = onMessage;

    chatChannel = window.supabase
        .channel('chat-' + callId)
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages', filter: 'conv_id=eq.' + callId },
            (payload) => {
                const m = payload.new;
                if (!m || m.sender_id === window.appState.currentUser.id) return; // propio no
                if (typeof chatOnMessage === 'function') chatOnMessage(m.body, false);
            }
        )
        .subscribe();
}

// ============================================================================
// detachChat(): cierra el canal al colgar
// ============================================================================
function detachChat() {
    if (chatChannel) {
        try { window.supabase.removeChannel(chatChannel); } catch (e) {}
        chatChannel = null;
    }
    chatCallId = null;
    chatPeerId = null;
    chatOnMessage = null;
}

// ============================================================================
// sendChatMessage(): filtra, reporta violaciones y persiste el mensaje
// Devuelve true si se envió, false si fue bloqueado.
// ============================================================================
async function sendChatMessage(text) {
    const clean = String(text || '').trim();
    if (!clean || !chatCallId) return false;

    // Detección: bloquear + notificar al admin con toda la conversación
    if (scanChatText(clean)) {
        window.showToast('No puedes compartir datos personales, contacto, pagos o enlaces. El incidente fue reportado.', 'error');
        try {
            await window.supabase.rpc('report_chat_violation', {
                p_call_id: chatCallId,
                p_offending_text: clean
            });
        } catch (e) {
            console.error('No se pudo reportar la violacion:', e);
        }
        return false;
    }

    try {
        const { error } = await window.supabase.from('messages').insert({
            conv_id: chatCallId,
            sender_id: window.appState.currentUser.id,
            receiver_id: chatPeerId,
            body: clean,
            read: false
        });
        if (error) throw error;
        if (typeof chatOnMessage === 'function') chatOnMessage(clean, true);
        return true;
    } catch (err) {
        console.error('Error al enviar chat:', err);
        window.showToast('No se pudo enviar el mensaje', 'error');
        return false;
    }
}

// Exposición global para calls.js
window.CND_chat = { attach: attachChat, detach: detachChat, send: sendChatMessage, scan: scanChatText };

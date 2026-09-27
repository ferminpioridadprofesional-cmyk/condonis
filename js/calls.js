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
    // Corte inmediato si el cliente se queda sin saldo (refuerzo)
    if (callState.isCaller && Number(window.appState.currentUser.profile.tokens_balance || 0) <= 0) {
        window.showToast('Te quedaste sin tokens: llamada finalizada', 'error');
        endCall('saldo');
    }
}

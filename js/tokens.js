// ============================================================================
// CONDONIS - TOKENS: recarga con pago simulado y historial de movimientos
// El cliente se acredita tokens al instante para poder llamar (Fase 4).
// ============================================================================

async function renderHistorySection() {
    const container = document.getElementById('historyContent');
    if (!container) return;

    const profile = window.appState.currentUser.profile;
    const isAdmin = profile.role === 'admin';

    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <span class="card-title">Recargar tokens</span>
                <span class="info-value" id="histBalance"></span>
            </div>
            ${isAdmin
                ? '<p class="hint">Tu saldo administrativo es ilimitado; no necesitas recargar.</p>'
                : `
                    <p class="hint">Pago SIMULADO para pruebas: los tokens se acreditan al instante. En producción aquí irá la pasarela real.</p>
                    <div class="pkg-row">
                        <button class="btn btn-secondary pkg-btn" data-amount="100">100 tokens</button>
                        <button class="btn btn-secondary pkg-btn" data-amount="500">500 tokens</button>
                        <button class="btn btn-secondary pkg-btn" data-amount="1000">1000 tokens</button>
                    </div>
                `}
        </div>
        <div class="card">
            <div class="card-header"><span class="card-title">Movimientos</span></div>
            <div id="txList"></div>
        </div>
    `;

    updateHistBalance();

    container.querySelectorAll('.pkg-btn').forEach(btn => {
        btn.addEventListener('click', () => buyTokens(parseInt(btn.dataset.amount, 10)));
    });

    await loadTransactions();
}

window.renderHistorySection = renderHistorySection;

// ============================================================================
// updateHistBalance: refleja el saldo actual en la tarjeta de recarga
// ============================================================================
function updateHistBalance() {
    const el = document.getElementById('histBalance');
    if (!el) return;
    const profile = window.appState.currentUser.profile;
    el.textContent = profile.role === 'admin'
        ? 'Saldo: ilimitado'
        : 'Saldo: ' + Number(profile.tokens_balance || 0) + ' tokens';
}

// ============================================================================
// buyTokens: recarga simulada vía RPC purchase_tokens
// ============================================================================
async function buyTokens(amount) {
    try {
        const { data, error } = await window.supabase.rpc('purchase_tokens', { p_amount: amount });
        if (error) throw error;

        // Refrescar saldo global y UI
        window.appState.currentUser.profile.tokens_balance = Number(data.balance);
        if (typeof window.updateUserUI === 'function') window.updateUserUI();
        updateHistBalance();
        await loadTransactions();

        window.showToast('Recarga exitosa: +' + amount + ' tokens', 'success');
    } catch (err) {
        console.error('Error en recarga:', err);
        window.showToast('No se pudo completar la recarga', 'error');
    }
}

// ============================================================================
// loadTransactions: últimos 50 movimientos propios
// ============================================================================
async function loadTransactions() {
    const list = document.getElementById('txList');
    if (!list) return;
    list.innerHTML = '<p class="hint">Cargando...</p>';

    const { data, error } = await window.supabase
        .from('token_transactions')
        .select('*')
        .eq('user_id', window.appState.currentUser.id)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error || !data || data.length === 0) {
        list.innerHTML = '<p class="hint">Aun no tienes movimientos.</p>';
        return;
    }

    list.innerHTML = data.map(t => {
        const positive = Number(t.amount) >= 0;
        return `
            <div class="info-row">
                <span class="info-label">${t.description || t.type}<br><small>${new Date(t.created_at).toLocaleString()}</small></span>
                <span class="info-value" style="color:${positive ? '#86EFAC' : '#FCA5A5'};">${positive ? '+' : ''}${Number(t.amount)}</span>
            </div>
        `;
    }).join('');
}

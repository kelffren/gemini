(function () {
  'use strict';

  const KC_TO_DONATION = 50000;
  const LOWER_RANKS = [
    { id: 'none', name: 'Sin título', minDonation: 0, power: 0 },
    { id: 'knight', name: 'Caballero', minDonation: 30000000, power: 1 },
    { id: 'baron', name: 'Barón', minDonation: 100000000, power: 3 },
    { id: 'earl', name: 'Conde', minDonation: 200000000, power: 5 }
  ];
  const RANKED_RANKS = [
    { id: 'duke', name: 'Duque', top: 50, power: 7 },
    { id: 'prince', name: 'Príncipe', top: 15, power: 9 },
    { id: 'king', name: 'Rey', top: 3, power: 12 }
  ];

  // Stable prototype board so the exact Top 50 / Top 15 / Top 3 mechanic can run
  // before the same API is connected to the authoritative multiplayer server.
  const BOARD_NAMES = [
    'Aurelius','Valeria','Draven','Seraph','Midas','Cassian','Nyx','Orion','Vesper','Darius',
    'Lyra','Kael','Solenne','Riven','Astra','Magnus','Cyrus','Elara','Thorne','Octavia',
    'Lucian','Sable','Rowan','Isolde','Corvin','Selene','Atlas','Freya','Ragnar','Mira',
    'Leoric','Nerissa','Galen','Vega','Bastian','Iris','Talon','Amara','Evander','Zara',
    'Cedric','Noctis','Helena','Kieran','Liora','Varian','Evelyn','Marek','Sabine','Theron',
    'Alden','Fiora','Nolan','Petra','Quill','Rhea','Silas','Tessa','Ulric','Wren'
  ];

  function seededDonation(index) {
    if (index < 3) return [3200000000, 2940000000, 2715000000][index];
    if (index < 15) return 2300000000 - ((index - 3) * 95000000);
    if (index < 50) return 1120000000 - ((index - 15) * 22000000);
    return Math.max(210000000, 345000000 - ((index - 50) * 11500000));
  }

  const seedBoard = BOARD_NAMES.map((name, i) => ({ id: 'realm_' + (i + 1), name, donation: seededDonation(i) }));

  function ensureState() {
    if (typeof STATE === 'undefined') return null;
    if (!STATE.nobility || typeof STATE.nobility !== 'object') {
      STATE.nobility = { donation: 0, donatedToday: 0, donationDay: '', history: [] };
    }
    const n = STATE.nobility;
    n.donation = Math.max(0, Number(n.donation) || 0);
    n.donatedToday = Math.max(0, Number(n.donatedToday) || 0);
    n.history = Array.isArray(n.history) ? n.history : [];
    const day = new Date().toISOString().slice(0, 10);
    if (n.donationDay !== day) {
      n.donationDay = day;
      n.donatedToday = 0;
    }
    return n;
  }

  function playerBoard() {
    const n = ensureState();
    const player = { id: 'local_pioneer', name: (typeof localPlayer !== 'undefined' && localPlayer.name) ? localPlayer.name.replace(' (Tu)', '') : 'Kelo', donation: n ? n.donation : 0, isPlayer: true };
    return seedBoard.concat(player).sort((a, b) => b.donation - a.donation || a.name.localeCompare(b.name));
  }

  function getPosition() {
    return playerBoard().findIndex(row => row.isPlayer) + 1;
  }

  function getRank() {
    const n = ensureState();
    const donation = n ? n.donation : 0;
    const position = getPosition();
    if (position <= 3) return RANKED_RANKS[2];
    if (position <= 15) return RANKED_RANKS[1];
    if (position <= 50) return RANKED_RANKS[0];
    let rank = LOWER_RANKS[0];
    for (const candidate of LOWER_RANKS) if (donation >= candidate.minDonation) rank = candidate;
    return rank;
  }

  function amountToNextRank() {
    const n = ensureState();
    const donation = n ? n.donation : 0;
    const position = getPosition();
    if (position <= 3) return { type: 'max', amount: 0, label: 'Ya estás en el Top 3' };
    if (position <= 15) {
      const third = playerBoard().filter(x => !x.isPlayer)[2];
      return { type: 'ranking', amount: Math.max(0, third.donation - donation + 1), label: 'Para entrar al Top 3' };
    }
    if (position <= 50) {
      const fifteenth = playerBoard().filter(x => !x.isPlayer)[14];
      return { type: 'ranking', amount: Math.max(0, fifteenth.donation - donation + 1), label: 'Para entrar al Top 15' };
    }
    if (donation < 30000000) return { type: 'fixed', amount: 30000000 - donation, label: 'Para Caballero' };
    if (donation < 100000000) return { type: 'fixed', amount: 100000000 - donation, label: 'Para Barón' };
    if (donation < 200000000) return { type: 'fixed', amount: 200000000 - donation, label: 'Para Conde' };
    const fiftieth = playerBoard().filter(x => !x.isPlayer)[49];
    return { type: 'ranking', amount: Math.max(0, fiftieth.donation - donation + 1), label: 'Para entrar al Top 50' };
  }

  function pushHistory(currency, spent, donationValue) {
    const n = ensureState();
    n.history.unshift({ at: Date.now(), currency, spent, donationValue });
    n.history = n.history.slice(0, 30);
  }

  function donateGold(amount) {
    const n = ensureState();
    const value = Math.floor(Number(amount));
    if (!n || !Number.isFinite(value) || value <= 0) return { ok: false, error: 'Cantidad inválida' };
    if ((Number(STATE.gold) || 0) < value) return { ok: false, error: 'No tienes suficiente Oro' };
    STATE.gold -= value;
    n.donation += value;
    n.donatedToday += value;
    pushHistory('gold', value, value);
    if (typeof saveState === 'function') saveState();
    syncPlayerTitle();
    return { ok: true, donationAdded: value, rank: getRank() };
  }

  function donateKC(amount) {
    const n = ensureState();
    const value = Math.floor(Number(amount));
    if (!n || !Number.isFinite(value) || value <= 0) return { ok: false, error: 'Cantidad inválida' };
    if ((Number(STATE.kc) || 0) < value) return { ok: false, error: 'No tienes suficientes KC' };
    const donationValue = value * KC_TO_DONATION;
    STATE.kc -= value;
    n.donation += donationValue;
    n.donatedToday += donationValue;
    pushHistory('kc', value, donationValue);
    if (typeof saveState === 'function') saveState();
    syncPlayerTitle();
    return { ok: true, donationAdded: donationValue, rank: getRank() };
  }

  function syncPlayerTitle() {
    if (typeof localPlayer === 'undefined') return;
    const rank = getRank();
    localPlayer.nobilityRank = rank.id;
    localPlayer.nobilityPower = rank.power;
    localPlayer.nobilityTitle = rank.name;
  }

  function fmt(value) { return Math.floor(Number(value) || 0).toLocaleString('es-ES'); }

  function panel() { return document.getElementById('kelo-nobility'); }

  function render() {
    const root = panel();
    if (!root) return;
    const n = ensureState();
    const rank = getRank();
    const position = getPosition();
    const next = amountToNextRank();
    const rows = playerBoard().slice(0, 50);
    const table = rows.map((row, i) => `<div class="nob-row${row.isPlayer ? ' self' : ''}"><span>#${i + 1}</span><b>${row.name}</b><span>${fmt(row.donation)}</span></div>`).join('');
    const history = n.history.length ? n.history.slice(0, 8).map(h => `<div class="nob-history-row"><span>${h.currency === 'kc' ? 'KC' : 'Oro'} × ${fmt(h.spent)}</span><b>+${fmt(h.donationValue)}</b></div>`).join('') : '<div class="nob-empty">Todavía no has donado.</div>';
    root.innerHTML = `
      <div class="nob-shell">
        <div class="nob-head"><div><span class="nob-crown">♛</span><strong>Nobleza</strong><small>Donación imperial acumulativa</small></div><button type="button" class="nob-close" data-nob-close>×</button></div>
        <div class="nob-summary">
          <div class="nob-rank-card"><span class="nob-rank-label">Rango actual</span><strong>${rank.name}</strong><span>Potencia de Nobleza +${rank.power}</span></div>
          <div class="nob-stat"><span>Donación acumulada</span><b>${fmt(n.donation)}</b></div>
          <div class="nob-stat"><span>Posición del reino</span><b>#${position}</b></div>
          <div class="nob-stat"><span>Donado hoy</span><b>${fmt(n.donatedToday)}</b></div>
        </div>
        <div class="nob-next"><span>${next.label}</span><strong>${next.type === 'max' ? 'Rango máximo' : fmt(next.amount) + ' de donación'}</strong></div>
        <div class="nob-ranks">
          <div><b>Caballero</b><span>30.000.000</span><em>+1</em></div>
          <div><b>Barón</b><span>100.000.000</span><em>+3</em></div>
          <div><b>Conde</b><span>200.000.000</span><em>+5</em></div>
          <div><b>Duque</b><span>Top 50</span><em>+7</em></div>
          <div><b>Príncipe</b><span>Top 15</span><em>+9</em></div>
          <div><b>Rey</b><span>Top 3</span><em>+12</em></div>
        </div>
        <div class="nob-tabs"><button class="active" data-nob-tab="donate">Donar</button><button data-nob-tab="ranking">Ranking</button><button data-nob-tab="history">Historial</button></div>
        <div class="nob-pane active" data-nob-pane="donate">
          <div class="nob-donate-block"><label>Donar Oro <small>1 Oro = 1 de donación</small></label><div><input inputmode="numeric" pattern="[0-9]*" data-nob-gold placeholder="Cantidad"><button data-nob-donate-gold>Donar</button></div><small>Disponible: ${fmt(STATE.gold)} Oro</small></div>
          <div class="nob-donate-block"><label>Donar KC <small>1 KC = ${fmt(KC_TO_DONATION)} de donación</small></label><div><input inputmode="numeric" pattern="[0-9]*" data-nob-kc placeholder="Cantidad"><button data-nob-donate-kc>Donar</button></div><small>Disponible: ${fmt(STATE.kc)} KC</small></div>
          <p class="nob-note">La donación es permanente y no se devuelve. Duque, Príncipe y Rey dependen de tu posición frente a los demás jugadores.</p>
        </div>
        <div class="nob-pane" data-nob-pane="ranking"><div class="nob-board-head"><span>Puesto</span><span>Jugador</span><span>Donación</span></div><div class="nob-board">${table}</div><p class="nob-note">Ranking local de prototipo; el contrato está listo para sustituirse por el ranking autoritativo del servidor.</p></div>
        <div class="nob-pane" data-nob-pane="history">${history}</div>
      </div>`;
    bind(root);
  }

  function bind(root) {
    root.querySelector('[data-nob-close]')?.addEventListener('click', close);
    root.querySelectorAll('[data-nob-tab]').forEach(btn => btn.addEventListener('click', () => {
      root.querySelectorAll('[data-nob-tab]').forEach(x => x.classList.toggle('active', x === btn));
      root.querySelectorAll('[data-nob-pane]').forEach(x => x.classList.toggle('active', x.dataset.nobPane === btn.dataset.nobTab));
    }));
    root.querySelector('[data-nob-donate-gold]')?.addEventListener('click', () => {
      const input = root.querySelector('[data-nob-gold]');
      const result = donateGold(input?.value);
      if (!result.ok) { if (typeof showToast === 'function') showToast(result.error); return; }
      if (typeof showToast === 'function') showToast('Donación +' + fmt(result.donationAdded) + ' · ' + result.rank.name);
      render();
    });
    root.querySelector('[data-nob-donate-kc]')?.addEventListener('click', () => {
      const input = root.querySelector('[data-nob-kc]');
      const result = donateKC(input?.value);
      if (!result.ok) { if (typeof showToast === 'function') showToast(result.error); return; }
      if (typeof showToast === 'function') showToast('Donación +' + fmt(result.donationAdded) + ' · ' + result.rank.name);
      render();
    });
  }

  function open() {
    if (typeof closeMenu === 'function') closeMenu();
    if (typeof closeSocialOverlays === 'function') closeSocialOverlays();
    const root = panel();
    if (!root) return;
    render();
    root.style.display = 'block';
  }

  function close() {
    const root = panel();
    if (root) root.style.display = 'none';
  }

  ensureState();
  syncPlayerTitle();

  window.KeloNobility = Object.freeze({
    version: 'nobility-v1.0',
    kcToDonation: KC_TO_DONATION,
    ranks: Object.freeze(LOWER_RANKS.concat(RANKED_RANKS).map(x => Object.freeze({ ...x }))),
    open, close, render, donateGold, donateKC, getRank, getPosition, amountToNextRank,
    getBattlePowerBonus: () => getRank().power,
    getDonation: () => ensureState()?.donation || 0,
    boardSource: 'local-prototype-v1'
  });
})();
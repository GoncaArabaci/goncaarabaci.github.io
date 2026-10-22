// Rail Rivals - everything on screen except the map itself

const TRAIN_ICON = `<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="currentColor">
<rect x="9" y="8" width="30" height="24" rx="6"/><rect x="13" y="12" width="9" height="8" rx="2" fill-opacity=".35"/>
<rect x="26" y="12" width="9" height="8" rx="2" fill-opacity=".35"/><circle cx="16" cy="37" r="4"/><circle cx="32" cy="37" r="4"/>
<rect x="6" y="30" width="36" height="3" rx="1.5"/></g></svg>`;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const $ = id => document.getElementById(id);

class RailUI {
    constructor(onAction) {
        this.onAction = onAction;
        this.game = null;
        this.mySeat = null;
        this.ticketSel = new Set();
        this.ticketKey = '';
        this.hoverRoute = null;
        this.prevScores = {};
        this.prevHand = {};
        this.doneTickets = new Set();

        this.board = new RailBoard($('board'), {
            onRouteClick: id => this.clickRoute(id),
            onRouteHover: (id, e) => this.hoverRouteAt(id, e)
        });
        this.landPath = this.board.landPath;
        this.bind();
    }

    get me() { return this.game && this.mySeat !== null ? this.game.players[this.mySeat] : null; }
    isMyTurn() { return !!this.game && this.game.turnIndex === this.mySeat && this.game.phase === 'TURN'; }

    bind() {
        $('deck').addEventListener('click', e => this.tryAction(e.currentTarget, 'deck'));
        $('ticket-pile').addEventListener('click', e => this.tryAction(e.currentTarget, 'tickets'));
        $('btn-pass').addEventListener('click', () => this.onAction('pass'));
        $('market').addEventListener('click', e => {
            const btn = e.target.closest('[data-slot]');
            if (btn) this.tryAction(btn, 'market', { slot: Number(btn.dataset.slot) });
        });
        $('btn-keep-tickets').addEventListener('click', () => {
            this.onAction('keep_tickets', { ids: [...this.ticketSel] });
            sound.click();
        });
        $('ticket-options').addEventListener('click', e => {
            const opt = e.target.closest('[data-ticket]');
            if (!opt) return;
            const id = Number(opt.dataset.ticket);
            this.ticketSel.has(id) ? this.ticketSel.delete(id) : this.ticketSel.add(id);
            sound.click();
            this.renderTicketChoice(true);
        });
        $('claim-close').addEventListener('click', () => this.closeClaim());
        $('btn-rules').addEventListener('click', () => this.open('rules'));
        $('btn-sound').addEventListener('click', () => {
            $('btn-sound').textContent = sound.toggleMute() ? '🔇' : '🔊';
        });
        $('btn-sound').textContent = sound.muted ? '🔇' : '🔊';
        document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => this.close(b.dataset.close)));
        $('btn-reload').addEventListener('click', () => location.reload());
        document.addEventListener('keydown', e => { if (e.key === 'Escape') this.closeClaim(); });
        $('board-wrap').addEventListener('click', e => { if (!e.target.closest('.route')) this.closeClaim(); });
        window.addEventListener('resize', () => this.closeClaim());

        // hovering a ticket lights up its two cities
        $('my-tickets').addEventListener('pointerover', e => {
            const t = e.target.closest('[data-ticket]');
            if (!t) return;
            const info = MAP.tickets[Number(t.dataset.ticket)];
            this.board.highlightCities([info.a, info.b]);
        });
        $('my-tickets').addEventListener('pointerleave', () => this.board.highlightCities([]));
    }

    open(id) { $(id).classList.add('show'); }
    close(id) { $(id).classList.remove('show'); }

    tryAction(el, action, data = {}) {
        if (el.disabled) return;
        this.onAction(action, data);
    }

    deny(el) {
        el.classList.remove('deny');
        void el.offsetWidth;
        el.classList.add('deny');
        sound.error();
    }

    toast(text) {
        const t = $('toast');
        t.hidden = false;
        t.textContent = text;
        t.style.animation = 'none';
        void t.offsetWidth;
        t.style.animation = '';
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => { t.hidden = true; }, 2300);
    }

    // ---------- Copy (clipboard API with fallbacks) ----------

    bindCopy(btn, input) {
        const flash = text => {
            btn.textContent = text;
            clearTimeout(btn._t);
            btn._t = setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
        };
        const legacy = () => {
            input.focus();
            input.select();
            input.setSelectionRange(0, input.value.length);
            let ok = false;
            try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
            flash(ok ? '✓ Copied' : 'Press Ctrl+C');
        };
        btn.addEventListener('click', () => {
            if (!input.value) return;
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(input.value).then(() => flash('✓ Copied'), legacy);
            } else legacy();
        });
    }

    // ---------- Lobby ----------

    showLobbyName(mode, name, code) {
        this.open('lobby');
        $('lobby-name-step').hidden = false;
        $('lobby-room-step').hidden = true;
        $('lobby-error').textContent = '';
        $('lobby-name').value = name || '';
        $('btn-lobby-go').disabled = false;
        $('btn-lobby-go').textContent = mode === 'join' ? `Join room ${code}` : 'Create room';
        $('lobby-sub').textContent = mode === 'join'
            ? 'A friend invited you. Enter your name to hop on board.'
            : 'Build rail lines across the island, finish your secret tickets and outrun your friends. Create a room and send the link to 1–4 friends.';
        setTimeout(() => $('lobby-name').focus(), 60);
    }

    setLobbyBusy(text) {
        $('lobby-error').textContent = '';
        $('btn-lobby-go').disabled = true;
        $('btn-lobby-go').textContent = text;
    }

    showLobbyError(msg) {
        $('lobby-error').textContent = msg;
        $('btn-lobby-go').disabled = false;
    }

    showLobbyRoom({ isHost, link, players, mySeat, canStart }) {
        this.open('lobby');
        $('lobby-name-step').hidden = true;
        $('lobby-room-step').hidden = false;
        $('lobby-error').textContent = '';
        $('lobby-sub').textContent = isHost ? 'Send the link to your friends, then start when everyone is here.' : 'You\'re in! Waiting for the host to start.';
        $('lobby-link').value = link;
        $('lobby-count').textContent = players.length;
        $('lobby-players').innerHTML = players.map((n, i) => `
            <div class="lobby-player">
                <span class="avatar" style="--pc:${PLAYER_STYLE[i].fill};background:${PLAYER_STYLE[i].fill}">${esc(n.slice(0, 1).toUpperCase())}</span>
                <span>${esc(n)}${i === mySeat ? ' (you)' : ''}${i === 0 ? ' 👑' : ''}</span>
            </div>`).join('');
        $('btn-start').hidden = !isHost;
        $('btn-start').disabled = !canStart;
        $('lobby-wait').textContent = isHost ? (canStart ? '' : 'Waiting for at least one friend…') : 'The host will start the game.';
    }

    // ---------- Main render ----------

    // fresh: the last action just happened (play its animation)
    update(game, mySeat, fresh) {
        const prev = this.game;
        this.game = game;
        this.mySeat = mySeat;
        const me = this.me;
        const act = fresh ? game.lastAction : null;

        // fly cards before the market re-renders, so we know where they came from
        if (act && (act.type === 'market' || act.type === 'deck')) this.flyCard(act);

        this.board.updateOwners(game.owner, act && act.type === 'claim' ? act.routeId : null);

        this.renderTurn();
        this.renderPlayers();
        this.renderMarket(act);
        this.renderHand();
        this.renderTickets();
        this.renderLog();
        this.renderClaimable();
        this.renderTicketChoice(false);

        $('final-banner').hidden = game.turnsLeft === null || game.phase === 'GAME_OVER';

        if (act) this.playEffects(act, prev);

        // your turn nudge
        if (prev && fresh && game.phase === 'TURN' && game.turnIndex === mySeat &&
            (prev.turnIndex !== mySeat || prev.phase === 'SETUP_TICKETS')) {
            setTimeout(() => { this.toast('🚂 Your turn!'); sound.yourTurn(); }, act && act.type === 'claim' ? 900 : 250);
        }

        if (game.phase === 'GAME_OVER') this.showResults(fresh);
        else this.close('results');

        if (!this.isMyTurn()) this.closeClaim();
        if (this.hoverRoute !== null) this.showTip(this.hoverRoute, this.lastHoverEvent);
    }

    playEffects(act, prev) {
        if (act.type === 'claim') {
            const r = MAP.routes[act.routeId];
            this.board.floatText(act.routeId, `+${act.points}`, PLAYER_STYLE[act.player].light);
            setTimeout(() => this.board.shake(), r.length * 90 + 250);
            sound.claim(r.length);
            if (act.player === this.mySeat) this.checkTicketsDone(r.length * 90 + 500);
        } else if (act.type === 'tickets_kept') {
            sound.card();
        }
        if (act.finalRound) {
            setTimeout(() => { this.toast('⏰ Final round!'); sound.whistle(); }, 1000);
        }
    }

    checkTicketsDone(delay) {
        const me = this.me;
        if (!me || !me.tickets) return;
        me.tickets.forEach(id => {
            if (this.doneTickets.has(id)) return;
            if (this.game.ticketDone(me.id, id)) {
                this.doneTickets.add(id);
                const t = MAP.tickets[id];
                setTimeout(() => {
                    this.toast(`🎫 Ticket done: ${this.game.cities[t.a].name} → ${this.game.cities[t.b].name} (+${t.points})`);
                    sound.ticket();
                }, delay);
            }
        });
    }

    renderTurn() {
        const g = this.game;
        const pill = $('turn-pill');
        const cur = g.players[g.turnIndex];
        let text = '';
        const mine = g.turnIndex === this.mySeat;
        if (g.phase === 'SETUP_TICKETS') {
            const waiting = g.players.filter(p => p.choosing).map(p => p.name);
            text = this.me && this.me.choosing ? 'Pick your starting tickets' : `Waiting for ${waiting.join(', ')} to pick tickets…`;
        } else if (g.phase === 'GAME_OVER') {
            text = `${g.players[g.winnerId].name} wins!`;
        } else if (mine) {
            if (g.phase === 'CHOOSE_TICKETS') text = 'Choose which tickets to keep';
            else if (g.drawnThisTurn === 1) text = 'Your turn — take one more card';
            else text = 'Your turn — draw cards, claim a route or take tickets';
        } else {
            text = g.phase === 'CHOOSE_TICKETS' ? `${cur.name} is choosing tickets…` : `${cur.name}'s turn`;
        }
        $('turn-text').textContent = text;
        pill.classList.toggle('mine', mine && g.phase !== 'SETUP_TICKETS' && g.phase !== 'GAME_OVER');
        $('turn-dot').style.background = g.phase === 'SETUP_TICKETS' ? '#94a3b8' : PLAYER_STYLE[g.turnIndex].fill;
    }

    renderPlayers() {
        const g = this.game;
        $('players').innerHTML = g.players.map(p => {
            const style = PLAYER_STYLE[p.id];
            const turn = g.phase !== 'SETUP_TICKETS' && g.phase !== 'GAME_OVER' && p.id === g.turnIndex;
            const bump = this.prevScores[p.id] !== undefined && this.prevScores[p.id] !== p.routePoints;
            return `
            <div class="prow ${turn ? 'turn' : ''} ${p.online ? '' : 'offline'}" style="--pc:${style.fill}" data-player="${p.id}">
                <span class="avatar">${esc(p.name.slice(0, 1).toUpperCase())}</span>
                <div>
                    <div class="pname">${esc(p.name)}${p.id === this.mySeat ? ' <span class="tag">you</span>' : ''}${p.online ? '' : ' <span class="tag">away</span>'}</div>
                    <div class="pstats"><span title="Trains left">🚃 ${p.trains}</span><span title="Cards">🃏 ${g.handSize(p)}</span><span title="Tickets">🎫 ${p.tickets ? p.tickets.length : p.ticketCount}</span></div>
                </div>
                <span class="pscore ${bump ? 'bump' : ''}" title="Route points">${p.routePoints}</span>
            </div>`;
        }).join('');
        g.players.forEach(p => { this.prevScores[p.id] = p.routePoints; });
    }

    cardHTML(color, extra = '', attrs = '') {
        const st = CARD_STYLE[color];
        const style = color === LOCO ? `--ink:#fff;--d:#334155` : `--c:${st.fill};--d:${st.dark};--ink:${st.ink}`;
        return `<button type="button" class="tcard ${color === LOCO ? 'loco' : ''} ${extra}" style="${style}" ${attrs} title="${st.name}">${TRAIN_ICON}</button>`;
    }

    renderMarket(act) {
        const g = this.game;
        const live = this.isMyTurn();
        $('market').classList.toggle('live', live);
        $('market').innerHTML = g.market.map((c, i) => {
            if (!c) return `<button type="button" class="tcard empty" disabled></button>`;
            const blocked = !live || (c === LOCO && g.drawnThisTurn > 0);
            const fresh = act && act.type === 'market' && act.slot === i;
            return this.cardHTML(c, fresh ? 'deal' : '', `data-slot="${i}" ${blocked ? 'disabled' : ''}`);
        }).join('');
        $('deck-count').textContent = g.deck.length;
        $('ticket-count').textContent = g.ticketDeck.length;
        $('deck').disabled = !live || g.deck.length + g.discard.length === 0;
        $('ticket-pile').disabled = !live || g.drawnThisTurn > 0 || g.ticketDeck.length === 0;
        $('draw-hint').textContent = live ? (g.drawnThisTurn === 1 ? '1 more card' : '') : '';
        $('btn-pass').hidden = !(this.mySeat !== null && g.canPass && this.isMyTurn() && g.canPass(this.mySeat));
    }

    renderHand() {
        const me = this.me;
        if (!me || !me.hand) { $('hand').innerHTML = ''; return; }
        $('tray-title').textContent = `${me.name}'s hand`;
        $('my-trains').textContent = me.trains;
        const order = [LOCO, ...CARD_COLORS];
        const html = order.filter(c => me.hand[c] > 0).map(c => {
            const n = me.hand[c];
            const bump = this.prevHand[c] !== undefined && this.prevHand[c] !== n;
            const stack = n >= 3 ? 'stack2' : n === 2 ? 'stack1' : '';
            return this.cardHTML(c, stack, `data-color="${c}" tabindex="-1"`).replace('</button>', `<span class="count ${bump ? 'bump' : ''}">${n}</span></button>`);
        }).join('');
        $('hand').innerHTML = html || '<span class="hand-empty">No cards yet — take some from the station.</span>';
        this.prevHand = { ...me.hand };
        this.liftForRoute(this.hoverRoute);
    }

    renderTickets() {
        const me = this.me;
        if (!me || !me.tickets) { $('my-tickets').innerHTML = ''; return; }
        $('my-tickets').innerHTML = me.tickets.map(id => {
            const t = MAP.tickets[id];
            const done = this.game.ticketDone(me.id, id);
            if (done) this.doneTickets.add(id);
            return `<div class="mini-ticket ${t.long ? 'long' : ''} ${done ? 'done' : ''}" data-ticket="${id}">
                <span class="tk-done">${done ? '✅' : ''}</span>
                <span class="tk-cities">${esc(this.game.cities[t.a].name)}<br>→ ${esc(this.game.cities[t.b].name)}</span>
                <span class="tk-pts">${t.points}</span>
            </div>`;
        }).join('');
    }

    renderLog() {
        $('log').innerHTML = this.game.logs.slice(0, 30).map(l => `<div>${esc(l)}</div>`).join('');
    }

    renderClaimable() {
        const g = this.game;
        const ok = [], blocked = [];
        MAP.routes.forEach(r => {
            if (g.owner[r.id] !== undefined) return;
            if (this.mySeat === null || g.phase === 'SETUP_TICKETS') return;
            const why = g.routeBlocked(this.mySeat, r.id);
            if (why && why !== 'Not enough trains left.') blocked.push(r.id);
            else if (!why && this.isMyTurn() && g.drawnThisTurn === 0 && this.me.hand && g.paymentOptions(this.mySeat, r.id).length) ok.push(r.id);
        });
        this.board.markClaimable(ok);
        this.board.markBlocked(blocked);
    }

    // ---------- Tickets ----------

    miniMap(t) {
        const a = this.game.cities[t.a], b = this.game.cities[t.b];
        const dots = MAP.cities.map(c => `<circle cx="${c.x}" cy="${c.y}" r="7" fill="#475569"/>`).join('');
        return `<svg viewBox="0 0 ${MAP.width} ${MAP.height}"><path d="${this.landPath}" fill="#cfe3a6"/>${dots}
            <line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#ea580c" stroke-width="10" stroke-dasharray="22 14" stroke-linecap="round"/>
            <circle cx="${a.x}" cy="${a.y}" r="20" fill="#ea580c" stroke="#fff" stroke-width="6"/>
            <circle cx="${b.x}" cy="${b.y}" r="20" fill="#ea580c" stroke="#fff" stroke-width="6"/></svg>`;
    }

    renderTicketChoice(force) {
        const g = this.game;
        const me = this.me;
        const show = me && me.pendingTickets && me.pendingTickets.length > 0 &&
            (g.phase === 'SETUP_TICKETS' || (g.phase === 'CHOOSE_TICKETS' && g.turnIndex === this.mySeat));
        if (!show) {
            this.close('ticket-choice');
            this.ticketKey = '';
            return;
        }
        const key = me.pendingTickets.join(',');
        if (key !== this.ticketKey) {
            this.ticketKey = key;
            this.ticketSel = new Set();
            force = true;
        }
        const min = g.phase === 'SETUP_TICKETS' ? 2 : 1;
        $('ticket-choice-title').textContent = g.phase === 'SETUP_TICKETS' ? 'Pick your starting tickets' : 'New tickets';
        $('ticket-choice-sub').textContent = `Keep at least ${min}. Finished tickets add their points at the end; unfinished ones subtract them.`;
        if (force) {
            $('ticket-options').innerHTML = me.pendingTickets.map((id, i) => {
                const t = MAP.tickets[id];
                const on = this.ticketSel.has(id);
                return `<button type="button" class="tk-option ${t.long ? 'long' : ''} ${on ? 'on' : ''}" data-ticket="${id}" style="animation-delay:${i * 80}ms">
                    <div class="tk-kind">${t.long ? 'Long haul' : 'Ticket'}</div>
                    <div class="tk-top"><span>${esc(g.cities[t.a].name)} → ${esc(g.cities[t.b].name)}</span><span>${t.points}</span></div>
                    ${this.miniMap(t)}
                    <div class="tk-check">${on ? '✅ Keeping' : 'Tap to keep'}</div>
                </button>`;
            }).join('');
            // only animate the first time they appear
            if (this.ticketsShown === key) $('ticket-options').querySelectorAll('.tk-option').forEach(el => { el.style.animation = 'none'; });
            this.ticketsShown = key;
        }
        $('btn-keep-tickets').disabled = this.ticketSel.size < min;
        $('btn-keep-tickets').textContent = this.ticketSel.size ? `Keep ${this.ticketSel.size} ticket${this.ticketSel.size > 1 ? 's' : ''}` : 'Keep';
        this.open('ticket-choice');
    }

    // ---------- Routes ----------

    routeInfo(id) {
        const g = this.game;
        const r = MAP.routes[id];
        const owner = g.owner[id];
        const color = CARD_STYLE[r.color].name;
        let line = `<b>${esc(g.cities[r.a].name)} – ${esc(g.cities[r.b].name)}</b><br>${r.length} car${r.length > 1 ? 's' : ''} · ${color} · +${ROUTE_POINTS[r.length]} pts`;
        if (owner !== undefined) line += `<br>Owned by ${esc(g.players[owner].name)}`;
        else if (this.mySeat !== null && g.phase !== 'SETUP_TICKETS') {
            const why = g.routeBlocked(this.mySeat, id);
            if (why) line += `<br><span class="tip-warn">${esc(why)}</span>`;
            else if (this.me.hand && !g.paymentOptions(this.mySeat, id).length) line += `<br><span class="tip-warn">${esc(this.needText(r))}</span>`;
        }
        return line;
    }

    needText(r) {
        const h = this.me.hand;
        if (r.color === 'grey') {
            const best = Math.max(...CARD_COLORS.map(c => h[c]));
            return `Need ${r.length} of one color (best: ${best} + ${h[LOCO]} wild)`;
        }
        return `Need ${r.length} ${CARD_STYLE[r.color].name.toLowerCase()} (you have ${h[r.color]} + ${h[LOCO]} wild)`;
    }

    hoverRouteAt(id, e) {
        this.hoverRoute = id;
        this.lastHoverEvent = e;
        this.liftForRoute(id);
        if (id === null) { $('route-tip').hidden = true; return; }
        this.showTip(id, e);
    }

    showTip(id, e) {
        if (!this.game || !e) return;
        const wrap = $('board-wrap').getBoundingClientRect();
        const tip = $('route-tip');
        tip.innerHTML = this.routeInfo(id);
        tip.hidden = false;
        const x = Math.min(Math.max(e.clientX - wrap.left, 110), wrap.width - 110);
        tip.style.left = `${x}px`;
        tip.style.top = `${Math.max(e.clientY - wrap.top, 80)}px`;
    }

    // lift the cards in hand that could pay for the hovered route
    liftForRoute(id) {
        document.querySelectorAll('#hand .tcard').forEach(el => el.classList.remove('lift'));
        if (id === null || id === undefined || !this.me || !this.me.hand) return;
        const r = MAP.routes[id];
        document.querySelectorAll('#hand .tcard').forEach(el => {
            const c = el.dataset.color;
            if (c === LOCO || c === r.color || r.color === 'grey') el.classList.add('lift');
        });
    }

    clickRoute(id) {
        const g = this.game;
        if (!g || this.mySeat === null) return;
        $('route-tip').hidden = true;
        if (!this.isMyTurn() || g.drawnThisTurn > 0 || g.owner[id] !== undefined) {
            if (this.isMyTurn() && g.drawnThisTurn > 0) this.toast('Take your second card first');
            return;
        }
        const why = g.routeBlocked(this.mySeat, id);
        const options = why ? [] : g.paymentOptions(this.mySeat, id);
        const r = MAP.routes[id];

        if (!why && options.length === 1) {
            // one way to pay: claim right away
            this.claim(id, options[0]);
            return;
        }
        this.board.selectRoute(id);
        $('claim-title').textContent = `${g.cities[r.a].name} – ${g.cities[r.b].name}`;
        $('claim-meta').innerHTML = `${r.length} car${r.length > 1 ? 's' : ''} · ${esc(CARD_STYLE[r.color].name)} · <b>+${ROUTE_POINTS[r.length]} pts</b>`;
        if (why || !options.length) {
            $('claim-options').innerHTML = `<div class="claim-warn">${esc(why || this.needText(r))}</div>`;
            sound.error();
        } else {
            $('claim-options').innerHTML = options.map((o, i) => {
                const chips = [];
                for (let k = 0; k < o.colorCount; k++) chips.push(`<span class="chip" style="background:${CARD_STYLE[o.color].fill}"></span>`);
                for (let k = 0; k < o.locos; k++) chips.push(`<span class="chip" style="background:${CARD_STYLE.loco.css}"></span>`);
                const label = o.colorCount ? `${o.colorCount} ${CARD_STYLE[o.color].name.toLowerCase()}${o.locos ? ` + ${o.locos} wild` : ''}` : `${o.locos} wild`;
                return `<button type="button" class="pay-btn" data-opt="${i}">${chips.join('')}<span>${label}</span><span class="go">Build →</span></button>`;
            }).join('');
            $('claim-options').querySelectorAll('[data-opt]').forEach(b =>
                b.addEventListener('click', () => this.claim(id, options[Number(b.dataset.opt)])));
        }
        const pop = $('claim');
        pop.hidden = false;
        const p = this.board.routeScreenPoint(id);
        const w = 310;
        pop.style.left = `${Math.min(Math.max(p.x - w / 2, 10), window.innerWidth - w - 10)}px`;
        pop.style.top = `${Math.min(p.y + 18, window.innerHeight - 260)}px`;
    }

    claim(id, opt) {
        this.closeClaim();
        this.onAction('claim', { routeId: id, payment: opt });
    }

    closeClaim() {
        $('claim').hidden = true;
        this.board.selectRoute(null);
    }

    // ---------- Flying cards ----------

    flyCard(act) {
        let from;
        if (act.type === 'market') {
            from = $('market').querySelector(`[data-slot="${act.slot}"]`) || $('market').children[act.slot];
        } else {
            from = $('deck');
        }
        const to = act.player === this.mySeat
            ? ($('hand').querySelector(`[data-color="${act.card}"]`) || $('hand'))
            : document.querySelector(`.prow[data-player="${act.player}"] .avatar`);
        if (!from || !to) return;
        const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
        const color = act.card || null;
        const el = document.createElement('div');
        el.innerHTML = color ? this.cardHTML(color) : `<div class="tcard" style="--c:#1e3a8a;--d:#312e81">${TRAIN_ICON}</div>`;
        const card = el.firstElementChild;
        card.classList.add('fly');
        card.style.left = `${a.left}px`;
        card.style.top = `${a.top}px`;
        card.style.width = `${a.width}px`;
        card.style.height = `${a.height}px`;
        document.body.appendChild(card);
        const dx = b.left + b.width / 2 - (a.left + a.width / 2);
        const dy = b.top + b.height / 2 - (a.top + a.height / 2);
        requestAnimationFrame(() => {
            card.style.transform = `translate(${dx}px, ${dy}px) rotate(${act.player === this.mySeat ? -8 : 0}deg) scale(${act.player === this.mySeat ? 1.1 : 0.4})`;
            card.style.opacity = act.player === this.mySeat ? '1' : '0.2';
        });
        setTimeout(() => card.remove(), 650);
        sound.card();
    }

    // ---------- Game over ----------

    showResults(fresh) {
        const g = this.game;
        if (!g.final) return;
        const ranked = [...g.final].sort((a, b) => b.total - a.total || b.ticketsDone.length - a.ticketsDone.length || b.longest - a.longest);
        $('results-title').textContent = `${g.players[g.winnerId].name} wins!`;
        $('results-table').innerHTML = ranked.map((f, i) => {
            const p = g.players[f.id];
            return `<div class="res-row ${f.id === g.winnerId ? 'win' : ''}" style="--pc:${PLAYER_STYLE[f.id].fill};animation-delay:${i * 150}ms">
                <span class="res-rank">${i + 1}</span>
                <div>
                    <div class="res-name">${esc(p.name)}${f.id === this.mySeat ? ' (you)' : ''}</div>
                    <div class="res-break">Routes ${f.routes} · <span class="pos">Tickets +${f.ticketPlus} (${f.ticketsDone.length})</span> · <span class="neg">−${f.ticketMinus} (${f.ticketsFailed.length})</span>${f.bonus ? ` · 🛤️ Longest line +${f.bonus}` : ''} · line ${f.longest}</div>
                </div>
                <span class="res-total">${f.total}</span>
            </div>`;
        }).join('');
        $('btn-again').hidden = this.mySeat !== 0;
        $('results-wait').textContent = this.mySeat === 0 ? '' : 'The host can start a new game.';
        if (!$('results').classList.contains('show')) {
            this.open('results');
            if (fresh || !this.confettiDone) {
                this.confettiDone = true;
                sound.fanfare();
                this.confetti();
            }
        }
    }

    confetti() {
        const c = $('confetti');
        const ctx = c.getContext('2d');
        const W = c.width = innerWidth * devicePixelRatio, H = c.height = innerHeight * devicePixelRatio;
        const colors = ['#f43f5e', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#facc15'];
        const bits = Array.from({ length: 180 }, () => ({
            x: Math.random() * W, y: -Math.random() * H * 0.5, r: (4 + Math.random() * 6) * devicePixelRatio,
            vx: (Math.random() - 0.5) * 4, vy: (2 + Math.random() * 4) * devicePixelRatio, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3,
            color: colors[Math.floor(Math.random() * colors.length)]
        }));
        const start = performance.now();
        const frame = now => {
            ctx.clearRect(0, 0, W, H);
            bits.forEach(b => {
                b.x += b.vx; b.y += b.vy; b.a += b.va; b.vy += 0.03 * devicePixelRatio;
                ctx.save();
                ctx.translate(b.x, b.y);
                ctx.rotate(b.a);
                ctx.fillStyle = b.color;
                ctx.fillRect(-b.r, -b.r / 2, b.r * 2, b.r);
                ctx.restore();
            });
            if (now - start < 4500) requestAnimationFrame(frame);
            else ctx.clearRect(0, 0, W, H);
        };
        requestAnimationFrame(frame);
    }
}

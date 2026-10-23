// Rail Rivals - game state and rules
//
// The host's browser owns the real game. Every move goes through one of the
// action methods below; each returns false when the move isn't allowed.
// toState(seat) gives one player's view (other hands and tickets hidden).

class RailGame {
    constructor(playerNames = []) {
        this.cities = Object.fromEntries(MAP.cities.map(c => [c.id, c]));
        this.routes = MAP.routes;
        this.ticketInfo = MAP.tickets;

        this.players = playerNames.map((name, i) => ({
            id: i,
            name,
            hand: Object.fromEntries([...CARD_COLORS, LOCO].map(c => [c, 0])),
            tickets: [],
            pendingTickets: [],
            trains: START_TRAINS,
            routePoints: 0,
            stations: STATIONS,
            online: true
        }));

        this.owner = {};              // routeId -> playerId
        this.stationsAt = {};         // cityId -> playerId
        this.deck = [];
        this.discard = [];
        this.market = [];
        this.ticketDeck = [];
        this.turnIndex = 0;
        this.phase = 'SETUP_TICKETS'; // SETUP_TICKETS | TURN | CHOOSE_TICKETS | GAME_OVER
        this.drawnThisTurn = 0;
        this.turnsLeft = null;        // set when the final round starts
        this.final = null;            // end-of-game scores
        this.logs = [];
        this.lastAction = null;       // { type, player, ... } for animations

        if (this.players.length) this.setup();
    }

    log(msg) {
        this.logs.unshift(msg);
        if (this.logs.length > 60) this.logs.pop();
    }

    get current() { return this.players[this.turnIndex]; }

    // ---------- Setup ----------

    setup() {
        const cards = [];
        CARD_COLORS.forEach(c => { for (let i = 0; i < CARDS_PER_COLOR; i++) cards.push(c); });
        for (let i = 0; i < LOCO_CARDS; i++) cards.push(LOCO);
        this.deck = shuffled(cards);

        const regular = shuffled(this.ticketInfo.filter(t => !t.long).map(t => t.id));
        const long = shuffled(this.ticketInfo.filter(t => t.long).map(t => t.id));

        this.players.forEach(p => {
            for (let i = 0; i < START_CARDS; i++) p.hand[this.deck.pop()]++;
            // one long ticket and three regular ones; keep at least two
            p.pendingTickets = [long.pop(), regular.pop(), regular.pop(), regular.pop()];
        });
        this.ticketDeck = regular;   // unused long tickets leave the game
        this.refillMarket();
        this.log('🎫 Everyone picks their starting tickets (keep at least 2).');
    }

    // ---------- Cards ----------

    drawCard() {
        if (this.deck.length === 0 && this.discard.length > 0) {
            this.deck = shuffled(this.discard);
            this.discard = [];
            this.log('🔀 The discard pile was shuffled into a new deck.');
        }
        return this.deck.pop() || null;
    }

    // Fill empty market slots. Three or more wild cards face up means the
    // whole row is replaced (unless the cards left can't fix it).
    refillMarket() {
        for (let attempt = 0; attempt < 5; attempt++) {
            for (let i = 0; i < MARKET_SIZE; i++) {
                if (!this.market[i]) this.market[i] = this.drawCard();
            }
            const locos = this.market.filter(c => c === LOCO).length;
            const nonLocoLeft = [...this.deck, ...this.discard].filter(c => c !== LOCO).length;
            if (locos < 3 || nonLocoLeft < 3) return;
            this.log('🌈 Three wild cards face up: the row is replaced.');
            this.market.forEach(c => { if (c) this.discard.push(c); });
            this.market = [];
        }
    }

    // Can the current player take a second card at all?
    canDrawSecond() {
        if (this.deck.length + this.discard.length > 0) return true;
        return this.market.some(c => c && c !== LOCO);
    }

    takeFromMarket(playerId, slot) {
        if (this.phase !== 'TURN' || playerId !== this.turnIndex) return false;
        const card = this.market[slot];
        if (!card) return false;
        if (card === LOCO && this.drawnThisTurn > 0) return false;

        const p = this.current;
        p.hand[card]++;
        this.market[slot] = null;
        this.refillMarket();
        this.passesInARow = 0;
        this.lastAction = { type: 'market', player: p.id, slot, card };

        if (card === LOCO) {
            this.log(`🌈 ${p.name} took a wild card from the row.`);
            this.endTurn();
        } else {
            this.log(`🃏 ${p.name} took a ${CARD_STYLE[card].name.toLowerCase()} card.`);
            this.afterDraw();
        }
        return true;
    }

    takeFromDeck(playerId) {
        if (this.phase !== 'TURN' || playerId !== this.turnIndex) return false;
        const card = this.drawCard();
        if (!card) return false;
        const p = this.current;
        p.hand[card]++;
        this.passesInARow = 0;
        this.lastAction = { type: 'deck', player: p.id, card };
        this.log(`🂠 ${p.name} drew from the deck.`);
        this.afterDraw();
        return true;
    }

    afterDraw() {
        this.drawnThisTurn++;
        if (this.drawnThisTurn >= 2 || !this.canDrawSecond()) this.endTurn();
    }

    // ---------- Routes ----------

    twinOf(route) {
        if (route.lane === null || route.lane === undefined) return null;
        return this.routes.find(r => r.id !== route.id && r.a === route.a && r.b === route.b) || null;
    }

    // Why a route can't be claimed by this player right now ('' if it can,
    // ignoring the cards in hand)
    routeBlocked(playerId, routeId) {
        const route = this.routes[routeId];
        if (!route) return 'No such route.';
        if (this.owner[routeId] !== undefined) return 'Already taken.';
        const twin = this.twinOf(route);
        if (twin && this.owner[twin.id] !== undefined) {
            if (this.owner[twin.id] === playerId) return 'You already own the other track.';
            if (this.players.length <= 3) return 'With 2–3 players only one track of a double route is used.';
        }
        if (this.players[playerId].trains < route.length) return 'Not enough trains left.';
        return '';
    }

    // Every way the player could pay for a route: [{ color, colorCount, locos }]
    paymentOptions(playerId, routeId) {
        const route = this.routes[routeId];
        const hand = this.players[playerId].hand;
        const colors = route.color === 'grey' ? CARD_COLORS : [route.color];
        const options = [];
        colors.forEach(color => {
            const have = hand[color] || 0;
            for (let use = Math.min(have, route.length); use >= 0; use--) {
                const locos = route.length - use;
                if (locos <= hand[LOCO] && (use > 0 || color === colors[0])) {
                    options.push({ color, colorCount: use, locos });
                }
            }
        });
        // only wilds: list it once
        const seen = new Set();
        return options.filter(o => {
            const key = o.colorCount === 0 ? 'wild' : `${o.color}:${o.colorCount}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    claimRoute(playerId, routeId, payment) {
        if (this.phase !== 'TURN' || playerId !== this.turnIndex || this.drawnThisTurn > 0) return false;
        if (this.routeBlocked(playerId, routeId)) return false;
        const route = this.routes[routeId];
        const p = this.current;

        const color = payment && payment.color;
        const colorCount = Math.floor(Number(payment && payment.colorCount) || 0);
        const locos = Math.floor(Number(payment && payment.locos) || 0);
        if (!CARD_COLORS.includes(color) || colorCount < 0 || locos < 0) return false;
        if (colorCount + locos !== route.length) return false;
        if (route.color !== 'grey' && colorCount > 0 && color !== route.color) return false;
        if (p.hand[color] < colorCount || p.hand[LOCO] < locos) return false;

        p.hand[color] -= colorCount;
        p.hand[LOCO] -= locos;
        for (let i = 0; i < colorCount; i++) this.discard.push(color);
        for (let i = 0; i < locos; i++) this.discard.push(LOCO);

        this.owner[routeId] = p.id;
        p.trains -= route.length;
        const pts = ROUTE_POINTS[route.length];
        p.routePoints += pts;
        this.passesInARow = 0;
        this.lastAction = { type: 'claim', player: p.id, routeId, points: pts };
        this.log(`🚂 ${p.name} claimed ${this.cities[route.a].name} – ${this.cities[route.b].name} (+${pts}).`);
        this.endTurn();
        return true;
    }

    // ---------- Stations ----------
    // A station on a city lets its owner use one opponent route out of that
    // city for their tickets at the end. The 1st costs 1 card, the 2nd 2 of
    // one color, the 3rd 3 of one color (wilds fill in).

    stationCost(playerId) {
        return STATIONS - this.players[playerId].stations + 1;
    }

    stationBlocked(playerId, cityId) {
        if (!this.cities[cityId]) return 'No such city.';
        if (this.stationsAt[cityId] !== undefined) return 'This city already has a station.';
        if (this.players[playerId].stations <= 0) return 'You have no stations left.';
        return '';
    }

    stationPaymentOptions(playerId) {
        const p = this.players[playerId];
        if (!p.hand || p.stations <= 0) return [];
        const n = this.stationCost(playerId);
        const options = [];
        CARD_COLORS.forEach(color => {
            for (let use = Math.min(p.hand[color], n); use >= 1; use--) {
                if (n - use <= p.hand[LOCO]) options.push({ color, colorCount: use, locos: n - use });
            }
        });
        if (p.hand[LOCO] >= n) options.push({ color: CARD_COLORS[0], colorCount: 0, locos: n });
        return options;
    }

    buildStation(playerId, cityId, payment) {
        if (this.phase !== 'TURN' || playerId !== this.turnIndex || this.drawnThisTurn > 0) return false;
        if (this.stationBlocked(playerId, cityId)) return false;
        const p = this.current;
        const n = this.stationCost(playerId);
        const color = payment && payment.color;
        const colorCount = Math.floor(Number(payment && payment.colorCount) || 0);
        const locos = Math.floor(Number(payment && payment.locos) || 0);
        if (!CARD_COLORS.includes(color) || colorCount < 0 || locos < 0 || colorCount + locos !== n) return false;
        if (p.hand[color] < colorCount || p.hand[LOCO] < locos) return false;

        p.hand[color] -= colorCount;
        p.hand[LOCO] -= locos;
        for (let i = 0; i < colorCount; i++) this.discard.push(color);
        for (let i = 0; i < locos; i++) this.discard.push(LOCO);

        p.stations--;
        this.stationsAt[cityId] = p.id;
        this.passesInARow = 0;
        this.lastAction = { type: 'station', player: p.id, city: cityId };
        this.log(`🚉 ${p.name} built a station in ${this.cities[cityId].name}.`);
        this.endTurn();
        return true;
    }

    // ---------- Tickets ----------

    drawTickets(playerId) {
        if (this.phase !== 'TURN' || playerId !== this.turnIndex || this.drawnThisTurn > 0) return false;
        if (this.ticketDeck.length === 0) return false;
        const p = this.current;
        p.pendingTickets = this.ticketDeck.splice(-3).reverse();
        this.phase = 'CHOOSE_TICKETS';
        this.passesInARow = 0;
        this.lastAction = { type: 'tickets_drawn', player: p.id };
        this.log(`🎫 ${p.name} is looking at new tickets.`);
        return true;
    }

    keepTickets(playerId, ids) {
        const p = this.players[playerId];
        if (!p || !p.pendingTickets.length) return false;
        const setup = this.phase === 'SETUP_TICKETS';
        if (!setup && !(this.phase === 'CHOOSE_TICKETS' && playerId === this.turnIndex)) return false;

        const keep = [...new Set(ids)].filter(id => p.pendingTickets.includes(id));
        if (keep.length < (setup ? 2 : 1)) return false;

        const returned = p.pendingTickets.filter(id => !keep.includes(id));
        p.tickets.push(...keep);
        p.pendingTickets = [];
        // returned tickets go under the pile; long ones leave the game
        returned.filter(id => !this.ticketInfo[id].long).forEach(id => this.ticketDeck.unshift(id));
        this.lastAction = { type: 'tickets_kept', player: p.id, count: keep.length };
        this.log(`🎫 ${p.name} kept ${keep.length} ticket${keep.length > 1 ? 's' : ''}.`);

        if (setup) {
            if (this.players.every(q => q.pendingTickets.length === 0)) {
                this.phase = 'TURN';
                this.turnIndex = 0;
                this.drawnThisTurn = 0;
                this.log(`🚦 All aboard! ${this.current.name} goes first.`);
            }
        } else {
            this.phase = 'TURN';
            this.endTurn();
        }
        return true;
    }

    // ---------- Turn flow ----------

    endTurn() {
        const p = this.current;
        this.drawnThisTurn = 0;

        if (this.turnsLeft !== null) {
            this.turnsLeft--;
            if (this.turnsLeft <= 0) {
                this.finishGame();
                return;
            }
        } else if (p.trains <= FINAL_ROUND_AT) {
            this.turnsLeft = this.players.length;
            this.log(`⏰ ${p.name} has ${p.trains} train${p.trains === 1 ? '' : 's'} left: everyone gets one last turn!`);
            this.lastAction = { ...(this.lastAction || {}), finalRound: true };
        }

        this.phase = 'TURN';
        this.turnIndex = (this.turnIndex + 1) % this.players.length;
    }

    // A player who has gone offline can't block the game: in setup we keep
    // their first two tickets; on their turn, the host can skip them.
    autoKeepTickets(playerId) {
        const p = this.players[playerId];
        if (!p.pendingTickets.length) return false;
        const n = this.phase === 'SETUP_TICKETS' ? 2 : 1;
        return this.keepTickets(playerId, p.pendingTickets.slice(0, n));
    }

    // No cards left to take and no route you can pay for: you may pass.
    // (Nobody is forced to take tickets or build stations just to move.)
    canPass(playerId) {
        if (this.phase !== 'TURN' || playerId !== this.turnIndex) return false;
        if (this.deck.length + this.discard.length > 0) return false;
        if (this.market.some(c => c && (c !== LOCO || this.drawnThisTurn === 0))) return false;
        if (this.drawnThisTurn > 0) return true;
        return !this.routes.some(r =>
            !this.routeBlocked(playerId, r.id) && this.paymentOptions(playerId, r.id).length > 0);
    }

    pass(playerId) {
        if (!this.canPass(playerId)) return false;
        this.log(`⏭️ ${this.current.name} had nothing to do and passed.`);
        this.lastAction = { type: 'skip', player: playerId };
        this.passesInARow = (this.passesInARow || 0) + 1;
        // nobody can do anything any more: the game ends here
        if (this.passesInARow >= this.players.length) {
            this.log('🛑 Nobody can move any more, so the game ends.');
            this.finishGame();
            return true;
        }
        this.endTurn();
        return true;
    }

    skipTurn(playerId) {
        if (playerId !== this.turnIndex || this.phase === 'GAME_OVER') return false;
        if (this.phase === 'CHOOSE_TICKETS') return this.autoKeepTickets(playerId);
        this.log(`⏭️ ${this.current.name} is away, so their turn was skipped.`);
        this.lastAction = { type: 'skip', player: playerId };
        this.endTurn();
        return true;
    }

    // ---------- Scoring ----------

    playerRoutes(playerId) {
        return this.routes.filter(r => this.owner[r.id] === playerId);
    }

    // extra: opponent routes this player may use through their stations
    ticketDone(playerId, ticketId, extra = []) {
        const t = this.ticketInfo[ticketId];
        const parent = {};
        const find = x => (parent[x] === undefined || parent[x] === x ? (parent[x] = x) : (parent[x] = find(parent[x])));
        [...this.playerRoutes(playerId), ...extra].forEach(r => { parent[find(r.a)] = find(r.b); });
        return find(t.a) === find(t.b);
    }

    // Each station borrows at most one opponent route touching its city.
    // Try every choice (at most a few hundred) and keep the one that scores
    // the most ticket points.
    bestStationUse(playerId) {
        const p = this.players[playerId];
        const tickets = p.tickets || [];
        const mine = Object.keys(this.stationsAt).filter(c => this.stationsAt[c] === playerId);
        const choices = mine.map(city => [null, ...this.routes.filter(r =>
            (r.a === city || r.b === city) && this.owner[r.id] !== undefined && this.owner[r.id] !== playerId)]);

        let best = null;
        const walk = (i, picked) => {
            if (i === choices.length) {
                const extra = picked.filter(Boolean);
                const done = tickets.filter(id => this.ticketDone(playerId, id, extra));
                const net = tickets.reduce((s, id) => s + (done.includes(id) ? 1 : -1) * this.ticketInfo[id].points, 0);
                if (!best || net > best.net || (net === best.net && extra.length < best.borrowed.length)) {
                    best = { done, net, borrowed: extra.map(x => x.id) };
                }
                return;
            }
            choices[i].forEach(c => walk(i + 1, [...picked, c]));
        };
        walk(0, []);
        return best;
    }

    // Longest continuous path; each route used once, cities may repeat
    longestPath(playerId) {
        const routes = this.playerRoutes(playerId);
        const adj = {};
        routes.forEach(r => {
            (adj[r.a] = adj[r.a] || []).push(r);
            (adj[r.b] = adj[r.b] || []).push(r);
        });
        let best = 0;
        const used = new Set();
        const dfs = (city, len) => {
            if (len > best) best = len;
            (adj[city] || []).forEach(r => {
                if (used.has(r.id)) return;
                used.add(r.id);
                dfs(r.a === city ? r.b : r.a, len + r.length);
                used.delete(r.id);
            });
        };
        Object.keys(adj).forEach(c => dfs(c, 0));
        return best;
    }

    finishGame() {
        const lengths = this.players.map(p => this.longestPath(p.id));
        const top = Math.max(...lengths);
        this.final = this.players.map(p => {
            const use = this.bestStationUse(p.id);
            const done = use.done;
            const failed = p.tickets.filter(id => !done.includes(id));
            const plus = done.reduce((s, id) => s + this.ticketInfo[id].points, 0);
            const minus = failed.reduce((s, id) => s + this.ticketInfo[id].points, 0);
            const bonus = top > 0 && lengths[p.id] === top ? LONGEST_ROUTE_BONUS : 0;
            const stationBonus = p.stations * STATION_POINTS;
            return {
                id: p.id,
                routes: p.routePoints,
                ticketsDone: done,
                ticketsFailed: failed,
                ticketPlus: plus,
                ticketMinus: minus,
                longest: lengths[p.id],
                bonus,
                stationBonus,
                stationsLeft: p.stations,
                borrowed: use.borrowed,
                total: p.routePoints + plus - minus + bonus + stationBonus
            };
        });
        // Winner: most points, then most tickets done, then longest route
        const ranked = [...this.final].sort((a, b) =>
            b.total - a.total || b.ticketsDone.length - a.ticketsDone.length || b.longest - a.longest);
        this.winnerId = ranked[0].id;
        this.phase = 'GAME_OVER';
        this.lastAction = { type: 'game_over' };
        this.log(`🏆 ${this.players[this.winnerId].name} wins with ${ranked[0].total} points!`);
    }

    // ---------- Online sync ----------

    toState(seat) {
        const over = this.phase === 'GAME_OVER';
        return {
            players: this.players.map(p => {
                const own = p.id === seat;
                return {
                    id: p.id,
                    name: p.name,
                    trains: p.trains,
                    routePoints: p.routePoints,
                    stations: p.stations,
                    online: p.online,
                    handCount: this.handSize(p),
                    ticketCount: p.tickets.length,
                    choosing: p.pendingTickets.length > 0,
                    hand: own ? { ...p.hand } : null,
                    tickets: own || over ? [...p.tickets] : null,
                    pendingTickets: own ? [...p.pendingTickets] : []
                };
            }),
            owner: { ...this.owner },
            stationsAt: { ...this.stationsAt },
            market: [...this.market],
            deckCount: this.deck.length,
            discardCount: this.discard.length,
            ticketDeckCount: this.ticketDeck.length,
            turnIndex: this.turnIndex,
            phase: this.phase,
            drawnThisTurn: this.drawnThisTurn,
            turnsLeft: this.turnsLeft,
            final: this.final,
            winnerId: over ? this.winnerId : null,
            logs: this.logs.slice(0, 40),
            // what other players may see of the last move (deck draws stay secret)
            lastAction: this.lastAction && this.lastAction.type === 'deck' && this.lastAction.player !== seat
                ? { type: 'deck', player: this.lastAction.player }
                : this.lastAction
        };
    }

    // Guest side: rebuild a read-only game from a host snapshot. Values are
    // checked and names are plain text, so a bad snapshot can't inject markup.
    static fromState(s) {
        const g = new RailGame([]);
        const int = v => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0);
        const cardOk = c => c === null || c === LOCO || CARD_COLORS.includes(c);
        const ticketIds = list => (Array.isArray(list) ? list.filter(id => Number.isInteger(id) && g.ticketInfo[id]) : []);

        g.players = (s.players || []).slice(0, MAX_PLAYERS).map((p, i) => ({
            id: i,
            name: String(p.name || `Player ${i + 1}`).slice(0, 16),
            trains: int(p.trains),
            routePoints: int(p.routePoints),
            stations: Math.min(STATIONS, int(p.stations)),
            online: p.online !== false,
            handCount: int(p.handCount),
            ticketCount: int(p.ticketCount),
            choosing: !!p.choosing,
            hand: p.hand ? Object.fromEntries([...CARD_COLORS, LOCO].map(c => [c, int(p.hand[c])])) : null,
            tickets: p.tickets ? ticketIds(p.tickets) : null,
            pendingTickets: ticketIds(p.pendingTickets)
        }));
        g.owner = {};
        Object.entries(s.owner || {}).forEach(([rid, pid]) => {
            if (g.routes[rid] && g.players[pid]) g.owner[rid] = pid;
        });
        g.stationsAt = {};
        Object.entries(s.stationsAt || {}).forEach(([cid, pid]) => {
            if (g.cities[cid] && g.players[pid]) g.stationsAt[cid] = pid;
        });
        g.market = (s.market || []).slice(0, MARKET_SIZE).map(c => (cardOk(c) ? c : null));
        g.deck = new Array(Math.min(200, int(s.deckCount))).fill(null);
        g.discard = new Array(Math.min(200, int(s.discardCount))).fill(null);
        g.ticketDeck = new Array(Math.min(60, int(s.ticketDeckCount))).fill(null);
        g.turnIndex = Math.min(int(s.turnIndex), Math.max(0, g.players.length - 1));
        g.phase = ['SETUP_TICKETS', 'TURN', 'CHOOSE_TICKETS', 'GAME_OVER'].includes(s.phase) ? s.phase : 'TURN';
        g.drawnThisTurn = int(s.drawnThisTurn);
        g.turnsLeft = s.turnsLeft === null ? null : int(s.turnsLeft);
        g.final = Array.isArray(s.final) ? s.final.map(f => ({
            id: int(f.id), routes: int(f.routes), ticketPlus: int(f.ticketPlus), ticketMinus: int(f.ticketMinus),
            longest: int(f.longest), bonus: int(f.bonus), total: Number(f.total) || 0,
            stationBonus: int(f.stationBonus), stationsLeft: int(f.stationsLeft),
            borrowed: Array.isArray(f.borrowed) ? f.borrowed.filter(id => Number.isInteger(id) && g.routes[id]) : [],
            ticketsDone: ticketIds(f.ticketsDone), ticketsFailed: ticketIds(f.ticketsFailed)
        })) : null;
        g.winnerId = s.winnerId === null || s.winnerId === undefined ? null : int(s.winnerId);
        g.logs = (s.logs || []).map(String);
        g.lastAction = s.lastAction && typeof s.lastAction === 'object' ? {
            type: String(s.lastAction.type || ''),
            player: int(s.lastAction.player),
            slot: int(s.lastAction.slot),
            card: cardOk(s.lastAction.card) ? s.lastAction.card : null,
            routeId: int(s.lastAction.routeId),
            city: g.cities[s.lastAction.city] ? s.lastAction.city : null,
            points: int(s.lastAction.points),
            count: int(s.lastAction.count),
            finalRound: !!s.lastAction.finalRound
        } : null;
        return g;
    }

    // Guests only know their own hand
    handSize(p) {
        if (!p.hand) return p.handCount || 0;
        return Object.values(p.hand).reduce((a, b) => a + b, 0);
    }
}

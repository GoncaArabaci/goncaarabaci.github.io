// Rule tests for Rail Rivals. Run from the repo root:
//   node games/railrivals/tests/rules-test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { console, Math, Set, Map, Array, Object, Number, String, JSON };
vm.createContext(ctx);
for (const f of ['map.js', 'config.js', 'rules.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'src', f), 'utf8'), ctx, { filename: f });
}
vm.runInContext('Object.assign(this, { RailGame, MAP, LOCO, CARD_COLORS, ROUTE_POINTS })', ctx);
const { RailGame, MAP, LOCO, CARD_COLORS, ROUTE_POINTS } = ctx;

const results = [];
const test = (name, fn) => {
    try { const r = fn(); results.push({ name, ok: r === true, info: r === true ? '' : r }); }
    catch (e) { results.push({ name, ok: false, info: 'crash: ' + e.stack.split('\n').slice(0, 3).join(' | ') }); }
};

const names = n => Array.from({ length: n }, (_, i) => 'P' + i);
const totalCards = g => g.deck.length + g.discard.length + g.market.filter(Boolean).length +
    (g.tunnel ? g.tunnel.paid.length + g.tunnel.revealed.length : 0) +
    g.players.reduce((s, p) => s + Object.values(p.hand).reduce((a, b) => a + b, 0), 0);
const started = (n = 3) => {
    const g = new RailGame(names(n));
    g.players.forEach(p => g.keepTickets(p.id, p.pendingTickets.slice(0, 2)));
    return g;
};
const emptyHand = p => Object.keys(p.hand).forEach(k => { p.hand[k] = 0; });
const plain = r => !r.tunnel && !r.ferry;
const colored = MAP.routes.find(r => plain(r) && r.color !== 'grey' && r.length === 3 && r.lane === null);
const grey = MAP.routes.find(r => plain(r) && r.color === 'grey' && r.length === 2);
const tunnel = MAP.routes.find(r => r.tunnel && r.color !== 'grey' && r.lane === null);
const ferry = MAP.routes.find(r => r.ferry > 0);
const twins = MAP.routes.filter(r => r.lane === 0);

// A simple player for whole random games
function playRandom(g, maxSteps = 4000) {
    for (let step = 0; step < maxSteps && g.phase !== 'GAME_OVER'; step++) {
        const p = g.current;
        if (g.phase === 'CHOOSE_TICKETS') { g.keepTickets(p.id, [p.pendingTickets[0]]); continue; }
        if (g.phase === 'TUNNEL') {
            const o = g.tunnelOptions(p.id)[0];
            if (!(o && Math.random() < 0.7 && g.payTunnel(p.id, o))) g.abandonTunnel(p.id);
            continue;
        }
        if (g.drawnThisTurn === 0 && Math.random() < 0.06) {
            const opt = g.stationPaymentOptions(p.id)[0];
            const city = MAP.cities.find(c => !g.stationBlocked(p.id, c.id));
            if (opt && city && g.buildStation(p.id, city.id, opt)) continue;
        }
        let claimed = false;
        if (g.drawnThisTurn === 0) {
            for (const r of MAP.routes) {
                if (g.routeBlocked(p.id, r.id)) continue;
                const opt = g.paymentOptions(p.id, r.id)[0];
                if (opt && g.claimRoute(p.id, r.id, opt)) { claimed = true; break; }
            }
        }
        if (claimed) continue;
        if (g.drawnThisTurn === 0 && Math.random() < 0.04 && g.drawTickets(p.id)) continue;
        const slot = g.market.findIndex(c => c && (c !== LOCO || g.drawnThisTurn === 0));
        if (Math.random() < 0.5 && slot >= 0) g.takeFromMarket(p.id, slot);
        else if (!g.takeFromDeck(p.id)) {
            if (slot >= 0) g.takeFromMarket(p.id, slot);
            else if (!g.pass(p.id)) g.skipTurn(p.id);
        }
        if (totalCards(g) !== 110) return `${totalCards(g)} cards`;
        if (g.players.some(q => q.trains < 0 || Object.values(q.hand).some(v => v < 0))) return 'negative';
    }
    return g.phase === 'GAME_OVER' ? true : 'did not end';
}

// ---------- Setup and cards ----------

test('Setup: 4 cards, 4 tickets to choose (1 long), 5 face up, 110 cards', () => {
    const g = new RailGame(names(4));
    const ok = g.players.every(p => Object.values(p.hand).reduce((a, b) => a + b, 0) === 4 && p.pendingTickets.length === 4 &&
        p.pendingTickets.filter(id => MAP.tickets[id].long).length === 1);
    return (ok && g.market.filter(Boolean).length === 5 && totalCards(g) === 110 && g.phase === 'SETUP_TICKETS') || 'bad setup';
});

test('Setup: keep at least 2; play starts when everyone chose', () => {
    const g = new RailGame(names(2));
    if (g.keepTickets(0, [g.players[0].pendingTickets[0]])) return 'kept only 1';
    g.keepTickets(0, g.players[0].pendingTickets.slice(0, 3));
    if (g.phase !== 'SETUP_TICKETS') return 'started too early';
    g.keepTickets(1, g.players[1].pendingTickets.slice(0, 2));
    return (g.phase === 'TURN' && g.turnIndex === 0) || 'did not start';
});

test('Setup: unwanted starting tickets leave the game', () => {
    const g = new RailGame(names(2));
    const before = g.ticketDeck.length;
    g.players.forEach(p => g.keepTickets(p.id, p.pendingTickets.slice(0, 2)));
    return g.ticketDeck.length === before || `ticket pile grew from ${before} to ${g.ticketDeck.length}`;
});

test('Cards: two deck draws end the turn', () => {
    const g = started();
    g.takeFromDeck(0);
    if (g.turnIndex !== 0) return 'ended after 1';
    g.takeFromDeck(0);
    return g.turnIndex === 1 || 'did not end';
});

test('Cards: a face-up wild ends the turn; not allowed as second pick', () => {
    const g = started();
    g.market[0] = LOCO; g.market[1] = 'red';
    g.takeFromMarket(0, 0);
    if (g.turnIndex !== 1) return 'wild did not end the turn';
    g.market[0] = 'blue';
    g.takeFromMarket(1, 0);
    g.market[1] = LOCO;
    if (g.takeFromMarket(1, 1)) return 'took a wild second';
    return g.turnIndex === 1 || 'turn moved on';
});

test('Cards: three face-up wilds replace the row', () => {
    const g = started();
    g.market = [LOCO, LOCO, 'red', 'blue', null];
    g.deck.push(LOCO);
    g.refillMarket();
    return g.market.filter(c => c === LOCO).length < 3 || 'still 3 wilds';
});

test('Cards: an empty deck is rebuilt from the discards (the game goes on)', () => {
    const g = started();
    g.discard.push(...g.deck.splice(0));
    g.takeFromDeck(0);
    return (g.phase === 'TURN' && g.deck.length > 0) || 'deck not rebuilt';
});

// ---------- Routes ----------

test('Routes: pay with the route colour plus wilds; points and trains update', () => {
    const g = started();
    const p = g.players[0]; emptyHand(p);
    p.hand[colored.color] = 2; p.hand[LOCO] = 1;
    const ok = g.claimRoute(0, colored.id, { color: colored.color, colorCount: 2, locos: 1 });
    return (ok && g.owner[colored.id] === 0 && p.trains === 42 && p.routePoints === ROUTE_POINTS[3] && g.turnIndex === 1) || 'claim failed';
});

test('Routes: wrong colour or wrong count is refused', () => {
    const g = started();
    const p = g.players[0]; emptyHand(p);
    const other = CARD_COLORS.find(c => c !== colored.color);
    p.hand[other] = 3; p.hand[colored.color] = 2;
    if (g.claimRoute(0, colored.id, { color: other, colorCount: 3, locos: 0 })) return 'wrong colour';
    if (g.claimRoute(0, colored.id, { color: colored.color, colorCount: 2, locos: 0 })) return 'too few';
    if (g.claimRoute(0, colored.id, { color: colored.color, colorCount: 2, locos: 1 })) return 'wild it does not have';
    return true;
});

test('Routes: grey takes any single colour', () => {
    const g = started();
    const p = g.players[0]; emptyHand(p);
    p.hand.purple = 2;
    return g.claimRoute(0, grey.id, { color: 'purple', colorCount: 2, locos: 0 }) || 'grey refused';
});

test('Routes: no claiming after taking a card this turn', () => {
    const g = started();
    g.takeFromDeck(0);
    g.players[0].hand.purple = 5;
    return !g.claimRoute(0, grey.id, { color: 'purple', colorCount: 2, locos: 0 }) || 'claimed after drawing';
});

test('Double routes: 2-3 players can use only one track', () => {
    const g = started(3);
    const a = twins[0], b = MAP.routes.find(r => r.lane === 1 && r.a === a.a && r.b === a.b);
    g.owner[a.id] = 1;
    return g.routeBlocked(0, b.id) !== '' || 'second track open';
});

test('Double routes: 4+ players can use both, never the same player', () => {
    const g = started(4);
    const a = twins[0], b = MAP.routes.find(r => r.lane === 1 && r.a === a.a && r.b === a.b);
    g.owner[a.id] = 1;
    if (g.routeBlocked(0, b.id) !== '') return 'blocked for another player';
    g.owner[a.id] = 0;
    return g.routeBlocked(0, b.id) !== '' || 'same player could take both';
});

// ---------- Tunnels and ferries ----------

test('Tunnels: matching revealed cards (and wilds) cost extra; paying claims it', () => {
    const g = started(2);
    const p = g.players[0]; emptyHand(p);
    p.hand[tunnel.color] = tunnel.length + 3; p.hand[LOCO] = 1;
    const other = CARD_COLORS.find(c => c !== tunnel.color);
    g.deck.push(other, LOCO, tunnel.color);
    const before = totalCards(g);
    if (!g.claimRoute(0, tunnel.id, { color: tunnel.color, colorCount: tunnel.length, locos: 0 })) return 'refused';
    if (g.phase !== 'TUNNEL' || g.tunnel.extra !== 2) return `phase ${g.phase} extra ${g.tunnel && g.tunnel.extra}`;
    if (totalCards(g) !== before) return 'cards lost while waiting';
    if (!g.payTunnel(0, { colorCount: 2, locos: 0 })) return 'pay refused';
    return (g.owner[tunnel.id] === 0 && p.hand[tunnel.color] === 1 && g.turnIndex === 1 && totalCards(g) === before) || 'bad after pay';
});

test('Tunnels: giving up returns the cards and ends the turn', () => {
    const g = started(2);
    const p = g.players[0]; emptyHand(p);
    p.hand[tunnel.color] = tunnel.length;
    g.deck.push(tunnel.color, tunnel.color, tunnel.color);
    g.claimRoute(0, tunnel.id, { color: tunnel.color, colorCount: tunnel.length, locos: 0 });
    if (g.tunnelOptions(0).length) return 'could pay with nothing';
    g.abandonTunnel(0);
    return (g.owner[tunnel.id] === undefined && p.hand[tunnel.color] === tunnel.length && g.turnIndex === 1) || 'bad give up';
});

test('Tunnels: paid only with wilds, only revealed wilds count', () => {
    const g = started(2);
    const p = g.players[0]; emptyHand(p);
    p.hand[LOCO] = tunnel.length + 1;
    g.deck.push(tunnel.color, tunnel.color, LOCO);
    g.claimRoute(0, tunnel.id, { color: CARD_COLORS[0], colorCount: 0, locos: tunnel.length });
    return (g.phase === 'TUNNEL' && g.tunnel.extra === 1 && g.tunnelOptions(0)[0].locos === 1) || `extra ${g.tunnel && g.tunnel.extra}`;
});

test('Tunnels: no matching cards means it is claimed straight away', () => {
    const g = started(2);
    const p = g.players[0]; emptyHand(p);
    p.hand[tunnel.color] = tunnel.length;
    const others = CARD_COLORS.filter(c => c !== tunnel.color);
    g.deck.push(others[0], others[1], others[2]);
    g.claimRoute(0, tunnel.id, { color: tunnel.color, colorCount: tunnel.length, locos: 0 });
    return (g.owner[tunnel.id] === 0 && g.phase === 'TURN') || 'not claimed';
});

test('Ferries: need at least as many wilds as marked spaces', () => {
    const g = started(2);
    const p = g.players[0]; emptyHand(p);
    p.hand.red = ferry.length; p.hand[LOCO] = ferry.ferry;
    if (g.claimRoute(0, ferry.id, { color: 'red', colorCount: ferry.length, locos: 0 })) return 'claimed without wilds';
    if (g.paymentOptions(0, ferry.id).some(o => o.locos < ferry.ferry)) return 'listed an option without wilds';
    return g.claimRoute(0, ferry.id, { color: 'red', colorCount: ferry.length - ferry.ferry, locos: ferry.ferry }) || 'valid ferry refused';
});

// ---------- Tickets ----------

test('Tickets: draw 3, keep at least 1, the rest go under the pile', () => {
    const g = started();
    const before = g.ticketDeck.length;
    g.drawTickets(0);
    const drawn = [...g.players[0].pendingTickets];
    if (drawn.length !== 3 || g.phase !== 'CHOOSE_TICKETS') return 'did not draw 3';
    if (g.keepTickets(0, [])) return 'kept none';
    g.keepTickets(0, [drawn[0]]);
    return (g.ticketDeck.length === before - 1 && g.turnIndex === 1) || 'bad return';
});

// ---------- Stations ----------

test('Stations: cost 1, then 2, then 3 cards of one colour; one per city; max 3', () => {
    const g = started(3);
    const p = g.players[0]; emptyHand(p); p.hand.red = 6; p.hand.blue = 3;
    const c = MAP.cities.map(x => x.id);
    if (g.buildStation(0, c[0], { color: 'red', colorCount: 2, locos: 0 })) return 'first cost 2 accepted';
    if (!g.buildStation(0, c[0], { color: 'red', colorCount: 1, locos: 0 })) return 'first refused';
    g.turnIndex = 0;
    if (g.buildStation(0, c[0], { color: 'red', colorCount: 2, locos: 0 })) return 'same city twice';
    if (!g.buildStation(0, c[1], { color: 'red', colorCount: 2, locos: 0 })) return 'second refused';
    g.turnIndex = 0;
    if (!g.buildStation(0, c[2], { color: 'blue', colorCount: 3, locos: 0 })) return 'third refused';
    g.turnIndex = 0;
    return (!g.buildStation(0, c[3], { color: 'red', colorCount: 3, locos: 0 }) && p.stations === 0) || 'fourth allowed';
});

test('Stations: a station borrows ONE rival route for tickets, not for the longest line', () => {
    const g = started(2);
    const r = MAP.routes.find(x => x.lane === null && plain(x));
    g.ticketInfo = [...MAP.tickets, { id: MAP.tickets.length, a: r.a, b: r.b, points: 9, long: false }];
    const tid = MAP.tickets.length;
    g.players[0].tickets = [tid];
    g.players[1].tickets = [];
    g.owner[r.id] = 1;
    if (g.bestStationUse(0).done.length) return 'done without a station';
    g.stationsAt[r.a] = 0; g.players[0].stations = 2;
    const use = g.bestStationUse(0);
    if (!use.done.includes(tid) || use.borrowed[0] !== r.id) return JSON.stringify(use);
    g.finishGame();
    const f = g.final[0];
    return (f.ticketPlus === 9 && f.stationBonus === 8 && f.longest === 0) || JSON.stringify(f);
});

test('Stations: unbuilt stations score 4 each', () => {
    const g = started(2);
    g.finishGame();
    return g.final.every(f => f.stationBonus === 12) || 'wrong station bonus';
});

// ---------- End of game ----------

test('Final round: at 2 trains or fewer everyone (trigger player too) gets one more turn', () => {
    const g = started(3);
    g.players[1].trains = 4;
    g.turnIndex = 1;
    const p = g.players[1]; emptyHand(p); p.hand.purple = 2;
    g.claimRoute(1, grey.id, { color: 'purple', colorCount: 2, locos: 0 });
    if (g.turnsLeft !== 3) return `turnsLeft ${g.turnsLeft}`;
    g.takeFromDeck(2); g.takeFromDeck(2);
    g.takeFromDeck(0); g.takeFromDeck(0);
    if (g.phase === 'GAME_OVER') return 'ended too early';
    g.takeFromDeck(1); g.takeFromDeck(1);
    return g.phase === 'GAME_OVER' || `phase ${g.phase}`;
});

test('Stuck game: ends when nobody can claim any route', () => {
    const g = started(2);
    g.players.forEach(p => { p.trains = 3; });
    MAP.routes.forEach(r => { if (r.length <= 3) g.owner[r.id] = 1; });
    g.takeFromDeck(0); g.takeFromDeck(0);
    return g.phase === 'GAME_OVER' || `phase ${g.phase}`;
});

test('Host can end a stalled game', () => {
    const g = started(3);
    return (g.endNow() && g.phase === 'GAME_OVER' && g.final.length === 3) || 'did not end';
});

test('Scoring: finished tickets add, open ones subtract, longest line +10', () => {
    const g = started(2);
    const t = MAP.tickets.find(x => !x.long);
    const adj = {};
    MAP.routes.forEach(r => { (adj[r.a] = adj[r.a] || []).push(r); (adj[r.b] = adj[r.b] || []).push(r); });
    const dist = { [t.a]: 0 }, via = {};
    const q = [t.a];
    while (q.length) {
        q.sort((x, y) => dist[x] - dist[y]);
        const c = q.shift();
        adj[c].forEach(r => { const n = r.a === c ? r.b : r.a; if (dist[n] === undefined || dist[c] + r.length < dist[n]) { dist[n] = dist[c] + r.length; via[n] = r; q.push(n); } });
    }
    let c = t.b; while (c !== t.a) { g.owner[via[c].id] = 0; c = via[c].a === c ? via[c].b : via[c].a; }
    g.players[0].tickets = [t.id];
    const other = MAP.tickets.find(x => x.id !== t.id && !x.long);
    g.players[1].tickets = [other.id];
    g.finishGame();
    const f0 = g.final[0], f1 = g.final[1];
    return (f0.ticketPlus === t.points && f1.ticketMinus === other.points && f0.bonus === 10 && f1.bonus === 0 && g.winnerId === 0) || JSON.stringify({ f0, f1 });
});

// ---------- Online ----------

test('Online view: other hands and tickets hidden; snapshot rebuilds', () => {
    const g = started(3);
    const s = JSON.parse(JSON.stringify(g.toState(1)));
    if (s.players[0].hand !== null || s.players[0].tickets !== null || !s.players[1].hand) return 'leaked a hand';
    if ('deck' in s) return 'leaked the deck';
    const h = RailGame.fromState(s);
    return (h.players.length === 3 && h.market.join() === g.market.join()) || 'bad rebuild';
});

test('Online view: deck draws stay secret from others', () => {
    const g = started(3);
    g.takeFromDeck(0);
    return (g.toState(0).lastAction.card && !g.toState(1).lastAction.card) || 'card leaked';
});

test('Online view: an open tunnel is shared', () => {
    const g = started(2);
    const p = g.players[0]; emptyHand(p);
    p.hand[tunnel.color] = tunnel.length + 2;
    g.deck.push(tunnel.color, LOCO, tunnel.color);
    g.claimRoute(0, tunnel.id, { color: tunnel.color, colorCount: tunnel.length, locos: 0 });
    const h = RailGame.fromState(JSON.parse(JSON.stringify(g.toState(1))));
    return (h.phase === 'TUNNEL' && h.tunnel.extra === 3 && h.tunnel.revealed.length === 3) || JSON.stringify(h.tunnel);
});

test('Random full games (2-5 players, stations, tunnels): cards kept, games end', () => {
    for (let n = 0; n < 60; n++) {
        const g = new RailGame(names(2 + (n % 4)));
        g.players.forEach(p => g.keepTickets(p.id, p.pendingTickets.slice(0, 2 + (n % 2))));
        const r = playRandom(g);
        if (r !== true) return `game ${n}: ${r}`;
        if (g.final.some(f => f.total !== f.routes + f.ticketPlus - f.ticketMinus + f.bonus + f.stationBonus)) return 'totals do not add up';
    }
    return true;
});

let pass = 0;
results.forEach(r => { console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '\n      -> ' + r.info}`); if (r.ok) pass++; });
console.log(`\n${pass}/${results.length} passed`);
process.exitCode = pass === results.length ? 0 : 1;

// Rail Rivals - app entry: lobby, online rooms and the host's rule checks
//
// Everyone plays on their own device. The host's browser owns the real game:
// every move (the host's own too) goes through applyAction(), which checks it
// is that player's move before changing anything, then sends each player a
// snapshot where only their own cards and tickets are visible.

// A player who disconnects on their turn is skipped after this long
const AWAY_SKIP_MS = 20000;
// Browsers can take a long time to report a closed tab, so guests send a
// small heartbeat and the host treats silence as leaving
const HEARTBEAT_MS = 4000;
const SILENT_LEFT_MS = 12000;

class RailApp {
    constructor() {
        this.net = new RailNet();
        this.ui = new RailUI((action, data) => this.dispatch(action, data));
        this.game = null;
        this.mySeat = null;
        this.started = false;
        this.roomCode = null;
        this.lobby = [];        // host: [{ name, token, connId }]

        this.ui.bindCopy($('btn-lobby-copy'), $('lobby-link'));
        this.ui.bindCopy($('btn-invite-copy'), $('invite-link'));
        $('btn-invite').addEventListener('click', () => {
            $('invite-link').value = this.roomCode ? this.roomLink() : location.href;
            this.ui.open('invite');
        });
        $('btn-start').addEventListener('click', () => this.startGame());
        $('btn-again').addEventListener('click', () => this.startGame());

        const go = () => {
            const name = $('lobby-name').value.trim().slice(0, 16);
            if (!name) { this.ui.showLobbyError('Please enter your name.'); return; }
            sound.ensure();
            if (this.joinCode) this.joinRoom(name); else this.createRoom(name);
        };
        $('btn-lobby-go').addEventListener('click', go);
        $('lobby-name').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });

        const code = (new URLSearchParams(location.search).get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const saved = this.storage('railrivals-name', undefined, true) || this.storage('railrivals-name') || '';
        if (code) {
            this.joinCode = code;
            this.roomCode = code;
            this.ui.showLobbyName('join', saved, code);
            if (saved && this.storage(`railrivals-token-${code}`, undefined, true)) this.joinRoom(saved);
        } else {
            this.ui.showLobbyName('host', saved);
        }
    }

    // perTab: kept only for this tab (sessionStorage). Player tokens live there so
    // two tabs or windows on one computer are two different players, while a
    // refresh still rejoins the same seat.
    storage(key, value, perTab = false) {
        try {
            const store = perTab ? sessionStorage : localStorage;
            if (value === undefined) return store.getItem(key);
            store.setItem(key, value);
        } catch (e) { /* storage blocked: rejoining after a refresh won't work */ }
        return null;
    }

    // The part after "#" holds the backup connection's key. Browsers never
    // send it to any server, so only people with the link can use it.
    linkKey() {
        if (this.net && this.net.relayKey) return this.net.relayKey;
        const k = new URLSearchParams(location.hash.slice(1)).get('k') || '';
        return /^[A-Za-z0-9_-]{22}$/.test(k) ? k : '';
    }

    roomLink() {
        const key = this.linkKey();
        return `${location.href.split(/[?#]/)[0]}?room=${this.roomCode}${key ? `#k=${key}` : ''}`;
    }

    // ---------- Host ----------

    async createRoom(name) {
        this.storage('railrivals-name', name);
        this.storage('railrivals-name', name, true);
        this.ui.setLobbyBusy('Creating room…');
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                this.roomCode = await this.net.host(RailNet.makeRoomCode());
                break;
            } catch (err) {
                if (err.message !== 'ROOM_TAKEN' || attempt === 2) {
                    this.ui.showLobbyError('Could not create a room. Check your internet connection and try again.');
                    return;
                }
                this.net = new RailNet();
            }
        }
        this.mySeat = 0;
        this.lobby = [{ name, token: 'host', connId: null }];
        this.net.on('guestMessage', (id, msg) => {
            this.lastSeen[id] = Date.now();
            this.onGuestMessage(id, msg);
        });
        this.net.on('guestLeft', id => this.onGuestLeft(id));
        this.net.on('status', st => this.onRoomStatus(st));
        this.lastSeen = {};
        setInterval(() => {
            const now = Date.now();
            this.lobby.forEach(p => {
                const id = p.connId;
                if (id && now - (this.lastSeen[id] || now) > SILENT_LEFT_MS) {
                    this.onGuestLeft(id);
                    const conn = this.net.guestConns.get(id);
                    if (conn) conn.close();
                }
            });
        }, 3000);
        window.addEventListener('beforeunload', e => {
            if (this.lobby.length > 1) { e.preventDefault(); e.returnValue = ''; }
        });
        this.refreshLobby();
    }

    // The room can drop off the signalling server (sleeping laptop,
    // background tab). New players can't find it until it reconnects.
    onRoomStatus(st) {
        const text = st === 'online' ? '' : '🔌 Reconnecting the room… friends can join again in a moment.';
        if (!this.started) {
            if (st === 'online') this.refreshLobby();
            else $('lobby-wait').textContent = text;
        } else if (text) {
            this.ui.toast('🔌 Reconnecting the room…');
        }
    }

    refreshLobby() {
        const names = this.lobby.map(p => p.name);
        this.ui.showLobbyRoom({ isHost: true, link: this.roomLink(), players: names, mySeat: 0, canStart: names.length >= MIN_PLAYERS });
        this.lobby.forEach((p, seat) => { if (p.connId) this.net.sendTo(p.connId, { t: 'lobby', players: names, seat }); });
    }

    onGuestMessage(connId, msg) {
        if (!msg || typeof msg !== 'object') return;
        if (msg.t === 'ping') return;
        if (msg.t === 'bye') {
            this.onGuestLeft(connId);
            return;
        }
        if (msg.t === 'join') {
            const name = String(msg.name || '').trim().slice(0, 16) || 'Friend';
            const token = String(msg.token || '').slice(0, 64);
            // seat 0 belongs to the host and can't be taken over by a guest
            let seat = token ? this.lobby.findIndex((p, i) => i > 0 && p.token === token) : -1;
            if (seat === -1) {
                if (this.started) {
                    // let the host see that a friend arrived too late
                    this.game.log(`🚪 ${name} tried to join, but the game had already started.`);
                    this.broadcast(false);
                    return this.net.sendTo(connId, { t: 'error', message: 'This game has already started without you. Ask the host to open a new room and wait until everyone has joined before pressing Start.' });
                }
                if (this.lobby.length >= MAX_PLAYERS) return this.net.sendTo(connId, { t: 'error', message: 'This room is full (5 players).' });
                this.lobby.push({ name, token, connId });
                seat = this.lobby.length - 1;
            } else {
                this.lobby[seat].connId = connId;
                if (!this.started) this.lobby[seat].name = name;
            }
            if (this.started) {
                this.game.players[seat].online = true;
                this.game.log(`🔌 ${this.game.players[seat].name} is back.`);
                this.broadcast(false);
            } else {
                this.refreshLobby();
            }
            return;
        }
        if (msg.t === 'action' && this.started) {
            const seat = connId ? this.lobby.findIndex((p, i) => i > 0 && p.connId === connId) : -1;
            if (seat !== -1) this.applyAction(seat, String(msg.action || ''), msg.data && typeof msg.data === 'object' ? msg.data : {});
        }
    }

    onGuestLeft(connId) {
        // seat 0 is the host, who has no connection id of their own
        if (!connId) return;
        const seat = this.lobby.findIndex((p, i) => i > 0 && p.connId === connId);
        if (seat === -1) return;
        if (!this.started) {
            this.lobby.splice(seat, 1);
            this.refreshLobby();
            return;
        }
        this.lobby[seat].connId = null;
        const p = this.game.players[seat];
        p.online = false;
        this.game.log(`📴 ${p.name} disconnected. They can rejoin with the same link.`);
        this.handleAway();
        this.broadcast(false);
    }

    // Keep the game moving when someone is away
    handleAway() {
        const g = this.game;
        if (!g || g.phase === 'GAME_OVER') return;
        if (g.phase === 'SETUP_TICKETS') {
            g.players.forEach(p => { if (!p.online && p.pendingTickets.length) g.autoKeepTickets(p.id); });
        }
        clearTimeout(this.awayTimer);
        const cur = g.players[g.turnIndex];
        if (g.phase !== 'SETUP_TICKETS' && !cur.online) {
            this.awayTimer = setTimeout(() => {
                if (this.game === g && !g.players[g.turnIndex].online && g.turnIndex === cur.id) {
                    g.skipTurn(cur.id);
                    this.handleAway();
                    this.broadcast(true);
                }
            }, AWAY_SKIP_MS);
        }
    }

    startGame() {
        if (!this.net.isHost || this.lobby.length < MIN_PLAYERS) return;
        this.game = new RailGame(this.lobby.map(p => p.name));
        this.game.players.forEach((p, i) => { p.online = i === 0 || !!this.lobby[i].connId; });
        this.started = true;
        this.ui.doneTickets = new Set();
        this.ui.confettiDone = false;
        this.ui.close('lobby');
        this.handleAway();
        this.broadcast(true);
    }

    applyAction(seat, action, data) {
        const g = this.game;
        if (!g) return;
        let ok = false;
        switch (action) {
            case 'market': ok = g.takeFromMarket(seat, Math.floor(Number(data.slot))); break;
            case 'deck': ok = g.takeFromDeck(seat); break;
            case 'tickets': ok = g.drawTickets(seat); break;
            case 'pass': ok = g.pass(seat); break;
            case 'keep_tickets': ok = Array.isArray(data.ids) && g.keepTickets(seat, data.ids.map(Number).filter(Number.isInteger)); break;
            case 'station': ok = typeof data.cityId === 'string' && g.buildStation(seat, data.cityId, data.payment || {}); break;
            case 'claim': {
                const routeId = Math.floor(Number(data.routeId));
                ok = Number.isInteger(routeId) && g.claimRoute(seat, routeId, data.payment || {});
                break;
            }
        }
        if (ok) this.handleAway();
        // always resend so a refused move snaps back to the real state
        this.broadcast(ok);
    }

    broadcast(fresh) {
        this.lobby.forEach((p, seat) => {
            if (p.connId) this.net.sendTo(p.connId, { t: 'state', seat, state: this.game.toState(seat), fresh });
        });
        // the host sees the same filtered view as everyone else
        this.show(RailGame.fromState(JSON.parse(JSON.stringify(this.game.toState(0)))), 0, fresh);
    }

    // ---------- Guest ----------

    async joinRoom(name) {
        this.storage('railrivals-name', name);
        this.storage('railrivals-name', name, true);
        this.ui.setLobbyBusy('Joining…');
        let token = this.storage(`railrivals-token-${this.roomCode}`, undefined, true);
        if (!token) {
            token = Math.random().toString(36).slice(2) + Date.now().toString(36);
            this.storage(`railrivals-token-${this.roomCode}`, token, true);
        }
        this.net.on('hostMessage', msg => this.onHostMessage(msg));
        this.net.on('hostLeft', () => this.ui.open('lost'));
        try {
            this.net.relayKey = this.linkKey();
            await this.net.join(this.roomCode, text => this.ui.setLobbyBusy(text));
        } catch (err) {
            this.net = new RailNet();
            this.ui.showLobbyName('join', name, this.roomCode);
            this.ui.showLobbyError(this.joinErrorText(err.message));
            return;
        }
        this.net.sendToHost({ t: 'join', name, token });
        setInterval(() => this.net.sendToHost({ t: 'ping' }), HEARTBEAT_MS);
        window.addEventListener('pagehide', () => this.net.sendToHost({ t: 'bye' }));
    }

    onHostMessage(msg) {
        if (!msg || typeof msg !== 'object') return;
        if (msg.t === 'lobby') {
            this.mySeat = Number(msg.seat);
            this.ui.showLobbyRoom({ isHost: false, link: this.roomLink(), players: (msg.players || []).map(String), mySeat: this.mySeat, canStart: false });
        } else if (msg.t === 'state') {
            this.mySeat = Number(msg.seat);
            this.started = true;
            this.ui.close('lobby');
            this.show(RailGame.fromState(msg.state || {}), this.mySeat, !!msg.fresh);
        } else if (msg.t === 'error') {
            this.ui.showLobbyError(String(msg.message || 'Something went wrong.'));
        }
    }

    // ---------- Both ----------

    show(view, seat, fresh) {
        if (view.phase === 'SETUP_TICKETS' && this.ui.game && this.ui.game.phase === 'GAME_OVER') {
            this.ui.doneTickets = new Set();
            this.ui.confettiDone = false;
        }
        this.ui.update(view, seat, fresh);
    }

    // Tell the player why joining failed, so they know what to try
    joinErrorText(code) {
        if (code === 'ROOM_NOT_FOUND') return 'Room not found. The host may have closed or refreshed the page; ask them for a new link.';
        if (code === 'UNSUPPORTED') return 'This browser cannot join online games. Please try the latest Chrome, Safari, Firefox or Edge.';
        if (code === 'TIMEOUT') return 'The connection took too long. A strict network (school, office or some mobile data) may block it: try another Wi-Fi or a phone hotspot, then join again.';
        return 'Could not reach the game server. Check your internet connection and try again.';
    }

    dispatch(action, data = {}) {
        if (!this.started) return;
        sound.ensure();
        if (this.net.isHost) this.applyAction(this.mySeat, action, data);
        else this.net.sendToHost({ t: 'action', action, data });
    }
}

window.addEventListener('DOMContentLoaded', () => { window.railApp = new RailApp(); });

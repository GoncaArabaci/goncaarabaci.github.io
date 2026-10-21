// Hexland - Main Application Entrypoint (Online Friends Multiplayer - Zero Bots)
//
// Everyone plays on their own device. The host's browser owns the real game:
// every move (the host's own too) goes through applyAction(), which checks that
// it's really that player's turn before changing anything, then sends each
// player a snapshot with only their own cards visible.

const MAX_PLAYERS = 4;
const MIN_PLAYERS = 2;

class HexlandApp {
    constructor() {
        this.canvas = document.getElementById('hexland-canvas');
        this.board = new BoardGraph();
        this.game = new HexlandGame(this.board, [{ name: 'Player 1' }, { name: 'Player 2' }, { name: 'Player 3' }]);

        this.net = new HexlandNet();
        this.roomCode = null;
        this.mySeat = null;
        this.started = false;
        this.lobbyPlayers = [];   // host only: [{ name, token, connId }] in seat order

        this.renderer = new HexlandRenderer(this.canvas, this.game);
        this.ui = new HexlandUI(this.game, this.renderer, soundFX, (action, data) => this.dispatch(action, data));

        this.init();
    }

    async init() {
        await pixelAssets.loadAssets();
        this.bindCanvasEvents();
        this.bindLobby();
        this.startLoop();
    }

    // ---------- Lobby ----------

    bindLobby() {
        const params = new URLSearchParams(location.search);
        const code = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const savedName = this.storage('hexland-name') || '';

        if (code) {
            this.roomCode = code;
            this.ui.showLobbyName('join', savedName, code);
            this.ui.onLobbySubmit = name => this.joinRoom(name);
            // Rejoin automatically after a page refresh
            if (savedName && this.storage(`hexland-token-${code}`)) this.joinRoom(savedName);
        } else {
            this.ui.showLobbyName('host', savedName);
            this.ui.onLobbySubmit = name => this.createRoom(name);
        }

        this.ui.onStartGame = () => this.startGame();
        this.ui.onNewGame = () => this.startGame();
    }

    storage(key, value) {
        try {
            if (value === undefined) return localStorage.getItem(key);
            localStorage.setItem(key, value);
        } catch (e) { /* storage blocked: rejoin-on-refresh just won't work */ }
        return null;
    }

    roomLink() {
        return `${location.href.split(/[?#]/)[0]}?room=${this.roomCode}`;
    }

    async createRoom(name) {
        this.storage('hexland-name', name);
        this.ui.setLobbyBusy('Creating room...');

        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                this.roomCode = await this.net.host(HexlandNet.makeRoomCode());
                break;
            } catch (err) {
                if (err.message !== 'ROOM_TAKEN' || attempt === 2) {
                    this.ui.showLobbyError('Could not create a room. Check your internet connection and try again.');
                    return;
                }
                this.net = new HexlandNet();
            }
        }

        this.mySeat = 0;
        this.lobbyPlayers = [{ name, token: 'host', connId: null }];
        this.net.on('guestMessage', (connId, msg) => this.onGuestMessage(connId, msg));
        this.net.on('guestLeft', connId => this.onGuestLeft(connId));

        window.addEventListener('beforeunload', e => {
            if (this.lobbyPlayers.length > 1) {
                e.preventDefault();
                e.returnValue = '';
            }
        });

        this.ui.roomLink = this.roomLink();
        this.refreshLobby();
    }

    async joinRoom(name) {
        this.storage('hexland-name', name);
        this.ui.setLobbyBusy('Joining room...');

        let token = this.storage(`hexland-token-${this.roomCode}`);
        if (!token) {
            token = Math.random().toString(36).slice(2) + Date.now().toString(36);
            this.storage(`hexland-token-${this.roomCode}`, token);
        }

        this.net.on('hostMessage', msg => this.onHostMessage(msg));
        this.net.on('hostLeft', () => this.ui.showConnectionLost());

        try {
            await this.net.join(this.roomCode);
        } catch (err) {
            this.net = new HexlandNet();
            this.ui.showLobbyName('join', name, this.roomCode);
            this.ui.showLobbyError(err.message === 'ROOM_NOT_FOUND'
                ? 'Room not found. The host may have closed the page.'
                : 'Could not connect to the room. Please try again.');
            return;
        }

        this.ui.roomLink = this.roomLink();
        this.net.sendToHost({ t: 'join', name, token });
    }

    refreshLobby() {
        const names = this.lobbyPlayers.map(p => p.name);
        this.ui.showLobbyRoom({
            isHost: true,
            link: this.roomLink(),
            players: names,
            mySeat: 0,
            canStart: names.length >= MIN_PLAYERS
        });
        this.lobbyPlayers.forEach((p, seat) => {
            if (p.connId) this.net.sendTo(p.connId, { t: 'lobby', players: names, seat });
        });
    }

    // ---------- Host: messages from guests ----------

    onGuestMessage(connId, msg) {
        if (!msg || typeof msg !== 'object') return;

        if (msg.t === 'join') {
            const name = String(msg.name || '').trim().slice(0, 16) || 'Friend';
            const token = String(msg.token || '');
            let seat = this.lobbyPlayers.findIndex(p => p.token === token);

            if (seat === -1) {
                if (this.started) {
                    this.net.sendTo(connId, { t: 'error', message: 'This game has already started.' });
                    return;
                }
                if (this.lobbyPlayers.length >= MAX_PLAYERS) {
                    this.net.sendTo(connId, { t: 'error', message: 'This room is full (4 players).' });
                    return;
                }
                this.lobbyPlayers.push({ name, token, connId });
                seat = this.lobbyPlayers.length - 1;
            } else {
                this.lobbyPlayers[seat].connId = connId;
                if (!this.started) this.lobbyPlayers[seat].name = name;
            }

            if (this.started) {
                const p = this.game.players[seat];
                p.online = true;
                this.game.log(`🔌 ${p.name} reconnected.`);
                this.broadcastState([]);
            } else {
                this.refreshLobby();
            }
            return;
        }

        if (msg.t === 'action' && this.started) {
            const seat = this.lobbyPlayers.findIndex(p => p.connId === connId);
            if (seat !== -1) this.applyAction(seat, msg.action, msg.data || {});
        }
    }

    onGuestLeft(connId) {
        const seat = this.lobbyPlayers.findIndex(p => p.connId === connId);
        if (seat === -1) return;

        if (!this.started) {
            this.lobbyPlayers.splice(seat, 1);
            this.refreshLobby();
        } else {
            this.lobbyPlayers[seat].connId = null;
            const p = this.game.players[seat];
            p.online = false;
            this.game.log(`📴 ${p.name} disconnected. They can rejoin with the same link.`);
            this.discardForAwayPlayers();
            this.broadcastState([]);
        }
    }

    startGame() {
        if (!this.net.isHost || this.lobbyPlayers.length < MIN_PLAYERS) return;

        const playerConfigs = this.lobbyPlayers.map(p => ({ name: p.name }));
        this.board = new BoardGraph();
        this.setGame(new HexlandGame(this.board, playerConfigs));
        this.game.players.forEach((p, i) => { p.online = i === 0 || !!this.lobbyPlayers[i].connId; });
        this.started = true;
        this.lastTurn = null;

        this.game.log(`⚔️ Game started! ${playerConfigs.length} friends at the table. ${this.game.getCurrentPlayer().name} places the first settlement.`);
        this.ui.hideLobby();
        this.broadcastState([{ type: 'start' }]);
    }

    setGame(game) {
        const prevTurn = this.game ? this.game.turnIndex : null;
        this.game = game;
        this.board = game.board;
        this.renderer.game = game;
        this.renderer.board = game.board;
        this.ui.game = game;
        return prevTurn;
    }

    // ---------- Host: the only place the game changes ----------

    applyAction(seat, action, data) {
        const g = this.game;
        if (!g || g.phase === 'GAME_OVER') return;

        const isTurn = seat === g.turnIndex;
        const inAction = g.phase === 'ACTION';
        const canBuildNow = inAction && g.diceRolled;
        const isResource = r => Object.values(RESOURCES).includes(r);
        const validId = (value, list) => Number.isInteger(value) && value >= 0 && value < list.length;
        const vertexId = Number(data.vertexId);
        const edgeId = Number(data.edgeId);
        const hexId = Number(data.hexId);
        const events = [];
        let ok = false;

        switch (action) {
            case 'roll': {
                if (!isTurn || !inAction || g.diceRolled) break;
                const result = g.rollDice();
                ok = !!result;
                if (ok) events.push({ type: 'roll', sum: result.sum });
                break;
            }
            case 'build_settlement': {
                const setup = g.phase === 'SETUP_SETTLEMENT_1' || g.phase === 'SETUP_SETTLEMENT_2';
                if (!isTurn || !(setup || canBuildNow) || !validId(vertexId, this.board.vertices)) break;
                ok = g.buildSettlement(vertexId);
                if (ok) events.push({ type: 'build', kind: 'settlement', vertexId });
                break;
            }
            case 'build_city': {
                if (!isTurn || !canBuildNow || !validId(vertexId, this.board.vertices)) break;
                ok = g.buildCity(vertexId);
                if (ok) events.push({ type: 'build', kind: 'city', vertexId });
                break;
            }
            case 'build_road': {
                const setup = g.phase === 'SETUP_ROAD_1' || g.phase === 'SETUP_ROAD_2';
                const freeRoad = inAction && g.freeRoads > 0;
                if (!isTurn || !(setup || canBuildNow || freeRoad) || !validId(edgeId, this.board.edges)) break;
                ok = g.buildRoad(edgeId);
                if (ok) events.push({ type: 'build', kind: 'road', edgeId });
                break;
            }
            case 'move_robber': {
                if (!isTurn || g.phase !== 'ROBBER_MOVE' || !validId(hexId, this.board.hexes)) break;
                ok = g.moveRobber(hexId);
                if (ok) events.push({ type: 'robber', hexId });
                break;
            }
            case 'steal': {
                const victimId = Number(data.victimId);
                if (!isTurn || g.phase !== 'ROBBER_STEAL' || !g.stealTargets.includes(victimId)) break;
                ok = g.stealResource(victimId);
                if (ok) events.push({ type: 'card' });
                break;
            }
            case 'discard': {
                if (!g.pendingDiscards.some(d => d.playerId === seat)) break;
                const cards = {};
                for (const [res, n] of Object.entries(data.resources || {})) {
                    if (!isResource(res)) continue;
                    cards[res] = Math.max(0, Math.floor(Number(n) || 0));
                }
                ok = g.discardResources(seat, cards);
                if (ok) events.push({ type: 'card' });
                break;
            }
            case 'bank_trade': {
                if (!isTurn || !canBuildNow || !isResource(data.give) || !isResource(data.get)) break;
                ok = g.executeBankTrade(data.give, data.get);
                if (ok) events.push({ type: 'trade' });
                break;
            }
            case 'buy_dev': {
                if (!isTurn || !canBuildNow) break;
                ok = !!g.buyDevCard();
                if (ok) events.push({ type: 'card' });
                break;
            }
            case 'play_dev': {
                if (!isTurn || !inAction) break;
                const type = data.type;
                if (!Object.values(DEV_CARD_TYPES).includes(type)) break;
                const params = {};
                if (type === DEV_CARD_TYPES.MONOPOLY) {
                    if (!isResource(data.resource)) break;
                    params.resource = data.resource;
                } else if (type === DEV_CARD_TYPES.YEAR_OF_PLENTY) {
                    if (!isResource(data.res1) || !isResource(data.res2)) break;
                    params.res1 = data.res1;
                    params.res2 = data.res2;
                }
                ok = !!g.playDevCard(type, params);
                if (ok) events.push({ type: type === DEV_CARD_TYPES.KNIGHT ? 'knight' : 'card' });
                break;
            }
            case 'end_turn': {
                if (!isTurn) break;
                ok = g.endTurn();
                break;
            }
        }

        this.discardForAwayPlayers();
        // Always resend, so a rejected move snaps back to the real state
        this.broadcastState(ok ? events : []);
    }

    // A disconnected player can't pick cards to discard after a 7, so the
    // game would wait forever: discard randomly for them instead
    discardForAwayPlayers() {
        const g = this.game;
        if (!g || g.phase !== 'ROBBER_DISCARD') return;
        [...g.pendingDiscards].forEach(d => {
            if (g.players[d.playerId].online === false) g.autoDiscard(d.playerId);
        });
    }

    broadcastState(events) {
        this.lobbyPlayers.forEach((p, seat) => {
            if (p.connId) {
                this.net.sendTo(p.connId, { t: 'state', seat, state: this.game.toState(seat), events });
            }
        });
        this.afterStateChange(events, this.lastTurn);
        this.lastTurn = this.game.turnIndex;
    }

    // ---------- Guest: messages from the host ----------

    onHostMessage(msg) {
        if (!msg || typeof msg !== 'object') return;

        if (msg.t === 'lobby') {
            this.mySeat = msg.seat;
            this.ui.showLobbyRoom({
                isHost: false,
                link: this.roomLink(),
                players: msg.players,
                mySeat: msg.seat,
                canStart: false
            });
        } else if (msg.t === 'state') {
            this.mySeat = msg.seat;
            const prevTurn = this.started ? this.game.turnIndex : null;
            this.setGame(HexlandGame.fromState(msg.state));
            this.started = true;
            this.ui.hideLobby();
            this.afterStateChange(msg.events || [], prevTurn);
        } else if (msg.t === 'error') {
            this.ui.showLobbyError(msg.message);
        }
    }

    // ---------- Both: sounds, popups and UI refresh ----------

    afterStateChange(events, prevTurn) {
        const g = this.game;
        this.ui.mySeat = this.mySeat;

        events.forEach(ev => {
            if (ev.type === 'build') {
                soundFX.playBuild();
                if (ev.kind === 'road') {
                    const e = this.board.edges[ev.edgeId];
                    const v1 = this.board.vertices[e.v1];
                    const v2 = this.board.vertices[e.v2];
                    const pt = this.renderer.toScreen((v1.x + v2.x) / 2, (v1.y + v2.y) / 2);
                    this.renderer.addPopup('🚧 Road!', pt.x, pt.y, '#f39c12');
                } else {
                    const v = this.board.vertices[ev.vertexId];
                    const pt = this.renderer.toScreen(v.x, v.y);
                    const label = ev.kind === 'city' ? '🏰 City!' : '🏠 Settlement!';
                    this.renderer.addPopup(label, pt.x, pt.y, ev.kind === 'city' ? '#f1c40f' : '#2ecc71');
                }
            } else if (ev.type === 'roll') {
                soundFX.playDiceRoll();
                this.ui.animateDiceRoll();
                if (ev.sum === 7) {
                    soundFX.playRobber();
                } else {
                    soundFX.playHarvest();
                    this.board.hexes.forEach(hex => {
                        if (hex.number === ev.sum && hex.resource && hex.id !== this.board.robberHexId) {
                            const pt = this.renderer.toScreen(hex.x, hex.y);
                            this.renderer.addPopup(`+ ${RESOURCE_NAMES[hex.resource]}`, pt.x, pt.y, '#f1c40f');
                        }
                    });
                }
            } else if (ev.type === 'robber' || ev.type === 'knight') {
                soundFX.playRobber();
            } else if (ev.type === 'trade') {
                soundFX.playHarvest();
            } else if (ev.type === 'card') {
                soundFX.playCard();
            }
        });

        // Your turn now: give a little nudge
        if (prevTurn !== null && prevTurn !== undefined && prevTurn !== g.turnIndex && g.turnIndex === this.mySeat) {
            soundFX.playCard();
            this.renderer.addPopup('⭐ Your turn!', this.renderer.width / 2, 60, '#f1c40f');
        }

        // Keep road-building mode on while free roads are left
        if (g.freeRoads > 0 && g.turnIndex === this.mySeat) this.renderer.activeMode = 'build_road';
        else if (this.renderer.activeMode === 'build_road' && g.freeRoads === 0 && !g.diceRolled) this.renderer.activeMode = null;

        this.ui.update();
    }

    // ---------- Sending moves ----------

    dispatch(action, data = {}) {
        if (!this.started) return;
        if (this.net.isHost) this.applyAction(this.mySeat, action, data);
        else this.net.sendToHost({ t: 'action', action, data });
    }

    isMyTurn() {
        return this.started && this.game.turnIndex === this.mySeat && this.game.phase !== 'GAME_OVER';
    }

    // ---------- Placing pieces ----------
    // Pieces snap to the nearest legal corner/edge near the pointer. They can be
    // dragged from the hand bar and dropped on the board, or placed with a click.

    placementKind() {
        if (!this.isMyTurn()) return null;
        if (this.drag) return this.drag.kind;
        const phase = this.game.phase;
        if (phase === 'SETUP_SETTLEMENT_1' || phase === 'SETUP_SETTLEMENT_2') return 'settlement';
        if (phase === 'SETUP_ROAD_1' || phase === 'SETUP_ROAD_2') return 'road';
        const mode = this.renderer.activeMode;
        if (mode === 'build_settlement') return 'settlement';
        if (mode === 'build_city') return 'city';
        if (mode === 'build_road') return 'road';
        return null;
    }

    // Can this piece be picked up right now?
    canPlace(kind) {
        if (!this.isMyTurn()) return false;
        const g = this.game;
        const me = g.players[this.mySeat];
        const phase = g.phase;
        const building = phase === 'ACTION' && g.diceRolled;

        if (kind === 'settlement') {
            if (phase === 'SETUP_SETTLEMENT_1' || phase === 'SETUP_SETTLEMENT_2') return true;
            return building && me.settlementsLeft > 0 && g.hasResources(me.id, COSTS.settlement);
        }
        if (kind === 'road') {
            if (phase === 'SETUP_ROAD_1' || phase === 'SETUP_ROAD_2') return true;
            if (phase === 'ACTION' && g.freeRoads > 0) return true;
            return building && me.roadsLeft > 0 && g.hasResources(me.id, COSTS.road);
        }
        if (kind === 'city') return building && me.citiesLeft > 0 && g.hasResources(me.id, COSTS.city);
        return false;
    }

    // Nearest legal spot for a piece, within a forgiving radius
    findTarget(kind, world) {
        const b = this.board;
        const g = this.game;
        const pid = g.turnIndex;
        const isSetup = g.phase.startsWith('SETUP');
        let best = null;
        let bestDist = kind === 'road' ? 32 : 40;

        if (kind === 'road') {
            const from = isSetup ? g.lastSetupVertexId : null;
            b.edges.forEach(e => {
                if (!b.canBuildRoad(e.id, pid, from)) return;
                const d = BoardGraph.distanceToSegment(world.x, world.y, b.vertices[e.v1], b.vertices[e.v2]);
                if (d < bestDist) { bestDist = d; best = e.id; }
            });
        } else {
            b.vertices.forEach(v => {
                const ok = kind === 'city' ? b.canBuildCity(v.id, pid) : b.canBuildSettlement(v.id, pid, isSetup);
                if (!ok) return;
                const d = Math.hypot(v.x - world.x, v.y - world.y);
                if (d < bestDist) { bestDist = d; best = v.id; }
            });
        }
        return best;
    }

    pointerOnCanvas(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
        return { x, y, inside, world: this.renderer.toWorld(x, y) };
    }

    updatePreview(e) {
        const kind = this.placementKind();
        if (!kind) {
            this.renderer.preview = null;
            return;
        }
        const p = this.pointerOnCanvas(e);
        this.renderer.preview = {
            kind,
            target: p.inside ? this.findTarget(kind, p.world) : null,
            x: p.x,
            y: p.y,
            dragging: !!this.drag && p.inside
        };
    }

    placePiece(kind, target) {
        if (kind === 'road') {
            this.dispatch('build_road', { edgeId: target });
            const setup = this.game.phase.startsWith('SETUP');
            if (!setup && this.game.freeRoads <= 1) this.renderer.activeMode = null;
        } else if (kind === 'city') {
            this.dispatch('build_city', { vertexId: target });
            this.renderer.activeMode = null;
        } else {
            this.dispatch('build_settlement', { vertexId: target });
            this.renderer.activeMode = null;
        }
        this.renderer.preview = null;
    }

    bindCanvasEvents() {
        this.canvas.addEventListener('pointermove', (e) => {
            const p = this.pointerOnCanvas(e);
            this.renderer.hoverHex = this.board.getNearestHex(p.world.x, p.world.y);
            if (!this.drag) this.updatePreview(e);
        });

        this.canvas.addEventListener('pointerleave', () => {
            this.renderer.hoverHex = null;
            if (!this.drag) this.renderer.preview = null;
        });

        // Click to place (or to move the robber)
        this.canvas.addEventListener('click', (e) => {
            if (!this.isMyTurn()) return;
            const p = this.pointerOnCanvas(e);

            if (this.game.phase === 'ROBBER_MOVE') {
                const hex = this.board.getNearestHex(p.world.x, p.world.y);
                if (hex) this.dispatch('move_robber', { hexId: hex.id });
                return;
            }

            const kind = this.placementKind();
            if (!kind) return;
            const target = this.findTarget(kind, p.world);
            if (target !== null) this.placePiece(kind, target);
        });

        // Drag a piece from the hand bar onto the board
        const pieces = document.getElementById('hand-pieces');
        pieces.addEventListener('pointerdown', (e) => {
            const el = e.target.closest('[data-piece]');
            if (!el) return;
            const kind = el.dataset.piece;
            if (!this.canPlace(kind)) return;
            e.preventDefault();
            this.drag = { kind, prevMode: this.renderer.activeMode };
            this.renderer.activeMode = null;
            document.body.classList.add('is-dragging');
            this.updatePreview(e);
        });

        document.addEventListener('pointermove', (e) => {
            if (this.drag) this.updatePreview(e);
        });

        document.addEventListener('pointerup', (e) => {
            if (!this.drag) return;
            const { kind, prevMode } = this.drag;
            const p = this.pointerOnCanvas(e);
            const target = p.inside ? this.findTarget(kind, p.world) : null;
            this.drag = null;
            document.body.classList.remove('is-dragging');
            if (target !== null && this.canPlace(kind)) {
                this.placePiece(kind, target);
                return;
            }
            this.renderer.preview = null;

            // Released on the same piece without dragging: treat it as a tap,
            // which picks the piece so the next click on the board places it
            const tapped = e.target.closest && e.target.closest('[data-piece]');
            if (!p.inside && tapped && tapped.dataset.piece === kind) {
                const mode = `build_${kind}`;
                this.renderer.activeMode = prevMode === mode ? null : mode;
                this.ui.updateButtons();
            }
        });
    }

    startLoop() {
        const loop = () => {
            this.renderer.interactive = this.isMyTurn();
            this.renderer.render();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
}

// Boot up game when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    window.hexlandApp = new HexlandApp();
});

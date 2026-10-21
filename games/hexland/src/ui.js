// Hexland - Retro Pixel UI & Online Friends Multiplayer Controller
//
// Every device shows the same board, but only its own hand. Buttons only work
// on the device whose turn it is; everyone else watches.

class HexlandUI {
    constructor(game, renderer, soundFX, onAction) {
        this.game = game;
        this.renderer = renderer;
        this.soundFX = soundFX;
        this.onAction = onAction;

        this.mySeat = null;
        this.roomLink = '';

        // Set by the app
        this.onLobbySubmit = null;
        this.onStartGame = null;
        this.onNewGame = null;

        this.initDOMElements();
        this.bindEvents();
    }

    initDOMElements() {
        this.turnBanner = document.getElementById('turn-banner');
        this.instructionText = document.getElementById('instruction-text');
        this.die1El = document.getElementById('die-1');
        this.die2El = document.getElementById('die-2');

        this.rollBtn = document.getElementById('btn-roll');
        this.devCardBtn = document.getElementById('btn-dev');
        this.tradeBtn = document.getElementById('btn-trade');
        this.endTurnBtn = document.getElementById('btn-end-turn');

        this.bankContainer = document.getElementById('bank-resources');
        this.bankDevCount = document.getElementById('bank-dev-count');
        this.handResources = document.getElementById('hand-resources');
        this.handDevCards = document.getElementById('hand-dev-cards');
        this.handPieces = document.getElementById('hand-pieces');
        this.handOwner = document.getElementById('hand-owner');
        this.playersList = document.getElementById('players-list');
        this.logContainer = document.getElementById('game-logs');

        // Lobby
        this.lobbyModal = document.getElementById('lobby-modal');
        this.lobbyTitle = document.getElementById('lobby-title');
        this.lobbySub = document.getElementById('lobby-sub');
        this.lobbyStepName = document.getElementById('lobby-step-name');
        this.lobbyNameInput = document.getElementById('lobby-name');
        this.btnLobbyGo = document.getElementById('btn-lobby-go');
        this.lobbyStepRoom = document.getElementById('lobby-step-room');
        this.lobbyLinkInput = document.getElementById('lobby-link');
        this.btnLobbyCopy = document.getElementById('btn-lobby-copy');
        this.lobbyPlayersList = document.getElementById('lobby-players');
        this.lobbyCount = document.getElementById('lobby-count');
        this.btnStartGame = document.getElementById('btn-start-game');
        this.lobbyWait = document.getElementById('lobby-wait');
        this.lobbyError = document.getElementById('lobby-error');

        // Room Link Modal
        this.roomModal = document.getElementById('room-modal');
        this.btnRoomShare = document.getElementById('btn-room-share');
        this.btnCopyRoom = document.getElementById('btn-copy-room');
        this.btnCloseRoom = document.getElementById('btn-close-room');
        this.roomLinkInput = document.getElementById('room-link-input');

        // Gameplay Modals
        this.tradeModal = document.getElementById('trade-modal');
        this.devModal = document.getElementById('dev-modal');
        this.stealModal = document.getElementById('steal-modal');
        this.discardModal = document.getElementById('discard-modal');
        this.victoryModal = document.getElementById('victory-modal');
        this.connectionModal = document.getElementById('connection-modal');
    }

    get me() {
        return this.mySeat !== null ? this.game.players[this.mySeat] : null;
    }

    isMyTurn() {
        return this.mySeat !== null && this.game.turnIndex === this.mySeat && this.game.phase !== 'GAME_OVER';
    }

    bindEvents() {
        this.rollBtn.addEventListener('click', () => this.onAction('roll'));
        this.tradeBtn.addEventListener('click', () => this.openTradeModal());
        this.devCardBtn.addEventListener('click', () => this.openDevModal());
        this.endTurnBtn.addEventListener('click', () => {
            this.renderer.activeMode = null;
            this.onAction('end_turn');
        });

        // Rules modal
        const rulesModal = document.getElementById('rules-modal');
        document.getElementById('btn-rules').addEventListener('click', () => rulesModal.classList.add('active'));
        document.getElementById('close-rules-btn').addEventListener('click', () => rulesModal.classList.remove('active'));

        // Reload after losing the connection
        document.getElementById('btn-reload').addEventListener('click', () => location.reload());

        // Sound Mute Toggle
        const muteBtn = document.getElementById('btn-mute');
        if (muteBtn) {
            muteBtn.addEventListener('click', () => {
                const muted = this.soundFX.toggleMute();
                muteBtn.textContent = muted ? '🔇 Muted' : '🔊 Sound On';
            });
        }

        // Lobby
        const submitName = () => {
            const name = this.lobbyNameInput.value.trim().slice(0, 16);
            if (!name) {
                this.showLobbyError('Please enter your name.');
                return;
            }
            if (this.onLobbySubmit) this.onLobbySubmit(name);
        };
        this.btnLobbyGo.addEventListener('click', submitName);
        this.lobbyNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitName(); });
        this.btnStartGame.addEventListener('click', () => { if (this.onStartGame) this.onStartGame(); });
        this.bindCopyButton(this.btnLobbyCopy, this.lobbyLinkInput);

        // Room Link Modal
        this.btnRoomShare.addEventListener('click', () => {
            this.roomLinkInput.value = this.roomLink || window.location.href;
            this.roomModal.classList.add('active');
        });
        this.btnCloseRoom.addEventListener('click', () => this.roomModal.classList.remove('active'));
        this.bindCopyButton(this.btnCopyRoom, this.roomLinkInput);
    }

    // The clipboard API can be refused (no permission, page not focused,
    // older browser), so fall back to the classic copy command, and as a
    // last resort leave the link selected for Ctrl+C
    bindCopyButton(btn, input) {
        const flash = (text) => {
            btn.textContent = text;
            clearTimeout(btn._copyTimer);
            btn._copyTimer = setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
        };
        const legacyCopy = () => {
            input.focus();
            input.select();
            input.setSelectionRange(0, input.value.length);
            let ok = false;
            try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
            flash(ok ? '✓ Copied!' : 'Press Ctrl+C');
        };

        btn.addEventListener('click', () => {
            if (!input.value) return;
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(input.value).then(() => flash('✓ Copied!'), legacyCopy);
            } else {
                legacyCopy();
            }
        });
    }

    // ---------- Lobby ----------

    showLobbyName(mode, name, code) {
        this.lobbyModal.classList.add('active');
        this.lobbyStepName.hidden = false;
        this.lobbyStepRoom.hidden = true;
        this.lobbyError.textContent = '';
        this.lobbyNameInput.value = name || '';
        this.btnLobbyGo.disabled = false;

        if (mode === 'join') {
            this.lobbyTitle.textContent = `👥 JOIN ROOM ${code}`;
            this.lobbySub.textContent = 'Enter your name to join your friend\'s game.';
            this.btnLobbyGo.textContent = '🚪 JOIN ROOM';
        } else {
            this.lobbyTitle.textContent = '👥 HEXLAND ONLINE';
            this.lobbySub.textContent = 'No bots! Create a room, then send the link to 1–3 friends. Everyone plays on their own device.';
            this.btnLobbyGo.textContent = '🏠 CREATE ROOM';
        }
        setTimeout(() => this.lobbyNameInput.focus(), 50);
    }

    setLobbyBusy(text) {
        this.lobbyError.textContent = '';
        this.btnLobbyGo.disabled = true;
        this.btnLobbyGo.textContent = text;
    }

    showLobbyError(message) {
        this.lobbyError.textContent = message;
        this.btnLobbyGo.disabled = false;
    }

    showLobbyRoom({ isHost, link, players, mySeat, canStart }) {
        this.lobbyModal.classList.add('active');
        this.lobbyStepName.hidden = true;
        this.lobbyStepRoom.hidden = false;
        this.lobbyError.textContent = '';
        this.lobbyTitle.textContent = '👥 WAITING ROOM';
        this.lobbySub.textContent = isHost
            ? 'Send this link to your friends. Start when everyone is in (2–4 players).'
            : 'You\'re in! Invite more friends with the link below.';

        this.lobbyLinkInput.value = link;
        this.lobbyCount.textContent = players.length;
        this.lobbyPlayersList.innerHTML = players.map((name, i) => `
            <div class="p-input-row">
                <span class="color-indicator" style="background:${PLAYER_COLORS[i].hex};"></span>
                <span class="lobby-player-name">${this.escape(name)}${i === mySeat ? ' (you)' : ''}${i === 0 ? ' 👑' : ''}</span>
            </div>
        `).join('');

        this.btnStartGame.hidden = !isHost;
        this.btnStartGame.disabled = !canStart;
        this.lobbyWait.textContent = isHost
            ? (canStart ? '' : 'Waiting for at least one friend to join...')
            : 'Waiting for the host to start the game...';
    }

    hideLobby() {
        this.lobbyModal.classList.remove('active');
    }

    showConnectionLost() {
        this.connectionModal.classList.add('active');
    }

    escape(str) {
        return String(str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[c]);
    }

    // ---------- In-game ----------

    toggleBuildMode(mode) {
        this.renderer.activeMode = this.renderer.activeMode === mode ? null : mode;
        this.updateButtons();
    }

    update() {
        const game = this.game;
        const curPlayer = game.getCurrentPlayer();
        const myTurn = this.isMyTurn();

        // Turn Banner
        this.turnBanner.textContent = myTurn ? '⭐ Your Turn!' : `${curPlayer.name}'s Turn`;
        this.turnBanner.style.color = curPlayer.color.light;

        this.instructionText.textContent = this.getInstruction(myTurn, curPlayer);

        // Phase-driven popups
        if (game.phase === 'ROBBER_DISCARD') this.checkDiscardModal();
        else this.discardModal.classList.remove('active');

        if (game.phase === 'ROBBER_STEAL' && myTurn) this.openStealModal();
        else this.stealModal.classList.remove('active');

        if (!myTurn) {
            this.renderer.activeMode = null;
            this.tradeModal.classList.remove('active');
            this.devModal.classList.remove('active');
        } else {
            // Keep open windows in sync with the latest cards
            if (this.tradeModal.classList.contains('active')) this.openTradeModal();
            if (this.devModal.classList.contains('active') && !this.devModal.dataset.picking) this.openDevModal();
        }

        if (!this.diceRolling) {
            this.showDie(this.die1El, game.dice[0]);
            this.showDie(this.die2El, game.dice[1]);
        }

        this.updateButtons();
        this.renderBank();
        this.renderHand();
        this.renderScoreboard();
        this.renderLogs();

        if (game.winner && !this.victoryModal.classList.contains('active')) {
            this.soundFX.playVictory();
            this.openVictoryModal();
        } else if (!game.winner) {
            this.victoryModal.classList.remove('active');
        }
    }

    // Dice faces come from assets/images/dice_1.png ... dice_6.png
    showDie(el, n) {
        const face = Number.isInteger(n) && n >= 1 && n <= 6;
        el.classList.toggle('die-face', face);
        el.style.backgroundImage = face ? `url(assets/images/dice_${n}.png)` : '';
        el.textContent = face ? '' : '?';
        el.setAttribute('aria-label', face ? `Die: ${n}` : 'Die');
    }

    // Short tumble before landing on the rolled faces
    animateDiceRoll() {
        if (this.diceRolling) return;
        this.diceRolling = true;
        this.die1El.classList.add('rolling');
        this.die2El.classList.add('rolling');
        let frame = 0;
        const rand = () => 1 + Math.floor(Math.random() * 6);
        const tick = () => {
            if (frame++ < 8) {
                this.showDie(this.die1El, rand());
                this.showDie(this.die2El, rand());
                setTimeout(tick, 55);
                return;
            }
            this.diceRolling = false;
            this.die1El.classList.remove('rolling');
            this.die2El.classList.remove('rolling');
            this.showDie(this.die1El, this.game.dice[0]);
            this.showDie(this.die2El, this.game.dice[1]);
        };
        tick();
    }

    getInstruction(myTurn, curPlayer) {
        const phase = this.game.phase;
        const name = curPlayer.name;

        if (phase === 'GAME_OVER') return 'Game over!';

        if (phase === 'ROBBER_DISCARD') {
            const pending = this.game.pendingDiscards;
            if (pending.some(d => d.playerId === this.mySeat)) return 'You have too many cards: choose which ones to discard.';
            const who = pending.map(d => this.game.players[d.playerId].name).join(', ') || 'Players';
            return `Waiting for ${who} to discard cards...`;
        }

        if (!myTurn) {
            if (phase.startsWith('SETUP_SETTLEMENT')) return `${name} is placing a settlement...`;
            if (phase.startsWith('SETUP_ROAD')) return `${name} is placing a road...`;
            if (phase === 'ROBBER_MOVE') return `${name} is moving the robber...`;
            if (phase === 'ROBBER_STEAL') return `${name} is choosing who to steal from...`;
            if (!this.game.diceRolled) return `Waiting for ${name} to roll the dice...`;
            return `${name} is building and trading. Watch the board!`;
        }

        if (phase === 'SETUP_SETTLEMENT_1' || phase === 'SETUP_SETTLEMENT_2') return 'Drag a SETTLEMENT from your hand onto a corner (or click a corner).';
        if (phase === 'SETUP_ROAD_1' || phase === 'SETUP_ROAD_2') return 'Drag a ROAD next to your new settlement (or click an edge).';
        if (phase === 'ROBBER_MOVE') return '🦹 Click the tile where you want to place the robber!';
        if (phase === 'ROBBER_STEAL') return 'Choose a player to steal a card from.';
        if (this.game.freeRoads > 0) return `🚧 Place ${this.game.freeRoads} free road${this.game.freeRoads > 1 ? 's' : ''}.`;
        if (!this.game.diceRolled) return 'Roll the dice to start your turn.';
        return 'Build, trade or end your turn.';
    }

    updateButtons() {
        const me = this.me;
        const myTurn = this.isMyTurn();
        const inAction = this.game.phase === 'ACTION';
        const rolled = this.game.diceRolled;
        const canAct = myTurn && inAction && rolled;

        this.rollBtn.disabled = !myTurn || !inAction || rolled;

        this.tradeBtn.disabled = !canAct;
        this.devCardBtn.disabled = !myTurn || !inAction;
        this.endTurnBtn.disabled = !canAct;

        // A tapped piece in the hand stays highlighted while it waits for a spot
        this.handPieces.querySelectorAll('[data-piece]').forEach(el => {
            el.classList.toggle('active-mode', this.renderer.activeMode === `build_${el.dataset.piece}`);
        });
    }

    // Bank supply in the sidebar, shown with the same card art as the hand
    renderBank() {
        const bank = this.game.bank || {};
        this.bankContainer.innerHTML = Object.entries(RESOURCE_NAMES).map(([key, name]) => `
            <div class="bank-card res-art res-${key} ${bank[key] === 0 ? 'res-empty' : ''}" title="${name}: ${bank[key] ?? 0} left in the bank">
                <span class="hand-card-count">${bank[key] ?? 0}</span>
            </div>
        `).join('');
        this.bankDevCount.textContent = this.game.devCardDeck.length;
    }

    // My own cards, held at the bottom of the screen
    renderHand() {
        const me = this.me;
        if (!me || !me.resources) {
            this.handOwner.textContent = '';
            this.handResources.innerHTML = '';
            this.handDevCards.innerHTML = '';
            this.handPieces.innerHTML = '';
            return;
        }

        this.renderPieces(me);

        this.handOwner.textContent = `${me.name}'s hand`;
        this.handOwner.style.color = me.color.light;

        this.handResources.innerHTML = Object.entries(RESOURCE_NAMES).map(([key, name]) => {
            const count = me.resources[key] || 0;
            return `
                <div class="hand-card art-card res-art res-${key} ${count === 0 ? 'is-empty' : ''}" title="${name}">
                    <span class="hand-card-icon">${RESOURCE_ICONS[key]}</span>
                    <span class="hand-card-name">${name}</span>
                    <span class="hand-card-count">${count}</span>
                </div>`;
        }).join('');

        const devCounts = {};
        (me.devCards || []).forEach(t => { devCounts[t] = (devCounts[t] || 0) + 1; });
        this.handDevCards.innerHTML = Object.entries(devCounts).map(([type, n]) => `
            <div class="hand-card dev-hand-card" title="${DEV_CARD_INFO[type].desc}">
                <span class="hand-card-icon">🎴</span>
                <span class="hand-card-name">${DEV_CARD_INFO[type].name}</span>
                <span class="hand-card-count">${n}</span>
            </div>
        `).join('');
    }

    // Draggable pieces: settlement, city, road
    renderPieces(me) {
        const app = window.hexlandApp;
        const pieces = [
            { kind: 'settlement', name: 'Settlement', left: me.settlementsLeft },
            { kind: 'city', name: 'City', left: me.citiesLeft },
            { kind: 'road', name: 'Road', left: me.roadsLeft }
        ];
        this.handPieces.innerHTML = '';
        pieces.forEach(p => {
            const ready = app && app.canPlace(p.kind);
            const el = document.createElement('div');
            const active = this.renderer.activeMode === `build_${p.kind}`;
            el.className = `hand-card piece-card ${ready ? 'is-ready' : 'is-empty'} ${active ? 'active-mode' : ''}`;
            el.dataset.piece = p.kind;
            el.title = ready ? `Drag onto the board to place a ${p.name.toLowerCase()}` : p.name;

            const icon = document.createElement('canvas');
            icon.width = 44;
            icon.height = 40;
            icon.className = 'piece-icon';
            this.renderer.drawPieceIcon(icon, p.kind, me.color.hex);

            const name = document.createElement('span');
            name.className = 'hand-card-name';
            name.textContent = p.name;
            const count = document.createElement('span');
            count.className = 'hand-card-count';
            count.textContent = p.left;

            el.append(icon, name, count);
            this.handPieces.appendChild(el);
        });
    }

    renderScoreboard() {
        this.playersList.innerHTML = '';

        this.game.players.forEach(p => {
            const isTurn = p.id === this.game.turnIndex;
            const isMe = p.id === this.mySeat;
            const totalRes = this.game.getTotalResourceCount(p.id);
            const devCount = p.devCards ? p.devCards.length : (p.devCardCount || 0);

            const row = document.createElement('div');
            row.className = `player-row ${isTurn ? 'current-player-row' : ''}`;
            row.style.borderLeftColor = p.color.hex;

            let badges = '';
            if (this.game.longestRoadOwner === p.id) badges += '<span class="badge" title="Longest Road">🚩 Road</span>';
            if (this.game.largestArmyOwner === p.id) badges += '<span class="badge" title="Largest Army">⚔️ Army</span>';
            if (p.online === false) badges += '<span class="badge offline" title="Disconnected">📴</span>';

            const vp = isMe ? p.victoryPoints : p.publicVP;
            row.innerHTML = `
                <div class="p-info">
                    <span class="p-dot" style="background:${p.color.hex}"></span>
                    <span class="p-name">${this.escape(p.name)}${isMe ? ' (you)' : ''}</span>
                    ${badges}
                </div>
                <div class="p-stats">
                    <span class="p-vp" title="Victory Points">🏆 ${vp} VP</span>
                    <span class="p-cards" title="Resource cards">🃏 ${totalRes}</span>
                    <span class="p-cards" title="Development cards">🎴 ${devCount}</span>
                </div>
            `;

            this.playersList.appendChild(row);
        });
    }

    renderLogs() {
        this.logContainer.innerHTML = '';
        this.game.logs.forEach(l => {
            const entry = document.createElement('div');
            entry.className = 'log-entry';
            entry.textContent = l;
            this.logContainer.appendChild(entry);
        });
    }

    closeButton(modal) {
        modal.querySelector('.close-modal-btn').addEventListener('click', () => {
            modal.classList.remove('active');
            delete modal.dataset.picking;
        });
    }

    openTradeModal() {
        const me = this.me;
        if (!me || !this.isMyTurn()) return;
        const rates = this.game.getPlayerTradeRates(me.id);
        const bank = this.game.bank;

        let html = `
            <div class="modal-box">
                <h3>🤝 Bank & Harbor Trade</h3>
                <p>Trade resources with the bank at your current rates:</p>
                <div class="trade-grid">
        `;

        Object.values(RESOURCES).forEach(give => {
            const rate = rates[give];
            const canGive = me.resources[give] >= rate;

            html += `
                <div class="trade-card ${canGive ? '' : 'disabled'}">
                    <div><strong>${RESOURCE_ICONS[give]} ${RESOURCE_NAMES[give]}</strong> (${rate}:1)</div>
                    <small>In hand: ${me.resources[give]}</small>
                    <div class="trade-targets">
            `;

            Object.values(RESOURCES).forEach(get => {
                if (get !== give) {
                    const ok = canGive && bank[get] > 0;
                    html += `
                        <button class="pixel-btn micro-btn" ${ok ? '' : 'disabled'} data-give="${give}" data-get="${get}" title="Bank has ${bank[get]}">
                            +1 ${RESOURCE_ICONS[get]}
                        </button>
                    `;
                }
            });

            html += `</div></div>`;
        });

        html += `
                </div>
                <button class="pixel-btn red-btn close-modal-btn">Close</button>
            </div>
        `;

        this.tradeModal.innerHTML = html;
        this.tradeModal.classList.add('active');

        this.tradeModal.querySelectorAll('button[data-give]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.onAction('bank_trade', {
                    give: e.currentTarget.getAttribute('data-give'),
                    get: e.currentTarget.getAttribute('data-get')
                });
            });
        });
        this.closeButton(this.tradeModal);
    }

    openDevModal() {
        const me = this.me;
        if (!me || !this.isMyTurn()) return;
        const canBuy = this.game.diceRolled && this.game.hasResources(me.id, COSTS.devCard) && this.game.devCardDeck.length > 0;

        let cardsHtml = '';
        if (me.devCards.length === 0) {
            cardsHtml = '<p class="empty-msg">You have no development cards yet.</p>';
        } else {
            me.devCards.forEach(type => {
                const info = DEV_CARD_INFO[type];
                const canPlay = !this.game.activeDevCardPlayedThisTurn && this.game.playableDevCardCount(me.id, type) > 0;

                cardsHtml += `
                    <div class="dev-card-item">
                        <div>
                            <strong>${info.name}</strong>
                            <p>${info.desc}</p>
                        </div>
                        ${type !== DEV_CARD_TYPES.VICTORY_POINT ? `
                            <button class="pixel-btn green-btn play-dev-btn" data-type="${type}" ${canPlay ? '' : 'disabled'}>
                                Play
                            </button>
                        ` : '<span class="badge">Automatic VP</span>'}
                    </div>
                `;
            });
        }

        this.devModal.innerHTML = `
            <div class="modal-box">
                <h3>🎴 Development Cards</h3>
                <div class="dev-buy-box">
                    <div>
                        <strong>Buy a New Card</strong>
                        <p>Cost: 1 Wool, 1 Grain, 1 Ore (Left: ${this.game.devCardDeck.length})</p>
                    </div>
                    <button id="btn-buy-dev-modal" class="pixel-btn ${canBuy ? 'green-btn' : ''}" ${canBuy ? '' : 'disabled'}>
                        Buy
                    </button>
                </div>
                <hr class="pixel-hr">
                <h4>Your Cards:</h4>
                <div class="dev-list">${cardsHtml}</div>
                <button class="pixel-btn red-btn close-modal-btn">Close</button>
            </div>
        `;
        delete this.devModal.dataset.picking;
        this.devModal.classList.add('active');

        this.devModal.querySelector('#btn-buy-dev-modal').addEventListener('click', () => this.onAction('buy_dev'));
        this.devModal.querySelectorAll('.play-dev-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handlePlayDevCard(e.currentTarget.getAttribute('data-type')));
        });
        this.closeButton(this.devModal);
    }

    handlePlayDevCard(type) {
        if (type === DEV_CARD_TYPES.MONOPOLY) {
            this.pickResources('💰 Monopoly', 'Pick a resource. You take every card of it from all other players.', 1, false,
                ([resource]) => this.onAction('play_dev', { type, resource }));
        } else if (type === DEV_CARD_TYPES.YEAR_OF_PLENTY) {
            this.pickResources('🌾 Year of Plenty', 'Pick 2 resources to take from the bank.', 2, true,
                ([res1, res2]) => this.onAction('play_dev', { type, res1, res2 }));
        } else {
            this.devModal.classList.remove('active');
            this.onAction('play_dev', { type });
        }
    }

    // Small in-game picker instead of browser prompts
    pickResources(title, text, count, fromBank, done) {
        const picked = [];
        const render = () => {
            const bank = this.game.bank;
            this.devModal.innerHTML = `
                <div class="modal-box">
                    <h3>${title}</h3>
                    <p>${text}</p>
                    <div class="pick-grid">
                        ${Object.values(RESOURCES).map(r => {
                            const left = bank[r] - picked.filter(p => p === r).length;
                            const disabled = fromBank && left <= 0;
                            return `<button class="pixel-btn pick-btn" data-res="${r}" ${disabled ? 'disabled' : ''}>
                                ${RESOURCE_ICONS[r]} ${RESOURCE_NAMES[r]}
                            </button>`;
                        }).join('')}
                    </div>
                    <p class="pick-status">${count > 1 ? `Picked: ${picked.map(r => RESOURCE_ICONS[r]).join(' ') || '–'}` : ''}</p>
                    <button class="pixel-btn red-btn close-modal-btn">Cancel</button>
                </div>
            `;
            this.devModal.querySelectorAll('.pick-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    picked.push(btn.dataset.res);
                    if (picked.length >= count) {
                        delete this.devModal.dataset.picking;
                        this.devModal.classList.remove('active');
                        done(picked);
                    } else {
                        render();
                    }
                });
            });
            this.closeButton(this.devModal);
        };
        this.devModal.dataset.picking = '1';
        render();
    }

    openStealModal() {
        if (this.game.stealTargets.length === 0) return;

        const buttonsHtml = this.game.stealTargets.map(tId => {
            const target = this.game.players[tId];
            return `
                <button class="pixel-btn steal-target-btn" data-id="${tId}" style="border-color:${target.color.hex}">
                    ${this.escape(target.name)} (${this.game.getTotalResourceCount(tId)} cards)
                </button>
            `;
        }).join('');

        this.stealModal.innerHTML = `
            <div class="modal-box">
                <h3>🗡️ Steal a Card</h3>
                <p>Which friend next to the robber's tile do you want to steal 1 random card from?</p>
                <div class="steal-btns">${buttonsHtml}</div>
            </div>
        `;
        this.stealModal.classList.add('active');

        this.stealModal.querySelectorAll('.steal-target-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.stealModal.classList.remove('active');
                this.onAction('steal', { victimId: parseInt(e.currentTarget.getAttribute('data-id')) });
            });
        });
    }

    checkDiscardModal() {
        const me = this.me;
        const pending = me && this.game.pendingDiscards.find(d => d.playerId === me.id);
        if (!pending) {
            this.discardModal.classList.remove('active');
            return;
        }
        // Already showing this request: keep what the player typed
        if (this.discardModal.classList.contains('active')) return;

        const toDiscardCount = pending.count;
        const pickerHtml = Object.values(RESOURCES).map(res => `
            <div class="discard-row">
                <span>${RESOURCE_ICONS[res]} ${RESOURCE_NAMES[res]} (Have: ${me.resources[res]}):</span>
                <input type="number" min="0" max="${me.resources[res]}" value="0" class="discard-input" data-res="${res}">
            </div>
        `).join('');

        this.discardModal.innerHTML = `
            <div class="modal-box">
                <h3>⚠️ Discard Extra Cards</h3>
                <p>${this.escape(me.name)}, you have more than 7 cards, so you must discard <strong>${toDiscardCount}</strong>!</p>
                <div class="discard-list">${pickerHtml}</div>
                <div id="discard-err" class="err-text"></div>
                <button id="confirm-discard-btn" class="pixel-btn red-btn">Discard</button>
            </div>
        `;
        this.discardModal.classList.add('active');

        this.discardModal.querySelector('#confirm-discard-btn').addEventListener('click', () => {
            const toDiscard = {};
            let sum = 0;
            this.discardModal.querySelectorAll('.discard-input').forEach(input => {
                const val = parseInt(input.value) || 0;
                toDiscard[input.getAttribute('data-res')] = val;
                sum += val;
            });

            if (sum !== toDiscardCount) {
                this.discardModal.querySelector('#discard-err').textContent = `You must select exactly ${toDiscardCount} cards! (Selected: ${sum})`;
                return;
            }
            this.discardModal.classList.remove('active');
            this.onAction('discard', { resources: toDiscard });
        });
    }

    openVictoryModal() {
        const winner = this.game.winner;
        const isHost = this.mySeat === 0;
        this.victoryModal.innerHTML = `
            <div class="modal-box victory-box">
                <h1>🏆 VICTORY! 🏆</h1>
                <h2>${this.escape(winner.name)} WINS!</h2>
                <p>First ruler to reach 10 Victory Points!</p>
                <div class="victory-stats">
                    <p>Victory Points: ${winner.victoryPoints}</p>
                    <p>Longest Road: ${this.game.calculateLongestRoad(winner.id)}</p>
                    <p>Knights Played: ${winner.playedKnights}</p>
                </div>
                ${isHost
                    ? '<button id="btn-restart" class="pixel-btn green-btn">Start New Game</button>'
                    : '<p class="lobby-sub">Waiting for the host to start a new game...</p>'}
            </div>
        `;
        this.victoryModal.classList.add('active');

        const restart = this.victoryModal.querySelector('#btn-restart');
        if (restart) restart.addEventListener('click', () => { if (this.onNewGame) this.onNewGame(); });
    }
}

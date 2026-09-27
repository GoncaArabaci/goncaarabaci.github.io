// Hexland - Game State Engine & Full Rules Implementation


class HexlandGame {
    constructor(board, playerConfigs = []) {
        this.board = board;
        this.players = [];
        this.turnIndex = 0;
        this.phase = 'SETUP_SETTLEMENT_1';
        this.setupStep = 0; // 0..3 for forward, 4..7 for reverse snake draft
        this.dice = [1, 1];
        this.diceRolled = false;

        this.longestRoadOwner = null;
        this.longestRoadLength = 4; // strictly > 4 to claim (min 5)

        this.largestArmyOwner = null;
        this.largestArmyCount = 2;  // strictly > 2 to claim (min 3)

        this.devCardDeck = [];
        this.activeDevCardPlayedThisTurn = false;
        this.boughtDevCardThisTurn = [];

        this.lastSetupVertexId = null;
        this.pendingDiscards = [];
        this.stealTargets = [];
        this.winner = null;

        this.logs = [];

        // Bank supply: 19 cards of each resource
        this.bank = {};
        Object.values(RESOURCES).forEach(r => { this.bank[r] = BANK_SIZE; });

        // Free roads left from a Road Building card
        this.freeRoads = 0;

        this.initPlayers(playerConfigs);
        this.initDevCardDeck();
    }

    initPlayers(playerConfigs) {
        const count = playerConfigs.length || 4;
        this.players = [];

        for (let i = 0; i < count; i++) {
            const config = playerConfigs[i] || {};
            const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
            this.players.push({
                id: i,
                name: config.name || `Player ${i + 1}`,
                isAI: false, // Purely friends, no bots!
                color,
                resources: {
                    [RESOURCES.WOOD]: 0,
                    [RESOURCES.BRICK]: 0,
                    [RESOURCES.SHEEP]: 0,
                    [RESOURCES.WHEAT]: 0,
                    [RESOURCES.ORE]: 0
                },
                devCards: [],
                playedKnights: 0,
                roadsLeft: 15,
                settlementsLeft: 5,
                citiesLeft: 4,
                victoryPoints: 0,
                publicVP: 0
            });
        }
    }

    initDevCardDeck() {
        const deck = [];
        for (let i = 0; i < 14; i++) deck.push(DEV_CARD_TYPES.KNIGHT);
        for (let i = 0; i < 5; i++) deck.push(DEV_CARD_TYPES.VICTORY_POINT);
        for (let i = 0; i < 2; i++) deck.push(DEV_CARD_TYPES.ROAD_BUILDING);
        for (let i = 0; i < 2; i++) deck.push(DEV_CARD_TYPES.YEAR_OF_PLENTY);
        for (let i = 0; i < 2; i++) deck.push(DEV_CARD_TYPES.MONOPOLY);

        this.devCardDeck = deck.sort(() => Math.random() - 0.5);
    }

    log(msg) {
        this.logs.unshift(msg);
        if (this.logs.length > 50) this.logs.pop();
    }

    getCurrentPlayer() {
        return this.players[this.turnIndex];
    }

    getTotalResourceCount(playerId) {
        const p = this.players[playerId];
        // Other players' hands are hidden online: only the card count is known
        if (!p.resources) return p.handCount || 0;
        return Object.values(p.resources).reduce((a, b) => a + b, 0);
    }

    hasResources(playerId, cost) {
        const pRes = this.players[playerId].resources;
        if (!pRes) return false;
        for (const [res, amount] of Object.entries(cost)) {
            if ((pRes[res] || 0) < amount) return false;
        }
        return true;
    }

    // Paid cards go back to the bank
    deductResources(playerId, cost) {
        const pRes = this.players[playerId].resources;
        for (const [res, amount] of Object.entries(cost)) {
            pRes[res] -= amount;
            this.bank[res] += amount;
        }
    }

    // Gives up to `amount` cards from the bank, returns how many were given
    takeFromBank(playerId, res, amount = 1) {
        const given = Math.min(amount, this.bank[res]);
        this.bank[res] -= given;
        this.players[playerId].resources[res] += given;
        return given;
    }

    addResources(playerId, resourcesToAdd) {
        const pRes = this.players[playerId].resources;
        for (const [res, amount] of Object.entries(resourcesToAdd)) {
            pRes[res] = (pRes[res] || 0) + amount;
        }
    }

    // Roll Dice
    rollDice() {
        if (this.diceRolled || this.phase !== 'ACTION') return null;

        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        this.dice = [d1, d2];
        const sum = d1 + d2;
        this.diceRolled = true;

        this.log(`🎲 ${this.getCurrentPlayer().name} rolled: ${d1} + ${d2} = ${sum}`);

        if (sum === 7) {
            this.handleRollSeven();
        } else {
            this.distributeResources(sum);
        }

        return { sum, dice: this.dice };
    }

    distributeResources(rollSum) {
        const claims = [];

        this.board.hexes.forEach(hex => {
            if (hex.number === rollSum && hex.id !== this.board.robberHexId && hex.resource) {
                hex.vertexIds.forEach(vId => {
                    const vertex = this.board.vertices[vId];
                    if (vertex.building) {
                        claims.push({
                            playerId: vertex.building.owner,
                            resource: hex.resource,
                            amount: vertex.building.type === 'city' ? 2 : 1,
                            hexId: hex.id
                        });
                    }
                });
            }
        });

        // Bank shortage rule: if the bank can't cover a resource for everyone,
        // nobody gets it (unless only one player is owed it, who gets what's left)
        const harvests = [];
        Object.values(RESOURCES).forEach(res => {
            const resClaims = claims.filter(c => c.resource === res);
            if (resClaims.length === 0) return;
            const needed = resClaims.reduce((a, c) => a + c.amount, 0);
            const owners = new Set(resClaims.map(c => c.playerId));

            if (needed > this.bank[res] && owners.size > 1) {
                this.log(`🏦 The bank ran out of ${res}. Nobody receives it this roll.`);
                return;
            }
            resClaims.forEach(c => {
                const given = this.takeFromBank(c.playerId, res, c.amount);
                if (given > 0) harvests.push({ ...c, amount: given });
            });
        });

        if (harvests.length > 0) {
            const summary = harvests.map(h => `${this.players[h.playerId].name}: +${h.amount} ${h.resource}`).join(', ');
            this.log(`🌾 Harvest: ${summary}`);
        }

        return harvests;
    }

    handleRollSeven() {
        // Check 7+ card discard rule
        this.pendingDiscards = [];
        this.players.forEach(p => {
            const total = this.getTotalResourceCount(p.id);
            if (total > 7) {
                const toDiscard = Math.floor(total / 2);
                this.pendingDiscards.push({ playerId: p.id, count: toDiscard });
                this.log(`⚠️ ${p.name} has ${total} cards and must discard ${toDiscard}!`);
            }
        });

        if (this.pendingDiscards.length > 0) {
            this.phase = 'ROBBER_DISCARD';
            this.processNextDiscard();
        } else {
            this.phase = 'ROBBER_MOVE';
            this.log(`🦹 ${this.getCurrentPlayer().name} must move the robber to a new tile.`);
        }
    }

    processNextDiscard() {
        if (this.pendingDiscards.length === 0) {
            this.phase = 'ROBBER_MOVE';
            this.log(`🦹 ${this.getCurrentPlayer().name} must move the robber to a new tile.`);
            return;
        }

        const currentDiscard = this.pendingDiscards[0];
        const player = this.players[currentDiscard.playerId];

        // If player is AI, automatically discard random cards
        if (player.isAI) {
            this.autoDiscardForAI(player, currentDiscard.count);
            this.pendingDiscards.shift();
            this.processNextDiscard();
        }
    }

    autoDiscardForAI(player, count) {
        let remaining = count;
        const resKeys = Object.keys(player.resources);
        while (remaining > 0) {
            const available = resKeys.filter(k => player.resources[k] > 0);
            if (available.length === 0) break;
            const chosen = available[Math.floor(Math.random() * available.length)];
            player.resources[chosen]--;
            remaining--;
        }
        this.log(`🤖 ${player.name} discarded ${count} cards.`);
    }

    discardResources(playerId, discardedRes) {
        if (this.phase !== 'ROBBER_DISCARD') return false;
        const discardObj = this.pendingDiscards[0];
        if (!discardObj || discardObj.playerId !== playerId) return false;

        const totalDiscarded = Object.values(discardedRes).reduce((a, b) => a + b, 0);
        if (totalDiscarded !== discardObj.count) return false;

        const player = this.players[playerId];
        for (const [res, count] of Object.entries(discardedRes)) {
            if (player.resources[res] < count) return false;
        }

        for (const [res, count] of Object.entries(discardedRes)) {
            player.resources[res] -= count;
            this.bank[res] += count;
        }

        this.log(`🗑️ ${player.name} discarded ${totalDiscarded} cards.`);
        this.pendingDiscards.shift();
        this.processNextDiscard();
        return true;
    }

    moveRobber(hexId) {
        if (this.phase !== 'ROBBER_MOVE') return false;
        if (hexId === this.board.robberHexId) return false;

        this.board.robberHexId = hexId;
        const targetHex = this.board.hexes[hexId];
        this.log(`🦹 The robber moved to ${targetHex.terrain.name} (#${targetHex.number || 'Desert'}).`);

        // Find candidate players to steal from (having building on hex, not self, and has >=1 card)
        const victimCandidates = new Set();
        targetHex.vertexIds.forEach(vId => {
            const b = this.board.vertices[vId].building;
            if (b && b.owner !== this.turnIndex && this.getTotalResourceCount(b.owner) > 0) {
                victimCandidates.add(b.owner);
            }
        });

        this.stealTargets = Array.from(victimCandidates);

        if (this.stealTargets.length === 0) {
            this.phase = 'ACTION';
            return true;
        } else if (this.stealTargets.length === 1) {
            this.stealResource(this.stealTargets[0]);
            this.phase = 'ACTION';
            return true;
        } else {
            this.phase = 'ROBBER_STEAL';
            return true;
        }
    }

    stealResource(victimId) {
        const victim = this.players[victimId];
        const thief = this.getCurrentPlayer();
        const available = Object.keys(victim.resources).filter(k => victim.resources[k] > 0);

        if (available.length === 0) {
            this.phase = 'ACTION';
            return false;
        }

        // Steal random card from victim
        const pool = [];
        available.forEach(k => {
            for (let i = 0; i < victim.resources[k]; i++) pool.push(k);
        });

        const stolenRes = pool[Math.floor(Math.random() * pool.length)];
        victim.resources[stolenRes]--;
        thief.resources[stolenRes]++;

        this.log(`🗡️ ${thief.name} stole 1 card from ${victim.name}!`);
        this.phase = 'ACTION';
        return true;
    }

    // Build Actions
    buildRoad(edgeId, isFree = false) {
        const player = this.getCurrentPlayer();
        if (player.roadsLeft <= 0) return false;

        const isSetup = this.phase.startsWith('SETUP');
        const usesFreeRoad = !isSetup && this.freeRoads > 0;
        if (usesFreeRoad) isFree = true;
        if (!isFree && !isSetup) {
            if (!this.hasResources(player.id, COSTS.road)) return false;
        }

        const valid = this.board.canBuildRoad(
            edgeId,
            player.id,
            isSetup ? this.lastSetupVertexId : null
        );
        if (!valid) return false;

        this.board.edges[edgeId].road = { owner: player.id };
        player.roadsLeft--;
        if (usesFreeRoad) this.freeRoads--;

        if (!isFree && !isSetup) {
            this.deductResources(player.id, COSTS.road);
        }

        this.log(`🚧 ${player.name} built a road.`);
        this.updateLongestRoad();
        this.updateVictoryPoints();

        // Advance setup phase if applicable
        if (isSetup) {
            this.advanceSetup();
        }

        return true;
    }

    buildSettlement(vertexId, isFree = false) {
        const player = this.getCurrentPlayer();
        if (player.settlementsLeft <= 0) return false;
        if (this.phase === 'SETUP_ROAD_1' || this.phase === 'SETUP_ROAD_2') return false;

        const isSetup = this.phase.startsWith('SETUP');
        if (!isFree && !isSetup) {
            if (!this.hasResources(player.id, COSTS.settlement)) return false;
        }

        const valid = this.board.canBuildSettlement(vertexId, player.id, isSetup);
        if (!valid) return false;

        this.board.vertices[vertexId].building = {
            type: 'settlement',
            owner: player.id
        };
        player.settlementsLeft--;

        if (!isFree && !isSetup) {
            this.deductResources(player.id, COSTS.settlement);
        }

        this.log(`🏠 ${player.name} built a settlement.`);

        // In 2nd round of setup, award starting resources from adjacent hexes!
        if (this.phase === 'SETUP_SETTLEMENT_2') {
            const v = this.board.vertices[vertexId];
            v.hexIds.forEach(hId => {
                const hex = this.board.hexes[hId];
                if (hex.resource) {
                    this.takeFromBank(player.id, hex.resource, 1);
                }
            });
        }

        this.lastSetupVertexId = vertexId;
        this.updateVictoryPoints();

        // Advance setup step
        if (isSetup) {
            if (this.phase === 'SETUP_SETTLEMENT_1') this.phase = 'SETUP_ROAD_1';
            else if (this.phase === 'SETUP_SETTLEMENT_2') this.phase = 'SETUP_ROAD_2';
        }

        return true;
    }

    buildCity(vertexId) {
        const player = this.getCurrentPlayer();
        if (player.citiesLeft <= 0) return false;
        if (!this.hasResources(player.id, COSTS.city)) return false;
        if (!this.board.canBuildCity(vertexId, player.id)) return false;

        this.deductResources(player.id, COSTS.city);
        this.board.vertices[vertexId].building.type = 'city';
        player.settlementsLeft++;
        player.citiesLeft--;

        this.log(`🏰 ${player.name} upgraded a settlement to a CITY!`);
        this.updateVictoryPoints();
        return true;
    }

    buyDevCard() {
        const player = this.getCurrentPlayer();
        if (this.devCardDeck.length === 0) return false;
        if (!this.hasResources(player.id, COSTS.devCard)) return false;

        this.deductResources(player.id, COSTS.devCard);
        const card = this.devCardDeck.pop();
        player.devCards.push(card);
        this.boughtDevCardThisTurn.push(card);

        this.log(`🎴 ${player.name} bought a Development Card.`);
        this.updateVictoryPoints();
        return card;
    }

    playDevCard(cardType, params = {}) {
        if (this.activeDevCardPlayedThisTurn) return false;
        const player = this.getCurrentPlayer();
        const cardIndex = player.devCards.indexOf(cardType);
        if (cardIndex === -1) return false;

        // Cannot play a card on the turn it was bought (except VP cards)
        if (this.boughtDevCardThisTurn.includes(cardType) && cardType !== DEV_CARD_TYPES.VICTORY_POINT) {
            return false;
        }

        player.devCards.splice(cardIndex, 1);
        this.activeDevCardPlayedThisTurn = true;

        if (cardType === DEV_CARD_TYPES.KNIGHT) {
            player.playedKnights++;
            this.log(`⚔️ ${player.name} played a Knight! (knight #${player.playedKnights})`);
            this.updateLargestArmy();
            this.phase = 'ROBBER_MOVE';
        } else if (cardType === DEV_CARD_TYPES.YEAR_OF_PLENTY) {
            const { res1, res2 } = params;
            if (res1 && res2) {
                this.takeFromBank(player.id, res1, 1);
                this.takeFromBank(player.id, res2, 1);
                this.log(`🌾 ${player.name} took +1 ${res1} and +1 ${res2} with Year of Plenty.`);
            }
        } else if (cardType === DEV_CARD_TYPES.MONOPOLY) {
            const targetRes = params.resource;
            let stolenCount = 0;
            if (targetRes) {
                this.players.forEach(p => {
                    if (p.id !== player.id) {
                        stolenCount += p.resources[targetRes];
                        p.resources[targetRes] = 0;
                    }
                });
                player.resources[targetRes] += stolenCount;
                this.log(`💰 ${player.name} declared a MONOPOLY: took ${stolenCount} ${targetRes} from all players!`);
            }
        } else if (cardType === DEV_CARD_TYPES.ROAD_BUILDING) {
            this.freeRoads = Math.min(2, player.roadsLeft);
            this.log(`🚧 ${player.name} played Road Building and may build ${this.freeRoads} free roads.`);
            return 'ROAD_BUILDING_ACTIVE';
        }

        this.updateVictoryPoints();
        return true;
    }

    // Trading (Maritime / Harbor Trade)
    getPlayerTradeRates(playerId) {
        const player = this.players[playerId];
        const rates = {
            [RESOURCES.WOOD]: 4,
            [RESOURCES.BRICK]: 4,
            [RESOURCES.SHEEP]: 4,
            [RESOURCES.WHEAT]: 4,
            [RESOURCES.ORE]: 4
        };

        // Inspect harbors attached to vertices owned by player
        this.board.vertices.forEach(v => {
            if (v.building && v.building.owner === playerId && v.harbor) {
                if (v.harbor.type === '3:1') {
                    for (const res of Object.values(RESOURCES)) {
                        if (rates[res] > 3) rates[res] = 3;
                    }
                } else if (v.harbor.resource) {
                    rates[v.harbor.resource] = 2;
                }
            }
        });

        return rates;
    }

    executeBankTrade(giveRes, getRes) {
        const player = this.getCurrentPlayer();
        const rates = this.getPlayerTradeRates(player.id);
        const rate = rates[giveRes];

        if (giveRes === getRes) return false;
        if (player.resources[giveRes] < rate) return false;
        if (this.bank[getRes] < 1) return false;

        this.deductResources(player.id, { [giveRes]: rate });
        this.takeFromBank(player.id, getRes, 1);

        this.log(`🤝 ${player.name} traded ${rate} ${giveRes} for 1 ${getRes} with the bank/harbor.`);
        return true;
    }

    // Domestic Trade (Player to Player)
    executePlayerTrade(fromPlayerId, toPlayerId, giveRes, receiveRes) {
        const p1 = this.players[fromPlayerId];
        const p2 = this.players[toPlayerId];

        if (!this.hasResources(p1.id, giveRes) || !this.hasResources(p2.id, receiveRes)) {
            return false;
        }

        this.deductResources(p1.id, giveRes);
        this.addResources(p1.id, receiveRes);

        this.deductResources(p2.id, receiveRes);
        this.addResources(p2.id, giveRes);

        this.log(`🤝 ${p1.name} and ${p2.name} traded resources!`);
        return true;
    }

    // Longest Road DFS
    calculateLongestRoad(playerId) {
        const playerEdges = this.board.edges.filter(e => e.road && e.road.owner === playerId);
        if (playerEdges.length === 0) return 0;

        let maxLen = 0;
        const visitedEdgeIds = new Set();

        const dfs = (vertexId, currentLen) => {
            if (currentLen > maxLen) maxLen = currentLen;

            const v = this.board.vertices[vertexId];
            for (const edgeId of v.edgeIds) {
                if (!visitedEdgeIds.has(edgeId)) {
                    const edge = this.board.edges[edgeId];
                    if (edge.road && edge.road.owner === playerId) {
                        const nextVId = (edge.v1 === vertexId) ? edge.v2 : edge.v1;
                        const nextV = this.board.vertices[nextVId];

                        // If next vertex has an enemy building, road cannot continue through it
                        if (nextV.building && nextV.building.owner !== playerId) {
                            if (currentLen + 1 > maxLen) maxLen = currentLen + 1;
                            continue;
                        }

                        visitedEdgeIds.add(edgeId);
                        dfs(nextVId, currentLen + 1);
                        visitedEdgeIds.delete(edgeId);
                    }
                }
            }
        };

        // Start DFS from each vertex of each player edge
        playerEdges.forEach(e => {
            visitedEdgeIds.add(e.id);
            dfs(e.v1, 1);
            dfs(e.v2, 1);
            visitedEdgeIds.delete(e.id);
        });

        return maxLen;
    }

    updateLongestRoad() {
        let longestSoFar = this.longestRoadLength;
        let newOwner = this.longestRoadOwner;

        this.players.forEach(p => {
            const length = this.calculateLongestRoad(p.id);
            if (length > longestSoFar) {
                longestSoFar = length;
                newOwner = p.id;
            }
        });

        if (newOwner !== this.longestRoadOwner) {
            this.longestRoadOwner = newOwner;
            this.longestRoadLength = longestSoFar;
            this.log(`🚩 ${this.players[newOwner].name} took the Longest Road! (${longestSoFar} roads)`);
        }
    }

    updateLargestArmy() {
        let largestSoFar = this.largestArmyCount;
        let newOwner = this.largestArmyOwner;

        this.players.forEach(p => {
            if (p.playedKnights > largestSoFar) {
                largestSoFar = p.playedKnights;
                newOwner = p.id;
            }
        });

        if (newOwner !== this.largestArmyOwner) {
            this.largestArmyOwner = newOwner;
            this.largestArmyCount = largestSoFar;
            this.log(`⚔️ ${this.players[newOwner].name} took the Largest Army! (${largestSoFar} knights)`);
        }
    }

    updateVictoryPoints() {
        this.players.forEach(p => {
            let pts = 0;
            // Settlements (1 pt) and Cities (2 pts)
            this.board.vertices.forEach(v => {
                if (v.building && v.building.owner === p.id) {
                    pts += (v.building.type === 'city') ? 2 : 1;
                }
            });

            // Special cards
            if (this.longestRoadOwner === p.id) pts += 2;
            if (this.largestArmyOwner === p.id) pts += 2;

            p.publicVP = pts;

            // Hidden VP cards
            const vpCards = p.devCards.filter(c => c === DEV_CARD_TYPES.VICTORY_POINT).length;
            p.victoryPoints = pts + vpCards;

            if (p.victoryPoints >= 10 && this.phase === 'ACTION' && this.turnIndex === p.id) {
                this.winner = p;
                this.phase = 'GAME_OVER';
                this.log(`🏆🎉 CONGRATULATIONS! ${p.name} reached 10 Victory Points and WON the game! 🎉🏆`);
            }
        });
    }

    advanceSetup() {
        const count = this.players.length;
        const forward = Array.from({ length: count }, (_, i) => i);
        const backward = [...forward].reverse();
        const order = [...forward, ...backward];
        this.setupStep++;

        if (this.setupStep < count) {
            this.turnIndex = order[this.setupStep];
            this.phase = 'SETUP_SETTLEMENT_1';
            this.log(`🏠 Turn: ${this.getCurrentPlayer().name} (place your 1st settlement)`);
        } else if (this.setupStep < count * 2) {
            this.turnIndex = order[this.setupStep];
            this.phase = 'SETUP_SETTLEMENT_2';
            this.log(`🏠 Turn: ${this.getCurrentPlayer().name} (place your 2nd settlement)`);
        } else {
            // Setup complete, start normal gameplay!
            this.turnIndex = 0;
            this.phase = 'ACTION';
            this.diceRolled = false;
            this.log(`🎮 Game on! It's ${this.getCurrentPlayer().name}'s turn. Roll the dice.`);
        }
    }

    // ---- Online sync ----
    // Snapshot of the game for one seat. Other players' cards, the hidden VP
    // and the dev card deck order are left out so nobody can peek.
    toState(forSeat) {
        const b = this.board;
        const reveal = this.phase === 'GAME_OVER';
        const players = this.players.map(p => {
            const own = p.id === forSeat;
            return {
                ...p,
                resources: own ? { ...p.resources } : null,
                devCards: own ? [...p.devCards] : null,
                handCount: this.getTotalResourceCount(p.id),
                devCardCount: p.devCards.length,
                victoryPoints: own || reveal ? p.victoryPoints : p.publicVP
            };
        });

        return {
            board: {
                hexes: b.hexes,
                vertices: b.vertices,
                edges: b.edges,
                harbors: b.harbors,
                robberHexId: b.robberHexId
            },
            game: {
                players,
                turnIndex: this.turnIndex,
                phase: this.phase,
                setupStep: this.setupStep,
                dice: this.dice,
                diceRolled: this.diceRolled,
                longestRoadOwner: this.longestRoadOwner,
                longestRoadLength: this.longestRoadLength,
                largestArmyOwner: this.largestArmyOwner,
                largestArmyCount: this.largestArmyCount,
                devCardDeckCount: this.devCardDeck.length,
                activeDevCardPlayedThisTurn: this.activeDevCardPlayedThisTurn,
                boughtDevCardThisTurn: forSeat === this.turnIndex ? [...this.boughtDevCardThisTurn] : [],
                lastSetupVertexId: this.lastSetupVertexId,
                pendingDiscards: this.pendingDiscards,
                stealTargets: this.stealTargets,
                winnerId: this.winner ? this.winner.id : null,
                logs: this.logs,
                bank: this.bank,
                freeRoads: this.freeRoads
            }
        };
    }

    // Rebuilds a game on a guest's device from a host snapshot
    static fromState(state) {
        const board = new BoardGraph();
        Object.assign(board, state.board);

        const game = new HexlandGame(board, []);
        const g = state.game;
        Object.assign(game, g);

        // Colors, names and card types are rebuilt from known values, so a
        // tampered snapshot can't inject markup into the page
        const devTypes = Object.values(DEV_CARD_TYPES);
        const num = v => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0);
        const cards = obj => {
            const out = {};
            Object.values(RESOURCES).forEach(r => { out[r] = num(obj && obj[r]); });
            return out;
        };

        game.players = (g.players || []).slice(0, PLAYER_COLORS.length).map((p, i) => ({
            ...p,
            id: i,
            name: String(p.name || `Player ${i + 1}`).slice(0, 16),
            color: PLAYER_COLORS[i],
            resources: p.resources ? cards(p.resources) : null,
            devCards: Array.isArray(p.devCards) ? p.devCards.filter(t => devTypes.includes(t)) : null,
            handCount: num(p.handCount),
            devCardCount: num(p.devCardCount),
            playedKnights: num(p.playedKnights),
            roadsLeft: num(p.roadsLeft),
            settlementsLeft: num(p.settlementsLeft),
            citiesLeft: num(p.citiesLeft),
            victoryPoints: num(p.victoryPoints),
            publicVP: num(p.publicVP)
        }));
        game.bank = cards(g.bank);
        game.dice = [num(g.dice && g.dice[0]), num(g.dice && g.dice[1])];
        game.freeRoads = num(g.freeRoads);
        game.pendingDiscards = (g.pendingDiscards || [])
            .filter(d => d && game.players[d.playerId])
            .map(d => ({ playerId: d.playerId, count: num(d.count) }));
        game.stealTargets = (g.stealTargets || []).filter(id => Number.isInteger(id) && game.players[id]);
        game.logs = (g.logs || []).map(String);
        game.devCardDeck = new Array(Math.min(25, num(g.devCardDeckCount))).fill(null);
        game.winner = g.winnerId !== null ? game.players[g.winnerId] : null;
        delete game.devCardDeckCount;
        delete game.winnerId;
        return game;
    }

    endTurn() {
        if (this.phase !== 'ACTION' || !this.diceRolled) {
            return false;
        }

        this.diceRolled = false;
        this.freeRoads = 0;
        this.activeDevCardPlayedThisTurn = false;
        this.boughtDevCardThisTurn = [];
        this.turnIndex = (this.turnIndex + 1) % this.players.length;
        this.phase = 'ACTION';

        this.log(`👉 It's now ${this.getCurrentPlayer().name}'s turn.`);
        return true;
    }
}

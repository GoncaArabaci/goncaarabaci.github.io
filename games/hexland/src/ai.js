// Hexland - Smart AI Player Logic
// Enables seamless solo play against 3 AI opponents


class HexlandAI {
    constructor(game, soundFX) {
        this.game = game;
        this.soundFX = soundFX;
    }

    async takeTurn(player) {
        if (!player.isAI) return;

        // 1. Initial Setup Phase
        if (this.game.phase.startsWith('SETUP')) {
            await this.handleSetupTurn(player);
            return;
        }

        // 2. Regular Turn
        if (this.game.phase === 'ACTION' && !this.game.diceRolled) {
            await this.delay(600);
            this.soundFX.playDiceRoll();
            this.game.rollDice();
        }

        // If robber phase triggered
        if (this.game.phase === 'ROBBER_MOVE') {
            await this.delay(600);
            this.handleRobberMove(player);
        }

        if (this.game.phase === 'ROBBER_STEAL') {
            await this.delay(400);
            if (this.game.stealTargets.length > 0) {
                const target = this.game.stealTargets[0];
                this.game.stealResource(target);
            }
        }

        // Action Phase: Building & Trading decisions
        if (this.game.phase === 'ACTION') {
            await this.delay(500);
            this.handleAIDecisions(player);

            await this.delay(700);
            this.game.endTurn();
        }
    }

    async handleSetupTurn(player) {
        await this.delay(700);

        if (this.game.phase === 'SETUP_SETTLEMENT_1' || this.game.phase === 'SETUP_SETTLEMENT_2') {
            // Find best vertex (evaluated by pip sums and resource variety)
            const bestVertexId = this.evaluateBestSettlementVertex(player.id, true);
            if (bestVertexId !== null) {
                this.soundFX.playBuild();
                this.game.buildSettlement(bestVertexId);
            }
        }

        await this.delay(500);

        if (this.game.phase === 'SETUP_ROAD_1' || this.game.phase === 'SETUP_ROAD_2') {
            // Pick road connected to last placed settlement
            const vId = this.game.lastSetupVertexId;
            const vertex = this.game.board.vertices[vId];
            if (vertex) {
                const availableEdges = vertex.edgeIds.filter(eId => {
                    return this.game.board.canBuildRoad(eId, player.id, vId);
                });
                if (availableEdges.length > 0) {
                    const chosenEdge = availableEdges[Math.floor(Math.random() * availableEdges.length)];
                    this.soundFX.playBuild();
                    this.game.buildRoad(chosenEdge);
                }
            }
        }
    }

    evaluateBestSettlementVertex(playerId, isSetup = false) {
        let bestScore = -1;
        let bestVId = null;

        this.game.board.vertices.forEach(v => {
            if (this.game.board.canBuildSettlement(v.id, playerId, isSetup)) {
                let score = 0;
                const resourceTypes = new Set();

                v.hexIds.forEach(hId => {
                    const hex = this.game.board.hexes[hId];
                    if (hex.number && hex.resource) {
                        score += hex.pips * 2;
                        resourceTypes.add(hex.resource);
                    }
                });

                // Resource diversity bonus
                score += resourceTypes.size * 3;

                // Harbor bonus
                if (v.harbor) score += 2;

                if (score > bestScore) {
                    bestScore = score;
                    bestVId = v.id;
                }
            }
        });

        return bestVId;
    }

    handleRobberMove(player) {
        // Place robber on a hex with highest enemy pips and no own buildings
        let bestHexId = null;
        let bestTargetScore = -1;

        this.game.board.hexes.forEach(hex => {
            if (hex.id !== this.game.board.robberHexId && hex.resource) {
                let hasOwn = false;
                let enemyScore = 0;

                hex.vertexIds.forEach(vId => {
                    const b = this.game.board.vertices[vId].building;
                    if (b) {
                        if (b.owner === player.id) hasOwn = true;
                        else enemyScore += (b.type === 'city' ? 2 : 1) * hex.pips;
                    }
                });

                if (!hasOwn && enemyScore > bestTargetScore) {
                    bestTargetScore = enemyScore;
                    bestHexId = hex.id;
                }
            }
        });

        if (bestHexId === null) {
            // Fallback to random non-own hex
            const validHexes = this.game.board.hexes.filter(h => h.id !== this.game.board.robberHexId);
            bestHexId = validHexes[Math.floor(Math.random() * validHexes.length)].id;
        }

        this.soundFX.playRobber();
        this.game.moveRobber(bestHexId);
    }

    handleAIDecisions(player) {
        // 1. Check if can build City
        if (this.game.hasResources(player.id, COSTS.city) && player.citiesLeft > 0) {
            const mySettlements = this.game.board.vertices.filter(v =>
                v.building && v.building.type === 'settlement' && v.building.owner === player.id
            );
            if (mySettlements.length > 0) {
                this.soundFX.playBuild();
                this.game.buildCity(mySettlements[0].id);
                return;
            }
        }

        // 2. Check if can build Settlement
        if (this.game.hasResources(player.id, COSTS.settlement) && player.settlementsLeft > 0) {
            const bestVId = this.evaluateBestSettlementVertex(player.id, false);
            if (bestVId !== null) {
                this.soundFX.playBuild();
                this.game.buildSettlement(bestVId);
                return;
            }
        }

        // 3. Check if can build Road
        if (this.game.hasResources(player.id, COSTS.road) && player.roadsLeft > 0) {
            const validEdges = this.game.board.edges.filter(e =>
                this.game.board.canBuildRoad(e.id, player.id)
            );
            if (validEdges.length > 0) {
                const chosen = validEdges[Math.floor(Math.random() * validEdges.length)];
                this.soundFX.playBuild();
                this.game.buildRoad(chosen.id);
                return;
            }
        }

        // 4. Try Bank / Harbor trade if lacking 1 resource for a road or settlement
        this.tryAIBankTrade(player);

        // 5. Buy Dev card if excess ore/wheat/sheep
        if (this.game.hasResources(player.id, COSTS.devCard) && this.game.devCardDeck.length > 0) {
            if (Math.random() < 0.6) {
                this.soundFX.playCard();
                this.game.buyDevCard();
            }
        }
    }

    tryAIBankTrade(player) {
        const rates = this.game.getPlayerTradeRates(player.id);
        const resList = Object.values(RESOURCES);

        for (const give of resList) {
            if (player.resources[give] >= rates[give] + 2) {
                // Find resource with 0
                const needed = resList.find(r => player.resources[r] === 0);
                if (needed && needed !== give) {
                    this.game.executeBankTrade(give, needed);
                    break;
                }
            }
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

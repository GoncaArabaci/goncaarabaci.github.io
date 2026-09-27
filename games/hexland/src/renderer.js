// Hexland - Canvas Pixel Renderer
// Renders the board, pieces, numbers, robber, harbors, and animations


class HexlandRenderer {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.game = game;
        this.board = game.board;

        // Interaction & Highlight state
        this.hoverVertex = null;
        this.hoverEdge = null;
        this.hoverHex = null;
        this.activeMode = null; // 'build_settlement', 'build_road', 'build_city', 'robber_move', null

        // Floating popups
        this.popups = [];

        this.setupCanvas();
    }

    setupCanvas() {
        this.ctx.imageSmoothingEnabled = false;
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();

        this.width = rect.width;
        this.height = rect.height;

        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;

        this.ctx.scale(dpr, dpr);
        this.ctx.imageSmoothingEnabled = false;

        // Origin at center
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
    }

    addPopup(text, x, y, color = '#f1c40f') {
        this.popups.push({
            text,
            x,
            y,
            alpha: 1.0,
            vy: -1.2,
            color
        });
    }

    toScreen(x, y) {
        return {
            x: this.centerX + x,
            y: this.centerY + y
        };
    }

    toWorld(screenX, screenY) {
        return {
            x: screenX - this.centerX,
            y: screenY - this.centerY
        };
    }

    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // 1. Draw Ocean Background
        this.drawOcean();

        // 2. Draw Harbors
        this.drawHarbors();

        // 3. Draw Hexes & Terrain & Numbers
        this.drawHexes();

        // 4. Draw Roads
        this.drawRoads();

        // 5. Draw Buildings (Settlements & Cities)
        this.drawBuildings();

        // 6. Draw Robber
        this.drawRobber();

        // 7. Draw Interaction Overlays (Build Spots & Hover)
        this.drawInteractionOverlays();

        // 8. Draw Floating Popups
        this.drawPopups();
    }

    drawOcean() {
        // Pixel ocean with slight wave grid
        this.ctx.fillStyle = '#1b3a5b';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Subtle pixel wave shimmer
        const time = Date.now() * 0.002;
        this.ctx.fillStyle = '#224a73';
        for (let x = 20; x < this.width; x += 48) {
            for (let y = 20; y < this.height; y += 48) {
                const waveOffset = Math.sin(time + (x + y) * 0.05) * 4;
                this.ctx.fillRect(x + waveOffset, y, 6, 2);
            }
        }
    }

    drawHarbors() {
        const ctx = this.ctx;

        this.board.harbors.forEach(h => {
            const v1 = this.board.vertices[h.v1];
            const v2 = this.board.vertices[h.v2];
            const p1 = this.toScreen(v1.x, v1.y);
            const p2 = this.toScreen(v2.x, v2.y);
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            // Vector away from center
            const dirX = midX - this.centerX;
            const dirY = midY - this.centerY;
            const len = Math.hypot(dirX, dirY) || 1;
            const pierLen = 32;
            const pierX = midX + (dirX / len) * pierLen;
            const pierY = midY + (dirY / len) * pierLen;

            // Wooden dock beams
            ctx.strokeStyle = '#5a3818';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(pierX, pierY);
            ctx.moveTo(p2.x, p2.y);
            ctx.lineTo(pierX, pierY);
            ctx.stroke();

            // Harbor badge
            ctx.fillStyle = '#f1c40f';
            ctx.strokeStyle = '#2c3e50';
            ctx.lineWidth = 2;
            ctx.fillRect(pierX - 22, pierY - 12, 44, 24);
            ctx.strokeRect(pierX - 22, pierY - 12, 44, 24);

            ctx.fillStyle = '#2c3e50';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(h.label, pierX, pierY);
        });
    }

    drawHexes() {
        const ctx = this.ctx;
        const R = this.board.hexRadius;
        const angle0 = BOARD_CONFIG.startAngle;

        this.board.hexes.forEach(hex => {
            const pt = this.toScreen(hex.x, hex.y);

            // Check if custom Aseprite sprite exists (not a procedural fallback canvas)
            const sprite = pixelAssets.getImage(hex.terrainKey);
            const isCustomSprite = sprite && sprite instanceof HTMLImageElement;

            if (isCustomSprite) {
                // User's Aseprite PNG includes hex shape + border
                const size = BOARD_CONFIG.spriteSize;
                ctx.drawImage(sprite, pt.x - size / 2, pt.y - size / 2, size, size);
            } else {
                // Procedural fallback: code-drawn hex
                ctx.save();
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const rad = (Math.PI / 180) * (60 * i + angle0);
                    const hx = pt.x + R * Math.cos(rad);
                    const hy = pt.y + R * Math.sin(rad);
                    if (i === 0) ctx.moveTo(hx, hy);
                    else ctx.lineTo(hx, hy);
                }
                ctx.closePath();

                ctx.fillStyle = hex.terrain.color;
                ctx.fill();
                ctx.strokeStyle = hex.terrain.accentColor;
                ctx.lineWidth = 4;
                ctx.stroke();
                ctx.strokeStyle = 'rgba(255,255,255,0.15)';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Draw small procedural sprite on top
                if (sprite) {
                    const size = 36;
                    ctx.drawImage(sprite, pt.x - size / 2, pt.y - size / 2 - 4, size, size);
                }
                ctx.restore();
            }

            // Draw Number Token (if not desert)
            if (hex.number) {
                this.drawNumberToken(pt.x, pt.y + BOARD_CONFIG.numberOffsetY, hex.number, hex.pips);
            }
        });
    }

    drawNumberToken(x, y, number, pips) {
        const ctx = this.ctx;
        const isRed = (number === 6 || number === 8);

        // Circular token base (retro pixel aesthetic)
        ctx.fillStyle = '#faebd7';
        ctx.strokeStyle = '#3e2723';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Number
        ctx.fillStyle = isRed ? '#d32f2f' : '#263238';
        ctx.font = `bold ${isRed ? 14 : 12}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(number.toString(), x, y - 3);

        // Pip dots (representing probability)
        const pipRadius = 1.5;
        const pipSpacing = 4;
        const startX = x - ((pips - 1) * pipSpacing) / 2;

        ctx.fillStyle = isRed ? '#d32f2f' : '#37474f';
        for (let i = 0; i < pips; i++) {
            ctx.beginPath();
            ctx.arc(startX + i * pipSpacing, y + 8, pipRadius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawRobber() {
        const hex = this.board.hexes[this.board.robberHexId];
        if (!hex) return;

        const pt = this.toScreen(hex.x, hex.y);
        const robberSprite = pixelAssets.getImage('robber');

        if (robberSprite) {
            this.ctx.drawImage(robberSprite, pt.x - 18, pt.y - 18, 36, 36);
        } else {
            // Fallback dark figure
            this.ctx.fillStyle = '#111827';
            this.ctx.beginPath();
            this.ctx.arc(pt.x, pt.y, 14, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    drawRoads() {
        const ctx = this.ctx;

        this.board.edges.forEach(edge => {
            if (edge.road) {
                const v1 = this.board.vertices[edge.v1];
                const v2 = this.board.vertices[edge.v2];
                const p1 = this.toScreen(v1.x, v1.y);
                const p2 = this.toScreen(v2.x, v2.y);
                const player = this.game.players[edge.road.owner];

                // Road outline
                ctx.strokeStyle = '#1e293b';
                ctx.lineWidth = 8;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();

                // Road color
                ctx.strokeStyle = player.color.hex;
                ctx.lineWidth = 5;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        });
    }

    drawBuildings() {
        const ctx = this.ctx;

        this.board.vertices.forEach(v => {
            if (v.building) {
                const pt = this.toScreen(v.x, v.y);
                const player = this.game.players[v.building.owner];

                if (v.building.type === 'settlement') {
                    this.drawSettlement(pt.x, pt.y, player.color.hex);
                } else if (v.building.type === 'city') {
                    this.drawCity(pt.x, pt.y, player.color.hex);
                }
            }
        });
    }

    drawSettlement(x, y, color) {
        const ctx = this.ctx;
        const size = 12;

        ctx.save();
        ctx.translate(x, y);

        // Black pixel outline
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-size / 2 - 2, -size / 2 - 2, size + 4, size + 4);
        ctx.beginPath();
        ctx.moveTo(0, -size - 3);
        ctx.lineTo(-size / 2 - 3, -size / 2);
        ctx.lineTo(size / 2 + 3, -size / 2);
        ctx.fill();

        // Roof (Player color)
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, -size - 1);
        ctx.lineTo(-size / 2, -size / 2);
        ctx.lineTo(size / 2, -size / 2);
        ctx.closePath();
        ctx.fill();

        // Walls (Stone / Wood)
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-size / 2, -size / 2, size, size);

        // Door
        ctx.fillStyle = '#451a03';
        ctx.fillRect(-2, 2, 4, 4);

        ctx.restore();
    }

    drawCity(x, y, color) {
        const ctx = this.ctx;
        const size = 18;

        ctx.save();
        ctx.translate(x, y);

        // Black pixel outline
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-size / 2 - 2, -size / 3 - 2, size + 4, size * 0.7 + 4);

        // Left Tower
        ctx.fillRect(-size / 2 - 2, -size + 2, 7, size);
        // Right Tower
        ctx.fillRect(size / 2 - 5, -size + 2, 7, size);

        // City Main Building (Player color)
        ctx.fillStyle = color;
        ctx.fillRect(-size / 2, -size / 3, size, size * 0.7);

        // Towers
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-size / 2, -size + 4, 5, size - 4);
        ctx.fillRect(size / 2 - 3, -size + 4, 5, size - 4);

        // Turret crenellations
        ctx.fillStyle = color;
        ctx.fillRect(-size / 2, -size + 2, 2, 2);
        ctx.fillRect(size / 2, -size + 2, 2, 2);

        // Gate / Entrance
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-3, 2, 6, 6);

        ctx.restore();
    }

    drawInteractionOverlays() {
        // Build spots only show on the device whose turn it is
        if (!this.interactive) return;
        const ctx = this.ctx;
        const pId = this.game.getCurrentPlayer().id;

        const isSetup = this.game.phase.startsWith('SETUP');
        const isRoadSetup = this.game.phase === 'SETUP_ROAD_1' || this.game.phase === 'SETUP_ROAD_2';
        const isSettlementSetup = this.game.phase === 'SETUP_SETTLEMENT_1' || this.game.phase === 'SETUP_SETTLEMENT_2';

        // 1. Settlement Placement Mode
        if (this.activeMode === 'build_settlement' || isSettlementSetup) {
            this.board.vertices.forEach(v => {
                if (this.board.canBuildSettlement(v.id, pId, isSetup)) {
                    const pt = this.toScreen(v.x, v.y);
                    const isHovered = this.hoverVertex && this.hoverVertex.id === v.id;

                    ctx.fillStyle = isHovered ? '#2ecc71' : 'rgba(46, 204, 113, 0.6)';
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, isHovered ? 8 : 6, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
            });
        }

        // 2. City Placement Mode
        if (this.activeMode === 'build_city') {
            this.board.vertices.forEach(v => {
                if (this.board.canBuildCity(v.id, pId)) {
                    const pt = this.toScreen(v.x, v.y);
                    const isHovered = this.hoverVertex && this.hoverVertex.id === v.id;

                    ctx.fillStyle = isHovered ? '#f1c40f' : 'rgba(241, 196, 15, 0.7)';
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, isHovered ? 10 : 8, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
            });
        }

        // 3. Road Placement Mode
        if (this.activeMode === 'build_road' || isRoadSetup) {
            this.board.edges.forEach(edge => {
                const canBuild = this.board.canBuildRoad(
                    edge.id,
                    pId,
                    isSetup ? this.game.lastSetupVertexId : null
                );

                if (canBuild) {
                    const v1 = this.board.vertices[edge.v1];
                    const v2 = this.board.vertices[edge.v2];
                    const p1 = this.toScreen(v1.x, v1.y);
                    const p2 = this.toScreen(v2.x, v2.y);
                    const isHovered = this.hoverEdge && this.hoverEdge.id === edge.id;

                    ctx.strokeStyle = isHovered ? '#2ecc71' : 'rgba(46, 204, 113, 0.6)';
                    ctx.lineWidth = isHovered ? 7 : 4;
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }
            });
        }

        // 4. Robber Move Mode
        if (this.game.phase === 'ROBBER_MOVE') {
            this.board.hexes.forEach(hex => {
                if (hex.id !== this.board.robberHexId) {
                    const pt = this.toScreen(hex.x, hex.y);
                    const isHovered = this.hoverHex && this.hoverHex.id === hex.id;

                    ctx.strokeStyle = isHovered ? '#e74c3c' : 'rgba(231, 76, 60, 0.5)';
                    ctx.lineWidth = isHovered ? 4 : 2;
                    ctx.beginPath();
                    for (let i = 0; i < 6; i++) {
                        const rad = (Math.PI / 180) * (60 * i + BOARD_CONFIG.startAngle);
                        const hx = pt.x + (this.board.hexRadius - 4) * Math.cos(rad);
                        const hy = pt.y + (this.board.hexRadius - 4) * Math.sin(rad);
                        if (i === 0) ctx.moveTo(hx, hy);
                        else ctx.lineTo(hx, hy);
                    }
                    ctx.closePath();
                    ctx.stroke();
                }
            });
        }
    }

    drawPopups() {
        const ctx = this.ctx;
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';

        for (let i = this.popups.length - 1; i >= 0; i--) {
            const p = this.popups[i];
            p.y += p.vy;
            p.alpha -= 0.015;

            if (p.alpha <= 0) {
                this.popups.splice(i, 1);
                continue;
            }

            ctx.save();
            ctx.globalAlpha = p.alpha;
            // Text shadow
            ctx.fillStyle = '#000000';
            ctx.fillText(p.text, p.x + 1, p.y + 1);
            ctx.fillStyle = p.color;
            ctx.fillText(p.text, p.x, p.y);
            ctx.restore();
        }
    }
}

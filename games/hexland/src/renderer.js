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

        // Piece being placed: { kind, target, x, y, dragging } (set by the app on pointer moves)
        this.preview = null;

        // Floating popups
        this.popups = [];

        this.setupCanvas();
    }

    setupCanvas() {
        this.ctx.imageSmoothingEnabled = false;
        this.resize();
        window.addEventListener('resize', () => this.resize());
        // The board area also changes size when the hand bar fills up. Without this the
        // canvas got stretched and clicks landed on the wrong corner or edge.
        if (window.ResizeObserver) {
            new ResizeObserver(() => this.resize()).observe(this.canvas.parentElement);
        }
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        this.width = rect.width;
        this.height = rect.height;

        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;

        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
        // Safety net: if the board area changed size, match the canvas to it
        if (Math.abs(this.canvas.clientWidth - this.width) > 1 || Math.abs(this.canvas.clientHeight - this.height) > 1) {
            this.resize();
        }
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

        // 7. Robber targets, then the piece being placed
        this.drawInteractionOverlays();
        this.drawPreview();

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
        const SCALE = 2;

        this.board.harbors.forEach(h => {
            const v1 = this.board.vertices[h.v1];
            const v2 = this.board.vertices[h.v2];
            const p1 = this.toScreen(v1.x, v1.y);
            const p2 = this.toScreen(v2.x, v2.y);
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            // out to sea, away from the island's centre
            const dirX = midX - this.centerX;
            const dirY = midY - this.centerY;
            const len = Math.hypot(dirX, dirY) || 1;
            const pierX = midX + (dirX / len) * 34;
            const pierY = midY + (dirY / len) * 34;

            // two wooden piers made of pixel planks
            this.pixelLine(p1, { x: pierX, y: pierY }, PIXEL_PALETTE.b, PIXEL_PALETTE.k, 4);
            this.pixelLine(p2, { x: pierX, y: pierY }, PIXEL_PALETTE.b, PIXEL_PALETTE.k, 4);

            const sign = pixelSprites.harborSign(h.ratio === 3 ? '3:1' : '2:1', h.resource);
            const w = sign.width * SCALE, hgt = sign.height * SCALE;
            ctx.drawImage(sign, Math.round(pierX - w / 2), Math.round(pierY - hgt / 2), w, hgt);
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
        const sprite = pixelSprites.token(number, pips);
        const size = sprite.width * 2;
        this.ctx.drawImage(sprite, Math.round(x - size / 2), Math.round(y - size / 2), size, size);
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

                this.drawRoadLine(p1, p2, player.color.hex);
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

    // A custom Aseprite PNG replaces the drawn piece; a player-colored base shows the owner
    drawCustomPiece(key, x, y, color, size) {
        const sprite = pixelAssets.getImage(key);
        if (!(sprite instanceof HTMLImageElement)) return false;
        const ctx = this.ctx;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x - size / 2 - 2, y + size / 2 - 5, size + 4, 6);
        ctx.fillStyle = color;
        ctx.fillRect(x - size / 2, y + size / 2 - 3, size, 3);
        ctx.drawImage(sprite, x - size / 2, y - size / 2 - 4, size, size);
        return true;
    }

    drawSettlement(x, y, color) {
        if (this.drawCustomPiece('settlement', x, y, color, 28)) return;
        const sprite = pixelSprites.settlement(color);
        const w = sprite.width * 2, h = sprite.height * 2;
        // the house stands on the corner, a little above it
        this.ctx.drawImage(sprite, Math.round(x - w / 2), Math.round(y - h * 0.62), w, h);
    }

    drawCity(x, y, color) {
        if (this.drawCustomPiece('city', x, y, color, 36)) return;
        const sprite = pixelSprites.city(color);
        const w = sprite.width * 2, h = sprite.height * 2;
        this.ctx.drawImage(sprite, Math.round(x - w / 2), Math.round(y - h * 0.62), w, h);
    }

    drawInteractionOverlays() {
        // Build spots only show on the device whose turn it is
        if (!this.interactive) return;
        const ctx = this.ctx;

        // Robber Move Mode
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

    // Roads: square pixel blocks with a dark outline, like the tile art
    drawRoadLine(p1, p2, color) {
        this.pixelLine(p1, p2, color, PIXEL_PALETTE.k, 6, shade(color, 45));
    }

    // A chunky pixel line: an outline pass, then the fill, then a highlight
    pixelLine(p1, p2, fill, outline, size, highlight = null) {
        const ctx = this.ctx;
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2));
        const snap = v => Math.round(v / 2) * 2;
        const pts = [];
        for (let i = 0; i <= steps; i++) pts.push({ x: snap(p1.x + dx * i / steps), y: snap(p1.y + dy * i / steps) });
        // keep the ends clear of buildings a little
        const half = size / 2;
        ctx.fillStyle = outline;
        pts.forEach(p => ctx.fillRect(p.x - half - 2, p.y - half - 2, size + 4, size + 4));
        ctx.fillStyle = fill;
        pts.forEach(p => ctx.fillRect(p.x - half, p.y - half, size, size));
        if (highlight) {
            ctx.fillStyle = highlight;
            pts.forEach((p, i) => { if (i % 4 === 0) ctx.fillRect(p.x - half, p.y - half, 2, 2); });
        }
    }

    // Ghost of the piece being placed: snapped to the nearest legal spot,
    // or following the pointer while dragging when no spot is close enough
    drawPreview() {
        const p = this.preview;
        if (!p || !this.interactive) return;
        const color = this.game.getCurrentPlayer().color.hex;
        const ctx = this.ctx;

        ctx.save();
        if (p.target !== null && p.target !== undefined) {
            ctx.globalAlpha = 0.75 + 0.15 * Math.sin(Date.now() / 250);
            if (p.kind === 'road') {
                const e = this.board.edges[p.target];
                const v1 = this.board.vertices[e.v1];
                const v2 = this.board.vertices[e.v2];
                this.drawRoadLine(this.toScreen(v1.x, v1.y), this.toScreen(v2.x, v2.y), color);
            } else {
                const v = this.board.vertices[p.target];
                const pt = this.toScreen(v.x, v.y);
                if (p.kind === 'city') this.drawCity(pt.x, pt.y, color);
                else this.drawSettlement(pt.x, pt.y, color);
            }
        } else if (p.dragging) {
            ctx.globalAlpha = 0.45;
            if (p.kind === 'road') this.drawRoadLine({ x: p.x - 20, y: p.y + 10 }, { x: p.x + 20, y: p.y - 10 }, color);
            else if (p.kind === 'city') this.drawCity(p.x, p.y, color);
            else this.drawSettlement(p.x, p.y, color);
        }
        ctx.restore();
    }

    // Small icon of a piece for the hand bar
    drawPieceIcon(canvas, kind, color) {
        const main = this.ctx;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.ctx = ctx;
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        if (kind === 'road') this.drawRoadLine({ x: cx - 12, y: cy + 8 }, { x: cx + 12, y: cy - 8 }, color);
        else if (kind === 'city') this.drawCity(cx, cy + 12, color);
        else this.drawSettlement(cx, cy + 9, color);
        this.ctx = main;
    }

    drawPopups() {
        const ctx = this.ctx;
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';

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
            // a leading emoji becomes its pixel icon; dark outline so the text reads on any tile
            const split = pixelIcons.splitLeading(p.text);
            const text = split ? split.rest : p.text;
            let x = Math.round(p.x), y = Math.round(p.y);
            if (split) {
                const iw = split.icon.width * 2, ih = split.icon.height * 2;
                const tw = ctx.measureText(text).width;
                const left = Math.round(x - (iw + 6 + tw) / 2);
                ctx.drawImage(split.icon, left, Math.round(y - ih / 2), iw, ih);
                x = Math.round(left + iw + 6 + tw / 2);
            }
            ctx.strokeStyle = PIXEL_PALETTE.k;
            ctx.lineWidth = 4;
            ctx.strokeText(text, x, y);
            ctx.fillStyle = p.color;
            ctx.fillText(text, x, y);
            ctx.restore();
        }
    }
}

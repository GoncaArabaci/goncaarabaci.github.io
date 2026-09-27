// Hexland - Pixel Art Generator & Asset Loader
// Designed for seamless integration with Aseprite PNGs, with procedural pixel fallbacks!

class PixelAssetManager {
    constructor() {
        this.images = new Map();
        this.patterns = new Map();
        this.loaded = false;
    }

    // Try loading custom Aseprite PNG, fallback to procedural pixel canvas
    async loadAssets() {
        const assetList = [
            { key: 'forest', path: 'assets/images/hex_forest.png' },
            { key: 'hills', path: 'assets/images/hex_hills.png' },
            { key: 'pasture', path: 'assets/images/hex_pasture.png' },
            { key: 'fields', path: 'assets/images/hex_fields.png' },
            { key: 'mountains', path: 'assets/images/hex_mountains.png' },
            { key: 'desert', path: 'assets/images/hex_desert.png' },
            { key: 'robber', path: 'assets/images/robber.png' },
            { key: 'settlement', path: 'assets/images/settlement.png' },
            { key: 'city', path: 'assets/images/city.png' }
        ];

        for (const item of assetList) {
            try {
                const img = await this.loadImage(item.path);
                this.images.set(item.key, img);
                console.log(`✅ Asset loaded: ${item.key} (${img.width}x${img.height})`);
            } catch (err) {
                // If Aseprite file not yet placed, generate procedural pixel sprite!
                console.warn(`⚠️ Asset not found, using procedural fallback: ${item.key} → ${item.path}`);
                const proceduralCanvas = this.generateProceduralPixelSprite(item.key);
                this.images.set(item.key, proceduralCanvas);
            }
        }

        this.loaded = true;
    }

    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load ${src}`));
            img.src = src;
        });
    }

    getImage(key) {
        return this.images.get(key) || this.generateProceduralPixelSprite(key);
    }

    // High quality procedural 16x16 / 32x32 pixel sprites (retro 8-bit style)
    generateProceduralPixelSprite(key) {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        const drawPixel = (x, y, color) => {
            ctx.fillStyle = color;
            ctx.fillRect(x * 2, y * 2, 2, 2);
        };

        if (key === 'forest') {
            // Pine tree in pixel art
            const darkG = '#194d1b';
            const midG = '#2d7a31';
            const lightG = '#52b358';
            const trunk = '#5a3818';

            // Trunk
            for (let y = 11; y <= 15; y++) {
                drawPixel(7, y, trunk);
                drawPixel(8, y, trunk);
            }
            // Leaves
            const treeLayers = [
                { y: 3, minX: 7, maxX: 8 },
                { y: 4, minX: 6, maxX: 9 },
                { y: 5, minX: 5, maxX: 10 },
                { y: 6, minX: 6, maxX: 9 },
                { y: 7, minX: 4, maxX: 11 },
                { y: 8, minX: 3, maxX: 12 },
                { y: 9, minX: 5, maxX: 10 },
                { y: 10, minX: 2, maxX: 13 }
            ];
            treeLayers.forEach(l => {
                for (let x = l.minX; x <= l.maxX; x++) {
                    const c = (x === l.minX || y === l.y) ? lightG : (x === l.maxX ? darkG : midG);
                    drawPixel(x, l.y, c);
                }
            });
        } else if (key === 'mountains') {
            // Mountain peak with snow
            const rockDark = '#374151';
            const rockMid = '#6b7280';
            const snow = '#f8fafc';
            const snowShadow = '#cbd5e1';

            for (let y = 3; y <= 14; y++) {
                const span = (y - 3);
                for (let x = 8 - span; x <= 8 + span; x++) {
                    if (x < 1 || x > 15) continue;
                    let color = x <= 8 ? rockMid : rockDark;
                    if (y <= 6) {
                        color = x <= 8 ? snow : snowShadow;
                    }
                    drawPixel(x, y, color);
                }
            }
        } else if (key === 'hills') {
            // Clay bricks / Quarry rocks
            const brickRed = '#b91c1c';
            const brickDark = '#7f1d1d';
            const mortar = '#fca5a5';

            for (let y = 6; y <= 12; y++) {
                for (let x = 3; x <= 13; x++) {
                    if ((y === 7 || y === 10) || ((y <= 7 && x === 8) || (y > 7 && (x === 5 || x === 11)))) {
                        drawPixel(x, y, mortar);
                    } else {
                        drawPixel(x, y, (x % 3 === 0) ? brickDark : brickRed);
                    }
                }
            }
        } else if (key === 'pasture') {
            // Cute pixel sheep
            const woolWhite = '#f1f5f9';
            const woolShadow = '#cbd5e1';
            const faceBlack = '#1e293b';

            // Wool body
            for (let y = 5; y <= 10; y++) {
                for (let x = 4; x <= 12; x++) {
                    drawPixel(x, y, y === 10 ? woolShadow : woolWhite);
                }
            }
            // Head
            for (let y = 6; y <= 9; y++) {
                for (let x = 11; x <= 14; x++) {
                    drawPixel(x, y, faceBlack);
                }
            }
            // Legs
            drawPixel(5, 11, faceBlack);
            drawPixel(5, 12, faceBlack);
            drawPixel(7, 11, faceBlack);
            drawPixel(7, 12, faceBlack);
            drawPixel(10, 11, faceBlack);
            drawPixel(10, 12, faceBlack);
            drawPixel(12, 11, faceBlack);
            drawPixel(12, 12, faceBlack);
        } else if (key === 'fields') {
            // Golden wheat bundle
            const wheatLight = '#fde047';
            const wheatMid = '#eab308';
            const wheatDark = '#ca8a04';

            // Stalks
            for (let y = 4; y <= 14; y++) {
                drawPixel(8, y, wheatMid);
                if (y <= 10) {
                    drawPixel(6, y + 1, wheatLight);
                    drawPixel(10, y + 1, wheatDark);
                }
            }
            // Wheat grains
            drawPixel(7, 4, wheatLight);
            drawPixel(9, 4, wheatMid);
            drawPixel(5, 6, wheatLight);
            drawPixel(11, 6, wheatDark);
            drawPixel(6, 8, wheatLight);
            drawPixel(10, 8, wheatMid);
        } else if (key === 'desert') {
            // Desert cactus + skull/dune
            const sand = '#d97706';
            const cactusGreen = '#15803d';
            const cactusDark = '#166534';

            // Main cactus trunk
            for (let y = 4; y <= 14; y++) {
                drawPixel(8, y, cactusGreen);
                drawPixel(9, y, cactusDark);
            }
            // Left arm
            drawPixel(5, 7, cactusGreen);
            drawPixel(5, 8, cactusGreen);
            drawPixel(6, 9, cactusGreen);
            drawPixel(7, 9, cactusGreen);
            // Right arm
            drawPixel(11, 6, cactusDark);
            drawPixel(11, 7, cactusDark);
            drawPixel(10, 8, cactusDark);
        } else if (key === 'robber') {
            // Shady thief with hood and mask
            const hood = '#1f2937';
            const face = '#e2e8f0';
            const eyes = '#ef4444';
            const cloak = '#111827';

            // Hood
            for (let y = 3; y <= 6; y++) {
                for (let x = 6; x <= 10; x++) drawPixel(x, y, hood);
            }
            // Face slit
            drawPixel(7, 5, eyes);
            drawPixel(9, 5, eyes);
            // Cloak
            for (let y = 7; y <= 14; y++) {
                for (let x = 5; x <= 11; x++) drawPixel(x, y, cloak);
            }
        }

        return canvas;
    }
}

const pixelAssets = new PixelAssetManager();

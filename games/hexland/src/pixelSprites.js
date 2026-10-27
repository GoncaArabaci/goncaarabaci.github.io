// Hexland - pixel-art sprites drawn in code for the pieces that don't have
// an Aseprite PNG yet (settlement, city, roads, number tokens, harbors).
//
// Each sprite is built on a tiny grid (1 cell = 1 art pixel), gets a dark
// outline automatically, and is drawn scaled up without smoothing so it
// matches the hand-drawn tiles.

const PIXEL_PALETTE = {
    k: '#1c1426',   // outline
    w: '#f6e7c1',   // cream wall (same family as the tile borders)
    W: '#d9bf8a',   // wall shade
    g: '#ffd45c',   // lit window
    d: '#6b3f1f',   // door / wood dark
    b: '#a8723c',   // wood
    B: '#7a4f26',   // wood shade
    c: '#fbf1d3',   // token face
    C: '#d8bd85',   // token rim
    r: '#d62f2f',   // red number
    n: '#2b2135',   // dark number
    s: '#b9b6ae',   // stone
    S: '#7d7a73',   // stone shade
    G: '#3f9a3a',   // leaf
    y: '#f2c230',   // wheat
    m: '#e8d9c0',   // mortar
    R: '#c0522b'    // brick
};

// 3x5 pixel digits and a colon
const PIXEL_FONT = {
    0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'],
    2: ['###', '..#', '###', '#..', '###'], 3: ['###', '..#', '.##', '..#', '###'],
    4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '###', '..#', '###'],
    6: ['###', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'],
    8: ['###', '#.#', '###', '#.#', '###'], 9: ['###', '#.#', '###', '..#', '###'],
    ':': ['.', '#', '.', '#', '.']
};

// 5x5 resource icons for harbors
const PIXEL_ICONS = {
    wood: ['..G..', '.GGG.', 'GGGGG', '..d..', '..d..'],
    brick: ['RRmRR', 'mmmmm', 'RmRRR', 'mmmmm', 'RRmRR'],
    sheep: ['.www.', 'wwwww', 'kwwww', 'wwww.', '.k.k.'],
    wheat: ['y.y.y', '.yyy.', '..y..', '..y..', '..y..'],
    ore: ['..s..', '.sSs.', 'sSSSs', 'sSsSS', '.....']
};

function shade(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) + amount)));
    return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

class PixelGrid {
    constructor(w, h) {
        this.w = w;
        this.h = h;
        this.cells = new Array(w * h).fill(null);
    }

    set(x, y, c) {
        if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.cells[y * this.w + x] = c;
    }

    get(x, y) {
        return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.cells[y * this.w + x] : null;
    }

    rect(x, y, w, h, c) {
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    }

    // Rows of text art: any character except '.' is drawn with `map[char]`
    art(x, y, rows, map) {
        rows.forEach((row, j) => [...row].forEach((ch, i) => {
            if (ch !== '.') this.set(x + i, y + j, map[ch] || ch);
        }));
    }

    // scale 2 draws each font pixel as a 2x2 block (big, easy to read)
    text(x, y, str, c, scale = 1) {
        let cx = x;
        for (const ch of String(str)) {
            const glyph = PIXEL_FONT[ch];
            if (!glyph) { cx += 2 * scale; continue; }
            glyph.forEach((row, j) => [...row].forEach((on, i) => {
                if (on === '#') this.rect(cx + i * scale, y + j * scale, scale, scale, c);
            }));
            cx += (glyph[0].length + 1) * scale;
        }
    }

    static textWidth(str, scale = 1) {
        return [...String(str)].reduce((w, ch) => w + (PIXEL_FONT[ch] ? PIXEL_FONT[ch][0].length + 1 : 2) * scale, -scale);
    }

    // Dark outline around everything that is drawn
    outline(c = 'k') {
        const add = [];
        for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
            if (this.get(x, y)) continue;
            if (this.get(x + 1, y) || this.get(x - 1, y) || this.get(x, y + 1) || this.get(x, y - 1)) add.push([x, y]);
        }
        add.forEach(([x, y]) => this.set(x, y, c));
    }

    toCanvas(colors) {
        const cv = document.createElement('canvas');
        cv.width = this.w;
        cv.height = this.h;
        const ctx = cv.getContext('2d');
        this.cells.forEach((c, i) => {
            if (!c) return;
            ctx.fillStyle = colors[c] || PIXEL_PALETTE[c] || c;
            ctx.fillRect(i % this.w, Math.floor(i / this.w), 1, 1);
        });
        return cv;
    }
}

class PixelSprites {
    constructor() {
        this.cache = new Map();
    }

    // Player colour slots: p (main), P (shade), L (light)
    playerColors(color) {
        return { p: color, P: shade(color, -60), L: shade(color, 55) };
    }

    get(key, build) {
        if (!this.cache.has(key)) this.cache.set(key, build());
        return this.cache.get(key);
    }

    settlement(color) {
        return this.get(`settlement:${color}`, () => {
            const g = new PixelGrid(14, 14);
            // roof
            for (let row = 0; row < 5; row++) {
                const half = row + 1;
                for (let x = 7 - half; x < 7 + half; x++) g.set(x, 1 + row, x < 7 - half + 1 ? 'L' : x >= 7 + half - 1 ? 'P' : 'p');
            }
            g.rect(1, 6, 12, 1, 'P');
            // walls, window, door
            g.rect(2, 7, 10, 6, 'w');
            g.rect(10, 7, 2, 6, 'W');
            g.rect(3, 8, 2, 2, 'g');
            g.rect(7, 9, 3, 4, 'd');
            g.outline();
            return g.toCanvas(this.playerColors(color));
        });
    }

    city(color) {
        return this.get(`city:${color}`, () => {
            const g = new PixelGrid(20, 19);
            // flag on the tower
            g.rect(4, 0, 1, 5, 'd');
            g.rect(5, 0, 3, 2, 'p');
            // tower with battlements
            g.rect(1, 5, 7, 13, 'w');
            g.rect(6, 5, 2, 13, 'W');
            [1, 3, 5, 7].forEach(x => g.set(x, 4, 'w'));
            g.rect(3, 8, 2, 3, 'g');
            g.rect(1, 12, 7, 1, 'p');
            // main hall with a coloured roof
            for (let row = 0; row < 5; row++) {
                const half = row + 2;
                for (let x = 13 - half; x < 13 + half; x++) g.set(x, 6 + row, x < 13 - half + 1 ? 'L' : x >= 13 + half - 1 ? 'P' : 'p');
            }
            g.rect(8, 11, 10, 7, 'w');
            g.rect(16, 11, 2, 7, 'W');
            g.rect(9, 12, 2, 2, 'g');
            g.rect(15, 12, 1, 2, 'g');
            g.rect(12, 14, 3, 4, 'd');
            g.outline();
            return g.toCanvas(this.playerColors(color));
        });
    }

    token(number, pips) {
        return this.get(`token:${number}`, () => {
            const g = new PixelGrid(19, 19);
            const red = number === 6 || number === 8;
            for (let y = 0; y < 19; y++) for (let x = 0; x < 19; x++) {
                const d = Math.hypot(x - 9, y - 9);
                if (d <= 8.3) g.set(x, y, d > 7 && (x + y > 18) ? 'C' : 'c');
            }
            const tw = PixelGrid.textWidth(number, 2);
            g.text(Math.round(9.5 - tw / 2), 3, number, red ? 'r' : 'n', 2);
            const start = 9 - (pips - 1);
            for (let i = 0; i < pips; i++) g.set(start + i * 2, 15, red ? 'r' : 'n');
            g.outline();
            return g.toCanvas({});
        });
    }

    harborSign(ratioLabel, resource) {
        return this.get(`harbor:${ratioLabel}:${resource || ''}`, () => {
            const textW = PixelGrid.textWidth(ratioLabel);
            const w = textW + (resource ? 9 : 4) + 2;
            const g = new PixelGrid(w + 2, 11);
            g.rect(1, 1, w, 9, 'b');
            for (let x = 2; x < w; x += 3) g.set(x, 8, 'B');
            g.rect(1, 9, w, 1, 'B');
            g.text(3, 3, ratioLabel, 'w');
            if (resource) g.art(3 + textW + 2, 3, PIXEL_ICONS[resource], PIXEL_PALETTE);
            g.outline();
            return g.toCanvas({});
        });
    }
}

const pixelSprites = new PixelSprites();

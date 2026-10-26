// Rail Rivals - the map, drawn as SVG
//
// Builds the island, track slots, cities and decorations once, then updates
// owners, highlights and effects as the game changes.

const SVG_NS = 'http://www.w3.org/2000/svg';
const BOARD_W = MAP.width;
const BOARD_H = MAP.height;
const CITY_GAP = 15;     // track stops this far from a city center
const LANE_OFFSET = 6.5; // half the distance between double tracks
const SLOT_H = 11;

function svg(tag, attrs = {}, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    if (parent) parent.appendChild(el);
    return el;
}

class RailBoard {
    constructor(svgEl, handlers = {}) {
        this.svg = svgEl;
        this.handlers = handlers;     // onRouteClick(id), onRouteHover(id|null, evt)
        this.cities = Object.fromEntries(MAP.cities.map(c => [c.id, c]));
        this.routeEls = {};
        this.trainsDrawn = {};        // routeId -> owner already drawn
        this.geometry = {};
        this.build();
    }

    // Seeded random so decorations are the same on every device
    rand() {
        this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
        return this.seed / 4294967296;
    }

    build() {
        this.seed = 7;
        const s = this.svg;
        s.setAttribute('viewBox', `0 0 ${BOARD_W} ${BOARD_H}`);
        s.innerHTML = '';

        const defs = svg('defs', {}, s);
        defs.innerHTML = `
            <radialGradient id="sea" cx="50%" cy="50%" r="70%">
                <stop offset="0" stop-color="#1f7396"/>
                <stop offset="1" stop-color="#11496a"/>
            </radialGradient>
            <linearGradient id="land" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#d9e8b4"/>
                <stop offset="0.5" stop-color="#c9df9f"/>
                <stop offset="1" stop-color="#b9d38c"/>
            </linearGradient>
            <linearGradient id="loco-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#f43f5e"/><stop offset="0.25" stop-color="#f59e0b"/>
                <stop offset="0.5" stop-color="#22c55e"/><stop offset="0.75" stop-color="#3b82f6"/>
                <stop offset="1" stop-color="#a855f7"/>
            </linearGradient>
            <pattern id="waves" width="60" height="24" patternUnits="userSpaceOnUse">
                <path d="M0 12 Q15 4 30 12 T60 12" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="2"/>
            </pattern>
            <filter id="soft-shadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="1.6" stdDeviation="1.2" flood-color="#0f172a" flood-opacity="0.35"/>
            </filter>
            <filter id="land-shadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#04202f" flood-opacity="0.55"/>
            </filter>`;

        // the sea reaches past the board so wide or tall screens show more sea, not a gap
        svg('rect', { x: -1000, y: -1000, width: BOARD_W + 2000, height: BOARD_H + 2000, fill: '#11496a' }, s);
        svg('rect', { width: BOARD_W, height: BOARD_H, fill: 'url(#sea)' }, s);
        svg('rect', { x: -1000, y: -1000, width: BOARD_W + 2000, height: BOARD_H + 2000, fill: 'url(#waves)' }, s);

        // Neighbouring countries, muted, so Turkey stands out
        svg('path', { d: MAP.neighbours.join(''), class: 'neighbours' }, s);

        // Turkey (real outline) and its lakes
        const landPath = MAP.land.join('');
        svg('path', { d: landPath, class: 'shore-glow' }, s);
        svg('path', { d: landPath, fill: 'url(#land)', class: 'land', filter: 'url(#land-shadow)' }, s);
        svg('path', { d: MAP.lakes.join(''), class: 'lake' }, s);
        this.landPath = landPath;
        this.landShape = new Path2D(landPath);
        this.lakeShape = new Path2D(MAP.lakes.join(''));
        this.hitCtx = document.createElement('canvas').getContext('2d');

        MAP.seaLabels.forEach(([name, x, y]) => {
            const t = svg('text', { x, y, class: 'sea-label', 'text-anchor': 'middle' }, s);
            t.textContent = name;
        });

        this.decorLayer = svg('g', { class: 'decor' }, s);
        this.routeLayer = svg('g', { class: 'routes', filter: 'url(#soft-shadow)' }, s);
        this.trainLayer = svg('g', { class: 'trains' }, s);
        this.borrowLayer = svg('g', { class: 'borrowed' }, s);
        this.cityLayer = svg('g', { class: 'cities' }, s);
        this.stationLayer = svg('g', { class: 'stations' }, s);
        this.fxLayer = svg('g', { class: 'fx' }, s);
        this.stationsDrawn = {};

        MAP.routes.forEach(r => this.buildRoute(r));
        this.buildDecor();
        MAP.cities.forEach(c => this.buildCity(c));
    }

    // ---------- Land ----------

    insideLand(x, y) {
        return this.hitCtx.isPointInPath(this.landShape, x, y) && !this.hitCtx.isPointInPath(this.lakeShape, x, y);
    }

    // Mountains where Turkey has them (Taurus, east), forests on the
    // Black Sea side, a few trees elsewhere; kept clear of tracks and cities
    buildDecor() {
        const near = (x, y, gap) => MAP.routes.some(r => {
            const pts = this.geometry[r.id].path;
            for (let i = 0; i < pts.length; i += 2) if (Math.hypot(pts[i].x - x, pts[i].y - y) < gap) return true;
            return false;
        });
        const lonLat = (x, y) => ({ east: x > 640, north: y < 175, south: y > 360 });
        const placed = [];
        for (let tries = 0; tries < 2500 && placed.length < 120; tries++) {
            const x = 20 + this.rand() * (BOARD_W - 40), y = 20 + this.rand() * (BOARD_H - 40);
            if (!this.insideLand(x, y)) continue;
            if (MAP.cities.some(c => Math.hypot(c.x - x, c.y - y) < 34)) continue;
            if (placed.some(p => Math.hypot(p.x - x, p.y - y) < 15)) continue;
            if (near(x, y, 13)) continue;
            const z = lonLat(x, y);
            const kind = z.east || (z.south && x > 220 && x < 620) ? (this.rand() < 0.8 ? 'peak' : 'tree')
                : z.north ? (this.rand() < 0.85 ? 'tree' : 'peak') : (this.rand() < 0.35 ? 'tree' : 'field');
            placed.push({ x, y, kind });
        }
        placed.sort((a, b) => a.y - b.y).forEach(({ x, y, kind }) => {
            const g = svg('g', { transform: `translate(${x.toFixed(1)},${y.toFixed(1)})`, class: kind }, this.decorLayer);
            if (kind === 'peak') {
                const s = 0.8 + this.rand() * 0.5;
                svg('path', { d: `M${-12 * s},${5} L${-1 * s},${-11 * s} L${4 * s},${-4 * s} L${7 * s},${-8 * s} L${13 * s},${5} Z`, fill: '#a8a07e' }, g);
                svg('path', { d: `M${-1 * s},${-11 * s} L${4 * s},${-4 * s} L${1 * s},${5} L${-4 * s},${5} Z`, fill: 'rgba(0,0,0,0.12)' }, g);
                svg('path', { d: `M${-1 * s},${-11 * s} L${2 * s},${-6.5 * s} L${-0.5 * s},${-5.5 * s} L${-4 * s},${-7 * s} Z`, fill: '#f8fafc' }, g);
            } else if (kind === 'tree') {
                svg('ellipse', { cx: 0, cy: 6, rx: 6, ry: 2, fill: 'rgba(30,60,30,0.18)' }, g);
                svg('path', { d: 'M0,-9 L6,3 L-6,3 Z', fill: this.rand() < 0.5 ? '#5e9c45' : '#4f8f3a' }, g);
                svg('rect', { x: -1, y: 3, width: 2, height: 3, fill: '#7c5a3a' }, g);
            } else {
                // a little wheat field
                svg('path', { d: 'M-8,4 L-5,-3 M-3,4 L0,-3 M2,4 L5,-3', stroke: '#c9a227', 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: 0.7 }, g);
            }
        });
    }

    // ---------- Tracks ----------

    // Gently curved centre line: same bend for both tracks of a double route
    routeCurve(r) {
        const A = this.cities[r.a], B = this.cities[r.b];
        const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy);
        const nx = -dy / len, ny = dx / len;
        let h = 0;
        for (const ch of r.a + r.b) h = (h * 31 + ch.charCodeAt(0)) % 997;
        const bend = (h % 2 ? 1 : -1) * Math.min(len * 0.07, 9);
        const cx = (A.x + B.x) / 2 + nx * bend, cy = (A.y + B.y) / 2 + ny * bend;
        const off = r.lane === 0 ? -LANE_OFFSET : r.lane === 1 ? LANE_OFFSET : 0;
        const pts = [];
        const N = 48;
        for (let i = 0; i <= N; i++) {
            const t = i / N, u = 1 - t;
            const x = u * u * A.x + 2 * u * t * cx + t * t * B.x;
            const y = u * u * A.y + 2 * u * t * cy + t * t * B.y;
            // tangent, for the lane offset
            const tx = 2 * u * (cx - A.x) + 2 * t * (B.x - cx);
            const ty = 2 * u * (cy - A.y) + 2 * t * (B.y - cy);
            const tl = Math.hypot(tx, ty) || 1;
            pts.push({ x: x - ty / tl * off, y: y + tx / tl * off });
        }
        let acc = 0;
        pts.forEach((p, i) => { if (i) acc += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y); p.d = acc; });
        return pts;
    }

    pointAt(pts, d) {
        let i = 1;
        while (i < pts.length - 1 && pts[i].d < d) i++;
        const a = pts[i - 1], b = pts[i];
        const t = (d - a.d) / ((b.d - a.d) || 1);
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI };
    }

    buildRoute(r) {
        const pts = this.routeCurve(r);
        const total = pts[pts.length - 1].d;
        const usable = total - CITY_GAP * 2;
        const gap = 2.6;
        const w = (usable - gap * (r.length - 1)) / r.length;

        const slots = [];
        for (let i = 0; i < r.length; i++) slots.push(this.pointAt(pts, CITY_GAP + i * (w + gap) + w / 2));
        this.geometry[r.id] = { slots, w, path: pts, mid: this.pointAt(pts, total / 2) };

        const g = svg('g', { class: `route color-${r.color}${r.tunnel ? ' tunnel' : ''}${r.ferry ? ' ferry' : ''}`, 'data-id': r.id }, this.routeLayer);
        // wide invisible line makes the whole route easy to click or tap
        svg('polyline', { points: pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '), class: 'route-hit', 'stroke-width': 18, fill: 'none' }, g);
        const style = CARD_STYLE[r.color];
        slots.forEach((p, i) => {
            const sg = svg('g', { transform: `translate(${p.x.toFixed(2)},${p.y.toFixed(2)}) rotate(${p.angle.toFixed(2)})` }, g);
            if (r.tunnel) {
                // tunnels: dark dashed frame around each car space
                svg('rect', { x: -w / 2 - 2.2, y: -SLOT_H / 2 - 2.2, width: w + 4.4, height: SLOT_H + 4.4, rx: 3.6, class: 'tunnel-frame' }, sg);
            }
            svg('rect', {
                x: -w / 2, y: -SLOT_H / 2, width: w, height: SLOT_H, rx: 2.6,
                class: 'slot', fill: style.fill, stroke: style.dark, 'stroke-width': 1.3
            }, sg);
            svg('rect', { x: -w / 2 + 2, y: -SLOT_H / 2 + 1.6, width: Math.max(1, w - 4), height: 2, rx: 1, fill: 'rgba(255,255,255,0.35)', class: 'slot-shine' }, sg);
            if (i < (r.ferry || 0)) {
                // ferries: this space needs a wild (locomotive) card
                svg('circle', { r: 3.6, fill: 'url(#loco-grad)', stroke: '#fff', 'stroke-width': 1.2, class: 'ferry-mark' }, sg);
            }
        });

        g.addEventListener('click', () => this.handlers.onRouteClick && this.handlers.onRouteClick(r.id));
        g.addEventListener('pointerenter', e => this.handlers.onRouteHover && this.handlers.onRouteHover(r.id, e));
        g.addEventListener('pointermove', e => this.handlers.onRouteHover && this.handlers.onRouteHover(r.id, e));
        g.addEventListener('pointerleave', () => this.handlers.onRouteHover && this.handlers.onRouteHover(null));
        this.routeEls[r.id] = g;
    }

    buildCity(c) {
        const g = svg('g', { class: 'city', 'data-id': c.id, transform: `translate(${c.x},${c.y})` }, this.cityLayer);
        svg('circle', { r: 16, class: 'city-pulse' }, g);
        svg('circle', { r: 9.5, class: 'city-ring' }, g);
        svg('circle', { r: 4.5, class: 'city-core' }, g);
        const below = c.y < 120 || !MAP.cities.some(o => o !== c && Math.abs(o.x - c.x) < 70 && o.y > c.y && o.y - c.y < 60);
        const label = svg('text', { y: below ? 24 : -15, class: 'city-label', 'text-anchor': 'middle' }, g);
        label.textContent = c.name;
        this.cityEls = this.cityEls || {};
        this.cityEls[c.id] = g;

        // a bigger invisible circle makes small cities easy to tap
        svg('circle', { r: 15, class: 'city-hit' }, g);
        g.addEventListener('click', e => {
            e.stopPropagation();
            if (this.handlers.onCityClick) this.handlers.onCityClick(c.id);
        });
        g.addEventListener('pointerenter', e => this.handlers.onCityHover && this.handlers.onCityHover(c.id, e));
        g.addEventListener('pointermove', e => this.handlers.onCityHover && this.handlers.onCityHover(c.id, e));
        g.addEventListener('pointerleave', () => this.handlers.onCityHover && this.handlers.onCityHover(null));
    }

    // stationsAt: cityId -> playerId; animateCity: the one just built
    updateStations(stationsAt, animateCity = null) {
        Object.keys(this.stationsDrawn).forEach(cid => {
            if (stationsAt[cid] === undefined) {
                this.stationLayer.querySelector(`[data-city="${cid}"]`)?.remove();
                delete this.stationsDrawn[cid];
            }
        });
        Object.entries(stationsAt).forEach(([cid, pid]) => {
            if (this.stationsDrawn[cid] === pid) return;
            const c = this.cities[cid];
            const outer = svg('g', { transform: `translate(${c.x + 13},${c.y - 14}) scale(1.35)`, 'data-city': cid }, this.stationLayer);
            const st = svg('g', { class: cid === animateCity ? 'station-piece drop' : 'station-piece' }, outer);
            const fill = PLAYER_STYLE[pid].fill;
            svg('path', { d: 'M-8,1 L0,-8 L8,1 Z', fill, stroke: '#fff', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, st);
            svg('rect', { x: -6.5, y: 0, width: 13, height: 9, rx: 1.5, fill, stroke: '#fff', 'stroke-width': 1.6 }, st);
            svg('rect', { x: -2, y: 3.5, width: 4, height: 5.5, rx: 0.8, fill: '#0f172a' }, st);
            if (cid === animateCity) this.puff(c.x + 12, c.y - 10, 300);
            this.stationsDrawn[cid] = pid;
        });
    }

    // Rival routes my stations are using: a dashed line in my colour
    markBorrowed(ids, color) {
        const key = `${ids.join(',')}|${color}`;
        if (key === this.borrowKey) return;
        this.borrowKey = key;
        this.borrowLayer.innerHTML = '';
        ids.forEach(id => {
            const pts = this.geometry[id].path;
            svg('polyline', {
                points: pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
                fill: 'none', stroke: color, class: 'borrow-line'
            }, this.borrowLayer);
        });
    }

    markStationable(ids) {
        const set = new Set(ids);
        Object.entries(this.cityEls).forEach(([id, el]) => el.classList.toggle('can-station', set.has(id)));
    }

    floatTextAt(cityId, text, color) {
        const c = this.cities[cityId];
        const t = svg('text', { x: c.x, y: c.y - 24, class: 'float-score', 'text-anchor': 'middle', fill: color }, this.fxLayer);
        t.textContent = text;
        setTimeout(() => t.remove(), 1800);
    }

    cityScreenPoint(id) {
        const c = this.cities[id];
        const pt = this.svg.createSVGPoint();
        pt.x = c.x; pt.y = c.y;
        const p = pt.matrixTransform(this.svg.getScreenCTM());
        return { x: p.x, y: p.y };
    }

    // ---------- Updates ----------

    // owner: routeId -> playerId; animate: routeId that was just claimed
    updateOwners(owner, animateRouteId = null) {
        MAP.routes.forEach(r => {
            const who = owner[r.id];
            if (who === undefined) {
                if (this.trainsDrawn[r.id] !== undefined) {
                    this.trainLayer.querySelectorAll(`[data-route="${r.id}"]`).forEach(el => el.remove());
                    delete this.trainsDrawn[r.id];
                }
                this.routeEls[r.id].classList.remove('owned');
                return;
            }
            if (this.trainsDrawn[r.id] === who) return;
            this.drawTrains(r, who, r.id === animateRouteId);
            this.trainsDrawn[r.id] = who;
            this.routeEls[r.id].classList.add('owned');
        });
    }

    drawTrains(r, playerId, animate) {
        const geo = this.geometry[r.id];
        const color = PLAYER_STYLE[playerId].fill;
        const w = geo.w;
        geo.slots.forEach((p, i) => {
            const outer = svg('g', {
                transform: `translate(${p.x.toFixed(2)},${p.y.toFixed(2)}) rotate(${p.angle.toFixed(2)})`,
                'data-route': r.id
            }, this.trainLayer);
            const car = svg('g', { class: animate ? 'train drop' : 'train', style: `animation-delay:${i * 90}ms` }, outer);
            // white rim so placed trains stand out from empty slots of a similar color
            svg('rect', { x: -w / 2 - 1.2, y: -SLOT_H / 2 - 1.6, width: w + 2.4, height: SLOT_H + 3.2, rx: 3.6, fill: '#0f172a' }, car);
            svg('rect', { x: -w / 2 - 0.4, y: -SLOT_H / 2 - 0.8, width: w + 0.8, height: SLOT_H + 1.6, rx: 3, fill: color, stroke: '#fff', 'stroke-width': 1.5 }, car);
            const winW = Math.max(2, (w - 8) / 3);
            for (let k = 0; k < 3; k++) {
                svg('rect', { x: -w / 2 + 3 + k * (winW + 1), y: -SLOT_H / 2 + 1.8, width: winW, height: 3.2, rx: 0.8, fill: 'rgba(255,255,255,0.7)' }, car);
            }
            svg('circle', { cx: -w / 2 + 4, cy: SLOT_H / 2 + 0.6, r: 1.6, fill: '#0f172a' }, car);
            svg('circle', { cx: w / 2 - 4, cy: SLOT_H / 2 + 0.6, r: 1.6, fill: '#0f172a' }, car);
            if (animate) this.puff(p.x, p.y, i * 90 + 260);
        });
    }

    puff(x, y, delay) {
        for (let k = 0; k < 3; k++) {
            const c = svg('circle', {
                cx: x, cy: y, r: 3, class: 'puff',
                style: `animation-delay:${delay + k * 40}ms; --dx:${(this.rand() * 16 - 8).toFixed(1)}px; --dy:${(-8 - this.rand() * 10).toFixed(1)}px`
            }, this.fxLayer);
            setTimeout(() => c.remove(), delay + 1200);
        }
    }

    floatText(routeId, text, color = '#facc15') {
        const m = this.geometry[routeId].mid;
        const t = svg('text', { x: m.x, y: m.y - 8, class: 'float-score', 'text-anchor': 'middle', fill: color }, this.fxLayer);
        t.textContent = text;
        setTimeout(() => t.remove(), 1800);
    }

    // Routes the current player could pay for right now
    markClaimable(ids) {
        const set = new Set(ids);
        MAP.routes.forEach(r => this.routeEls[r.id].classList.toggle('can-claim', set.has(r.id)));
    }

    markBlocked(ids) {
        const set = new Set(ids);
        MAP.routes.forEach(r => this.routeEls[r.id].classList.toggle('blocked', set.has(r.id)));
    }

    highlightCities(ids) {
        Object.entries(this.cityEls).forEach(([id, el]) => el.classList.toggle('hl', ids.includes(id)));
    }

    highlightRoutes(ids) {
        const set = new Set(ids);
        MAP.routes.forEach(r => this.routeEls[r.id].classList.toggle('hl', set.has(r.id)));
    }

    selectRoute(id) {
        MAP.routes.forEach(r => this.routeEls[r.id].classList.toggle('selected', r.id === id));
    }

    // Screen position of a route's middle (for popups)
    routeScreenPoint(id) {
        const m = this.geometry[id].mid;
        const pt = this.svg.createSVGPoint();
        pt.x = m.x; pt.y = m.y;
        const p = pt.matrixTransform(this.svg.getScreenCTM());
        return { x: p.x, y: p.y };
    }

    shake() {
        this.svg.classList.remove('shake');
        void this.svg.getBoundingClientRect();
        this.svg.classList.add('shake');
    }
}

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
            <radialGradient id="sea" cx="50%" cy="45%" r="75%">
                <stop offset="0" stop-color="#1e6f8f"/>
                <stop offset="0.6" stop-color="#155a78"/>
                <stop offset="1" stop-color="#0b3550"/>
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

        svg('rect', { width: BOARD_W, height: BOARD_H, fill: 'url(#sea)' }, s);
        svg('rect', { width: BOARD_W, height: BOARD_H, fill: 'url(#waves)' }, s);

        // Turkey: one smoothed outline, the Sea of Marmara cut out on top
        const landPath = this.smoothPath(MAP.outline);
        svg('path', { d: landPath, class: 'shore-glow' }, s);
        svg('path', { d: landPath, fill: 'url(#land)', stroke: '#f5f0d8', 'stroke-width': 4, filter: 'url(#land-shadow)', class: 'land' }, s);
        MAP.lakes.forEach(l => svg('path', { d: this.smoothPath(l), fill: '#1b6585', stroke: '#f5f0d8', 'stroke-width': 3 }, s));
        this.landPath = landPath;
        this.landPoly = MAP.outline;

        // sea names
        [['Karadeniz', 470, 26], ['Akdeniz', 360, 548], ['Ege', 22, 330]].forEach(([name, x, y]) => {
            const t = svg('text', { x, y, class: 'sea-label', 'text-anchor': name === 'Ege' ? 'start' : 'middle' }, s);
            t.textContent = name;
        });

        this.decorLayer = svg('g', { class: 'decor' }, s);
        this.routeLayer = svg('g', { class: 'routes', filter: 'url(#soft-shadow)' }, s);
        this.trainLayer = svg('g', { class: 'trains' }, s);
        this.cityLayer = svg('g', { class: 'cities' }, s);
        this.stationLayer = svg('g', { class: 'stations' }, s);
        this.fxLayer = svg('g', { class: 'fx' }, s);
        this.stationsDrawn = {};

        MAP.routes.forEach(r => this.buildRoute(r));
        this.buildDecor();
        MAP.cities.forEach(c => this.buildCity(c));
    }

    // ---------- Island ----------

    smoothPath(pts) {
        const n = pts.length;
        let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
        for (let i = 0; i < n; i++) {
            const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
            const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
            const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
            d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
        }
        return d + 'Z';
    }

    insideLand(x, y) {
        if (MAP.lakes.some(l => this.inPoly(l, x, y))) return false;
        return this.inPoly(this.landPoly, x, y);
    }

    inPoly(p, x, y) {
        let inside = false;
        for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
            if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) inside = !inside;
        }
        return inside;
    }

    // Trees and hills in the empty spaces between tracks
    buildDecor() {
        const segs = MAP.routes.map(r => [this.cities[r.a], this.cities[r.b]]);
        const distSeg = (x, y, a, b) => {
            const dx = b.x - a.x, dy = b.y - a.y;
            const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
            return Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy));
        };
        const placed = [];
        for (let tries = 0; tries < 900 && placed.length < 70; tries++) {
            const x = 30 + this.rand() * (BOARD_W - 60), y = 30 + this.rand() * (BOARD_H - 60);
            if (!this.insideLand(x, y)) continue;
            if (segs.some(([a, b]) => distSeg(x, y, a, b) < 17)) continue;
            if (MAP.cities.some(c => Math.hypot(c.x - x, c.y - y) < 46)) continue;
            if (placed.some(p => Math.hypot(p[0] - x, p[1] - y) < 16)) continue;
            placed.push([x, y]);
        }
        placed.forEach(([x, y], i) => {
            if (i % 4 === 0) {
                // little hill
                const g = svg('g', { transform: `translate(${x.toFixed(1)},${y.toFixed(1)})`, class: 'hill' }, this.decorLayer);
                svg('path', { d: 'M-11,5 L-2,-8 L3,-2 L6,-6 L12,5 Z', fill: '#a3b18a' }, g);
                svg('path', { d: 'M-2,-8 L1,-4 L-1,-3 L-4,-5 Z', fill: '#f8fafc' }, g);
            } else {
                const g = svg('g', { transform: `translate(${x.toFixed(1)},${y.toFixed(1)})`, class: 'tree' }, this.decorLayer);
                svg('ellipse', { cx: 0, cy: 6, rx: 6, ry: 2, fill: 'rgba(30,60,30,0.18)' }, g);
                svg('path', { d: 'M0,-9 L6,3 L-6,3 Z', fill: i % 3 ? '#6aa84f' : '#4f8f3a' }, g);
                svg('rect', { x: -1, y: 3, width: 2, height: 3, fill: '#7c5a3a' }, g);
            }
        });
    }

    // ---------- Tracks ----------

    buildRoute(r) {
        const A = this.cities[r.a], B = this.cities[r.b];
        const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy);
        const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
        const off = r.lane === 0 ? -LANE_OFFSET : r.lane === 1 ? LANE_OFFSET : 0;
        const usable = len - CITY_GAP * 2;
        const gap = 2.6;
        const w = (usable - gap * (r.length - 1)) / r.length;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;

        const slots = [];
        for (let i = 0; i < r.length; i++) {
            const along = CITY_GAP + i * (w + gap) + w / 2;
            slots.push({ x: A.x + ux * along + nx * off, y: A.y + uy * along + ny * off });
        }
        this.geometry[r.id] = {
            slots, w, angle,
            mid: { x: (A.x + B.x) / 2 + nx * off, y: (A.y + B.y) / 2 + ny * off }
        };

        const g = svg('g', { class: `route color-${r.color}`, 'data-id': r.id }, this.routeLayer);
        // wide invisible line makes the whole route easy to click or tap
        svg('line', {
            x1: A.x + nx * off, y1: A.y + ny * off, x2: B.x + nx * off, y2: B.y + ny * off,
            class: 'route-hit', 'stroke-width': 18
        }, g);
        const style = CARD_STYLE[r.color];
        slots.forEach(p => {
            const sg = svg('g', { transform: `translate(${p.x.toFixed(2)},${p.y.toFixed(2)}) rotate(${angle.toFixed(2)})` }, g);
            svg('rect', {
                x: -w / 2, y: -SLOT_H / 2, width: w, height: SLOT_H, rx: 2.6,
                class: 'slot', fill: style.fill, stroke: style.dark, 'stroke-width': 1.3
            }, sg);
            svg('rect', { x: -w / 2 + 2, y: -SLOT_H / 2 + 1.6, width: Math.max(1, w - 4), height: 2, rx: 1, fill: 'rgba(255,255,255,0.35)', class: 'slot-shine' }, sg);
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
                transform: `translate(${p.x.toFixed(2)},${p.y.toFixed(2)}) rotate(${geo.angle.toFixed(2)})`,
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

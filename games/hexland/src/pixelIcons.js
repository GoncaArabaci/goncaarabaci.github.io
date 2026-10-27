// Hexland - pixel icons in place of emoji, so the whole UI looks hand-drawn.
// Every emoji the page shows (buttons, panels, log, popups) is swapped for a
// small pixel picture; anything without a picture is left as it was.

const ICON_COLORS = {
    k: '#1c1426', w: '#f8f1de', W: '#cdbb94', n: '#2b2135', g: '#f2c230', G: '#3f9a3a', H: '#2c6e2a',
    u: '#3d8be0', U: '#245a9e', o: '#e98a2c', r: '#d63c3c', R: '#9b2222', v: '#8b5bd6', V: '#5d3a9e',
    s: '#c9c6bd', S: '#8a877f', b: '#a8723c', B: '#6e4520', h: '#f2c39b', y: '#f6d860', e: '#4b4b5a',
    c: '#7fd0e8', m: '#e8d9c0', p: '#f472b6'
};

const ICON_ART = {
    dice: ['.wwwwwww.', 'wwwwwwwww', 'wnwwwwwnw', 'wwwwwwwww', 'wwwwnwwww', 'wwwwwwwww', 'wnwwwwwnw', 'wwwwwwwww', '.wwwwwww.'],
    card: ['.vvvvvvv.', 'vVVVVVVVv', 'vVvvgvvVv', 'vVvgggvVv', 'vVggggg.v'.replace('.', 'V'), 'vVvgggvVv', 'vVvvgvvVv', 'vVVVVVVVv', '.vvvvvvv.'],
    scroll: ['.WWWWWWW.', 'WwwwwwwwW', '.wnnnnnw.', '.wwwwwww.', '.wnnnnww.', '.wwwwwww.', '.wnnnnnw.', 'WwwwwwwwW', '.WWWWWWW.'],
    swords: ['s.......s', '.s.....s.', '..s...s..', '...s.s...', '....s....', '...s.s...', '.gb...bg.', 'bg.....gb', 'b.......b'],
    globe: ['..uuuuu..', '.uGGuuuu.', 'uGGGuuGuu', 'uGGuuGGGu', 'uuuuuGGGu', 'uuGuuuGuu', 'uGGGuuuuu', '.uGuuuuu.', '..uuuuu..'],
    bank: ['....g....', '..ggggg..', '.ggggggg.', 'ggggggggg', '.w.w.w.w.', '.w.w.w.w.', '.w.w.w.w.', 'WWWWWWWWW', 'ggggggggg'],
    people: ['..oo..uu.', '.oooouuuu', '.oooouuuu', '..oo..uu.', '.ooo.uuu.', 'ooooouuuu', 'ooooouuuu', 'ooooouuuu'],
    island: ['...GGG...', '..GGHGG..', '.GG.b.GG.', '....b....', '....b....', '...yby...', '.yyyyyyy.', 'uuuuuuuuu', '.uuuuuuu.'],
    sound: ['....s....', '...ss..w.', 'ssss.s..w', 'ssss.s.w.', 'ssss.s..w', '...ss..w.', '....s....'],
    mute: ['....s....', '...ss....', 'ssss.r.r.', 'ssss..r..', 'ssss.r.r.', '...ss....', '....s....'],
    hand: ['..h.h....', '.hh.h.h..', '.hh.h.h..', '.hhhhhh.h', '.hhhhhhhh', '.hhhhhhh.', '..hhhhh..', '..hhhhh..'],
    trade: ['....g....', '...gg....', 'gggggggg.', '...gg....', '....u....', '....uu...', '.uuuuuuuu', '....uu...', '....u....'],
    next: ['w...w...w', 'ww..ww..w', 'www.www.w', 'wwwwwwwww', 'www.www.w', 'ww..ww..w', 'w...w...w'],
    trophy: ['ggggggggg', 'g.ggggg.g', 'g.ggggg.g', '.gggggg..'.replace('..', 'g.'), '..ggggg..', '...ggg...', '....g....', '..BBBBB..', '..bbbbb..'],
    hourglass: ['bbbbbbbbb', '.wyyyyyw.', '..wyyyw..', '...wyw...', '...wyw...', '..wwywww.'.slice(0, 9), '.wwyyyww.', 'bbbbbbbbb'],
    plug: ['..s...s..', '..s...s..', '.sssssss.', '.sSSSSSs.', '.sSSSSSs.', '..sssss..', '....e....', '....e....'],
    offline: ['..s...s..', '..s...s..', '.sssssss.', '.sSSSSSs.', 'r.sSSSs.r', '.r.sss.r.', '..r...r..', '.r.....r.'],
    reload: ['...GGG...', '.GG...GG.', 'GG.....G.', 'G.......G', 'G...GGGGG', 'G.....GG.', '.GG...G..', '...GGG...'],
    target: ['..rrrrr..', '.rwwwwwr.', 'rwrrrrrwr', 'rwrwwwrwr', 'rwrwrwrwr', 'rwrwwwrwr', 'rwrrrrrwr', '.rwwwwwr.', '..rrrrr..'],
    house: ['....r....', '...rrr...', '..rrrrr..', '.rrrrrrr.', 'rrrrrrrrr', '.wwwwwww.', '.wgwwbbw.', '.wwwwbbw.', '.wwwwbbw.'],
    castle: ['s.s...s.s', 'sss...sss', 'sss.r.sss', 'sssrrrsss', 'sssssssss', 'ssgsssgss', 'sssssssss', 'sssbbbsss', 'sssbbbsss'],
    robber: ['...eee...', '..eeeee..', '.eerereE.'.replace('E', 'e'), '.eeeeeee.', '..eeeee..', '.eeeeeee.', 'eeeeeeeee', 'eeeeeeeee', '.ee...ee.'],
    check: ['........G', '.......GG', '......GG.', 'G....GG..', 'GG..GG...', '.GGGG....', '..GG.....'],
    door: ['.BBBBBBB.', 'BbbbbbbbB', 'BbbbbbbbB', 'BbbbbbbbB', 'BbbbbbgbB', 'BbbbbbbbB', 'BbbbbbbbB', 'BbbbbbbbB'],
    crown: ['g...g...g', 'gg.ggg.gg', 'ggggggggg', 'ggrggguggg'.slice(0, 9), 'ggggggggg', 'bbbbbbbbb'],
    star: ['....g....', '....g....', '...ggg...', 'ggggggggg', '.ggggggg.', '..ggggg..', '.ggg.ggg.', '.gg...gg.', 'g.......g'],
    road: ['.o.....o.', 'owwowwoww', 'owwowwoww', '.o.....o.', '.o.....o.', '.B.....B.', '.B.....B.'],
    flag: ['brrrrr...', 'brrrrrrr.', 'brrrrrrrr', 'brrrrrr..', 'b........', 'b........', 'b........', 'b........', 'bb.......'],
    coin: ['..ggggg..', '.gyyyyyg.', 'gyygggyyg', 'gyggyyyyg', 'gyyggyyyg', 'gyyyyggyg', 'gyygggyyg', '.gyyyyyg.', '..ggggg..'],
    dagger: ['........s', '.......s.', '......s..', '.....s...', '....s....', '.g.s.....', '..b......', '.b.g.....', 'b........'],
    warn: ['....g....', '...ggg...', '...gng...', '..ggngg..', '..ggngg..', '.ggggggg.', '.gggnggg.', 'ggggggggg'],
    gamepad: ['.sssssss.', 'ssssssssr', 'snnsssssu', 'sssnssrss', 'snnsssssg', 'sssssssss', '.ss...ss.'],
    trash: ['...sss...', 'sssssssss', '.sSsSsSs.', '.sSsSsSs.', '.sSsSsSs.', '.sSsSsSs.', '..sssss..'],
    party: ['p...g...u', '.p.....u.', '..r.g....', '...ooo...', '...ooo..g', '..ooo....', '.ooo...p.', 'ooo......'],
    pointer: ['.........', '...g.....', '...gg....', 'gggggg...', 'ggggggg..', 'gggggg...', '...gg....', '...g.....'],
    wood: ['....G....', '...GGG...', '..GGGGG..', '...GGG...', '..GGGGG..', '.GGGGGGG.', '....b....', '....b....'],
    brick: ['RRRmRRRRR', 'mmmmmmmmm', 'RRmRRRRmR', 'mmmmmmmmm', 'RRRRmRRRR', 'mmmmmmmmm'],
    sheep: ['..wwwww..', '.wwwwwww.', 'nwwwwwwww', 'nnwwwwww.', '.wwwwwww.', '.n.n.n.n.'],
    wheat: ['g.g.g.g..', '.ggggg...', '..ggg....', '...g.....', '...g.....', '...g.....'],
    ore: ['...ss....', '..sSSs...', '.sSSsSs..', 'sSSssSSs.', 'sSsSSsSs.', '.ssssss..'],
    pick: ['.sssss...', 's..b..s..', '...b.....', '...b.....', '...b.....', '...b.....'],
    shuffle: ['......g..', 'uuu..ggg.', '...u.g...', '....g....', '...g.u...', 'ggg..uuu.', '......u..'],
    sign: ['.bbbbbbb.', '.bwwwwwb.', '.bbbbbbb.', '....b....', '....b....', '....b....'],
    lock: ['..sssss..', '.s.....s.', '.s.....s.', 'ggggggggg', 'gggnngggg', 'ggggngggg', 'ggggggggg'],
    hammer: ['.ssssss..', '.ssssss..', '....b....', '....b....', '....b....', '....b....', '....b....']
};

const EMOJI_ICON = {
    '🎲': 'dice', '🎴': 'card', '📜': 'scroll', '⚔️': 'swords', '⚔': 'swords', '🌐': 'globe', '🏦': 'bank',
    '👥': 'people', '🏝️': 'island', '🏝': 'island', '🔊': 'sound', '🔇': 'mute', '✋': 'hand', '🤝': 'trade',
    '⏭️': 'next', '⏭': 'next', '🏆': 'trophy', '⏳': 'hourglass', '📴': 'offline', '🔌': 'plug', '🔄': 'reload',
    '🎯': 'target', '🏠': 'house', '🏰': 'castle', '🦹': 'robber', '✓': 'check', '✅': 'check', '🚪': 'door',
    '👑': 'crown', '⭐': 'star', '🚧': 'road', '🚩': 'flag', '💰': 'coin', '🗡️': 'dagger', '🗡': 'dagger',
    '⚠️': 'warn', '⚠': 'warn', '🎮': 'gamepad', '🗑️': 'trash', '🗑': 'trash', '🎉': 'party', '👉': 'pointer',
    '🌲': 'wood', '🧱': 'brick', '🐑': 'sheep', '🌾': 'wheat', '⛏️': 'pick', '⛏': 'pick', '🔀': 'shuffle',
    '🔒': 'lock', '🔨': 'hammer', '🃏': 'card'
};

class PixelIcons {
    constructor() {
        this.urls = {};
        this.canvases = {};
        const keys = Object.keys(EMOJI_ICON).sort((a, b) => b.length - a.length);
        this.pattern = new RegExp(`(${keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\uFE0F?`, 'g');
    }

    canvas(name) {
        if (!this.canvases[name]) {
            const rows = ICON_ART[name];
            const w = Math.max(...rows.map(r => r.length));
            const g = new PixelGrid(w + 2, rows.length + 2);
            g.art(1, 1, rows, {});
            g.outline();
            this.canvases[name] = g.toCanvas(ICON_COLORS);
        }
        return this.canvases[name];
    }

    url(name) {
        if (!this.urls[name]) this.urls[name] = this.canvas(name).toDataURL();
        return this.urls[name];
    }

    iconFor(text) {
        const name = EMOJI_ICON[text] || EMOJI_ICON[text.replace('\uFE0F', '')];
        return name && ICON_ART[name] ? name : null;
    }

    // Swap emoji in every text node under `root` for <img> pixel icons
    convert(root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: n => {
                const p = n.parentNode;
                if (!p || /^(SCRIPT|STYLE|TEXTAREA|INPUT|TITLE)$/.test(p.nodeName)) return NodeFilter.FILTER_REJECT;
                this.pattern.lastIndex = 0;
                return this.pattern.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
            }
        });
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(node => {
            const frag = document.createDocumentFragment();
            let last = 0;
            const text = node.nodeValue;
            this.pattern.lastIndex = 0;
            let m;
            while ((m = this.pattern.exec(text))) {
                const name = this.iconFor(m[1]);
                if (!name) continue;
                if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
                const img = document.createElement('img');
                img.className = 'px-icon';
                img.src = this.url(name);
                img.alt = m[1];
                img.draggable = false;
                frag.appendChild(img);
                last = m.index + m[0].length;
                // the space after an icon is kept as it was
            }
            if (last === 0) return;
            if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
            node.parentNode.replaceChild(frag, node);
        });
    }

    // Keep converting as the UI changes
    watch(root = document.body) {
        this.convert(root);
        new MutationObserver(list => {
            list.forEach(m => {
                if (m.type === 'characterData' && m.target.parentNode) this.convert(m.target.parentNode);
                m.addedNodes.forEach(n => {
                    if (n.nodeType === 1) this.convert(n);
                    else if (n.nodeType === 3 && n.parentNode) this.convert(n.parentNode);
                });
            });
        }).observe(root, { childList: true, subtree: true, characterData: true });
    }

    // For the canvas: split a leading emoji off a popup text
    splitLeading(text) {
        this.pattern.lastIndex = 0;
        const m = this.pattern.exec(text);
        if (!m || m.index !== 0) return null;
        const name = this.iconFor(m[1]);
        return name ? { icon: this.canvas(name), rest: text.slice(m[0].length).trimStart() } : null;
    }
}

const pixelIcons = new PixelIcons();
window.addEventListener('DOMContentLoaded', () => pixelIcons.watch());

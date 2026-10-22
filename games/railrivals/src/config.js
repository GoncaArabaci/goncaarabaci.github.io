// Rail Rivals - constants shared by the rules, the board and the UI

const CARD_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'black', 'white'];
const LOCO = 'loco';                 // wild card
const CARDS_PER_COLOR = 12;
const LOCO_CARDS = 14;
const MARKET_SIZE = 5;
const START_CARDS = 4;
const START_TRAINS = 45;
const FINAL_ROUND_AT = 2;            // trains left that start the last round
const LONGEST_ROUTE_BONUS = 10;

// Points for claiming a route of each length
const ROUTE_POINTS = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 10, 6: 15 };

// How each card color looks on the table
const CARD_STYLE = {
    red:    { name: 'Red',    fill: '#ef4444', dark: '#b91c1c', ink: '#fff' },
    orange: { name: 'Orange', fill: '#f97316', dark: '#c2410c', ink: '#fff' },
    yellow: { name: 'Yellow', fill: '#facc15', dark: '#ca8a04', ink: '#422006' },
    green:  { name: 'Green',  fill: '#22c55e', dark: '#15803d', ink: '#fff' },
    blue:   { name: 'Blue',   fill: '#3b82f6', dark: '#1d4ed8', ink: '#fff' },
    purple: { name: 'Purple', fill: '#a855f7', dark: '#7e22ce', ink: '#fff' },
    black:  { name: 'Black',  fill: '#334155', dark: '#0f172a', ink: '#fff' },
    white:  { name: 'White',  fill: '#f1f5f9', dark: '#94a3b8', ink: '#0f172a' },
    loco:   { name: 'Wild',   fill: 'url(#loco-grad)', css: 'linear-gradient(135deg,#f43f5e,#f59e0b,#22c55e,#3b82f6,#a855f7)', dark: '#334155', ink: '#fff' },
    grey:   { name: 'Any',    fill: '#cbd5e1', dark: '#64748b', ink: '#0f172a' }
};

// Player train colors (separate from card colors so they read well on the map)
const PLAYER_STYLE = [
    { name: 'Crimson', fill: '#e11d48', light: '#fda4af' },
    { name: 'Azure',   fill: '#0284c7', light: '#7dd3fc' },
    { name: 'Emerald', fill: '#059669', light: '#6ee7b7' },
    { name: 'Amber',   fill: '#d97706', light: '#fcd34d' },
    { name: 'Violet',  fill: '#7c3aed', light: '#c4b5fd' }
];

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 5;

// Fair shuffle (Fisher-Yates). Returns a new array.
function shuffled(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

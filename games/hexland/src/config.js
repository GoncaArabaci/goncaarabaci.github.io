// Hexland - Core Configuration & Constants

// ==========================================
// 🎮 BOARD SETTINGS - hex size and positions are tuned here
// Change a value → reload the page → see the difference
// ==========================================
const BOARD_CONFIG = {
    hexRadius: 54,          // Distance from hex center to corner (px)
    spriteSize: 108,        // Sprite draw size (width & height)
    spacingX: 93.5,         // Horizontal distance between hexes (same row)
    spacingY: 81,           // Vertical distance between rows
    startAngle: 30,         // Hex corner start angle (30 = pointy-top, matches the tile sprites; 0 = flat-top)
    numberOffsetY: 12,      // Number token Y offset from hex center
};

const RESOURCES = {
    WOOD: 'wood',
    BRICK: 'brick',
    SHEEP: 'sheep',
    WHEAT: 'wheat',
    ORE: 'ore'
};

const BANK_SIZE = 19; // cards of each resource in the bank

const RESOURCE_NAMES = {
    [RESOURCES.WOOD]: 'Wood',
    [RESOURCES.BRICK]: 'Brick',
    [RESOURCES.SHEEP]: 'Wool',
    [RESOURCES.WHEAT]: 'Grain',
    [RESOURCES.ORE]: 'Ore'
};

const RESOURCE_ICONS = {
    [RESOURCES.WOOD]: '🌲',
    [RESOURCES.BRICK]: '🧱',
    [RESOURCES.SHEEP]: '🐑',
    [RESOURCES.WHEAT]: '🌾',
    [RESOURCES.ORE]: '⛏️'
};

const TERRAIN_TYPES = {
    FOREST: { id: 'forest', name: 'Forest', resource: RESOURCES.WOOD, color: '#2d682a', accentColor: '#1b4419' },
    HILLS: { id: 'hills', name: 'Hills', resource: RESOURCES.BRICK, color: '#b84e27', accentColor: '#7a2d12' },
    PASTURE: { id: 'pasture', name: 'Pasture', resource: RESOURCES.SHEEP, color: '#88bf3a', accentColor: '#5c8724' },
    FIELDS: { id: 'fields', name: 'Fields', resource: RESOURCES.WHEAT, color: '#e6b328', accentColor: '#a87e14' },
    MOUNTAINS: { id: 'mountains', name: 'Mountains', resource: RESOURCES.ORE, color: '#687487', accentColor: '#434b59' },
    DESERT: { id: 'desert', name: 'Desert', resource: null, color: '#d9ba77', accentColor: '#a18349' },
    WATER: { id: 'water', name: 'Sea', resource: null, color: '#235b8c', accentColor: '#163b5e' }
};

const COSTS = {
    road: { [RESOURCES.WOOD]: 1, [RESOURCES.BRICK]: 1 },
    settlement: { [RESOURCES.WOOD]: 1, [RESOURCES.BRICK]: 1, [RESOURCES.SHEEP]: 1, [RESOURCES.WHEAT]: 1 },
    city: { [RESOURCES.WHEAT]: 2, [RESOURCES.ORE]: 3 },
    devCard: { [RESOURCES.SHEEP]: 1, [RESOURCES.WHEAT]: 1, [RESOURCES.ORE]: 1 }
};

const DEV_CARD_TYPES = {
    KNIGHT: 'knight',
    VICTORY_POINT: 'victory_point',
    ROAD_BUILDING: 'road_building',
    YEAR_OF_PLENTY: 'year_of_plenty',
    MONOPOLY: 'monopoly'
};

const DEV_CARD_INFO = {
    [DEV_CARD_TYPES.KNIGHT]: { name: 'Knight', desc: 'Move the robber and steal 1 card. 3 knights can earn the Largest Army.' },
    [DEV_CARD_TYPES.VICTORY_POINT]: { name: 'Victory Point', desc: 'Grants 1 hidden Victory Point.' },
    [DEV_CARD_TYPES.ROAD_BUILDING]: { name: 'Road Building', desc: 'Build 2 roads for free.' },
    [DEV_CARD_TYPES.YEAR_OF_PLENTY]: { name: 'Year of Plenty', desc: 'Take any 2 resource cards from the bank.' },
    [DEV_CARD_TYPES.MONOPOLY]: { name: 'Monopoly', desc: 'Take every card of a chosen resource from all other players.' }
};

const STANDARD_TERRAINS = [
    'forest', 'forest', 'forest', 'forest',
    'pasture', 'pasture', 'pasture', 'pasture',
    'fields', 'fields', 'fields', 'fields',
    'hills', 'hills', 'hills',
    'mountains', 'mountains', 'mountains',
    'desert'
];

const STANDARD_NUMBERS = [
    5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11
];

const PLAYER_COLORS = [
    { id: 0, name: 'Red', hex: '#e74c3c', light: '#ff7675', dark: '#c0392b', text: '#ffffff' },
    { id: 1, name: 'Blue', hex: '#3498db', light: '#74b9ff', dark: '#2980b9', text: '#ffffff' },
    { id: 2, name: 'Orange', hex: '#e67e22', light: '#fab1a0', dark: '#d35400', text: '#ffffff' },
    { id: 3, name: 'Green', hex: '#2ecc71', light: '#55efc4', dark: '#27ae60', text: '#ffffff' }
];

const NUMBER_PIPS = {
    2: 1, 3: 2, 4: 3, 5: 4, 6: 5,
    8: 5, 9: 4, 10: 3, 11: 2, 12: 1
};

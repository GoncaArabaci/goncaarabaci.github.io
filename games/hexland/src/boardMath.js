// Hexland - Hexagonal Geometry & Graph Math


class BoardGraph {
    constructor() {
        this.hexRadius = BOARD_CONFIG.hexRadius;
        this.startAngle = BOARD_CONFIG.startAngle;
        this.hexes = [];
        this.vertices = [];
        this.edges = [];
        this.vertexMap = new Map();
        this.edgeMap = new Map();
        this.harbors = [];
        this.robberHexId = 0;

        this.generateBoard();
    }

    generateBoard() {
        this.hexes = [];
        this.vertices = [];
        this.edges = [];
        this.vertexMap.clear();
        this.edgeMap.clear();

        const rowCounts = [3, 4, 5, 4, 3];
        const dx = BOARD_CONFIG.spacingX;
        const dy = BOARD_CONFIG.spacingY;

        const terrains = shuffled(STANDARD_TERRAINS);
        let hexId = 0;

        // Create Hexes
        for (let r = 0; r < rowCounts.length; r++) {
            const count = rowCounts[r];
            for (let c = 0; c < count; c++) {
                const x = (c - (count - 1) / 2) * dx;
                const y = (r - 2) * dy;
                const terrainKey = terrains[hexId];
                const terrain = TERRAIN_TYPES[terrainKey.toUpperCase()];
                if (terrainKey === 'desert') this.robberHexId = hexId;

                const hex = {
                    id: hexId,
                    row: r,
                    col: c,
                    x,
                    y,
                    terrainKey,
                    terrain,
                    resource: terrain.resource,
                    number: null,
                    pips: 0,
                    vertexIds: [],
                    edgeIds: []
                };

                this.hexes.push(hex);
                this.buildHexVerticesAndEdges(hex);
                hexId++;
            }
        }

        this.placeNumbers();
        this.setupHarbors();
    }

    // Number tokens, reshuffled until no 6 or 8 sits next to another 6 or 8
    placeNumbers() {
        const land = this.hexes.filter(h => h.terrainKey !== 'desert');
        const isRed = n => n === 6 || n === 8;
        const touching = (a, b) => a.vertexIds.some(v => b.vertexIds.includes(v));

        for (let attempt = 0; attempt < 1000; attempt++) {
            const numbers = shuffled(STANDARD_NUMBERS);
            land.forEach((h, i) => { h.number = numbers[i]; });
            const red = land.filter(h => isRed(h.number));
            const clash = red.some((a, i) => red.slice(i + 1).some(b => touching(a, b)));
            if (!clash) break;
        }
        land.forEach(h => { h.pips = NUMBER_PIPS[h.number] || 0; });
    }

    getVertexKey(x, y) {
        return `${Math.round(x)}_${Math.round(y)}`;
    }

    getEdgeKey(v1, v2) {
        return v1 < v2 ? `${v1}_${v2}` : `${v2}_${v1}`;
    }

    buildHexVerticesAndEdges(hex) {
        const hexVertIds = [];

        // 6 hex corners based on startAngle from config
        for (let i = 0; i < 6; i++) {
            const angleDeg = 60 * i + this.startAngle;
            const rad = (Math.PI / 180) * angleDeg;
            const vx = hex.x + this.hexRadius * Math.cos(rad);
            const vy = hex.y + this.hexRadius * Math.sin(rad);

            let vId = this.findOrCreateVertex(vx, vy);
            hexVertIds.push(vId);

            const vert = this.vertices[vId];
            if (!vert.hexIds.includes(hex.id)) {
                vert.hexIds.push(hex.id);
            }
        }

        hex.vertexIds = hexVertIds;

        // Build edges connecting consecutive vertices
        for (let i = 0; i < 6; i++) {
            const v1 = hexVertIds[i];
            const v2 = hexVertIds[(i + 1) % 6];

            const edgeId = this.findOrCreateEdge(v1, v2, hex.id);
            hex.edgeIds.push(edgeId);

            // Connect adjacency
            const vert1 = this.vertices[v1];
            const vert2 = this.vertices[v2];

            if (!vert1.adjacentVertexIds.includes(v2)) vert1.adjacentVertexIds.push(v2);
            if (!vert2.adjacentVertexIds.includes(v1)) vert2.adjacentVertexIds.push(v1);

            if (!vert1.edgeIds.includes(edgeId)) vert1.edgeIds.push(edgeId);
            if (!vert2.edgeIds.includes(edgeId)) vert2.edgeIds.push(edgeId);
        }
    }

    findOrCreateVertex(x, y) {
        // Spatial snap search with tolerance
        for (let i = 0; i < this.vertices.length; i++) {
            const v = this.vertices[i];
            const dist = Math.hypot(v.x - x, v.y - y);
            if (dist < 4) {
                return v.id;
            }
        }

        const id = this.vertices.length;
        const vertex = {
            id,
            x,
            y,
            hexIds: [],
            adjacentVertexIds: [],
            edgeIds: [],
            building: null, // { type: 'settlement' | 'city', owner: playerId }
            harbor: null
        };
        this.vertices.push(vertex);
        this.vertexMap.set(this.getVertexKey(x, y), id);
        return id;
    }

    findOrCreateEdge(v1, v2, hexId) {
        const key = this.getEdgeKey(v1, v2);
        if (this.edgeMap.has(key)) {
            const edgeId = this.edgeMap.get(key);
            const edge = this.edges[edgeId];
            if (!edge.hexIds.includes(hexId)) {
                edge.hexIds.push(hexId);
            }
            return edgeId;
        }

        const id = this.edges.length;
        const edge = {
            id,
            v1,
            v2,
            hexIds: [hexId],
            road: null // { owner: playerId }
        };
        this.edges.push(edge);
        this.edgeMap.set(key, id);
        return id;
    }

    setupHarbors() {
        // Standard Hexland Harbor types: 4 of 3:1, and 5 of 2:1 for each resource
        const harborTypes = [
            { type: '3:1', ratio: 3, resource: null, label: '3:1' },
            { type: 'wood_2:1', ratio: 2, resource: RESOURCES.WOOD, label: '2:1 🌲' },
            { type: 'brick_2:1', ratio: 2, resource: RESOURCES.BRICK, label: '2:1 🧱' },
            { type: 'sheep_2:1', ratio: 2, resource: RESOURCES.SHEEP, label: '2:1 🐑' },
            { type: 'wheat_2:1', ratio: 2, resource: RESOURCES.WHEAT, label: '2:1 🌾' },
            { type: 'ore_2:1', ratio: 2, resource: RESOURCES.ORE, label: '2:1 ⛏️' },
            { type: '3:1', ratio: 3, resource: null, label: '3:1' },
            { type: '3:1', ratio: 3, resource: null, label: '3:1' },
            { type: '3:1', ratio: 3, resource: null, label: '3:1' }
        ];
        const types = shuffled(harborTypes);

        // Coastal edges (only 1 hex), in order around the island
        const angle = e => {
            const a = this.vertices[e.v1], b = this.vertices[e.v2];
            return Math.atan2((a.y + b.y) / 2, (a.x + b.x) / 2);
        };
        const coast = this.edges.filter(e => e.hexIds.length === 1).sort((a, b) => angle(a) - angle(b));

        // Spread 9 harbors with gaps of 3–4 edges like the printed board, so no
        // two harbors share or touch a corner. Random starting point.
        const gaps = shuffled([3, 3, 3, 3, 3, 3, 4, 4, 4]);
        let pos = Math.floor(Math.random() * coast.length);
        this.harbors = [];

        for (let i = 0; i < types.length; i++) {
            const edge = coast[pos % coast.length];
            pos += gaps[i];
            const hInfo = types[i];
            const harborObj = {
                id: i,
                edgeId: edge.id,
                v1: edge.v1,
                v2: edge.v2,
                ...hInfo
            };

            this.harbors.push(harborObj);
            this.vertices[edge.v1].harbor = harborObj;
            this.vertices[edge.v2].harbor = harborObj;
        }
    }

    // Distance rule: settlement cannot be adjacent to any existing building
    canBuildSettlement(vertexId, playerId, isInitial = false) {
        const v = this.vertices[vertexId];
        if (!v || v.building) return false;

        // Check 1-edge distance rule: no building on any adjacent vertex
        for (const adjId of v.adjacentVertexIds) {
            if (this.vertices[adjId].building) {
                return false;
            }
        }

        // In normal game phase, must connect to at least one player road
        if (!isInitial) {
            const hasConnectedRoad = v.edgeIds.some(edgeId => {
                const edge = this.edges[edgeId];
                return edge.road && edge.road.owner === playerId;
            });
            if (!hasConnectedRoad) return false;
        }

        return true;
    }

    canBuildCity(vertexId, playerId) {
        const v = this.vertices[vertexId];
        return v && v.building && v.building.type === 'settlement' && v.building.owner === playerId;
    }

    canBuildRoad(edgeId, playerId, initialVertexId = null) {
        const edge = this.edges[edgeId];
        if (!edge || edge.road) return false;

        // In initial setup phase, must connect to the recently placed settlement
        if (initialVertexId !== null) {
            return edge.v1 === initialVertexId || edge.v2 === initialVertexId;
        }

        // In normal game phase:
        // Must connect to a vertex that has player's settlement/city, OR
        // connect to another player road (unless blocked by enemy settlement)
        const vertices = [this.vertices[edge.v1], this.vertices[edge.v2]];

        for (const v of vertices) {
            // Own building connects road
            if (v.building && v.building.owner === playerId) {
                return true;
            }
            // If enemy building is here, road cannot pass through
            if (v.building && v.building.owner !== playerId) {
                continue;
            }
            // Check connected edges with own road
            for (const otherEdgeId of v.edgeIds) {
                if (otherEdgeId !== edgeId) {
                    const otherEdge = this.edges[otherEdgeId];
                    if (otherEdge.road && otherEdge.road.owner === playerId) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    // Find nearest vertex for click hit-testing
    getNearestVertex(x, y, maxDistance = 22) {
        let nearest = null;
        let minDist = maxDistance;

        for (const v of this.vertices) {
            const dist = Math.hypot(v.x - x, v.y - y);
            if (dist < minDist) {
                minDist = dist;
                nearest = v;
            }
        }
        return nearest;
    }

    // Find nearest edge for click hit-testing
    getNearestEdge(x, y, maxDistance = 20) {
        let nearest = null;
        let minDist = maxDistance;

        for (const edge of this.edges) {
            const v1 = this.vertices[edge.v1];
            const v2 = this.vertices[edge.v2];
            const dist = BoardGraph.distanceToSegment(x, y, v1, v2);
            if (dist < minDist) {
                minDist = dist;
                nearest = edge;
            }
        }
        return nearest;
    }

    static distanceToSegment(x, y, a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
        return Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy));
    }

    // Find nearest hex for robber movement click
    getNearestHex(x, y) {
        let nearest = null;
        let minDist = this.hexRadius;

        for (const hex of this.hexes) {
            const dist = Math.hypot(hex.x - x, hex.y - y);
            if (dist < minDist) {
                minDist = dist;
                nearest = hex;
            }
        }
        return nearest;
    }
}

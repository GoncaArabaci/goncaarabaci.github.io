// Rail Rivals - Online rooms over WebRTC (PeerJS)
// The host's browser runs the game; guests send their moves to the host and
// receive a fresh snapshot after every change. PeerJS's free public server is
// only used to introduce the browsers to each other.

const PEER_PREFIX = 'railrivals-room-';

// Optional relay (TURN) for players on strict networks (schools, offices,
// some mobile data). Fill in a provider's credentials URL that returns a
// list of ICE servers, e.g. Metered: https://<app>.metered.live/api/v1/turn/credentials?apiKey=<key>
// The page's Content-Security-Policy must allow that host in connect-src.
const TURN_CREDENTIALS_URL = '';

const STUN_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
];

// Retry a missing room a few times: the host may be reconnecting
const ROOM_RETRIES = 3;
const ROOM_RETRY_MS = 3000;

class RailNet {
    constructor() {
        this.peer = null;
        this.isHost = false;
        this.hostConn = null;          // guest -> host connection
        this.guestConns = new Map();   // host: connId -> connection
        this.handlers = {};
    }

    on(event, fn) {
        this.handlers[event] = fn;
    }

    emit(event, ...args) {
        if (this.handlers[event]) this.handlers[event](...args);
    }

    static makeRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
        return code;
    }

    // STUN plus, when configured, the relay servers (never blocks for long)
    async peerOptions() {
        let relay = [];
        if (TURN_CREDENTIALS_URL) {
            try {
                const ctrl = new AbortController();
                const t = setTimeout(() => ctrl.abort(), 4000);
                const res = await fetch(TURN_CREDENTIALS_URL, { signal: ctrl.signal });
                clearTimeout(t);
                const list = await res.json();
                if (Array.isArray(list)) relay = list;
            } catch (e) {
                console.warn('Relay servers unavailable, trying without them:', e);
            }
        }
        return { config: { iceServers: [...STUN_SERVERS, ...relay] } };
    }

    // Host: open a room with the given code
    async host(code) {
        this.isHost = true;
        const options = await this.peerOptions();

        // Backup route for guests whose network blocks direct connections.
        // It doesn't need WebRTC, so it also keeps the room open when the
        // host's own VPN or DPI tool breaks direct connections.
        let relayReady = Promise.resolve(0);
        if (typeof RelayHost !== 'undefined' && window.crypto && crypto.subtle) {
            this.relayKey = RelayCrypto.newKey();
            this.relay = new RelayHost(this.relayKey, conn => this.addGuest(conn));
            relayReady = this.relay.start().catch(e => { console.warn('Backup connection unavailable:', e); return 0; });
        }

        return new Promise((resolve, reject) => {
            let settled = false;
            const ok = () => {
                if (settled) return;
                settled = true;
                this.emit('status', 'online');
                resolve(code);
            };
            const directFailed = async err => {
                if (settled) return;
                if (await relayReady > 0) {
                    console.warn('Direct connections unavailable, using the backup only:', err);
                    ok();
                } else if (!settled) {
                    settled = true;
                    reject(err);
                }
            };
            const giveUp = setTimeout(() => directFailed(new Error('TIMEOUT')), 12000);

            try {
                if (typeof RTCPeerConnection === 'undefined') throw new Error('UNSUPPORTED');
                this.peer = new Peer(PEER_PREFIX + code, options);
            } catch (e) {
                clearTimeout(giveUp);
                directFailed(e);
                return;
            }

            this.peer.on('open', () => {
                clearTimeout(giveUp);
                this.everOpen = true;
                ok();
                this.emit('status', 'online');
            });

            this.peer.on('error', err => {
                if (err.type === 'unavailable-id' && !this.peer.open && !settled) {
                    settled = true;
                    clearTimeout(giveUp);
                    reject(new Error('ROOM_TAKEN'));
                } else if (!this.peer.open && !this.everOpen) {
                    clearTimeout(giveUp);
                    directFailed(err);
                } else {
                    console.warn('Peer error:', err);
                }
            });

            this.peer.on('connection', conn => this.addGuest(conn));

            // Losing the signalling server makes the room invisible to new
            // players ("room not found"), e.g. when the tab sits in the
            // background or the laptop sleeps. Reconnect whenever we can.
            const reconnect = () => {
                if (this.peer && this.peer.disconnected && !this.peer.destroyed) {
                    this.emit('status', 'reconnecting');
                    try { this.peer.reconnect(); } catch (e) { /* tries again later */ }
                }
            };
            this.peer.on('disconnected', reconnect);
            setInterval(reconnect, 5000);
            document.addEventListener('visibilitychange', () => { if (!document.hidden) reconnect(); });
            window.addEventListener('online', reconnect);
        });
    }

    // A guest connection, direct (PeerJS) or through the backup relay
    addGuest(conn) {
        if (conn.open) this.guestConns.set(conn.peer, conn);
        conn.on('open', () => this.guestConns.set(conn.peer, conn));
        conn.on('data', msg => this.emit('guestMessage', conn.peer, msg));
        conn.on('close', () => {
            this.guestConns.delete(conn.peer);
            this.emit('guestLeft', conn.peer);
        });
    }

    // Guest: connect to a host's room. Tries a direct connection first, then
    // the backup relay (needs relayKey from the invite link).
    async join(code, onStage = () => {}) {
        const canRelay = !!(this.relayKey && typeof relayJoin !== 'undefined' && window.crypto && crypto.subtle);
        try {
            await this.joinDirect(code, onStage, canRelay ? 15000 : 30000);
        } catch (err) {
            // also when WebRTC is switched off (some VPNs and privacy add-ons)
            if (!canRelay) throw err;
            try {
                const conn = await relayJoin(this.relayKey, onStage);
                this.hostConn = conn;
                conn.on('data', msg => this.emit('hostMessage', msg));
                conn.on('close', () => this.emit('hostLeft'));
                window.addEventListener('pagehide', () => conn.bye());
            } catch (relayErr) {
                throw err;   // the direct error explains more
            }
        }
    }

    async joinDirect(code, onStage, waitMs) {
        this.isHost = false;
        if (typeof RTCPeerConnection === 'undefined') throw new Error('UNSUPPORTED');
        onStage('Connecting to the server…');
        const options = await this.peerOptions();

        return new Promise((resolve, reject) => {
            this.peer = new Peer(options);
            let done = false;
            let tries = 0;
            const fail = reason => {
                if (done) return;
                done = true;
                clearTimeout(timeout);
                // drop the half-open connection so it can't join later by surprise
                try { this.peer.destroy(); } catch (e) { /* already closed */ }
                reject(new Error(reason));
            };

            // Connections between different networks can take a while
            const timeout = setTimeout(() => fail('TIMEOUT'), waitMs);

            const connect = () => {
                onStage(tries ? 'Looking for the room again…' : 'Reaching the host…');
                // PeerJS's default binary format splits big messages into
                // chunks ('json' silently drops messages over ~16 KB)
                const conn = this.peer.connect(PEER_PREFIX + code, { reliable: true });
                conn.on('open', () => {
                    if (done) return;
                    done = true;
                    clearTimeout(timeout);
                    this.hostConn = conn;
                    resolve();
                });
                conn.on('data', msg => this.emit('hostMessage', msg));
                conn.on('close', () => { if (this.hostConn === conn) this.emit('hostLeft'); });
            };

            this.peer.on('open', connect);

            this.peer.on('error', err => {
                if (this.hostConn) { console.warn('Peer error:', err); return; }
                if (err.type === 'peer-unavailable') {
                    if (++tries <= ROOM_RETRIES) setTimeout(() => { if (!done) connect(); }, ROOM_RETRY_MS);
                    else fail('ROOM_NOT_FOUND');
                } else if (err.type === 'browser-incompatible') fail('UNSUPPORTED');
                else fail('NETWORK');
            });
        });
    }

    sendToHost(msg) {
        if (this.hostConn && this.hostConn.open) this.hostConn.send(msg);
    }

    sendTo(connId, msg) {
        const conn = this.guestConns.get(connId);
        if (conn && conn.open) conn.send(msg);
    }
}

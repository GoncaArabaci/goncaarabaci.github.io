// Rail Rivals - Online rooms over WebRTC (PeerJS)
// The host's browser runs the game; guests send their moves to the host and
// receive a fresh snapshot after every change. PeerJS's free public server is
// only used to introduce the browsers to each other.

const PEER_PREFIX = 'railrivals-room-';

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

    // Host: open a room with the given code
    host(code) {
        this.isHost = true;
        return new Promise((resolve, reject) => {
            this.peer = new Peer(PEER_PREFIX + code);

            this.peer.on('open', () => resolve(code));

            this.peer.on('error', err => {
                if (err.type === 'unavailable-id') reject(new Error('ROOM_TAKEN'));
                else if (!this.peer.open) reject(err);
                else console.warn('Peer error:', err);
            });

            this.peer.on('connection', conn => {
                conn.on('open', () => this.guestConns.set(conn.peer, conn));
                conn.on('data', msg => this.emit('guestMessage', conn.peer, msg));
                conn.on('close', () => {
                    this.guestConns.delete(conn.peer);
                    this.emit('guestLeft', conn.peer);
                });
            });

            this.peer.on('disconnected', () => this.peer.reconnect());
        });
    }

    // Guest: connect to a host's room
    join(code) {
        this.isHost = false;
        return new Promise((resolve, reject) => {
            this.peer = new Peer();

            const timeout = setTimeout(() => reject(new Error('TIMEOUT')), 15000);

            this.peer.on('open', () => {
                const conn = this.peer.connect(PEER_PREFIX + code, { reliable: true });
                conn.on('open', () => {
                    clearTimeout(timeout);
                    this.hostConn = conn;
                    resolve();
                });
                conn.on('data', msg => this.emit('hostMessage', msg));
                conn.on('close', () => this.emit('hostLeft'));
            });

            this.peer.on('error', err => {
                clearTimeout(timeout);
                if (err.type === 'peer-unavailable') reject(new Error('ROOM_NOT_FOUND'));
                else if (!this.hostConn) reject(err);
                else console.warn('Peer error:', err);
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

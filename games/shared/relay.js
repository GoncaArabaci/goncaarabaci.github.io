// Backup connection for the online games (Hexland, Rail Rivals)
//
// Normally players connect browser-to-browser (WebRTC). Some networks, VPNs
// and DPI tools (like GoodbyeDPI) break that. Then the messages go through
// free public MQTT brokers over a normal secure WebSocket instead.
//
// The brokers are public, so every message is encrypted (AES-GCM). The key
// lives in the invite link after "#", which browsers never send to any
// server: only people with the link can read or send game messages.

const RELAY_BROKERS = [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt',
    'wss://test.mosquitto.org:8081/mqtt'
];
const RELAY_TOPIC_ROOT = 'goncaarabaci-games/v1';

// ---------- A very small MQTT 3.1.1 client (QoS 0 only) ----------

class MiniMqtt {
    constructor(url) {
        this.url = url;
        this.handlers = new Map();
        this.buf = new Uint8Array(0);
        this.packetId = 1;
        this.onclose = null;
    }

    static str(s) {
        const b = new TextEncoder().encode(s);
        return [b.length >> 8, b.length & 255, ...b];
    }

    static varLength(n) {
        const out = [];
        do {
            let d = n % 128;
            n = Math.floor(n / 128);
            if (n > 0) d |= 128;
            out.push(d);
        } while (n > 0);
        return out;
    }

    connect(timeoutMs = 7000) {
        return new Promise((resolve, reject) => {
            let ws;
            try { ws = new WebSocket(this.url, 'mqtt'); } catch (e) { reject(e); return; }
            this.ws = ws;
            ws.binaryType = 'arraybuffer';
            let ready = false;
            const timer = setTimeout(() => { reject(new Error('timeout')); this.close(); }, timeoutMs);
            ws.onopen = () => {
                const clientId = 'gg' + Math.random().toString(36).slice(2, 14);
                // clean session, keep-alive 30 s
                this.send(0x10, [...MiniMqtt.str('MQTT'), 4, 2, 0, 30, ...MiniMqtt.str(clientId)]);
            };
            ws.onmessage = e => this.feed(new Uint8Array(e.data), () => {
                if (ready) return;
                ready = true;
                clearTimeout(timer);
                this.pinger = setInterval(() => this.send(0xC0, []), 20000);
                resolve(this);
            });
            ws.onerror = () => { if (!ready) { clearTimeout(timer); reject(new Error('socket error')); } };
            ws.onclose = () => {
                clearInterval(this.pinger);
                if (ready && this.onclose) this.onclose();
            };
        });
    }

    get open() { return this.ws && this.ws.readyState === 1; }

    send(type, body) {
        if (!this.open) return;
        const b = body instanceof Uint8Array ? body : Uint8Array.from(body);
        const head = [type, ...MiniMqtt.varLength(b.length)];
        const packet = new Uint8Array(head.length + b.length);
        packet.set(head);
        packet.set(b, head.length);
        this.ws.send(packet);
    }

    subscribe(topic, fn) {
        this.handlers.set(topic, fn);
        const id = this.packetId++;
        this.send(0x82, [id >> 8, id & 255, ...MiniMqtt.str(topic), 0]);
    }

    publish(topic, bytes) {
        const t = MiniMqtt.str(topic);
        const body = new Uint8Array(t.length + bytes.length);
        body.set(t);
        body.set(bytes, t.length);
        this.send(0x30, body);
    }

    // Packets can arrive split or several at once
    feed(chunk, onConnack) {
        const merged = new Uint8Array(this.buf.length + chunk.length);
        merged.set(this.buf);
        merged.set(chunk, this.buf.length);
        this.buf = merged;

        while (this.buf.length >= 2) {
            let rem = 0, mult = 1, i = 1, byte;
            do {
                if (i >= this.buf.length) return;
                byte = this.buf[i++];
                rem += (byte & 127) * mult;
                mult *= 128;
            } while (byte & 128 && i < 5);
            const total = i + rem;
            if (this.buf.length < total) return;
            const packet = this.buf.subarray(0, total);
            const type = packet[0] >> 4;
            if (type === 2 && packet[i + 1] === 0) onConnack();
            if (type === 3) {
                const qos = (packet[0] >> 1) & 3;
                const tl = (packet[i] << 8) | packet[i + 1];
                const topic = new TextDecoder().decode(packet.subarray(i + 2, i + 2 + tl));
                const data = packet.slice(i + 2 + tl + (qos ? 2 : 0));
                const fn = this.handlers.get(topic);
                if (fn) fn(data);
            }
            this.buf = this.buf.slice(total);
        }
    }

    close() {
        clearInterval(this.pinger);
        try { this.ws.close(); } catch (e) { /* already closed */ }
    }
}

// ---------- Encryption ----------

class RelayCrypto {
    static newKey() {
        const raw = crypto.getRandomValues(new Uint8Array(16));
        return btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    static async create(keyText) {
        const b64 = keyText.replace(/-/g, '+').replace(/_/g, '/');
        const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        if (raw.length !== 16) throw new Error('bad key');
        const c = new RelayCrypto();
        c.key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
        const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', raw));
        c.topic = `${RELAY_TOPIC_ROOT}/${[...hash.slice(0, 12)].map(x => x.toString(16).padStart(2, '0')).join('')}`;
        return c;
    }

    async seal(obj) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const data = new TextEncoder().encode(JSON.stringify(obj));
        const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.key, data));
        const out = new Uint8Array(12 + ct.length);
        out.set(iv);
        out.set(ct, 12);
        return out;
    }

    // Returns null for anything we can't decrypt (not from someone with the link)
    async open(bytes) {
        try {
            const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, this.key, bytes.slice(12));
            return JSON.parse(new TextDecoder().decode(plain));
        } catch (e) {
            return null;
        }
    }
}

// A relayed connection that looks like a PeerJS DataConnection to the games
class RelayConn {
    constructor(id, sendFn) {
        this.peer = id;
        this.open = true;
        this.sendFn = sendFn;
        this.handlers = {};
    }

    on(event, fn) { this.handlers[event] = fn; }
    emit(event, arg) { if (this.handlers[event]) this.handlers[event](arg); }
    send(msg) { if (this.open) this.sendFn(msg); }

    close() {
        if (!this.open) return;
        this.open = false;
        this.emit('close');
    }
}

// ---------- Host side: listens on every broker it can reach ----------

class RelayHost {
    // onGuest(conn): a new relayed guest (conn already open)
    constructor(keyText, onGuest) {
        this.keyText = keyText;
        this.onGuest = onGuest;
        this.guests = new Map();   // guest id -> { conn, client }
        this.clients = [];
    }

    async start() {
        this.crypto = await RelayCrypto.create(this.keyText);
        await Promise.all(RELAY_BROKERS.map(url => this.listen(url)));
        return this.clients.length;
    }

    async listen(url) {
        const client = new MiniMqtt(url);
        try {
            await client.connect();
        } catch (e) {
            setTimeout(() => this.listen(url), 15000);
            return;
        }
        this.clients.push(client);
        client.subscribe(`${this.crypto.topic}/h`, bytes => this.receive(client, bytes));
        client.onclose = () => {
            this.clients = this.clients.filter(c => c !== client);
            setTimeout(() => this.listen(url), 5000);
        };
    }

    async receive(client, bytes) {
        const msg = await this.crypto.open(bytes);
        if (!msg || typeof msg.from !== 'string' || !/^[a-z0-9]{6,24}$/.test(msg.from)) return;
        const gid = msg.from;
        let entry = this.guests.get(gid);

        if (msg.type === 'hello') {
            if (!entry) {
                const conn = new RelayConn(`relay-${gid}`, data => this.sendTo(gid, { type: 'data', data }));
                entry = { conn, client };
                this.guests.set(gid, entry);
                this.onGuest(conn);
            }
            entry.client = client;   // answer on the broker the guest uses
            this.sendTo(gid, { type: 'welcome' });
        } else if (entry && msg.type === 'data') {
            entry.client = client;
            entry.conn.emit('data', msg.data);
        } else if (entry && msg.type === 'bye') {
            this.guests.delete(gid);
            entry.conn.close();
        }
    }

    async sendTo(gid, obj) {
        const entry = this.guests.get(gid);
        if (!entry || !entry.client.open) return;
        entry.client.publish(`${this.crypto.topic}/g/${gid}`, await this.crypto.seal(obj));
    }
}

// ---------- Guest side ----------

async function relayJoin(keyText, onStage = () => {}) {
    const c = await RelayCrypto.create(keyText);
    const gid = Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 6);
    let lastError = new Error('NETWORK');

    for (const url of RELAY_BROKERS) {
        onStage('Trying a backup connection…');
        const client = new MiniMqtt(url);
        try {
            await client.connect();
        } catch (e) {
            lastError = e;
            continue;
        }

        const conn = new RelayConn(`relay-host`, async data => {
            if (client.open) client.publish(`${c.topic}/h`, await c.seal({ from: gid, type: 'data', data }));
        });
        const welcomed = new Promise(resolve => {
            client.subscribe(`${c.topic}/g/${gid}`, async bytes => {
                const msg = await c.open(bytes);
                if (!msg) return;
                if (msg.type === 'welcome') resolve(true);
                else if (msg.type === 'data') conn.emit('data', msg.data);
            });
        });
        client.onclose = () => conn.close();

        // say hello until the host answers (it may still be subscribing)
        const hello = async () => client.publish(`${c.topic}/h`, await c.seal({ from: gid, type: 'hello' }));
        await hello();
        const repeat = setInterval(hello, 2000);
        const ok = await Promise.race([welcomed, new Promise(r => setTimeout(() => r(false), 8000))]);
        clearInterval(repeat);
        if (ok) {
            conn.bye = async () => {
                if (client.open) client.publish(`${c.topic}/h`, await c.seal({ from: gid, type: 'bye' }));
            };
            return conn;
        }
        client.close();
        lastError = new Error('ROOM_NOT_FOUND');
    }
    throw lastError;
}

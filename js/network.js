// WebSocket client. Auto-detects URL: same host as page (works on Render).

export class Network {
  constructor() {
    this.ws = null;
    this.handlers = new Map();
    this.connected = false;
    this.youId = null;
  }

  on(type, fn) { this.handlers.set(type, fn); }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${location.host}`;
    this.ws = new WebSocket(url);

    this.ws.addEventListener('open', () => {
      this.connected = true;
      this.handlers.get('open')?.();
    });

    this.ws.addEventListener('close', () => {
      this.connected = false;
      this.handlers.get('close')?.();
    });

    this.ws.addEventListener('error', () => {
      this.handlers.get('error')?.();
    });

    this.ws.addEventListener('message', (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.t === 'init') this.youId = msg.you;
      const h = this.handlers.get(msg.t);
      if (h) h(msg);
    });
  }

  send(obj) {
    if (this.connected && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(obj));
    }
  }
}

class SSEClient {
  constructor(url) {
    this.url = url;
    this.es = null;
    this.failCount = 0;
    this.maxFails = 3;
    this.heartbeatTimer = null;
    this.lastPong = 0;
    this.onMessage = null;
    this.onConnect = null;
    this.onDisconnect = null;
    this.onReconnect = null;
    this.connect();
  }

  connect() {
    this.es = new EventSource(this.url);

    this.es.onopen = () => {
      this.failCount = 0;
      if (this.onConnect) this.onConnect();
      this.startHeartbeat();
    };

    this.es.addEventListener('connected', () => {
      this.lastPong = Date.now();
    });

    this.es.addEventListener('new_news', (event) => {
      try {
        const data = JSON.parse(event.data);
        this.lastPong = Date.now();
        if (this.onMessage) this.onMessage(data);
      } catch (e) {
        console.error('SSE parse error:', e);
      }
    });

    this.es.onerror = () => {
      this.failCount++;
      this.stopHeartbeat();

      if (this.failCount >= this.maxFails) {
        this.es.close();
        this.es = null;
        if (this.onDisconnect) this.onDisconnect();
        setTimeout(() => this.connect(), 5000);
      } else if (this.onReconnect) {
        this.onReconnect(this.maxFails - this.failCount);
      }
    };
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.lastPong = Date.now();
    this.heartbeatTimer = setInterval(() => {
      if (Date.now() - this.lastPong > 35000) {
        this.es.close();
        this.es = null;
        if (this.onDisconnect) this.onDisconnect();
        setTimeout(() => this.connect(), 3000);
      }
    }, 10000);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  close() {
    this.stopHeartbeat();
    if (this.es) {
      this.es.close();
      this.es = null;
    }
  }
}

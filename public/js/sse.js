class SSEClient {
  constructor(url) {
    this.url = url;
    this.es = null;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.onMessage = null;
    this.onConnect = null;
    this.onDisconnect = null;
    this.connect();
  }

  connect() {
    this.es = new EventSource(this.url);

    this.es.onopen = () => {
      this.reconnectDelay = 1000;
      if (this.onConnect) this.onConnect();
    };

    this.es.addEventListener('new_news', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (this.onMessage) this.onMessage(data);
      } catch (e) {
        console.error('SSE parse error:', e);
      }
    });

    this.es.onerror = () => {
      this.es.close();
      if (this.onDisconnect) this.onDisconnect();
      setTimeout(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
        this.connect();
      }, this.reconnectDelay);
    };
  }

  close() {
    if (this.es) {
      this.es.close();
      this.es = null;
    }
  }
}

// Durable Object for handling WebSocket connections and real-time collaboration
export class EditorDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Set();
    this.content = '';
    this.lastSaved = 0;
    this.editorId = null;
  }

  async fetch(request) {
    const url = new URL(request.url);

    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    // Handle save request from main worker
    if (url.pathname === '/save') {
      await this.saveToDatabase();
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }

  async handleWebSocket(request) {
    const url = new URL(request.url);
    const editorId = url.pathname.split('/ws/')[1];

    if (!editorId) {
      return new Response('Editor ID required', { status: 400 });
    }

    // Set editor ID if not set
    if (!this.editorId) {
      this.editorId = editorId;

      // Load content from database on first connection
      await this.loadFromDatabase();
    }

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket connection
    server.accept();

    // Create session object
    const session = {
      webSocket: server,
      id: crypto.randomUUID()
    };

    // Add to active sessions
    this.sessions.add(session);

    // Send current content to new client
    server.send(JSON.stringify({
      type: 'content-update',
      content: this.content
    }));

    // Send connection status
    server.send(JSON.stringify({
      type: 'status',
      message: 'Connected',
      connections: this.sessions.size
    }));

    // Broadcast connection count to all clients
    this.broadcast(JSON.stringify({
      type: 'connections',
      count: this.sessions.size
    }), session);

    // Handle messages
    server.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'content-change') {
          // Update content
          this.content = data.content;

          // Broadcast to all other clients
          this.broadcast(JSON.stringify({
            type: 'content-update',
            content: data.content
          }), session);

          // Auto-save after interval
          this.scheduleSave();
        }
      } catch (error) {
        console.error('Message handling error:', error);
      }
    });

    // Handle close
    server.addEventListener('close', async () => {
      this.sessions.delete(session);

      // Broadcast updated connection count
      this.broadcast(JSON.stringify({
        type: 'connections',
        count: this.sessions.size
      }));

      // Save if last connection and has content
      if (this.sessions.size === 0 && this.content.trim()) {
        await this.saveToDatabase();
      }
    });

    // Handle errors
    server.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      this.sessions.delete(session);
    });

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  // Broadcast message to all sessions except sender
  broadcast(message, excludeSession = null) {
    for (const session of this.sessions) {
      if (session !== excludeSession) {
        try {
          session.webSocket.send(message);
        } catch (error) {
          // Remove failed session
          this.sessions.delete(session);
        }
      }
    }
  }

  // Schedule auto-save
  scheduleSave() {
    const now = Date.now();
    const SAVE_INTERVAL = 60000; // 60 seconds

    if (now - this.lastSaved > SAVE_INTERVAL) {
      this.saveToDatabase();
    }
  }

  // Load content from D1 database
  async loadFromDatabase() {
    if (!this.editorId || !this.env.DB) return;

    try {
      const result = await this.env.DB.prepare(
        'SELECT content FROM editors WHERE id = ?'
      ).bind(this.editorId).first();

      if (result && result.content) {
        this.content = this.decompress(result.content);
      }
    } catch (error) {
      console.error('Load from DB error:', error);
    }
  }

  // Save content to D1 database
  async saveToDatabase() {
    if (!this.editorId || !this.env.DB || !this.content.trim()) return;

    try {
      const compressed = this.compress(this.content);
      const now = Date.now();

      await this.env.DB.prepare(
        `INSERT INTO editors (id, content, updated_at, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET 
         content = excluded.content,
         updated_at = excluded.updated_at`
      ).bind(this.editorId, compressed, now, now).run();

      this.lastSaved = now;

      // Also cache in KV for faster access
      if (this.env.CACHE) {
        await this.env.CACHE.put(
          `editor:${this.editorId}`,
          this.content,
          { expirationTtl: 3600 } // 1 hour
        );
      }
    } catch (error) {
      console.error('Save to DB error:', error);
    }
  }

  // Compression helpers
  compress(data) {
    try {
      return btoa(unescape(encodeURIComponent(data)));
    } catch (e) {
      return data;
    }
  }

  decompress(data) {
    try {
      return decodeURIComponent(escape(atob(data)));
    } catch (e) {
      return data;
    }
  }

  // Alarm handler for periodic saves
  async alarm() {
    if (this.content.trim() && this.sessions.size > 0) {
      await this.saveToDatabase();
    }

    // Schedule next alarm
    await this.state.storage.setAlarm(Date.now() + 60000);
  }
}
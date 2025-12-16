// Optimized Durable Object for handling WebSocket connections
export class EditorDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Set();
    this.content = '';
    this.lastSaved = 0;
    this.username = null;
    this.editorId = null;
    this.isLoading = false;
    
    // Preload content on construction
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get('content');
      if (stored) {
        this.content = stored;
      }
    });
  }

  async fetch(request) {
    const url = new URL(request.url);

    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    // Handle save request
    if (url.pathname === '/save') {
      await this.saveToDatabase();
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Handle reset request
    if (url.pathname === '/reset') {
      this.content = '';
      this.username = null;
      this.editorId = null;
      this.sessions.clear();
      await this.state.storage.deleteAll();
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }

  async handleWebSocket(request) {
    const username = request.headers.get('x-username');
    const editorId = request.headers.get('x-editor-id');

    if (!username || !editorId) {
      return new Response('User ID and Editor ID required', { status: 400 });
    }

    // Set IDs if not set
    if (!this.username || !this.editorId) {
      this.username = username;
      this.editorId = editorId;

      // Load content from storage or database
      if (!this.content) {
        const stored = await this.state.storage.get('content');
        if (stored) {
          this.content = stored;
        } else {
          await this.loadFromDatabase();
        }
      }
    }

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept connection
    server.accept();

    // Create session
    const session = {
      webSocket: server,
      id: crypto.randomUUID(),
      lastActivity: Date.now()
    };

    this.sessions.add(session);

    // Send current content immediately
    try {
      server.send(JSON.stringify({
        type: 'content-update',
        content: this.content
      }));

      this.broadcastConnectionCount();
    } catch (error) {
      console.error('Initial message error:', error);
      this.sessions.delete(session);
    }

    // Handle messages
    server.addEventListener('message', async (event) => {
      try {
        session.lastActivity = Date.now();
        const data = JSON.parse(event.data);

        if (data.type === 'content-change') {
          this.content = data.content;
          
          // Store in DO storage
          await this.state.storage.put('content', data.content);

          // Broadcast to others
          this.broadcast(JSON.stringify({
            type: 'content-update',
            content: data.content
          }), session);

          this.scheduleSave();
        }
      } catch (error) {
        console.error('Message handling error:', error);
      }
    });

    // Handle close
    server.addEventListener('close', async () => {
      this.sessions.delete(session);
      this.broadcastConnectionCount();

      // Save if last connection
      if (this.sessions.size === 0 && this.content.trim()) {
        await this.saveToDatabase();
      }
    });

    // Handle errors
    server.addEventListener('error', () => {
      this.sessions.delete(session);
    });

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  broadcast(message, excludeSession = null) {
    const deadSessions = [];
    
    for (const session of this.sessions) {
      if (session !== excludeSession) {
        try {
          session.webSocket.send(message);
        } catch (error) {
          deadSessions.push(session);
        }
      }
    }
    
    deadSessions.forEach(s => this.sessions.delete(s));
  }

  broadcastConnectionCount() {
    const message = JSON.stringify({
      type: 'connections',
      count: this.sessions.size
    });
    this.broadcast(message);
  }

  scheduleSave() {
    const now = Date.now();
    const SAVE_INTERVAL = 30000; // 30 seconds

    if (now - this.lastSaved > SAVE_INTERVAL) {
      this.saveToDatabase();
    }
  }

  async loadFromDatabase() {
    if (!this.username || !this.editorId || !this.env.DB || this.isLoading) return;

    this.isLoading = true;
    
    try {
      // Try KV cache first
      if (this.env.REALTIME_EDITOR_CACHE) {
        const cached = await this.env.REALTIME_EDITOR_CACHE.get(`editor:${this.username}:${this.editorId}`);
        if (cached) {
          this.content = cached;
          await this.state.storage.put('content', cached);
          return;
        }
      }

      // Fallback to D1
      const result = await this.env.DB.prepare(
        'SELECT content FROM editors WHERE username = ? AND id = ?'
      ).bind(this.username, this.editorId).first();

      if (result && result.content) {
        this.content = this.decompress(result.content);
        await this.state.storage.put('content', this.content);
        
        // Update KV cache
        if (this.env.REALTIME_EDITOR_CACHE) {
          await this.env.REALTIME_EDITOR_CACHE.put(
            `editor:${this.username}:${this.editorId}`,
            this.content,
            { expirationTtl: 300 }
          );
        }
      }
    } catch (error) {
      console.error('Load from DB error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async saveToDatabase() {
    if (!this.username || !this.editorId || !this.env.DB) return;

    try {
      const compressed = this.compress(this.content);
      const now = Date.now();

      await this.env.DB.prepare(
        `INSERT INTO editors (username, id, content, updated_at, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(username, id) DO UPDATE SET 
         content = excluded.content,
         updated_at = excluded.updated_at`
      ).bind(this.username, this.editorId, compressed, now, now).run();

      this.lastSaved = now;

      // Update KV cache
      if (this.env.REALTIME_EDITOR_CACHE) {
        await this.env.REALTIME_EDITOR_CACHE.put(
          `editor:${this.username}:${this.editorId}`,
          this.content,
          { expirationTtl: 300 }
        );
      }
    } catch (error) {
      console.error('Save to DB error:', error);
    }
  }

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

  async alarm() {
    const now = Date.now();
    const STALE_TIMEOUT = 5 * 60 * 1000;
    
    for (const session of this.sessions) {
      if (now - session.lastActivity > STALE_TIMEOUT) {
        try {
          session.webSocket.close(1000, 'Timeout');
        } catch (e) {}
        this.sessions.delete(session);
      }
    }

    if (this.content.trim() && this.sessions.size > 0) {
      await this.saveToDatabase();
    }

    if (this.sessions.size > 0) {
      await this.state.storage.setAlarm(Date.now() + 60000);
    }
  }
}
import { EditorDurableObject } from './durable-object';
import { generateShortId, createToken, verifyToken, getCookie, hashPassword, verifyPassword } from './utils';
import editorHTML from './editor.html';

export { EditorDurableObject };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    env.IS_DEV = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (path === '/') {
        const editorId = url.searchParams.get('id');
        if (!editorId) {
          const newId = generateShortId();
          return Response.redirect(`${url.origin}?id=${newId}`, 302);
        }

        return new Response(editorHTML, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            ...corsHeaders,
            'Cache-Control': 'public, max-age=3600'
          }
        });
      }

      // Authentication endpoint
      if (path === '/auth/verify' && request.method === 'POST') {
        const { username, password } = await request.json();
        
        if (!username || !password) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Username and password required' 
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const user = await verifyCredentials(env.DB, username, password);
        console.log("Authenticated user:", user);
        
        if (user) {
          const token = await createToken(env.AUTH_SECRET, username, 7);
          const headers = new Headers({
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            ...corsHeaders
          });

          const maxAge = 7 * 24 * 60 * 60;

          let cookie = `auth=${token}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax`;
          if (!env.IS_DEV) {
            cookie += '; Secure';
          }

          headers.append('Set-Cookie', cookie);

          return new Response(JSON.stringify({
            success: true
          }), {
            status: 200,
            headers
          });
        } else {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Invalid credentials' 
          }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      }

      if (path === '/auth/status' && request.method === 'GET') {
        const token = getCookie(request, 'auth');
        const payload = token ? await verifyToken(env.AUTH_SECRET, token) : null;

        if (!payload) {
          return new Response(JSON.stringify({
            loggedIn: false
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        return new Response(JSON.stringify({
          loggedIn: true,
          username: payload.u
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      
      // WebSocket connection
      if (path.startsWith('/ws/')) {
        const parts = path.split('/ws/')[1].split('/');
        const editorId = parts[0];
        
        if (!editorId) {
          return new Response('Editor ID required', { status: 400 });
        }
        
        let username = 'pub';

        if(editorId.startsWith("_")) {
          const token = getCookie(request, 'auth');
          const payload = await verifyToken(env.AUTH_SECRET, token);
          if (!payload) {
            return new Response('Unauthorized', { status: 401 });
          }
          username = payload.u;
        }

        
        const id = env.EDITOR.idFromName(`${username}:${editorId}`);
        const stub = env.EDITOR.get(id);

        const stubHeaders = new Headers(request.headers);
        stubHeaders.set('x-username', username);
        stubHeaders.set('x-editor-id', editorId);
        const wsRequest = new Request(request, { headers: stubHeaders });
        return stub.fetch(wsRequest);
      }

      // Save editor content
      if (path.startsWith('/editor/save/') && request.method === 'POST') {
        const parts = path.split('/editor/save/')[1].split('/');
        const editorId = parts[0];
        
        if (!editorId) {
          return new Response('Username and Editor ID required', { status: 400 });
        }
        
        let username = 'pub';

        if(editorId.startsWith("_")) {
          const token = getCookie(request, 'auth');
          const payload = await verifyToken(env.AUTH_SECRET, token);
          if (!payload) {
            return new Response('Unauthorized', { status: 401 });
          }
          username = payload.u;
        }

        // Get Durable Object stub
        const id = env.EDITOR.idFromName(`${username}:${editorId}`);
        const stub = env.EDITOR.get(id);
        
        // Request save from Durable Object
        const saveRequest = new Request(`${url.origin}/save`, {
          method: 'POST'
        });
        saveRequest.headers.set('x-username', username);
        saveRequest.headers.set('x-editor-id', editorId);
        
        await stub.fetch(saveRequest);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Delete editor
      if (path.startsWith('/editor/delete/') && request.method === 'DELETE') {
        const parts = path.split('/editor/delete/')[1].split('/');
        const editorId = parts[0];
        
        if (!editorId) {
          return new Response('Username and Editor ID required', { status: 400 });
        }

        let username = 'pub';

        if(editorId.startsWith("_")) {
          const token = getCookie(request, 'auth');
          const payload = await verifyToken(env.AUTH_SECRET, token);
          if (!payload) {
            return new Response('Unauthorized', { status: 401 });
          }
          username = payload.u;
        }
        
        // Delete from DB
        await deleteFromDB(env.DB, username, editorId);
        
        // Delete from KV cache
        if (env.REALTIME_EDITOR_CACHE) {
          await env.REALTIME_EDITOR_CACHE.delete(`editor:${username}:${editorId}`);
        }

        // Reset Durable Object state
        const id = env.EDITOR.idFromName(`${username}:${editorId}`);
        const stub = env.EDITOR.get(id);
        const delReq = new Request(`${url.origin}/reset`, { method: 'POST' });
        delReq.headers.set('x-username', username);
        delReq.headers.set('x-editor-id', editorId);
        await stub.fetch(delReq);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      if (path === '/admin/users/create' && request.method === 'POST') {
        const adminKey = request.headers.get('X-Admin-Key');
        if (adminKey !== env.ADMIN_KEY) {
          return new Response('Unauthorized', { status: 401 });
        }

        const { username, password } = await request.json();
        if (!username || !password) {
          return new Response(JSON.stringify({ 
            success: false,
            error: 'Username and password required'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const passwordHash = await hashPassword(password);

        await env.DB.prepare(
          `INSERT INTO users (username, password_hash, created_at)
          VALUES (?, ?, ?)
          ON CONFLICT(username) DO UPDATE SET 
          password_hash = excluded.password_hash`
        ).bind(username, passwordHash, Date.now()).run();
        
        return new Response(JSON.stringify({ 
          success: true,
          username 
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response('Not Found', { status: 404 });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ 
        error: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }
};

// Verify user credentials
async function verifyCredentials(db, username, password) {
  try {
    const result = await db.prepare(
      'SELECT username, password_hash FROM users WHERE username = ?'
    ).bind(username).first();
    
    if (!result) return null;
    
    const isValid = await verifyPassword(password, result.password_hash);
    
    if (isValid) {
      return { username: result.username };
    }
    
    return null;
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

async function deleteFromDB(db, username, editorId) {
  try {
    await db.prepare(
      'DELETE FROM editors WHERE username = ? AND id = ?'
    ).bind(username, editorId).run();
  } catch (error) {
    console.error('Delete error:', error);
  }
}
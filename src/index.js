import { EditorDurableObject } from './durable-object';
import { generateShortId } from './utils';
import editorHTML from './editor.html';

export { EditorDurableObject };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (path === '/') {
        return Response.redirect(`${url.origin}/editor`, 302);
      }

      if (path === '/editor') {
        const editorId = url.searchParams.get('id');
        if (!editorId) {
          const newId = generateShortId();
          return Response.redirect(`${url.origin}/editor?id=${newId}`, 302);
        }
        return new Response(editorHTML, {
          headers: { 'Content-Type': 'text/html', ...corsHeaders }
        });
      }
      
      if (path.startsWith('/ws/')) {
        const editorId = path.split('/ws/')[1];
        if (!editorId) {
          return new Response('Editor ID required', { status: 400 });
        }

        // Get Durable Object stub
        const id = env.EDITOR.idFromName(editorId);
        const stub = env.EDITOR.get(id);
        
        return stub.fetch(request);
      }

      // Load editor content
      if (path.startsWith('/editor/load/')) {
        const editorId = path.split('/editor/load/')[1];
        const content = await loadFromDB(env.DB, editorId);
        return new Response(JSON.stringify({ 
          success: true, 
          content: content || '' 
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Save editor content
      if (path.startsWith('/editor/save/') && request.method === 'POST') {
        const editorId = path.split('/editor/save/')[1];
        
        // Get content from Durable Object
        const id = env.EDITOR.idFromName(editorId);
        const stub = env.EDITOR.get(id);
        
        // Request save from Durable Object
        const saveRequest = new Request(`${url.origin}/save`, {
          method: 'POST'
        });
        
        await stub.fetch(saveRequest);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Delete editor
      if (path.startsWith('/editor/delete/') && request.method === 'DELETE') {
        const editorId = path.split('/editor/delete/')[1];
        
        // Delete from DB
        await deleteFromDB(env.DB, editorId);
        
        // Delete from KV cache
        await env.REALTIME_EDITOR_CACHE.delete(`editor:${editorId}`);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
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

// Database operations
async function loadFromDB(db, editorId) {
  try {
    const result = await db.prepare(
      'SELECT content FROM editors WHERE id = ?'
    ).bind(editorId).first();
    
    if (!result) return null;
    
    // Decrypt and decompress if needed
    return decrypt(decompress(result.content));
  } catch (error) {
    console.error('Load error:', error);
    return null;
  }
}

async function deleteFromDB(db, editorId) {
  try {
    await db.prepare(
      'DELETE FROM editors WHERE id = ?'
    ).bind(editorId).run();
  } catch (error) {
    console.error('Delete error:', error);
  }
}

// Compression/Decompression using pako alternative
function compress(data) {
  // use CompressionStream API if wanted, here is a simple base64
  return btoa(unescape(encodeURIComponent(data)));
}

function decompress(data) {
  try {
    return decodeURIComponent(escape(atob(data)));
  } catch (e) {
    return data;
  }
}

function encrypt(text, key) {
  if (!key) return text;
  // Use Web Crypto API for encryption in production
  return text;
}

function decrypt(text, key) {
  if (!key) return text;
  return text;
}
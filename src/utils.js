// Generate short ID (replacement for shortid package)
export function generateShortId() {
  const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const length = 9;
  let result = '';
  
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  
  for (let i = 0; i < length; i++) {
    result += characters[randomValues[i] % characters.length];
  }
  
  return result;
}

export async function hashPassword(password) {
  const encoder = new TextEncoder();

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    baseKey,
    256 // 32 bytes
  );

  const hash = new Uint8Array(derivedBits);

  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...hash));

  return `${saltB64}:${hashB64}`;
}

export async function verifyPassword(password, stored) {
  const encoder = new TextEncoder();

  const [saltB64, hashB64] = stored.split(":");
  if (!saltB64 || !hashB64) return false;

  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const storedHash = Uint8Array.from(atob(hashB64), c => c.charCodeAt(0));

  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    baseKey,
    256
  );

  const derivedHash = new Uint8Array(derivedBits);

  // Timing-safe comparison
  if (derivedHash.length !== storedHash.length) return false;

  let diff = 0;
  for (let i = 0; i < derivedHash.length; i++) {
    diff |= derivedHash[i] ^ storedHash[i];
  }
  return diff === 0;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  let base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function hmacSign(secret, data) {
  const key = await importHmacKey(secret);
  const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return toBase64Url(new Uint8Array(sigBuf));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function createToken(secret, username, days = 7) {
  const exp = Date.now() + days * 24 * 60 * 60 * 1000; // ms
  const payloadObj = { u: username, exp };
  const payloadJson = JSON.stringify(payloadObj);
  const payloadBase = toBase64Url(encoder.encode(payloadJson));

  const sig = await hmacSign(secret, payloadBase);

  return `${payloadBase}.${sig}`;
}

export async function verifyToken(secret, token) {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadBase, sig] = parts;

  // Recompute signature
  const expectedSig = await hmacSign(secret, payloadBase);
  if (!timingSafeEqual(sig, expectedSig)) return null;

  // Decode payload
  let payload;
  try {
    const payloadBytes = fromBase64Url(payloadBase);
    const payloadJson = decoder.decode(payloadBytes);
    payload = JSON.parse(payloadJson);
  } catch {
    return null;
  }

  if (!payload.u || !payload.exp) return null;
  if (payload.exp < Date.now()) return null;

  return payload;
}

export function getCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = cookieHeader.split(/;\s*/);
  for (const c of cookies) {
    if (!c) continue;
    const [k, ...vParts] = c.split('=');
    if (k === name) return vParts.join('=');
  }
  return null;
}

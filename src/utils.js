// Utility functions

// Generate short ID (replacement for shortid package)
export function generateShortId() {
  const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';
  const length = 9;
  let result = '';
  
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  
  for (let i = 0; i < length; i++) {
    result += characters[randomValues[i] % characters.length];
  }
  
  return result;
}

// Encrypt text using Web Crypto API
export async function encrypt(text, keyString) {
  if (!keyString) return text;
  
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    
    // Import key
    const keyData = encoder.encode(keyString);
    const key = await crypto.subtle.importKey(
      'raw',
      await crypto.subtle.digest('SHA-256', keyData),
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    // Generate IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    // Convert to base64
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption error:', error);
    return text;
  }
}

// Decrypt text using Web Crypto API
export async function decrypt(encryptedText, keyString) {
  if (!keyString) return encryptedText;
  
  try {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    // Import key
    const keyData = encoder.encode(keyString);
    const key = await crypto.subtle.importKey(
      'raw',
      await crypto.subtle.digest('SHA-256', keyData),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    // Decode base64
    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    return encryptedText;
  }
}
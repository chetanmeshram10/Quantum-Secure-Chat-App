// lib/encryption.js - Hybrid Kyber1024 KEM + AES-256-GCM Encryption

/**
 * Derives a session key from Kyber shared secret using HKDF
 * @param {Uint8Array} sharedSecret - Kyber shared secret
 * @param {string} context - Context info (e.g., "alice-to-bob")
 * @returns {Promise<CryptoKey>} - AES-256-GCM key
 */
async function deriveSessionKey(sharedSecret, context = 'quantum-chat') {
  try {
    // Import shared secret as key material
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      sharedSecret,
      { name: 'HKDF' },
      false,
      ['deriveKey']
    );

    // Derive AES-256-GCM key using HKDF
    const sessionKey = await window.crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new TextEncoder().encode('quantum-chat-salt'),
        info: new TextEncoder().encode(context)
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    return sessionKey;
  } catch (error) {
    console.error('Session key derivation failed:', error);
    throw new Error('Failed to derive session key');
  }
}

/**
 * Encrypts a message using AES-256-GCM with session key
 * @param {string} message - Plain text message
 * @param {CryptoKey} sessionKey - AES-256-GCM session key
 * @returns {Promise<{ciphertext: string, iv: string}>} - Encrypted data
 */
export async function encryptMessage(message, sessionKey) {
  try {
    // Generate random IV (12 bytes for GCM)
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Convert message to array buffer
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    
    // Encrypt using AES-GCM
    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      sessionKey,
      data
    );

    return {
      ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
      iv: btoa(String.fromCharCode(...iv))
    };
  } catch (error) {
    console.error('Message encryption failed:', error);
    throw new Error('Failed to encrypt message');
  }
}

/**
 * Decrypts a message using AES-256-GCM with session key
 * @param {string} ciphertext - Encrypted message (base64)
 * @param {string} ivBase64 - IV (base64)
 * @param {CryptoKey} sessionKey - AES-256-GCM session key
 * @returns {Promise<string>} - Decrypted plain text
 */
export async function decryptMessage(ciphertext, ivBase64, sessionKey) {
  try {
    // Decode base64
    const encryptedData = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
    
    // Decrypt using AES-GCM
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      sessionKey,
      encryptedData
    );

    // Convert to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Message decryption failed:', error);
    throw new Error('Failed to decrypt message - Invalid session key');
  }
}

/**
 * Encrypts file data using AES-256-GCM with session key
 * @param {ArrayBuffer} fileData - File data
 * @param {CryptoKey} sessionKey - AES-256-GCM session key
 * @returns {Promise<{encryptedFile: string, iv: string}>}
 */
export async function encryptFile(fileData, sessionKey) {
  try {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      sessionKey,
      fileData
    );

    // Convert to base64 without call stack issues
    const encryptedArray = new Uint8Array(encrypted);
    let binaryString = '';
    
    // Process in small chunks
    for (let i = 0; i < encryptedArray.length; i++) {
      binaryString += String.fromCharCode(encryptedArray[i]);
    }

    // Convert IV to base64
    let ivBinaryString = '';
    for (let i = 0; i < iv.length; i++) {
      ivBinaryString += String.fromCharCode(iv[i]);
    }

    return {
      encryptedFile: btoa(binaryString),
      iv: btoa(ivBinaryString)
    };
  } catch (error) {
    console.error('File encryption failed:', error);
    throw new Error('Failed to encrypt file');
  }
}

/**
 * Decrypts file data using AES-256-GCM with session key
 * @param {string} encryptedData - Encrypted file (base64)
 * @param {string} ivBase64 - IV (base64)
 * @param {CryptoKey} sessionKey - AES-256-GCM session key
 * @returns {Promise<ArrayBuffer>} - Decrypted file data
 */
export async function decryptFile(encryptedData, ivBase64, sessionKey) {
  try {
    // Decode base64 in chunks to avoid stack overflow
    const binaryString = atob(encryptedData);
    const encryptedFileData = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      encryptedFileData[i] = binaryString.charCodeAt(i);
    }
    
    const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
    
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      sessionKey,
      encryptedFileData
    );

    return decrypted;
  } catch (error) {
    console.error('File decryption failed:', error);
    throw new Error('Failed to decrypt file');
  }
}

/**
 * Creates a session key from Kyber shared secret
 * @param {Uint8Array} sharedSecret - Kyber KEM shared secret
 * @param {string} sender - Sender username
 * @param {string} receiver - Receiver username
 * @returns {Promise<CryptoKey>} - Session key for this conversation
 */
export async function createSessionKey(sharedSecret, sender, receiver) {
  // Create deterministic context from both usernames (sorted)
  const context = [sender, receiver].sort().join('-');
  return await deriveSessionKey(sharedSecret, context);
}

/**
 * Validates if a private key is valid Kyber key
 * @param {string} privateKeyBase64 - Base64 encoded private key
 * @returns {boolean} - True if valid
 */
export function validatePrivateKey(privateKeyBase64) {
  try {
    const decoded = atob(privateKeyBase64);
    // Kyber1024 private key should be around 3168 bytes
    return decoded.length > 3000 && decoded.length < 3300;
  } catch (error) {
    return false;
  }
}
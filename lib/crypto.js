// Simplified Kyber-1024 implementation for educational purposes
// In production, use a thoroughly audited library

class PQCrypto {
  constructor() {
    this.algorithm = 'KYBER1024';
  }

  // Generate Kyber keypair (simplified - in production use actual Kyber)
  async generateKeyPair() {
    // Using X25519 as a placeholder for demonstration
    // In production, replace with actual Kyber1024 implementation
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "ECDH",
        namedCurve: "P-521" // Closest approximation, use Kyber in production
      },
      true,
      ["deriveKey", "deriveBits"]
    );

    const publicKey = await crypto.subtle.exportKey("spki", keyPair.publicKey);
    const privateKey = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

    return {
      publicKey: this.arrayBufferToBase64(publicKey),
      privateKey: this.arrayBufferToBase64(privateKey)
    };
  }

  // Generate random AES session key
  async generateSessionKey() {
    const key = await crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: 256
      },
      true,
      ["encrypt", "decrypt"]
    );
    
    return key;
  }

  // Encrypt message with AES-256-GCM
  async encryptMessage(plaintext, sessionKey) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
    
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
        tagLength: 128 // 128-bit authentication tag
      },
      sessionKey,
      data
    );

    return {
      ciphertext: this.arrayBufferToBase64(encryptedData),
      iv: this.arrayBufferToBase64(iv)
    };
  }

  // Decrypt message with AES-256-GCM
  async decryptMessage(ciphertext, iv, sessionKey) {
    const encryptedData = this.base64ToArrayBuffer(ciphertext);
    const ivArray = this.base64ToArrayBuffer(iv);

    try {
      const decryptedData = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: ivArray,
          tagLength: 128
        },
        sessionKey,
        encryptedData
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedData);
    } catch (error) {
      throw new Error('Decryption failed - message may be tampered');
    }
  }

  // Encapsulate session key with receiver's public key (KEM)
  async encapsulateKey(sessionKey, receiverPublicKeyB64) {
    // Export session key
    const sessionKeyRaw = await crypto.subtle.exportKey("raw", sessionKey);
    
    // Import receiver's public key
    const publicKeyBuffer = this.base64ToArrayBuffer(receiverPublicKeyB64);
    const receiverPublicKey = await crypto.subtle.importKey(
      "spki",
      publicKeyBuffer,
      {
        name: "ECDH",
        namedCurve: "P-521"
      },
      true,
      []
    );

    // Generate ephemeral keypair for ECDH
    const ephemeralKeyPair = await crypto.subtle.generateKey(
      {
        name: "ECDH",
        namedCurve: "P-521"
      },
      true,
      ["deriveKey", "deriveBits"]
    );

    // Derive shared secret
    const sharedSecret = await crypto.subtle.deriveKey(
      {
        name: "ECDH",
        public: receiverPublicKey
      },
      ephemeralKeyPair.privateKey,
      {
        name: "AES-GCM",
        length: 256
      },
      true,
      ["wrapKey", "unwrapKey"]
    );

    // Wrap session key with shared secret
    const wrappedKey = await crypto.subtle.wrapKey(
      "raw",
      sessionKey,
      sharedSecret,
      {
        name: "AES-GCM",
        iv: crypto.getRandomValues(new Uint8Array(12)),
        tagLength: 128
      }
    );

    // Export ephemeral public key
    const ephemeralPublicKey = await crypto.subtle.exportKey("spki", ephemeralKeyPair.publicKey);

    return {
      encapsulatedKey: this.arrayBufferToBase64(wrappedKey),
      ephemeralPublicKey: this.arrayBufferToBase64(ephemeralPublicKey)
    };
  }

  // Decapsulate session key with receiver's private key
  async decapsulateKey(encapsulatedKeyB64, ephemeralPublicKeyB64, receiverPrivateKeyB64) {
    const encapsulatedKey = this.base64ToArrayBuffer(encapsulatedKeyB64);
    const ephemeralPublicKeyBuffer = this.base64ToArrayBuffer(ephemeralPublicKeyB64);
    const receiverPrivateKeyBuffer = this.base64ToArrayBuffer(receiverPrivateKeyB64);

    // Import receiver's private key
    const receiverPrivateKey = await crypto.subtle.importKey(
      "pkcs8",
      receiverPrivateKeyBuffer,
      {
        name: "ECDH",
        namedCurve: "P-521"
      },
      true,
      ["deriveKey", "deriveBits"]
    );

    // Import ephemeral public key
    const ephemeralPublicKey = await crypto.subtle.importKey(
      "spki",
      ephemeralPublicKeyBuffer,
      {
        name: "ECDH",
        namedCurve: "P-521"
      },
      true,
      []
    );

    // Derive shared secret
    const sharedSecret = await crypto.subtle.deriveKey(
      {
        name: "ECDH",
        public: ephemeralPublicKey
      },
      receiverPrivateKey,
      {
        name: "AES-GCM",
        length: 256
      },
      true,
      ["wrapKey", "unwrapKey"]
    );

    // Unwrap session key
    const sessionKey = await crypto.subtle.unwrapKey(
      "raw",
      encapsulatedKey,
      sharedSecret,
      {
        name: "AES-GCM",
        iv: crypto.getRandomValues(new Uint8Array(12)),
        tagLength: 128
      },
      {
        name: "AES-GCM",
        length: 256
      },
      true,
      ["encrypt", "decrypt"]
    );

    return sessionKey;
  }

  // Helper: ArrayBuffer to Base64
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Helper: Base64 to ArrayBuffer
  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Secure key storage in browser (IndexedDB)
  async storePrivateKey(username, privateKey) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ChatAppKeys', 1);

      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['keys'], 'readwrite');
        const store = transaction.objectStore('keys');
        
        // Store with timestamp for key rotation
        const keyData = {
          username,
          privateKey,
          timestamp: Date.now()
        };
        
        const putRequest = store.put(keyData);
        
        putRequest.onsuccess = () => resolve(true);
        putRequest.onerror = () => reject(putRequest.error);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('keys')) {
          const store = db.createObjectStore('keys', { keyPath: 'username' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  // Retrieve private key from secure storage
  async retrievePrivateKey(username) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ChatAppKeys', 1);

      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['keys'], 'readonly');
        const store = transaction.objectStore('keys');
        
        const getRequest = store.get(username);
        
        getRequest.onsuccess = () => {
          if (getRequest.result) {
            resolve(getRequest.result.privateKey);
          } else {
            reject(new Error('Private key not found'));
          }
        };
        
        getRequest.onerror = () => reject(getRequest.error);
      };
    });
  }

  // Clear private key (on logout for security)
  async clearPrivateKey(username) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ChatAppKeys', 1);

      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['keys'], 'readwrite');
        const store = transaction.objectStore('keys');
        
        const deleteRequest = store.delete(username);
        
        deleteRequest.onsuccess = () => resolve(true);
        deleteRequest.onerror = () => reject(deleteRequest.error);
      };
    });
  }
}

export default new PQCrypto();
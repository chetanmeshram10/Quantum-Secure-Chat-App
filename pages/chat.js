import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import io from 'socket.io-client';
import styles from '../styles/Chat.module.css';
import Toast from '../components/Toast';
import EmojiPicker from '../components/EmojiPicker';
import FileUpload from '../components/FileUpload';
import { 
  encapsulateSecret, 
  decapsulateSecret 
} from '../lib/pqcrypto';
import {
  encryptMessage,
  decryptMessage,
  encryptFile,
  decryptFile,
  createSessionKey
} from '../lib/encryption';

let socket;

export default function Chat() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  const [encryptionStatus, setEncryptionStatus] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [privateKey, setPrivateKey] = useState(null);
  const [publicKey, setPublicKey] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check for keys on mount
  useEffect(() => {
    const privKey = sessionStorage.getItem('private_key');
    const pubKey = sessionStorage.getItem('public_key');
    const username = sessionStorage.getItem('username');
    
    if (!privKey || !pubKey || !username) {
      showToast('⚠️ Keys not found! Redirecting to login...', 'error');
      setTimeout(() => router.replace('/'), 2000);
      return;
    }
    
    setPrivateKey(privKey);
    setPublicKey(pubKey);
  }, [router]);

  // Authentication check
  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          credentials: 'include'
        });
        
        if (!res.ok) {
          if (isMounted) {
            router.replace('/');
          }
          return;
        }
        
        const userData = await res.json();
        
        if (isMounted) {
          setUser(userData);
          setAuthChecked(true);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        if (isMounted) {
          router.replace('/');
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [router]);

  // Initialize app after authentication
  useEffect(() => {
    if (!user || !authChecked || !privateKey) return;

    const initializeApp = async () => {
      try {
        // Load users
        const usersRes = await fetch('/api/users');
        const usersData = await usersRes.json();
        setUsers(usersData.filter(u => u.username !== user.username));

        setLoading(false);
      } catch (error) {
        console.error('Initialization error:', error);
        showToast('Failed to initialize app', 'error');
      }
    };

    initializeApp();
  }, [user, authChecked, privateKey]);

  // Socket initialization
  useEffect(() => {
    if (!user || loading || !privateKey) return;

    const initSocket = async () => {
      await fetch('/api/socket');
      socket = io();

      socket.on('connect', () => {
        console.log('Socket connected');
        socket.emit('register', user.username);
      });

      socket.on('onlineUsers', (usersList) => {
        console.log('Online users:', usersList);
        setOnlineUsers(usersList);
      });

      socket.on('receiveMessage', async (encryptedData) => {
        try {
          const decryptedMsg = await decryptIncomingMessage(encryptedData);
          
          if (
            (decryptedMsg.from === selectedUser?.username && decryptedMsg.to === user.username) ||
            (decryptedMsg.from === user.username && decryptedMsg.to === selectedUser?.username)
          ) {
            setMessages(prev => [...prev, decryptedMsg]);
          }
          
          showToast(`💬 New message from ${decryptedMsg.from}`, 'info');
        } catch (error) {
          console.error('Failed to decrypt incoming message:', error);
          showToast('⚠️ Failed to decrypt message', 'error');
        }
      });

      socket.on('receiveFile', async (fileData) => {
        try {
          const decryptedFile = await decryptIncomingFile(fileData);
          
          if (
            (decryptedFile.from === selectedUser?.username && decryptedFile.to === user.username) ||
            (decryptedFile.from === user.username && decryptedFile.to === selectedUser?.username)
          ) {
            setMessages(prev => [...prev, decryptedFile]);
          }
          
          showToast(`📎 File from ${decryptedFile.from}`, 'info');
        } catch (error) {
          console.error('Failed to decrypt file:', error);
          showToast('⚠️ Failed to decrypt file', 'error');
        }
      });
    };

    initSocket();

    return () => {
      if (socket) {
        console.log('Disconnecting socket');
        socket.disconnect();
      }
    };
  }, [user, loading, selectedUser, privateKey]);

  const decryptIncomingMessage = async (encryptedData) => {
    try {
      setEncryptionStatus('🔓 Decrypting...');
      
      // Convert private key from base64
      const privKeyBytes = Uint8Array.from(atob(privateKey), c => c.charCodeAt(0));
      
      // Decapsulate the shared secret using receiver's private key
      const encapsulatedKey = Uint8Array.from(atob(encryptedData.encapsulatedKey), c => c.charCodeAt(0));
      const sharedSecret = await decapsulateSecret(privKeyBytes, encapsulatedKey);

      // Create session key from shared secret
      const sessionKey = await createSessionKey(sharedSecret, encryptedData.from, encryptedData.to);

      // Decrypt the message
      const plaintext = await decryptMessage(
        encryptedData.ciphertext, 
        encryptedData.iv, 
        sessionKey
      );

      setEncryptionStatus('');
      
      return {
        from: encryptedData.from,
        to: encryptedData.to,
        content: plaintext,
        timestamp: encryptedData.timestamp,
        type: 'text'
      };
    } catch (error) {
      setEncryptionStatus('');
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt message');
    }
  };

  const decryptIncomingFile = async (fileData) => {
    try {
      // Convert private key from base64
      const privKeyBytes = Uint8Array.from(atob(privateKey), c => c.charCodeAt(0));
      
      // Decapsulate shared secret
      const encapsulatedKey = Uint8Array.from(atob(fileData.encapsulatedKey), c => c.charCodeAt(0));
      const sharedSecret = await decapsulateSecret(privKeyBytes, encapsulatedKey);

      // Create session key
      const sessionKey = await createSessionKey(sharedSecret, fileData.from, fileData.to);

      // Decrypt file
      const decryptedData = await decryptFile(
        fileData.encryptedFile,
        fileData.iv,
        sessionKey
      );

      return {
        from: fileData.from,
        to: fileData.to,
        type: 'file',
        fileName: fileData.fileName,
        fileData: btoa(String.fromCharCode(...new Uint8Array(decryptedData))),
        fileType: fileData.fileType,
        timestamp: fileData.timestamp
      };
    } catch (error) {
      console.error('File decryption error:', error);
      throw new Error('Failed to decrypt file');
    }
  };

  useEffect(() => {
    if (selectedUser && user && privateKey) {
      loadMessages(selectedUser.username);
    }
  }, [selectedUser, user, privateKey]);

  const loadMessages = async (otherUser) => {
    try {
      const res = await fetch(`/api/messages?user1=${user.username}&user2=${otherUser}`);
      const encryptedMessages = await res.json();

      const decryptedMessages = [];
      for (const encMsg of encryptedMessages) {
        try {
          if (encMsg.type === 'file') {
            const decrypted = await decryptIncomingFile(encMsg);
            decryptedMessages.push(decrypted);
          } else {
            const decrypted = await decryptIncomingMessage(encMsg);
            decryptedMessages.push(decrypted);
          }
        } catch (error) {
          console.error('Failed to decrypt message:', error);
          // Add placeholder for failed decryption
          decryptedMessages.push({
            from: encMsg.from,
            to: encMsg.to,
            content: '🔒 [Failed to decrypt - Invalid key]',
            timestamp: encMsg.timestamp,
            type: 'text',
            decryptionFailed: true
          });
        }
      }

      setMessages(decryptedMessages);
    } catch (error) {
      console.error('Failed to load messages:', error);
      showToast('Failed to load messages', 'error');
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser || !privateKey) return;

    const messageToSend = newMessage;
    setNewMessage('');

    try {
      setEncryptionStatus('🔒 Encrypting...');
      
      // Get receiver's public key from server
      const res = await fetch(`/api/users/public-key?username=${selectedUser.username}`);
      const { publicKey: receiverPublicKeyBase64 } = await res.json();
      const receiverPublicKey = Uint8Array.from(atob(receiverPublicKeyBase64), c => c.charCodeAt(0));

      // Use Kyber KEM to create shared secret
      const { sharedSecret, ciphertext: encapsulatedKey } = await encapsulateSecret(receiverPublicKey);

      // Create session key from shared secret
      const sessionKey = await createSessionKey(sharedSecret, user.username, selectedUser.username);

      // Encrypt message with AES-256-GCM using session key
      const { ciphertext, iv } = await encryptMessage(messageToSend, sessionKey);

      const encryptedPayload = {
        from: user.username,
        to: selectedUser.username,
        encapsulatedKey: btoa(String.fromCharCode(...encapsulatedKey)),
        ciphertext: ciphertext,
        iv: iv,
        timestamp: new Date().toISOString(),
        type: 'text'
      };

      await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(encryptedPayload)
      });

      socket.emit('sendMessage', encryptedPayload);

      setMessages(prev => [...prev, {
        from: user.username,
        to: selectedUser.username,
        content: messageToSend,
        timestamp: encryptedPayload.timestamp,
        type: 'text'
      }]);

      setEncryptionStatus('✅ Sent securely');
      setTimeout(() => setEncryptionStatus(''), 2000);
    } catch (error) {
      console.error('Failed to send message:', error);
      showToast('Failed to send message', 'error');
      setEncryptionStatus('');
      setNewMessage(messageToSend);
    }
  };

  const handleFileSelect = async (file) => {
    if (!selectedUser || !privateKey) {
      showToast('Please select a user first', 'warning');
      return;
    }

    setUploadingFile(true);
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const arrayBuffer = e.target.result;
        
        // Get receiver's public key
        const res = await fetch(`/api/users/public-key?username=${selectedUser.username}`);
        const { publicKey: receiverPublicKeyBase64 } = await res.json();
        const receiverPublicKey = Uint8Array.from(atob(receiverPublicKeyBase64), c => c.charCodeAt(0));

        // Use Kyber KEM to create shared secret
        const { sharedSecret, ciphertext: encapsulatedKey } = await encapsulateSecret(receiverPublicKey);

        // Create session key
        const sessionKey = await createSessionKey(sharedSecret, user.username, selectedUser.username);

        // Encrypt file with AES-256-GCM
        const { encryptedFile, iv } = await encryptFile(arrayBuffer, sessionKey);

        const filePayload = {
          from: user.username,
          to: selectedUser.username,
          encapsulatedKey: btoa(String.fromCharCode(...encapsulatedKey)),
          encryptedFile: encryptedFile,
          iv: iv,
          fileName: file.name,
          fileType: file.type,
          timestamp: new Date().toISOString(),
          type: 'file'
        };

        await fetch('/api/send-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(filePayload)
        });

        socket.emit('sendFile', filePayload);

        // Store decrypted version locally
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        setMessages(prev => [...prev, {
          from: user.username,
          to: selectedUser.username,
          type: 'file',
          fileName: file.name,
          fileData: base64Data,
          fileType: file.type,
          timestamp: filePayload.timestamp
        }]);

        showToast('📎 File sent securely', 'success');
        setUploadingFile(false);
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Failed to send file:', error);
      showToast('Failed to send file', 'error');
      setUploadingFile(false);
    }
  };

  const handleEmojiSelect = (emoji) => {
    setNewMessage(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const handleLogout = async () => {
    // Clear keys from session
    sessionStorage.removeItem('private_key');
    sessionStorage.removeItem('public_key');
    sessionStorage.removeItem('username');
    
    await fetch('/api/auth/logout', { 
      method: 'POST',
      credentials: 'include'
    });
    window.location.href = '/';
  };

  const showToast = (message, type) => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  const downloadFile = (fileName, fileData, fileType) => {
    const blob = new Blob([Uint8Array.from(atob(fileData), c => c.charCodeAt(0))], { type: fileType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (!authChecked || loading || !privateKey) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p style={{fontSize: '1.125rem', fontWeight: 600, marginTop: '1rem'}}>
          🔐 Initializing quantum-safe encryption...
        </p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className={styles.container}>
      <Toast show={toast.show} message={toast.message} type={toast.type} />

      {/* Sidebar */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.userInfo}>
            <div className={styles.avatar} style={{background: 'linear-gradient(135deg, #9333ea, #ec4899)'}}>
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div>
              <h3 style={{fontWeight: 700, fontSize: '1.125rem', margin: 0}}>{user?.username}</h3>
              <span className={styles.encryptionBadge}>
                <svg width="12" height="12" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                Kyber1024 Active
              </span>
            </div>
          </div>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>

        <div className={styles.usersList}>
          <h4 style={{padding: '0 1.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem'}}>
            Contacts ({onlineUsers.length} online)
          </h4>
          {users.map((u, idx) => {
            const isOnline = onlineUsers.includes(u.username);
            return (
              <div
                key={u.username}
                className={`${styles.userItem} ${selectedUser?.username === u.username ? styles.active : ''}`}
                onClick={() => setSelectedUser(u)}
              >
                <div className={styles.avatar} style={{background: `linear-gradient(135deg, ${['#9333ea', '#ec4899', '#3b82f6', '#10b981'][idx % 4]}, ${['#ec4899', '#db2777', '#2563eb', '#059669'][idx % 4]})`}}>
                  {u.username[0].toUpperCase()}
                </div>
                <div className={styles.userDetails}>
                  <span className={styles.username}>{u.username}</span>
                  <span className={styles.status} style={{color: isOnline ? '#10b981' : '#94a3b8'}}>
                    <span style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      background: isOnline ? '#10b981' : '#94a3b8',
                      borderRadius: '50%',
                      marginRight: '6px',
                      animation: isOnline ? 'pulse 2s infinite' : 'none'
                    }}></span>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat Area */}
      <div className={styles.chatArea}>
        {selectedUser ? (
          <>
            <div className={styles.chatHeader}>
              <div className={styles.chatUserInfo}>
                <div className={styles.avatar} style={{background: 'linear-gradient(135deg, #9333ea, #ec4899)'}}>
                  {selectedUser.username[0].toUpperCase()}
                </div>
                <div>
                  <h3 style={{fontWeight: 700, fontSize: '1.125rem', margin: 0}}>{selectedUser.username}</h3>
                  <span className={styles.encryptionInfo}>
                    {onlineUsers.includes(selectedUser.username) ? '🟢 Online' : '⚫ Offline'} • 🔐 Kyber1024 + AES-256-GCM
                  </span>
                </div>
              </div>
              {encryptionStatus && (
                <span className={styles.encryptionStatus}>
                  {encryptionStatus}
                </span>
              )}
            </div>

            <div className={styles.messagesContainer}>
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`${styles.message} ${msg.from === user.username ? styles.sent : styles.received} ${msg.decryptionFailed ? styles.decryptionFailed : ''}`}
                >
                  <div className={styles.messageContent}>
                    {msg.type === 'file' ? (
                      <div className={styles.fileMessage}>
                        {msg.fileType?.startsWith('image/') ? (
                          <div className={styles.imagePreview}>
                            <img 
                              src={`data:${msg.fileType};base64,${msg.fileData}`}
                              alt={msg.fileName}
                              style={{
                                maxWidth: '300px',
                                maxHeight: '300px',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                objectFit: 'contain'
                              }}
                              onClick={() => {
                                const win = window.open();
                                win.document.write(`<img src="data:${msg.fileType};base64,${msg.fileData}" style="max-width:100%; max-height:100vh;" />`);
                              }}
                            />
                            <div className={styles.fileInfo}>
                              <strong>{msg.fileName}</strong>
                              <button 
                                onClick={() => downloadFile(msg.fileName, msg.fileData, msg.fileType)}
                                className={styles.downloadBtn}
                              >
                                📥 Download
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className={styles.fileIcon}>📎</div>
                            <div className={styles.fileInfo}>
                              <strong>{msg.fileName}</strong>
                              <small style={{fontSize: '12px', color: '#64748b'}}>
                                {msg.fileType || 'File'}
                              </small>
                              <button 
                                onClick={() => downloadFile(msg.fileName, msg.fileData, msg.fileType)}
                                className={styles.downloadBtn}
                              >
                                📥 Download
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <p style={msg.decryptionFailed ? {color: '#ef4444', fontStyle: 'italic'} : {}}>
                        {msg.content}
                      </p>
                    )}
                    <span className={styles.timestamp}>
                      {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className={styles.messageForm}>
              <FileUpload onFileSelect={handleFileSelect} />
              
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a secure message..."
                className={styles.messageInput}
                disabled={uploadingFile}
              />
              
              <button 
                type="button" 
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={styles.emojiBtn}
              >
                😀
              </button>

              <button 
                type="submit" 
                className={styles.sendBtn} 
                disabled={!newMessage.trim() || uploadingFile}
              >
                {uploadingFile ? (
                  <div className={styles.spinner} style={{width: '20px', height: '20px'}}></div>
                ) : (
                  <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </form>

            {showEmojiPicker && (
              <EmojiPicker 
                onEmojiSelect={handleEmojiSelect}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}
          </>
        ) : (
          <div className={styles.noChat}>
            <div className={styles.noChatIcon}>💬</div>
            <h2 style={{fontSize: '2rem', fontWeight: 700, marginBottom: '1rem', background: 'linear-gradient(135deg, #9333ea, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>
              Hybrid Post-Quantum Encryption
            </h2>
            <p style={{color: '#64748b', fontSize: '1.125rem', marginBottom: '2rem'}}>
              Select a contact to start an encrypted conversation
            </p>
            <div className={styles.securityInfo}>
              <div className={styles.securityItem}>
                <span>🔐</span>
                <div>
                  <h4>Kyber1024 KEM</h4>
                  <p>Quantum-resistant key exchange</p>
                </div>
              </div>
              <div className={styles.securityItem}>
                <span>🛡️</span>
                <div>
                  <h4>AES-256-GCM</h4>
                  <p>Session-based encryption</p>
                </div>
              </div>
              <div className={styles.securityItem}>
                <span>🔑</span>
                <div>
                  <h4>Your Own Keys</h4>
                  <p>No key sharing needed</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
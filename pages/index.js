import { useState } from 'react';
import { useRouter } from 'next/router';
import Toast from '../components/Toast';
import { generateKyberKeyPair } from '../lib/pqcrypto';
import { validatePrivateKey } from '../lib/encryption';

export default function Home() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  const [showKeyDownload, setShowKeyDownload] = useState(false);
  const [showKeyUpload, setShowKeyUpload] = useState(false);
  const [generatedKey, setGeneratedKey] = useState(null);
  const [uploadedKeyData, setUploadedKeyData] = useState(null);

  const showToast = (message, type) => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  const downloadSecretKey = (username, privateKey, publicKey) => {
    const keyData = `=== QUANTUM CHAT PRIVATE KEY ===
Username: ${username}
Generated: ${new Date().toLocaleString()}
⚠️ CRITICAL: NEVER SHARE YOUR PRIVATE KEY!

=== Private Key (Base64) ===
${privateKey}

=== Public Key (Base64) - Safe to Share ===
${publicKey}

=== Security Information ===
🔐 Algorithm: Kyber1024 (Post-Quantum KEM)
🛡️ Encryption: AES-256-GCM
🔑 Key Exchange: Hybrid KEM + HKDF

=== Instructions ===
1. 🔒 Keep your PRIVATE KEY secure - never share it!
2. 📤 Your PUBLIC KEY is stored on the server (safe to share)
3. 🔑 You need this PRIVATE KEY to decrypt messages sent to you
4. ⚠️ Without this key, you CANNOT read your messages
5. 💾 Store this file in a secure location (password manager, encrypted drive)

=== How It Works ===
- Each user has their own unique key pair
- Messages are encrypted using the recipient's PUBLIC key
- Only the recipient's PRIVATE key can decrypt them
- True end-to-end encryption - no key sharing needed!
`;

    const blob = new Blob([keyData], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${username}_private_key.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleKeyFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      
      // Extract username, private key, and public key
      const usernameMatch = text.match(/Username:\s*(.+)/);
      const privateKeyMatch = text.match(/=== Private Key \(Base64\) ===\s*\n([A-Za-z0-9+/=\s]+)\n\n=== Public Key/);
      const publicKeyMatch = text.match(/=== Public Key \(Base64\) - Safe to Share ===\s*\n([A-Za-z0-9+/=\s]+)\n/);
      
      if (!usernameMatch || !privateKeyMatch || !publicKeyMatch) {
        showToast('❌ Invalid key file format!', 'error');
        return;
      }

      const fileUsername = usernameMatch[1].trim();
      const privateKey = privateKeyMatch[1].trim().replace(/\s/g, '');
      const publicKey = publicKeyMatch[1].trim().replace(/\s/g, '');
      
      // Check if username matches
      if (fileUsername !== username) {
        showToast(`❌ Key file is for "${fileUsername}", not "${username}"!`, 'error');
        return;
      }

      // Validate the private key format
      showToast('🔍 Validating private key...', 'info');
      const isValid = validatePrivateKey(privateKey);
      
      if (!isValid) {
        showToast('❌ Invalid or corrupted private key!', 'error');
        return;
      }

      setUploadedKeyData({ privateKey, publicKey });
      showToast('✅ Private key validated successfully!', 'success');
    } catch (error) {
      console.error('Key upload error:', error);
      showToast('❌ Failed to read key file!', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include'
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Authentication failed', 'error');
        setLoading(false);
        return;
      }

      if (!isLogin) {
        // Sign up - Generate Kyber1024 key pair
        showToast('🔑 Generating Kyber1024 key pair...', 'info');
        
        const keyPair = await generateKyberKeyPair();
        const privateKeyBase64 = btoa(String.fromCharCode(...keyPair.privateKey));
        const publicKeyBase64 = btoa(String.fromCharCode(...keyPair.publicKey));

        // Store ONLY public key on server
        await fetch('/api/users/public-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            publicKey: publicKeyBase64
          })
        });

        setGeneratedKey({ 
          username, 
          privateKey: privateKeyBase64, 
          publicKey: publicKeyBase64 
        });
        setShowKeyDownload(true);
        setLoading(false);
        showToast('✅ Account created! Download your private key now!', 'success');
      } else {
        // Login - Prompt for key upload
        setShowKeyUpload(true);
        setLoading(false);
      }
    } catch (error) {
      console.error('Auth error:', error);
      showToast('Something went wrong. Please try again.', 'error');
      setLoading(false);
    }
  };

  const handleDownloadAndContinue = () => {
    if (generatedKey) {
      downloadSecretKey(generatedKey.username, generatedKey.privateKey, generatedKey.publicKey);
      
      // Store ONLY private key in sessionStorage (never sent to server)
      sessionStorage.setItem('private_key', generatedKey.privateKey);
      sessionStorage.setItem('public_key', generatedKey.publicKey);
      sessionStorage.setItem('username', generatedKey.username);
      
      showToast('🎉 Key downloaded! Redirecting to chat...', 'success');
      setTimeout(() => {
        window.location.href = '/chat';
      }, 1500);
    }
  };

  const handleUploadAndContinue = () => {
    if (!uploadedKeyData) {
      showToast('⚠️ Please upload your private key file first!', 'warning');
      return;
    }

    // Store keys in sessionStorage
    sessionStorage.setItem('private_key', uploadedKeyData.privateKey);
    sessionStorage.setItem('public_key', uploadedKeyData.publicKey);
    sessionStorage.setItem('username', username);
    
    showToast('✅ Private key loaded! Redirecting to chat...', 'success');
    setTimeout(() => {
      window.location.href = '/chat';
    }, 500);
  };

  const handleSkipDownload = () => {
    if (confirm('⚠️ WARNING: Without this private key, you CANNOT decrypt messages sent to you!\n\nYou will NOT be able to login again without this key!\n\nAre you absolutely sure?')) {
      // Store key for current session only
      sessionStorage.setItem('private_key', generatedKey.privateKey);
      sessionStorage.setItem('public_key', generatedKey.publicKey);
      sessionStorage.setItem('username', generatedKey.username);
      window.location.href = '/chat';
    }
  };

  // Key Upload Screen (for Login)
  if (showKeyUpload) {
    return (
      <>
        <Toast show={toast.show} message={toast.message} type={toast.type} />
        
        <div className="auth-container">
          <div className="auth-background">
            <div className="blob blob-1"></div>
            <div className="blob blob-2"></div>
            <div className="blob blob-3"></div>
          </div>

          <div className="auth-content">
            <div className="key-upload-card">
              <div className="key-icon">🔐</div>
              <h2>Upload Your Private Key</h2>
              <p className="key-description">
                To decrypt messages sent to you, please upload your private key file.
              </p>
              
              <div className="upload-box">
                <input
                  type="file"
                  id="keyFile"
                  accept=".txt"
                  onChange={handleKeyFileUpload}
                  style={{ display: 'none' }}
                />
                <label htmlFor="keyFile" className="upload-label">
                  {uploadedKeyData ? (
                    <>
                      <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="success-text">✅ Key Loaded Successfully!</span>
                      <small>Username: {username}</small>
                    </>
                  ) : (
                    <>
                      <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span>Click to upload your private key file</span>
                      <small>File name: {username}_private_key.txt</small>
                    </>
                  )}
                </label>
              </div>

              <div className="key-info-box">
                <h4>🔑 How does this work?</h4>
                <ul>
                  <li><strong>Your Private Key:</strong> Only you have this - never shared</li>
                  <li><strong>Your Public Key:</strong> Stored on server - others use it to encrypt messages to you</li>
                  <li><strong>Encryption:</strong> Others encrypt with your public key</li>
                  <li><strong>Decryption:</strong> Only your private key can decrypt</li>
                  <li><strong>Security:</strong> Kyber1024 (quantum-safe) + AES-256-GCM</li>
                </ul>
              </div>

              <button 
                onClick={handleUploadAndContinue} 
                className="continue-btn"
                disabled={!uploadedKeyData}
              >
                {uploadedKeyData ? '🚀 Continue to Chat' : '⚠️ Upload Key First'}
              </button>
              
              <button onClick={() => setShowKeyUpload(false)} className="back-btn">
                ← Back to Login
              </button>
            </div>
          </div>
        </div>

        <style jsx>{`
          .key-upload-card {
            background: white;
            border-radius: 24px;
            padding: 50px 40px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            animation: scaleIn 0.5s ease-out;
            max-width: 600px;
          }

          .key-icon {
            font-size: 80px;
            margin-bottom: 20px;
            animation: bounce 1s infinite;
          }

          .key-upload-card h2 {
            font-size: 32px;
            font-weight: 800;
            color: #1e293b;
            margin-bottom: 10px;
          }

          .key-description {
            color: #64748b;
            font-size: 15px;
            margin-bottom: 30px;
          }

          .upload-box {
            margin: 30px 0;
          }

          .upload-label {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 12px;
            padding: 50px 30px;
            border: 3px dashed #cbd5e1;
            border-radius: 16px;
            background: #f8fafc;
            cursor: pointer;
            transition: all 0.3s ease;
          }

          .upload-label:hover {
            border-color: #9333ea;
            background: #faf5ff;
          }

          .upload-label svg {
            color: #9333ea;
          }

          .upload-label span {
            font-size: 16px;
            font-weight: 600;
            color: #1e293b;
          }

          .success-text {
            color: #10b981 !important;
          }

          .upload-label small {
            font-size: 13px;
            color: #94a3b8;
          }

          .key-info-box {
            background: #f8fafc;
            border-radius: 12px;
            padding: 20px;
            margin: 25px 0;
            text-align: left;
          }

          .key-info-box h4 {
            font-size: 16px;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 12px;
          }

          .key-info-box ul {
            list-style: none;
            padding: 0;
            margin: 0;
          }

          .key-info-box li {
            padding: 8px 0;
            color: #64748b;
            font-size: 14px;
            padding-left: 20px;
            position: relative;
            line-height: 1.5;
          }

          .key-info-box li:before {
            content: "•";
            position: absolute;
            left: 0;
            color: #9333ea;
            font-weight: bold;
          }

          .key-info-box li strong {
            color: #1e293b;
          }

          .continue-btn {
            width: 100%;
            padding: 18px;
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            border: none;
            border-radius: 14px;
            font-size: 18px;
            font-weight: 700;
            cursor: pointer;
            margin-top: 10px;
            transition: all 0.3s ease;
            box-shadow: 0 10px 20px rgba(16, 185, 129, 0.3);
          }

          .continue-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 15px 30px rgba(16, 185, 129, 0.4);
          }

          .continue-btn:disabled {
            background: #cbd5e1;
            cursor: not-allowed;
            box-shadow: none;
          }

          .back-btn {
            width: 100%;
            padding: 14px;
            background: transparent;
            color: #64748b;
            border: 2px solid #e2e8f0;
            border-radius: 14px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            margin-top: 10px;
            transition: all 0.3s ease;
          }

          .back-btn:hover {
            border-color: #cbd5e1;
            color: #475569;
          }

          @keyframes scaleIn {
            from {
              transform: scale(0.9);
              opacity: 0;
            }
            to {
              transform: scale(1);
              opacity: 1;
            }
          }

          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }

          .auth-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            position: relative;
            overflow: hidden;
          }

          .auth-background {
            position: fixed;
            inset: 0;
            background: linear-gradient(135deg, #9333ea 0%, #ec4899 50%, #6366f1 100%);
            z-index: 0;
          }

          .blob {
            position: absolute;
            border-radius: 50%;
            filter: blur(60px);
            opacity: 0.3;
            animation: float 6s ease-in-out infinite;
          }

          .blob-1 {
            width: 300px;
            height: 300px;
            background: rgba(255, 255, 255, 0.2);
            top: -100px;
            right: -100px;
          }

          .blob-2 {
            width: 400px;
            height: 400px;
            background: rgba(147, 51, 234, 0.3);
            bottom: -150px;
            left: -150px;
            animation-delay: 2s;
          }

          .blob-3 {
            width: 350px;
            height: 350px;
            background: rgba(236, 72, 153, 0.2);
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            animation-delay: 4s;
          }

          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
          }

          .auth-content {
            position: relative;
            z-index: 1;
            width: 100%;
            max-width: 650px;
          }
        `}</style>
      </>
    );
  }

  // Key Download Screen continues in next artifact...
  if (showKeyDownload) {
    return (
      <>
        <Toast show={toast.show} message={toast.message} type={toast.type} />
        
        <div className="auth-container">
          <div className="auth-background">
            <div className="blob blob-1"></div>
            <div className="blob blob-2"></div>
            <div className="blob blob-3"></div>
          </div>

          <div className="auth-content">
            <div className="key-download-card">
              <div className="key-icon">🔐</div>
              <h2>Your Key Pair is Ready!</h2>
              <p className="key-warning">
                ⚠️ <strong>CRITICAL:</strong> Download your PRIVATE KEY now!
                Without it, you CANNOT decrypt messages sent to you.
              </p>
              
              <div className="key-info-box">
                <h4>🔑 Understanding Your Keys</h4>
                <ul>
                  <li><strong>Private Key (SECRET):</strong> Only YOU have this - NEVER share it!<br/>
                  <small>Used to decrypt messages sent to you</small></li>
                  <li><strong>Public Key (SAFE):</strong> Already stored on server<br/>
                  <small>Others use this to encrypt messages for you</small></li>
                  <li><strong>How It Works:</strong> Sender encrypts with Receiver's public key → Only Receiver's private key can decrypt</li>
                  <li><strong>No Key Sharing:</strong> You never need to share keys with other users!</li>
                  <li><strong>Quantum-Safe:</strong> Protected against future quantum computer attacks</li>
                </ul>
              </div>

              <button onClick={handleDownloadAndContinue} className="download-btn">
                📥 Download Private Key & Continue
              </button>
              
              <button onClick={handleSkipDownload} className="skip-btn">
                Skip (You'll lose access forever!)
              </button>
            </div>
          </div>
        </div>

        <style jsx>{`
          .key-download-card {
            background: white;
            border-radius: 24px;
            padding: 50px 40px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            animation: scaleIn 0.5s ease-out;
            max-width: 650px;
          }

          .key-icon {
            font-size: 80px;
            margin-bottom: 20px;
            animation: bounce 1s infinite;
          }

          .key-download-card h2 {
            font-size: 32px;
            font-weight: 800;
            color: #1e293b;
            margin-bottom: 15px;
          }

          .key-warning {
            background: linear-gradient(135deg, #fef3c7, #fde68a);
            border: 2px solid #fbbf24;
            border-radius: 12px;
            padding: 15px;
            margin: 20px 0;
            color: #92400e;
            font-size: 14px;
          }

          .key-info-box {
            background: #f8fafc;
            border-radius: 12px;
            padding: 20px;
            margin: 25px 0;
            text-align: left;
          }

          .key-info-box h4 {
            font-size: 16px;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 12px;
          }

          .key-info-box ul {
            list-style: none;
            padding: 0;
            margin: 0;
          }

          .key-info-box li {
            padding: 10px 0;
            color: #64748b;
            font-size: 14px;
            line-height: 1.6;
          }

          .key-info-box li strong {
            color: #1e293b;
            display: inline-block;
            margin-bottom: 4px;
          }

          .key-info-box li small {
            display: block;
            margin-top: 2px;
            font-size: 12px;
            color: #94a3b8;
            margin-left: 10px;
          }

          .download-btn {
            width: 100%;
            padding: 18px;
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            border: none;
            border-radius: 14px;
            font-size: 18px;
            font-weight: 700;
            cursor: pointer;
            margin-top: 10px;
            transition: all 0.3s ease;
            box-shadow: 0 10px 20px rgba(16, 185, 129, 0.3);
          }

          .download-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 30px rgba(16, 185, 129, 0.4);
          }

          .skip-btn {
            width: 100%;
            padding: 14px;
            background: transparent;
            color: #64748b;
            border: 2px solid #e2e8f0;
            border-radius: 14px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            margin-top: 10px;
            transition: all 0.3s ease;
          }

          .skip-btn:hover {
            border-color: #cbd5e1;
            color: #475569;
          }

          @keyframes scaleIn {
            from {
              transform: scale(0.9);
              opacity: 0;
            }
            to {
              transform: scale(1);
              opacity: 1;
            }
          }

          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }

          .auth-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            position: relative;
            overflow: hidden;
          }

          .auth-background {
            position: fixed;
            inset: 0;
            background: linear-gradient(135deg, #9333ea 0%, #ec4899 50%, #6366f1 100%);
            z-index: 0;
          }

          .blob {
            position: absolute;
            border-radius: 50%;
            filter: blur(60px);
            opacity: 0.3;
            animation: float 6s ease-in-out infinite;
          }

          .blob-1 {
            width: 300px;
            height: 300px;
            background: rgba(255, 255, 255, 0.2);
            top: -100px;
            right: -100px;
          }

          .blob-2 {
            width: 400px;
            height: 400px;
            background: rgba(147, 51, 234, 0.3);
            bottom: -150px;
            left: -150px;
            animation-delay: 2s;
          }

          .blob-3 {
            width: 350px;
            height: 350px;
            background: rgba(236, 72, 153, 0.2);
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            animation-delay: 4s;
          }

          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
          }

          .auth-content {
            position: relative;
            z-index: 1;
            width: 100%;
            max-width: 700px;
          }
        `}</style>
      </>
    );
  }

  // Login/Signup Form - continues with same styling as before...
  return (
    <>
      <Toast show={toast.show} message={toast.message} type={toast.type} />
      
      <div className="auth-container">
        {/* Same as before - login/signup form */}
        <div className="auth-background">
          <div className="blob blob-1"></div>
          <div className="blob blob-2"></div>
          <div className="blob blob-3"></div>
        </div>

        <div className="auth-content">
          <div className="auth-logo">
            <div className="logo-icon">
              <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h1>Quantum Chat App</h1>
            <div className="auth-badges">
              <span className="badge">🔐 Kyber1024 KEM</span>
              <span className="badge">🛡️ AES-256-GCM</span>
            </div>
            <p className="auth-tagline">True end-to-end encryption - no key sharing needed</p>
          </div>

          <div className="auth-card">
            <div className="auth-toggle">
              <button
                type="button"
                onClick={() => setIsLogin(true)}
                className={isLogin ? 'active' : ''}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className={!isLogin ? 'active' : ''}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label>Username</label>
                <div className="input-wrapper">
                  <svg className="input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    required
                    minLength={3}
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Password</label>
                <div className="input-wrapper">
                  <svg className="input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-22v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    minLength={6}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                  />
                </div>
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {isLogin ? 'Login' : 'Create Account'}
                  </>
                )}
              </button>
            </form>

            <div className="security-info">
              <p>🔐 Protected by Post-Quantum Cryptography</p>
              <div className="security-badges">
                <div className="security-badge">
                  <div className="badge-icon green">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <strong>Kyber1024</strong>
                    <small>Quantum-Safe KEM</small>
                  </div>
                </div>
                <div className="security-badge">
                  <div className="badge-icon blue">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <strong>AES-256</strong>
                    <small>GCM Mode</small>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="auth-footer">
            <p>Each user has their own unique key pair</p>
            <div className="footer-badges">
              <span><span className="status-dot green"></span>No Key Sharing</span>
              <span><span className="status-dot blue"></span>True E2EE</span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .auth-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          position: relative;
          overflow: hidden;
        }

        .auth-background {
          position: fixed;
          inset: 0;
          background: linear-gradient(135deg, #9333ea 0%, #ec4899 50%, #6366f1 100%);
          z-index: 0;
        }

        .blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(60px);
          opacity: 0.3;
          animation: float 6s ease-in-out infinite;
        }

        .blob-1 {
          width: 300px;
          height: 300px;
          background: rgba(255, 255, 255, 0.2);
          top: -100px;
          right: -100px;
        }

        .blob-2 {
          width: 400px;
          height: 400px;
          background: rgba(147, 51, 234, 0.3);
          bottom: -150px;
          left: -150px;
          animation-delay: 2s;
        }

        .blob-3 {
          width: 350px;
          height: 350px;
          background: rgba(236, 72, 153, 0.2);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation-delay: 4s;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }

        .auth-content {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 450px;
          animation: fadeInUp 0.6s ease-out;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .auth-logo {
          text-align: center;
          margin-bottom: 30px;
        }

        .logo-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 70px;
          height: 70px;
          background: white;
          border-radius: 20px;
          color: #9333ea;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
          margin-bottom: 20px;
          transition: transform 0.3s ease;
        }

        .logo-icon:hover {
          transform: scale(1.1) rotate(5deg);
        }

        .auth-logo h1 {
          font-size: 48px;
          font-weight: 800;
          color: white;
          margin: 0 0 15px 0;
          letter-spacing: -1px;
        }

        .auth-badges {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(10px);
          color: white;
          font-size: 12px;
          font-weight: 600;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .auth-tagline {
          color: rgba(255, 255, 255, 0.9);
          font-size: 14px;
          margin: 0;
        }

        .auth-card {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border-radius: 24px;
          padding: 40px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          transition: transform 0.3s ease;
        }

        .auth-card:hover {
          transform: translateY(-5px);
        }

        .auth-toggle {
          display: flex;
          gap: 8px;
          background: #f1f5f9;
          border-radius: 16px;
          padding: 6px;
          margin-bottom: 30px;
        }

        .auth-toggle button {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          color: #64748b;
          background: transparent;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .auth-toggle button.active {
          background: linear-gradient(135deg, #9333ea, #ec4899);
          color: white;
          box-shadow: 0 4px 12px rgba(147, 51, 234, 0.3);
          transform: scale(1.02);
        }

        .auth-toggle button:hover:not(.active) {
          color: #334155;
          background: rgba(255, 255, 255, 0.5);
        }

        .auth-form {
          margin-bottom: 30px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          font-size: 14px;
          font-weight: 700;
          color: #334155;
          margin-bottom: 8px;
        }

        .input-wrapper {
          position: relative;
        }

        .input-icon {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          width: 20px;
          height: 20px;
          color: #94a3b8;
          pointer-events: none;
        }

        .input-wrapper input {
          width: 100%;
          padding: 14px 16px 14px 48px;
          border: 2px solid #e2e8f0;
          border-radius: 14px;
          font-size: 15px;
          background: #f8fafc;
          color: #1e293b;
          transition: all 0.3s ease;
        }

        .input-wrapper input:focus {
          outline: none;
          border-color: #9333ea;
          background: white;
          box-shadow: 0 0 0 4px rgba(147, 51, 234, 0.1);
        }

        .submit-btn {
          width: 100%;
          padding: 16px;
          border: none;
          border-radius: 14px;
          font-size: 16px;
          font-weight: 700;
          color: white;
          background: linear-gradient(135deg, #9333ea, #ec4899);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          box-shadow: 0 10px 20px rgba(147, 51, 234, 0.3);
          transition: all 0.3s ease;
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 15px 30px rgba(147, 51, 234, 0.4);
        }

        .submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .security-info {
          padding-top: 25px;
          border-top: 2px solid #f1f5f9;
          text-align: center;
        }

        .security-info > p {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          margin: 0 0 15px 0;
        }

        .security-badges {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .security-badge {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          background: linear-gradient(135deg, #f8fafc, #f1f5f9);
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }

        .badge-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .badge-icon svg {
          width: 20px;
          height: 20px;
          color: white;
        }

        .badge-icon.green {
          background: linear-gradient(135deg, #10b981, #059669);
        }

        .badge-icon.blue {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
        }

        .security-badge div:last-child {
          text-align: left;
          flex: 1;
        }

        .security-badge strong {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: #1e293b;
        }

        .security-badge small {
          display: block;
          font-size: 11px;
          color: #64748b;
        }

        .auth-footer {
          text-align: center;
          margin-top: 25px;
          animation: fadeInUp 0.6s ease-out 0.2s backwards;
        }

        .auth-footer > p {
          color: rgba(255, 255, 255, 0.9);
          font-size: 14px;
          font-weight: 500;
          margin: 0 0 12px 0;
        }

        .footer-badges {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 15px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.8);
        }

        .footer-badges span {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border-radius: 20px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        .status-dot.green {
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
        }

        .status-dot.blue {
          background: #3b82f6;
          box-shadow: 0 0 8px #3b82f6;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        @media (max-width: 640px) {
          .auth-card {
            padding: 30px 20px;
          }

          .auth-logo h1 {
            font-size: 36px;
          }

          .security-badges {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
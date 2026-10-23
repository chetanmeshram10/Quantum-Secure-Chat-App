const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize Socket.io
  const io = new Server(server, {
    cors: {
      origin: dev ? 'http://localhost:3000' : true,
      methods: ['GET', 'POST']
    }
  });

  // Track online users
  const onlineUsers = new Map(); // username -> socket.id
  const userSockets = new Map(); // socket.id -> username

  io.on('connection', (socket) => {
    console.log('✅ Client connected:', socket.id);

    // Register user
    socket.on('register', (username) => {
      onlineUsers.set(username, socket.id);
      userSockets.set(socket.id, username);
      
      console.log(`👤 ${username} is now online`);
      
      // Broadcast updated online users list
      const onlineUsersList = Array.from(onlineUsers.keys());
      io.emit('onlineUsers', onlineUsersList);
      
      console.log(`📊 Online users: ${onlineUsersList.join(', ')}`);
    });

    // Handle message sending
    socket.on('sendMessage', (encryptedMessage) => {
      const { to, from } = encryptedMessage;
      
      console.log(`📨 Message from ${from} to ${to}`);
      
      const recipientSocketId = onlineUsers.get(to);
      
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('receiveMessage', encryptedMessage);
        console.log(`✅ Message delivered to ${to}`);
      } else {
        console.log(`⚠️ ${to} is offline - message stored in database`);
      }
    });

    // Handle file sending
    socket.on('sendFile', (fileData) => {
      const { to, from } = fileData;
      
      console.log(`📎 File from ${from} to ${to}`);
      
      const recipientSocketId = onlineUsers.get(to);
      
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('receiveFile', fileData);
        console.log(`✅ File delivered to ${to}`);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      const username = userSockets.get(socket.id);
      
      if (username) {
        onlineUsers.delete(username);
        userSockets.delete(socket.id);
        
        console.log(`👋 ${username} disconnected`);
        
        // Broadcast updated online users list
        const onlineUsersList = Array.from(onlineUsers.keys());
        io.emit('onlineUsers', onlineUsersList);
        
        console.log(`📊 Online users: ${onlineUsersList.join(', ')}`);
      }
    });
  });

  server
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log('');
      console.log('🚀 ========================================');
      console.log('🔐 Quantum Chat App Server');
      console.log('🚀 ========================================');
      console.log(`📍 URL: http://${hostname}:${port}`);
      console.log(`🌍 Environment: ${dev ? 'Development' : 'Production'}`);
      console.log(`⚡ Socket.io: Ready`);
      console.log(`🔑 Kyber1024 + AES-256-GCM: Active`);
      console.log('🚀 ========================================');
      console.log('');
    });
});
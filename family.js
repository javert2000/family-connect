const express = require('express');
const app = express();
const port = 3000;
const mongoose = require('mongoose');
require('dotenv').config();
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http);
const engine = require('ejs-mate');
const { v4: uuidv4 } = require('uuid');

app.use(express.json());

mongoose.connect(process.env.MONGO_URI  || 'mongodb://127.0.0.1:27017/tstFamily-connect')
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error('Error connecting to MongoDB:', err));

app.engine('ejs', engine);
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.render('home', {
    title: 'Family Connect'
  });
});

app.get('/chat', (req, res) => {
  res.render('chat', {
    title: 'Family chat'
  });
});

app.get('/video', (req, res) => {
  res.render('video', {
    title: 'Family video'
  });
});

app.get('/calendar', (req, res) => {
  res.render('calendar', {
    title: 'Family calendar'
  });
});

app.get('/media', (req, res) => {
  res.render('media', {
    title: 'Family media'
  });
});

http.listen(port, () => console.log(`Server is running on port ${port}`));

// Socket.IO chat logic
let messages = [];
let onlineUsers = {};
let allUsers = {};

// --- WebRTC Video Conference Signaling ---
const videoRooms = {};

io.on('connection', (socket) => {
  console.log('A user connected');
  // Send all messages to the new client (client will filter by room)
  socket.emit('chat history', messages);
  // Handle user join (client should emit 'user join' with username)
  socket.on('user join', (username) => {
    onlineUsers[socket.id] = username;
    allUsers[username] = { username, online: true };
    broadcastUserList();
  });
  // Handle user disconnect
  socket.on('disconnect', () => {
    const username = onlineUsers[socket.id];
    if (username) {
      allUsers[username].online = false;
      delete onlineUsers[socket.id];
      broadcastUserList();
    }
    console.log('A user disconnected');

    // Clean up on disconnect
    for (const room in videoRooms) {
      if (videoRooms[room].includes(socket.id)) {
        videoRooms[room] = videoRooms[room].filter(id => id !== socket.id);
        socket.to(room).emit('user-left', socket.id);
        if (videoRooms[room].length === 0) delete videoRooms[room];
      }
    }
  });
  // Handle user mute/unmute
  socket.on('mute user', (username) => {
    if (allUsers[username]) {
      allUsers[username].muted = true;
      broadcastUserList();
    }
  });
  socket.on('unmute user', (username) => {
    if (allUsers[username]) {
      allUsers[username].muted = false;
      broadcastUserList();
    }
  });
  // Helper to broadcast user list
  function broadcastUserList() {
    // Send all users, with online/muted status
    io.emit('user list', Object.values(allUsers));
  }
  // Listen for new messages
  socket.on('chat message', (msgObj) => {
    // Expect msgObj: { room, username, text, time }
    msgObj.id = uuidv4();
    msgObj.reactions = {};
    messages.push(msgObj);
    io.emit('chat message', msgObj);
  });
  // Handle reactions
  socket.on('reaction', ({ messageId, emoji, username }) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;
    if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
    const idx = msg.reactions[emoji].indexOf(username);
    if (idx === -1) {
      msg.reactions[emoji].push(username);
    } else {
      msg.reactions[emoji].splice(idx, 1);
      if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
    }
    io.emit('reaction update', { messageId, reactions: msg.reactions });
  });
  // Typing indicator events
  socket.on('typing', ({ room, username }) => {
    socket.broadcast.emit('typing', { room, username });
  });
  socket.on('stop typing', ({ room, username }) => {
    socket.broadcast.emit('stop typing', { room, username });
  });
  // Handle edit message
  socket.on('edit message', ({ messageId, newText, username }) => {
    const msg = messages.find(m => m.id === messageId);
    if (msg && msg.username === username) {
      msg.text = newText;
      msg.edited = true;
      io.emit('edit message', { messageId, newText });
    }
  });
  // Handle delete message
  socket.on('delete message', ({ messageId, username }) => {
    const idx = messages.findIndex(m => m.id === messageId && m.username === username);
    if (idx !== -1) {
      messages.splice(idx, 1);
      io.emit('delete message', { messageId });
    }
  });

  // Video: Join room
  socket.on('join-room', (room) => {
    socket.join(room);
    if (!videoRooms[room]) videoRooms[room] = [];
    videoRooms[room].push(socket.id);
    // Notify others in the room
    socket.to(room).emit('user-joined', socket.id);
    // Send list of other users in the room to the new user
    const others = videoRooms[room].filter(id => id !== socket.id);
    socket.emit('all-users', others);
  });

  // Video: Relay WebRTC signals
  socket.on('signal', ({ to, from, data }) => {
    io.to(to).emit('signal', { from, data });
  });

  // Video: Leave room
  socket.on('leave-room', (room) => {
    socket.leave(room);
    if (videoRooms[room]) {
      videoRooms[room] = videoRooms[room].filter(id => id !== socket.id);
      socket.to(room).emit('user-left', socket.id);
      if (videoRooms[room].length === 0) delete videoRooms[room];
    }
  });
});
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/channels', (req, res) => {
  res.json(loadChannels());
});
const USERS_FILE = path.join(__dirname, 'users.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

// Load or create users file
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '{}');
  return JSON.parse(fs.readFileSync(USERS_FILE));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Load or create messages file
function loadMessages() {
  if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, '[]');
  return JSON.parse(fs.readFileSync(MESSAGES_FILE));
}

function saveMessages(messages) {
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

const CHANNELS_FILE = path.join(__dirname, 'channels.json');

function loadChannels() {
  if (!fs.existsSync(CHANNELS_FILE)) {
    fs.writeFileSync(CHANNELS_FILE, JSON.stringify(['general', 'random', 'gaming']));
  }
  return JSON.parse(fs.readFileSync(CHANNELS_FILE));
}

function saveChannels(channels) {
  fs.writeFileSync(CHANNELS_FILE, JSON.stringify(channels, null, 2));
}



// Load messages into memory on startup
let messages = loadMessages();

// Sign up
app.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  const users = loadUsers();

  if (!username || !password) return res.json({ ok: false, error: 'Fill in all fields' });
  if (username.length < 3) return res.json({ ok: false, error: 'Username too short' });
  if (password.length < 4) return res.json({ ok: false, error: 'Password too short' });
  if (users[username]) return res.json({ ok: false, error: 'Username already taken' });

  users[username] = await bcrypt.hash(password, 10);
  saveUsers(users);
  res.json({ ok: true });
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const users = loadUsers();

  if (!users[username]) return res.json({ ok: false, error: 'User not found' });
  const match = await bcrypt.compare(password, users[username]);
  if (!match) return res.json({ ok: false, error: 'Wrong password' });

  res.json({ ok: true });
});

app.post('/rename', (req, res) => {
  const { oldUsername, newUsername } = req.body;
  const users = loadUsers();

  if (!newUsername) return res.json({ ok: false, error: 'Name cannot be empty' });
  if (newUsername.length < 3) return res.json({ ok: false, error: 'Name too short' });
  if (users[newUsername]) return res.json({ ok: false, error: 'Name already taken' });
  if (!users[oldUsername]) return res.json({ ok: false, error: 'User not found' });

  users[newUsername] = users[oldUsername];
  delete users[oldUsername];
  saveUsers(users);

  // Update all previous messages
  messages.forEach(msg => {
    if (msg.user === oldUsername) msg.user = newUsername;
  });
  saveMessages(messages);

  res.json({ ok: true });
});

// Socket
io.on('connection', (socket) => {
  // Send full message history to new connection
  socket.emit('history', messages);
socket.on('deleteChannel', (name) => {
  const channels = loadChannels();
  const updated = channels.filter(c => c !== name);
  saveChannels(updated);
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].channel === name) messages.splice(i, 1);
  }
  saveMessages(messages);
  io.emit('channelDeleted', name);
});

socket.on('addChannel', (name) => {
  const channels = loadChannels();
  if (channels.includes(name)) return;
  channels.push(name);
  saveChannels(channels);
  io.emit('channelAdded', name);
});
socket.on('join', (username) => {
  socket.username = username;
  io.emit('system', `${username} joined the chat`);

socket.on('renamed', (newName) => {
  socket.username = newName;
  io.emit('messagesUpdated', messages);


socket.on('renameChannel', ({ oldName, newName }) => {
  const channels = loadChannels();
  const index = channels.indexOf(oldName);
  if (index !== -1) channels[index] = newName;
  saveChannels(channels);
  messages.forEach(msg => {
    if (msg.channel === oldName) msg.channel = newName;
  });
  saveMessages(messages);
  io.emit('channelRenamed', { oldName, newName });
});

});
});

socket.on('requestHistory', () => {
  socket.emit('history', messages);
});

  socket.on('message', ({ text, channel }) => {
    const msg = {
      user: socket.username || 'Anonymous',
      text,
      channel: channel || 'general',
      time: new Date().toLocaleTimeString()
    };

    messages.push(msg);

    // Keep max 500 messages, then trim
    if (messages.length > 500) messages = messages.slice(-500);

    // Save to disk
    saveMessages(messages);

    io.emit('message', msg);
  });

  socket.on('disconnect', () => {
    if (socket.username) io.emit('system', `${socket.username} left`);
  });
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Chat running at http://localhost:3000');
});
function togglePassword() {
  const input = document.getElementById('auth-password');
  const btn = document.getElementById('toggle-pw');
  if (input.type === 'password') {
    input.type = 'text';
    btn.innerHTML = '&#128065;';
  } else {
    input.type = 'password';
    btn.innerHTML = '&#128064;';
  }
}
const socket = io();
let username = '';
let channel = 'general';
let currentTab = 'login';

async function loadChannels() {
  const res = await fetch('/channels');
  const channels = await res.json();
  const sidebar = document.querySelector('#sidebar');
  const userInfo = document.getElementById('user-info');

  // Remove existing channel divs
  document.querySelectorAll('.channel').forEach(el => el.remove());

  channels.forEach((name, index) => {
    const div = document.createElement('div');
    div.className = index === 0 ? 'channel active' : 'channel';
    div.id = `ch-${name}`;
    div.setAttribute('onclick', `switchChannel('${name}', this)`);
    div.innerHTML = `
      <span class="channel-name">${name}</span>
      <button type="button" class="rename-channel-btn" onclick="startRenameChannel(event, '${name}')">📝</button>
      <button type="button" class="delete-channel-btn" onclick="confirmDeleteChannel(event, '${name}')">－</button>
    `;
    sidebar.insertBefore(div, userInfo);
  });

  // Set current channel to first one
  channel = channels[0];
  document.getElementById('current-channel').textContent = channel;
  document.getElementById('msg-input').placeholder = `Message #${channel}`;
}

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

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('auth-btn').textContent = tab === 'login' ? 'Login' : 'Sign Up';
  document.getElementById('auth-subtitle').textContent = tab === 'login' ? 'Welcome back' : 'Create your account';
  document.getElementById('auth-error').textContent = '';
}

async function submitAuth() {
  const u = document.getElementById('auth-username').value.trim();
  const p = document.getElementById('auth-password').value;
  const errEl = document.getElementById('auth-error');

  if (!u || !p) { errEl.textContent = 'Fill in all fields'; return; }

  const endpoint = currentTab === 'login' ? '/login' : '/signup';
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: p })
  });
  const data = await res.json();

  if (!data.ok) { errEl.textContent = data.error; return; }

  if (currentTab === 'signup') {
    errEl.style.color = '#57f287';
    errEl.textContent = 'Account created! Logging you in...';
    setTimeout(() => enterChat(u), 800);
  } else {
    enterChat(u);
  }
}

function enterChat(u) {
  username = u;
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('logged-in-user').textContent = u;
  loadChannels().then(() => {
    socket.emit('join', username);
    socket.emit('requestHistory');
  });
  document.getElementById('msg-input').focus();
}
function logout() {
  username = '';
  document.getElementById('settings-screen').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-username').value = '';
  document.getElementById('auth-password').value = '';
  document.getElementById('messages').innerHTML = '';
}

let isRenaming = false;

function switchChannel(ch, el) {
  if (isRenaming) return;
  if (ch === channel) return;
  channel = ch;
  document.getElementById('current-channel').textContent = ch;
  document.querySelectorAll('.channel').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('msg-input').placeholder = `Message #${ch}`;
  const box = document.getElementById('messages');
  box.innerHTML = '';
  socket.emit('requestHistory');
}

function sendMsg() {
  const input = document.getElementById('msg-input');
  const text = input.value.trim();
  if (!text) return;
  socket.emit('message', { text, channel });
  input.value = '';
}

function colorFor(name) {
  const colors = ['#5865f2','#eb459e','#57f287','#fee75c','#ed4245','#00b0f4'];
  let n = 0; for (const c of name) n += c.charCodeAt(0);
  return colors[n % colors.length];
}

socket.on('history', (msgs) => {
  const box = document.getElementById('messages');
  box.innerHTML = '';
  msgs.filter(m => m.channel === channel).forEach(addMessage);
  scrollToBottom();
});

socket.on('message', (msg) => {
  if (msg.channel === channel) addMessage(msg);
});

socket.on('system', (text) => {
  const div = document.createElement('div');
  div.className = 'system-msg';
  div.textContent = text;
  document.getElementById('messages').appendChild(div);
  scrollToBottom();
});

socket.on('messagesUpdated', (msgs) => {
  const box = document.getElementById('messages');
  box.innerHTML = '';
  msgs.filter(m => m.channel === channel).forEach(addMessage);
  scrollToBottom();
});

function addMessage(msg) {
  const box = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'msg';
  div.innerHTML = `
    <div class="avatar" style="background:${colorFor(msg.user)}">${msg.user[0].toUpperCase()}</div>
    <div class="msg-body">
      <div class="msg-meta">
        <span class="msg-user">${msg.user}</span>
        <span class="msg-time">${msg.time}</span>
      </div>
      <div class="msg-text">${msg.text}</div>
    </div>`;
  box.appendChild(div);
  scrollToBottom();
}

function scrollToBottom() {
  const m = document.getElementById('messages');
  m.scrollTop = m.scrollHeight;
}

function openSettings() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('settings-screen').style.display = 'flex';
  document.getElementById('rename-input').value = username;
  document.getElementById('rename-msg').textContent = '';
}

function closeSettings() {
  document.getElementById('settings-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
}

async function renameUser() {
  const newName = document.getElementById('rename-input').value.trim();

  if (!newName) return;
  if (newName === username) return;
  if (newName.length < 3) return;

  const res = await fetch('/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldUsername: username, newUsername: newName })
  });
  const data = await res.json();

  if (!data.ok) return;

  username = newName;
  document.getElementById('logged-in-user').textContent = newName;
  socket.emit('renamed', newName);
  closeSettings();
}

function startRenameChannel(event, oldName) {
  event.stopPropagation();
  event.preventDefault();

  const el = document.getElementById(`ch-${oldName}`);
  if (!el) return;
  if (el.querySelector('.channel-rename-input')) return;

  const nameEl = el.querySelector('.channel-name');
  const btnEl = el.querySelector('.rename-channel-btn');

  nameEl.style.display = 'none';
  btnEl.style.display = 'none';
  el.removeAttribute('onclick');

  const input = document.createElement('input');
  input.className = 'channel-rename-input';
  input.value = oldName;

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'channel-rename-confirm';
  confirmBtn.innerHTML = '✔';

  el.appendChild(input);
  el.appendChild(confirmBtn);
  input.focus();
  input.select();

  function cancelRename() {
    input.remove();
    confirmBtn.remove();
    nameEl.style.display = '';
    btnEl.style.display = '';
    el.setAttribute('onclick', `switchChannel('${oldName}', this)`);
  }

  function doRename() {
    const newName = input.value.trim().toLowerCase().replace(/\s+/g, '-');
    if (!newName || newName === oldName) { cancelRename(); return; }
    input.remove();
    confirmBtn.remove();
    nameEl.textContent = newName;
    nameEl.style.display = '';
    btnEl.style.display = '';
    btnEl.setAttribute('onclick', `startRenameChannel(event, '${newName}')`);
    el.id = `ch-${newName}`;
    el.setAttribute('onclick', `switchChannel('${newName}', this)`);
    if (channel === oldName) {
      channel = newName;
      document.getElementById('current-channel').textContent = newName;
      document.getElementById('msg-input').placeholder = `Message #${newName}`;
    }
    socket.emit('renameChannel', { oldName, newName });
  }

  confirmBtn.addEventListener('mousedown', function(e) {
    e.stopPropagation();
    e.preventDefault();
    doRename();
  });

  input.addEventListener('keydown', function(e) {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); doRename(); }
    if (e.key === 'Escape') { cancelRename(); }
  });

  input.addEventListener('mousedown', function(e) { e.stopPropagation(); });
  input.addEventListener('click', function(e) { e.stopPropagation(); });
}

socket.on('channelRenamed', ({ oldName, newName }) => {
  const el = document.getElementById(`ch-${oldName}`);
  if (el) {
    el.id = `ch-${newName}`;
    el.setAttribute('onclick', `switchChannel('${newName}', this)`);
    const nameEl = el.querySelector('.channel-name');
    const btnEl = el.querySelector('.rename-channel-btn');
    if (nameEl) nameEl.textContent = newName;
    if (btnEl) btnEl.setAttribute('onclick', `startRenameChannel(event, '${newName}')`);
  }
  if (channel === oldName) {
    channel = newName;
    document.getElementById('current-channel').textContent = newName;
    document.getElementById('msg-input').placeholder = `Message #${newName}`;
  }
});

socket.on('channelRenamed', ({ oldName, newName }) => {
  const el = document.getElementById(`ch-${oldName}`);
  if (el) {
    // Clean up input and confirm button if still there
    const input = el.querySelector('.channel-rename-input');
    const confirmBtn = el.querySelector('.channel-rename-confirm');
    if (input) input.remove();
    if (confirmBtn) confirmBtn.remove();

    // Update element
    el.id = `ch-${newName}`;
    el.setAttribute('onclick', `switchChannel('${newName}', this)`);

    const nameEl = el.querySelector('.channel-name');
    const btnEl = el.querySelector('.rename-channel-btn');
    nameEl.textContent = newName;
    nameEl.style.display = '';
    btnEl.style.display = '';
    btnEl.setAttribute('onclick', `startRenameChannel(event, '${newName}')`);
  }

  // Update channel variable and header without resetting messages
  if (channel === oldName) {
    channel = newName;
    document.getElementById('current-channel').textContent = newName;
    document.getElementById('msg-input').placeholder = `Message #${newName}`;
  }
});

socket.on('channelRenamed', ({ oldName, newName }) => {
  const el = document.getElementById(`ch-${oldName}`);
  if (el) {
    // Clean up any rename inputs
    const input = el.querySelector('.channel-rename-input');
    const confirm = el.querySelector('.channel-rename-confirm');
    if (input) input.remove();
    if (confirm) confirm.remove();

    // Update id, name span, buttons
    el.id = `ch-${newName}`;
    el.setAttribute('onclick', `switchChannel('${newName}', this)`);
    const nameEl = el.querySelector('.channel-name');
    const btnEl = el.querySelector('.rename-channel-btn');
    nameEl.textContent = newName;
    nameEl.style.display = '';
    btnEl.style.display = '';
    btnEl.setAttribute('onclick', `startRenameChannel(event, '${newName}')`);
  }

  if (channel === oldName) {
    channel = newName;
    document.getElementById('current-channel').textContent = newName;
    document.getElementById('msg-input').placeholder = `Message #${newName}`;
  }
});

let channelToDelete = null;

function confirmDeleteChannel(event, name) {
  event.stopPropagation();
  channelToDelete = name;
  document.getElementById('delete-popup-msg').textContent = `You are about to delete #${name} and all of its messages. This cannot be undone.`;
  document.getElementById('delete-popup').style.display = 'flex';
}

function closeDeletePopup() {
  document.getElementById('delete-popup').style.display = 'none';
  channelToDelete = null;
}

function executeDeleteChannel() {
  if (!channelToDelete) return;
  socket.emit('deleteChannel', channelToDelete);
  closeDeletePopup();
}

socket.on('channelDeleted', (name) => {
  const el = document.getElementById(`ch-${name}`);
  if (el) el.remove();

  // If we were in the deleted channel, switch to first available
  if (channel === name) {
    const first = document.querySelector('.channel');
    if (first) {
      const firstName = first.querySelector('.channel-name').textContent;
      channel = firstName;
      first.classList.add('active');
      document.getElementById('current-channel').textContent = firstName;
      document.getElementById('msg-input').placeholder = `Message #${firstName}`;
      document.getElementById('messages').innerHTML = '';
      socket.emit('requestHistory');
    }
  }
});

function showAddChannel() {
  const wrapper = document.getElementById('new-channel-wrapper');
  wrapper.style.display = 'flex';
  const input = document.getElementById('new-channel-input');
  input.value = '';
  input.focus();
}

function addChannel() {
  const input = document.getElementById('new-channel-input');
  const name = input.value.trim().toLowerCase().replace(/\s+/g, '-');
  if (!name) return;
  socket.emit('addChannel', name);
  document.getElementById('new-channel-wrapper').style.display = 'none';
  input.value = '';
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('new-channel-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addChannel();
    if (e.key === 'Escape') {
      document.getElementById('new-channel-wrapper').style.display = 'none';
    }
  });
});

socket.on('channelAdded', (name) => {
  const sidebar = document.querySelector('#sidebar');
  const userInfo = document.getElementById('user-info');
  const div = document.createElement('div');
  div.className = 'channel';
  div.id = `ch-${name}`;
  div.setAttribute('onclick', `switchChannel('${name}', this)`);
  div.innerHTML = `
    <span class="channel-name">${name}</span>
    <button type="button" class="rename-channel-btn" onclick="startRenameChannel(event, '${name}')">📝</button>
    <button type="button" class="delete-channel-btn" onclick="confirmDeleteChannel(event, '${name}')">－</button>
  `;
  sidebar.insertBefore(div, userInfo);
});
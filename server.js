const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
const DB_PATH = path.join(__dirname, 'data', 'postits.json');

// Todos os emojis usados no client.js (EMOJI_CATEGORIES)
const ALLOWED_EMOJIS = [
  '👍','❤️','😄','😂','😮','😢','🥹','😍',
  '🔥','🎉','✨','💯','🙌','👏','🚀','⭐',
  '😎','🤔','🤯','😤','🥳','🤩','😅','🫡',
  '🌸','🍀','🌈','🦋','🌙','💫','🎯','💎',
];

// Servir arquivos estáticos da pasta public
app.use(express.static('public'));

function loadPostits() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

function savePostits(postits) {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(postits, null, 2));
}

function isValidHexColor(color) {
  return typeof color === 'string' && /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(color);
}

function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  return text.trim().slice(0, 200);
}

function sanitizeNickname(nickname) {
  if (typeof nickname !== 'string') return null;
  const value = nickname.trim().slice(0, 30);
  return value === '' ? null : value;
}

let postits = loadPostits();

io.on('connection', (socket) => {
  console.log('Um cliente conectou:', socket.id);

  socket.emit('initial_postits', postits);
  io.emit('online_count', io.engine.clientsCount);

  // ── Novo post-it ──────────────────────────────────
  socket.on('new_postit', (postitData) => {
    const texto = sanitizeText(postitData.texto);
    if (!texto) {
      socket.emit('postit_rejected', 'Texto do post-it obrigatório.');
      return;
    }

    const cor      = isValidHexColor(postitData.cor) ? postitData.cor : '#FFEB3B';
    const nickname = sanitizeNickname(postitData.nickname);

    const newPostit = {
      id:        Date.now().toString() + '-' + Math.random().toString(36).substr(2, 6),
      texto,
      cor,
      nickname,
      x:         Math.floor(Math.random() * 500),
      y:         Math.floor(Math.random() * 300),
      reacoes:   {},
      timestamp: Date.now(),
    };

    postits.push(newPostit);
    savePostits(postits);
    io.emit('postit_added', newPostit);
  });

  // ── Editar post-it ────────────────────────────────
  socket.on('edit_postit', (payload) => {
    const texto = sanitizeText(payload.texto);
    if (!texto) {
      socket.emit('postit_rejected', 'Texto do post-it obrigatório.');
      return;
    }

    const postit = postits.find(p => p.id === payload.id);
    if (!postit) return;

    postit.texto    = texto;
    postit.cor      = isValidHexColor(payload.cor) ? payload.cor : postit.cor;
    postit.nickname = sanitizeNickname(payload.nickname);

    // Preserva posição se o client enviou coordenadas atualizadas
    if (payload.x != null && Number.isFinite(Number(payload.x))) postit.x = Number(payload.x);
    if (payload.y != null && Number.isFinite(Number(payload.y))) postit.y = Number(payload.y);

    // reacoes e timestamp nunca são sobrescritos na edição
    savePostits(postits);
    io.emit('postit_edited', postit);
  });

  // ── Remover post-it ───────────────────────────────
  socket.on('delete_postit', (id) => {
    const index = postits.findIndex(p => p.id === id);
    if (index !== -1) {
      postits.splice(index, 1);
      savePostits(postits);
      io.emit('postit_removed', id);
    }
  });

  // ── Mover post-it ─────────────────────────────────
  socket.on('move_postit', ({ id, x, y }) => {
    const postit = postits.find(p => p.id === id);
    if (postit) {
      postit.x = Number.isFinite(x) ? x : postit.x;
      postit.y = Number.isFinite(y) ? y : postit.y;
      savePostits(postits);
      io.emit('postit_moved', { id, x: postit.x, y: postit.y });
    }
  });

  // ── Reagir a post-it ──────────────────────────────
  socket.on('react_postit', ({ id, emoji }) => {
    if (typeof emoji !== 'string' || !ALLOWED_EMOJIS.includes(emoji)) return;

    const postit = postits.find(p => p.id === id);
    if (!postit) return;

    postit.reacoes = postit.reacoes || {};
    postit.reacoes[emoji] = (postit.reacoes[emoji] || 0) + 1;

    savePostits(postits);
    io.emit('postit_reacted', { id, reacoes: postit.reacoes });
  });

  // ── Indicador de digitação ────────────────────────
  socket.on('typing', (nickname) => {
    // Reenvia para todos EXCETO quem está digitando
    socket.broadcast.emit('user_typing', nickname || null);
  });

  // ── Desconexão ────────────────────────────────────
  socket.on('disconnect', () => {
    console.log('Cliente desconectou:', socket.id);
    io.emit('online_count', io.engine.clientsCount);
  });
});

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
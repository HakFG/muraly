/* ═══════════════════════════════════════════════
   MURALY — client.js  (v2)
   Responsabilidade: SOMENTE interface e eventos de UI.
   Nunca salva dados. Todo estado principal vem do servidor.

   Organização:
   1. Conexão e referências ao DOM
   2. Estado local
   3. Eventos recebidos do servidor (socket.on)
   4. Renderização
   5. Sistema de reações inteligente
   6. Busca no mural
   7. Modal (abrir, fechar, paleta, preview)
   8. Envio do formulário (criação e edição)
   9. Funções auxiliares (toast, confete, exportar, apresentação)
   10. Drag & drop
   11. Inicialização
═══════════════════════════════════════════════ */


/* ───────────────────────────────────────────────
   1. CONEXÃO E REFERÊNCIAS AO DOM
─────────────────────────────────────────────── */
const socket = io();

const board           = document.getElementById('board');
const emptyMsg        = document.getElementById('emptyMsg');
const onlineCount     = document.getElementById('onlineCount');
const postitCountEl   = document.getElementById('postitCount');

const toolbar         = document.getElementById('toolbar');
const addBtn          = document.getElementById('addPostitBtn');
const exportBtn       = document.getElementById('exportBtn');
const presentBtn      = document.getElementById('presentBtn');
const exitPresentBtn  = document.getElementById('exitPresentBtn');
const searchInput     = document.getElementById('searchInput');
const noResultsMsg    = document.getElementById('noResultsMsg');

const modal           = document.getElementById('modal');
const modalBackdrop   = document.getElementById('modalBackdrop');
const closeModalBtn   = document.getElementById('closeModal');
const modalTitle      = document.getElementById('modalTitle');
const submitBtn       = document.getElementById('submitPostit');

const nicknameInput   = document.getElementById('nickname');
const textInput       = document.getElementById('postText');
const charCount       = document.getElementById('charCount');
const colorSwatches   = document.querySelectorAll('.color-swatch');
const colorCustom     = document.getElementById('postColor');
const postitPreview   = document.getElementById('postitPreview');

const toastEl         = document.getElementById('toast');
const typingIndicator = document.getElementById('typingIndicator');
const typingText      = document.getElementById('typingText');


/* ───────────────────────────────────────────────
   2. ESTADO LOCAL
─────────────────────────────────────────────── */
let postits       = [];
let selectedColor = '#FFEB3B';
let editingId     = null;
let searchTerm    = '';
let typingTimer   = null;

// myReactions: { "postitId:emoji": true }
// Guarda quais emojis ESTE usuário já clicou (toggle local)
const myReactions = {};


/* ───────────────────────────────────────────────
   3. EVENTOS RECEBIDOS DO SERVIDOR
─────────────────────────────────────────────── */

socket.on('initial_postits', (data) => {
  postits = data;
  renderBoard();
});

socket.on('postit_added', (postit) => {
  postits.push(postit);
  renderBoard();
  // Confete ao receber novo post-it de qualquer usuário
  launchConfetti();
  showToast('📌 Novo post-it colado!', 'success');
});

socket.on('postit_removed', (id) => {
  postits = postits.filter(p => p.id !== id);
  renderBoard();
});

socket.on('postit_edited', (updated) => {
  const idx = postits.findIndex(p => p.id === updated.id);
  if (idx !== -1) postits[idx] = updated;
  renderBoard();
});

// Reação recebida: atualiza só os chips do post-it afetado
socket.on('postit_reacted', ({ id, reacoes }) => {
  const idx = postits.findIndex(p => p.id === id);
  if (idx !== -1) postits[idx].reacoes = reacoes;
  updateReactionButtons(id, reacoes);
});

socket.on('postit_moved', ({ id, x, y }) => {
  const p = postits.find(p => p.id === id);
  if (p) { p.x = x; p.y = y; }
  const el = board.querySelector(`[data-id="${id}"]`);
  if (el) { el.style.left = x + 'px'; el.style.top = y + 'px'; }
});

socket.on('postit_rejected', (motivo) => {
  showToast(motivo || 'Post-it não permitido.', 'error');
});

socket.on('online_count', (count) => {
  onlineCount.textContent = count;
});

// Indicador de digitação: outro usuário está escrevendo
socket.on('user_typing', (nickname) => {
  const name = nickname || 'Alguém';
  typingText.textContent = `${name} está escrevendo...`;
  typingIndicator.classList.add('visible');
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    typingIndicator.classList.remove('visible');
  }, 3000);
});


/* ───────────────────────────────────────────────
   4. RENDERIZAÇÃO
─────────────────────────────────────────────── */

function renderBoard() {
  board.querySelectorAll('.post-it').forEach(el => el.remove());

  updatePostitCount();

  if (postits.length === 0) {
    emptyMsg.style.display = 'flex';
    if (noResultsMsg) noResultsMsg.classList.remove('visible');
    return;
  }
  emptyMsg.style.display = 'none';

  postits.forEach(p => board.appendChild(createPostItElement(p)));

  // Aplica filtro de busca se houver termo
  if (searchTerm) applySearchFilter();
}

function createPostItElement(postit) {
  const div = document.createElement('div');
  div.className = 'post-it';
  div.setAttribute('data-id', postit.id);
  div.style.backgroundColor = postit.cor;

  // Rotação determinística baseada no id
  const seed = postit.id.charCodeAt(0) + postit.id.charCodeAt(1);
  div.style.setProperty('--rotation', ((seed % 7) - 3) * 0.8 + 'deg');

  if (postit.x != null && postit.y != null) {
    div.style.left = postit.x + 'px';
    div.style.top  = postit.y + 'px';
  } else {
    // Auto-place in a grid-like pattern with slight randomness
    const idx = postits.findIndex(p => p.id === postit.id);
    const col = idx % 5;
    const row = Math.floor(idx / 5);
    div.style.left = (32 + col * 248 + (Math.random() * 16 - 8)) + 'px';
    div.style.top  = (36 + row * 220 + (Math.random() * 16 - 8)) + 'px';
  }

  // Nome do autor
  if (postit.nickname) {
    const nick = document.createElement('div');
    nick.className = 'post-it-nick';
    nick.textContent = postit.nickname;
    div.appendChild(nick);
  }

  // Texto
  const text = document.createElement('div');
  text.className = 'post-it-text';
  text.textContent = postit.texto;
  div.appendChild(text);

  // ── Ações (editar, remover) ──
  const actions = document.createElement('div');
  actions.className = 'post-it-actions';

  const editBtnEl = document.createElement('button');
  editBtnEl.className = 'action-btn edit';
  editBtnEl.textContent = '✏️';
  editBtnEl.title = 'Editar';
  editBtnEl.addEventListener('click', (e) => {
    e.stopPropagation();
    openModal(postit);
  });
  actions.appendChild(editBtnEl);

  const deleteBtnEl = document.createElement('button');
  deleteBtnEl.className = 'action-btn delete';
  deleteBtnEl.textContent = '🗑️';
  deleteBtnEl.title = 'Remover';
  deleteBtnEl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm('Remover este post-it?')) {
      socket.emit('delete_postit', postit.id);
    }
  });
  actions.appendChild(deleteBtnEl);
  div.appendChild(actions);

  // ── Rodapé: reações + timestamp ──
  const footer = document.createElement('div');
  footer.className = 'post-it-footer';

  // Linha de reações
  const reactionRow = document.createElement('div');
  reactionRow.className = 'post-it-footer-row';
  reactionRow.setAttribute('data-reactions-for', postit.id);
  buildReactionButtons(reactionRow, postit);
  footer.appendChild(reactionRow);

  // Timestamp
  if (postit.timestamp) {
    const timeEl = document.createElement('div');
    timeEl.className = 'post-it-time';
    timeEl.textContent = formatTimestamp(postit.timestamp);
    footer.appendChild(timeEl);
  }

  div.appendChild(footer);

  enableDrag(div, postit.id);
  return div;
}

function updatePostitCount() {
  if (postitCountEl) {
    postitCountEl.textContent = postits.length === 0
      ? ''
      : `${postits.length} post-it${postits.length !== 1 ? 's' : ''}`;
  }
}

function formatTimestamp(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'agora mesmo';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}


/* ───────────────────────────────────────────────
   5. SISTEMA DE REAÇÕES INTELIGENTE
─────────────────────────────────────────────── */

// Categorias de emojis para o picker
const EMOJI_CATEGORIES = {
  '😊': ['👍','❤️','😄','😂','😮','😢','🥹','😍'],
  '🔥': ['🔥','🎉','✨','💯','🙌','👏','🚀','⭐'],
  '🎭': ['😎','🤔','🤯','😤','🥳','🤩','😅','🫡'],
  '🌿': ['🌸','🍀','🌈','🦋','🌙','💫','🎯','💎'],
};

// Retorna todos os emojis em lista plana
const ALL_EMOJIS = Object.values(EMOJI_CATEGORIES).flat();

// Encontra o emoji com mais reações (para destacar)
function getTopEmoji(reacoes) {
  if (!reacoes) return null;
  let top = null; let max = 0;
  Object.entries(reacoes).forEach(([emoji, count]) => {
    if (count > max) { max = count; top = emoji; }
  });
  return max >= 2 ? top : null; // só destaca com 2+
}

// Conta total de reações
function getTotalReactions(reacoes) {
  if (!reacoes) return 0;
  return Object.values(reacoes).reduce((a, b) => a + b, 0);
}

// Constrói os chips de reação estilo WhatsApp — empilham abaixo do post-it
function buildReactionButtons(container, postit) {
  container.innerHTML = '';

  const reacoes = postit.reacoes || {};

  // Wrapper para chips existentes
  const given = document.createElement('div');
  given.className = 'reactions-given';

  // Ordena: mais reações primeiro
  const sorted = Object.entries(reacoes)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a);

  sorted.forEach(([emoji, count]) => {
    const reactionKey = `${postit.id}:${emoji}`;
    const jaReagiu    = !!myReactions[reactionKey];

    const chip = document.createElement('button');
    chip.className = 'reaction-chip' + (jaReagiu ? ' reacted' : '');
    chip.setAttribute('data-emoji', emoji);
    chip.title = jaReagiu ? 'Remover reação' : `Reagir com ${emoji}`;

    const emojiSpan = document.createElement('span');
    emojiSpan.className = 'chip-emoji';
    emojiSpan.textContent = emoji;

    const countSpan = document.createElement('span');
    countSpan.className = 'chip-count';
    countSpan.textContent = count;

    chip.appendChild(emojiSpan);
    chip.appendChild(countSpan);

    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      handleReactionClick(postit.id, emoji, chip, countSpan);
    });

    given.appendChild(chip);
  });

  container.appendChild(given);

  // Botão "😊" para abrir picker
  const addReactBtn = document.createElement('button');
  addReactBtn.className = 'reaction-add-btn';
  addReactBtn.textContent = '😊';
  addReactBtn.title = 'Adicionar reação';
  addReactBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openEmojiPicker(postit, addReactBtn, container);
  });
  container.appendChild(addReactBtn);
}

// Lida com clique num chip (toggle: reagir ou remover)
function handleReactionClick(id, emoji, chip, countSpan) {
  const reactionKey = `${id}:${emoji}`;

  // Toggle local imediato (otimismo)
  const jaReagiu = !!myReactions[reactionKey];
  myReactions[reactionKey] = !jaReagiu;
  chip.classList.toggle('reacted', !jaReagiu);

  // Anima o emoji
  chip.querySelector('.chip-emoji').style.animation = 'none';
  requestAnimationFrame(() => {
    chip.querySelector('.chip-emoji').style.animation = '';
    chip.querySelector('.chip-emoji').classList.add('emojiPop');
  });

  // Anima o contador
  countSpan.classList.remove('bump');
  requestAnimationFrame(() => countSpan.classList.add('bump'));

  socket.emit('react_postit', { id, emoji });

  if (!jaReagiu) {
    animateReaction(id, emoji);
  }
}

// Abre o picker de emojis com abas de categoria
function openEmojiPicker(postit, anchor, container) {
  // Fecha qualquer picker aberto
  document.querySelectorAll('.emoji-picker').forEach(p => p.remove());

  const picker = document.createElement('div');
  picker.className = 'emoji-picker';

  // Abas
  const tabs = document.createElement('div');
  tabs.className = 'emoji-picker-tabs';

  const grid = document.createElement('div');
  grid.className = 'emoji-grid';

  let activeCategory = Object.keys(EMOJI_CATEGORIES)[0];

  function renderGrid(category) {
    grid.innerHTML = '';
    EMOJI_CATEGORIES[category].forEach(emoji => {
      const btn = document.createElement('button');
      btn.className = 'emoji-option';
      btn.textContent = emoji;

      // Marca emojis já usados por este usuário neste post-it
      const rk = `${postit.id}:${emoji}`;
      if (myReactions[rk]) btn.classList.add('already-reacted');

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const reactionKey = `${postit.id}:${emoji}`;
        myReactions[reactionKey] = !myReactions[reactionKey];
        socket.emit('react_postit', { id: postit.id, emoji });
        if (myReactions[reactionKey]) animateReaction(postit.id, emoji);
        picker.remove();
      });
      grid.appendChild(btn);
    });
  }

  Object.keys(EMOJI_CATEGORIES).forEach(catEmoji => {
    const tab = document.createElement('button');
    tab.className = 'emoji-tab' + (catEmoji === activeCategory ? ' active' : '');
    tab.textContent = catEmoji;
    tab.title = 'Categoria';
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      activeCategory = catEmoji;
      tabs.querySelectorAll('.emoji-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderGrid(catEmoji);
    });
    tabs.appendChild(tab);
  });

  renderGrid(activeCategory);

  // Footer: total de reações no post-it
  const total = getTotalReactions(postit.reacoes);
  const footer = document.createElement('div');
  footer.className = 'emoji-picker-footer';
  footer.textContent = total > 0
    ? `${total} reação${total !== 1 ? 'ões' : ''} no total`
    : 'Seja o primeiro a reagir!';

  picker.appendChild(tabs);
  picker.appendChild(grid);
  picker.appendChild(footer);

  // Posiciona o picker relativo ao container
  container.style.position = 'relative';
  container.appendChild(picker);

  // Fecha ao clicar fora
  setTimeout(() => {
    document.addEventListener('click', () => picker.remove(), { once: true });
  }, 0);
}

// Animação de emoji voando para cima
function animateReaction(id, emoji) {
  const postitEl = board.querySelector(`[data-id="${id}"]`);
  if (!postitEl) return;

  const flyer = document.createElement('div');
  flyer.className = 'reaction-flyer';
  flyer.textContent = emoji;
  // Varia a posição horizontal levemente para múltiplos emojis
  flyer.style.left = (40 + Math.random() * 30) + '%';
  postitEl.appendChild(flyer);
  setTimeout(() => flyer.remove(), 900);
}

// Atualiza apenas os chips de um post-it sem re-renderizar tudo
function updateReactionButtons(id, reacoes) {
  const container = board.querySelector(`[data-reactions-for="${id}"]`);
  if (!container) return;
  const postit = postits.find(p => p.id === id);
  if (!postit) return;
  postit.reacoes = reacoes;
  buildReactionButtons(container, postit);
}


/* ───────────────────────────────────────────────
   6. BUSCA NO MURAL
─────────────────────────────────────────────── */

if (searchInput) {
  searchInput.addEventListener('input', () => {
    searchTerm = searchInput.value.trim().toLowerCase();
    applySearchFilter();
  });
}

function applySearchFilter() {
  const postitEls = board.querySelectorAll('.post-it');
  let visibleCount = 0;

  postitEls.forEach(el => {
    const id = el.getAttribute('data-id');
    const p  = postits.find(pt => pt.id === id);
    if (!p) return;

    const match = !searchTerm
      || p.texto.toLowerCase().includes(searchTerm)
      || (p.nickname && p.nickname.toLowerCase().includes(searchTerm));

    el.classList.toggle('search-hidden', !match);
    if (match) visibleCount++;
  });

  if (noResultsMsg) {
    const shouldShow = searchTerm && visibleCount === 0;
    noResultsMsg.classList.toggle('visible', shouldShow);
  }
}


/* ───────────────────────────────────────────────
   7. MODAL — ABRIR, FECHAR, PALETA, PREVIEW
─────────────────────────────────────────────── */

function openModal(postit = null) {
  editingId = postit ? postit.id : null;

  modalTitle.textContent = postit ? 'Editar post-it' : 'Novo post-it';
  submitBtn.textContent  = postit ? 'Salvar alterações' : 'Colar no mural';

  textInput.value       = postit ? postit.texto    : '';
  nicknameInput.value   = postit
    ? (postit.nickname || '')
    : (localStorage.getItem('muraly_nickname') || '');
  charCount.textContent = textInput.value.length;

  const cor = (postit && postit.cor) ? postit.cor : '#FFEB3B';
  selectedColor = cor;

  // Normalise to lowercase for comparison
  const corNorm = cor.toLowerCase();
  let swatchMatched = false;
  colorSwatches.forEach(s => {
    const match = s.dataset.color.toLowerCase() === corNorm;
    s.classList.toggle('selected', match);
    if (match) swatchMatched = true;
  });

  // Always update the color picker value
  try { colorCustom.value = cor; } catch(e) {}

  updatePreview();
  modal.classList.remove('hidden');
  // Small delay so animation doesn't fight focus
  setTimeout(() => textInput.focus(), 80);
}

function closeModal() {
  modal.classList.add('hidden');
  editingId = null;
}

// Preview em tempo real dentro do modal
function updatePreview() {
  if (!postitPreview) return;
  postitPreview.style.background = selectedColor;
  postitPreview.textContent = textInput.value || 'Seu texto aparece aqui...';
  postitPreview.style.color = textInput.value
    ? 'rgba(0,0,0,0.78)'
    : 'rgba(0,0,0,0.30)';
}

// Eventos do modal
addBtn.addEventListener('click', () => openModal());
closeModalBtn.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);

colorSwatches.forEach(swatch => {
  swatch.addEventListener('click', () => {
    colorSwatches.forEach(s => s.classList.remove('selected'));
    swatch.classList.add('selected');
    selectedColor = swatch.dataset.color;
    colorCustom.value = selectedColor;
    updatePreview();
  });
});

colorCustom.addEventListener('input', () => {
  selectedColor = colorCustom.value;
  colorSwatches.forEach(s => s.classList.remove('selected'));
  updatePreview();
});

textInput.addEventListener('input', () => {
  const len = textInput.value.length;
  charCount.textContent = len;

  // Cor do contador conforme limite
  const countEl = charCount.parentElement;
  countEl.classList.toggle('near-limit', len > 160 && len <= 195);
  countEl.classList.toggle('at-limit',   len > 195);

  updatePreview();

  // Emite evento de digitação para outros usuários
  const nick = nicknameInput.value.trim() || null;
  socket.emit('typing', nick);
});


/* ───────────────────────────────────────────────
   8. ENVIO DO FORMULÁRIO
─────────────────────────────────────────────── */
submitBtn.addEventListener('click', () => {
  const texto    = textInput.value.trim();
  const nickname = nicknameInput.value.trim() || null;
  const cor      = selectedColor;

  if (!texto) {
    textInput.focus();
    textInput.style.borderColor = '#E63946';
    textInput.style.boxShadow   = '0 0 0 3px rgba(230,57,70,0.15)';
    setTimeout(() => {
      textInput.style.borderColor = '';
      textInput.style.boxShadow   = '';
    }, 1800);
    showToast('Escreva uma mensagem antes de colar!', 'error');
    return;
  }

  if (texto.length > 200) return;

  if (nickname) localStorage.setItem('muraly_nickname', nickname);

  if (editingId) {
    const existing = postits.find(p => p.id === editingId);
    socket.emit('edit_postit', {
      id: editingId,
      texto,
      nickname,
      cor,
      x: existing ? existing.x : undefined,
      y: existing ? existing.y : undefined
    });
  } else {
    socket.emit('new_postit', { texto, nickname, cor });
  }

  closeModal();
});

// Enter (sem Shift) submete
textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submitBtn.click();
  }
});


/* ───────────────────────────────────────────────
   9. FUNÇÕES AUXILIARES
─────────────────────────────────────────────── */

// Toast com ícone conforme tipo
const TOAST_ICONS = { error: '❌', success: '✅', info: 'ℹ️' };

function showToast(msg, tipo = 'success') {
  const icon = toastEl.querySelector('.toast-icon');
  const text = toastEl.querySelector('.toast-text');

  if (icon) icon.textContent = TOAST_ICONS[tipo] || '';
  if (text) text.textContent = msg;
  else toastEl.textContent = msg;

  toastEl.className = `toast ${tipo}`;
  clearTimeout(toastEl._timer);
  toastEl._timer = setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 3500);
}

// Confete: lança partículas coloridas a partir de um ponto
function launchConfetti() {
  const colors = ['#E63946','#FFEB3B','#80D8FF','#CCFF90','#FFD180','#EA80FC','#FF8A80'];
  const count  = 28;
  const origin = { x: window.innerWidth / 2, y: 80 };

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-particle';

    const color = colors[Math.floor(Math.random() * colors.length)];
    const angle = (Math.random() * 360) * (Math.PI / 180);
    const dist  = 80 + Math.random() * 180;
    const tx    = Math.cos(angle) * dist;
    const ty    = 60 + Math.random() * 220;
    const rot   = Math.round(Math.random() * 720 - 360) + 'deg';
    const dur   = (0.8 + Math.random() * 0.6).toFixed(2) + 's';

    el.style.cssText = `
      left: ${origin.x + (Math.random() * 80 - 40)}px;
      top:  ${origin.y}px;
      background: ${color};
      --tx: ${tx}px;
      --ty: ${ty}px;
      --r:  ${rot};
      --duration: ${dur};
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }
}

// Exportar PNG
exportBtn.addEventListener('click', async () => {
  showToast('Gerando imagem...', 'info');
  try {
    const canvas = await html2canvas(board, {
      backgroundColor: '#EDE8DC',
      scale: 2,
      useCORS: true
    });
    const link    = document.createElement('a');
    link.download = 'muraly.png';
    link.href     = canvas.toDataURL('image/png');
    link.click();
    showToast('Imagem salva!', 'success');
  } catch {
    showToast('Erro ao gerar imagem.', 'error');
  }
});

// Modo apresentação
presentBtn.addEventListener('click', () => {
  document.body.classList.add('presentation-mode');
  exitPresentBtn.classList.remove('hidden');
});

exitPresentBtn.addEventListener('click', () => {
  document.body.classList.remove('presentation-mode');
  exitPresentBtn.classList.add('hidden');
});


/* ───────────────────────────────────────────────
   10. DRAG & DROP
─────────────────────────────────────────────── */
function enableDrag(el, id) {
  let isDragging = false;
  let offsetX, offsetY;

  el.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'TEXTAREA') return;
    isDragging = true;
    const rect = el.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    el.style.position = 'absolute';
    el.style.zIndex   = 999;
    el.style.transition = 'none'; // desativa transição durante drag
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    el.style.left = (e.clientX - offsetX) + 'px';
    el.style.top  = (e.clientY - offsetY) + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    el.style.transition = '';
    el.style.zIndex = '';
    document.body.style.userSelect = '';
    socket.emit('move_postit', {
      id,
      x: parseInt(el.style.left),
      y: parseInt(el.style.top)
    });
  });
}


/* ───────────────────────────────────────────────
   11. INICIALIZAÇÃO
─────────────────────────────────────────────── */

// Escape: fecha modal ou sai do modo apresentação
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!modal.classList.contains('hidden')) {
      closeModal();
    } else if (document.body.classList.contains('presentation-mode')) {
      exitPresentBtn.click();
    }
  }
});

// Fechar qualquer picker ao clicar no board
board.addEventListener('click', () => {
  document.querySelectorAll('.emoji-picker').forEach(p => p.remove());
});
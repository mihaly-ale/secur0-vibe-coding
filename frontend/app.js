/**
 * app.js — Notes Manager Frontend
 * Handles API calls, rendering, authentication flow
 */

'use strict';

// ─── Config ──────────────────────────────────────────────────────────────────

const API = '/api';

const NOTE_COLORS = [
  { hex: '#ffffff', label: 'Blanco' },
  { hex: '#fef3c7', label: 'Ámbar' },
  { hex: '#fee2e2', label: 'Rosa' },
  { hex: '#dbeafe', label: 'Azul' },
  { hex: '#d1fae5', label: 'Verde' },
  { hex: '#ede9fe', label: 'Violeta' },
  { hex: '#fce7f3', label: 'Rosa claro' },
  { hex: '#f3f4f6', label: 'Gris' },
  { hex: '#fef9c3', label: 'Amarillo' },
  { hex: '#ecfccb', label: 'Lima' },
];

// ─── State ───────────────────────────────────────────────────────────────────

const state = {
  token: localStorage.getItem('nm_token') || null,
  user: null,
  notes: [],
  searchQuery: '',
  showArchived: false,
  editingNote: null,
  searchTimeout: null,
};

// ─── HTTP Client ─────────────────────────────────────────────────────────────

async function http(method, path, body = null, auth = true) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (auth && state.token) opts.headers['Authorization'] = `Bearer ${state.token}`;
  if (body) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(`${API}${path}`, opts);
  } catch (err) {
    throw new Error('No se pudo conectar con el servidor. Verifica tu conexión.');
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Respuesta inválida del servidor.');
  }

  if (res.status === 401 && auth) {
    // Token expired or invalid
    if (data.code === 'TOKEN_EXPIRED' || !state.user) {
      logout(true);
    }
  }

  if (!data.success) {
    const msg = data.details
      ? data.details.map((d) => d.message).join('. ')
      : data.error;
    throw new Error(msg || 'Error desconocido.');
  }

  return data;
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function toast(message, type = 'info') {
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const container = document.getElementById('toast-container');

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span>${escapeHtml(message)}</span>
  `;
  container.appendChild(el);

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    el.style.transition = 'all 0.3s ease';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function escapeHtml(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(text)));
  return div.innerHTML;
}

function formatDate(dateStr) {
  const date = new Date(dateStr + (dateStr.endsWith('Z') ? '' : 'Z'));
  const now = new Date();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora mismo';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Ayer';
  if (days < 7) return `hace ${days} días`;
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function initials(name) {
  return (name || '?').slice(0, 2).toUpperCase();
}

function setLoading(show) {
  document.getElementById('loading-overlay').classList.toggle('hidden', !show);
}

// ─── Auth Screen ─────────────────────────────────────────────────────────────

function showAuth() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('hidden');
}

function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
}

// Tab switching
document.querySelectorAll('.auth-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    document.getElementById('login-form').classList.toggle('hidden', target !== 'login');
    document.getElementById('register-form').classList.toggle('hidden', target !== 'register');
    clearFormErrors();
  });
});

function clearFormErrors() {
  document.querySelectorAll('.form-error').forEach((el) => el.classList.remove('visible'));
  document.querySelectorAll('.form-input').forEach((el) => el.classList.remove('error'));
}

function showFieldError(fieldId, msg) {
  const input = document.getElementById(fieldId);
  const error = document.getElementById(`${fieldId}-error`);
  if (input) input.classList.add('error');
  if (error) { error.textContent = msg; error.classList.add('visible'); }
}

function hideFieldError(fieldId) {
  const input = document.getElementById(fieldId);
  const error = document.getElementById(`${fieldId}-error`);
  if (input) input.classList.remove('error');
  if (error) { error.textContent = ''; error.classList.remove('visible'); }
}

function setupPasswordRevealButtons() {
  document.querySelectorAll('.toggle-password').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      const isPassword = target.type === 'password';
      target.type = isPassword ? 'text' : 'password';
      btn.textContent = isPassword ? '🙈' : '👁';
      btn.setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  });
}

function setupPasswordMatchWatcher() {
  const regPassword = document.getElementById('reg-password');
  const regConfirm = document.getElementById('reg-confirm');
  const regMismatch = () => {
    if (!regPassword || !regConfirm) return;
    if (!regConfirm.value) {
      hideFieldError('reg-confirm');
      return;
    }
    if (regPassword.value !== regConfirm.value) {
      showFieldError('reg-confirm', 'Las contraseñas no coinciden.');
    } else {
      hideFieldError('reg-confirm');
    }
  };
  regPassword?.addEventListener('input', regMismatch);
  regConfirm?.addEventListener('input', regMismatch);

  const newPassword = document.getElementById('new-password');
  const confirmPassword = document.getElementById('confirm-password');
  const changeMismatch = () => {
    if (!newPassword || !confirmPassword) return;
    if (!confirmPassword.value) {
      hideFieldError('confirm-password');
      return;
    }
    if (newPassword.value !== confirmPassword.value) {
      showFieldError('confirm-password', 'Las contraseñas no coinciden.');
    } else {
      hideFieldError('confirm-password');
    }
  };
  newPassword?.addEventListener('input', changeMismatch);
  confirmPassword?.addEventListener('input', changeMismatch);
}

setupPasswordRevealButtons();
setupPasswordMatchWatcher();

// Login
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearFormErrors();
  const btn = e.target.querySelector('[type="submit"]');

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email) return showFieldError('login-email', 'El email es requerido.');
  if (!password) return showFieldError('login-password', 'La contraseña es requerida.');

  btn.disabled = true;
  btn.classList.add('btn-loading');

  try {
    const data = await http('POST', '/auth/login', { email, password }, false);
    state.token = data.data.token;
    state.user = data.data.user;
    localStorage.setItem('nm_token', state.token);
    await loadApp();
  } catch (err) {
    toast(err.message, 'error');
    showFieldError('login-email', ' ');
    showFieldError('login-password', err.message);
  } finally {
    btn.disabled = false;
    btn.classList.remove('btn-loading');
  }
});

// Register
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearFormErrors();
  const btn = e.target.querySelector('[type="submit"]');

  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-confirm').value;

  let valid = true;
  if (!username) { showFieldError('reg-username', 'El usuario es requerido.'); valid = false; }
  if (!email) { showFieldError('reg-email', 'El email es requerido.'); valid = false; }
  if (password.length < 8) { showFieldError('reg-password', 'Mínimo 8 caracteres.'); valid = false; }
  if (password !== confirm) { showFieldError('reg-confirm', 'Las contraseñas no coinciden.'); valid = false; }
  if (!valid) return;

  btn.disabled = true;
  btn.classList.add('btn-loading');

  try {
    const data = await http('POST', '/auth/register', { username, email, password }, false);
    state.token = data.data.token;
    state.user = data.data.user;
    localStorage.setItem('nm_token', state.token);
    toast('¡Bienvenido! Tu cuenta ha sido creada.', 'success');
    await loadApp();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.classList.remove('btn-loading');
  }
});

// ─── App Init ────────────────────────────────────────────────────────────────

async function loadApp() {
  setLoading(true);
  try {
    const data = await http('GET', '/auth/me');
    state.user = data.data.user;
    updateUserUI(data.data.user, data.data.stats);
    showApp();
    await loadNotes();
  } catch (err) {
    toast(err.message, 'error');
    logout(true);
  } finally {
    setLoading(false);
  }
}

function updateUserUI(user, stats) {
  document.getElementById('user-avatar').textContent = initials(user.username);
  document.getElementById('user-name').textContent = user.username;
  document.getElementById('user-email').textContent = user.email;
  if (stats) updateNavCounts(stats);
}

function updateNavCounts(stats) {
  document.getElementById('count-all').textContent = stats.active || 0;
  document.getElementById('count-pinned').textContent = stats.pinned || 0;
  document.getElementById('count-archived').textContent = stats.archived || 0;
}

function logout(silent = false) {
  state.token = null;
  state.user = null;
  state.notes = [];
  localStorage.removeItem('nm_token');
  showAuth();
  if (!silent) toast('Sesión cerrada correctamente.', 'info');
}

// ─── Notes Loading ────────────────────────────────────────────────────────────

async function loadNotes() {
  try {
    const params = new URLSearchParams();
    if (state.searchQuery) params.set('q', state.searchQuery);
    if (state.showArchived) params.set('archived', 'true');

    const data = await http('GET', `/notes?${params}`);
    state.notes = data.data.notes;
    renderNotes();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ─── Render Notes ─────────────────────────────────────────────────────────────

function renderNotes() {
  const grid = document.getElementById('notes-grid');
  const empty = document.getElementById('empty-state');

  if (state.notes.length === 0) {
    grid.classList.add('hidden');
    empty.classList.remove('hidden');

    const searchActive = state.searchQuery.trim();
    document.getElementById('empty-icon').textContent = searchActive ? '🔍' : (state.showArchived ? '📦' : '📒');
    document.getElementById('empty-title').textContent = searchActive
      ? 'Sin resultados'
      : state.showArchived ? 'Archivo vacío' : 'Sin notas';
    document.getElementById('empty-sub').textContent = searchActive
      ? `No encontramos notas para "${state.searchQuery}"`
      : state.showArchived ? 'Las notas archivadas aparecerán aquí.' : 'Crea tu primera nota pulsando el botón +';
    return;
  }

  grid.classList.remove('hidden');
  empty.classList.add('hidden');

  grid.innerHTML = state.notes.map(renderNoteCard).join('');

  // Attach events
  grid.querySelectorAll('.note-card').forEach((card) => {
    const id = parseInt(card.dataset.id);

    card.addEventListener('click', (e) => {
      if (e.target.closest('.note-card-actions')) return;
      openNoteModal(state.notes.find((n) => n.id === id));
    });

    card.querySelector('.btn-pin').addEventListener('click', (e) => {
      e.stopPropagation();
      togglePin(id);
    });

    card.querySelector('.btn-archive').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleArchive(id);
    });

    card.querySelector('.btn-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      confirmDeleteNote(id);
    });
  });
}

function renderNoteCard(note) {
  const colorStyle = note.color && note.color !== '#ffffff'
    ? `background:${note.color}10; border-top-color:${note.color};`
    : '';
  const archiveBtnLabel = state.showArchived ? '↩' : '📦';
  const archiveBtnTitle = state.showArchived ? 'Restaurar' : 'Archivar';

  return `
    <div class="note-card ${note.pinned ? 'pinned' : ''}" data-id="${note.id}" style="${colorStyle}">
      <span class="note-pin-badge" title="Fijada">📌</span>
      <div class="note-card-actions">
        <button class="note-action-btn btn-pin ${note.pinned ? 'active' : ''}" title="${note.pinned ? 'Desfijar' : 'Fijar'}">📌</button>
        <button class="note-action-btn btn-archive" title="${archiveBtnTitle}">${archiveBtnLabel}</button>
        <button class="note-action-btn btn-delete delete" title="Eliminar">🗑</button>
      </div>
      <div class="note-title">${escapeHtml(note.title)}</div>
      ${note.content ? `<div class="note-content-preview">${escapeHtml(note.content)}</div>` : ''}
      <div class="note-footer">
        <span class="note-date">${formatDate(note.updated_at)}</span>
        ${note.color && note.color !== '#ffffff' ? `<div class="note-color-dot" style="background:${note.color}"></div>` : ''}
      </div>
    </div>
  `;
}

// ─── CRUD Operations ─────────────────────────────────────────────────────────

async function togglePin(id) {
  try {
    await http('PATCH', `/notes/${id}/pin`);
    await loadNotes();
    // Refresh stats
    const meData = await http('GET', '/auth/me');
    updateNavCounts(meData.data.stats);
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function toggleArchive(id) {
  try {
    const data = await http('PATCH', `/notes/${id}/archive`);
    toast(data.message, 'success');
    await loadNotes();
    const meData = await http('GET', '/auth/me');
    updateNavCounts(meData.data.stats);
  } catch (err) {
    toast(err.message, 'error');
  }
}

function confirmDeleteNote(id) {
  showConfirmDialog(
    'Eliminar nota',
    '¿Estás seguro de que quieres eliminar esta nota? Esta acción no se puede deshacer.',
    async () => {
      try {
        await http('DELETE', `/notes/${id}`);
        toast('Nota eliminada.', 'success');
        state.notes = state.notes.filter((n) => n.id !== id);
        renderNotes();
        const meData = await http('GET', '/auth/me');
        updateNavCounts(meData.data.stats);
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  );
}

// ─── Note Modal ───────────────────────────────────────────────────────────────

let selectedColor = '#ffffff';

function openNoteModal(note = null) {
  state.editingNote = note;
  selectedColor = note ? (note.color || '#ffffff') : '#ffffff';

  document.getElementById('note-modal-title').textContent = note ? 'Editar nota' : 'Nueva nota';
  document.getElementById('note-title-input').value = note ? note.title : '';
  document.getElementById('note-content-input').value = note ? note.content : '';

  renderColorPicker(selectedColor);
  updateCharCounters();

  document.getElementById('note-modal').classList.remove('hidden');
  document.getElementById('note-title-input').focus();
}

function closeNoteModal() {
  document.getElementById('note-modal').classList.add('hidden');
  state.editingNote = null;
}

function renderColorPicker(selected) {
  const picker = document.getElementById('color-picker');
  picker.innerHTML = NOTE_COLORS.map((c) => `
    <div class="color-option ${c.hex === selected ? 'selected' : ''}"
         style="background:${c.hex}; border-color: ${c.hex === '#ffffff' ? '#ccc' : c.hex}"
         data-color="${c.hex}" title="${c.label}"></div>
  `).join('');

  picker.querySelectorAll('.color-option').forEach((opt) => {
    opt.addEventListener('click', () => {
      picker.querySelectorAll('.color-option').forEach((o) => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedColor = opt.dataset.color;
    });
  });
}

function updateCharCounters() {
  const title = document.getElementById('note-title-input').value.length;
  const content = document.getElementById('note-content-input').value.length;

  const tc = document.getElementById('title-counter');
  tc.textContent = `${title}/200`;
  tc.className = `char-counter${title > 180 ? ' warn' : ''}${title >= 200 ? ' error' : ''}`;

  const cc = document.getElementById('content-counter');
  cc.textContent = `${content}/50000`;
  cc.className = `char-counter${content > 45000 ? ' warn' : ''}${content >= 50000 ? ' error' : ''}`;
}

document.getElementById('note-title-input').addEventListener('input', () => {
  const val = document.getElementById('note-title-input').value;
  if (val.length > 200) document.getElementById('note-title-input').value = val.slice(0, 200);
  updateCharCounters();
});

document.getElementById('note-content-input').addEventListener('input', () => {
  const val = document.getElementById('note-content-input').value;
  if (val.length > 50000) document.getElementById('note-content-input').value = val.slice(0, 50000);
  updateCharCounters();
});

document.getElementById('save-note-btn').addEventListener('click', saveNote);

async function saveNote() {
  const title = document.getElementById('note-title-input').value.trim();
  const content = document.getElementById('note-content-input').value;
  const btn = document.getElementById('save-note-btn');

  if (!title) {
    document.getElementById('note-title-input').focus();
    document.getElementById('note-title-input').style.border = '2px solid var(--danger)';
    setTimeout(() => document.getElementById('note-title-input').style.border = '', 2000);
    toast('El título es requerido.', 'error');
    return;
  }

  btn.disabled = true;
  btn.classList.add('btn-loading');

  try {
    if (state.editingNote) {
      await http('PUT', `/notes/${state.editingNote.id}`, { title, content, color: selectedColor });
      toast('Nota actualizada.', 'success');
    } else {
      await http('POST', '/notes', { title, content, color: selectedColor });
      toast('Nota creada.', 'success');
    }
    closeNoteModal();
    await loadNotes();
    const meData = await http('GET', '/auth/me');
    updateNavCounts(meData.data.stats);
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.classList.remove('btn-loading');
  }
}

// Close modal on overlay click
document.getElementById('note-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('note-modal')) closeNoteModal();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeNoteModal();
    closeSettingsModal();
    closeConfirmDialog();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    if (!document.getElementById('note-modal').classList.contains('hidden')) saveNote();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    openNoteModal();
  }
});

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

let confirmCallback = null;

function showConfirmDialog(title, text, onConfirm) {
  confirmCallback = onConfirm;
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-text').textContent = text;
  document.getElementById('confirm-modal').classList.remove('hidden');
}

function closeConfirmDialog() {
  document.getElementById('confirm-modal').classList.add('hidden');
  confirmCallback = null;
}

document.getElementById('confirm-ok-btn').addEventListener('click', async () => {
  if (confirmCallback) {
    await confirmCallback();
  }
  closeConfirmDialog();
});

document.getElementById('confirm-cancel-btn').addEventListener('click', closeConfirmDialog);
document.getElementById('confirm-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('confirm-modal')) closeConfirmDialog();
});

// ─── Settings Modal ───────────────────────────────────────────────────────────

async function openSettingsModal() {
  document.getElementById('settings-modal').classList.remove('hidden');
  try {
    const data = await http('GET', '/auth/me');
    const { user, stats } = data.data;
    document.getElementById('settings-username').textContent = user.username;
    document.getElementById('settings-email').textContent = user.email;
    document.getElementById('settings-created').textContent = new Date(user.created_at).toLocaleDateString('es-ES', { dateStyle: 'long' });
    document.getElementById('stat-total').textContent = stats.total || 0;
    document.getElementById('stat-active').textContent = stats.active || 0;
    document.getElementById('stat-pinned').textContent = stats.pinned || 0;
    document.getElementById('stat-archived').textContent = stats.archived || 0;
  } catch (err) {
    toast(err.message, 'error');
  }
}

function closeSettingsModal() {
  document.getElementById('settings-modal').classList.add('hidden');
}

document.getElementById('settings-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('settings-modal')) closeSettingsModal();
});

// Change password
document.getElementById('change-password-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('[type="submit"]');
  const current = document.getElementById('current-password').value;
  const newPass = document.getElementById('new-password').value;
  const confirm = document.getElementById('confirm-password').value;

  clearFormErrors();
  if (!current) {
    showFieldError('current-password', 'La contraseña actual es requerida.');
    return;
  }
  if (newPass.length < 8) {
    showFieldError('new-password', 'La nueva contraseña debe tener al menos 8 caracteres.');
    return;
  }
  if (newPass !== confirm) {
    showFieldError('confirm-password', 'Las contraseñas no coinciden.');
    return;
  }

  btn.disabled = true;
  btn.classList.add('btn-loading');
  try {
    const data = await http('PUT', '/auth/change-password', { currentPassword: current, newPassword: newPass });
    toast(data.message, 'success');
    e.target.reset();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.classList.remove('btn-loading');
  }
});

// Delete account
document.getElementById('delete-account-btn').addEventListener('click', () => {
  const password = prompt('Para eliminar tu cuenta, confirma tu contraseña:');
  if (!password) return;

  showConfirmDialog(
    'Eliminar cuenta',
    '¿Estás seguro? Se eliminarán permanentemente tu cuenta y todas tus notas. Esta acción es irreversible.',
    async () => {
      try {
        await http('DELETE', '/auth/account', { password });
        toast('Cuenta eliminada.', 'info');
        logout(true);
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  );
});

// ─── Navigation ───────────────────────────────────────────────────────────────

document.querySelectorAll('.nav-item[data-view]').forEach((item) => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item[data-view]').forEach((i) => i.classList.remove('active'));
    item.classList.add('active');

    const view = item.dataset.view;
    state.showArchived = view === 'archived';

    document.getElementById('topbar-title').textContent =
      view === 'all' ? 'Todas las notas' :
      view === 'pinned' ? 'Fijadas' : 'Archivo';

    // Show/hide new note button
    document.getElementById('new-note-btn').classList.toggle('hidden', view === 'archived');

    // For pinned, filter client-side
    if (view === 'pinned') {
      state.showArchived = false;
    }

    closeSidebar();
    loadNotes().then(() => {
      if (view === 'pinned') {
        state.notes = state.notes.filter((n) => n.pinned);
        renderNotes();
      }
    });
  });
});

// ─── Search ───────────────────────────────────────────────────────────────────

document.getElementById('search-input').addEventListener('input', (e) => {
  state.searchQuery = e.target.value;
  clearTimeout(state.searchTimeout);
  state.searchTimeout = setTimeout(loadNotes, 400);
});

// ─── Sidebar Mobile ───────────────────────────────────────────────────────────

function closeSidebar() {
  document.querySelector('.sidebar').classList.remove('open');
  document.querySelector('.sidebar-backdrop').classList.remove('visible');
}

document.querySelector('.menu-toggle')?.addEventListener('click', () => {
  document.querySelector('.sidebar').classList.toggle('open');
  document.querySelector('.sidebar-backdrop').classList.toggle('visible');
});

document.querySelector('.sidebar-backdrop')?.addEventListener('click', closeSidebar);

// ─── Event Bindings ───────────────────────────────────────────────────────────

document.getElementById('new-note-btn').addEventListener('click', () => openNoteModal());
document.getElementById('close-note-modal').addEventListener('click', closeNoteModal);
document.getElementById('close-settings-btn').addEventListener('click', closeSettingsModal);
document.getElementById('settings-btn').addEventListener('click', openSettingsModal);
document.getElementById('logout-btn').addEventListener('click', () => {
  showConfirmDialog(
    'Cerrar sesión',
    '¿Seguro que quieres cerrar sesión?',
    () => logout()
  );
});

// ─── Bootstrap ───────────────────────────────────────────────────────────────

async function bootstrap() {
  if (state.token) {
    try {
      await loadApp();
    } catch {
      showAuth();
    }
  } else {
    showAuth();
  }
  setLoading(false);
}

bootstrap();

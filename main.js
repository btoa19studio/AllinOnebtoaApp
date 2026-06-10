/* ============================================================
   main.js — All in One App
   Fitur: Auth, Profil, Sticky Notes, To Do, Perjalanan, Kalender
   Backend: Firebase Auth + Firestore
============================================================ */

'use strict';

// ── CONSTANTS ──────────────────────────────────────────────
const NOTE_COLORS = [
  { id: 'yellow', bg: '#fef9c3', label: 'Kuning' },
  { id: 'pink',   bg: '#fce7f3', label: 'Pink'   },
  { id: 'blue',   bg: '#dbeafe', label: 'Biru'   },
  { id: 'green',  bg: '#dcfce7', label: 'Hijau'  },
  { id: 'purple', bg: '#f3e8ff', label: 'Ungu'   },
  { id: 'orange', bg: '#ffedd5', label: 'Oranye' },
];

const AVATAR_COLORS = [
  '#4f8ef7','#22c55e','#f59e0b','#ef4444',
  '#8b5cf6','#06b6d4','#ec4899','#64748b',
];

const MONTHS_ID = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember'
];

// ── APP STATE ──────────────────────────────────────────────
let currentUser    = null;
let leafletMap     = null;
let mapMarkers     = [];
let pendingCoords  = null;
let selectedNoteId = null;
let selectedTodoId = null;
let selectedColor  = NOTE_COLORS[0].id;
let calendarDate   = new Date();
let selectedCalDay = null;

// Firestore data cache
let allNotes   = [];
let allTodos   = [];
let allJourney = [];

// Unsubscribe handles for real-time listeners
let unsubs = [];

// ── DOM HELPERS ────────────────────────────────────────────
const $  = id => document.getElementById(id);
const el = sel => document.querySelector(sel);

function setHtml(id, html) { $(id).innerHTML = html; }

function showToast(msg, type = '') {
  const t = $('toast');
  t.textContent = msg;
  t.className   = `toast ${type}`;
  t.classList.remove('hidden');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => t.classList.add('hidden'), 3000);
}

function openModal(id) { $(id).classList.remove('hidden'); }
function closeModal(id) { $(id).classList.add('hidden'); }

// ── INIT ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initIcons();
  initAuthUI();
  initNavigation();
  initSidebar();
  initModals();
  initProfile();
  initNotes();
  initTodos();
  initJourney();
  initCalendar();

  // Auth state listener
  auth.onAuthStateChanged(user => {
    if (user) {
      currentUser = user;
      onLogin(user);
    } else {
      currentUser = null;
      onLogout();
    }
  });
});

function initIcons() {
  // Lucide icons render after DOM is ready
  setTimeout(() => lucide.createIcons(), 100);
}

// ── AUTH ───────────────────────────────────────────────────
function initAuthUI() {
  // Toggle login / signup
  $('go-signup').onclick = () => { toggleAuthForm('signup'); };
  $('go-login').onclick  = () => { toggleAuthForm('login');  };

  // Login
  $('btn-login').onclick = async () => {
    const email = $('login-email').value.trim();
    const pass  = $('login-password').value;
    $('login-error').textContent = '';
    if (!email || !pass) { $('login-error').textContent = 'Isi email dan password.'; return; }
    try {
      $('btn-login').textContent = 'Masuk...';
      await auth.signInWithEmailAndPassword(email, pass);
    } catch (e) {
      $('login-error').textContent = friendlyAuthError(e.code);
      $('btn-login').innerHTML = '<span>Masuk</span>';
    }
  };

  // Signup
  $('btn-signup').onclick = async () => {
    const name  = $('signup-name').value.trim();
    const email = $('signup-email').value.trim();
    const pass  = $('signup-password').value;
    $('signup-error').textContent = '';
    if (!name || !email || !pass) { $('signup-error').textContent = 'Semua field wajib diisi.'; return; }
    if (pass.length < 6) { $('signup-error').textContent = 'Password minimal 6 karakter.'; return; }
    try {
      $('btn-signup').textContent = 'Mendaftar...';
      const cred = await auth.createUserWithEmailAndPassword(email, pass);
      await cred.user.updateProfile({ displayName: name });
      // Create user doc
      await db.collection('users').doc(cred.user.uid).set({
        name,
        email,
        bio: '',
        avatarColor: AVATAR_COLORS[0],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      $('signup-error').textContent = friendlyAuthError(e.code);
      $('btn-signup').innerHTML = '<span>Daftar</span>';
    }
  };

  // Logout
  $('btn-logout').onclick = () => auth.signOut();
}

function toggleAuthForm(which) {
  $('login-form').classList.toggle('active', which === 'login');
  $('signup-form').classList.toggle('active', which === 'signup');
}

function friendlyAuthError(code) {
  const map = {
    'auth/user-not-found':      'Email tidak terdaftar.',
    'auth/wrong-password':      'Password salah.',
    'auth/invalid-email':       'Format email tidak valid.',
    'auth/email-already-in-use':'Email sudah digunakan.',
    'auth/weak-password':       'Password terlalu lemah.',
    'auth/invalid-credential':  'Email atau password salah.',
    'auth/network-request-failed': 'Cek koneksi internet.',
  };
  return map[code] || 'Terjadi kesalahan. Coba lagi.';
}

// ── ON LOGIN / LOGOUT ──────────────────────────────────────
function onLogin(user) {
  $('auth-screen').style.display = 'none';
  $('app').classList.remove('hidden');

  loadUserProfile(user);
  startListeners(user.uid);
  navigateTo('dashboard');
  lucide.createIcons();
}

function onLogout() {
  $('auth-screen').style.display = '';
  $('app').classList.add('hidden');
  // Clear listeners
  unsubs.forEach(fn => fn());
  unsubs = [];
  allNotes = []; allTodos = []; allJourney = [];
  // Reset login form
  $('login-email').value = '';
  $('login-password').value = '';
  $('login-error').textContent = '';
  toggleAuthForm('login');
  $('btn-login').innerHTML = '<span>Masuk</span>';
}

// ── PROFILE ───────────────────────────────────────────────
function initProfile() {
  // Color swatches
  const swatchWrap = $('color-swatches');
  AVATAR_COLORS.forEach(hex => {
    const s = document.createElement('div');
    s.className = 'color-swatch';
    s.style.background = hex;
    s.dataset.color = hex;
    s.onclick = () => saveAvatarColor(hex);
    swatchWrap.appendChild(s);
  });

  $('btn-save-profile').onclick = saveProfile;
}

async function loadUserProfile(user) {
  const doc = await db.collection('users').doc(user.uid).get();
  const data = doc.exists ? doc.data() : {};
  const name  = data.name  || user.displayName || 'Pengguna';
  const email = user.email;
  const color = data.avatarColor || AVATAR_COLORS[0];

  // Sidebar
  $('sidebar-name').textContent  = name;
  $('sidebar-email').textContent = email;
  setAvatar('sidebar-avatar', name, color);
  setAvatar('topbar-avatar', name, color);

  // Profile form
  $('profile-name').value   = name;
  $('profile-email').value  = email;
  $('profile-bio').value    = data.bio || '';
  if (data.createdAt) {
    const d = data.createdAt.toDate();
    $('profile-joined').value = d.toLocaleDateString('id-ID', { year:'numeric', month:'long', day:'numeric' });
  }
  setAvatar('profile-avatar-display', name, color);

  // Highlight selected swatch
  document.querySelectorAll('.color-swatch').forEach(s => {
    s.classList.toggle('selected', s.dataset.color === color);
  });
}

async function saveProfile() {
  const name  = $('profile-name').value.trim();
  const bio   = $('profile-bio').value.trim();
  const msgEl = $('profile-msg');
  if (!name) { msgEl.textContent = 'Nama tidak boleh kosong.'; msgEl.className = 'form-msg error'; return; }
  try {
    await db.collection('users').doc(currentUser.uid).update({ name, bio });
    await currentUser.updateProfile({ displayName: name });
    msgEl.textContent = 'Profil berhasil disimpan!';
    msgEl.className   = 'form-msg success';
    loadUserProfile(currentUser);
    showToast('Profil diperbarui ✓', 'success');
    setTimeout(() => { msgEl.textContent = ''; }, 3000);
  } catch (e) {
    msgEl.textContent = 'Gagal menyimpan: ' + e.message;
    msgEl.className   = 'form-msg error';
  }
}

async function saveAvatarColor(hex) {
  await db.collection('users').doc(currentUser.uid).update({ avatarColor: hex });
  loadUserProfile(currentUser);
}

function setAvatar(elId, name, color) {
  const av = $(elId);
  if (!av) return;
  av.textContent  = name.charAt(0).toUpperCase();
  av.style.background = color;
}

// ── NAVIGATION ────────────────────────────────────────────
function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.onclick = () => {
      navigateTo(btn.dataset.page);
      closeSidebar();
    };
  });

  // Dashboard quick-nav cards
  document.querySelectorAll('.dash-card').forEach(card => {
    card.onclick = () => navigateTo(card.id.replace('dash-', ''));
  });
}

function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));

  const target = $(`page-${page}`);
  if (target) target.classList.add('active');

  const titles = {
    dashboard: 'Dashboard',
    profile:   'Profil Saya',
    notes:     'Sticky Notes',
    todos:     'To Do List',
    journey:   'Perjalanan Saya',
    calendar:  'Kalender',
  };
  $('page-title').textContent = titles[page] || page;

  // Lazy init map when journey tab opened
  if (page === 'journey' && !leafletMap) initLeafletMap();
  // Refresh calendar when opened
  if (page === 'calendar') renderCalendar();

  lucide.createIcons();
}

// ── SIDEBAR (mobile) ──────────────────────────────────────
function initSidebar() {
  // Create backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';
  backdrop.id = 'sidebar-backdrop';
  backdrop.onclick = closeSidebar;
  document.body.appendChild(backdrop);

  $('menu-toggle').onclick  = openSidebar;
  $('sidebar-close').onclick = closeSidebar;
}

function openSidebar() {
  $('sidebar').classList.add('open');
  $('sidebar-backdrop').classList.add('open');
}
function closeSidebar() {
  $('sidebar').classList.remove('open');
  $('sidebar-backdrop').classList.remove('open');
}

// ── MODALS ────────────────────────────────────────────────
function initModals() {
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.onclick = () => closeModal(btn.dataset.modal);
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.onclick = e => {
      if (e.target === overlay) closeModal(overlay.id);
    };
  });
}

// ── FIRESTORE LISTENERS ───────────────────────────────────
function startListeners(uid) {
  // Notes
  const notesUnsub = db.collection('notes')
    .where('uid', '==', uid)
    .orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      allNotes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderNotes();
      updateDashboard();
      renderCalendar();
    });

  // Todos
  const todosUnsub = db.collection('todos')
    .where('uid', '==', uid)
    .orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      allTodos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTodos();
      updateDashboard();
      renderCalendar();
    });

  // Journey
  const journeyUnsub = db.collection('journey')
    .where('uid', '==', uid)
    .orderBy('timestamp', 'asc')
    .onSnapshot(snap => {
      allJourney = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderJourneyTimeline();
      renderJourneyMarkers();
      updateDashboard();
      renderCalendar();
    });

  unsubs.push(notesUnsub, todosUnsub, journeyUnsub);
}

// ── DASHBOARD ─────────────────────────────────────────────
function updateDashboard() {
  $('count-notes').textContent   = allNotes.length;
  $('count-todos').textContent   = allTodos.filter(t => !t.done).length;
  $('count-journey').textContent = allJourney.length;

  const today = new Date().toISOString().slice(0, 10);
  const todayEvents = getEventsForDate(today);
  $('count-events').textContent  = todayEvents.length;

  // Recent todos
  const recentTodos = allTodos.filter(t => !t.done).slice(0, 4);
  $('dash-recent-todos').innerHTML = recentTodos.length
    ? recentTodos.map(t => `<li>${escHtml(t.name)}</li>`).join('')
    : '<li class="empty-item">Tidak ada tugas aktif</li>';

  // Recent notes
  const recentNotes = allNotes.slice(0, 4);
  $('dash-recent-notes').innerHTML = recentNotes.length
    ? recentNotes.map(n => `<li>${escHtml(n.title || 'Tanpa judul')}</li>`).join('')
    : '<li class="empty-item">Belum ada catatan</li>';

  lucide.createIcons();
}

// ── STICKY NOTES ──────────────────────────────────────────
function initNotes() {
  buildNoteColorPicker();

  $('btn-add-note').onclick = () => openNoteModal();

  $('notes-search').oninput = renderNotes;

  $('btn-save-note').onclick = saveNote;
}

function buildNoteColorPicker() {
  const wrap = $('note-color-picker');
  NOTE_COLORS.forEach(c => {
    const opt = document.createElement('div');
    opt.className   = 'note-color-option';
    opt.style.background = c.bg;
    opt.dataset.colorId  = c.id;
    opt.title = c.label;
    opt.onclick = () => {
      selectedColor = c.id;
      document.querySelectorAll('.note-color-option').forEach(o =>
        o.classList.toggle('selected', o.dataset.colorId === c.id));
    };
    wrap.appendChild(opt);
  });
}

function openNoteModal(note = null) {
  selectedNoteId = note ? note.id : null;
  $('modal-note-title').textContent = note ? 'Edit Catatan' : 'Catatan Baru';
  $('note-title-input').value = note ? note.title || '' : '';
  $('note-body-input').value  = note ? note.body  || '' : '';
  $('note-date-input').value  = note ? note.date  || '' : '';
  selectedColor = note ? note.color || NOTE_COLORS[0].id : NOTE_COLORS[0].id;

  document.querySelectorAll('.note-color-option').forEach(o =>
    o.classList.toggle('selected', o.dataset.colorId === selectedColor));

  openModal('modal-note');
  setTimeout(() => $('note-title-input').focus(), 100);
}

async function saveNote() {
  const title = $('note-title-input').value.trim();
  const body  = $('note-body-input').value.trim();
  const date  = $('note-date-input').value;
  if (!title && !body) { showToast('Isi judul atau isi catatan!', 'error'); return; }

  const data = {
    uid: currentUser.uid,
    title, body, color: selectedColor, date,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  try {
    if (selectedNoteId) {
      await db.collection('notes').doc(selectedNoteId).update(data);
      showToast('Catatan diperbarui ✓', 'success');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('notes').add(data);
      showToast('Catatan disimpan ✓', 'success');
    }
    closeModal('modal-note');
  } catch (e) {
    showToast('Gagal menyimpan: ' + e.message, 'error');
  }
}

async function deleteNote(id) {
  if (!confirm('Hapus catatan ini?')) return;
  await db.collection('notes').doc(id).delete();
  showToast('Catatan dihapus');
}

function renderNotes() {
  const query = $('notes-search').value.toLowerCase();
  const filtered = query
    ? allNotes.filter(n =>
        (n.title || '').toLowerCase().includes(query) ||
        (n.body  || '').toLowerCase().includes(query))
    : allNotes;

  const grid  = $('notes-grid');
  const empty = $('notes-empty');

  // Remove existing cards
  grid.querySelectorAll('.note-card').forEach(c => c.remove());

  if (!filtered.length) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  filtered.forEach(note => {
    const color = NOTE_COLORS.find(c => c.id === note.color) || NOTE_COLORS[0];
    const card  = document.createElement('div');
    card.className   = 'note-card';
    card.style.background = color.bg;
    card.innerHTML = `
      <div class="note-card-header">
        <div class="note-card-title">${escHtml(note.title || 'Tanpa Judul')}</div>
        <div class="note-actions">
          <button class="btn-icon" data-action="edit" title="Edit"><i data-lucide="pencil"></i></button>
          <button class="btn-icon danger" data-action="delete" title="Hapus"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
      <div class="note-card-body">${escHtml(note.body || '')}</div>
      <div class="note-card-footer">
        <span class="note-date">${note.date ? formatDate(note.date) : ''}</span>
      </div>`;

    card.querySelector('[data-action="edit"]').onclick   = (e) => { e.stopPropagation(); openNoteModal(note); };
    card.querySelector('[data-action="delete"]').onclick = (e) => { e.stopPropagation(); deleteNote(note.id); };
    grid.appendChild(card);
  });

  lucide.createIcons();
}

// ── TO DO LIST ────────────────────────────────────────────
function initTodos() {
  $('btn-add-todo').onclick = () => openTodoModal();
  $('todo-filter').onchange = renderTodos;
  $('btn-save-todo').onclick = saveTodo;
}

function openTodoModal(todo = null) {
  selectedTodoId = todo ? todo.id : null;
  $('modal-todo-title').textContent = todo ? 'Edit Tugas' : 'Tugas Baru';
  $('todo-name-input').value     = todo ? todo.name     || '' : '';
  $('todo-desc-input').value     = todo ? todo.desc     || '' : '';
  $('todo-deadline-input').value = todo ? todo.deadline || '' : '';
  $('todo-priority-input').value = todo ? todo.priority || 'medium' : 'medium';
  openModal('modal-todo');
  setTimeout(() => $('todo-name-input').focus(), 100);
}

async function saveTodo() {
  const name     = $('todo-name-input').value.trim();
  const desc     = $('todo-desc-input').value.trim();
  const deadline = $('todo-deadline-input').value;
  const priority = $('todo-priority-input').value;
  if (!name) { showToast('Nama tugas wajib diisi!', 'error'); return; }

  const data = {
    uid: currentUser.uid,
    name, desc, deadline, priority,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  try {
    if (selectedTodoId) {
      await db.collection('todos').doc(selectedTodoId).update(data);
      showToast('Tugas diperbarui ✓', 'success');
    } else {
      data.done      = false;
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('todos').add(data);
      showToast('Tugas ditambahkan ✓', 'success');
    }
    closeModal('modal-todo');
  } catch (e) {
    showToast('Gagal menyimpan: ' + e.message, 'error');
  }
}

async function toggleTodo(id, current) {
  await db.collection('todos').doc(id).update({ done: !current });
}

async function deleteTodo(id) {
  if (!confirm('Hapus tugas ini?')) return;
  await db.collection('todos').doc(id).delete();
  showToast('Tugas dihapus');
}

function renderTodos() {
  const filter = $('todo-filter').value;
  let filtered = allTodos;
  if (filter === 'active') filtered = allTodos.filter(t => !t.done);
  if (filter === 'done')   filtered = allTodos.filter(t =>  t.done);

  const wrap  = $('todo-list');
  const empty = $('todos-empty');

  wrap.querySelectorAll('.todo-item').forEach(el => el.remove());

  if (!filtered.length) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  filtered.forEach(todo => {
    const item = document.createElement('div');
    item.className = `todo-item${todo.done ? ' done' : ''}`;
    item.innerHTML = `
      <div class="todo-check ${todo.done ? 'checked' : ''}" data-action="toggle">
        ${todo.done ? '<i data-lucide="check"></i>' : ''}
      </div>
      <div class="todo-body">
        <div class="todo-name">${escHtml(todo.name)}</div>
        ${todo.desc ? `<div class="todo-desc">${escHtml(todo.desc)}</div>` : ''}
        <div class="todo-meta">
          ${todo.deadline ? `<span class="todo-deadline"><i data-lucide="calendar"></i>${formatDate(todo.deadline)}</span>` : ''}
          <span class="priority-badge priority-${todo.priority || 'medium'}">${priorityLabel(todo.priority)}</span>
        </div>
      </div>
      <div class="todo-actions">
        <button class="btn-icon" data-action="edit" title="Edit"><i data-lucide="pencil"></i></button>
        <button class="btn-icon danger" data-action="delete" title="Hapus"><i data-lucide="trash-2"></i></button>
      </div>`;

    item.querySelector('[data-action="toggle"]').onclick  = () => toggleTodo(todo.id, todo.done);
    item.querySelector('[data-action="edit"]').onclick    = () => openTodoModal(todo);
    item.querySelector('[data-action="delete"]').onclick  = () => deleteTodo(todo.id);
    wrap.appendChild(item);
  });

  lucide.createIcons();
}

function priorityLabel(p) {
  return { low: 'Rendah', medium: 'Sedang', high: 'Tinggi' }[p] || 'Sedang';
}

// ── JOURNEY / MAP ─────────────────────────────────────────
function initJourney() {
  $('btn-record-loc').onclick = recordLocation;
  $('btn-clear-journey').onclick = clearJourney;
  $('btn-save-journey').onclick  = saveJourneyPoint;
}

function initLeafletMap() {
  leafletMap = L.map('journey-map').setView([-7.5, 112.75], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(leafletMap);

  // Re-render markers if data already loaded
  renderJourneyMarkers();
}

function recordLocation() {
  if (!navigator.geolocation) {
    showToast('Browser tidak mendukung geolokasi', 'error');
    return;
  }
  $('btn-record-loc').textContent = 'Mendapatkan lokasi...';
  navigator.geolocation.getCurrentPosition(
    pos => {
      $('btn-record-loc').innerHTML = '<i data-lucide="navigation"></i> Rekam Lokasi Sekarang';
      lucide.createIcons();
      const { latitude: lat, longitude: lng } = pos.coords;
      pendingCoords = { lat, lng };
      $('journey-coords-display').textContent = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
      $('journey-label-input').value = '';
      openModal('modal-journey');
      // Pan map
      if (leafletMap) leafletMap.setView([lat, lng], 16);
    },
    err => {
      $('btn-record-loc').innerHTML = '<i data-lucide="navigation"></i> Rekam Lokasi Sekarang';
      lucide.createIcons();
      const msg = err.code === 1
        ? 'Akses lokasi ditolak. Aktifkan izin lokasi di browser.'
        : 'Tidak dapat mengambil lokasi saat ini.';
      showToast(msg, 'error');
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

async function saveJourneyPoint() {
  if (!pendingCoords) return;
  const label = $('journey-label-input').value.trim() || 'Lokasi';
  try {
    await db.collection('journey').add({
      uid: currentUser.uid,
      label,
      lat: pendingCoords.lat,
      lng: pendingCoords.lng,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
    pendingCoords = null;
    closeModal('modal-journey');
    showToast(`"${label}" disimpan ✓`, 'success');
  } catch (e) {
    showToast('Gagal menyimpan: ' + e.message, 'error');
  }
}

async function deleteJourneyPoint(id) {
  if (!confirm('Hapus titik perjalanan ini?')) return;
  await db.collection('journey').doc(id).delete();
  showToast('Titik dihapus');
}

async function clearJourney() {
  if (!confirm('Hapus semua titik perjalanan?')) return;
  const batch = db.batch();
  allJourney.forEach(j => batch.delete(db.collection('journey').doc(j.id)));
  await batch.commit();
  showToast('Semua titik dihapus');
}

function renderJourneyTimeline() {
  const list  = $('timeline-list');
  const empty = $('journey-empty');

  list.querySelectorAll('.timeline-item').forEach(el => el.remove());

  if (!allJourney.length) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  allJourney.forEach((j, i) => {
    const item = document.createElement('div');
    item.className = 'timeline-item';
    const ts = j.timestamp ? j.timestamp.toDate() : new Date();
    item.innerHTML = `
      <div class="timeline-dot">${i + 1}</div>
      <div class="timeline-info">
        <div class="timeline-label">${escHtml(j.label)}</div>
        <div class="timeline-coords">${j.lat.toFixed(5)}, ${j.lng.toFixed(5)}</div>
        <div class="timeline-time">${formatDateTime(ts)}</div>
      </div>
      <button class="btn-icon danger" data-id="${j.id}" title="Hapus"><i data-lucide="trash-2"></i></button>`;

    item.querySelector('[data-id]').onclick = () => deleteJourneyPoint(j.id);
    list.appendChild(item);
  });

  lucide.createIcons();
}

function renderJourneyMarkers() {
  if (!leafletMap) return;

  // Clear existing markers
  mapMarkers.forEach(m => leafletMap.removeLayer(m));
  mapMarkers = [];

  if (!allJourney.length) return;

  const latlngs = [];
  allJourney.forEach((j, i) => {
    const ts = j.timestamp ? j.timestamp.toDate() : new Date();
    const marker = L.circleMarker([j.lat, j.lng], {
      radius: 9, fillColor: '#4f8ef7', color: '#fff',
      weight: 2, opacity: 1, fillOpacity: 0.9,
    }).addTo(leafletMap);
    marker.bindPopup(`<strong>${escHtml(j.label)}</strong><br>${formatDateTime(ts)}`);
    mapMarkers.push(marker);
    latlngs.push([j.lat, j.lng]);
  });

  // Draw polyline
  if (latlngs.length > 1) {
    const line = L.polyline(latlngs, { color: '#4f8ef7', weight: 2.5, dashArray: '6,5' })
      .addTo(leafletMap);
    mapMarkers.push(line);
    leafletMap.fitBounds(line.getBounds(), { padding: [30, 30] });
  } else if (latlngs.length === 1) {
    leafletMap.setView(latlngs[0], 15);
  }
}

// ── CALENDAR ──────────────────────────────────────────────
function initCalendar() {
  $('cal-prev').onclick = () => {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
    renderCalendar();
  };
  $('cal-next').onclick = () => {
    calendarDate.setMonth(calendarDate.getMonth() + 1);
    renderCalendar();
  };
}

function getEventsForDate(dateStr) {
  const events = [];

  // Notes with date
  allNotes.filter(n => n.date === dateStr).forEach(n =>
    events.push({ type: 'note', name: n.title || 'Catatan', color: '#854d0e' }));

  // Todos with deadline
  allTodos.filter(t => t.deadline === dateStr).forEach(t =>
    events.push({ type: 'todo', name: t.name, color: '#166534' }));

  // Journey (date part only)
  allJourney.filter(j => {
    if (!j.timestamp) return false;
    return j.timestamp.toDate().toISOString().slice(0, 10) === dateStr;
  }).forEach(j =>
    events.push({ type: 'journey', name: j.label, color: '#1e40af' }));

  return events;
}

function renderCalendar() {
  const year  = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  $('cal-month-label').textContent = `${MONTHS_ID[month]} ${year}`;

  const grid   = $('calendar-grid');
  grid.innerHTML = '';

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  // Fill leading blanks
  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-day other-month';
    const prevDate = new Date(year, month, -(firstDay - i - 1));
    blank.textContent = prevDate.getDate();
    grid.appendChild(blank);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const events  = getEventsForDate(dateStr);
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
    const isSelected = selectedCalDay === dateStr;

    const cell = document.createElement('div');
    cell.className = `cal-day${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}${events.length ? ' has-events' : ''}`;
    cell.textContent = d;
    cell.onclick = () => showCalendarEvents(dateStr);
    grid.appendChild(cell);
  }

  // Show events if a day is selected
  if (selectedCalDay) showCalendarEvents(selectedCalDay, false);
}

function showCalendarEvents(dateStr, updateSelected = true) {
  if (updateSelected) selectedCalDay = dateStr;
  const events = getEventsForDate(dateStr);
  const [y, m, d] = dateStr.split('-');
  $('cal-selected-date').textContent = `${parseInt(d)} ${MONTHS_ID[parseInt(m)-1]} ${y}`;

  const list = $('cal-events-list');
  if (!events.length) {
    list.innerHTML = '<li style="color:var(--text-muted);font-size:.88rem;padding:.4rem 0">Tidak ada event pada tanggal ini.</li>';
    return;
  }

  const typeLabel = { note: 'Catatan', todo: 'Tugas', journey: 'Perjalanan' };
  list.innerHTML = events.map(ev => `
    <li class="cal-event-item">
      <span class="cal-event-type">${typeLabel[ev.type]}</span>
      <span class="cal-event-name">${escHtml(ev.name)}</span>
    </li>`).join('');
}

// ── UTILITIES ─────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(d)} ${MONTHS_ID[parseInt(m)-1]} ${y}`;
}

function formatDateTime(date) {
  if (!date) return '';
  return date.toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

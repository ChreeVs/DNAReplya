// DNAReplya Multi-Profile Dashboard Frontend Logic (Carbon & Lime Theme + Internal Auth Gate)
document.addEventListener('DOMContentLoaded', () => {
  // Global State
  let authToken = localStorage.getItem('dnareplya_token') || '';
  let currentUser = null;
  let allProfiles = [];
  let activeProfile = null;
  let activeProfileAccounts = [];
  let activeProfileComments = [];
  let activeProfileMemory = [];
  let activeFilter = 'all';
  let activeModalCommentId = null;

  // DOM Elements - Auth & Session
  const authGateModal = document.getElementById('authGateModal');
  const tabAuthLogin = document.getElementById('tabAuthLogin');
  const tabAuthRegister = document.getElementById('tabAuthRegister');
  const formLogin = document.getElementById('formLogin');
  const formRegister = document.getElementById('formRegister');
  const authAlertBox = document.getElementById('authAlertBox');
  const navUserName = document.getElementById('navUserName');
  const btnLogout = document.getElementById('btnLogout');
  const btnOpenTeamModal = document.getElementById('btnOpenTeamModal');
  const badgePendingUsers = document.getElementById('badgePendingUsers');
  const teamModal = document.getElementById('teamModal');
  const btnCloseTeamModal = document.getElementById('btnCloseTeamModal');
  const btnCancelTeamModal = document.getElementById('btnCancelTeamModal');
  const teamList = document.getElementById('teamList');

  // DOM Elements - Navigation & Switcher
  const btnProfileDropdown = document.getElementById('btnProfileDropdown');
  const profileDropdownMenu = document.getElementById('profileDropdownMenu');
  const profileDropdownList = document.getElementById('profileDropdownList');
  const headerProfileName = document.getElementById('headerProfileName');
  const headerProfileDot = document.getElementById('headerProfileDot');
  const btnOpenCreateProfileModal = document.getElementById('btnOpenCreateProfileModal');

  const navTabs = document.querySelectorAll('.nav-tab');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // DOM Elements - Banner
  const bannerProfileAvatar = document.getElementById('bannerProfileAvatar');
  const bannerProfileName = document.getElementById('bannerProfileName');
  const bannerProfileDesc = document.getElementById('bannerProfileDesc');
  const bannerAutopilotPill = document.getElementById('bannerAutopilotPill');
  const statConnectedChannels = document.getElementById('statConnectedChannels');
  const statPendingComments = document.getElementById('statPendingComments');
  const statApprovedComments = document.getElementById('statApprovedComments');
  const statMemoryItems = document.getElementById('statMemoryItems');
  const inboxCountBadge = document.getElementById('inboxCountBadge');
  const channelsCountBadge = document.getElementById('channelsCountBadge');
  const memoryCountBadge = document.getElementById('memoryCountBadge');

  // DOM Elements - Tab 1: Inbox
  const feedList = document.getElementById('feedList');
  const btnRefreshFeed = document.getElementById('btnRefreshFeed');
  const filterChips = document.querySelectorAll('.filter-chip');
  const btnOpenIngestModal = document.getElementById('btnOpenIngestModal');

  // DOM Elements - Tab 2: Channels
  const channelsGrid = document.getElementById('channelsGrid');
  const btnOpenConnectModal = document.getElementById('btnOpenConnectModal');

  // DOM Elements - Tab 3: Guardrails
  const profileGuardrailsForm = document.getElementById('profileGuardrailsForm');
  const profLogoUrl = document.getElementById('profLogoUrl');
  const profColorPicker = document.getElementById('profColorPicker');
  const profColorHex = document.getElementById('profColorHex');
  const profileColorChips = document.querySelectorAll('.color-chip-btn');
  const profToneOfVoice = document.getElementById('profToneOfVoice');
  const profMaxReplyLength = document.getElementById('profMaxReplyLength');
  const charLengthDisplay = document.getElementById('charLengthDisplay');
  const profCustomTone = document.getElementById('profCustomTone');
  const profBusinessKnowledge = document.getElementById('profBusinessKnowledge');
  const profForbiddenWords = document.getElementById('profForbiddenWords');
  const profTelegramToken = document.getElementById('profTelegramToken');
  const profTelegramChatId = document.getElementById('profTelegramChatId');
  const profAutoPilotToggle = document.getElementById('profAutoPilotToggle');

  // DOM Elements - Tab 4: Memory
  const memoryList = document.getElementById('memoryList');
  const btnRefreshMemory = document.getElementById('btnRefreshMemory');

  // DOM Elements - Tab 5: BYOK
  const globalByokForm = document.getElementById('globalByokForm');
  const defaultAiProvider = document.getElementById('defaultAiProvider');
  const keyOpenAI = document.getElementById('keyOpenAI');
  const keyGemini = document.getElementById('keyGemini');
  const keyAnthropic = document.getElementById('keyAnthropic');
  const badgeOpenAI = document.getElementById('badgeOpenAI');
  const badgeGemini = document.getElementById('badgeGemini');
  const badgeAnthropic = document.getElementById('badgeAnthropic');
  const globalTelegramForm = document.getElementById('globalTelegramForm');
  const globalTelegramToken = document.getElementById('globalTelegramToken');
  const badgeGlobalTelegram = document.getElementById('badgeGlobalTelegram');
  const btnTestGlobalTelegram = document.getElementById('btnTestGlobalTelegram');

  // DOM Elements - Modals
  const createProfileModal = document.getElementById('createProfileModal');
  const createProfileForm = document.getElementById('createProfileForm');
  const btnCloseCreateProfile = document.getElementById('btnCloseCreateProfile');
  const btnCancelCreateProfile = document.getElementById('btnCancelCreateProfile');

  const connectAccountModal = document.getElementById('connectAccountModal');
  const connectAccountForm = document.getElementById('connectAccountForm');
  const btnCloseConnectModal = document.getElementById('btnCloseConnectModal');
  const btnCancelConnectModal = document.getElementById('btnCancelConnectModal');

  const ingestModal = document.getElementById('ingestModal');
  const ingestCommentForm = document.getElementById('ingestCommentForm');
  const btnCloseIngestModal = document.getElementById('btnCloseIngestModal');
  const btnCancelIngestModal = document.getElementById('btnCancelIngestModal');

  const replyModal = document.getElementById('replyModal');
  const modalAuthor = document.getElementById('modalAuthor');
  const modalComment = document.getElementById('modalComment');
  const modalReplyText = document.getElementById('modalReplyText');
  const btnModalClose = document.getElementById('btnModalClose');
  const btnModalCancel = document.getElementById('btnModalCancel');
  const btnModalSubmit = document.getElementById('btnModalSubmit');

  // Toast utility
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  // --- Centralized Authenticated Fetch Wrapper ---
  async function apiFetch(url, options = {}) {
    const headers = options.headers || {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    const res = await fetch(url, { ...options, headers });

    if (res.status === 401 && !url.includes('/api/auth/login') && !url.includes('/api/auth/register')) {
      // Unauthorized: open login gate
      localStorage.removeItem('dnareplya_token');
      authToken = '';
      currentUser = null;
      openAuthGate('Sessione scaduta o non autorizzata. Effettua il login.', 'error');
      throw new Error('Unauthorized');
    }

    return res;
  }

  // --- 0. Authentication Gate Logic ---
  function openAuthGate(alertMsg = '', alertType = 'error') {
    authGateModal.classList.remove('hidden');
    if (alertMsg) {
      authAlertBox.className = `auth-alert ${alertType}`;
      authAlertBox.textContent = alertMsg;
      authAlertBox.classList.remove('hidden');
    } else {
      authAlertBox.classList.add('hidden');
    }
  }

  function closeAuthGate() {
    authGateModal.classList.add('hidden');
    authAlertBox.classList.add('hidden');
  }

  tabAuthLogin.addEventListener('click', () => {
    tabAuthLogin.classList.add('active');
    tabAuthRegister.classList.remove('active');
    formLogin.classList.remove('hidden');
    formRegister.classList.add('hidden');
    authAlertBox.classList.add('hidden');
  });

  tabAuthRegister.addEventListener('click', () => {
    tabAuthRegister.classList.add('active');
    tabAuthLogin.classList.remove('active');
    formRegister.classList.remove('hidden');
    formLogin.classList.add('hidden');
    authAlertBox.classList.add('hidden');
  });

  // Login Submit
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    const btn = document.getElementById('btnLoginSubmit');
    btn.disabled = true;
    btn.textContent = 'Verifica credenziali...';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.success && data.token) {
        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('dnareplya_token', authToken);
        closeAuthGate();
        formLogin.reset();
        showToast(`Bentornato, ${currentUser.name}!`, 'success');
        setupUserSession();
        initApp();
      } else {
        authAlertBox.className = data.pendingApproval ? 'auth-alert pending' : 'auth-alert error';
        authAlertBox.textContent = data.error || 'Credenziali non valide';
        authAlertBox.classList.remove('hidden');
      }
    } catch (err) {
      authAlertBox.className = 'auth-alert error';
      authAlertBox.textContent = 'Errore di connessione al server.';
      authAlertBox.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = '🔐 Entra nello Strumento';
    }
  });

  // Register Submit
  formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;

    const btn = document.getElementById('btnRegisterSubmit');
    btn.disabled = true;
    btn.textContent = 'Invio richiesta in corso...';

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();

      if (data.success) {
        if (data.token) {
          // Super admin auto-approved
          authToken = data.token;
          currentUser = data.user;
          localStorage.setItem('dnareplya_token', authToken);
          closeAuthGate();
          showToast(`Accesso Super Admin attivato per ${currentUser.name}!`, 'success');
          setupUserSession();
          initApp();
        } else {
          authAlertBox.className = 'auth-alert pending';
          authAlertBox.innerHTML = `✅ <b>Richiesta inviata!</b><br>${data.message}`;
          authAlertBox.classList.remove('hidden');
          formRegister.reset();
        }
      } else {
        authAlertBox.className = 'auth-alert error';
        authAlertBox.textContent = data.error || 'Errore durante la registrazione';
        authAlertBox.classList.remove('hidden');
      }
    } catch (err) {
      authAlertBox.className = 'auth-alert error';
      authAlertBox.textContent = 'Errore di connessione.';
      authAlertBox.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = '📨 Invia Richiesta di Registrazione';
    }
  });

  // Logout
  btnLogout.addEventListener('click', () => {
    localStorage.removeItem('dnareplya_token');
    authToken = '';
    currentUser = null;
    openAuthGate('Disconnessione effettuata.', 'success');
  });

  // Check Current Session on startup
  async function checkAuthSession() {
    if (!authToken) {
      openAuthGate();
      return false;
    }

    try {
      const res = await apiFetch('/api/auth/me');
      const data = await res.json();
      if (data.success && data.user) {
        currentUser = data.user;
        setupUserSession();
        return true;
      } else {
        openAuthGate();
        return false;
      }
    } catch (e) {
      openAuthGate();
      return false;
    }
  }

  function setupUserSession() {
    if (!currentUser) return;
    navUserName.textContent = currentUser.name.split(' ')[0] + (currentUser.role === 'admin' ? ' (Admin)' : '');

    // Show Admin Team modal trigger if admin or Christian
    if (currentUser.role === 'admin' || currentUser.email.toLowerCase().includes('christian.valese')) {
      btnOpenTeamModal.classList.remove('hidden');
      loadPendingUsersCount();
    } else {
      btnOpenTeamModal.classList.add('hidden');
    }
  }

  async function loadPendingUsersCount() {
    try {
      const res = await apiFetch('/api/auth/pending-users');
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        badgePendingUsers.textContent = data.users.length;
        badgePendingUsers.style.display = data.users.length > 0 ? 'inline-block' : 'none';
      }
    } catch (e) {}
  }

  // --- Team Management Modal (Admin) ---
  btnOpenTeamModal.addEventListener('click', async () => {
    teamModal.classList.remove('hidden');
    await renderTeamModal();
  });
  btnCloseTeamModal.addEventListener('click', () => teamModal.classList.add('hidden'));
  btnCancelTeamModal.addEventListener('click', () => teamModal.classList.add('hidden'));

  async function renderTeamModal() {
    teamList.innerHTML = '<p class="field-hint">Caricamento collaboratori in corso...</p>';
    try {
      const res = await apiFetch('/api/auth/pending-users');
      const data = await res.json();
      if (!data.success) return;

      const users = data.users;
      if (!users || users.length === 0) {
        teamList.innerHTML = `
          <div class="empty-state">
            <span class="empty-icon">👥</span>
            <p>Nessuna richiesta di accesso in attesa.<br>Tutti i collaboratori registrati sono stati approvati.</p>
          </div>
        `;
        return;
      }

      teamList.innerHTML = users.map(u => `
        <div class="team-member-card">
          <div class="member-info">
            <h4>${escapeHtml(u.name)}</h4>
            <p>${escapeHtml(u.email)} · Richiesto il ${new Date(u.created_at).toLocaleDateString('it-IT')}</p>
          </div>
          <div class="member-actions">
            <button class="btn btn-primary btn-sm" onclick="window.approveTeamUser('${u.id}')">🟢 Approva</button>
            <button class="btn btn-ghost btn-sm" onclick="window.rejectTeamUser('${u.id}')">❌ Rifiuta</button>
          </div>
        </div>
      `).join('');
    } catch (e) {
      teamList.innerHTML = '<p class="auth-alert error">Errore caricamento richieste team</p>';
    }
  }

  window.approveTeamUser = async (userId) => {
    try {
      const res = await apiFetch(`/api/auth/approve-user/${userId}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('✅ Collaboratore approvato con successo!', 'success');
        renderTeamModal();
        loadPendingUsersCount();
      }
    } catch (e) {
      showToast('❌ Errore durante l\'approvazione', 'error');
    }
  };

  window.rejectTeamUser = async (userId) => {
    if (!confirm('Rifiutare e rimuovere questa richiesta di registrazione?')) return;
    try {
      const res = await apiFetch(`/api/auth/reject-user/${userId}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Richiesta rifiutata', 'info');
        renderTeamModal();
        loadPendingUsersCount();
      }
    } catch (e) {
      showToast('❌ Errore', 'error');
    }
  };

  // --- 1. Tab Navigation ---
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;
      navTabs.forEach(t => t.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      document.getElementById(targetId)?.classList.add('active');

      if (targetId === 'tab-inbox') loadActiveProfileComments();
      if (targetId === 'tab-channels') loadActiveProfileChannels();
      if (targetId === 'tab-guardrails') populateProfileGuardrails();
      if (targetId === 'tab-memory') loadActiveProfileMemory();
      if (targetId === 'tab-byok') loadGlobalSettings();
    });
  });

  // --- 2. Profile Switcher Logic ---
  btnProfileDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
    profileDropdownMenu.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    profileDropdownMenu.classList.add('hidden');
  });

  profileDropdownMenu.addEventListener('click', (e) => e.stopPropagation());

  async function loadProfiles(preferredId = null) {
    try {
      const res = await apiFetch('/api/profiles');
      const data = await res.json();
      if (!data.success) return;

      allProfiles = data.profiles;
      const savedId = preferredId || localStorage.getItem('dnareplya_active_profile');
      activeProfile = allProfiles.find(p => p.id === savedId) || allProfiles[0];

      if (activeProfile) {
        localStorage.setItem('dnareplya_active_profile', activeProfile.id);
        updateHeaderAndBanner();
        renderProfileDropdown();
        loadActiveProfileData();
      }
    } catch (err) {
      console.error('Error loading profiles:', err);
    }
  }

  // Helper: Hex to RGBA
  function hexToRgba(hex, alpha = 1) {
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    const r = parseInt(cleanHex.substring(0, 2), 16) || 163;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 230;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 53;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Dynamically apply profile accent color and logo to the entire UI
  function applyProfileTheme(profile) {
    if (!profile) return;
    const color = profile.color || '#a3e635';
    document.documentElement.style.setProperty('--lime', color);
    document.documentElement.style.setProperty('--lime-bright', color);
    document.documentElement.style.setProperty('--lime-glow', hexToRgba(color, 0.3));
    document.documentElement.style.setProperty('--lime-subtle', hexToRgba(color, 0.12));
    document.documentElement.style.setProperty('--border-active', hexToRgba(color, 0.45));

    // Logo / Avatar
    if (profile.logo_url && profile.logo_url.trim()) {
      bannerProfileAvatar.innerHTML = `<img src="${profile.logo_url}" class="profile-logo-img" alt="${escapeHtml(profile.name)}" onerror="this.parentElement.textContent='${profile.name.substring(0, 2).toUpperCase()}'">`;
    } else {
      const initials = profile.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || 'SS';
      bannerProfileAvatar.textContent = initials;
    }
    bannerProfileAvatar.style.borderColor = color;
    headerProfileDot.style.background = color;
    headerProfileDot.style.boxShadow = `0 0 8px ${color}`;
  }

  function updateHeaderAndBanner() {
    if (!activeProfile) return;

    applyProfileTheme(activeProfile);

    headerProfileName.textContent = activeProfile.name;
    bannerProfileName.textContent = activeProfile.name;
    bannerProfileDesc.textContent = activeProfile.description || 'Gestione canali social e risposte unificate';

    const isAuto = Boolean(activeProfile.auto_pilot_enabled);
    bannerAutopilotPill.textContent = isAuto ? '⚡ Auto-Pilot Attivo' : 'Human-in-the-Loop';
    bannerAutopilotPill.style.color = isAuto ? 'var(--accent-purple)' : 'var(--lime)';
    bannerAutopilotPill.style.borderColor = isAuto ? 'rgba(192, 132, 252, 0.4)' : 'rgba(163, 230, 53, 0.3)';
  }

  function renderProfileDropdown() {
    profileDropdownList.innerHTML = allProfiles.map(p => {
      const isActive = activeProfile && activeProfile.id === p.id;
      const initials = p.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
      return `
        <div class="profile-dropdown-item ${isActive ? 'active' : ''}" onclick="window.selectProfile('${p.id}')">
          <div class="pitem-left">
            <span class="pitem-circle" style="color:${p.color || 'var(--lime)'};border-color:${p.color || 'var(--lime)'}">${initials}</span>
            <div>
              <div class="pitem-name">${escapeHtml(p.name)}</div>
              <div class="pitem-count">${p.accountsCount || 0} canali · ${p.pendingCommentsCount || 0} in attesa</div>
            </div>
          </div>
          ${isActive ? '<span style="color:var(--lime);font-size:0.85rem">✓</span>' : ''}
        </div>
      `;
    }).join('');
  }

  window.selectProfile = (id) => {
    profileDropdownMenu.classList.add('hidden');
    loadProfiles(id);
  };

  function loadActiveProfileData() {
    loadActiveProfileChannels();
    loadActiveProfileComments();
    loadActiveProfileMemory();
    populateProfileGuardrails();
  }

  // --- 3. Create Profile Modal ---
  btnOpenCreateProfileModal.addEventListener('click', () => {
    profileDropdownMenu.classList.add('hidden');
    createProfileModal.classList.remove('hidden');
  });
  btnCloseCreateProfile.addEventListener('click', () => createProfileModal.classList.add('hidden'));
  btnCancelCreateProfile.addEventListener('click', () => createProfileModal.classList.add('hidden'));

  createProfileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('newProfileName').value.trim();
    const description = document.getElementById('newProfileDesc').value.trim();
    const tone_of_voice = document.getElementById('newProfileTone').value;
    const logo_url = document.getElementById('newProfileLogo').value.trim();
    const color = document.getElementById('newProfileColor').value;

    if (!name) return;

    try {
      const res = await apiFetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, tone_of_voice, logo_url, color }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✨ Profilo "${name}" creato!`, 'success');
        createProfileModal.classList.add('hidden');
        createProfileForm.reset();
        loadProfiles(data.profile.id);
      } else {
        showToast(`❌ Errore: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast('❌ Errore di rete', 'error');
    }
  });

  // --- 4. Tab 2: Channels (Social Accounts) ---
  async function loadActiveProfileChannels() {
    if (!activeProfile) return;
    try {
      const res = await apiFetch(`/api/profiles/${activeProfile.id}/accounts`);
      const data = await res.json();
      if (!data.success) return;

      activeProfileAccounts = data.accounts;
      statConnectedChannels.textContent = activeProfileAccounts.length;
      channelsCountBadge.textContent = activeProfileAccounts.length;
      renderChannels(activeProfileAccounts);
    } catch (err) {
      console.error('Error loading channels:', err);
    }
  }

  function renderChannels(accounts) {
    if (!accounts || accounts.length === 0) {
      channelsGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <span class="empty-icon">🌐</span>
          <p>Nessun canale collegato a questo profilo.<br>Clicca su "Connetti Account Social" per collegare Instagram, Facebook, TikTok o LinkedIn.</p>
        </div>
      `;
      return;
    }

    const platformIcons = {
      instagram: '📸 Instagram',
      facebook: '📘 Facebook',
      threads: '🧵 Threads',
      linkedin: '💼 LinkedIn',
      tiktok: '🎵 TikTok',
      x: '🐦 X',
    };

    channelsGrid.innerHTML = accounts.map(acc => `
      <div class="channel-card">
        <div class="channel-card-top">
          <span class="channel-badge">${platformIcons[acc.platform] || acc.platform}</span>
          <span class="channel-status ${acc.status}">${acc.status === 'connected' ? '● Collegato' : 'Disconnesso'}</span>
        </div>
        <div>
          <div class="channel-name">${escapeHtml(acc.account_name)}</div>
          <div class="channel-handle">${escapeHtml(acc.account_handle)}</div>
        </div>
        <div class="channel-notes">${escapeHtml(acc.notes || 'Nessuna nota specificata')}</div>
        <div class="channel-card-bottom">
          <button class="btn btn-ghost btn-sm" onclick="window.disconnectAccount('${acc.id}')">Disconnetti</button>
        </div>
      </div>
    `).join('');
  }

  window.disconnectAccount = async (accId) => {
    if (!confirm('Sei sicuro di voler disconnettere questo account social?')) return;
    try {
      const res = await apiFetch(`/api/profiles/${activeProfile.id}/accounts/${accId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Account social rimosso', 'info');
        loadActiveProfileChannels();
      }
    } catch (err) {
      showToast('Errore durante la disconnessione', 'error');
    }
  };

  // Connect Account Modal
  btnOpenConnectModal.addEventListener('click', () => connectAccountModal.classList.remove('hidden'));
  btnCloseConnectModal.addEventListener('click', () => connectAccountModal.classList.add('hidden'));
  btnCancelConnectModal.addEventListener('click', () => connectAccountModal.classList.add('hidden'));

  connectAccountForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeProfile) return;

    const payload = {
      platform: document.getElementById('connPlatform').value,
      account_name: document.getElementById('connAccountName').value.trim(),
      account_handle: document.getElementById('connAccountHandle').value.trim(),
      external_account_id: document.getElementById('connExternalId').value.trim(),
    };

    try {
      const res = await apiFetch(`/api/profiles/${activeProfile.id}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ Account social collegato al profilo!', 'success');
        connectAccountModal.classList.add('hidden');
        connectAccountForm.reset();
        loadActiveProfileChannels();
      } else {
        showToast(`❌ Errore: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast('❌ Errore di rete', 'error');
    }
  });

  // --- 5. Tab 1: Inbox Commenti ---
  async function loadActiveProfileComments() {
    if (!activeProfile) return;
    try {
      const res = await apiFetch(`/api/comments?profileId=${activeProfile.id}`);
      const data = await res.json();
      if (!data.success) return;

      activeProfileComments = data.comments;
      updateCommentsMetrics();
      renderFeed(filterComments(activeProfileComments));
    } catch (err) {
      console.error('Error loading comments:', err);
    }
  }

  function filterComments(comments) {
    if (activeFilter === 'pending') return comments.filter(c => c.status === 'pending');
    if (activeFilter === 'approved') return comments.filter(c => c.status === 'approved' || c.status === 'modified' || c.status === 'auto_replied');
    return comments;
  }

  function updateCommentsMetrics() {
    const pending = activeProfileComments.filter(c => c.status === 'pending').length;
    const approved = activeProfileComments.filter(c => c.status === 'approved' || c.status === 'modified' || c.status === 'auto_replied').length;
    statPendingComments.textContent = pending;
    statApprovedComments.textContent = approved;
    inboxCountBadge.textContent = pending;
  }

  function renderFeed(comments) {
    if (!comments || comments.length === 0) {
      feedList.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📭</span>
          <p>Nessun commento trovato per questo filtro.<br>Usa il pulsante "Registra Commento" in alto a destra per registrare un messaggio in arrivo.</p>
        </div>
      `;
      return;
    }

    const platformIcons = {
      instagram: '📸 Instagram',
      facebook: '📘 Facebook',
      threads: '🧵 Threads',
      linkedin: '💼 LinkedIn',
      tiktok: '🎵 TikTok',
      x: '🐦 X',
    };

    feedList.innerHTML = comments.map(c => {
      const icon = platformIcons[c.platform.toLowerCase()] || `🌐 ${c.platform}`;
      const statusLabels = {
        pending: 'In Attesa Approvazione',
        approved: 'Approvato',
        modified: 'Modificato & Inviato',
        rejected: 'Scartato',
        auto_replied: 'Auto-Pilot Inviato',
      };

      const displayReply = c.final_reply || c.proposed_reply;

      return `
        <div class="feed-card" id="card-${c.id}">
          <div class="feed-card-header">
            <span class="card-platform-badge">${icon}</span>
            <span class="status-badge ${c.status}">${statusLabels[c.status] || c.status}</span>
          </div>

          <div class="feed-author">@${escapeHtml(c.author_username)} ${c.post_snippet ? `· <span style="font-weight:400;color:var(--text-dim);font-size:0.8rem">su "${escapeHtml(c.post_snippet)}"</span>` : ''}</div>

          <div class="feed-comment-bubble">
            "${escapeHtml(c.comment_text)}"
          </div>

          <div class="feed-proposed-box">
            <span class="proposed-label">${c.status === 'pending' ? '🤖 Proposta Risposta AI:' : '📤 Risposta Finale Pubblicata:'}</span>
            <p class="proposed-text">${escapeHtml(displayReply || 'Nessuna risposta disponibile')}</p>
          </div>

          ${c.status === 'pending' ? `
            <div class="feed-card-actions">
              <button class="btn-card-action approve" onclick="window.approveComment('${c.id}')">🟢 Approva e Invia</button>
              <button class="btn-card-action edit" onclick="window.openEditModal('${c.id}')">✏️ Modifica</button>
              <button class="btn-card-action reject" onclick="window.rejectComment('${c.id}')">❌ Scarta</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.filter;
      renderFeed(filterComments(activeProfileComments));
    });
  });

  btnRefreshFeed.addEventListener('click', loadActiveProfileComments);

  // Ingest Real Comment Modal
  btnOpenIngestModal.addEventListener('click', () => ingestModal.classList.remove('hidden'));
  btnCloseIngestModal.addEventListener('click', () => ingestModal.classList.add('hidden'));
  btnCancelIngestModal.addEventListener('click', () => ingestModal.classList.add('hidden'));

  ingestCommentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeProfile) return;

    const payload = {
      profileId: activeProfile.id,
      platform: document.getElementById('ingestPlatform').value,
      authorUsername: document.getElementById('ingestAuthor').value.trim(),
      postSnippet: document.getElementById('ingestPostSnippet').value.trim(),
      commentText: document.getElementById('ingestText').value.trim(),
    };

    const submitBtn = ingestCommentForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Generazione AI in corso...';

    try {
      await fetch('/api/webhooks/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          object: payload.platform === 'facebook' ? 'page' : 'instagram',
          entry: [{
            id: activeProfile.id,
            changes: [{
              field: 'comments',
              value: {
                item: 'comment',
                verb: 'add',
                message: payload.commentText,
                from: { name: payload.authorUsername },
                media: { id: payload.postSnippet || 'post_123' },
              }
            }]
          }]
        }),
      });

      showToast('⚡ Commento registrato e processato con AI!', 'success');
      ingestModal.classList.add('hidden');
      ingestCommentForm.reset();
      setTimeout(loadActiveProfileComments, 1200);
    } catch (err) {
      showToast('❌ Errore durante la registrazione', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Processa con AI & Notifica Telegram';
    }
  });

  // Action Window Bindings
  window.approveComment = async (id) => {
    try {
      const res = await apiFetch(`/api/comments/${id}/approve`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('✅ Risposta approvata e memorizzata nel profilo!', 'success');
        loadActiveProfileComments();
        loadActiveProfileMemory();
      }
    } catch (err) {
      showToast('❌ Errore durante l\'approvazione', 'error');
    }
  };

  window.rejectComment = async (id) => {
    try {
      const res = await apiFetch(`/api/comments/${id}/reject`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('❌ Commento scartato', 'info');
        loadActiveProfileComments();
      }
    } catch (err) {
      showToast('❌ Errore', 'error');
    }
  };

  window.openEditModal = (id) => {
    const comment = activeProfileComments.find(c => c.id === id);
    if (!comment) return;

    activeModalCommentId = id;
    modalAuthor.textContent = `@${comment.author_username}`;
    modalComment.textContent = `"${comment.comment_text}"`;
    modalReplyText.value = comment.proposed_reply;
    replyModal.classList.remove('hidden');
  };

  btnModalClose.addEventListener('click', () => replyModal.classList.add('hidden'));
  btnModalCancel.addEventListener('click', () => replyModal.classList.add('hidden'));

  btnModalSubmit.addEventListener('click', async () => {
    if (!activeModalCommentId) return;
    const customText = modalReplyText.value.trim();
    if (!customText) return;

    try {
      const res = await apiFetch(`/api/comments/${activeModalCommentId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ final_reply: customText }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ Risposta salvata e memorizzata!', 'success');
        replyModal.classList.add('hidden');
        loadActiveProfileComments();
        loadActiveProfileMemory();
      }
    } catch (err) {
      showToast('❌ Errore salvataggio', 'error');
    }
  });

  // --- 6. Tab 3: Guardrails del Profilo ---
  profileColorChips.forEach(chip => {
    chip.addEventListener('click', () => {
      profileColorChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const col = chip.dataset.color;
      profColorPicker.value = col;
      profColorHex.textContent = col;
      applyProfileTheme({ ...activeProfile, color: col });
    });
  });

  profColorPicker.addEventListener('input', (e) => {
    const col = e.target.value;
    profColorHex.textContent = col;
    applyProfileTheme({ ...activeProfile, color: col });
  });

  function populateProfileGuardrails() {
    if (!activeProfile) return;
    profLogoUrl.value = activeProfile.logo_url || '';
    profColorPicker.value = activeProfile.color || '#a3e635';
    profColorHex.textContent = activeProfile.color || '#a3e635';

    profileColorChips.forEach(chip => {
      chip.classList.toggle('active', chip.dataset.color.toLowerCase() === (activeProfile.color || '#a3e635').toLowerCase());
    });

    profToneOfVoice.value = activeProfile.tone_of_voice || 'friendly';
    profMaxReplyLength.value = activeProfile.max_reply_length || 280;
    charLengthDisplay.textContent = activeProfile.max_reply_length || 280;
    profCustomTone.value = activeProfile.custom_tone_instructions || '';
    profBusinessKnowledge.value = activeProfile.business_knowledge || '';
    profForbiddenWords.value = activeProfile.forbidden_words || '';
    profTelegramToken.value = activeProfile.telegram_bot_token || '';
    profTelegramChatId.value = activeProfile.telegram_chat_id || '';
    profAutoPilotToggle.checked = Boolean(activeProfile.auto_pilot_enabled);
  }

  profMaxReplyLength.addEventListener('input', (e) => {
    charLengthDisplay.textContent = e.target.value;
  });

  profileGuardrailsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeProfile) return;

    const payload = {
      logo_url: profLogoUrl.value.trim(),
      color: profColorPicker.value,
      tone_of_voice: profToneOfVoice.value,
      max_reply_length: parseInt(profMaxReplyLength.value, 10),
      custom_tone_instructions: profCustomTone.value,
      business_knowledge: profBusinessKnowledge.value,
      forbidden_words: profForbiddenWords.value,
      telegram_bot_token: profTelegramToken.value,
      telegram_chat_id: profTelegramChatId.value,
      auto_pilot_enabled: profAutoPilotToggle.checked ? 1 : 0,
    };

    try {
      const res = await apiFetch(`/api/profiles/${activeProfile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`🛡️ Regole e stile aggiornati per "${activeProfile.name}"!`, 'success');
        activeProfile = data.profile;
        updateHeaderAndBanner();
      }
    } catch (err) {
      showToast('❌ Errore durante il salvataggio', 'error');
    }
  });

  // --- 7. Tab 4: Memoria AI del Profilo ---
  async function loadActiveProfileMemory() {
    if (!activeProfile) return;
    try {
      const res = await apiFetch(`/api/comments/approved-memory?profileId=${activeProfile.id}`);
      const data = await res.json();
      if (!data.success) return;

      activeProfileMemory = data.memory;
      statMemoryItems.textContent = activeProfileMemory.length;
      memoryCountBadge.textContent = activeProfileMemory.length;
      renderMemory(activeProfileMemory);
    } catch (err) {
      console.error('Error loading memory:', err);
    }
  }

  function renderMemory(items) {
    if (!items || items.length === 0) {
      memoryList.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🌱</span>
          <p>Nessun esempio memorizzato per "${escapeHtml(activeProfile.name)}".<br>Quando approverai o modificherai una risposta nell'inbox, verrà salvata qui per addestrare l'AI su questo brand.</p>
        </div>
      `;
      return;
    }

    memoryList.innerHTML = items.map(item => `
      <div class="memory-card">
        <div class="memory-card-header">
          <span class="card-platform-badge">${item.platform.toUpperCase()}</span>
          <span class="memory-date">${new Date(item.created_at).toLocaleDateString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="memory-comment">💬 "${escapeHtml(item.comment_text)}"</div>
        <div class="memory-reply">🎯 "${escapeHtml(item.approved_reply)}"</div>
      </div>
    `).join('');
  }

  btnRefreshMemory.addEventListener('click', loadActiveProfileMemory);

  // --- 8. Tab 5: BYOK & Global Telegram ---
  async function loadGlobalSettings() {
    try {
      const res = await apiFetch('/api/settings');
      const data = await res.json();
      if (!data.success) return;

      const s = data.settings;
      defaultAiProvider.value = s.default_ai_provider || 'openai';

      updateBadge(badgeOpenAI, s.has_openai, s.api_key_openai_masked);
      updateBadge(badgeGemini, s.has_gemini, s.api_key_gemini_masked);
      updateBadge(badgeAnthropic, s.has_anthropic, s.api_key_anthropic_masked);
      updateBadge(badgeGlobalTelegram, s.has_telegram, s.telegram_bot_token_masked);
    } catch (err) {
      console.error('Error loading global settings:', err);
    }
  }

  function updateBadge(badgeEl, isConfigured, maskedVal) {
    if (!badgeEl) return;
    if (isConfigured) {
      badgeEl.className = 'key-status-badge active';
      badgeEl.textContent = `Configurata (${maskedVal})`;
    } else {
      badgeEl.className = 'key-status-badge';
      badgeEl.textContent = 'Non configurata';
    }
  }

  globalByokForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      default_ai_provider: defaultAiProvider.value,
    };
    if (keyOpenAI.value) payload.api_key_openai = keyOpenAI.value;
    if (keyGemini.value) payload.api_key_gemini = keyGemini.value;
    if (keyAnthropic.value) payload.api_key_anthropic = keyAnthropic.value;

    try {
      const res = await apiFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ Chiavi LLM salvate con successo!', 'success');
        keyOpenAI.value = '';
        keyGemini.value = '';
        keyAnthropic.value = '';
        loadGlobalSettings();
      }
    } catch (err) {
      showToast('❌ Errore durante il salvataggio', 'error');
    }
  });

  globalTelegramForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {};
    if (globalTelegramToken.value) payload.global_telegram_bot_token = globalTelegramToken.value;

    try {
      const res = await apiFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ Token Telegram globale salvato!', 'success');
        globalTelegramToken.value = '';
        loadGlobalSettings();
      }
    } catch (err) {
      showToast('❌ Errore durante il salvataggio', 'error');
    }
  });

  btnTestGlobalTelegram.addEventListener('click', async () => {
    btnTestGlobalTelegram.textContent = 'Invio in corso...';
    try {
      const res = await apiFetch('/api/settings/test-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: globalTelegramToken.value || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('🎉 Messaggio inviato su Telegram!', 'success');
      } else {
        showToast(`❌ Errore: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast('❌ Impossibile contattare Telegram', 'error');
    } finally {
      btnTestGlobalTelegram.textContent = '📲 Invia Messaggio di Test';
    }
  });

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // --- Initial App Bootstrapping ---
  async function initApp() {
    const whCallbackUrl = document.getElementById('whCallbackUrl');
    if (whCallbackUrl) {
      whCallbackUrl.textContent = `${window.location.origin}/api/webhooks/meta`;
    }
    await loadProfiles();
    await loadGlobalSettings();
  }

  checkAuthSession().then(authenticated => {
    if (authenticated) {
      initApp();
    }
  });

  // Periodic inbox refresh every 10s if logged in
  setInterval(() => {
    if (!authToken) return;
    const activeTab = document.querySelector('.nav-tab.active');
    if (activeTab && activeTab.dataset.tab === 'tab-inbox') {
      loadActiveProfileComments();
    }
  }, 10000);
});

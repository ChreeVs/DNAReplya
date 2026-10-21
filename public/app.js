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
  let activeChannelFilter = 'all';
  let activeChannelAccountId = null;
  let activeModalCommentId = null;
  let currentOAuthSessionId = null;

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
  const chanFilterChips = document.querySelectorAll('.chan-filter-chip');
  const btnSyncLiveComments = document.getElementById('btnSyncLiveComments');
  const btnOpenIngestModal = document.getElementById('btnOpenIngestModal');

  // DOM Elements - Tab 2: Channels
  const channelsGrid = document.getElementById('channelsGrid');
  const btnOpenConnectModal = document.getElementById('btnOpenConnectModal');
  const btnConnectFacebook = document.getElementById('btnConnectFacebook');
  const btnConnectFacebookModal = document.getElementById('btnConnectFacebookModal');

  // DOM Elements - Meta Selection Modal
  const selectMetaChannelsModal = document.getElementById('selectMetaChannelsModal');
  const selectMetaChannelsForm = document.getElementById('selectMetaChannelsForm');
  const btnCloseSelectMetaModal = document.getElementById('btnCloseSelectMetaModal');
  const btnCancelSelectMetaModal = document.getElementById('btnCancelSelectMetaModal');
  const listFacebookPages = document.getElementById('listFacebookPages');
  const listInstagramAccounts = document.getElementById('listInstagramAccounts');
  const selectMetaTargetProfile = document.getElementById('selectMetaTargetProfile');

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

  const btnOpenTikTokModal = document.getElementById('btnOpenTikTokModal');
  const connectTikTokModal = document.getElementById('connectTikTokModal');
  const btnCloseTikTokModal = document.getElementById('btnCloseTikTokModal');
  const btnCancelTikTokModal = document.getElementById('btnCancelTikTokModal');
  const connectTikTokForm = document.getElementById('connectTikTokForm');
  const ttAccountName = document.getElementById('ttAccountName');
  const ttAccountHandle = document.getElementById('ttAccountHandle');
  const ttAccessToken = document.getElementById('ttAccessToken');
  const ttBusinessId = document.getElementById('ttBusinessId');

  // Channel Hub Modal
  const btnOpenConnectHubModal = document.getElementById('btnOpenConnectHubModal');
  const connectChannelHubModal = document.getElementById('connectChannelHubModal');
  const btnCloseChannelHubModal = document.getElementById('btnCloseChannelHubModal');
  const btnHubActionMeta = document.getElementById('btnHubActionMeta');
  const btnHubActionTikTok = document.getElementById('btnHubActionTikTok');
  const btnHubActionLinkedIn = document.getElementById('btnHubActionLinkedIn');
  const btnHubActionThreads = document.getElementById('btnHubActionThreads');
  const btnHubOpenManual = document.getElementById('btnHubOpenManual');

  // LinkedIn Modal
  const connectLinkedInModal = document.getElementById('connectLinkedInModal');
  const btnCloseLinkedInModal = document.getElementById('btnCloseLinkedInModal');
  const btnCancelLinkedInModal = document.getElementById('btnCancelLinkedInModal');
  const connectLinkedInForm = document.getElementById('connectLinkedInForm');
  const liAccountName = document.getElementById('liAccountName');
  const liAccountHandle = document.getElementById('liAccountHandle');
  const liAccessToken = document.getElementById('liAccessToken');
  const liOrganizationId = document.getElementById('liOrganizationId');

  // Threads Modal
  const connectThreadsModal = document.getElementById('connectThreadsModal');
  const btnCloseThreadsModal = document.getElementById('btnCloseThreadsModal');
  const btnCancelThreadsModal = document.getElementById('btnCancelThreadsModal');
  const connectThreadsForm = document.getElementById('connectThreadsForm');
  const thAccountName = document.getElementById('thAccountName');
  const thAccountHandle = document.getElementById('thAccountHandle');
  const thAccessToken = document.getElementById('thAccessToken');
  const thUserId = document.getElementById('thUserId');

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
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
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
    teamList.innerHTML = '<p class="field-hint">Caricamento directory utenti...</p>';
    try {
      const res = await apiFetch('/api/auth/all-users');
      const data = await res.json();
      if (!data.success) return;

      const users = data.users || [];
      const pending = users.filter(u => !u.is_approved);
      const active = users.filter(u => u.is_approved);

      badgePendingUsers.textContent = pending.length;
      badgePendingUsers.style.display = pending.length > 0 ? 'inline-block' : 'none';

      let html = '';

      // Section 1: Pending Approvals
      html += `
        <div class="team-section mb-6">
          <h4 style="font-size:0.82rem;font-weight:700;color:var(--lime);margin-bottom:0.75rem;text-transform:uppercase;letter-spacing:0.05em;">
            ⏳ Richieste in Attesa (${pending.length})
          </h4>
      `;

      if (pending.length === 0) {
        html += '<p class="field-hint" style="padding:0.75rem;background:rgba(255,255,255,0.02);border-radius:var(--radius-xs);">Nessuna richiesta in attesa di approvazione.</p>';
      } else {
        html += pending.map(u => `
          <div class="team-member-card mb-3" style="border-left: 3px solid var(--accent-amber);">
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
      }

      html += '</div>';

      // Section 2: Active / Approved Users
      html += `
        <div class="team-section">
          <h4 style="font-size:0.82rem;font-weight:700;color:var(--text-muted);margin-bottom:0.75rem;text-transform:uppercase;letter-spacing:0.05em;">
            ✅ Utenti Registrati & Attivi (${active.length})
          </h4>
      `;

      if (active.length === 0) {
        html += '<p class="field-hint">Nessun utente registrato.</p>';
      } else {
        html += active.map(u => {
          const isOwner = u.role === 'admin' || u.email.toLowerCase().includes('christian.valese');
          return `
            <div class="team-member-card mb-3">
              <div class="member-info">
                <h4>
                  ${escapeHtml(u.name)} 
                  ${isOwner ? '<span style="font-size:0.68rem;padding:0.15rem 0.5rem;border-radius:999px;background:rgba(163,230,53,0.15);color:var(--lime);font-weight:700;margin-left:0.4rem;">👑 Super Admin</span>' : '<span style="font-size:0.68rem;padding:0.15rem 0.5rem;border-radius:999px;background:rgba(34,211,238,0.15);color:var(--accent-cyan);font-weight:700;margin-left:0.4rem;">● Abilitato</span>'}
                </h4>
                <p>${escapeHtml(u.email)} · Registrato il ${new Date(u.created_at).toLocaleDateString('it-IT')}</p>
              </div>
              <div class="member-actions">
                ${!isOwner ? `<button class="btn btn-ghost btn-sm" style="color:var(--accent-rose);border-color:rgba(244,63,94,0.3);" onclick="window.rejectTeamUser('${u.id}')">Revoca Accesso</button>` : '<span style="font-size:0.75rem;color:var(--text-dim);">Titolare</span>'}
              </div>
            </div>
          `;
        }).join('');
      }

      html += '</div>';

      teamList.innerHTML = html;
    } catch (e) {
      teamList.innerHTML = '<p class="auth-alert error">Errore caricamento directory utenti</p>';
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
      renderChannelFilterChips();
    } catch (err) {
      console.error('Error loading channels:', err);
    }
  }

  // Official SVG Logos Helper
  function getPlatformOfficialLogo(platform, size = 18) {
    const p = (platform || '').toLowerCase();
    if (p === 'facebook') {
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="#1877F2" style="vertical-align:middle;flex-shrink:0;"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`;
    }
    if (p === 'instagram') {
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="vertical-align:middle;flex-shrink:0;"><rect width="24" height="24" rx="6" fill="#b900b4"/><path fill="#ffffff" d="M12 7.006a4.994 4.994 0 1 0 0 9.988 4.994 4.994 0 0 0 0-9.988zm0 8.238a3.244 3.244 0 1 1 0-6.488 3.244 3.244 0 0 1 0 6.488zm6.406-8.475a1.169 1.169 0 1 1-2.338 0 1.169 1.169 0 0 1 2.338 0zM12 4.167c2.551 0 2.853.01 3.861.056 2.766.126 4.05 1.42 4.176 4.176.046 1.008.056 1.31.056 3.861s-.01 2.853-.056 3.861c-.126 2.756-1.41 4.05-4.176 4.176-1.008.046-1.31.056-3.861.056s-2.853-.01-3.861-.056c-2.766-.126-4.05-1.42-4.176-4.176-.046-1.008-.056-1.31-.056-3.861s.01-2.853.056-3.861c.126-2.756 1.41-4.05 4.176-4.176 1.008-.046 1.31-.056 3.861-.056zM12 2.417c-2.595 0-2.92.011-3.938.057-3.92.179-6.089 2.348-6.268 6.268-.046 1.018-.057 1.343-.057 3.938s.011 2.92.057 3.938c.179 3.92 2.348 6.089 6.268 6.268 1.018.046 1.343.057 3.938.057s2.92-.011 3.938-.057c3.92-.179 6.089-2.348 6.268-6.268.046-1.018.057-1.343.057-3.938s-.011-2.92-.057-3.938c-.179-3.92-2.348-6.089-6.268-6.268-1.018-.046-1.343-.057-3.938-.057z"/></svg>`;
    }
    if (p === 'tiktok') {
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="#ffffff" style="vertical-align:middle;flex-shrink:0;"><rect width="24" height="24" rx="6" fill="#000000"/><path d="M16.6 5.82s.51.5 1.35.74c.83.24 1.76.15 1.76.15V9.4s-.89-.04-1.74-.32c-.85-.28-1.44-.75-1.44-.75v6.52c0 2.22-1.78 4.02-3.98 4.02-2.2 0-3.98-1.8-3.98-4.02 0-2.22 1.78-4.02 3.98-4.02.42 0 .82.07 1.2.19v2.73a1.45 1.45 0 0 0-.96-.34c-.79 0-1.44.65-1.44 1.44 0 .8.65 1.44 1.44 1.44.79 0 1.44-.64 1.44-1.44V3.88h3.37v1.94z"/></svg>`;
    }
    if (p === 'linkedin') {
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="vertical-align:middle;flex-shrink:0;"><rect width="24" height="24" rx="5" fill="#0A66C2"/><path fill="#ffffff" d="M19 19h-3.125v-4.893c0-1.167-.023-2.67-1.626-2.67-1.629 0-1.878 1.272-1.878 2.585V19H9.246V8.95h2.999v1.374h.042c.418-.792 1.439-1.626 2.962-1.626 3.167 0 3.751 2.085 3.751 4.796V19zM6.556 7.578a1.813 1.813 0 1 1 0-3.626 1.813 1.813 0 0 1 0 3.626zM8.118 19H4.993V8.95h3.125V19z"/></svg>`;
    }
    if (p === 'threads') {
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="vertical-align:middle;flex-shrink:0;"><rect width="24" height="24" rx="6" fill="#141414" stroke="#333" stroke-width="1"/><path fill="#ffffff" d="M12.001 2c-5.522 0-10 4.477-10 10 0 5.521 4.478 10 10 10 5.52 0 10-4.479 10-10 0-5.523-4.48-10-10-10zm3.89 12.396c-.347.165-.773.295-1.28.39a8.134 8.134 0 0 1-1.332.112c-1.884 0-3.085-.882-3.085-2.261 0-1.464 1.285-2.455 3.197-2.455.539 0 1.05.08 1.52.238.384.13.722.316 1.008.556v-.427c0-1.503-.984-2.318-2.633-2.318-.95 0-1.829.288-2.544.83l-.75-1.258c.995-.747 2.215-1.144 3.54-1.144 2.766 0 4.293 1.488 4.293 4.195v4.545h-1.627v-.989c-.104-.012-.209-.012-.307-.012zm-1.07-2.483c-.22-.132-.49-.234-.813-.306a4.43 4.43 0 0 0-.915-.098c-1.096 0-1.782.527-1.782 1.34 0 .736.608 1.22 1.637 1.22.428 0 .806-.056 1.135-.168.324-.11.572-.256.738-.435v-1.553z"/></svg>`;
    }
    return `🌐`;
  }

  // Dynamically renders filter chips ONLY for connected channels
  function renderChannelFilterChips() {
    const container = document.getElementById('channelFilterGroup');
    if (!container) return;

    if (!activeProfileAccounts || activeProfileAccounts.length === 0) {
      container.innerHTML = '<span class="field-hint" style="margin:0;font-size:0.75rem;">Nessun canale collegato</span>';
      return;
    }

    let html = `<button class="chan-filter-chip ${activeChannelFilter === 'all' ? 'active' : ''}" data-chan="all">🌐 Tutti i Canali (${activeProfileAccounts.length})</button>`;

    activeProfileAccounts.forEach(acc => {
      const logo = getPlatformOfficialLogo(acc.platform, 16);
      const handle = acc.account_handle || acc.account_name;
      const isActive = activeChannelAccountId === acc.id;
      html += `<button class="chan-filter-chip ${isActive ? 'active' : ''}" data-chan="${acc.platform.toLowerCase()}" data-account-id="${acc.id}">
        ${logo} <span style="margin-left:4px;">${escapeHtml(handle)}</span>
      </button>`;
    });

    container.innerHTML = html;

    container.querySelectorAll('.chan-filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        container.querySelectorAll('.chan-filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeChannelFilter = chip.dataset.chan;
        activeChannelAccountId = chip.dataset.accountId || null;
        renderFeed(filterComments(activeProfileComments));
      });
    });
  }

  function renderChannels(accounts) {
    if (!accounts || accounts.length === 0) {
      channelsGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <span class="empty-icon">🌐</span>
          <p>Nessun canale collegato a questo profilo.<br>Clicca su "Connetti Canale" per collegare Instagram, Facebook, TikTok, LinkedIn o Threads.</p>
        </div>
      `;
      return;
    }

    channelsGrid.innerHTML = accounts.map(acc => {
      const logo = getPlatformOfficialLogo(acc.platform, 24);
      const platformName = acc.platform.charAt(0).toUpperCase() + acc.platform.slice(1);
      return `
        <div class="channel-card">
          <div class="channel-card-top">
            <div style="display:flex;align-items:center;gap:0.55rem;">
              ${logo}
              <span class="channel-badge">${escapeHtml(platformName)}</span>
            </div>
            <span class="channel-status ${acc.status}">${acc.status === 'connected' ? '● Collegato' : 'Disconnesso'}</span>
          </div>
          <div>
            <div class="channel-name">${escapeHtml(acc.account_name)}</div>
            <div class="channel-handle">@${escapeHtml(acc.account_handle.replace(/^@/, ''))}</div>
          </div>
          <div class="channel-notes">${escapeHtml(acc.notes || 'Canale configurato per questo profilo')}</div>
          <div class="channel-card-bottom">
            <button class="btn btn-ghost btn-sm" onclick="window.disconnectAccount('${acc.id}')">Disconnetti</button>
          </div>
        </div>
      `;
    }).join('');
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

  // Connect Account Modal & Facebook OAuth
  function initiateFacebookOAuth() {
    if (!activeProfile) {
      showToast('⚠️ Seleziona prima un profilo cliente a cui collegare i canali', 'error');
      return;
    }
    // Save current active profile ID in localStorage in case state needs to be preserved
    localStorage.setItem('dnareplya_oauth_profile', activeProfile.id);
    window.location.href = `/api/auth/facebook?profileId=${encodeURIComponent(activeProfile.id)}`;
  }

  if (btnConnectFacebook) btnConnectFacebook.addEventListener('click', initiateFacebookOAuth);
  if (btnConnectFacebookModal) btnConnectFacebookModal.addEventListener('click', initiateFacebookOAuth);

  // Channel Hub Modal Handlers
  if (btnOpenConnectHubModal) {
    btnOpenConnectHubModal.addEventListener('click', () => {
      if (!activeProfile) {
        showToast('⚠️ Seleziona prima un profilo cliente a cui collegare i canali', 'error');
        return;
      }
      connectChannelHubModal.classList.remove('hidden');
    });
  }
  if (btnCloseChannelHubModal) {
    btnCloseChannelHubModal.addEventListener('click', () => {
      connectChannelHubModal.classList.add('hidden');
    });
  }
  if (btnHubActionMeta) {
    btnHubActionMeta.addEventListener('click', () => {
      connectChannelHubModal.classList.add('hidden');
      initiateFacebookOAuth();
    });
  }
  if (btnHubActionTikTok) {
    btnHubActionTikTok.addEventListener('click', () => {
      connectChannelHubModal.classList.add('hidden');
      if (connectTikTokModal) connectTikTokModal.classList.remove('hidden');
    });
  }
  if (btnHubActionLinkedIn) {
    btnHubActionLinkedIn.addEventListener('click', () => {
      connectChannelHubModal.classList.add('hidden');
      if (connectLinkedInModal) connectLinkedInModal.classList.remove('hidden');
    });
  }
  if (btnHubActionThreads) {
    btnHubActionThreads.addEventListener('click', () => {
      connectChannelHubModal.classList.add('hidden');
      if (connectThreadsModal) connectThreadsModal.classList.remove('hidden');
    });
  }
  if (btnHubOpenManual) {
    btnHubOpenManual.addEventListener('click', () => {
      connectChannelHubModal.classList.add('hidden');
      if (connectAccountModal) connectAccountModal.classList.remove('hidden');
    });
  }

  // Legacy Manual Connect Modal Handlers
  if (btnOpenConnectModal) btnOpenConnectModal.addEventListener('click', () => connectAccountModal.classList.remove('hidden'));
  if (btnCloseConnectModal) btnCloseConnectModal.addEventListener('click', () => connectAccountModal.classList.add('hidden'));
  if (btnCancelConnectModal) btnCancelConnectModal.addEventListener('click', () => connectAccountModal.classList.add('hidden'));

  // Connect TikTok Business Modal Handler
  if (btnOpenTikTokModal) {
    btnOpenTikTokModal.addEventListener('click', () => {
      if (!activeProfile) {
        showToast('⚠️ Seleziona prima un profilo cliente a cui collegare TikTok', 'error');
        return;
      }
      connectTikTokModal.classList.remove('hidden');
    });
  }
  if (btnCloseTikTokModal) btnCloseTikTokModal.addEventListener('click', () => connectTikTokModal.classList.add('hidden'));
  if (btnCancelTikTokModal) btnCancelTikTokModal.addEventListener('click', () => connectTikTokModal.classList.add('hidden'));

  // Connect LinkedIn Modal Handlers
  if (btnCloseLinkedInModal) btnCloseLinkedInModal.addEventListener('click', () => connectLinkedInModal.classList.add('hidden'));
  if (btnCancelLinkedInModal) btnCancelLinkedInModal.addEventListener('click', () => connectLinkedInModal.classList.add('hidden'));

  if (connectLinkedInForm) {
    connectLinkedInForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeProfile) return;

      const submitBtn = document.getElementById('btnSubmitLinkedIn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Salvataggio...';
      }

      const payload = {
        platform: 'linkedin',
        account_name: liAccountName.value.trim(),
        account_handle: liAccountHandle.value.trim().replace(/^@/, ''),
        access_token: liAccessToken.value.trim(),
        external_account_id: liOrganizationId.value.trim(),
        notes: 'LinkedIn Company Page (Community API)',
      };

      try {
        const res = await apiFetch(`/api/profiles/${activeProfile.id}/accounts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          showToast('💼 Pagina LinkedIn collegata con successo!', 'success');
          connectLinkedInModal.classList.add('hidden');
          connectLinkedInForm.reset();
          await loadActiveProfileChannels();
        } else {
          showToast(`❌ Errore: ${data.error}`, 'error');
        }
      } catch (err) {
        showToast('❌ Errore di rete durante il salvataggio LinkedIn', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = '💼 Salva e Collega LinkedIn';
        }
      }
    });
  }

  // Connect Threads Modal Handlers
  if (btnCloseThreadsModal) btnCloseThreadsModal.addEventListener('click', () => connectThreadsModal.classList.add('hidden'));
  if (btnCancelThreadsModal) btnCancelThreadsModal.addEventListener('click', () => connectThreadsModal.classList.add('hidden'));

  if (connectThreadsForm) {
    connectThreadsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeProfile) return;

      const submitBtn = document.getElementById('btnSubmitThreads');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Salvataggio...';
      }

      const payload = {
        platform: 'threads',
        account_name: thAccountName.value.trim(),
        account_handle: thAccountHandle.value.trim().replace(/^@/, ''),
        access_token: thAccessToken.value.trim(),
        external_account_id: thUserId.value.trim(),
        notes: 'Threads Official Account (Threads API)',
      };

      try {
        const res = await apiFetch(`/api/profiles/${activeProfile.id}/accounts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          showToast('🧵 Account Threads collegato con successo!', 'success');
          connectThreadsModal.classList.add('hidden');
          connectThreadsForm.reset();
          await loadActiveProfileChannels();
        } else {
          showToast(`❌ Errore: ${data.error}`, 'error');
        }
      } catch (err) {
        showToast('❌ Errore di rete durante il salvataggio Threads', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = '🧵 Salva e Collega Threads';
        }
      }
    });
  }

  if (connectTikTokForm) {
    connectTikTokForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeProfile) return;

      const submitBtn = document.getElementById('btnSubmitTikTok');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Salvataggio...';
      }

      const payload = {
        platform: 'tiktok',
        account_name: ttAccountName.value.trim(),
        account_handle: ttAccountHandle.value.trim().replace(/^@/, ''),
        access_token: ttAccessToken.value.trim(),
        external_account_id: ttBusinessId.value.trim(),
        notes: 'TikTok Business Account (Uso Interno)',
      };

      try {
        const res = await apiFetch(`/api/profiles/${activeProfile.id}/accounts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          showToast('🎵 Account TikTok collegato con successo!', 'success');
          connectTikTokModal.classList.add('hidden');
          connectTikTokForm.reset();
          await loadActiveProfileChannels();
        } else {
          showToast(`❌ Errore: ${data.error}`, 'error');
        }
      } catch (err) {
        showToast('❌ Errore di rete durante il salvataggio TikTok', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = '🎵 Salva e Collega TikTok';
        }
      }
    });
  }

  connectAccountForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeProfile) return;

    const payload = {
      platform: document.getElementById('connPlatform').value,
      account_name: document.getElementById('connAccountName').value.trim(),
      account_handle: document.getElementById('connAccountHandle').value.trim(),
      external_account_id: document.getElementById('connExternalId').value.trim(),
      access_token: document.getElementById('connAccessToken')?.value.trim() || '',
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

  // --- Meta Channel Selection Modal (Single Facebook Page & Instagram Profile) ---
  async function openSelectMetaModal(sessionId) {
    currentOAuthSessionId = sessionId;
    try {
      const res = await apiFetch(`/api/auth/facebook/session?sessionId=${sessionId}`);
      const data = await res.json();
      if (!data.success) {
        showToast(`❌ ${data.error}`, 'error');
        return;
      }

      selectMetaTargetProfile.innerHTML = `Profilo cliente: <b>${escapeHtml(data.profileName)}</b>`;

      // Update badges
      const fbCountPill = document.getElementById('fbCountPill');
      const igCountPill = document.getElementById('igCountPill');
      if (fbCountPill) fbCountPill.textContent = `${data.pages?.length || 0} Disponibili`;

      // 1. Render Facebook Pages Radios
      if (!data.pages || data.pages.length === 0) {
        listFacebookPages.innerHTML = '<p class="field-hint" style="padding:1rem;">Nessuna pagina Facebook trovata con permessi admin.</p>';
      } else {
        let pagesHtml = data.pages.map((p, index) => `
          <div class="meta-channel-tile ${index === 0 ? 'selected' : ''}" data-type="facebook" data-id="${p.id}">
            <div class="tile-radio-indicator">
              <div class="radio-inner-dot"></div>
            </div>
            <div class="tile-icon-box fb">
              <span>📘</span>
            </div>
            <div class="tile-content">
              <div class="tile-title-row">
                <h5 class="tile-name">${escapeHtml(p.name)}</h5>
                ${p.category ? `<span class="tile-category-badge">${escapeHtml(p.category)}</span>` : ''}
              </div>
              <div class="tile-meta-row">
                <span class="tile-id">ID: ${p.id}</span>
                ${p.hasInstagram ? `<span class="tile-badge-ig-linked">🔗 Instagram Business Collegato</span>` : ''}
              </div>
            </div>
            <input type="radio" name="selectedFacebookPage" value="${p.id}" ${index === 0 ? 'checked' : ''} class="tile-native-radio">
          </div>
        `).join('');

        pagesHtml += `
          <div class="meta-channel-tile tile-opt-out" data-type="facebook" data-id="none">
            <div class="tile-radio-indicator">
              <div class="radio-inner-dot"></div>
            </div>
            <div class="tile-icon-box none">
              <span>🚫</span>
            </div>
            <div class="tile-content">
              <h5 class="tile-name text-muted">Nessuna Pagina Facebook</h5>
              <span class="tile-meta-desc">Non associare pagine Facebook a questo profilo</span>
            </div>
            <input type="radio" name="selectedFacebookPage" value="none" class="tile-native-radio">
          </div>
        `;
        listFacebookPages.innerHTML = pagesHtml;
      }

      // 2. Render Instagram Accounts Radios
      const igPages = data.pages.filter(p => p.hasInstagram && p.instagram);
      if (igCountPill) igCountPill.textContent = `${igPages.length} Disponibili`;

      if (igPages.length === 0) {
        listInstagramAccounts.innerHTML = '<p class="field-hint" style="padding:1rem;">Nessun account Instagram Business associato alle tue pagine Facebook.</p>';
      } else {
        let igHtml = igPages.map((p, index) => `
          <div class="meta-channel-tile ${index === 0 ? 'selected' : ''}" data-type="instagram" data-id="${p.instagram.id}">
            <div class="tile-radio-indicator">
              <div class="radio-inner-dot"></div>
            </div>
            <div class="tile-icon-box ig">
              <span>📸</span>
            </div>
            <div class="tile-content">
              <div class="tile-title-row">
                <h5 class="tile-name">@${escapeHtml(p.instagram.username || p.instagram.name)}</h5>
                <span class="tile-category-badge ig-badge">IG Business</span>
              </div>
              <div class="tile-meta-row">
                <span class="tile-meta-desc">Pagina associata: <b>${escapeHtml(p.name)}</b></span>
              </div>
            </div>
            <input type="radio" name="selectedInstagram" value="${p.instagram.id}" ${index === 0 ? 'checked' : ''} class="tile-native-radio">
          </div>
        `).join('');

        igHtml += `
          <div class="meta-channel-tile tile-opt-out" data-type="instagram" data-id="none">
            <div class="tile-radio-indicator">
              <div class="radio-inner-dot"></div>
            </div>
            <div class="tile-icon-box none">
              <span>🚫</span>
            </div>
            <div class="tile-content">
              <h5 class="tile-name text-muted">Nessun Profilo Instagram</h5>
              <span class="tile-meta-desc">Non associare account Instagram a questo profilo</span>
            </div>
            <input type="radio" name="selectedInstagram" value="none" class="tile-native-radio">
          </div>
        `;
        listInstagramAccounts.innerHTML = igHtml;
      }

      // Enhanced tile click highlight
      document.querySelectorAll('#listFacebookPages .meta-channel-tile, #listInstagramAccounts .meta-channel-tile').forEach(tile => {
        tile.addEventListener('click', () => {
          const radio = tile.querySelector('input[type="radio"]');
          if (radio) {
            radio.checked = true;
            const container = tile.closest('.channel-radio-grid');
            container.querySelectorAll('.meta-channel-tile').forEach(t => t.classList.remove('selected'));
            tile.classList.add('selected');
          }
        });
      });

      selectMetaChannelsModal.classList.remove('hidden');
    } catch (err) {
      showToast('❌ Errore caricamento canali Meta', 'error');
    }
  }

  if (btnCloseSelectMetaModal) btnCloseSelectMetaModal.addEventListener('click', () => selectMetaChannelsModal.classList.add('hidden'));
  if (btnCancelSelectMetaModal) btnCancelSelectMetaModal.addEventListener('click', () => selectMetaChannelsModal.classList.add('hidden'));

  if (selectMetaChannelsForm) {
    selectMetaChannelsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentOAuthSessionId) return;

      const selectedFb = document.querySelector('input[name="selectedFacebookPage"]:checked')?.value || 'none';
      const selectedIg = document.querySelector('input[name="selectedInstagram"]:checked')?.value || 'none';

      const submitBtn = document.getElementById('btnSubmitSelectMeta');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Salvataggio in corso...';

      try {
        const res = await apiFetch('/api/auth/facebook/select', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: currentOAuthSessionId,
            selectedFacebookPageId: selectedFb,
            selectedInstagramId: selectedIg,
          }),
        });
        const data = await res.json();
        if (data.success) {
          showToast(`🎉 ${data.message}`, 'success');
          selectMetaChannelsModal.classList.add('hidden');
          currentOAuthSessionId = null;

          if (data.profileId) {
            selectProfile(data.profileId);
          }
          const channelsNavBtn = document.querySelector('.nav-tab[data-tab="tab-channels"]');
          if (channelsNavBtn) channelsNavBtn.click();
          loadActiveProfileChannels();
        } else {
          showToast(`❌ ${data.error}`, 'error');
        }
      } catch (err) {
        showToast('❌ Errore durante il salvataggio dei canali', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '💾 Collega Canali Selezionati';
      }
    });
  }

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
    return (comments || []).filter(c => {
      // 1. EXCLUDE SELF-COMMENTS: Filter out comments posted by the connected client account itself
      const isSelfComment = (activeProfileAccounts || []).some(acc => {
        const accHandle = (acc.account_handle || '').replace(/^@/, '').toLowerCase().trim();
        const accName = (acc.account_name || '').toLowerCase().trim();
        const extId = (acc.external_account_id || '').trim();

        const cUser = (c.author_username || '').replace(/^(@|fb_)/, '').toLowerCase().trim();
        const cName = (c.author_name || '').toLowerCase().trim();

        if (extId && (cUser === extId || c.platform_comment_id?.startsWith(extId))) return true;
        if (accHandle && (cUser === accHandle || cName === accHandle)) return true;
        if (accName && (cName === accName || cUser === accName)) return true;
        return false;
      });
      if (isSelfComment) return false;

      // 2. Status Filter
      let statusMatch = true;
      if (activeFilter === 'pending') {
        statusMatch = c.status === 'pending';
      } else if (activeFilter === 'approved') {
        statusMatch = (c.status === 'approved' || c.status === 'modified' || c.status === 'auto_replied');
      }

      // 3. Connected Channel Filter
      let channelMatch = true;
      if (activeChannelFilter !== 'all') {
        if (activeChannelAccountId) {
          channelMatch = c.social_account_id === activeChannelAccountId || (c.platform && c.platform.toLowerCase() === activeChannelFilter.toLowerCase());
        } else {
          channelMatch = (c.platform && c.platform.toLowerCase() === activeChannelFilter.toLowerCase());
        }
      }

      return statusMatch && channelMatch;
    });
  }

  function updateCommentsMetrics() {
    const filteredPending = (activeProfileComments || []).filter(c => {
      const isSelf = (activeProfileAccounts || []).some(acc => {
        const handle = (acc.account_handle || '').replace(/^@/, '').toLowerCase().trim();
        const name = (acc.account_name || '').toLowerCase().trim();
        const extId = (acc.external_account_id || '').trim();
        const cUser = (c.author_username || '').replace(/^(@|fb_)/, '').toLowerCase().trim();
        const cName = (c.author_name || '').toLowerCase().trim();
        return (extId && (cUser === extId || c.platform_comment_id?.startsWith(extId))) ||
               (handle && (cUser === handle || cName === handle)) ||
               (name && (cName === name || cUser === name));
      });
      return !isSelf && c.status === 'pending';
    }).length;

    const filteredApproved = (activeProfileComments || []).filter(c => {
      const isSelf = (activeProfileAccounts || []).some(acc => {
        const handle = (acc.account_handle || '').replace(/^@/, '').toLowerCase().trim();
        const name = (acc.account_name || '').toLowerCase().trim();
        const extId = (acc.external_account_id || '').trim();
        const cUser = (c.author_username || '').replace(/^(@|fb_)/, '').toLowerCase().trim();
        const cName = (c.author_name || '').toLowerCase().trim();
        return (extId && (cUser === extId || c.platform_comment_id?.startsWith(extId))) ||
               (handle && (cUser === handle || cName === handle)) ||
               (name && (cName === name || cUser === name));
      });
      return !isSelf && (c.status === 'approved' || c.status === 'modified' || c.status === 'auto_replied');
    }).length;

    statPendingComments.textContent = filteredPending;
    statApprovedComments.textContent = filteredApproved;
    inboxCountBadge.textContent = filteredPending;
  }

  function renderFeed(comments) {
    if (!comments || comments.length === 0) {
      feedList.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📭</span>
          <p>Nessun commento trovato per questo filtro.<br>I commenti reali appariranno qui automaticamente ad ogni sincronizzazione.</p>
        </div>
      `;
      return;
    }

    feedList.innerHTML = comments.map(c => {
      const logo = getPlatformOfficialLogo(c.platform, 18);
      const platformName = (c.platform || '').charAt(0).toUpperCase() + (c.platform || '').slice(1);
      const statusLabels = {
        pending: 'In Attesa Approvazione',
        approved: 'Approvato',
        modified: 'Modificato & Inviato',
        rejected: 'Scartato',
        auto_replied: 'Auto-Pilot Inviato',
      };

      const displayReply = c.final_reply || c.proposed_reply;

      // Extract real human author name instead of raw numerical fb_id
      let authorDisplayName = c.author_name;
      if (!authorDisplayName || authorDisplayName === 'Utente Social' || authorDisplayName.startsWith('fb_') || authorDisplayName.startsWith('utente_')) {
        if (c.author_username && !c.author_username.startsWith('fb_') && !c.author_username.startsWith('utente_')) {
          authorDisplayName = c.author_username.replace(/^@/, '');
        } else {
          authorDisplayName = c.platform === 'facebook' ? 'Utente Facebook' : 'Utente Instagram';
        }
      }

      const initial = (authorDisplayName.charAt(0) || '👤').toUpperCase();
      const postSnippetText = c.post_snippet ? `su "${escapeHtml(c.post_snippet)}"` : '';

      const isErrorReply = Boolean(displayReply && displayReply.startsWith('[Errore AI'));
      const isDraftReply = Boolean(displayReply && displayReply.startsWith('[Bozza]'));

      return `
        <div class="feed-card" id="card-${c.id}">
          <div>
            <div class="feed-card-header">
              <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                <span class="card-platform-badge" style="display:inline-flex;align-items:center;gap:0.4rem;">
                  ${logo}
                  <span style="font-weight:600;">${escapeHtml(platformName)}</span>
                </span>
                <span class="status-badge ${c.status}">${statusLabels[c.status] || c.status}</span>
              </div>
              <button class="btn-card-action reject btn-delete-comment" style="padding:0.25rem 0.65rem;font-size:0.75rem;border-radius:var(--radius-xs);display:flex;align-items:center;gap:0.35rem;" onclick="window.deleteComment('${c.id}')" title="Elimina definitivamente questo commento dall'inbox">
                🗑️ Elimina
              </button>
            </div>

            <div class="feed-author-row">
              <div class="author-avatar">${escapeHtml(initial)}</div>
              <div class="author-info">
                <span class="author-fullname">${escapeHtml(authorDisplayName)}</span>
                ${postSnippetText ? `<span class="author-context">${postSnippetText}</span>` : ''}
              </div>
            </div>

            <div class="feed-comment-bubble">
              "${escapeHtml(c.comment_text)}"
            </div>

            <div class="feed-proposed-box ${isErrorReply ? 'error-box' : ''}">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.35rem;">
                <span class="proposed-label" style="${isErrorReply ? 'color:var(--accent-rose);font-weight:700;' : ''}">
                  ${isErrorReply ? '⚠️ Avviso AI Gemini:' : (c.status === 'pending' ? '🤖 Proposta Risposta AI:' : '📤 Risposta Finale Pubblicata:')}
                </span>
                ${isErrorReply ? `<button class="btn btn-ghost btn-sm" style="font-size:0.75rem;padding:0.2rem 0.55rem;color:var(--lime);border-color:var(--border-active);" onclick="window.regenerateComment('${c.id}')">🔄 Risolvi con Gemini 2.0</button>` : ''}
              </div>
              <p class="proposed-text" style="${isErrorReply ? 'color:#fca5a5;font-size:0.82rem;' : ''}">${escapeHtml(displayReply || 'Nessuna risposta disponibile')}</p>
            </div>
          </div>

          ${c.status === 'pending' ? `
            <div class="feed-card-actions">
              <button class="btn-card-action approve" onclick="window.approveComment('${c.id}')">🟢 Approva e Invia</button>
              <button class="btn-card-action regen" onclick="window.regenerateComment('${c.id}')">🔄 Rigenera</button>
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

  chanFilterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      chanFilterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeChannelFilter = chip.dataset.chan;
      renderFeed(filterComments(activeProfileComments));
    });
  });

  if (btnSyncLiveComments) {
    btnSyncLiveComments.addEventListener('click', async () => {
      if (!activeProfile) {
        showToast('Seleziona prima un profilo cliente', 'error');
        return;
      }
      btnSyncLiveComments.disabled = true;
      btnSyncLiveComments.textContent = '⏳ Sincronizzazione...';
      try {
        const res = await apiFetch(`/api/comments/sync?profileId=${activeProfile.id}`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showToast(`✅ ${data.message}`, 'success');
          await loadActiveProfileComments();
        } else {
          showToast(`❌ Errore: ${data.error}`, 'error');
        }
      } catch (err) {
        showToast('❌ Errore durante la sincronizzazione live', 'error');
      } finally {
        btnSyncLiveComments.disabled = false;
        btnSyncLiveComments.textContent = '⚡ Sincronizza Live';
      }
    });
  }

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
  window.regenerateComment = async (id) => {
    try {
      showToast('🔄 Generazione nuova risposta AI in corso...', 'info');
      const res = await apiFetch(`/api/comments/${id}/regenerate`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('✨ Risposta AI rigenerata con successo!', 'success');
        loadActiveProfileComments();
      } else {
        showToast(`❌ Errore: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast('❌ Errore durante la rigenerazione', 'error');
    }
  };

  window.approveComment = async (id) => {
    const card = document.getElementById(`card-${id}`);
    const btn = card?.querySelector('.btn-card-action.approve');

    const comment = (activeProfileComments || []).find(c => c.id === id);
    const replyText = comment ? (comment.final_reply || comment.proposed_reply || '') : '';
    if (replyText.startsWith('[Errore AI') || replyText.startsWith('[Bozza]')) {
      const wantRegen = confirm('Attenzione: La risposta attuale contiene un messaggio di errore o bozza temporanea.\n\nVuoi rigenerare la risposta con l\'AI prima di inviarla?');
      if (wantRegen) {
        window.regenerateComment(id);
        return;
      }
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Invio in corso...';
    }
    showToast('⏳ Approvazione e invio in corso...', 'info');

    try {
      const res = await apiFetch(`/api/comments/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ final_reply: replyText }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.publishedToSocial) {
          showToast(`🎉 ${data.message}`, 'success');
        } else {
          showToast(`✅ ${data.message}`, 'info');
        }
        await loadActiveProfileComments();
        await loadActiveProfileMemory();
      } else {
        showToast(`❌ Errore approvazione: ${data.error}`, 'error');
        if (btn) {
          btn.disabled = false;
          btn.textContent = '🟢 Approva e Invia';
        }
      }
    } catch (err) {
      console.error('Approve error:', err);
      showToast('❌ Errore durante l\'approvazione', 'error');
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🟢 Approva e Invia';
      }
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

  window.deleteComment = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare definitivamente questo commento dall\'inbox? L\'operazione non è reversibile.')) {
      return;
    }
    try {
      showToast('Eliminazione commento in corso...', 'info');
      const res = await apiFetch(`/api/comments/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('🗑️ Commento eliminato definitivamente dall\'inbox', 'success');
        await loadActiveProfileComments();
      } else {
        showToast(`❌ Errore: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast('❌ Errore durante l\'eliminazione del commento', 'error');
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

    btnModalSubmit.disabled = true;
    btnModalSubmit.textContent = '⏳ Invio in corso...';

    try {
      const res = await apiFetch(`/api/comments/${activeModalCommentId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ final_reply: customText }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`🎉 ${data.message}`, 'success');
        replyModal.classList.add('hidden');
        await loadActiveProfileComments();
        await loadActiveProfileMemory();
      } else {
        showToast(`❌ ${data.error}`, 'error');
      }
    } catch (err) {
      showToast('❌ Errore salvataggio', 'error');
    } finally {
      btnModalSubmit.disabled = false;
      btnModalSubmit.textContent = '✅ Approva & Memorizza';
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
      <div class="memory-card" id="memory-card-${item.id}">
        <div class="memory-card-header">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="card-platform-badge">${item.platform.toUpperCase()}</span>
            <span class="memory-date">${new Date(item.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <button class="btn-card-action reject" style="padding: 0.25rem 0.65rem; font-size: 0.76rem; border-radius: var(--radius-xs); display: flex; align-items: center; gap: 0.35rem;" onclick="window.deleteMemoryItem('${item.id}')" title="Elimina questo esempio dalla memoria di apprendimento dell'AI">
            🗑️ Elimina
          </button>
        </div>
        <div class="memory-comment">💬 "${escapeHtml(item.comment_text)}"</div>
        <div class="memory-reply">🎯 "${escapeHtml(item.approved_reply)}"</div>
      </div>
    `).join('');
  }

  window.deleteMemoryItem = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare questo commento dalla memoria di apprendimento dell\'AI? L\'AI non utilizzerà più questo esempio per comporre le future risposte.')) {
      return;
    }

    try {
      showToast('Eliminazione in corso...', 'info');
      const res = await apiFetch(`/api/comments/approved-memory/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('🗑️ Esempio rimosso con successo dalla memoria AI', 'success');
        await loadActiveProfileMemory();
      } else {
        showToast(`❌ Errore: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast('❌ Errore durante l\'eliminazione dalla memoria', 'error');
    }
  };

  btnRefreshMemory.addEventListener('click', loadActiveProfileMemory);

  // --- 8. Tab 5: BYOK & Global Telegram ---
  async function loadGlobalSettings() {
    try {
      const res = await apiFetch('/api/settings');
      const data = await res.json();
      if (!data.success) return;

      const s = data.settings;
      defaultAiProvider.value = s.default_ai_provider || 'openai';

      updateBadge(badgeOpenAI, s.has_openai, s.api_key_openai_masked, 'btnRemoveOpenAI');
      updateBadge(badgeGemini, s.has_gemini, s.api_key_gemini_masked, 'btnRemoveGemini');
      updateBadge(badgeAnthropic, s.has_anthropic, s.api_key_anthropic_masked, 'btnRemoveAnthropic');
      updateBadge(badgeGlobalTelegram, s.has_telegram, s.telegram_bot_token_masked, 'btnRemoveTelegram');
    } catch (err) {
      console.error('Error loading global settings:', err);
    }
  }

  function updateBadge(badgeEl, isConfigured, maskedVal, removeBtnId = null) {
    if (!badgeEl) return;
    const removeBtn = removeBtnId ? document.getElementById(removeBtnId) : null;
    if (isConfigured) {
      badgeEl.className = 'key-status-badge active';
      badgeEl.textContent = `Configurata (${maskedVal})`;
      if (removeBtn) removeBtn.classList.remove('hidden');
    } else {
      badgeEl.className = 'key-status-badge';
      badgeEl.textContent = 'Non configurata';
      if (removeBtn) removeBtn.classList.add('hidden');
    }
  }

  window.removeApiKey = async (key) => {
    const keyLabels = {
      openai: 'OpenAI',
      gemini: 'Google Gemini',
      anthropic: 'Anthropic Claude',
      telegram: 'Telegram Bot Token',
    };
    const name = keyLabels[key] || key;
    if (!confirm(`Sei sicuro di voler rimuovere la chiave API per ${name}? L'applicazione non utilizzerà più questo provider a meno che non reinserisci una nuova chiave.`)) {
      return;
    }

    try {
      showToast(`Rimozione chiave ${name} in corso...`, 'info');
      const res = await apiFetch('/api/settings/remove-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`🗑️ Chiave ${name} rimossa con successo!`, 'success');
        if (key === 'openai') keyOpenAI.value = '';
        if (key === 'gemini') keyGemini.value = '';
        if (key === 'anthropic') keyAnthropic.value = '';
        if (key === 'telegram') globalTelegramToken.value = '';
        await loadGlobalSettings();
      } else {
        showToast(`❌ Errore: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast('❌ Errore durante la rimozione della chiave', 'error');
    }
  };

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

    // Check if returning from Facebook OAuth with a selection session
    const urlParams = new URLSearchParams(window.location.search);
    const fbSelectSession = urlParams.get('fb_select_session');
    if (fbSelectSession) {
      window.history.replaceState({}, document.title, window.location.pathname);
      openSelectMetaModal(fbSelectSession);
    } else if (urlParams.get('fb_connected') === 'success') {
      const count = urlParams.get('count') || '0';
      showToast(`🎉 Connessione Meta riuscita! ${count} canali collegati con successo.`, 'success');
      const savedProfileId = localStorage.getItem('dnareplya_oauth_profile');
      if (savedProfileId && profiles.some(p => p.id === savedProfileId)) {
        selectProfile(savedProfileId);
      }
      const channelsNavBtn = document.querySelector('.nav-tab[data-tab="tab-channels"]');
      if (channelsNavBtn) channelsNavBtn.click();
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('fb_error')) {
      const err = urlParams.get('fb_error');
      showToast(`❌ Errore Meta OAuth: ${decodeURIComponent(err)}`, 'error');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
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

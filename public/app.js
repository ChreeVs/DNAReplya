// DNAReplya Dashboard Frontend Logic
document.addEventListener('DOMContentLoaded', () => {
  // State
  let currentSettings = {};
  let currentComments = [];
  let currentMemory = [];
  let activeModalCommentId = null;

  // DOM Elements - Tabs
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // DOM Elements - Simulator
  const platformButtons = document.querySelectorAll('.platform-btn');
  const simPlatformInput = document.getElementById('simPlatform');
  const simulatorForm = document.getElementById('simulatorForm');
  const simAuthorInput = document.getElementById('simAuthor');
  const simPostSnippetInput = document.getElementById('simPostSnippet');
  const simCommentTextInput = document.getElementById('simCommentText');
  const presetChips = document.querySelectorAll('.chip-btn');
  const btnSimulate = document.getElementById('btnSimulate');

  // DOM Elements - Feed & Metrics
  const feedList = document.getElementById('feedList');
  const btnRefreshFeed = document.getElementById('btnRefreshFeed');
  const metricTotalComments = document.getElementById('metricTotalComments');
  const metricApproved = document.getElementById('metricApproved');
  const metricMemory = document.getElementById('metricMemory');
  const metricMode = document.getElementById('metricMode');
  const memoryCountBadge = document.getElementById('memoryCountBadge');

  // DOM Elements - Settings Forms
  const aiSettingsForm = document.getElementById('aiSettingsForm');
  const aiProviderSelect = document.getElementById('aiProvider');
  const aiModelInput = document.getElementById('aiModel');
  const apiKeyOpenAI = document.getElementById('apiKeyOpenAI');
  const apiKeyGemini = document.getElementById('apiKeyGemini');
  const apiKeyAnthropic = document.getElementById('apiKeyAnthropic');
  const apiKeyGroq = document.getElementById('apiKeyGroq');

  const badgeOpenAI = document.getElementById('badgeOpenAI');
  const badgeGemini = document.getElementById('badgeGemini');
  const badgeAnthropic = document.getElementById('badgeAnthropic');
  const badgeGroq = document.getElementById('badgeGroq');
  const badgeTelegram = document.getElementById('badgeTelegram');

  const telegramSettingsForm = document.getElementById('telegramSettingsForm');
  const telegramBotToken = document.getElementById('telegramBotToken');
  const telegramChatId = document.getElementById('telegramChatId');
  const btnTestTelegram = document.getElementById('btnTestTelegram');

  // DOM Elements - Guardrails
  const guardrailsForm = document.getElementById('guardrailsForm');
  const toneOfVoiceSelect = document.getElementById('toneOfVoice');
  const maxReplyLengthSlider = document.getElementById('maxReplyLength');
  const charLengthDisplay = document.getElementById('charLengthDisplay');
  const customToneInstructions = document.getElementById('customToneInstructions');
  const businessKnowledge = document.getElementById('businessKnowledge');
  const forbiddenWords = document.getElementById('forbiddenWords');
  const autoPilotToggle = document.getElementById('autoPilotToggle');

  // DOM Elements - Memory Tab
  const memoryList = document.getElementById('memoryList');
  const btnRefreshMemory = document.getElementById('btnRefreshMemory');

  // DOM Elements - Modal
  const replyModal = document.getElementById('replyModal');
  const modalAuthor = document.getElementById('modalAuthor');
  const modalComment = document.getElementById('modalComment');
  const modalReplyText = document.getElementById('modalReplyText');
  const btnModalClose = document.getElementById('btnModalClose');
  const btnModalCancel = document.getElementById('btnModalCancel');
  const btnModalSubmit = document.getElementById('btnModalSubmit');

  // --- 1. Tab Switching ---
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;
      navTabs.forEach(t => t.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      document.getElementById(targetId)?.classList.add('active');

      if (targetId === 'tab-inbox') loadComments();
      if (targetId === 'tab-memory') loadMemory();
      if (targetId === 'tab-settings') loadSettings();
    });
  });

  // --- 2. Platform Selector in Simulator ---
  platformButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      platformButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      simPlatformInput.value = btn.dataset.platform;
    });
  });

  // --- 3. Preset Chips ---
  presetChips.forEach(chip => {
    chip.addEventListener('click', () => {
      simCommentTextInput.value = chip.dataset.text;
      simCommentTextInput.focus();
    });
  });

  // --- 4. Range Slider ---
  maxReplyLengthSlider.addEventListener('input', (e) => {
    charLengthDisplay.textContent = e.target.value;
  });

  // --- 5. Toast Notifications ---
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // --- 6. Fetch & Render Settings ---
  async function loadSettings() {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (!data.success) return;

      currentSettings = data.settings;

      // Populate AI form
      aiProviderSelect.value = currentSettings.ai_provider || 'openai';
      aiModelInput.value = currentSettings.ai_model || 'gpt-4o-mini';

      updateBadge(badgeOpenAI, currentSettings.has_openai, currentSettings.api_key_openai_masked);
      updateBadge(badgeGemini, currentSettings.has_gemini, currentSettings.api_key_gemini_masked);
      updateBadge(badgeAnthropic, currentSettings.has_anthropic, currentSettings.api_key_anthropic_masked);
      updateBadge(badgeGroq, currentSettings.has_groq, currentSettings.api_key_groq_masked);

      // Telegram
      telegramChatId.value = currentSettings.telegram_admin_chat_id || '';
      updateBadge(badgeTelegram, currentSettings.has_telegram, currentSettings.telegram_bot_token_masked);

      // Guardrails
      toneOfVoiceSelect.value = currentSettings.tone_of_voice || 'friendly';
      maxReplyLengthSlider.value = currentSettings.max_reply_length || 280;
      charLengthDisplay.textContent = currentSettings.max_reply_length || 280;
      customToneInstructions.value = currentSettings.custom_tone_instructions || '';
      businessKnowledge.value = currentSettings.business_knowledge || '';
      forbiddenWords.value = currentSettings.forbidden_words || '';
      autoPilotToggle.checked = Boolean(currentSettings.auto_pilot_enabled);

      // Update Metric
      metricMode.textContent = currentSettings.auto_pilot_enabled ? '⚡ Auto-Pilot' : 'Human-in-the-Loop';
      metricMode.style.color = currentSettings.auto_pilot_enabled ? 'var(--accent-purple)' : 'var(--accent-cyan)';
    } catch (err) {
      console.error('Error loading settings:', err);
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

  // --- 7. Save Settings ---
  aiSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      ai_provider: aiProviderSelect.value,
      ai_model: aiModelInput.value,
    };
    if (apiKeyOpenAI.value) payload.api_key_openai = apiKeyOpenAI.value;
    if (apiKeyGemini.value) payload.api_key_gemini = apiKeyGemini.value;
    if (apiKeyAnthropic.value) payload.api_key_anthropic = apiKeyAnthropic.value;
    if (apiKeyGroq.value) payload.api_key_groq = apiKeyGroq.value;

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ Impostazioni AI salvate con successo!', 'success');
        apiKeyOpenAI.value = '';
        apiKeyGemini.value = '';
        apiKeyAnthropic.value = '';
        apiKeyGroq.value = '';
        loadSettings();
      } else {
        showToast(`❌ Errore: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast('❌ Errore di rete', 'error');
    }
  });

  telegramSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      telegram_admin_chat_id: telegramChatId.value,
    };
    if (telegramBotToken.value) payload.telegram_bot_token = telegramBotToken.value;

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ Connessione Telegram salvata!', 'success');
        telegramBotToken.value = '';
        loadSettings();
      } else {
        showToast(`❌ Errore: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast('❌ Errore di rete', 'error');
    }
  });

  btnTestTelegram.addEventListener('click', async () => {
    btnTestTelegram.textContent = 'Invio in corso...';
    try {
      const res = await fetch('/api/settings/test-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: telegramBotToken.value || undefined,
          chatId: telegramChatId.value || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('🎉 Messaggio inviato! Controlla Telegram', 'success');
      } else {
        showToast(`❌ Errore Telegram: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast('❌ Impossibile contattare Telegram', 'error');
    } finally {
      btnTestTelegram.textContent = '📲 Invia Messaggio di Test';
    }
  });

  guardrailsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      tone_of_voice: toneOfVoiceSelect.value,
      max_reply_length: parseInt(maxReplyLengthSlider.value, 10),
      custom_tone_instructions: customToneInstructions.value,
      business_knowledge: businessKnowledge.value,
      forbidden_words: forbiddenWords.value,
      auto_pilot_enabled: autoPilotToggle.checked ? 1 : 0,
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        showToast('🛡️ Regole e Guardrails aggiornati!', 'success');
        loadSettings();
      }
    } catch (err) {
      showToast('❌ Errore durante il salvataggio', 'error');
    }
  });

  // --- 8. Simulator Form Submission ---
  simulatorForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const platform = simPlatformInput.value;
    const authorUsername = simAuthorInput.value.trim() || 'cliente_social';
    const postSnippet = simPostSnippetInput.value.trim();
    const commentText = simCommentTextInput.value.trim();

    if (!commentText) return;

    btnSimulate.disabled = true;
    btnSimulate.innerHTML = '<span class="btn-icon">⏳</span> Generazione Risposta AI...';

    try {
      const res = await fetch('/api/simulator/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          authorUsername,
          postSnippet,
          commentText,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast('⚡ Risposta generata e notificata!', 'success');
        loadComments();
        loadMemory();
      } else {
        showToast(`❌ Errore simulatore: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast('❌ Errore di connessione', 'error');
    } finally {
      btnSimulate.disabled = false;
      btnSimulate.innerHTML = '<span class="btn-icon">⚡</span> Simula Ricezione & Genera Risposta';
    }
  });

  // --- 9. Load & Render Comments ---
  async function loadComments() {
    try {
      const res = await fetch('/api/comments');
      const data = await res.json();
      if (!data.success) return;

      currentComments = data.comments;
      renderFeed(currentComments);
      updateMetrics();
    } catch (err) {
      console.error('Error loading comments:', err);
    }
  }

  function renderFeed(comments) {
    if (!comments || comments.length === 0) {
      feedList.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📭</span>
          <p>Nessun commento ricevuto finora.<br>Usa il simulatore a sinistra per inviare il tuo primo commento di test!</p>
        </div>
      `;
      return;
    }

    feedList.innerHTML = comments.map(c => {
      const platformIcons = {
        instagram: '📸 Instagram',
        facebook: '📘 Facebook',
        threads: '🧵 Threads',
        linkedin: '💼 LinkedIn',
        tiktok: '🎵 TikTok',
        x: '🐦 X',
        simulator: '🧪 Simulatore',
      };

      const icon = platformIcons[c.platform.toLowerCase()] || `🌐 ${c.platform}`;

      const statusLabels = {
        pending: 'In Attesa Approvazione',
        approved: 'Approvato',
        modified: 'Modificato & Inviato',
        rejected: 'Scartato',
        auto_replied: 'Auto-Pilot Inviato',
      };

      const statusText = statusLabels[c.status] || c.status;
      const displayReply = c.final_reply || c.proposed_reply;

      return `
        <div class="feed-card" id="card-${c.id}">
          <div class="feed-card-header">
            <span class="card-platform-badge">${icon}</span>
            <span class="status-badge ${c.status}">${statusText}</span>
          </div>

          <div class="feed-author">@${escapeHtml(c.author_username)} ${c.post_snippet ? `· <span style="font-weight:400;color:var(--text-dim);font-size:0.8rem">su "${escapeHtml(c.post_snippet)}"</span>` : ''}</div>

          <div class="feed-comment-bubble">
            "${escapeHtml(c.comment_text)}"
          </div>

          <div class="feed-proposed-box">
            <span class="proposed-label">${c.status === 'pending' ? '🤖 Proposta Risposta AI:' : '📤 Risposta Finale:'}</span>
            <p class="proposed-text">${escapeHtml(displayReply || 'Nessuna risposta generata')}</p>
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

  btnRefreshFeed.addEventListener('click', loadComments);

  // --- 10. Comment Actions (Window Bindings) ---
  window.approveComment = async (id) => {
    try {
      const res = await fetch(`/api/comments/${id}/approve`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('✅ Risposta approvata e memorizzata!', 'success');
        loadComments();
        loadMemory();
      }
    } catch (err) {
      showToast('❌ Errore durante l\'approvazione', 'error');
    }
  };

  window.rejectComment = async (id) => {
    try {
      const res = await fetch(`/api/comments/${id}/reject`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('❌ Commento scartato', 'info');
        loadComments();
      }
    } catch (err) {
      showToast('❌ Errore durante l\'operazione', 'error');
    }
  };

  window.openEditModal = (id) => {
    const comment = currentComments.find(c => c.id === id);
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
      const res = await fetch(`/api/comments/${activeModalCommentId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ final_reply: customText }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ Risposta personalizzata salvata e memorizzata!', 'success');
        replyModal.classList.add('hidden');
        loadComments();
        loadMemory();
      }
    } catch (err) {
      showToast('❌ Errore durante il salvataggio', 'error');
    }
  });

  // --- 11. Memory / Learning Tab ---
  async function loadMemory() {
    try {
      const res = await fetch('/api/comments/approved-memory');
      const data = await res.json();
      if (!data.success) return;

      currentMemory = data.memory;
      renderMemory(currentMemory);
      updateMetrics();
    } catch (err) {
      console.error('Error loading memory:', err);
    }
  }

  function renderMemory(items) {
    memoryCountBadge.textContent = items.length;
    if (!items || items.length === 0) {
      memoryList.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🌱</span>
          <p>Nessun esempio memorizzato al momento.<br>Appena approverai la tua prima risposta sul feed o da Telegram, verrà salvata qui per addestrare l'AI!</p>
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

  btnRefreshMemory.addEventListener('click', loadMemory);

  // --- 12. Metrics Counter ---
  function updateMetrics() {
    metricTotalComments.textContent = currentComments.length;
    const approvedCount = currentComments.filter(c => c.status === 'approved' || c.status === 'modified' || c.status === 'auto_replied').length;
    metricApproved.textContent = approvedCount;
    metricMemory.textContent = currentMemory.length;
    memoryCountBadge.textContent = currentMemory.length;
  }

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Initial Load
  loadSettings();
  loadComments();
  loadMemory();

  // Polling feed every 8s
  setInterval(() => {
    const activeTab = document.querySelector('.nav-tab.active');
    if (activeTab && activeTab.dataset.tab === 'tab-inbox') {
      loadComments();
    }
  }, 8000);
});

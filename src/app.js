import { loadState, saveState, exportState, importStateFromFile, resetState, uid } from './storage.js';
import { defaultState, computeStageStatuses, daysUntil, knowledgeNodeCount } from './state.js';
import { generateSuggestion } from './suggestions.js';
import { KNOWLEDGE, DOMAIN_LABELS, DOMAIN_COLORS } from './knowledge.js';
import { MindSphere } from './sphere.js';
import { runAssistantTurn, runProactiveCheckIn, seedHistoryFromConversation } from './assistant.js';
import * as Voice from './voice.js';
import * as Google from './google.js';

let state = loadState(defaultState);
let sphere = null;
// Full Anthropic message history (incl. tool blocks) is session-only, not persisted —
// but it's seeded from the persisted display conversation on load so recent context
// survives a reload even though raw tool-call plumbing doesn't. Durable facts live in
// state.memory.notes instead, which JARVIS maintains via the update_memory tool.
let anthropicHistory = seedHistoryFromConversation(state.conversation);
let micActive = false;
let micController = null;
let continuousVoice = false; // hands-free listening mode — resets each page load (browsers require a fresh user gesture to grant mic access)
let recognitionRunning = false; // tracks the recognizer's actual on/off state, separate from continuousVoice (the user's intent)

function persist() {
  saveState(state);
}

/* ---------------- CLOCK / STARDATE ---------------- */
function toStardate(d) {
  const start = new Date(d.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((d - start) / 86400000) + 1;
  const frac = ((d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400 * 10).toFixed(0);
  return `${d.getFullYear()}.${String(dayOfYear).padStart(3, '0')}.${frac}`;
}

function tickClock() {
  const now = new Date();
  document.getElementById('stardate').textContent = `STARDATE ${toStardate(now)}`;
  document.getElementById('clocktime').textContent = now.toLocaleTimeString([], { hour12: false });
}

/* ---------------- AUDIO ALERT ---------------- */
let audioCtx = null;
function playBeep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'square';
    o.frequency.value = 880;
    g.gain.value = 0.05;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.2);
    o.stop(audioCtx.currentTime + 0.2);
  } catch (err) {
    // audio unsupported/blocked — silently ignore, visual alert still fires
  }
}

/* ---------------- TRAJECTORY ---------------- */
function renderTrajectory() {
  const stages = computeStageStatuses(state);
  const track = document.getElementById('trajectoryTrack');
  track.innerHTML = stages
    .map(
      (s) => `
      <div class="stage ${s.status}">
        <div class="stage-title">${s.title}</div>
        <div class="stage-sub">${s.sub}</div>
        <div class="stage-bar"><div class="stage-bar-fill" style="width:${s.progress}%"></div></div>
      </div>`
    )
    .join('');
}

function renderCountdown() {
  const d = daysUntil(state.profile.lawSchoolStart);
  const el = document.getElementById('countdownReadout');
  if (d > 0) el.textContent = `${d} DAYS`;
  else if (d === 0) el.textContent = 'TODAY';
  else el.textContent = `+${Math.abs(d)}D IN SESSION`;
}

/* ---------------- OVERVIEW ---------------- */
function renderOverview() {
  const activeTasks = state.tasks.filter((t) => !t.done);
  document.getElementById('tasksSummary').innerHTML = activeTasks.length
    ? activeTasks
        .slice(0, 5)
        .map((t) => `<div class="row-main">• ${escapeHtml(t.title)} <span class="tag priority-${t.priority}">${t.priority.toUpperCase()}</span></div>`)
        .join('')
    : '<div class="empty-note">No active tasks. Queue is clear.</div>';

  document.getElementById('projectsSummary').innerHTML = state.projects.length
    ? state.projects
        .map((p) => `<div class="row-main">• ${escapeHtml(p.name)} <span class="tag">${escapeHtml(p.discipline)}</span></div>`)
        .join('')
    : '<div class="empty-note">No projects registered.</div>';

  const pending = getPendingAlerts();
  document.getElementById('alertsSummary').innerHTML = pending.length
    ? pending.map((a) => `<div class="row-main">⚠ ${escapeHtml(a.text)}</div>`).join('')
    : '<div class="empty-note">No alerts pending.</div>';

  const last = state.suggestionLog[state.suggestionLog.length - 1];
  document.getElementById('suggestionSummary').innerHTML = last
    ? `<div class="meta">${escapeHtml(last.meta)}</div><div>${escapeHtml(last.text)}</div>`
    : '<div class="empty-note">No advisory generated yet — visit ADVISORY.</div>';

  setLamp('docs', state.google.connected ? 'on' : 'off');
  setLamp('alerts', pending.length ? 'warn' : 'off');
}

function setLamp(key, mode) {
  const lightEl = document.querySelector(`.light[data-key="${key}"] .lamp`);
  if (!lightEl) return;
  lightEl.classList.remove('lamp-on', 'lamp-warn');
  if (mode === 'on') lightEl.classList.add('lamp-on');
  if (mode === 'warn') lightEl.classList.add('lamp-warn');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

/* ---------------- TASKS ---------------- */
function populateProjectSelects() {
  const options = state.projects.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  const taskSel = document.getElementById('taskProject');
  const remSel = document.getElementById('reminderProject');
  taskSel.innerHTML = `<option value="">(no project)</option>${options}`;
  remSel.innerHTML = `<option value="">(no project)</option>${options}`;
}

function renderTasks() {
  const list = document.getElementById('taskList');
  if (!state.tasks.length) {
    list.innerHTML = '<div class="empty-note">No tasks yet. Add one above.</div>';
    return;
  }
  const sorted = [...state.tasks].sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));
  list.innerHTML = sorted
    .map((t) => {
      const proj = state.projects.find((p) => p.id === t.project);
      return `
      <div class="row ${t.done ? 'done' : ''}" data-id="${t.id}">
        <input type="checkbox" class="task-toggle" data-id="${t.id}" ${t.done ? 'checked' : ''}/>
        <div class="row-main">${escapeHtml(t.title)}${proj ? ` <span class="tag">${escapeHtml(proj.name)}</span>` : ''}${t.due ? ` <span class="tag">DUE ${t.due}</span>` : ''}</div>
        <span class="tag priority-${t.priority}">${t.priority.toUpperCase()}</span>
        <button class="task-delete" data-id="${t.id}">DEL</button>
      </div>`;
    })
    .join('');
}

function wireTasks() {
  document.getElementById('taskForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('taskTitle').value.trim();
    if (!title) return;
    state.tasks.push({
      id: uid(),
      title,
      project: document.getElementById('taskProject').value || null,
      priority: document.getElementById('taskPriority').value,
      due: document.getElementById('taskDue').value || null,
      done: false,
      createdAt: Date.now(),
    });
    document.getElementById('taskForm').reset();
    persist();
    renderAll();
  });

  document.getElementById('taskList').addEventListener('click', (e) => {
    if (e.target.classList.contains('task-delete')) {
      state.tasks = state.tasks.filter((t) => t.id !== e.target.dataset.id);
      persist();
      renderAll();
    }
  });
  document.getElementById('taskList').addEventListener('change', (e) => {
    if (e.target.classList.contains('task-toggle')) {
      const task = state.tasks.find((t) => t.id === e.target.dataset.id);
      if (task) {
        task.done = e.target.checked;
        persist();
        renderAll();
      }
    }
  });
}

/* ---------------- CALENDAR ---------------- */
const today = new Date();
let calYear = today.getFullYear();
let calMonth = today.getMonth();
const DOW_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_LABELS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

function dateKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function renderCalendar() {
  document.getElementById('calMonthLabel').textContent = `${MONTH_LABELS[calMonth]} ${calYear}`;

  const tasksByDate = {};
  for (const t of state.tasks) {
    if (!t.due) continue;
    (tasksByDate[t.due] = tasksByDate[t.due] || []).push(t);
  }

  const firstOfMonth = new Date(calYear, calMonth, 1);
  const gridStart = new Date(calYear, calMonth, 1 - firstOfMonth.getDay());
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const grid = document.getElementById('calendarGrid');
  let html = DOW_LABELS.map((d) => `<div class="calendar-dow">${d}</div>`).join('');

  for (let i = 0; i < 42; i++) {
    const cell = new Date(gridStart);
    cell.setDate(gridStart.getDate() + i);
    const key = dateKey(cell.getFullYear(), cell.getMonth(), cell.getDate());
    const outside = cell.getMonth() !== calMonth;
    const isToday = key === todayKey;
    const dayTasks = tasksByDate[key] || [];
    const shown = dayTasks.slice(0, 3);
    const rest = dayTasks.length - shown.length;

    html += `
      <div class="calendar-day ${outside ? 'outside' : ''} ${isToday ? 'today' : ''}">
        <div class="calendar-day-num">${cell.getDate()}</div>
        ${shown.map((t) => `<div class="calendar-task-chip priority-${t.priority}" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</div>`).join('')}
        ${rest > 0 ? `<div class="calendar-more">+${rest} more</div>` : ''}
      </div>`;
  }
  grid.innerHTML = html;

  const unscheduled = state.tasks.filter((t) => !t.due && !t.done);
  document.getElementById('calendarUnscheduled').innerHTML = unscheduled.length
    ? unscheduled
        .map(
          (t) => `<div class="row"><div class="row-main">${escapeHtml(t.title)}</div><span class="tag priority-${t.priority}">${t.priority.toUpperCase()}</span></div>`
        )
        .join('')
    : '<div class="empty-note">Every active task has a due date.</div>';
}

function wireCalendar() {
  document.getElementById('calPrevBtn').addEventListener('click', () => {
    calMonth -= 1;
    if (calMonth < 0) { calMonth = 11; calYear -= 1; }
    renderCalendar();
  });
  document.getElementById('calNextBtn').addEventListener('click', () => {
    calMonth += 1;
    if (calMonth > 11) { calMonth = 0; calYear += 1; }
    renderCalendar();
  });
  document.getElementById('calTodayBtn').addEventListener('click', () => {
    calYear = today.getFullYear();
    calMonth = today.getMonth();
    renderCalendar();
  });
}

/* ---------------- PROJECTS ---------------- */
function renderProjects() {
  const list = document.getElementById('projectList');
  if (!state.projects.length) {
    list.innerHTML = '<div class="empty-note">No projects registered.</div>';
    return;
  }
  list.innerHTML = state.projects
    .map((p) => {
      const wc = p.lastWordCount != null ? `${p.lastWordCount} words (as of ${new Date(p.lastCheckedAt).toLocaleDateString()})` : 'not linked to a doc yet';
      return `
      <div class="row" data-id="${p.id}">
        <div class="row-main">
          <strong>${escapeHtml(p.name)}</strong> <span class="tag">${escapeHtml(p.discipline)}</span> <span class="tag">${p.status.toUpperCase()}</span>
          <div class="hint">${wc}</div>
        </div>
        <button class="project-delete" data-id="${p.id}">DEL</button>
      </div>`;
    })
    .join('');
}

function wireProjects() {
  document.getElementById('projectForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('projectName').value.trim();
    const discipline = document.getElementById('projectDiscipline').value.trim();
    if (!name || !discipline) return;
    state.projects.push({
      id: uid(),
      name,
      discipline,
      status: document.getElementById('projectStatus').value,
      docId: null,
      docUrl: '',
      lastWordCount: null,
      lastCheckedAt: null,
      updatedAt: Date.now(),
    });
    document.getElementById('projectForm').reset();
    persist();
    renderAll();
  });

  document.getElementById('projectList').addEventListener('click', (e) => {
    if (e.target.classList.contains('project-delete')) {
      state.projects = state.projects.filter((p) => p.id !== e.target.dataset.id);
      persist();
      renderAll();
    }
  });
}

/* ---------------- REMINDERS / ALERTS ---------------- */
function getPendingAlerts() {
  const now = Date.now();
  const pending = [];
  for (const r of state.reminders) {
    if (r.acknowledged) continue;
    if (r.type === 'time') {
      if (r.time && new Date(r.time).getTime() <= now) pending.push(r);
    } else if (r.type === 'stale') {
      const proj = state.projects.find((p) => p.id === r.projectId);
      if (proj) {
        const days = Math.floor((now - (proj.updatedAt || now)) / 86400000);
        if (days >= (r.days || 5) && (!r.snoozedUntil || r.snoozedUntil < now)) pending.push(r);
      }
    }
  }
  return pending;
}

function renderReminders() {
  const list = document.getElementById('reminderList');
  if (!state.reminders.length) {
    list.innerHTML = '<div class="empty-note">No reminders armed.</div>';
    return;
  }
  const pendingIds = new Set(getPendingAlerts().map((r) => r.id));
  list.innerHTML = state.reminders
    .map((r) => {
      const proj = state.projects.find((p) => p.id === r.projectId);
      const desc = r.type === 'time' ? `AT ${new Date(r.time).toLocaleString()}` : `IF ${proj ? escapeHtml(proj.name) : 'project'} STALE ${r.days}D+`;
      return `
      <div class="row" data-id="${r.id}">
        <div class="row-main">${pendingIds.has(r.id) ? '⚠ ' : ''}${escapeHtml(r.text)} <span class="tag">${desc}</span></div>
        ${pendingIds.has(r.id) ? `<button class="reminder-ack" data-id="${r.id}">ACK</button>` : ''}
        <button class="reminder-delete" data-id="${r.id}">DEL</button>
      </div>`;
    })
    .join('');
}

function wireReminders() {
  document.getElementById('reminderType').addEventListener('change', (e) => {
    const isStale = e.target.value === 'stale';
    document.getElementById('reminderTime').style.display = isStale ? 'none' : '';
    document.getElementById('reminderDays').style.display = isStale ? '' : 'none';
  });

  document.getElementById('reminderForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = document.getElementById('reminderText').value.trim();
    if (!text) return;
    const type = document.getElementById('reminderType').value;
    state.reminders.push({
      id: uid(),
      text,
      type,
      time: type === 'time' ? document.getElementById('reminderTime').value : null,
      days: type === 'stale' ? Number(document.getElementById('reminderDays').value || 5) : null,
      projectId: document.getElementById('reminderProject').value || null,
      acknowledged: false,
      snoozedUntil: null,
    });
    document.getElementById('reminderForm').reset();
    document.getElementById('reminderDays').style.display = 'none';
    persist();
    renderAll();
  });

  document.getElementById('reminderList').addEventListener('click', (e) => {
    if (e.target.classList.contains('reminder-delete')) {
      state.reminders = state.reminders.filter((r) => r.id !== e.target.dataset.id);
      persist();
      renderAll();
    }
    if (e.target.classList.contains('reminder-ack')) {
      const r = state.reminders.find((r) => r.id === e.target.dataset.id);
      if (r) {
        if (r.type === 'time') r.acknowledged = true;
        else r.snoozedUntil = Date.now() + 86400000; // snooze stale reminders 1 day
        persist();
        renderAll();
      }
    }
  });
}

let lastAlertCount = 0;
function checkAlertsTick() {
  const pending = getPendingAlerts();
  if (pending.length > lastAlertCount) playBeep();
  lastAlertCount = pending.length;
  setLamp('alerts', pending.length ? 'warn' : 'off');
}

/* ---------------- SUGGESTIONS ---------------- */
function renderSuggestions() {
  const list = document.getElementById('suggestionList');
  if (!state.suggestionLog.length) {
    list.innerHTML = '<div class="empty-note">No advisory moves generated yet.</div>';
    return;
  }
  list.innerHTML = [...state.suggestionLog]
    .reverse()
    .map(
      (s) => `
      <div class="suggestion-card ${s.category === 'jarvis' ? 'jarvis' : ''}">
        <div class="meta">${s.category === 'jarvis' ? 'JARVIS // ' : ''}${escapeHtml(s.meta)} — ${new Date(s.shownAt).toLocaleString()}</div>
        <div>${escapeHtml(s.text)}</div>
      </div>`
    )
    .join('');
}

function wireSuggestions() {
  const handler = () => {
    const s = generateSuggestion(state);
    state.suggestionLog.push(s);
    if (state.suggestionLog.length > 50) state.suggestionLog.shift();
    persist();
    renderAll();
  };
  document.getElementById('newSuggestionBtn').addEventListener('click', handler);
}

// Every proactive JARVIS check-in (auto or manually requested) also lands here,
// so it's findable on the ADVISORY tab and the OVERVIEW summary rather than
// only living in the scrolling chat transcript.
function logJarvisInsight(text) {
  state.suggestionLog.push({
    id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    category: 'jarvis',
    meta: 'PROACTIVE CHECK-IN',
    text,
    shownAt: Date.now(),
  });
  if (state.suggestionLog.length > 50) state.suggestionLog.shift();
}

/* ---------------- GOOGLE DOCS ---------------- */
function renderDocsView() {
  const statusEl = document.getElementById('googleStatus');
  statusEl.textContent = state.google.connected ? 'CONNECTED' : state.google.clientId ? 'NOT CONNECTED — click CONNECT' : 'SET A CLIENT ID IN SETTINGS FIRST';

  const list = document.getElementById('docsList');
  const linked = state.projects.filter((p) => p.docId);
  if (!linked.length) {
    list.innerHTML = '<div class="empty-note">No projects linked to a doc yet. Use REFRESH DOC DATA after connecting, then link from the list.</div>';
  } else {
    list.innerHTML = linked
      .map(
        (p) => `<div class="row"><div class="row-main">${escapeHtml(p.name)} — <strong>${p.lastWordCount ?? '?'} words</strong> ${p.lastCheckedAt ? `(checked ${new Date(p.lastCheckedAt).toLocaleString()})` : ''}</div></div>`
      )
      .join('');
  }
}

function wireGoogle() {
  document.getElementById('googleConnectBtn').addEventListener('click', () => {
    if (!state.google.clientId) {
      alert('Add a Google OAuth Client ID in SETTINGS first. See the README for setup steps.');
      return;
    }
    if (!Google.isGoogleLibLoaded()) {
      alert('Google Identity Services script has not loaded (check your internet connection) — try again in a moment.');
      return;
    }
    try {
      Google.initTokenClient(state.google.clientId, () => {
        state.google.connected = true;
        persist();
        renderAll();
      });
      Google.requestAccessToken();
    } catch (err) {
      alert(err.message);
    }
  });

  document.getElementById('googleRefreshBtn').addEventListener('click', async () => {
    if (!state.google.connected) {
      alert('Connect your Google account first.');
      return;
    }
    try {
      const docs = await Google.listGoogleDocs();
      // Naive auto-link: if a project name doesn't yet have a docId, try to
      // match it to a doc whose title contains the project name (case-insensitive).
      for (const proj of state.projects) {
        if (proj.docId) continue;
        const match = docs.find((d) => d.name.toLowerCase().includes(proj.name.toLowerCase().slice(0, 8)));
        if (match) {
          proj.docId = match.id;
          proj.docUrl = `https://docs.google.com/document/d/${match.id}`;
        }
      }
      for (const proj of state.projects) {
        if (!proj.docId) continue;
        const snap = await Google.getDocSnapshot(proj.docId);
        proj.lastWordCount = snap.wordCount;
        proj.lastCheckedAt = Date.now();
      }
      persist();
      renderAll();
    } catch (err) {
      alert('Failed to refresh doc data: ' + err.message);
    }
  });
}

/* ---------------- KNOWLEDGE BASE ---------------- */
function renderKnowledgeBase() {
  const list = document.getElementById('knowledgeList');
  const byDomain = {};
  for (const k of KNOWLEDGE) (byDomain[k.domain] = byDomain[k.domain] || []).push(k);
  list.innerHTML = Object.entries(byDomain)
    .map(([domain, entries]) => {
      const colorName = (DOMAIN_COLORS[domain] || 'rb-blue').replace('rb-', '');
      return `
      <div class="kb-group-label">${escapeHtml(DOMAIN_LABELS[domain] || domain)}</div>
      ${entries
        .map(
          (e) => `
        <div class="kb-entry kb-domain-${colorName}">
          <div class="kb-entry-title">${escapeHtml(e.title)}</div>
          <div class="kb-entry-body">${escapeHtml(e.content)}</div>
        </div>`
        )
        .join('')}`;
    })
    .join('');
}

/* ---------------- MIND SPHERE ---------------- */
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function domainColorHex(domain) {
  return cssVar(`--${DOMAIN_COLORS[domain] || 'rb-blue'}`);
}

let lastSphereNodeCount = -1;
function updateSphere() {
  const count = knowledgeNodeCount(state, KNOWLEDGE.length);
  if (!sphere) return;
  if (count !== lastSphereNodeCount) {
    const specs = [];
    for (const k of KNOWLEDGE) specs.push({ color: domainColorHex(k.domain) });
    for (const p of state.projects) specs.push({ color: cssVar('--rb-violet') }, { color: cssVar('--rb-violet') }, { color: cssVar('--rb-violet') });
    for (const t of state.tasks) specs.push({ color: t.done ? cssVar('--rb-green') : cssVar('--rb-yellow') });
    const turns = state.conversation.length;
    for (let i = 0; i < Math.floor(turns / 2); i++) specs.push({ color: cssVar('--rb-teal') });
    for (const n of state.memory.notes) specs.push({ color: cssVar('--rb-red') });
    sphere.setNodes(specs);
    lastSphereNodeCount = count;
  }
  document.getElementById('sphereNodeCount').textContent = String(count);
  document.getElementById('sphereEdgeCount').textContent = String(sphere.edges.length);
  document.getElementById('sphereTurnCount').textContent = String(state.conversation.length);
}

function renderMemory() {
  const list = document.getElementById('memoryList');
  const notes = state.memory.notes;
  if (!notes.length) {
    list.innerHTML = '<div class="empty-note">Nothing remembered yet — JARVIS records durable facts and preferences as you talk.</div>';
    return;
  }
  list.innerHTML = [...notes]
    .reverse()
    .map((n) => `<div class="memory-note" data-id="${n.id}"><span class="tag">${escapeHtml(n.category)}</span><span class="row-main">${escapeHtml(n.text)}</span><button class="memory-delete" data-id="${n.id}" title="Forget this">✕</button></div>`)
    .join('');
}

function wireMemory() {
  document.getElementById('memoryList').addEventListener('click', (e) => {
    if (e.target.classList.contains('memory-delete')) {
      state.memory.notes = state.memory.notes.filter((n) => n.id !== e.target.dataset.id);
      persist();
      renderAll();
    }
  });
}

/* ---------------- JARVIS CHAT ---------------- */
function renderChat() {
  const log = document.getElementById('chatLog');
  if (!state.conversation.length) {
    log.innerHTML = '<div class="chat-bubble system">JARVIS is ready. Set an Anthropic API key in SETTINGS, then start talking — try "what should I focus on this week?"</div>';
    return;
  }
  log.innerHTML = state.conversation
    .map((m) => {
      if (m.role === 'system') return `<div class="chat-bubble system">${escapeHtml(m.text)}</div>`;
      const who = m.role === 'user' ? 'YOU' : 'JARVIS';
      return `<div class="chat-bubble ${m.role}"><span class="who">${who}</span>${escapeHtml(m.text)}</div>`;
    })
    .join('');
  log.scrollTop = log.scrollHeight;
}

function speakReply(text) {
  Voice.speak(text, {
    onStart: () => {
      sphere?.setSpeaking(true);
      // Recognition can end itself between turns (even in continuous mode);
      // make sure it's actually listening right as she starts talking, since
      // that's exactly the window barge-in needs to catch.
      if (continuousVoice && !recognitionRunning) {
        try { micController.start(); } catch (err) { /* already running */ }
      }
    },
    onBoundary: () => sphere?.pulse(0.45),
    onEnd: () => sphere?.setSpeaking(false),
  });
}

function interruptJarvis() {
  Voice.stopSpeaking();
  sphere?.setSpeaking(false);
}

async function sendMessage(text) {
  if (!text || !text.trim()) return;
  if (!state.assistant.apiKey) {
    state.conversation.push({ role: 'system', text: 'No Anthropic API key set — add one in SETTINGS to talk to JARVIS.', ts: Date.now() });
    persist();
    renderAll();
    return;
  }
  state.conversation.push({ role: 'user', text: text.trim(), ts: Date.now() });
  persist();
  renderAll();

  try {
    const result = await runAssistantTurn(state, anthropicHistory, text.trim());
    anthropicHistory = result.history;
    state.conversation.push({ role: 'assistant', text: result.reply, ts: Date.now(), toolCalls: result.toolCalls });
    persist();
    renderAll();
    if (state.assistant.voiceEnabled) speakReply(result.reply);
  } catch (err) {
    state.conversation.push({ role: 'system', text: `JARVIS error: ${err.message}`, ts: Date.now() });
    persist();
    renderAll();
  }
}

function wireChat() {
  document.getElementById('chatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    const text = input.value;
    input.value = '';
    sendMessage(text);
  });

  const speakBtn = document.getElementById('speakToggleBtn');
  speakBtn.addEventListener('click', () => {
    state.assistant.voiceEnabled = !state.assistant.voiceEnabled;
    if (!state.assistant.voiceEnabled) {
      Voice.stopSpeaking();
      sphere?.setSpeaking(false);
    }
    speakBtn.textContent = `🔊 SPEAK REPLIES: ${state.assistant.voiceEnabled ? 'ON' : 'OFF'}`;
    persist();
  });

  const micBtn = document.getElementById('micBtn');
  if (!Voice.isRecognitionSupported()) {
    micBtn.disabled = true;
    micBtn.title = 'Speech recognition is not supported in this browser';
  } else {
    const setMicUI = (listening) => {
      micActive = listening;
      micBtn.classList.toggle('mic-on', listening);
      micBtn.textContent = listening ? '🔴 LISTENING — TAP TO STOP' : '🎙 START CONVERSATION';
    };

    micController = Voice.createRecognizer({
      // Final utterance: send it straight away, hands-free — no click needed.
      onResult: (text) => {
        if (text) sendMessage(text);
      },
      // Live preview of what's being heard, cleared once the utterance finalizes.
      onInterim: (text) => {
        document.getElementById('chatInput').value = text;
      },
      // Earliest available signal of the user making sound — cuts JARVIS off
      // if she's mid-reply. Not foolproof without hardware echo cancellation
      // (works best with headphones), which is why the manual INTERRUPT
      // button next to it is the guaranteed fallback, not just a nicety.
      onSpeechStart: () => {
        if (window.speechSynthesis?.speaking) interruptJarvis();
      },
      onStart: () => {
        recognitionRunning = true;
      },
      onEnd: () => {
        recognitionRunning = false;
        document.getElementById('chatInput').value = '';
        // Browsers stop recognition after a pause even in continuous mode —
        // restart automatically so "hands-free" actually stays hands-free,
        // unless the user (or an unrecoverable error) turned it off.
        if (continuousVoice) {
          setTimeout(() => {
            if (continuousVoice && !recognitionRunning) {
              try { micController.start(); } catch (err) { /* already running */ }
            }
          }, 80);
        } else {
          setMicUI(false);
        }
      },
      onError: (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
          continuousVoice = false;
          setMicUI(false);
          state.conversation.push({ role: 'system', text: `Microphone unavailable (${e.error}) — check your browser's mic permission for this site.`, ts: Date.now() });
          persist();
          renderAll();
        }
        // other errors (e.g. 'no-speech' during a long pause) are routine in
        // continuous mode — onEnd's auto-restart handles them silently.
      },
    });

    micBtn.addEventListener('click', () => {
      if (continuousVoice) {
        continuousVoice = false;
        micController.stop();
        setMicUI(false);
      } else {
        continuousVoice = true;
        micController.start();
        setMicUI(true);
      }
    });
  }

  document.getElementById('interruptBtn').addEventListener('click', interruptJarvis);

  document.getElementById('checkInBtn').addEventListener('click', async () => {
    if (!state.assistant.apiKey) {
      alert('Add an Anthropic API key in SETTINGS first.');
      return;
    }
    const result = await runProactiveCheckIn(state, anthropicHistory).catch((err) => {
      state.conversation.push({ role: 'system', text: `JARVIS error: ${err.message}`, ts: Date.now() });
      return null;
    });
    if (result) {
      anthropicHistory = result.history;
      state.conversation.push({ role: 'assistant', text: result.reply, ts: Date.now(), toolCalls: result.toolCalls });
      logJarvisInsight(result.reply);
      if (state.assistant.voiceEnabled) speakReply(result.reply);
    } else {
      state.conversation.push({ role: 'system', text: 'JARVIS checked in — nothing urgent right now.', ts: Date.now() });
    }
    state.assistant.lastCheckInAt = Date.now();
    persist();
    renderAll();
  });
}

/* ---------------- SETTINGS ---------------- */
function renderSettings() {
  document.getElementById('lawSchoolStart').value = state.profile.lawSchoolStart;
  document.getElementById('googleClientId').value = state.google.clientId;
  document.getElementById('anthropicApiKey').value = state.assistant.apiKey;
  document.getElementById('anthropicModel').value = state.assistant.model;
  document.getElementById('voiceEnabledToggle').checked = state.assistant.voiceEnabled;
  setLamp('jarvis', state.assistant.apiKey ? 'on' : 'off');
}

function wireSettings() {
  document.getElementById('saveSettingsBtn').addEventListener('click', () => {
    state.profile.lawSchoolStart = document.getElementById('lawSchoolStart').value || state.profile.lawSchoolStart;
    state.google.clientId = document.getElementById('googleClientId').value.trim();
    state.assistant.apiKey = document.getElementById('anthropicApiKey').value.trim();
    state.assistant.model = document.getElementById('anthropicModel').value.trim() || 'claude-sonnet-5';
    state.assistant.voiceEnabled = document.getElementById('voiceEnabledToggle').checked;
    persist();
    renderAll();
  });

  document.getElementById('exportBtn').addEventListener('click', () => exportState(state));

  document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      state = await importStateFromFile(file);
      anthropicHistory = seedHistoryFromConversation(state.conversation);
      persist();
      renderAll();
    } catch (err) {
      alert('Import failed: invalid JSON file.');
    }
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm('This will erase all local data (tasks, projects, reminders, advisory log, memory). Continue?')) {
      resetState();
      state = defaultState();
      anthropicHistory = [];
      renderAll();
    }
  });
}

/* ---------------- NAV ---------------- */
function wireNav() {
  document.querySelectorAll('.navbtn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.navbtn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
      document.getElementById(`view-${btn.dataset.view}`).classList.remove('hidden');
    });
  });
}

/* ---------------- RENDER ALL ---------------- */
function renderAll() {
  renderTrajectory();
  renderCountdown();
  populateProjectSelects();
  renderTasks();
  renderCalendar();
  renderProjects();
  renderReminders();
  renderSuggestions();
  renderDocsView();
  renderSettings();
  renderOverview();
  renderKnowledgeBase();
  renderChat();
  renderMemory();
  updateSphere();

  const speakBtn = document.getElementById('speakToggleBtn');
  speakBtn.textContent = `🔊 SPEAK REPLIES: ${state.assistant.voiceEnabled ? 'ON' : 'OFF'}`;
}

const CHECKIN_INTERVAL_MS = 6 * 60 * 60 * 1000; // don't nag more than once per 6h automatically
async function maybeAutoCheckIn() {
  if (!state.assistant.apiKey) return;
  const last = state.assistant.lastCheckInAt;
  if (last && Date.now() - last < CHECKIN_INTERVAL_MS) return;
  try {
    const result = await runProactiveCheckIn(state, anthropicHistory);
    state.assistant.lastCheckInAt = Date.now();
    if (result) {
      anthropicHistory = result.history;
      state.conversation.push({ role: 'assistant', text: result.reply, ts: Date.now(), toolCalls: result.toolCalls });
      logJarvisInsight(result.reply);
      if (state.assistant.voiceEnabled) speakReply(result.reply);
      persist();
      renderAll();
    } else {
      persist();
    }
  } catch (err) {
    // silent — proactive check-ins should never interrupt with an error dialog
  }
}

export function initApp() {
  wireNav();
  wireTasks();
  wireCalendar();
  wireProjects();
  wireReminders();
  wireSuggestions();
  wireGoogle();
  wireSettings();
  wireChat();
  wireMemory();

  sphere = new MindSphere(document.getElementById('mindSphere'));
  sphere.start();

  tickClock();
  setInterval(tickClock, 1000);
  setInterval(checkAlertsTick, 15000);

  renderAll();
  checkAlertsTick();
  setTimeout(maybeAutoCheckIn, 4000);
}

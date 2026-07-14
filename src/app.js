import { loadState, saveState, exportState, importStateFromFile, resetState, uid } from './storage.js';
import { defaultState, computeStageStatuses, daysUntil } from './state.js';
import { generateSuggestion } from './suggestions.js';
import * as Google from './google.js';

let state = loadState(defaultState);

function persist() {
  saveState(state);
}

function touchProject(id) {
  const p = state.projects.find((p) => p.id === id);
  if (p) p.updatedAt = Date.now();
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
      <div class="suggestion-card">
        <div class="meta">${escapeHtml(s.meta)} — ${new Date(s.shownAt).toLocaleString()}</div>
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

/* ---------------- SETTINGS ---------------- */
function renderSettings() {
  document.getElementById('lawSchoolStart').value = state.profile.lawSchoolStart;
  document.getElementById('googleClientId').value = state.google.clientId;
}

function wireSettings() {
  document.getElementById('saveSettingsBtn').addEventListener('click', () => {
    state.profile.lawSchoolStart = document.getElementById('lawSchoolStart').value || state.profile.lawSchoolStart;
    state.google.clientId = document.getElementById('googleClientId').value.trim();
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
      persist();
      renderAll();
    } catch (err) {
      alert('Import failed: invalid JSON file.');
    }
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm('This will erase all local data (tasks, projects, reminders, advisory log). Continue?')) {
      resetState();
      state = defaultState();
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
  renderProjects();
  renderReminders();
  renderSuggestions();
  renderDocsView();
  renderSettings();
  renderOverview();
}

export function initApp() {
  wireNav();
  wireTasks();
  wireProjects();
  wireReminders();
  wireSuggestions();
  wireGoogle();
  wireSettings();

  tickClock();
  setInterval(tickClock, 1000);
  setInterval(checkAlertsTick, 15000);

  renderAll();
  checkAlertsTick();
}

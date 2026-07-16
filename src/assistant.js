// JARVIS — a live conversational assistant backed directly by the Anthropic
// Messages API, called straight from the browser with the user's own API key
// (no backend). It can converse freely AND actually act on the panel's state
// via tool use: adding/updating tasks, projects, reminders, and nudging stage
// progress, so "self-organize my schedule" is a real capability, not a metaphor.

import { KNOWLEDGE, DOMAIN_LABELS } from './knowledge.js';
import { daysUntil } from './state.js';
import { uid } from './storage.js';

const API_URL = 'https://api.anthropic.com/v1/messages';
const NO_CHECKIN = 'NO_CHECKIN_NEEDED';

const TOOLS = [
  {
    name: 'add_task',
    description: 'Add a new task to the task queue.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        projectId: { type: 'string', description: 'Optional project id to attach this task to.' },
        priority: { type: 'string', enum: ['high', 'med', 'low'] },
        due: { type: 'string', description: 'Optional ISO date YYYY-MM-DD.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_task',
    description: 'Update or complete an existing task by id.',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        done: { type: 'boolean' },
        priority: { type: 'string', enum: ['high', 'med', 'low'] },
        due: { type: 'string' },
        title: { type: 'string' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'delete_task',
    description: 'Remove a task by id.',
    input_schema: { type: 'object', properties: { taskId: { type: 'string' } }, required: ['taskId'] },
  },
  {
    name: 'add_project',
    description: 'Register a new project tagged with its academic discipline/field.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        discipline: { type: 'string' },
        status: { type: 'string', enum: ['active', 'paused', 'done'] },
      },
      required: ['name', 'discipline'],
    },
  },
  {
    name: 'update_project',
    description: 'Update an existing project by id (status, name, or discipline).',
    input_schema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        status: { type: 'string', enum: ['active', 'paused', 'done'] },
        name: { type: 'string' },
        discipline: { type: 'string' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'set_reminder',
    description: 'Arm a reminder, either at a specific time or when a project has gone stale for N days.',
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        type: { type: 'string', enum: ['time', 'stale'] },
        time: { type: 'string', description: 'ISO datetime, required if type is time.' },
        days: { type: 'number', description: 'Stale threshold in days, required if type is stale.' },
        projectId: { type: 'string' },
      },
      required: ['text', 'type'],
    },
  },
  {
    name: 'update_stage_progress',
    description: 'Adjust the completion percentage (0-100) of one of the three fixed trajectory stages: stage-jd, stage-intl, or stage-phd.',
    input_schema: {
      type: 'object',
      properties: {
        stageId: { type: 'string', enum: ['stage-jd', 'stage-intl', 'stage-phd'] },
        progress: { type: 'number' },
      },
      required: ['stageId', 'progress'],
    },
  },
  {
    name: 'update_memory',
    description:
      "Record a durable fact, preference, or behavioral pattern about the user that is worth remembering in future sessions — not a one-off task detail. Use this whenever you notice something like a correction (\"actually I prefer X\"), a recurring pattern (they keep deprioritizing a project), or a stable fact about their goals or working style. Do not log routine task/project updates here — those are already tracked elsewhere.",
    input_schema: {
      type: 'object',
      properties: {
        note: { type: 'string', description: 'The durable fact/preference/pattern, written concisely in third person.' },
        category: { type: 'string', enum: ['preference', 'pattern', 'fact'] },
      },
      required: ['note'],
    },
  },
];

function executeTool(state, name, input) {
  switch (name) {
    case 'add_task': {
      const task = {
        id: uid(),
        title: input.title,
        project: input.projectId || null,
        priority: input.priority || 'med',
        due: input.due || null,
        done: false,
        createdAt: Date.now(),
      };
      state.tasks.push(task);
      return { ok: true, taskId: task.id };
    }
    case 'update_task': {
      const t = state.tasks.find((t) => t.id === input.taskId);
      if (!t) return { ok: false, error: 'task not found' };
      if (input.done != null) t.done = input.done;
      if (input.priority) t.priority = input.priority;
      if (input.due) t.due = input.due;
      if (input.title) t.title = input.title;
      return { ok: true };
    }
    case 'delete_task': {
      const before = state.tasks.length;
      state.tasks = state.tasks.filter((t) => t.id !== input.taskId);
      return { ok: state.tasks.length < before };
    }
    case 'add_project': {
      const p = {
        id: uid(),
        name: input.name,
        discipline: input.discipline,
        status: input.status || 'active',
        docId: null,
        docUrl: '',
        lastWordCount: null,
        lastCheckedAt: null,
        updatedAt: Date.now(),
      };
      state.projects.push(p);
      return { ok: true, projectId: p.id };
    }
    case 'update_project': {
      const p = state.projects.find((p) => p.id === input.projectId);
      if (!p) return { ok: false, error: 'project not found' };
      if (input.status) p.status = input.status;
      if (input.name) p.name = input.name;
      if (input.discipline) p.discipline = input.discipline;
      p.updatedAt = Date.now();
      return { ok: true };
    }
    case 'set_reminder': {
      state.reminders.push({
        id: uid(),
        text: input.text,
        type: input.type,
        time: input.time || null,
        days: input.days || null,
        projectId: input.projectId || null,
        acknowledged: false,
        snoozedUntil: null,
      });
      return { ok: true };
    }
    case 'update_stage_progress': {
      const s = state.stages.find((s) => s.id === input.stageId);
      if (!s) return { ok: false, error: 'stage not found' };
      s.progress = Math.max(0, Math.min(100, input.progress));
      return { ok: true };
    }
    case 'update_memory': {
      state.memory.notes.push({
        id: uid(),
        text: input.note,
        category: input.category || 'fact',
        ts: Date.now(),
      });
      if (state.memory.notes.length > 60) state.memory.notes.shift();
      return { ok: true };
    }
    default:
      return { ok: false, error: 'unknown tool' };
  }
}

function knowledgeSummary() {
  const byDomain = {};
  for (const k of KNOWLEDGE) {
    (byDomain[k.domain] = byDomain[k.domain] || []).push(`- ${k.title}: ${k.content}`);
  }
  return Object.entries(byDomain)
    .map(([domain, entries]) => `## ${DOMAIN_LABELS[domain] || domain}\n${entries.join('\n')}`)
    .join('\n\n');
}

function buildSystemPrompt(state) {
  const d = daysUntil(state.profile.lawSchoolStart);
  const tasksList = state.tasks.map((t) => `- [${t.id}] "${t.title}" done=${t.done} priority=${t.priority} due=${t.due || 'none'} project=${t.project || 'none'}`).join('\n') || '(none yet)';
  const projectsList = state.projects.map((p) => `- [${p.id}] "${p.name}" discipline="${p.discipline}" status=${p.status} lastUpdated=${new Date(p.updatedAt).toLocaleDateString()}`).join('\n') || '(none yet)';
  const remindersList = state.reminders.map((r) => `- [${r.id}] "${r.text}" type=${r.type} ${r.type === 'time' ? `time=${r.time}` : `days=${r.days} projectId=${r.projectId}`}`).join('\n') || '(none yet)';
  const stagesList = state.stages.map((s) => `- ${s.id}: ${s.title} — ${s.progress}% complete`).join('\n');
  const memoryList = (state.memory?.notes || []).map((n) => `- (${n.category}) ${n.text}`).join('\n') || '(nothing remembered yet)';

  return `You are JARVIS, the voice of OVERWATCH — a personal command console for one specific life trajectory: starting a JD this September, becoming a practicing international lawyer, then pursuing a PhD in philosophy on phenomenology and critical political/legal thought of vitality, time, and love.

Your job: be a genuine thinking partner. Converse naturally and briefly (this may be read aloud, so avoid long lists in prose — keep replies to a few sentences unless asked for depth). Be proactive: notice when something in the state below is stale, approaching, or unbalanced, and say so or ask about it — don't wait to only be asked. Ask real clarifying questions when priorities are ambiguous, then use your tools to actually update the schedule/tasks/projects/reminders rather than just describing what should happen.

You have a detailed knowledge base about this exact trajectory (law school, international law careers, phenomenology, critical theory, PhD path) — draw on it specifically and concretely, never generically.

LEARNED MEMORY (persists across sessions — this is what you actually remember about the user from past conversations, since raw chat history does not carry over between browser reloads):
${memoryList}

Whenever you notice something durable worth remembering — a stated preference, a correction, a recurring behavioral pattern — call update_memory so you actually retain it next time, rather than re-learning it every session. Don't log routine task details there.

Today's date: ${new Date().toDateString()}. Days until law school starts: ${d}.

CURRENT TRAJECTORY STAGES:
${stagesList}

CURRENT TASKS:
${tasksList}

CURRENT PROJECTS:
${projectsList}

CURRENT REMINDERS:
${remindersList}

KNOWLEDGE BASE:
${knowledgeSummary()}

When the user asks you to plan, prioritize, or organize anything, actually call the relevant tools rather than only suggesting — you are trusted to edit the panel's state directly. Keep tool edits proportionate to what was discussed.`;
}

// Rebuilds an Anthropic-format message history from the persisted, human-readable
// conversation log so recent context survives a page reload even though the raw
// tool-call history does not. Kept short and plain-text only (no tool blocks) —
// durable facts belong in memory notes, not in replayed history.
export function seedHistoryFromConversation(conversation, limit = 12) {
  return conversation
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-limit)
    .map((m) => ({ role: m.role, content: m.text }));
}

async function callAnthropic(apiKey, model, system, messages) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system,
      messages,
      tools: TOOLS,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

// Runs one full turn: sends the user's message (plus prior history), executes
// any tool calls against `state` in place, loops until Claude returns a final
// text reply. Returns { reply, toolCalls, updatedHistory }.
export async function runAssistantTurn(state, history, userText) {
  const { apiKey, model } = state.assistant;
  if (!apiKey) throw new Error('No Anthropic API key set — add one in SETTINGS.');

  const messages = [...history, { role: 'user', content: userText }];
  const toolCalls = [];
  let guard = 0;

  while (guard++ < 6) {
    const system = buildSystemPrompt(state);
    const resp = await callAnthropic(apiKey, model, system, messages);
    messages.push({ role: 'assistant', content: resp.content });

    const toolUses = resp.content.filter((b) => b.type === 'tool_use');
    if (!toolUses.length) {
      const text = resp.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      return { reply: text, toolCalls, history: messages };
    }

    const toolResults = toolUses.map((tu) => {
      const result = executeTool(state, tu.name, tu.input || {});
      toolCalls.push({ name: tu.name, input: tu.input, result });
      return {
        type: 'tool_result',
        tool_use_id: tu.id,
        content: JSON.stringify(result),
      };
    });
    messages.push({ role: 'user', content: toolResults });
  }

  return { reply: '(assistant stopped after too many tool steps)', toolCalls, history: messages };
}

// A quiet proactive check: asks Claude to review state and either stay silent
// (respond with the NO_CHECKIN sentinel, no tools) or say something worth
// surfacing. Returns null when there is nothing to say.
export async function runProactiveCheckIn(state, history) {
  const { apiKey, model } = state.assistant;
  if (!apiKey) return null;

  const prompt = `Silently review the current state. If — and only if — something genuinely deserves proactive attention right now (a project gone stale, a deadline close, an imbalance across the three trajectory stages, an opening to ask a real clarifying question), say it briefly and use tools if a concrete update is warranted. Otherwise respond with exactly: ${NO_CHECKIN}`;

  const result = await runAssistantTurn(state, history, prompt);
  if (result.reply.includes(NO_CHECKIN)) return null;
  return result;
}

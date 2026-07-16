import { uid } from './storage.js';

// Fixed long-arc trajectory: law school -> international law practice -> PhD in philosophy.
// Each stage carries a manual completion % the user can nudge, plus an auto-computed
// status (upcoming / active / complete) derived from the law school start date and
// whichever stage the user has manually marked complete.
export const STAGE_DEFS = [
  {
    id: 'stage-jd',
    title: 'JD // LAW SCHOOL',
    sub: 'Admitted — starting September',
  },
  {
    id: 'stage-intl',
    title: 'INTERNATIONAL LAWYER',
    sub: 'Practice in international law',
  },
  {
    id: 'stage-phd',
    title: 'PHD // PHILOSOPHY',
    sub: 'Phenomenology & critical political-legal thought — vitality, time, love',
  },
];

export function defaultState() {
  const today = new Date();
  const year = today.getMonth() >= 8 ? today.getFullYear() + 1 : today.getFullYear(); // if already past Sept, target next year
  const lawSchoolStart = `${year}-09-01`;

  return {
    schemaVersion: 2,
    profile: {
      lawSchoolStart,
    },
    stages: STAGE_DEFS.map((s, i) => ({
      ...s,
      progress: i === 0 ? 20 : 0, // admitted & enrolling counts as real progress on stage 1
    })),
    projects: [
      {
        id: uid(),
        name: 'Law School — 1L Year',
        discipline: 'Law — International Law track',
        status: 'active',
        docId: null,
        docUrl: '',
        lastWordCount: null,
        lastCheckedAt: null,
        updatedAt: Date.now(),
      },
      {
        id: uid(),
        name: 'Phenomenology Reading & Notes',
        discipline: 'Philosophy — Phenomenology',
        status: 'active',
        docId: null,
        docUrl: '',
        lastWordCount: null,
        lastCheckedAt: null,
        updatedAt: Date.now(),
      },
      {
        id: uid(),
        name: 'Critical Political & Legal Thought — Vitality, Time, Love',
        discipline: 'Philosophy / Law — Critical Theory',
        status: 'active',
        docId: null,
        docUrl: '',
        lastWordCount: null,
        lastCheckedAt: null,
        updatedAt: Date.now(),
      },
    ],
    tasks: [],
    reminders: [],
    suggestionLog: [],
    conversation: [],
    memory: {
      notes: [], // durable facts/preferences/patterns JARVIS chooses to remember across sessions
    },
    google: {
      clientId: '',
      connected: false,
    },
    assistant: {
      apiKey: '',
      model: 'claude-sonnet-5',
      voiceEnabled: true,
      lastCheckInAt: null,
    },
  };
}

// The mind sphere's node count grows with everything the panel actually knows:
// fixed knowledge-base entries, registered projects/tasks, conversation turns,
// and memory notes JARVIS has chosen to remember long-term.
export function knowledgeNodeCount(state, knowledgeLength) {
  const conversationTurns = state.conversation?.length || 0;
  const memoryNotes = state.memory?.notes?.length || 0;
  return knowledgeLength + state.projects.length * 3 + state.tasks.length + Math.floor(conversationTurns / 2) + memoryNotes;
}

export function daysUntil(dateStr) {
  const target = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const ms = target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
  return Math.ceil(ms / 86400000);
}

export function computeStageStatuses(state) {
  const d = daysUntil(state.profile.lawSchoolStart);
  return state.stages.map((stage, i) => {
    let status = 'upcoming';
    if (stage.progress >= 100) status = 'complete';
    else if (i === 0 && d <= 0) status = 'active';
    else if (i === 0) status = 'active'; // JD stage is always the "current" focus until complete
    else if (state.stages[i - 1]?.progress >= 100) status = 'active';
    return { ...stage, status };
  });
}

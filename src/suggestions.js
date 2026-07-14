// Curated, rule-based advisory engine. No API calls — every prompt below was
// written for this specific trajectory (JD -> international law practice ->
// PhD in philosophy on phenomenology and critical political/legal thought of
// vitality, time, and love) and is selected according to the state of your
// tasks, projects and reminders rather than generated live.

import { daysUntil } from './state.js';

const GENERAL = [
  "Freewrite for 15 minutes: where does 'vitality' show up in a legal argument you've read recently — as metaphor, as doctrine, or as something the law actively suppresses?",
  "Pick one international law doctrine (e.g. state sovereignty, jus cogens) and ask what a phenomenological account of time would do to it. Write one paragraph.",
  "Draft a single page connecting Bergson or Husserl's account of duration to how courts reason about precedent and legal time.",
  "Try reframing a case brief as a phenomenological description: bracket the legal categories and describe what the situation was like for the people in it.",
  "Write down one place where 'love' as a political-philosophical category (Hardt, Nussbaum, or otherwise) could reframe a legal question you care about.",
  "Sketch the throughline of your whole trajectory in five sentences: law school -> international law -> PhD. What is the one question all three stages are actually answering?",
  "Take a critical legal studies text and ask: what would it say about international law's claim to neutrality?",
  "Write the opening paragraph of your eventual PhD proposal, even roughly. You don't need it to be right — you need it to exist.",
  "Read one page of Levinas or Merleau-Ponty and note anywhere 'the other' resembles a legal subject.",
  "Draft a short comparison: how does 'time' function differently in a statute of limitations versus in lived, phenomenological time?",
  "Take 10 minutes to note where your law school coursework this term will secretly be doing philosophy of law whether it says so or not.",
  "Write one paragraph arguing against your own PhD thesis. Steelman the objection that phenomenology has nothing useful to say to international law.",
  "List three international law cases or doctrines you find beautiful, not just interesting. Ask why.",
  "Try translating one paragraph of a phenomenology text into plain, brief-style legal prose. What survives the translation?",
];

const BRIDGE = [
  "Your law prep and your PhD reading share a hidden hinge: normativity and time. Spend 20 minutes writing where they meet.",
  "Consider drafting one paragraph of your personal statement that explicitly names your intellectual arc — most applicants hide this; you can make it the spine of the essay.",
  "International law's doctrine of 'living instrument' interpretation (see ECtHR jurisprudence) is basically a phenomenology of legal time in disguise. Worth a note?",
  "Vitality as a legal-political concept shows up in debates about biopolitics (Foucault, Esposito). Does it intersect with any international human rights doctrine you're studying?",
  "Try writing the single sentence that would appear in both your law school application and your future PhD proposal. If you can write it, you have your throughline.",
];

const openingByCategory = {
  stale: (proj, days) => `PROJECT STALE (${days}D): "${proj.name}"`,
  deadline: (task, days) => `DEADLINE IN ${days}D: "${task.title}"`,
  bridge: () => 'THEMATIC BRIDGE',
  general: () => 'CREATIVE / ANALYTICAL MOVE',
};

function pickUnused(pool, usedTexts) {
  const fresh = pool.filter((t) => !usedTexts.has(t));
  const source = fresh.length ? fresh : pool;
  return source[Math.floor(Math.random() * source.length)];
}

export function generateSuggestion(state) {
  const usedTexts = new Set(state.suggestionLog.slice(-12).map((s) => s.text));
  const now = Date.now();
  const candidates = [];

  // Stale projects (no update in 5+ days) get top priority.
  for (const proj of state.projects) {
    if (proj.status !== 'active') continue;
    const days = Math.floor((now - (proj.updatedAt || now)) / 86400000);
    if (days >= 5) {
      candidates.push({
        category: 'stale',
        meta: openingByCategory.stale(proj, days),
        text: pickUnused(GENERAL, usedTexts),
      });
    }
  }

  // Upcoming task deadlines within 3 days.
  for (const task of state.tasks) {
    if (task.done || !task.due) continue;
    const days = daysUntil(task.due);
    if (days >= 0 && days <= 3) {
      candidates.push({
        category: 'deadline',
        meta: openingByCategory.deadline(task, days),
        text: `Deadline approaching on "${task.title}" — block 25 focused minutes now rather than later; momentum compounds.`,
      });
    }
  }

  // Thematic bridge + general prompts always available as fallback pool.
  if (candidates.length === 0 || Math.random() < 0.35) {
    const useBridge = Math.random() < 0.4;
    candidates.push({
      category: useBridge ? 'bridge' : 'general',
      meta: openingByCategory[useBridge ? 'bridge' : 'general'](),
      text: pickUnused(useBridge ? BRIDGE : GENERAL, usedTexts),
    });
  }

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  return {
    id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    ...chosen,
    shownAt: now,
  };
}

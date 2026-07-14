// Curated knowledge base for the trajectory: JD (starting September) -> practicing
// international lawyer -> PhD in philosophy (phenomenology and critical political/
// legal thought of vitality, time, and love). This is real, specific content —
// not placeholder text — written to be handed to the JARVIS assistant as context
// and browsed directly in the KNOWLEDGE BASE view. Each entry is a node the mind
// sphere can render.

export const KNOWLEDGE = [
  // ---------------- JD / LAW SCHOOL ----------------
  {
    id: 'jd-1l-curriculum',
    domain: 'law',
    title: '1L year: the fixed curriculum',
    content:
      'Almost every U.S. law school runs the same first-year core: Contracts, Torts, Civil Procedure, Property, Criminal Law, Constitutional Law, and Legal Research & Writing. Grades are usually a single final exam per class, curved hard. 1L grades matter disproportionately for OCI (on-campus interviewing), journal write-on competitions, and clerkship applications — the rest of law school is comparatively low-stakes by comparison.',
    tags: ['1L', 'curriculum', 'grades'],
  },
  {
    id: 'jd-journals-moot',
    domain: 'law',
    title: 'Journals and moot court as the international-law on-ramp',
    content:
      'Law review / journal write-on competitions happen right after 1L grades post, usually a single intense week over the summer. A journal line matters for international law specifically if you target an international law journal or write a note in that space. Jessup International Law Moot Court is the flagship international law moot competition — doing it signals real interest to international employers and forces you to actually argue a live public international law problem (jurisdiction, state responsibility, treaty interpretation) end to end.',
    tags: ['moot court', 'journal', 'Jessup'],
  },
  {
    id: 'jd-international-electives',
    domain: 'law',
    title: 'Electives that actually build an international law profile',
    content:
      'Public International Law, International Human Rights, International Trade Law, International Arbitration, International Organizations, Law of Armed Conflict / IHL, and a foreign-legal-systems comparative course. If offered, an international law clinic or externship (UN mission, human rights NGO, State Department legal adviser office, international tribunal) is worth more on a resume than an extra elective.',
    tags: ['electives', 'clinic', 'externship'],
  },
  {
    id: 'jd-oci-timeline',
    domain: 'law',
    title: 'OCI and the summer associate pipeline',
    content:
      'On-campus interviewing for 2L summer associate positions runs in the fall of 2L year (some schools do it right after 1L year ends, in the summer before 2L). Big-law international arbitration and international trade groups recruit through the same OCI pipeline as everything else — there is no separate "international law OCI." If big law international practice is a real option you want open, 1L grades and 1L summer experience both feed directly into this.',
    tags: ['OCI', 'summer associate', 'big law'],
  },
  {
    id: 'jd-llm-vs-jd',
    domain: 'law',
    title: 'Do you need an LLM in international law on top of the JD?',
    content:
      'For most international law careers, a JD alone (with the right electives, moot court, and internships) is sufficient — an LLM is not a prerequisite the way it can feel from the outside. An LLM in international law becomes worth it mainly if: (a) you want to teach, (b) you are aiming specifically at international organizations or academia and need the credential/network, or (c) your JD program has thin international law offerings and you need to backfill. Given the eventual PhD, a standalone international law LLM is probably not worth the extra year/debt — the PhD itself, plus a well-chosen JD elective path, likely covers the same ground.',
    tags: ['LLM', 'graduate study'],
  },

  // ---------------- INTERNATIONAL LAW CAREER PATHS ----------------
  {
    id: 'intl-career-tracks',
    domain: 'international-law',
    title: 'The main tracks into international law practice',
    content:
      'Government (U.S. State Department Foreign Service Officer or Civil Service attorney, DOJ Office of International Affairs, USTR); international organizations (UN Office of Legal Affairs, ICC, ICJ registry, WTO Appellate Body secretariat, World Bank legal department) — these often want a few years of experience first, not entry-level; private practice international arbitration/trade groups at large firms; NGOs and human rights organizations (Human Rights Watch, ICRC, Amnesty legal teams); and academia. Each has a genuinely different entry path — worth picking a lane by 2L rather than trying to stay generically "international."',
    tags: ['career paths', 'government', 'NGO', 'academia'],
  },
  {
    id: 'intl-language-requirement',
    domain: 'international-law',
    title: 'Languages are not optional at the international level',
    content:
      'The UN\'s official working languages are Arabic, Chinese, English, French, Russian, and Spanish; French is often the de facto second working language of international courts (ICJ, ICC) and EU institutions. Foreign Service Officer assignments and most international organization postings weight language proficiency heavily. If phenomenology work eventually pulls toward French-language sources (Merleau-Ponty, Levinas, Derrida) anyway, building real working French serves both the law career and the PhD track at once.',
    tags: ['languages', 'French', 'Foreign Service'],
  },
  {
    id: 'intl-clerkship-question',
    domain: 'international-law',
    title: 'Clerkships and the international law track',
    content:
      'A federal clerkship is not required for international law the way it can be for constitutional litigation or academia, but it remains a strong credential-multiplier — it signals writing/research quality to international organizations and top firms alike, and internationally-minded judges exist (especially at the Court of International Trade, or judges known for foreign relations law). Worth keeping open rather than ruling out early, since the application happens 3L regardless of specialty.',
    tags: ['clerkship'],
  },
  {
    id: 'intl-bar-admission',
    domain: 'international-law',
    title: 'Bar admission still has to happen',
    content:
      'Even an international-law-focused career usually still requires passing a state bar (most international organizations and NGOs still want a licensed attorney; ICC/ICJ roles often specify admission to practice somewhere). Plan the bar exam summer like any other JD, regardless of how international the eventual practice is.',
    tags: ['bar exam'],
  },

  // ---------------- PHENOMENOLOGY ----------------
  {
    id: 'phen-core-figures',
    domain: 'phenomenology',
    title: 'Core figures and the throughline of the tradition',
    content:
      'Husserl founds phenomenology on the return "to the things themselves" — describing consciousness and lived experience without importing scientific/metaphysical assumptions. Heidegger redirects it toward Being and temporality (Being and Time). Merleau-Ponty grounds it in the lived body (Phenomenology of Perception) — crucial if "vitality" is a real theme, since he treats the body as the site where meaning and world are generated together, not just experienced. Levinas turns phenomenology toward ethics and the face of the Other, arguing ethics precedes ontology — a natural bridge to legal/political thought about obligation.',
    tags: ['Husserl', 'Heidegger', 'Merleau-Ponty', 'Levinas'],
  },
  {
    id: 'phen-time-bergson',
    domain: 'phenomenology',
    title: 'Time: Bergson\'s duration vs. clock time',
    content:
      'Bergson\'s distinction between durée (lived, qualitative duration) and spatialized clock time is a direct resource for a legal-time argument: law runs almost entirely on spatialized, measurable time (statutes of limitations, filing deadlines, terms of years) while lived legal experience — waiting for a hearing, serving a sentence, statelessness — is durational and often incommensurable with that measured time. This tension is a genuinely under-examined seam between phenomenology and legal theory.',
    tags: ['Bergson', 'time', 'duration'],
  },
  {
    id: 'phen-vitality',
    domain: 'phenomenology',
    title: 'Vitality as a philosophical category',
    content:
      'Vitality shows up across two adjacent but distinct literatures worth keeping separate: (1) phenomenology/philosophy of life (Merleau-Ponty\'s embodiment, Jonas\'s The Phenomenon of Life, Canguilhem on the normal and the pathological) treating vitality as lived, organismic self-organization; and (2) biopolitics (Foucault\'s History of Sexuality vol. 1, Agamben\'s Homo Sacer, Esposito\'s Bios/Immunitas) treating vitality/"bare life" as the object that sovereign and legal power seizes, manages, or excludes. A dissertation-grade contribution likely lives in the friction between these two senses of vitality — the lived versus the administered.',
    tags: ['vitality', 'biopolitics', 'Foucault', 'Agamben', 'Esposito'],
  },

  // ---------------- CRITICAL POLITICAL & LEGAL THOUGHT ----------------
  {
    id: 'cls-overview',
    domain: 'critical-theory',
    title: 'Critical Legal Studies (CLS) in one paragraph',
    content:
      'CLS (Duncan Kennedy, Roberto Unger, at its height in the 1970s-80s at Harvard) argues legal doctrine is not a neutral, determinate system but a contingent set of choices that encodes political and economic power while presenting itself as apolitical. Descendants include Critical Race Theory, Feminist Legal Theory, and Law & Political Economy. For this project, CLS supplies the legal-theoretical vocabulary for arguing that law\'s claimed neutrality (including international law\'s claimed neutrality) is itself a philosophical position that phenomenology can help unmask.',
    tags: ['Critical Legal Studies', 'Duncan Kennedy', 'Roberto Unger'],
  },
  {
    id: 'cls-biopolitics-law',
    domain: 'critical-theory',
    title: 'Biopolitics meets international law',
    content:
      'Agamben\'s "state of exception" and "bare life" have been applied directly to international law contexts — refugee camps, Guantánamo, humanitarian intervention, the stateless. This is probably the single most direct existing bridge between the phenomenology/critical-theory side and the international law side of the trajectory, and worth reading early rather than late, since it will likely shape which international law doctrines end up mattering most for the eventual dissertation.',
    tags: ['Agamben', 'refugees', 'state of exception'],
  },
  {
    id: 'love-political',
    domain: 'critical-theory',
    title: 'Love as a political-philosophical category',
    content:
      'Hardt & Negri (Commonwealth, and Hardt\'s essay "For Love or Money") argue for love as a political concept of collective self-constitution, not just private affect. bell hooks (All About Love) develops an ethics of love as active practice with clear implications for justice and repair. Martha Nussbaum (Political Emotions) treats love and other emotions as legitimate objects of political and legal theory rather than irrational noise law should exclude. Together these give a real philosophical grounding for treating "love" as a serious third term alongside vitality and time, rather than a purely personal/poetic addition to the thesis.',
    tags: ['love', 'Hardt and Negri', 'bell hooks', 'Nussbaum'],
  },

  // ---------------- PHD PATH ----------------
  {
    id: 'phd-admissions-reality',
    domain: 'phd-path',
    title: 'What philosophy PhD admissions actually weigh',
    content:
      'U.S. philosophy PhD admissions weigh the writing sample most heavily — more than the statement of purpose, and often more than GPA. A tightly argued 20-25 page sample in exactly this territory (phenomenology + critical legal/political thought) written during or right after the JD would be a strong, unusual application asset: it proves both philosophical competence and a genuine, already-developed research question, rather than a generic interest.',
    tags: ['admissions', 'writing sample'],
  },
  {
    id: 'phd-funding-timeline',
    domain: 'phd-path',
    title: 'Funding and realistic timeline',
    content:
      'Fully funded U.S. philosophy PhDs (tuition waiver + stipend, usually via teaching assistantships) are close to the norm at research universities — an unfunded philosophy PhD is generally not worth pursuing. Typical time-to-degree is 5-7 years. Given the JD-first sequencing, applying during the JD\'s 3L year (or shortly after starting practice) for a PhD start 1-2 years out is a realistic target window, and gives time to build the writing sample from law school coursework and a clerkship/early practice year.',
    tags: ['funding', 'timeline'],
  },
  {
    id: 'phd-language-prep',
    domain: 'phd-path',
    title: 'Reading knowledge of French and German',
    content:
      'Continental philosophy PhD programs frequently require or strongly prefer reading proficiency in French and/or German (Husserl, Heidegger untranslated nuance; Merleau-Ponty, Levinas, Foucault, Agamben, Esposito in the original). Starting French now serves three goals at once: PhD admissions/qualifying exams, reading primary phenomenology sources directly, and international law/diplomacy language expectations.',
    tags: ['French', 'German', 'language requirement'],
  },
  {
    id: 'phd-jd-joint-question',
    domain: 'phd-path',
    title: 'Sequential JD-then-PhD vs. joint JD/PhD programs',
    content:
      'A small number of schools (e.g. Yale, Georgetown) run formal joint JD/PhD-in-philosophy-adjacent programs, but they add years and lock you into one institution for both degrees. Given the JD is already secured for this September, the more flexible path is: complete the JD, practice international law for a few years while building the writing sample and languages, then apply to PhD programs on their own strength. This also means the practice years are not "wasted time" against the PhD — they are exactly the empirical material (real international law practice) the eventual dissertation can draw on.',
    tags: ['joint degree', 'sequencing'],
  },
];

export function knowledgeByDomain() {
  const map = {};
  for (const k of KNOWLEDGE) {
    if (!map[k.domain]) map[k.domain] = [];
    map[k.domain].push(k);
  }
  return map;
}

export const DOMAIN_LABELS = {
  law: 'JD / LAW SCHOOL',
  'international-law': 'INTERNATIONAL LAW CAREER',
  phenomenology: 'PHENOMENOLOGY',
  'critical-theory': 'CRITICAL POLITICAL & LEGAL THOUGHT',
  'phd-path': 'PHD PATH',
};

export const DOMAIN_COLORS = {
  law: 'rb-red',
  'international-law': 'rb-orange',
  phenomenology: 'rb-blue',
  'critical-theory': 'rb-violet',
  'phd-path': 'rb-teal',
};

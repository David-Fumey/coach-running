// Reprise d'un plan créé ailleurs (Runna, un coach, un tableau) : on colle la liste des séances, Runner en fait un plan.
// TypeScript pur, comme le moteur de plan. Les séances gardent leur titre et leurs kilomètres : rien n'est recalculé.

import { RACES, addDays, diffDays, mondayOf, parseISO, toISO, type Phase, type Plan, type PlanInput, type RaceKey, type Session, type SessionBlock, type SessionStep, type SessionType, type Week } from "./plan.ts";

/** Une séance lue dans le texte collé. */
export interface ImportedSession {
  date: string;
  title: string;
  km: number;
  /** Déroulé écrit sous la séance (échauffement, répétitions, allures), absent si la séance est donnée sans détail */
  blocks?: SessionBlock[];
}

export interface ImportInput {
  race: RaceKey;
  /** AAAA-MM-JJ */
  raceDate: string;
  /** Une séance par ligne : « AAAA-MM-JJ ; titre ; km » (séparateurs ; | ou tabulation) */
  text: string;
  /** Nom du plan d'origine, repris dans les consignes (ex. « Runna ») */
  source: string;
  today: string;
}

export type ParseResult = { ok: true; sessions: ImportedSession[] } | { ok: false; errors: string[] };

const isRealDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && toISO(parseISO(s)) === s;

const SEP = /\s*[;|\t]\s*/;
const DATE_LINE = /^\d{4}-\d{2}-\d{2}\b/;
const STEP_LINE = /^[-•*>]\s*/;
const REPEAT = /^r[ée]p[ée]ter\s*(?:x\s*)?(\d+)\s*(?:x|fois)?\b|^(\d+)\s*(?:x|fois)\s*$|^x\s*(\d+)\s*$/i;

/** Allure « 7:05 » → minutes par kilomètre (7,083), ou null si ce n'est pas une allure plausible (2:00 à 20:00). */
function paceOf(min: string, sec: string): number | null {
  const m = Number(min);
  const sc = Number(sec);
  if (sc > 59 || m < 2 || m > 20) return null;
  return m + sc / 60;
}

/**
 * Lit une étape : « 1,5 km, pas plus vite que 7:30/km », « 1 km à 7:05/km », « 200 m : 5:45/km », « Marche de repos 90 s »,
 * « 2 km conversationnelle | consigne ». Une allure s'écrit « à 7:05/km », « 6:30-7:00 », « pas plus vite que 7:30/km »
 * ou « >= 7:30 » (7:30 ou plus lent). Ce qui suit « | » est une consigne affichée sous l'étape.
 */
export function parseStep(raw: string): SessionStep | string {
  const [body, ...noteParts] = raw.split("|");
  const note = noteParts.join("|").trim();
  const text = body.trim();
  const walk = /^marche\b/i.test(text);
  const size = (walk ? /(\d+(?:[.,]\d+)?)\s*(km|m|min|minutes?|s|sec|secondes?)\b/i : /^(\d+(?:[.,]\d+)?)\s*(km|m|min|minutes?|s|sec|secondes?)\b/i).exec(text);
  if (!size) return walk ? "la marche doit avoir une durée (ex. « Marche 90 s »)." : "l'étape doit commencer par une distance ou une durée (ex. « 1 km », « 200 m », « 90 s »).";
  const value = Number(size[1].replace(",", "."));
  const unit = size[2].toLowerCase();
  const amount: Pick<SessionStep, "distanceM" | "seconds"> =
    unit === "km" ? { distanceM: Math.round(value * 1000) } : unit === "m" ? { distanceM: Math.round(value) } : unit.startsWith("min") ? { seconds: Math.round(value * 60) } : { seconds: Math.round(value) };
  if ((amount.distanceM ?? 1) <= 0 || (amount.seconds ?? 1) <= 0) return "la distance ou la durée doit être positive.";
  const rest = text.replace(size[0], " ");
  const effort = note || undefined;
  if (walk) {
    const repos = /repos|récup|recup/i.test(text);
    return { kind: repos ? "rest" : "walk", label: repos ? "Marche de repos" : "Marche active", ...amount, ...(effort ? { effort } : {}) };
  }
  const conv = /conversationnel/i.test(rest);
  const max = /(?:pas plus vite que|≥|>=)\s*(\d{1,2}):(\d{2})/i.exec(rest);
  const range = /(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/.exec(rest);
  const exact = /(\d{1,2}):(\d{2})/.exec(rest);
  const base = { ...amount, ...(effort ? { effort } : {}) };
  if (max) {
    const p = paceOf(max[1], max[2]);
    if (p === null) return `allure « ${max[1]}:${max[2]} » invalide.`;
    return { kind: "easy", label: conv ? "Allure conversationnelle" : "Allure modérée", pace: { slow: p, fast: p }, paceMode: "plafond", ...base };
  }
  if (range) {
    const p = paceOf(range[1], range[2]);
    const q = paceOf(range[3], range[4]);
    if (p === null || q === null) return "allure invalide (entre 2:00 et 20:00 par km).";
    return { kind: "work", label: "Allure cible", pace: { slow: Math.max(p, q), fast: Math.min(p, q) }, paceMode: "fourchette", ...base };
  }
  if (exact) {
    const p = paceOf(exact[1], exact[2]);
    if (p === null) return `allure « ${exact[1]}:${exact[2]} » invalide (entre 2:00 et 20:00 par km).`;
    return { kind: "work", label: "Allure cible", pace: { slow: p, fast: p }, paceMode: "fourchette", ...base };
  }
  return { kind: "easy", label: conv ? "Allure conversationnelle" : "Allure libre", ...base };
}

/** Teinte du bloc : échauffement, retour au calme et repos sont en gris, le travail en couleur. */
const toneOf = (title: string): SessionBlock["tone"] => (/[ée]chauffement/i.test(title) ? "warmup" : /retour au calme|repos/i.test(title) ? "cooldown" : "main");

/**
 * Lit le texte collé. Une séance : « AAAA-MM-JJ ; titre ; km », suivie si on veut de son déroulé.
 *   Échauffement            ← une ligne sans tiret ouvre un bloc (« Répéter 3x » : le bloc se répète)
 *   - 1,5 km, pas plus vite que 7:30/km
 *   Répéter 3x
 *   - 1 km à 7:05/km        ← une étape par ligne, avec un tiret
 *   - 1 km à 6:30/km
 *   Retour au calme
 *   - 1,5 km conversationnelle | ou plus lentement
 * Des étapes sans bloc forment un bloc « Séance ». Toutes les lignes en erreur sont signalées d'un coup. Les lignes
 * vides et les commentaires (#) sont ignorés.
 */
export function parseSessions(text: string): ParseResult {
  const sessions: ImportedSession[] = [];
  const errors: string[] = [];
  let current: ImportedSession | null = null;
  /** Après une ligne de séance en erreur, ses lignes de déroulé sont ignorées (une erreur suffit) */
  let skipping = false;
  /** Une étape de la séance en cours était illisible : ses blocs vides ne comptent pas comme une seconde erreur */
  let stepError = false;

  const closeSession = () => {
    if (!stepError && current?.blocks?.some((b) => b.steps.length === 0)) errors.push(`Séance du ${current.date} : un bloc n'a aucune étape (une étape commence par un tiret).`);
  };

  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) return;
    const where = `Ligne ${i + 1}`;

    if (DATE_LINE.test(line)) {
      closeSession();
      current = null;
      skipping = true;
      stepError = false;
      const parts = line.split(SEP);
      if (parts.length !== 3) return void errors.push(`${where} : écris « date ; titre ; kilomètres ».`);
      const [date, title, kmText] = parts;
      if (!isRealDate(date)) return void errors.push(`${where} : date « ${date} » invalide (format AAAA-MM-JJ).`);
      const km = Number(kmText.replace(",", ".").replace(/\s*km$/i, ""));
      if (!Number.isFinite(km) || km <= 0 || km > 100) return void errors.push(`${where} : kilomètres « ${kmText} » invalides.`);
      if (title === "") return void errors.push(`${where} : le titre est vide.`);
      if (sessions.some((x) => x.date === date)) return void errors.push(`${where} : deux séances le même jour (${date}).`);
      current = { date, title: title.slice(0, 80), km: Math.round(km * 10) / 10 };
      sessions.push(current);
      skipping = false;
      return;
    }

    if (skipping) return;
    if (!current) return void errors.push(`${where} : écris « date ; titre ; kilomètres » (format AAAA-MM-JJ).`);
    const blocks = (current.blocks ??= []);

    if (STEP_LINE.test(line)) {
      let block = blocks[blocks.length - 1];
      if (!block) {
        block = { id: "b0", title: "Séance", tone: "main", repeat: 1, steps: [] };
        blocks.push(block);
      }
      const step = parseStep(line.replace(STEP_LINE, ""));
      if (typeof step === "string") {
        stepError = true;
        return void errors.push(`${where} : ${step}`);
      }
      block.steps.push(step);
      return;
    }

    // Une ligne sans tiret ouvre un bloc.
    const rep = REPEAT.exec(line);
    const times = rep ? Number(rep[1] ?? rep[2] ?? rep[3]) : 1;
    if (rep && (times < 2 || times > 50)) return void errors.push(`${where} : le nombre de répétitions doit être entre 2 et 50.`);
    const title = rep ? "Séance" : line.replace(/\s*:\s*$/, "").slice(0, 40);
    blocks.push({ id: `b${blocks.length}`, title, tone: rep ? "main" : toneOf(title), repeat: times, steps: [] });
  });
  closeSession();
  if (errors.length === 0 && sessions.length === 0) errors.push("Aucune séance trouvée.");
  return errors.length > 0 ? { ok: false, errors } : { ok: true, sessions };
}

/** Type de séance deviné d'après le titre (mots courants en français). */
export function inferType(title: string): SessionType {
  const t = title.toLowerCase();
  if (/course sur|compétition|competition|jour de course|jour j\b/.test(t)) return "race";
  if (/sortie longue/.test(t)) return "long";
  if (/renfo|gainage|mobilité|mobilite/.test(t)) return "strength";
  if (/tempo|seuil|à allure|a allure/.test(t)) return "tempo";
  if (/fraction|intervalle|côte|cote|pyramide|variable|fartlek|vma|\d\s?m\b|\d+\s?x\s?\d/.test(t)) return "quality";
  if (/récup|recup/.test(t)) return "recovery";
  if (/décrass|decrass|footing de veille/.test(t)) return "shakeout";
  return "easy";
}

const FOCUS: Record<Phase, string> = {
  base: "Semaine reprise de ton plan.",
  construction: "Semaine reprise de ton plan.",
  specifique: "Semaine de travail reprise de ton plan.",
  affutage: "Semaine d'affûtage reprise de ton plan : le volume baisse, la fraîcheur monte.",
  course: "Semaine de course : on arrive frais.",
};

const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Construit un plan à partir des séances. Les semaines vont du lundi de la première séance à la semaine de la course.
 * Les séances après la course ne sont pas reprises (un avertissement le dit). Les séances ne sont pas modifiées par
 * la mise à jour du catalogue (`plan.source` les en protège) : ce sont celles du plan d'origine.
 */
export function buildImportedPlan(sessions: ImportedSession[], input: ImportInput): Plan {
  if (!isRealDate(input.raceDate)) throw new Error("La date de la course n'est pas valide.");
  const kept = sessions.filter((s) => s.date <= input.raceDate).sort((a, b) => a.date.localeCompare(b.date));
  const dropped = sessions.length - kept.length;
  if (kept.length === 0) throw new Error("Aucune séance n'est avant la date de la course.");

  const firstMonday = mondayOf(kept[0].date);
  const raceMonday = mondayOf(input.raceDate);
  const weekCount = diffDays(firstMonday, raceMonday) / 7 + 1;
  if (weekCount > 60) throw new Error("Le plan dépasse 60 semaines : vérifie les dates.");

  const detailsOf = (title: string) => `Séance reprise de ton plan ${input.source} : « ${title} ». Suis les consignes de ${input.source} pour le détail ; Runner garde la date et la distance.`;
  const weeks: Week[] = [];
  for (let w = 0; w < weekCount; w++) {
    const startDate = addDays(firstMonday, w * 7);
    const end = addDays(startDate, 6);
    const list: Session[] = kept
      .filter((s) => s.date >= startDate && s.date <= end)
      .map((s) => ({ id: `s-${s.date}`, date: s.date, type: inferType(s.title), km: s.km, title: s.title, details: detailsOf(s.title), ...(s.blocks && s.blocks.length > 0 ? { blocks: s.blocks } : {}) }));
    const isLast = w === weekCount - 1;
    const phase: Phase = isLast ? "course" : w === weekCount - 2 ? "affutage" : "specifique";
    weeks.push({
      index: w,
      startDate,
      phase,
      isRecovery: false,
      focus: FOCUS[phase],
      totalKm: round1(list.reduce((acc, s) => acc + s.km, 0)),
      sessions: list,
    });
  }

  const perWeek = Math.max(...weeks.map((w) => w.sessions.length));
  const runDays = (perWeek < 3 ? 3 : perWeek > 6 ? 6 : perWeek) as PlanInput["daysPerWeek"];
  const longs = kept.filter((s) => inferType(s.title) === "long");
  const saturdays = longs.filter((s) => parseISO(s.date).getUTCDay() === 6).length;
  const planInput: PlanInput = {
    race: input.race,
    raceDate: input.raceDate,
    level: "intermediaire",
    daysPerWeek: runDays,
    currentWeeklyKm: Math.round(weeks[0].totalKm),
    longDay: saturdays > longs.length / 2 ? "sam" : "dim",
    today: input.today,
  };

  const warnings: string[] = [];
  if (dropped > 0) warnings.push(`${dropped} séance${dropped > 1 ? "s" : ""} après la course n'${dropped > 1 ? "ont" : "a"} pas été reprise${dropped > 1 ? "s" : ""} : fais un nouveau plan après ta course.`);
  if (!kept.some((s) => s.date === input.raceDate)) warnings.push(`Aucune séance n'est prévue le jour de la course (${RACES[input.race].label}) : ajoute-la si elle figure dans ton plan.`);

  return { input: planInput, weeks, warnings, createdAt: input.today, source: input.source };
}

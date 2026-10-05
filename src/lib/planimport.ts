// Reprise d'un plan créé ailleurs (Runna, un coach, un tableau) : on colle la liste des séances, Runner en fait un plan.
// TypeScript pur, comme le moteur de plan. Les séances gardent leur titre et leurs kilomètres : rien n'est recalculé.

import { RACES, addDays, diffDays, mondayOf, parseISO, toISO, type Phase, type Plan, type PlanInput, type RaceKey, type Session, type SessionType, type Week } from "./plan.ts";

/** Une séance lue dans le texte collé. */
export interface ImportedSession {
  date: string;
  title: string;
  km: number;
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

/** Lit le texte collé. Toutes les lignes en erreur sont signalées d'un coup. Les lignes vides et les commentaires (#) sont ignorés. */
export function parseSessions(text: string): ParseResult {
  const sessions: ImportedSession[] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) return;
    const parts = line.split(/\s*[;|\t]\s*/);
    const where = `Ligne ${i + 1}`;
    if (parts.length !== 3) return void errors.push(`${where} : écris « date ; titre ; kilomètres ».`);
    const [date, title, kmText] = parts;
    if (!isRealDate(date)) return void errors.push(`${where} : date « ${date} » invalide (format AAAA-MM-JJ).`);
    const km = Number(kmText.replace(",", ".").replace(/\s*km$/i, ""));
    if (!Number.isFinite(km) || km <= 0 || km > 100) return void errors.push(`${where} : kilomètres « ${kmText} » invalides.`);
    if (title === "") return void errors.push(`${where} : le titre est vide.`);
    if (sessions.some((s) => s.date === date)) return void errors.push(`${where} : deux séances le même jour (${date}).`);
    sessions.push({ date, title: title.slice(0, 80), km: Math.round(km * 10) / 10 });
  });
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
      .map((s) => ({ id: `s-${s.date}`, date: s.date, type: inferType(s.title), km: s.km, title: s.title, details: detailsOf(s.title) }));
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

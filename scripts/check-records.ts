import type { Activity } from "../src/lib/activities.ts";
import { attemptsFor, attemptsOf, currentStreak, recordHistory, distanceRecords, highlights, isRecent, longestStreak } from "../src/lib/records.ts";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) {
    failures++;
    console.log("ECHEC", name, detail ?? "");
  } else console.log("ok   ", name);
}

const act = (id: string, date: string, km: number, minutes: number, extra: Partial<Activity> = {}): Activity => ({ id, date, km, minutes, ...extra });
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

// ---------- Records de distance ----------
const list = [
  act("a1", "2026-03-01", 5.0, 26), // exact
  act("a2", "2026-06-01", 5.1, 25.5), // 25:00 ramené à 5 km
  act("a3", "2026-09-01", 4.95, 24.5), // un peu courte : ramenée
  act("long", "2026-09-10", 12, 70), // ne compte ni pour 5 ni pour 10
];
const r5 = distanceRecords(list).find((r) => r.id === "5k")!;
check("5 km : le meilleur temps ramené à 5 km", r5.best!.activityId === "a3" && near(r5.best!.minutes, (24.5 / 4.95) * 5), r5.best);
check("5 km : nombre de sorties comptées", r5.attempts === 3);
check("5 km : record précédent", near(r5.previous!, 25), r5.previous);
check("temps ramené signalé, temps exact non", !attemptsFor(list, 5).find((a) => a.activityId === "a2")!.exact && attemptsFor(list, 5).find((a) => a.activityId === "a1")!.exact);
check("une sortie de 12 km ne donne pas de record de 10 km", distanceRecords(list).find((r) => r.id === "10k")!.best === null);
check("distance sans sortie : aucun record", distanceRecords(list).find((r) => r.id === "marathon")!.best === null && distanceRecords(list).find((r) => r.id === "marathon")!.attempts === 0);

check("bornes : 4,89 km exclu, 4,9 inclus", attemptsFor([act("x", "2026-01-01", 4.89, 25)], 5).length === 0 && attemptsFor([act("x", "2026-01-01", 4.9, 25)], 5).length === 1);
check("bornes : 5,3 km inclus, 5,31 exclu", attemptsFor([act("x", "2026-01-01", 5.3, 30)], 5).length === 1 && attemptsFor([act("x", "2026-01-01", 5.31, 30)], 5).length === 0);

const first = distanceRecords([act("only", "2026-01-01", 10, 50)]).find((r) => r.id === "10k")!;
check("premier résultat : pas de record précédent", first.best!.minutes === 50 && first.previous === null && first.best!.exact);
const tie = distanceRecords([act("late", "2026-05-01", 10, 50), act("early", "2026-02-01", 10, 50)]).find((r) => r.id === "10k")!;
check("égalité : le plus ancien garde le record", tie.best!.activityId === "early" && tie.previous === null);
const slower = distanceRecords([act("fast", "2026-02-01", 10, 48), act("slow", "2026-05-01", 10, 52)]).find((r) => r.id === "10k")!;
check("un résultat plus lent ne change pas le record", slower.best!.activityId === "fast" && slower.previous === null);
const semi = distanceRecords([act("s", "2026-04-01", 21.1, 110)]).find((r) => r.id === "semi")!;
check("semi-marathon à 21,1 km : compté", semi.best !== null && semi.best.exact);
check("aucune activité : tout vide", distanceRecords([]).every((r) => r.best === null && r.attempts === 0 && r.previous === null));

// ---------- Meilleurs efforts mesurés ----------
const long5 = act("long", "2026-09-10", 12, 70, { efforts: { "5k": 22.5, "10k": 46 } }); // 5 km dans une sortie de 12 km
const effList = [act("a1", "2026-03-01", 5.0, 26), long5];
const rEff = distanceRecords(effList);
const eff5 = rEff.find((r) => r.id === "5k")!;
check("meilleur effort dans une sortie longue : nouveau record", eff5.best!.activityId === "long" && near(eff5.best!.minutes, 22.5) && eff5.best!.fromEffort === true && eff5.best!.km === 12, eff5.best);
check("effort : temps exact, jamais « ramené »", eff5.best!.exact);
check("effort : le record précédent reste la sortie de 5 km", near(eff5.previous!, 26));
check("effort : 10 km aussi", near(rEff.find((r) => r.id === "10k")!.best!.minutes, 46) && rEff.find((r) => r.id === "10k")!.attempts === 1);
check("distance sans effort ni sortie : aucun record", rEff.find((r) => r.id === "marathon")!.best === null);

const both = act("both", "2026-09-12", 5.2, 26, { efforts: { "5k": 24.9 } }); // sortie entière ramenée = 25,0 ; effort 24,9
const bothAttempts = attemptsOf([both], { id: "5k", km: 5 });
check("une sortie ne compte qu'une fois, avec son meilleur temps", bothAttempts.length === 1 && near(bothAttempts[0].minutes, 24.9) && bothAttempts[0].fromEffort === true, bothAttempts);
const worseEffort = act("w", "2026-09-12", 5.2, 26, { efforts: { "5k": 27 } }); // l'effort mesuré est plus lent que la sortie ramenée
const keepWhole = attemptsOf([worseEffort], { id: "5k", km: 5 });
check("effort plus lent que la sortie ramenée : on garde la sortie", keepWhole.length === 1 && near(keepWhole[0].minutes, (26 / 5.2) * 5) && !keepWhole[0].fromEffort);
check("détail lu sans effort : rien en plus", attemptsOf([act("e", "2026-09-12", 12, 70, { efforts: {} })], { id: "5k", km: 5 }).length === 0);
check("effort sur une sortie de 3 km impossible, valeur invalide ignorée", attemptsOf([act("z", "2026-09-12", 12, 70, { efforts: { "5k": 0 } })], { id: "5k", km: 5 }).length === 0);
check("les efforts ne changent pas les autres repères", highlights([long5]).find((x) => x.id === "longest")!.value === 12);

// ---------- Autres records ----------
const mix: Activity[] = [
  act("m1", "2026-09-01", 8, 48, { elevation: 120 }),
  act("m2", "2026-09-03", 3, 11), // allure 3:40 mais sortie courte
  act("m3", "2026-09-05", 16, 100, { elevation: 300 }),
  act("m4", "2026-09-30", 6, 33),
  act("m5", "2026-10-01", 5, 25),
];
const h = Object.fromEntries(highlights(mix).map((x) => [x.id, x]));
check("sortie la plus longue", h.longest.value === 16 && h.longest.date === "2026-09-05");
check("sortie la plus longue en durée", h.duration.value === 100);
check("meilleure allure : seulement dès 5 km", near(h.pace.value, 5) && h.pace.date === "2026-10-01", h.pace);
check("plus gros dénivelé", h.elevation.value === 300 && h.elevation.date === "2026-09-05");
check("semaine la plus chargée", near(h.week.value, 27) && h.week.date === "2026-08-31" && h.week.endDate === "2026-09-06", h.week);
check("mois le plus chargé", near(h.month.value, 33) && h.month.date === "2026-09-01" && h.month.endDate === "2026-09-30", h.month);
check("sans dénivelé enregistré : pas de record de dénivelé", !highlights([act("p", "2026-01-01", 5, 30)]).some((x) => x.id === "elevation"));
check("dénivelé nul : pas de record de dénivelé", !highlights([act("p", "2026-01-01", 5, 30, { elevation: 0 })]).some((x) => x.id === "elevation"));
check("aucune activité : aucun record", highlights([]).length === 0);
check("une seule semaine : pas de série", !highlights([act("p", "2026-01-01", 5, 30)]).some((x) => x.id === "streak"));

// ---------- Séries de semaines ----------
// Semaines du lundi 2026-09-07, 09-14, 09-21 (série de 3), trou, 10-12 (série de 1), 10-19.
const weekly = [
  act("w1", "2026-09-08", 5, 30), act("w2", "2026-09-17", 5, 30), act("w3", "2026-09-27", 5, 30),
  act("w4", "2026-10-13", 5, 30), act("w5", "2026-10-20", 5, 30),
];
const s = longestStreak(weekly)!;
check("plus longue série", s.weeks === 3 && s.start === "2026-09-07" && s.end === "2026-09-27", s);
check("aucune activité : pas de série", longestStreak([]) === null);
check("série en cours (cette semaine courue)", currentStreak(weekly, "2026-10-21") === 2);
check("série en cours (semaine pas encore courue, la précédente l'a été)", currentStreak(weekly, "2026-10-26") === 2);
check("série cassée", currentStreak(weekly, "2026-11-09") === 0);
check("série en cours sans activité", currentStreak([], "2026-10-21") === 0);
const doubled = [...weekly, act("w6", "2026-09-09", 4, 25)];
check("deux sorties la même semaine : une seule semaine comptée", longestStreak(doubled)!.weeks === 3);

// ---------- Récent ----------
check("récent : dans les 14 jours", isRecent("2026-10-10", "2026-10-20") && isRecent("2026-10-20", "2026-10-20"));
check("pas récent : trop ancien ou futur", !isRecent("2026-09-01", "2026-10-20") && !isRecent("2026-10-25", "2026-10-20"));

// ---------- Historique d'une distance ----------
{
  const t5 = { id: "5k" as const, km: 5 };
  const hist = recordHistory([act("a1", "2026-03-01", 5.0, 26), act("a2", "2026-06-01", 5.0, 27), act("a3", "2026-08-01", 5.0, 25), act("a4", "2026-09-01", 5.0, 25), act("a5", "2026-09-01", 5.0, 24)], t5);
  check("historique : ordre chronologique", hist.map((h) => h.activityId).join() === "a1,a2,a3,a5,a4", hist.map((h) => h.activityId));
  check("historique : seuls les records successifs sont marqués", hist.map((h) => h.record).join() === "true,false,true,true,false", hist.map((h) => h.record));
  check("historique : le premier résultat est un record", hist[0].record);
  check("historique : une égalité ne bat pas le record", !hist.find((h) => h.activityId === "a4")!.record);
  check("historique : vide sans sortie de la distance", recordHistory([act("l", "2026-01-01", 12, 70)], t5).length === 0);
  check("historique : le dernier record est le meilleur temps", Math.min(...hist.map((h) => h.minutes)) === hist.filter((h) => h.record).at(-1)!.minutes);
}

console.log(failures === 0 ? "\nTout est bon." : `\n${failures} échec(s).`);

process.exit(failures === 0 ? 0 : 1);

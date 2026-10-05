import { generatePlan } from "../src/lib/plan.ts";
import { addActivity, removeActivity, type Activity, type Tracked } from "../src/lib/activities.ts";
import { makeBackup, parseBackup, EMPTY_SNAPSHOT } from "../src/lib/backup.ts";
import {
  EMPTY_STRAVA, STRAVA_SCOPE, RECENT_TEMP_COUNT, decodePolyline, simplify, parseZones, parseStats, parseAthlete, parseClubs, parseRoutes, needsDetail, lacksScopes, hasScope, applyDetails, applyEfforts, detailTargets, parseRunDetail, parseSeries, SERIES_POINTS, parseTemp, authorizeUrl, effortCandidates, mergeStrava, parseBestEfforts, parseCallback, stravaNumericId, syncAfter, toActivity, tokensExpired,
  type StravaRun, type StravaTokens,
} from "../src/lib/strava.ts";
import { StravaError, fetchAccount, fetchEfforts, fetchRuns, fetchSeries, fetchZones, listActivities, type FetchLike } from "../src/lib/stravaClient.ts";

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) {
    failures++;
    console.log("ECHEC", name, detail ?? "");
  } else console.log("ok   ", name);
}

const plan = generatePlan({
  race: "10k", raceDate: "2027-01-10", level: "debutant", daysPerWeek: 3,
  currentWeeklyKm: 15, longDay: "dim", today: "2026-10-03",
});
const sessions = plan.weeks.flatMap((w) => w.sessions);
const s1 = sessions[0];
const s2 = sessions[1];

const run = (id: number, date: string, km: number, min: number, extra: Partial<StravaRun> = {}): StravaRun => ({
  id, name: "Morning Run", sport_type: "Run", distance: km * 1000, moving_time: min * 60, start_date_local: `${date}T07:12:00Z`, ...extra,
});
const empty: Tracked = { activities: [], done: {} };

// ---------- Conversion ----------
const a = toActivity(run(1, "2026-10-05", 8.456, 45))!;
check("conversion : date, km arrondis, minutes", a.date === "2026-10-05" && a.km === 8.46 && a.minutes === 45, a);
check("conversion : identifiant externe", a.externalId === "strava:1" && a.source === "strava" && a.id === "strava-1");
check("conversion : le titre devient la note", a.note === "Morning Run");
check("heure locale : la date n'est pas décalée", toActivity(run(2, "2026-10-05", 5, 30, { start_date_local: "2026-10-05T23:50:00Z" }))!.date === "2026-10-05");
check("trail et course virtuelle acceptés", !!toActivity(run(3, "2026-10-05", 5, 30, { sport_type: "TrailRun" })) && !!toActivity(run(4, "2026-10-05", 5, 30, { sport_type: "VirtualRun" })));
check("ancien champ type utilisé à défaut", !!toActivity(run(5, "2026-10-05", 5, 30, { sport_type: undefined, type: "Run" })));
check("vélo ignoré", toActivity(run(6, "2026-10-05", 30, 60, { sport_type: "Ride" })) === null);
check("marche ignorée", toActivity(run(7, "2026-10-05", 3, 40, { sport_type: "Walk" })) === null);
check("distance nulle ignorée", toActivity(run(8, "2026-10-05", 0, 30)) === null);
check("durée nulle ignorée", toActivity(run(9, "2026-10-05", 5, 0)) === null);
check("réponse mal formée ignorée", toActivity({ id: 10, sport_type: "Run", distance: "x", moving_time: 10, start_date_local: "2026-10-05T07:00:00Z" } as unknown as StravaRun) === null);
check("date mal formée ignorée", toActivity(run(11, "2026-10-05", 5, 30, { start_date_local: "hier" })) === null);
check("sans titre : pas de note", toActivity(run(12, "2026-10-05", 5, 30, { name: "  " }))!.note === undefined);

// ---------- Fréquence cardiaque et dénivelé ----------
const rich = toActivity(run(20, "2026-10-05", 10, 55, { average_heartrate: 151.6, max_heartrate: 178, total_elevation_gain: 123.4 }))!;
check("fréquence cardiaque et dénivelé convertis", rich.avgHr === 152 && rich.maxHr === 178 && rich.elevation === 123, rich);
const plain = toActivity(run(21, "2026-10-05", 10, 55))!;
check("sans capteur : aucun champ", !("avgHr" in plain) && !("maxHr" in plain) && !("elevation" in plain), plain);
const odd = toActivity(run(22, "2026-10-05", 10, 55, { average_heartrate: 0, max_heartrate: 400, total_elevation_gain: -5 }))!;
check("valeurs aberrantes ignorées", odd.avgHr === undefined && odd.maxHr === undefined && odd.elevation === undefined, odd);
const text2 = toActivity(run(23, "2026-10-05", 10, 55, { average_heartrate: "x" as unknown as number }))!;
check("fréquence mal formée ignorée", text2.avgHr === undefined);
check("dénivelé nul conservé (tapis)", toActivity(run(24, "2026-10-05", 10, 55, { total_elevation_gain: 0 }))!.elevation === 0);

const old = mergeStrava(plan, empty, [], [run(30, "2026-10-04", 8, 48)]);
const upgraded = mergeStrava(plan, old.state, old.seen, [run(30, "2026-10-04", 8, 48, { average_heartrate: 150, max_heartrate: 171, total_elevation_gain: 60 })]);
check("activité déjà importée complétée", upgraded.enriched === 1 && upgraded.added === 0 && upgraded.state.activities.length === 1 && upgraded.state.activities[0].avgHr === 150 && upgraded.state.activities[0].elevation === 60, upgraded);
const again = mergeStrava(plan, upgraded.state, upgraded.seen, [run(30, "2026-10-04", 8, 48, { average_heartrate: 150, max_heartrate: 171, total_elevation_gain: 60 })]);
check("complétée une seule fois", again.enriched === 0);
const noOverwrite = mergeStrava(plan, upgraded.state, upgraded.seen, [run(30, "2026-10-04", 8, 48, { average_heartrate: 99, max_heartrate: 120, total_elevation_gain: 5 })]);
check("une valeur existante n'est jamais écrasée", noOverwrite.enriched === 0 && noOverwrite.state.activities[0].avgHr === 150 && noOverwrite.state.activities[0].elevation === 60);
const afterDel = mergeStrava(plan, empty, old.seen, [run(30, "2026-10-04", 8, 48, { average_heartrate: 150 })]);
check("course supprimée : ni réimportée ni complétée", afterDel.added === 0 && afterDel.enriched === 0 && afterDel.state.activities.length === 0);
const userEdited: Tracked = { activities: [{ ...old.state.activities[0], km: 9, note: "ma note" }], done: {} };
const keepEdits = mergeStrava(plan, userEdited, old.seen, [run(30, "2026-10-04", 8, 48, { average_heartrate: 150 })]);
check("compléter ne touche pas aux modifications de l'utilisateur", keepEdits.state.activities[0].km === 9 && keepEdits.state.activities[0].note === "ma note" && keepEdits.state.activities[0].avgHr === 150);

// ---------- Meilleurs efforts ----------
const respE = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const nearTo = (a: number, b: number, eps = 0.006) => Math.abs(a - b) < eps;
const detail = {
  best_efforts: [
    { name: "400m", distance: 400, elapsed_time: 100 },
    { name: "1k", distance: 1000, elapsed_time: 290 },
    { name: "5k", distance: 5000, elapsed_time: 1485 },
    { name: "10k", distance: 10000, elapsed_time: 3100 },
    { name: "Half-Marathon", distance: 21097.5, elapsed_time: 6900 },
  ],
};
const parsed = parseBestEfforts(detail);
check("efforts lus par distance", near(parsed["5k"]!, 24.75) && nearTo(parsed["10k"]!, 3100 / 60) && near(parsed.semi!, 115) && parsed.marathon === undefined, parsed);
check("distances intermédiaires ignorées", Object.keys(parsed).length === 3);
check("distance à 1 % près acceptée, au-delà refusée", parseBestEfforts({ best_efforts: [{ distance: 5040, elapsed_time: 1500 }] })["5k"] !== undefined && parseBestEfforts({ best_efforts: [{ distance: 5100, elapsed_time: 1500 }] })["5k"] === undefined);
check("le plus court temps est gardé", nearTo(parseBestEfforts({ best_efforts: [{ distance: 5000, elapsed_time: 1500 }, { distance: 5000, elapsed_time: 1400 }] })["5k"]!, 1400 / 60));
check("réponse sans efforts ou mal formée : objet vide", Object.keys(parseBestEfforts({})).length === 0 && Object.keys(parseBestEfforts(null)).length === 0 && Object.keys(parseBestEfforts({ best_efforts: "x" })).length === 0 && Object.keys(parseBestEfforts({ best_efforts: [{ distance: 5000, elapsed_time: -4 }, { distance: "5000", elapsed_time: 100 }, null] })).length === 0);

const mk = (n: number, km: number, minutes: number, extra: Partial<Activity> = {}): Activity => ({ id: `strava-${n}`, date: `2026-09-${String(n).padStart(2, "0")}`, km, minutes, externalId: `strava:${n}`, source: "strava", ...extra });
check("identifiant Strava d'une activité", stravaNumericId(mk(7, 5, 30)) === 7 && stravaNumericId({ id: "m", date: "2026-09-01", km: 5, minutes: 30 }) === null);
const pool: Activity[] = [
  mk(1, 6, 36), mk(2, 8, 44), mk(3, 12, 66), mk(4, 7, 42), mk(5, 5.2, 32), mk(6, 4, 20), // 6 km/20 min = 5:00/km mais trop courte pour le 5 km
  mk(7, 15, 90), mk(8, 10, 52), mk(9, 21, 130),
  { id: "manual", date: "2026-09-20", km: 9, minutes: 40 }, // saisie à la main : pas d'identifiant Strava
];
const c3 = effortCandidates(pool, 3, 99);
const c3ids = c3.map((a) => a.id).sort();
check("candidats : les plus rapides en allure parmi les sorties assez longues", c3.every((a) => a.km >= 5) && c3.some((a) => a.id === "strava-8"), c3ids);
check("candidats : jamais la sortie manuelle ni une sortie trop courte", !c3ids.includes("manual") && !c3ids.includes("strava-6"));
check("candidats : pas de marathon sans sortie assez longue", effortCandidates(pool, 1, 99).every((a) => a.km < 42.195));
const fetched = pool.map((a) => (a.id === "strava-8" ? { ...a, efforts: {} } : a));
check("candidats : détail déjà lu exclu, mais il occupe sa place", !effortCandidates(fetched, 1, 99).some((a) => a.id === "strava-8") && effortCandidates(fetched, 1, 99).length < effortCandidates(pool, 1, 99).length + 1);
check("candidats : plafonnés, les plus récents d'abord", effortCandidates(pool, 9, 2).length === 2 && effortCandidates(pool, 9, 2)[0].date >= effortCandidates(pool, 9, 2)[1].date);
check("candidats : aucun sans activité", effortCandidates([], 6, 25).length === 0);

const applied = applyEfforts(pool, new Map([["strava:8", { "5k": 24 }], ["strava:9", {}]]));
check("efforts enregistrés sur la bonne activité", applied.find((a) => a.id === "strava-8")!.efforts!["5k"] === 24 && applied.find((a) => a.id === "strava-9")!.efforts !== undefined && applied.find((a) => a.id === "strava-1")!.efforts === undefined);
const keep = applyEfforts(applied, new Map([["strava:8", { "5k": 1 }]]));
check("des efforts déjà lus ne sont pas écrasés", keep.find((a) => a.id === "strava-8")!.efforts!["5k"] === 24);

{
  const urls: string[] = [];
  const headers: (string | undefined)[] = [];
  const progress: number[] = [];
  const res = await fetchEfforts("tok", [1, 2, 3, 4, 5], async (u, init) => {
    urls.push(u);
    headers.push(init?.headers?.Authorization);
    if (u.includes("/activities/1?")) return respE(200, detail);
    if (u.includes("/activities/2?")) return respE(404, {});
    if (u.includes("/activities/3?")) return respE(500, {});
    return respE(429, {});
  }, (done) => progress.push(done));
  check("détail lu avec le jeton, sans tous les efforts", urls[0] === "https://www.strava.com/api/v3/activities/1?include_all_efforts=false" && headers[0] === "Bearer tok");
  check("efforts rangés par identifiant", near(res.efforts.get(1)!["5k"]!, 24.75));
  check("activité supprimée : marquée sans effort", Object.keys(res.efforts.get(2)!).length === 0);
  check("erreur passagère : réessayée plus tard (pas marquée)", !res.efforts.has(3));
  check("quota atteint : arrêt net, le reste n'est pas demandé", res.stopped?.kind === "quota" && urls.length === 4 && !res.efforts.has(4) && !res.efforts.has(5), urls);
  check("progression signalée", progress.length >= 1);
  const offline = await fetchEfforts("tok", [1, 2], async () => {
    throw new Error("offline");
  });
  check("hors ligne : arrêt, rien de marqué", offline.stopped?.kind === "reseau" && offline.efforts.size === 0);
  const refused = await fetchEfforts("tok", [1, 2], async () => respE(401, {}));
  check("accès refusé : arrêt", refused.stopped?.kind === "autorisation");
  const all = await fetchEfforts("tok", [1, 2], async () => respE(200, detail));
  const tempRes = await fetchEfforts("tok", [1, 2, 3], async (u) => {
    if (u.includes("/activities/1?")) return respE(200, { ...detail, average_temp: 24 });
    if (u.includes("/activities/2?")) return respE(200, detail);
    return respE(404, {});
  });
  check("température lue avec les efforts", tempRes.temps.get(1) === 24 && tempRes.temps.get(2) === null && tempRes.temps.get(3) === null && tempRes.efforts.size === 3);
  check("tout lu : pas d'arrêt", all.stopped === null && all.efforts.size === 2);
}

// ---------- Température et détails ----------
check("température lue dans le détail", parseTemp({ average_temp: 21 }) === 21 && parseTemp({ average_temp: -3.5 }) === -3.5 && parseTemp({ average_temp: 0 }) === 0);
check("pas de capteur : null", parseTemp({}) === null && parseTemp(null) === null && parseTemp({ average_temp: "21" }) === null && parseTemp({ average_temp: 200 }) === null && parseTemp({ average_temp: NaN }) === null);

const dAct = (n: number, extra: Partial<Activity> = {}): Activity => ({ id: `strava-${n}`, date: `2026-09-${String(n).padStart(2, "0")}`, km: 6, minutes: 36, externalId: `strava:${n}`, source: "strava", ...extra });
const many = Array.from({ length: 20 }, (_, i) => dAct(i + 1));
const targets = detailTargets(many, 0, 99);
check("détails : les plus récentes sans température d'abord", targets.length === RECENT_TEMP_COUNT && targets[0].id === "strava-20" && targets.every((a) => Number(a.id.slice(7)) > 20 - RECENT_TEMP_COUNT), targets.map((a) => a.id));
check("une sortie dont la température est connue (même absente) n'est pas relue", !detailTargets([dAct(5, { temp: 18 }), dAct(6, { temp: null })], 0, 99).length);
check("sortie manuelle ignorée", detailTargets([{ id: "m", date: "2026-09-30", km: 6, minutes: 36 }], 0, 99).length === 0);
const withEff = detailTargets([...many.slice(0, 18), dAct(19, { temp: 20 }), dAct(20, { temp: 20 })], 6, 99);
check("les efforts s'ajoutent aux températures, sans doublon", new Set(withEff.map((a) => a.id)).size === withEff.length && withEff.length > RECENT_TEMP_COUNT - 2, withEff.length);
check("plafonné", detailTargets(many, 6, 5).length === 5);

const base = [dAct(1), dAct(2, { temp: 15 }), dAct(3, { efforts: { "5k": 25 } })];
const filled = applyDetails(base, { efforts: new Map([["strava:1", { "5k": 24 }], ["strava:2", { "5k": 23 }], ["strava:3", { "5k": 1 }]]), temps: new Map([["strava:1", 22], ["strava:2", 30], ["strava:3", null]]) });
check("détails enregistrés sur l'activité lue", filled[0].temp === 22 && filled[0].efforts!["5k"] === 24);
check("une température connue n'est jamais écrasée", filled[1].temp === 15 && filled[1].efforts!["5k"] === 23);
check("des efforts connus non plus, et « pas de capteur » est mémorisé", filled[2].efforts!["5k"] === 25 && filled[2].temp === null);
check("activité non lue : inchangée", applyDetails(base, { efforts: new Map(), temps: new Map() }).every((a, i) => a === base[i]));

// ---------- Détail d'une sortie (temps par km, cadence, calories) ----------
{
  const raw = {
    splits_metric: [
      { distance: 1000.2, moving_time: 330, average_heartrate: 148.4, elevation_difference: 3.2 },
      { distance: 1000, moving_time: 322, average_heartrate: 155, elevation_difference: -4.6 },
      { distance: 520, moving_time: 170 },
      { distance: 0, moving_time: 50 },
      { distance: 1000, moving_time: "x" },
    ],
    average_cadence: 86.4, calories: 612.7, elapsed_time: 2400, device_name: " Garmin Forerunner 265 ",
  };
  const d = parseRunDetail(raw)!;
  check("détail : kilomètres lus, valeurs invalides écartées", d.splits.length === 3 && d.splits[0].km === 1 && d.splits[0].seconds === 330 && d.splits[2].km === 0.52, d.splits);
  check("détail : FC et dénivelé par kilomètre (négatif conservé)", d.splits[0].hr === 148 && d.splits[1].elev === -5 && d.splits[2].hr === undefined && d.splits[2].elev === undefined, d.splits);
  check("détail : cadence doublée (un pied), calories, durée totale, appareil", d.cadence === 173 && d.calories === 613 && d.elapsedMinutes === 40 && d.device === "Garmin Forerunner 265", d);
  const bare = parseRunDetail({})!;
  check("détail sans kilomètres : objet vide mais lu", bare.splits.length === 0 && bare.cadence === undefined && bare.calories === undefined && bare.device === undefined, bare);
  check("réponse illisible : null", parseRunDetail(null) === null && parseRunDetail("x") === null);
  check("cadence ou calories aberrantes ignorées", parseRunDetail({ average_cadence: 400 })!.cadence === undefined && parseRunDetail({ calories: -3 })!.calories === undefined);

  const res = await fetchEfforts("tok", [1, 2], async (u) => (u.includes("/activities/1?") ? respE(200, { ...detail, ...raw }) : respE(404, {})));
  check("client : détail rangé par identifiant, 404 marqué lu", res.details.get(1)!.splits.length === 3 && res.details.get(2)!.splits.length === 0);

  const base2 = [dAct(1), dAct(2, { detail: { splits: [], calories: 5 } })];
  const filled2 = applyDetails(base2, { efforts: new Map(), temps: new Map(), details: new Map([["strava:1", d], ["strava:2", d]]) });
  check("détail enregistré sur l'activité lue", filled2[0].detail?.splits.length === 3);
  check("un détail déjà lu n'est jamais écrasé", filled2[1].detail?.calories === 5 && filled2[1].detail.splits.length === 0);
  check("sans détail lu : activité inchangée", applyDetails(base2, { efforts: new Map(), temps: new Map() }).every((x, i) => x === base2[i]));

  const snapText = makeBackup({ ...EMPTY_SNAPSHOT, plan, activities: [{ ...dAct(1), detail: d }], done: {}, confirmed: true }, new Date("2026-10-04T10:00:00Z"));
  const back2 = parseBackup(snapText);
  check("sauvegarde : le détail survit à l'aller-retour", back2.ok && back2.data.activities[0].detail?.splits[1].elev === -5, back2);
  const broken = JSON.parse(snapText);
  broken.data.activities[0].detail.splits[0].seconds = -1;
  check("sauvegarde : détail invalide refusé", !parseBackup(JSON.stringify(broken)).ok);
}

// ---------- Courbes (FC, allure, altitude) ----------
{
  const n = 1000;
  const time = Array.from({ length: n }, (_, i) => i * 3);
  const vel = Array.from({ length: n }, (_, i) => (i < 10 ? 0.1 : 3.0));
  const hr = Array.from({ length: n }, (_, i) => 120 + Math.floor(i / 20));
  const alt = Array.from({ length: n }, (_, i) => 100 + (i % 50));
  const raw = { time: { data: time }, velocity_smooth: { data: vel }, heartrate: { data: hr }, altitude: { data: alt } };
  const se = parseSeries(raw)!;
  check("courbes : ramenées à une centaine de points, tableaux alignés", se.t.length === SERIES_POINTS && se.hr!.length === SERIES_POINTS && se.pace!.length === SERIES_POINTS && se.alt!.length === SERIES_POINTS, se.t.length);
  check("courbes : temps croissant jusqu'à la fin de la sortie", se.t.every((v, i) => i === 0 || v > se.t[i - 1]) && se.t[se.t.length - 1] === 2997);
  check("courbes : allure en secondes par km, 0 à l'arrêt", se.pace![0] === 0 && se.pace![50] === 333, se.pace!.slice(0, 3));
  check("courbes : FC moyennée par tronçon", se.hr![0] >= 120 && se.hr![99] > se.hr![0]);
  const noHr = parseSeries({ time: { data: time }, velocity_smooth: { data: vel } })!;
  check("courbes : sans capteur de FC, pas de courbe de FC", noHr.hr === undefined && noHr.pace !== undefined && noHr.alt === undefined);
  const short = parseSeries({ time: { data: [0, 1, 2] }, velocity_smooth: { data: [3, 3, 3] } })!;
  check("courbes : sortie très courte gardée telle quelle", short.t.length === 3);
  check("courbes : sans flux de temps, objet vide mais lu", parseSeries({})!.t.length === 0 && parseSeries({ time: { data: "x" } })!.t.length === 0);
  check("courbes : réponse illisible, null", parseSeries(null) === null && parseSeries([]) === null);
  check("courbes : tableau de longueur différente ignoré", parseSeries({ time: { data: time }, heartrate: { data: [100, 101] } })!.hr === undefined);

  const urls2: string[] = [];
  const ok = await fetchSeries("tok", 7, async (u, init) => { urls2.push(u + "|" + init?.headers?.Authorization); return respE(200, raw); });
  check("client : une requête, flux par type, jeton envoyé", urls2.length === 1 && urls2[0].startsWith("https://www.strava.com/api/v3/activities/7/streams?") && urls2[0].includes("key_by_type=true") && urls2[0].endsWith("|Bearer tok") && ok.series!.t.length === SERIES_POINTS && ok.stopped === null, urls2);
  const gone = await fetchSeries("tok", 7, async () => respE(404, {}));
  check("client : 404, courbes vides marquées lues", gone.series?.t.length === 0 && gone.stopped === null);
  const quota = await fetchSeries("tok", 7, async () => respE(429, {}));
  check("client : quota, rien de marqué", quota.series === null && quota.stopped?.kind === "quota");
  const off = await fetchSeries("tok", 7, async () => { throw new Error("offline"); });
  check("client : hors ligne, rien de marqué", off.series === null && off.stopped?.kind === "reseau");

  const withSeries = makeBackup({ ...EMPTY_SNAPSHOT, plan, activities: [{ ...dAct(1), detail: { splits: [], series: se } }], done: {}, confirmed: true }, new Date("2026-10-04T10:00:00Z"));
  const rt = parseBackup(withSeries);
  check("sauvegarde : les courbes survivent à l'aller-retour", rt.ok && rt.data.activities[0].detail?.series?.t.length === SERIES_POINTS, rt);
  const bad = JSON.parse(withSeries);
  bad.data.activities[0].detail.series.hr.pop();
  check("sauvegarde : courbes de longueurs différentes refusées", !parseBackup(JSON.stringify(bad)).ok);
}

// ---------- Fusion ----------
const m1 = mergeStrava(plan, empty, [], [run(100, s1.date, s1.km, 40)]);
check("une course ajoutée", m1.added === 1 && m1.state.activities.length === 1 && m1.seen.includes("strava:100"));
check("rattachée à la séance du jour", m1.state.activities[0].sessionId === s1.id && m1.state.done[s1.id] === true, m1.state);

const m2 = mergeStrava(plan, m1.state, m1.seen, [run(100, s1.date, s1.km, 40)]);
check("re-synchronisation : aucun doublon", m2.added === 0 && m2.state.activities.length === 1);

const afterDelete = removeActivity(m1.state, m1.state.activities[0].id);
const m3 = mergeStrava(plan, afterDelete, m1.seen, [run(100, s1.date, s1.km, 40)]);
check("une course supprimée ne revient pas", m3.added === 0 && m3.state.activities.length === 0);

const free = mergeStrava(plan, empty, [], [run(101, "2026-10-03", 6, 36)]);
check("sans séance ce jour-là : sortie libre", free.state.activities[0].sessionId === undefined && Object.keys(free.state.done).length === 0);

const twoSameDay = mergeStrava(plan, empty, [], [run(102, s1.date, 2, 12), run(103, s1.date, s1.km, 40)]);
const linked = twoSameDay.state.activities.filter((x) => x.sessionId);
check("deux sorties le même jour : la plus longue prend la séance", linked.length === 1 && linked[0].externalId === "strava:103", twoSameDay.state.activities);

const doneAlready: Tracked = { activities: [], done: { [s1.id]: true } };
const noReuse = mergeStrava(plan, doneAlready, [], [run(104, s1.date, s1.km, 40)]);
check("séance déjà cochée : non rattachée", noReuse.state.activities[0].sessionId === undefined);

const manual: Activity = { id: "a1", date: s2.date, km: s2.km, minutes: 41, sessionId: s2.id, feeling: 4, note: "ok" };
const withManual = addActivity(empty, manual);
const adopt = mergeStrava(plan, withManual, [], [run(105, s2.date, s2.km + 0.2, 40)]);
check("saisie à la main reconnue, pas dupliquée", adopt.added === 0 && adopt.matched === 1 && adopt.state.activities.length === 1);
check("saisie à la main conservée telle quelle", adopt.state.activities[0].feeling === 4 && adopt.state.activities[0].minutes === 41 && adopt.state.activities[0].externalId === "strava:105");
const adoptRich = mergeStrava(plan, withManual, [], [run(110, s2.date, s2.km, 40, { average_heartrate: 148, total_elevation_gain: 30 })]);
check("saisie reconnue : reçoit cœur et dénivelé", adoptRich.state.activities[0].avgHr === 148 && adoptRich.state.activities[0].elevation === 30 && adoptRich.state.activities[0].minutes === 41);
const farApart = mergeStrava(plan, withManual, [], [run(106, s2.date, s2.km * 2, 80)]);
check("distance très différente : ajoutée en plus", farApart.added === 1 && farApart.state.activities.length === 2);
const other = mergeStrava(plan, withManual, [], [run(107, "2026-10-04", s2.km, 40)]);
check("autre jour : ajoutée en plus", other.added === 1 && other.state.activities.length === 2);

const mixed = mergeStrava(plan, empty, [], [run(108, "2026-10-03", 5, 30, { sport_type: "Ride" }), run(109, "2026-10-03", 5, 30)]);
check("seules les courses sont importées", mixed.state.activities.length === 1);
check("entrée non modifiée", empty.activities.length === 0 && Object.keys(empty.done).length === 0);

// ---------- Fenêtre de synchro ----------
check("première synchro : tout l'historique", syncAfter(null) === 0);
const last = Date.parse("2026-10-20T12:00:00Z");
check("synchro suivante : recouvre la précédente", syncAfter(last) === last / 1000 - 7 * 86400);

// ---------- Connexion ----------
const url = new URL(authorizeUrl("123", "http://localhost:5173/", "abc"));
check("URL d'autorisation", url.origin + url.pathname === "https://www.strava.com/oauth/authorize" && url.searchParams.get("client_id") === "123" && url.searchParams.get("scope") === STRAVA_SCOPE && url.searchParams.get("state") === "abc");
check("retour sans paramètre", parseCallback("", "abc").kind === "none");
const okCb = parseCallback("?state=abc&code=XYZ&scope=read,activity:read", "abc");
check("retour valide", okCb.kind === "code" && okCb.code === "XYZ" && okCb.scopes.join() === "read,activity:read");
const fullCb = parseCallback("?state=abc&code=XYZ&scope=read,activity:read,profile:read_all,read_all", "abc");
check("retour : droits accordés relevés", fullCb.kind === "code" && fullCb.scopes.includes("profile:read_all") && fullCb.scopes.includes("read_all"));
const baseState = { ...EMPTY_STRAVA, tokens: { accessToken: "a", refreshToken: "r", expiresAt: 1 } };
check("connexion ancienne : droits de base, reconnexion proposée", hasScope(baseState, "activity:read") && !hasScope(baseState, "profile:read_all") && lacksScopes(baseState));
check("connexion complète : rien à accorder", !lacksScopes({ ...baseState, scopes: STRAVA_SCOPE.split(",") }) && !lacksScopes(EMPTY_STRAVA));
check("retour avec mauvais state refusé", parseCallback("?state=autre&code=XYZ&scope=read,activity:read", "abc").kind === "error");
check("retour sans state attendu refusé", parseCallback("?state=abc&code=XYZ&scope=read,activity:read", null).kind === "error");
check("autorisation refusée", parseCallback("?state=abc&error=access_denied", "abc").kind === "error");
check("scope activités non accordé", parseCallback("?state=abc&code=XYZ&scope=read", "abc").kind === "error");
check("jeton expiré (avec marge)", tokensExpired({ accessToken: "a", refreshToken: "r", expiresAt: 1000 }, 950) && !tokensExpired({ accessToken: "a", refreshToken: "r", expiresAt: 1000 }, 900));

// ---------- Client réseau (faux fetch) ----------
const tokens: StravaTokens = { accessToken: "old", refreshToken: "r1", expiresAt: 1000 };
const cfg = { clientId: "123", clientSecret: "sec" };
const resp = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

{
  const calls: { url: string; init?: Parameters<FetchLike>[1] }[] = [];
  const fake: FetchLike = async (u, init) => {
    calls.push({ url: u, init });
    if (u.includes("/oauth/token")) return resp(200, { access_token: "new", refresh_token: "r2", expires_at: 99999 });
    return resp(200, [run(1, "2026-10-05", 5, 30)]);
  };
  const r = await fetchRuns(cfg, tokens, 123, 5000, fake);
  check("jeton expiré : rafraîchi avant la lecture", calls[0].url.includes("/oauth/token") && calls[0].init?.body?.includes("grant_type=refresh_token") === true && calls[0].init.body.includes("refresh_token=r1"));
  check("nouveaux jetons renvoyés", r.tokens.accessToken === "new" && r.tokens.refreshToken === "r2");
  check("lecture avec le nouveau jeton", calls[1].init?.headers?.Authorization === "Bearer new" && calls[1].url.includes("after=123"));
  const calls2: string[] = [];
  const r2 = await fetchRuns(cfg, { ...tokens, expiresAt: 99999 }, 1, 5000, async (u) => (calls2.push(u), resp(200, [])));
  check("jeton valide : pas de rafraîchissement", calls2.length === 1 && !calls2[0].includes("oauth") && r2.tokens.accessToken === "old");
}
{
  const pages: unknown[][] = [Array.from({ length: 100 }, (_, i) => run(i + 1, "2026-10-05", 5, 30)), Array.from({ length: 3 }, (_, i) => run(1000 + i, "2026-10-06", 5, 30))];
  let n = 0;
  const all = await listActivities("t", 0, async () => resp(200, pages[n++] ?? []));
  check("pagination : lit jusqu'à la dernière page", all.length === 103 && n === 2, { len: all.length, n });
}
async function fails(status: number | "throw", body: unknown = {}): Promise<StravaError | null> {
  try {
    await listActivities("t", 0, async () => {
      if (status === "throw") throw new Error("offline");
      return resp(status, body);
    });
    return null;
  } catch (e) {
    return e instanceof StravaError ? e : null;
  }
}
check("401 : autorisation", (await fails(401))?.kind === "autorisation");
check("429 : quota", (await fails(429))?.kind === "quota");
check("hors ligne : réseau", (await fails("throw"))?.kind === "reseau");
check("500 : réponse", (await fails(500))?.kind === "reponse");
check("corps qui n'est pas une liste : réponse", (await fails(200, { message: "x" }))?.kind === "reponse");
{
  const e = await (async () => {
    try {
      await fetchRuns(cfg, tokens, 0, 5000, async () => resp(200, { access_token: "x" }));
      return null;
    } catch (err) {
      return err as StravaError;
    }
  })();
  check("jetons incomplets refusés", e?.kind === "reponse");
}

// ---------- Sauvegarde ----------
const imported = m1.state.activities;
const text = makeBackup({ ...EMPTY_SNAPSHOT, plan, activities: imported, done: m1.state.done, confirmed: true }, new Date("2026-10-06T10:00:00Z"));
const back = parseBackup(text);
check("la sauvegarde conserve l'origine Strava", back.ok && back.data.activities[0].externalId === "strava:100" && back.data.activities[0].source === "strava");
check("la sauvegarde ne contient aucun secret", !text.includes("clientSecret") && !text.includes("refreshToken") && !text.includes("accessToken"));
const withEfforts = makeBackup({ ...EMPTY_SNAPSHOT, plan, activities: [{ ...imported[0], efforts: { "5k": 24.75, semi: 115 } }], done: {}, confirmed: true }, new Date());
const effBack = parseBackup(withEfforts);
check("la sauvegarde conserve les meilleurs efforts", effBack.ok && effBack.data.activities[0].efforts!["5k"] === 24.75 && effBack.data.activities[0].efforts!.semi === 115);
const emptyEff = parseBackup(makeBackup({ ...EMPTY_SNAPSHOT, plan, activities: [{ ...imported[0], efforts: {} }], done: {}, confirmed: true }, new Date()));
check("efforts vides conservés (détail lu, aucun effort)", emptyEff.ok && JSON.stringify(emptyEff.data.activities[0].efforts) === "{}");
const badEff = JSON.parse(withEfforts);
badEff.data.activities[0].efforts = { "3k": 10 };
check("distance d'effort inconnue refusée", !parseBackup(JSON.stringify(badEff)).ok);
badEff.data.activities[0].efforts = { "5k": -2 };
check("temps d'effort négatif refusé", !parseBackup(JSON.stringify(badEff)).ok);
badEff.data.activities[0].efforts = [1];
check("efforts qui ne sont pas un objet refusés", !parseBackup(JSON.stringify(badEff)).ok);
const bad = JSON.parse(text);
bad.data.activities[0].externalId = 42;
const richText = makeBackup({ ...EMPTY_SNAPSHOT, plan, activities: [{ ...imported[0], avgHr: 150, maxHr: 175, elevation: 80 }], done: {}, confirmed: true }, new Date());
const richBack = parseBackup(richText);
check("la sauvegarde conserve cœur et dénivelé", richBack.ok && richBack.data.activities[0].avgHr === 150 && richBack.data.activities[0].elevation === 80);
const badHr = JSON.parse(richText);
badHr.data.activities[0].avgHr = "150";
check("fréquence invalide refusée", !parseBackup(JSON.stringify(badHr)).ok);
badHr.data.activities[0].avgHr = 150;
badHr.data.activities[0].elevation = -3;
check("dénivelé négatif refusé", !parseBackup(JSON.stringify(badHr)).ok);
check("externalId invalide refusé", !parseBackup(JSON.stringify(bad)).ok);
check("état vide par défaut", EMPTY_STRAVA.tokens === null && EMPTY_STRAVA.seen.length === 0);

// ---------- Données supplémentaires : détail, flux, zones, compte ----------
{
  // Exemple de la documentation du format polyline de Google.
  const pts = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
  check("tracé : décodage du format polyline", pts.length === 3 && near(pts[0][0], 38.5) && near(pts[0][1], -120.2) && near(pts[2][0], 43.252) && near(pts[2][1], -126.453), pts);
  check("tracé : texte tronqué ou vide sans plantage", decodePolyline("").length === 0 && Array.isArray(decodePolyline("_p~iF")));
  const many = Array.from({ length: 500 }, (_, i) => i);
  const few = simplify(many, 60);
  check("tracé : simplifié, premier et dernier points gardés", few.length === 60 && few[0] === 0 && few[59] === 499 && simplify([1, 2, 3], 60).length === 3);

  const raw = {
    max_speed: 5.2, elev_high: 312.4, elev_low: 80.6, device_watts: true, average_watts: 251.6, max_watts: 620, weighted_average_watts: 262,
    description: "  Belle sortie au bord de l'eau  ", workout_type: 2, gear: { id: "g1", name: "Pegasus 40" },
    start_latlng: [48.85661, 2.35222], end_latlng: [48.86, 2.36], map: { summary_polyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" },
    segment_efforts: [
      { name: "Montée du parc", moving_time: 95, segment: { distance: 420 }, pr_rank: 1, average_heartrate: 171.2 },
      { name: "Ligne droite", elapsed_time: 40, distance: 200, pr_rank: 7 },
      { name: "", moving_time: 10, distance: 10 },
    ],
  };
  const d = parseRunDetail(raw)!;
  check("détail : vitesse max, altitudes", d.maxSpeedKmh === 18.7 && d.elevHigh === 312 && d.elevLow === 81, d);
  check("détail : puissance mesurée", d.watts?.avg === 252 && d.watts?.max === 620 && d.watts?.weighted === 262, d.watts);
  check("détail : puissance estimée ignorée", parseRunDetail({ ...raw, device_watts: false })!.watts === undefined && parseRunDetail({ average_watts: 200 })!.watts === undefined);
  check("détail : description, type, matériel", d.description === "Belle sortie au bord de l'eau" && d.workoutType === "long" && d.gear?.name === "Pegasus 40" && d.gear.id === "g1");
  check("détail : départ, arrivée et tracé", d.start?.[0] === 48.85661 && d.end?.[1] === 2.36 && d.route?.length === 3);
  check("détail : segments (nom vide ignoré, rang au-delà de 3 ignoré)", d.segments?.length === 2 && d.segments[0].seconds === 95 && d.segments[0].meters === 420 && d.segments[0].prRank === 1 && d.segments[0].hr === 171 && d.segments[1].prRank === undefined && d.segments[1].seconds === 40, d.segments);
  check("détail : version de lecture marquée", d.ver === 2 && parseRunDetail({})!.ver === 2);
  const poor = parseRunDetail({ max_speed: 99, elev_high: "x", workout_type: 0, gear: { id: 5 }, start_latlng: [200, 0], map: { summary_polyline: "" }, segment_efforts: "x" })!;
  check("détail : valeurs aberrantes ignorées", poor.maxSpeedKmh === undefined && poor.elevHigh === undefined && poor.workoutType === undefined && poor.gear === undefined && poor.start === undefined && poor.route === undefined && poor.segments === undefined, poor);

  const n = 400;
  const time = Array.from({ length: n }, (_, i) => i * 5);
  const latlng = Array.from({ length: n }, (_, i) => [48 + i * 0.0001, 2 + i * 0.0001]);
  const moving = Array.from({ length: n }, (_, i) => !(i >= 10 && i < 14));
  const flux = {
    time: { data: time }, latlng: { data: latlng }, cadence: { data: Array.from({ length: n }, () => 85) }, watts: { data: Array.from({ length: n }, () => 240) },
    temp: { data: Array.from({ length: n }, () => 17) }, grade_smooth: { data: Array.from({ length: n }, (_, i) => (i < 200 ? 2.5 : -3)) }, moving: { data: moving },
  };
  const se = parseSeries(flux)!;
  check("flux : cadence doublée (un seul pied), puissance, température", se.cadence?.every((v) => v === 170) && se.watts?.every((v) => v === 240) && se.temp?.every((v) => v === 17), se.cadence?.slice(0, 3));
  check("flux : pente signée", se.grade?.[0] === 2.5 && se.grade[99] === -3 && se.grade.length === se.t.length, se.grade?.slice(95, 100));
  check("flux : tracé aligné sur les courbes", se.route?.length === se.t.length && se.route[0][0] > 47.99 && se.route[99][0] > se.route[0][0]);
  check("flux : temps à l'arrêt", se.stopped === 20, se.stopped);
  check("flux : version de lecture marquée", se.ver === 2 && parseSeries({})!.ver === 2);
  const none = parseSeries({ time: { data: time } })!;
  check("flux : sans capteur, pas de courbe en trop", none.cadence === undefined && none.watts === undefined && none.temp === undefined && none.route === undefined && none.stopped === undefined);
  check("flux : tracé de longueur différente ignoré", parseSeries({ time: { data: time }, latlng: { data: [[1, 1]] } })!.route === undefined);

  const zones = parseZones([
    { type: "heartrate", distribution_buckets: [{ min: 0, max: 120, time: 300 }, { min: 120, max: 150, time: 1200 }, { min: 150, max: -1, time: 100 }] },
    { type: "power", distribution_buckets: [{ min: 0, max: 100, time: 0 }, { min: 100, max: -1, time: 0 }] },
    { type: "pace", distribution_buckets: [] },
  ]);
  check("zones : fréquence cardiaque lue, puissance sans temps et autres types ignorés", zones?.length === 1 && zones[0].type === "heartrate" && zones[0].buckets.length === 3 && zones[0].buckets[2].max === -1, zones);
  check("zones : réponse qui n'est pas une liste, null", parseZones({}) === null && parseZones([])!.length === 0);

  const zurls: string[] = [];
  const zr = await fetchZones("tok", 9, async (u, init) => (zurls.push(u + "|" + init?.headers?.Authorization), respE(200, [{ type: "heartrate", distribution_buckets: [{ min: 0, max: 100, time: 5 }, { min: 100, max: -1, time: 5 }] }])));
  check("client zones : une requête, jeton envoyé", zurls.length === 1 && zurls[0] === "https://www.strava.com/api/v3/activities/9/zones|Bearer tok" && zr.zones?.length === 1);
  const pay = await fetchZones("tok", 9, async () => respE(402, {}));
  check("client zones : abonnement requis, aucune zone marquée lue", pay.zones?.length === 0 && pay.stopped === null);
  const refused = await fetchZones("tok", 9, async () => respE(403, {}));
  check("client zones : droit refusé, rien de marqué", refused.zones === null && refused.stopped?.kind === "autorisation");
  const quotaZ = await fetchZones("tok", 9, async () => respE(429, {}));
  check("client zones : quota, rien de marqué", quotaZ.zones === null && quotaZ.stopped?.kind === "quota");

  const needs = (x: Partial<Activity>, withZones = false) => needsDetail({ id: "a", date: "2026-10-01", km: 5, minutes: 30, ...x }, withZones);
  const fresh = { splits: [], ver: 2, series: { t: [], ver: 2 }, zones: [] };
  check("à lire : rien lu, détail ancien, courbes anciennes", needs({}) && needs({ detail: { splits: [], series: { t: [], ver: 2 } } }) && needs({ detail: { splits: [], ver: 2, series: { t: [] } } }) && needs({ detail: { splits: [], ver: 2 } }));
  check("à lire : tout à jour, rien à relire ; zones seulement si le droit existe", !needs({ detail: fresh }) && !needs({ detail: { ...fresh, zones: undefined } }) && needs({ detail: { ...fresh, zones: undefined } }, true) && !needs({ detail: fresh }, true));

  // Compte
  const stats = parseStats({ recent_run_totals: { count: 4, distance: 31234, moving_time: 11000, elevation_gain: 120.4 }, ytd_run_totals: { count: 90, distance: 800000, moving_time: 300000, elevation_gain: 5000 }, all_run_totals: { count: "x" } })!;
  check("compte : totaux de course", stats.recent?.km === 31.2 && stats.recent.count === 4 && stats.recent.elevation === 120 && stats.year?.km === 800 && stats.all === undefined, stats);
  check("compte : réponse illisible", parseStats(null) === null && parseAthlete(null) === null && parseClubs({}) === null && parseRoutes("x") === null);
  const ath = parseAthlete({ id: 77, firstname: "Secret", shoes: [{ id: "g1", name: "Pegasus 40", distance: 512345 }, { id: "g2", name: "", distance: 1 }, { name: "x" }] })!;
  check("compte : identifiant et chaussures, rien d'autre du profil", ath.id === 77 && ath.shoes.length === 1 && ath.shoes[0].km === 512 && !("firstname" in ath), ath);
  const clubs = parseClubs([{ id: 1, name: "Les Foulées", member_count: 120, city: "Lyon" }, { id: 2 }, { id: 3, name: "Trail" }])!;
  check("compte : clubs", clubs.length === 2 && clubs[0].members === 120 && clubs[0].city === "Lyon" && clubs[1].members === undefined);
  const routes = parseRoutes([
    { id: 1, name: "Boucle du lac", type: 2, distance: 10250, elevation_gain: 85.5, map: { summary_polyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" } },
    { id: 2, name: "Vélo", type: 1, distance: 40000 },
  ])!;
  check("compte : seuls les itinéraires de course", routes.length === 1 && routes[0].km === 10.3 && routes[0].elevation === 86 && routes[0].route?.length === 3, routes);

  const base = "https://www.strava.com/api/v3";
  const asked: string[] = [];
  const fakeApi = (statusFor: (u: string) => number): FetchLike => async (u) => {
    asked.push(u);
    const st = statusFor(u);
    if (st !== 200) return respE(st, {});
    if (u === base + "/athlete") return respE(200, { id: 77, shoes: [{ id: "g1", name: "Pegasus 40", distance: 400000 }] });
    if (u.endsWith("/stats")) return respE(200, { recent_run_totals: { count: 1, distance: 5000, moving_time: 1500, elevation_gain: 10 } });
    if (u.endsWith("/athlete/clubs")) return respE(200, [{ id: 1, name: "Club" }]);
    if (u.includes("/routes")) return respE(200, [{ id: 5, name: "Parcours", type: 2, distance: 8000 }]);
    return respE(404, {});
  };
  const all = await fetchAccount({ scopes: STRAVA_SCOPE.split(",") }, "tok", 1234, fakeApi(() => 200));
  check("client compte : tout lu avec tous les droits", all.athleteId === 77 && all.loadedAt === 1234 && all.shoes?.length === 1 && all.totals?.recent?.count === 1 && all.clubs?.length === 1 && all.routes?.length === 1, all);
  check("client compte : identifiant lu avant les totaux", asked[0] === base + "/athlete" && asked.includes(base + "/athletes/77/stats") && asked.includes(base + "/athletes/77/routes?per_page=50"), asked);
  asked.length = 0;
  const basic = await fetchAccount({}, "tok", 1, fakeApi(() => 200));
  check("client compte : sans les droits en plus, ni chaussures ni itinéraires (et pas de requête d'itinéraires)", basic.shoes === undefined && basic.routes === undefined && basic.totals !== undefined && !asked.some((u) => u.includes("/routes")), basic);
  const partial = await fetchAccount({ scopes: STRAVA_SCOPE.split(",") }, "tok", 1, fakeApi((u) => (u.includes("/routes") || u.endsWith("/clubs") ? 403 : 200)));
  check("client compte : une rubrique refusée n'empêche pas les autres", partial.routes === undefined && partial.clubs === undefined && partial.shoes?.length === 1 && partial.totals !== undefined);
  let refusedErr: StravaError | null = null;
  try {
    await fetchAccount({}, "tok", 1, async () => respE(401, {}));
  } catch (e) {
    refusedErr = e as StravaError;
  }
  check("client compte : accès refusé dès le profil, erreur claire", refusedErr?.kind === "autorisation");
  let quotaErr: StravaError | null = null;
  try {
    await fetchAccount({ scopes: STRAVA_SCOPE.split(",") }, "tok", 1, fakeApi((u) => (u.endsWith("/stats") ? 429 : 200)));
  } catch (e) {
    quotaErr = e as StravaError;
  }
  check("client compte : quota remonté", quotaErr?.kind === "quota");

  // Sauvegarde du détail étendu
  const full = { ...d, series: { ...se, ver: 2 }, zones: zones! };
  const text = makeBackup({ ...EMPTY_SNAPSHOT, plan, activities: [{ id: "x1", date: "2026-10-01", km: 6, minutes: 36, externalId: "strava:1", source: "strava", detail: full }], done: {}, confirmed: true }, new Date());
  const rt = parseBackup(text);
  check("sauvegarde : le détail étendu survit à l'aller-retour", rt.ok && rt.data.activities[0].detail?.segments?.length === 2 && rt.data.activities[0].detail?.zones?.[0].buckets.length === 3 && rt.data.activities[0].detail?.series?.route?.length === se.t.length && rt.data.activities[0].detail?.gear?.name === "Pegasus 40", rt);
  const brk = JSON.parse(text);
  brk.data.activities[0].detail.series.route.pop();
  check("sauvegarde : tracé de longueur différente refusé", !parseBackup(JSON.stringify(brk)).ok);
  const brk2 = JSON.parse(text);
  brk2.data.activities[0].detail.workoutType = "marathon";
  check("sauvegarde : type de sortie inconnu refusé", !parseBackup(JSON.stringify(brk2)).ok);
  const brk3 = JSON.parse(text);
  brk3.data.activities[0].detail.zones[0].type = "pace";
  check("sauvegarde : type de zone inconnu refusé", !parseBackup(JSON.stringify(brk3)).ok);
}

console.log(failures === 0 ? "\nTout est bon." : `\n${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);

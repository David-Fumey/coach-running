import { generatePlan } from "../src/lib/plan.ts";
import { addActivity, removeActivity, type Activity, type Tracked } from "../src/lib/activities.ts";
import { makeBackup, parseBackup, EMPTY_SNAPSHOT } from "../src/lib/backup.ts";
import {
  EMPTY_STRAVA, authorizeUrl, mergeStrava, parseCallback, syncAfter, toActivity, tokensExpired,
  type StravaRun, type StravaTokens,
} from "../src/lib/strava.ts";
import { StravaError, fetchRuns, listActivities, type FetchLike } from "../src/lib/stravaClient.ts";

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
const farApart = mergeStrava(plan, withManual, [], [run(106, s2.date, s2.km * 2, 80)]);
check("distance très différente : ajoutée en plus", farApart.added === 1 && farApart.state.activities.length === 2);
const other = mergeStrava(plan, withManual, [], [run(107, "2026-10-04", s2.km, 40)]);
check("autre jour : ajoutée en plus", other.added === 1 && other.state.activities.length === 2);

const mixed = mergeStrava(plan, empty, [], [run(108, "2026-10-03", 5, 30, { sport_type: "Ride" }), run(109, "2026-10-03", 5, 30)]);
check("seules les courses sont importées", mixed.state.activities.length === 1);
check("entrée non modifiée", empty.activities.length === 0 && Object.keys(empty.done).length === 0);

// ---------- Fenêtre de synchro ----------
const first = syncAfter(plan, null);
check("première synchro : un mois avant le plan", first === Date.parse(`${plan.weeks[0].startDate}T00:00:00Z`) / 1000 - 30 * 86400, first);
const last = Date.parse("2026-10-20T12:00:00Z");
check("synchro suivante : recouvre la précédente", syncAfter(plan, last) === last / 1000 - 7 * 86400);

// ---------- Connexion ----------
const url = new URL(authorizeUrl("123", "http://localhost:5173/", "abc"));
check("URL d'autorisation", url.origin + url.pathname === "https://www.strava.com/oauth/authorize" && url.searchParams.get("client_id") === "123" && url.searchParams.get("scope") === "read,activity:read" && url.searchParams.get("state") === "abc");
check("retour sans paramètre", parseCallback("", "abc").kind === "none");
const okCb = parseCallback("?state=abc&code=XYZ&scope=read,activity:read", "abc");
check("retour valide", okCb.kind === "code" && okCb.code === "XYZ");
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
const bad = JSON.parse(text);
bad.data.activities[0].externalId = 42;
check("externalId invalide refusé", !parseBackup(JSON.stringify(bad)).ok);
check("état vide par défaut", EMPTY_STRAVA.tokens === null && EMPTY_STRAVA.seen.length === 0);

console.log(failures === 0 ? "\nTout est bon." : `\n${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);

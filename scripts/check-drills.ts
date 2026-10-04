import { VIEW, layout, points } from "../src/lib/figures.ts";
import { POSES } from "../src/lib/poses.ts";
import { DRILLS, GUIDE, ZONE_LABEL, doseLabel, drillSeconds, drillsOf, stretchRoutine, warmupRoutine, type Drill } from "../src/lib/drills.ts";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) {
    failures++;
    console.log("ECHEC", name, detail ?? "");
  } else console.log("ok   ", name);
}

const find = (id: string): Drill => DRILLS.find((d) => d.id === id)!;

// ---------- Contenu ----------
check("identifiants uniques", new Set(DRILLS.map((d) => d.id)).size === DRILLS.length);
check("deux catégories non vides", drillsOf("echauffement").length >= 8 && drillsOf("etirement").length >= 8);
check("toutes les fiches sont détaillées", DRILLS.every((d) => d.name && d.target && d.steps.length >= 3 && d.tips.length >= 1 && d.avoid), DRILLS.filter((d) => d.steps.length < 3).map((d) => d.id));
check("zones connues", DRILLS.every((d) => d.zone in ZONE_LABEL));
check("un seul type de dosage par fiche", DRILLS.every((d) => [d.reps, d.seconds, d.meters].filter((x) => x !== undefined).length === 1), DRILLS.filter((d) => [d.reps, d.seconds, d.meters].filter((x) => x !== undefined).length !== 1).map((d) => d.id));
check("séries et valeurs positives", DRILLS.every((d) => d.sets >= 1 && (d.reps ?? d.seconds ?? d.meters ?? 0) > 0));
check("les étirements se tiennent en secondes", drillsOf("etirement").every((d) => d.seconds !== undefined && d.seconds >= 20 && d.seconds <= 60));
check("les échauffements ne se tiennent pas", drillsOf("echauffement").every((d) => d.seconds === undefined));
check("seuls les échauffements sont réservés aux séances rapides", DRILLS.every((d) => !d.fast || d.kind === "echauffement"));
check("seuls les étirements ont une version courte", DRILLS.every((d) => !d.essential || d.kind === "etirement"));
check("les guides existent", GUIDE.echauffement.rules.length >= 3 && GUIDE.etirement.rules.length >= 3 && GUIDE.echauffement.lead.length > 20);

// ---------- Dosage ----------
check("dosage en répétitions par côté", doseLabel(find("chevilles")) === "10 par côté", doseLabel(find("chevilles")));
check("dosage en répétitions", doseLabel(find("squats")) === "10", doseLabel(find("squats")));
check("dosage en séries de distance", doseLabel(find("accelerations")) === "4 × 80 m", doseLabel(find("accelerations")));
check("dosage en séries de distance par côté", doseLabel(find("pas-chasses")) === "2 × 10 m par côté", doseLabel(find("pas-chasses")));
check("dosage d'un étirement", doseLabel(find("mollet-mur")) === "30 s par côté", doseLabel(find("mollet-mur")));
check("dosage d'un étirement sans côté", doseLabel(find("enfant")) === "30 s", doseLabel(find("enfant")));

// ---------- Durées ----------
check("durée d'un étirement par côté", drillSeconds(find("mollet-mur")) === 70, drillSeconds(find("mollet-mur")));
check("durée d'un étirement sans côté", drillSeconds(find("enfant")) === 40, drillSeconds(find("enfant")));
check("toute durée est positive", DRILLS.every((d) => drillSeconds(d) > 0));

// ---------- Routines ----------
const easy = warmupRoutine(false);
const fast = warmupRoutine(true);
check("l'échauffement facile exclut les gammes rapides", easy.drills.every((d) => !d.fast) && easy.drills.length >= 6);
check("l'échauffement rapide ajoute gammes et lignes droites", fast.drills.length > easy.drills.length && fast.drills.some((d) => d.id === "accelerations") && fast.drills.some((d) => d.id === "skipping"));
check("l'échauffement rapide garde tous les exercices de base", easy.drills.every((d) => fast.drills.includes(d)));
check("les lignes droites sont en dernier", fast.drills[fast.drills.length - 1].id === "accelerations");
check("durées d'échauffement raisonnables", easy.minutes >= 3 && easy.minutes <= 10 && fast.minutes > easy.minutes && fast.minutes <= 14, [easy.minutes, fast.minutes]);

const short = stretchRoutine(false);
const full = stretchRoutine(true);
check("la version courte est incluse dans la complète", short.drills.length >= 4 && short.drills.every((d) => full.drills.includes(d)) && full.drills.length === drillsOf("etirement").length);
check("la complète est plus longue que la courte", full.minutes > short.minutes, [short.minutes, full.minutes]);
check("durées d'étirements raisonnables", short.minutes >= 3 && short.minutes <= 10 && full.minutes <= 20, [short.minutes, full.minutes]);
check("la version courte couvre mollets, cuisses, ischios, fessiers, hanches", ["mollets", "cuisses", "ischios", "fessiers", "hanches"].every((z) => short.drills.some((d) => d.zone === z)));

// ---------- Illustrations ----------
check("chaque exercice a une ou deux images", DRILLS.every((d) => (POSES[d.id]?.length ?? 0) >= 1 && POSES[d.id].length <= 2), DRILLS.filter((d) => !POSES[d.id]).map((d) => d.id));
check("aucune image sans exercice", Object.keys(POSES).every((id) => DRILLS.some((d) => d.id === id)));
check("chaque image a une légende", Object.values(POSES).every((fr) => fr.every((f) => f.label.length > 5)));
const frames = Object.entries(POSES).flatMap(([id, fr]) => fr.map((f) => ({ id, label: f.label, l: layout(f.pose) })));
check("tous les points sont finis", frames.every((f) => points(f.l).every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))));
const outside = frames.filter((f) => points(f.l).some((p) => p.x < 2 || p.x > VIEW.w - 2 || p.y < 2 || p.y > VIEW.h - 2));
check("tous les personnages restent dans le cadre", outside.length === 0, outside.map((f) => f.id + " : " + f.label));
check("le personnage ne passe pas sous le sol", frames.every((f) => points(f.l).every((p) => p.y <= f.l.floor + 6)), frames.filter((f) => points(f.l).some((p) => p.y > f.l.floor + 6)).map((f) => f.id));
check("le mur est à droite des mains et dans le cadre", frames.every((f) => f.l.wallX === undefined || (f.l.wallX > 0 && f.l.wallX < VIEW.w)));
check("la marche des ischio-jambiers est dessinée", layout(POSES.ischios[0].pose).box !== undefined);
check("la posture debout tient sur le sol", (() => { const l = layout(POSES.squats[0].pose); return Math.max(...points(l).map((p) => p.y)) <= l.floor + 1 && Math.max(...l.segs.flatMap((s) => [s.a.y, s.b.y])) >= l.floor - 1; })());
check("la tête est au-dessus des pieds debout", (() => { const l = layout(POSES.squats[0].pose); return l.head.y < Math.min(...l.segs.map((s) => Math.min(s.a.y, s.b.y))) + 5; })());

console.log(failures === 0 ? "\nTout est bon." : `\n${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);

import { useRef, useState } from "react";
import type { Plan } from "../lib/plan";
import { RACES } from "../lib/plan";
import { backupFileName } from "../lib/backup";
import type { Profile } from "../lib/nutrition";
import { fmtDate } from "../lib/format";
import { todayISO } from "../storage";
import type { StravaApi } from "../useStrava";
import ProfileForm from "./ProfileForm";
import StravaCard from "./StravaCard";

interface Props {
  profile: Profile | null;
  plan: Plan | null;
  activityCount: number;
  foodCount: number;
  onSaveProfile: (p: Profile) => void;
  /** Contenu du fichier de sauvegarde */
  getBackup: () => string;
  /** Applique une sauvegarde ; retourne un message d'erreur ou null */
  onImport: (text: string) => string | null;
  onReset: () => void;
  strava: StravaApi;
}

/** Page « Mon profil » : identité, morphologie, et gestion des données locales (sauvegarde en fichier). */
export default function ProfilePage({ profile, plan, activityCount, foodCount, onSaveProfile, getBackup, onImport, onReset, strava }: Props) {
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function download() {
    const blob = new Blob([getBackup()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupFileName(todayISO());
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setMessage({ ok: true, text: "Sauvegarde téléchargée. Garde ce fichier : il contient tout ton suivi." });
  }

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    try {
      const text = await file.text();
      if (!window.confirm("Remplacer toutes les données actuelles par celles du fichier ? Cette action est définitive.")) return;
      const error = onImport(text);
      setMessage(error ? { ok: false, text: error } : { ok: true, text: "Données importées." });
    } catch {
      setMessage({ ok: false, text: "Impossible de lire ce fichier." });
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div className="profile-page">
      <ProfileForm
        // Se réinitialise quand le profil change (import d'une sauvegarde, par exemple).
        key={JSON.stringify(profile)}
        showTitle={false}
        initial={profile ?? undefined}
        onSubmit={(p) => {
          onSaveProfile(p);
          setSaved(true);
        }}
      />
      {saved && (
        <p className="notice" role="status">
          Profil enregistré.
        </p>
      )}

      <StravaCard strava={strava} />

      <section className="card" aria-labelledby="data-title">
        <h2 id="data-title" className="card__title">
          Mes données
        </h2>
        <p className="hint">
          {plan ? `Plan ${RACES[plan.input.race].label.toLowerCase()} du ${fmtDate(plan.input.raceDate, { day: "numeric", month: "long", year: "numeric" })}` : "Pas de plan"}
          {" · "}
          {activityCount} activité{activityCount > 1 ? "s" : ""} · {foodCount} aliment{foodCount > 1 ? "s" : ""} au journal
        </p>
        <p className="hint">
          Tout reste dans ce navigateur, sur cet appareil. Pour changer d'appareil ou de navigateur, ou te protéger d'un effacement, télécharge une sauvegarde puis importe-la ailleurs.
        </p>
        <div className="actions">
          <button type="button" className="btn btn--primary" onClick={download}>
            Télécharger une sauvegarde
          </button>
          <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
            Importer une sauvegarde
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            aria-label="Fichier de sauvegarde"
            onChange={(e) => void pickFile(e.target.files?.[0])}
          />
        </div>
        {message && (
          <p className={message.ok ? "notice" : "error"} role={message.ok ? "status" : "alert"}>
            {message.text}
          </p>
        )}
        <button
          type="button"
          className="link link--danger"
          onClick={() => {
            if (window.confirm("Effacer définitivement le profil, le plan, les activités, le journal et la connexion Strava de cet appareil ?")) {
              onReset();
            }
          }}
        >
          Tout effacer
        </button>
      </section>
    </div>
  );
}

import type { PostRun } from "../lib/hydration";
import { fmtKm, fmtVolume } from "../lib/format";
import { DropIcon } from "./icons";

interface Props {
  info: PostRun;
  today: string;
  onOpen: () => void;
  onDismiss: () => void;
}

/** Rappel affiché après une sortie récente : eau perdue estimée et quantité à boire. */
export default function LossBanner({ info, today, onOpen, onDismiss }: Props) {
  const { activity: a, loss, back, fromTemp } = info;
  const when = a.date === today ? "d'aujourd'hui" : "d'hier";
  return (
    <aside className="loss-banner" role="status" aria-label="Eau perdue à la dernière sortie">
      <span className="loss-banner__icon" aria-hidden="true">
        <DropIcon />
      </span>
      <div className="loss-banner__text">
        <p className="loss-banner__title">
          Sortie {when} : environ {fmtVolume(loss.ml)} d'eau perdue
        </p>
        <p className="loss-banner__detail">
          {fmtKm(a.km)} km, estimation entre {fmtVolume(loss.low)} et {fmtVolume(loss.high)}
          {fromTemp !== null ? `, avec les ${Math.round(fromTemp)} °C relevés par ta montre` : ", en conditions tempérées"}. Bois <strong>{fmtVolume(back.low)} à {fmtVolume(back.high)}</strong> dans les 2 à 4 heures.
        </p>
        <div className="loss-banner__actions">
          <button type="button" className="btn" onClick={onOpen}>
            Voir l'hydratation
          </button>
          <button type="button" className="link" onClick={onDismiss}>
            Fermer
          </button>
        </div>
      </div>
    </aside>
  );
}

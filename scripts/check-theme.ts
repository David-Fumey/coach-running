import { THEMES, validTheme, themeAttribute } from "../src/lib/theme.ts";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) {
    failures++;
    console.log("ECHEC", name, detail ?? "");
  } else console.log("ok   ", name);
}

check("les trois thèmes sont valides", THEMES.length === 3 && THEMES.every((t) => validTheme(t.id)));
check("valeurs inconnues refusées", [undefined, null, "dark", "", 1, {}].every((x) => !validTheme(x)));
check("automatique : pas d'attribut", themeAttribute("auto") === null);
check("clair et sombre : attribut correspondant", themeAttribute("clair") === "light" && themeAttribute("sombre") === "dark");

console.log(failures === 0 ? "\nTout est bon." : `\n${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);

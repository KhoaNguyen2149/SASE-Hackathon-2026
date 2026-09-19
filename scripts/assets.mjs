import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
await mkdir("public/illustrations", { recursive: true });
const palettes = {
  library: ["#eadac1", "#7e927b", "#b56d48", "#e4b976"],
  cafe: ["#e2c3aa", "#537164", "#a45e43", "#d99966"],
  study: ["#d6dfd3", "#63847c", "#ad745a", "#e7b87c"],
  outdoor: ["#dce6df", "#73967f", "#a37255", "#d6b58a"],
  bookshop: ["#e6cfbd", "#79866a", "#a3624c", "#d3a06b"],
  studio: ["#e3dccc", "#708b83", "#a67c5d", "#ddad6b"],
};
for (const [type, [wall, green, wood, gold]] of Object.entries(palettes)) {
  const books = Array.from(
    { length: 15 },
    (_, i) =>
      `<rect x="${42 + i * 18}" y="${130 - (i % 3) * 9}" width="${12 + (i % 3)}" height="${73 + (i % 3) * 9}" rx="2" fill="${[green, wood, gold, "#f5ead4"][i % 4]}"/><path d="M${45 + i * 18} 150v35" stroke="#fff" opacity=".3"/>`,
  ).join("");
  const window = `<rect x="345" y="55" width="310" height="217" rx="95" fill="#b9cfca"/><path d="M345 212l72-72 79 54 47-74 112 96v56H345" fill="${green}" opacity=".45"/><path d="M345 238l84-38 76 25 71-30 79 49v28H345" fill="${green}" opacity=".7"/><circle cx="563" cy="102" r="24" fill="#f1cf91"/><path d="M500 55v217M345 182h310" stroke="#f5f0e3" stroke-width="12"/>`;
  const plant = `<path d="M685 310v-143" stroke="${green}" stroke-width="5"/><path d="M685 263c-75-5-61-66-9-28M685 219c56-46 78 17 0 23M685 194c-51-55-18-84 2-25" fill="${green}"/><path d="M651 296h70l-11 72h-48z" fill="${wood}"/><path d="M650 296h73v14h-73z" fill="${gold}"/>`;
  const table = `<ellipse cx="437" cy="439" rx="215" ry="17" fill="#22382e" opacity=".09"/><path d="M260 324h340l-23 17H245z" fill="${wood}"/><path d="M271 341l-18 100M566 341l20 100" stroke="${wood}" stroke-width="11"/><path d="M335 270h115l20 54H350z" fill="#d8e3d9" stroke="${green}" stroke-width="4"/><path d="M350 324h142" stroke="${green}" stroke-width="6" stroke-linecap="round"/><circle cx="396" cy="294" r="6" fill="${green}" opacity=".5"/><path d="M510 297h28v26h-28zM538 302c22-5 22 19 0 15" fill="#f8eedc" stroke="${wood}" stroke-width="3"/><path d="M514 286c-10-10 9-12 0-22" fill="none" stroke="${wood}" stroke-width="2" opacity=".5"/>`;
  let interior = window + plant + table;
  if (type === "library" || type === "bookshop")
    interior += `<path d="M30 89h294v218H30z" fill="${wood}" opacity=".23"/><path d="M33 207h289M33 295h289" stroke="${wood}" stroke-width="9"/>${books}<g transform="translate(0 90)">${books}</g>`;
  if (type === "cafe")
    interior += `<path d="M0 220h270v150H0z" fill="${wood}"/><path d="M0 220h280" stroke="${gold}" stroke-width="12"/><path d="M34 247v102M71 247v102M108 247v102M145 247v102M182 247v102M219 247v102" stroke="${gold}" stroke-width="4" opacity=".6"/><rect x="75" y="138" width="135" height="77" rx="9" fill="${green}"/><path d="M103 167h77M107 190h65" stroke="#e9dcc5" stroke-width="9"/><path d="M88 0v70M225 0v70" stroke="${wood}" stroke-width="3"/><path d="M51 83q37-66 74 0M188 83q37-66 74 0" fill="${gold}"/>`;
  if (type === "study" || type === "studio")
    interior += `<rect x="33" y="79" width="246" height="175" rx="8" fill="#f5f1e5" stroke="${wood}" stroke-width="7"/><path d="M57 125h76m-76 23h139m-139 22h109" stroke="${green}" stroke-width="4" opacity=".5"/><rect x="186" y="108" width="34" height="32" fill="${gold}"/><rect x="226" y="145" width="27" height="30" fill="${wood}" opacity=".7"/><path d="M67 263v127M248 263v127" stroke="${wood}" stroke-width="8"/>`;
  if (type === "outdoor")
    interior = `<path d="M0 187l130-79 110 86 115-92 143 130 97-78 205 130v166H0" fill="${green}" opacity=".4"/><path d="M0 292q150-95 330 0t470-36v194H0" fill="${green}" opacity=".65"/><path d="M350 290q-90 100 70 160h205q-270-125-183-176" fill="#a8c9c6"/><circle cx="574" cy="85" r="36" fill="#f2d99e"/><path d="M93 310V107M701 325V109" stroke="${wood}" stroke-width="15"/><path d="M8 209q-20-81 59-91-20-100 70-98 94 17 55 107 78 59-2 109zM623 214q-40-94 38-113-5-69 59-60 95 10 45 108 83 87-16 92z" fill="${green}"/>${table}<path d="M157 363h195M173 367l-10 60M328 367l8 60" stroke="${wood}" stroke-width="12"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480"><defs><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".045"/></feComponentTransfer><feBlend in="SourceGraphic" mode="multiply"/></filter></defs><g filter="url(#grain)"><path fill="${wall}" d="M0 0h800v480H0z"/><path d="M0 370h800v110H0z" fill="#f0e6d4"/>${interior}<path d="M0 453h800" stroke="${wood}" opacity=".1"/></g></svg>`;
  await writeFile(`public/illustrations/${type}.svg`, svg);
}
const icon = await readFile("public/brand/deskhop-app-icon.svg");
for (const size of [192, 512])
  await sharp(icon).resize(size, size).png().toFile(`public/icon-${size}.png`);

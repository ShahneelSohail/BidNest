import fs from 'node:fs';
import path from 'node:path';

export const SEED_IMAGE_DIR = path.resolve(__dirname, '..', 'uploads', 'seed');

const GLYPHS: Record<string, string> = {
  watch:
    '<circle cx="400" cy="270" r="95" fill="none" stroke="#d8b25c" stroke-width="10"/><circle cx="400" cy="270" r="72" fill="none" stroke="#7a5f2b" stroke-width="3"/><path d="M400 270V210M400 270l42 22" stroke="#f1e2b6" stroke-width="9" stroke-linecap="round"/><rect x="370" y="140" width="60" height="30" rx="8" fill="#7a5f2b"/><rect x="370" y="370" width="60" height="30" rx="8" fill="#7a5f2b"/>',
  laptop:
    '<rect x="270" y="190" width="260" height="160" rx="14" fill="none" stroke="#d8b25c" stroke-width="10"/><path d="M230 372h340l-24 28H254z" fill="#7a5f2b"/><rect x="292" y="212" width="216" height="116" rx="6" fill="#d8b25c" opacity=".16"/>',
  audio:
    '<path d="M300 300v-30a100 100 0 0 1 200 0v30" fill="none" stroke="#d8b25c" stroke-width="12" stroke-linecap="round"/><rect x="278" y="290" width="46" height="96" rx="20" fill="#7a5f2b" stroke="#d8b25c" stroke-width="6"/><rect x="476" y="290" width="46" height="96" rx="20" fill="#7a5f2b" stroke="#d8b25c" stroke-width="6"/>',
  camera:
    '<rect x="270" y="200" width="260" height="170" rx="18" fill="none" stroke="#d8b25c" stroke-width="10"/><circle cx="400" cy="285" r="58" fill="none" stroke="#d8b25c" stroke-width="10"/><circle cx="400" cy="285" r="30" fill="#7a5f2b"/><rect x="340" y="170" width="70" height="30" rx="6" fill="#7a5f2b"/><circle cx="496" cy="230" r="9" fill="#f1e2b6"/>',
  lamp:
    '<path d="M330 200h140l36 120H294z" fill="none" stroke="#d8b25c" stroke-width="10" stroke-linejoin="round"/><path d="M400 320v70" stroke="#d8b25c" stroke-width="10"/><ellipse cx="400" cy="398" rx="62" ry="12" fill="#7a5f2b"/><path d="M356 240h88" stroke="#7a5f2b" stroke-width="5"/>',
  book:
    '<path d="M300 190h130a40 40 0 0 1 40 40v160a40 40 0 0 0-40-40H300z" fill="none" stroke="#d8b25c" stroke-width="10" stroke-linejoin="round"/><path d="M500 190H430a40 40 0 0 0-40 40v160a40 40 0 0 1 40-40h70z" fill="#7a5f2b" opacity=".5" stroke="#d8b25c" stroke-width="8" stroke-linejoin="round" transform="translate(10 0)"/>',
  ring:
    '<circle cx="400" cy="310" r="78" fill="none" stroke="#d8b25c" stroke-width="16"/><path d="M400 232l-34-44 34-32 34 32z" fill="#f1e2b6" stroke="#d8b25c" stroke-width="6" stroke-linejoin="round"/>',
  coin:
    '<circle cx="400" cy="285" r="100" fill="none" stroke="#d8b25c" stroke-width="12"/><circle cx="400" cy="285" r="78" fill="none" stroke="#7a5f2b" stroke-width="4"/><path d="M400 235v100M365 262h56a22 22 0 0 1 0 44h-56" stroke="#f1e2b6" stroke-width="10" fill="none" stroke-linecap="round"/>',
  art:
    '<rect x="270" y="190" width="260" height="190" rx="6" fill="none" stroke="#d8b25c" stroke-width="12"/><path d="M290 360l70-80 50 56 36-34 54 58z" fill="#7a5f2b" opacity=".7"/><circle cx="470" cy="244" r="20" fill="#f1e2b6"/>',
  chair:
    '<path d="M330 200h140v90H330z" fill="none" stroke="#d8b25c" stroke-width="10" stroke-linejoin="round"/><path d="M310 290h180v40H310zM330 330v70M470 330v70" fill="none" stroke="#d8b25c" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>',
  guitar:
    '<path d="M300 330c-40-20-30-70 10-76 30-4 30-34 58-40l80-70 18 18-70 82c-6 28-36 28-40 58-6 40-56 50-56 28z" fill="none" stroke="#d8b25c" stroke-width="10" stroke-linejoin="round"/><circle cx="352" cy="288" r="14" fill="#7a5f2b"/>',
  compass:
    '<circle cx="400" cy="285" r="100" fill="none" stroke="#d8b25c" stroke-width="12"/><path d="M400 205l22 70-22 70-22-70z" fill="#7a5f2b" stroke="#d8b25c" stroke-width="5" stroke-linejoin="round"/><circle cx="400" cy="275" r="9" fill="#f1e2b6"/>',
  record:
    '<circle cx="400" cy="285" r="110" fill="#0d0b09" stroke="#d8b25c" stroke-width="10"/><circle cx="400" cy="285" r="78" fill="none" stroke="#7a5f2b" stroke-width="3"/><circle cx="400" cy="285" r="48" fill="none" stroke="#7a5f2b" stroke-width="3"/><circle cx="400" cy="285" r="26" fill="#d8b25c"/>',
  rug:
    '<rect x="260" y="220" width="280" height="150" rx="6" fill="none" stroke="#d8b25c" stroke-width="10"/><rect x="290" y="244" width="220" height="102" fill="none" stroke="#7a5f2b" stroke-width="5"/><path d="M400 252l54 43-54 43-54-43z" fill="#7a5f2b" opacity=".6" stroke="#d8b25c" stroke-width="4"/>',
  box:
    '<path d="M280 250l120-56 120 56v120l-120 56-120-56z" fill="none" stroke="#d8b25c" stroke-width="10" stroke-linejoin="round"/><path d="M280 250l120 56 120-56M400 306v120" fill="none" stroke="#7a5f2b" stroke-width="6"/>',
};

export type Glyph = keyof typeof GLYPHS;

const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const svgFor = (glyph: Glyph, title: string, accent: string): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b1814"/><stop offset="1" stop-color="#050505"/></linearGradient>
    <radialGradient id="glow" cx=".5" cy=".42" r=".5"><stop offset="0" stop-color="${accent}" stop-opacity=".34"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
    <linearGradient id="silver" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#9a9a9a"/></linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg)"/>
  <rect width="800" height="600" fill="url(#glow)"/>
  <rect x="24" y="24" width="752" height="552" rx="6" fill="none" stroke="#d8b25c" stroke-opacity=".35" stroke-width="2"/>
  <g>${GLYPHS[glyph]}</g>
  <text x="400" y="505" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${Math.min(38, Math.floor(680 / (title.length * 0.58)))}" font-weight="700" fill="url(#silver)">${escapeXml(title)}</text>
  <text x="400" y="545" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" letter-spacing="6" fill="#d8b25c">BIDNEST</text>
</svg>
`;

export const writeSeedImage = (slug: string, glyph: Glyph, title: string, accent = '#d8b25c'): string => {
  fs.mkdirSync(SEED_IMAGE_DIR, { recursive: true });
  fs.writeFileSync(path.join(SEED_IMAGE_DIR, `${slug}.svg`), svgFor(glyph, title, accent));
  return `/uploads/seed/${slug}.svg`;
};

export const clearSeedImages = (): void => {
  fs.rmSync(SEED_IMAGE_DIR, { recursive: true, force: true });
};

import fs from "node:fs";
import path from "node:path";
import sharp from "file:///C:/Users/Jhayzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.mjs";

const root = "C:/Mabansag/OJT/InventorySystem";
const outDir = path.join(root, "deliverables");
const svgPath = path.join(outDir, "LiveInv_Concept_Paper_Infographic.svg");
const pngPath = path.join(outDir, "LiveInv_Concept_Paper_Infographic.png");
const logoPath = "C:/Users/Jhayzo/Downloads/Logo.png";

fs.mkdirSync(outDir, { recursive: true });
const logoData = fs.readFileSync(logoPath).toString("base64");

const W = 1600;
const H = 2200;
const colors = {
  bg: "#FCF9F3",
  ink: "#202A35",
  muted: "#667180",
  burgundy: "#8B1D24",
  green: "#1B6C24",
  navy: "#14233D",
  yellow: "#F4BE3B",
  coral: "#E8684A",
  line: "#D9DDD9",
  card: "#FFFFFF",
  paleGreen: "#EDF5EE",
  paleRed: "#F8ECEC",
  paleYellow: "#FFF3CF",
  paleBlue: "#ECF1F6",
};

const esc = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function wrappedText(text, x, y, maxChars, lineHeight, options = {}) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  const attrs = [
    `x="${x}"`,
    `y="${y}"`,
    `font-family="Inter, Arial, sans-serif"`,
    `font-size="${options.size ?? 28}"`,
    `font-weight="${options.weight ?? 400}"`,
    `fill="${options.fill ?? colors.ink}"`,
  ].join(" ");
  return `<text ${attrs}>${lines.map((l, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}">${esc(l)}</tspan>`).join("")}</text>`;
}

function sectionTag(x, y, text, fill, width) {
  return `<g>
    <path d="M${x + 22} ${y} H${x + width} V${y + 58} H${x + 22} L${x} ${y + 29} Z" fill="${fill}"/>
    <circle cx="${x + 22}" cy="${y + 29}" r="5" fill="#fff" opacity=".9"/>
    <text x="${x + 43}" y="${y + 38}" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="800" fill="#fff" letter-spacing="1.1">${esc(text.toUpperCase())}</text>
  </g>`;
}

function miniIcon(x, y, label, bg, fg) {
  return `<g>
    <rect x="${x}" y="${y}" width="58" height="58" rx="15" fill="${bg}"/>
    <text x="${x + 29}" y="${y + 37}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="800" fill="${fg}">${esc(label)}</text>
  </g>`;
}

function featureCard(x, y, w, title, body, icon, tint) {
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="300" rx="22" fill="${colors.card}" stroke="${colors.line}" stroke-width="2"/>
    <rect x="${x + 24}" y="${y + 24}" width="62" height="62" rx="16" fill="${tint}"/>
    <text x="${x + 55}" y="${y + 63}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="19" font-weight="800" fill="${colors.navy}">${icon}</text>
    ${wrappedText(title, x + 24, y + 122, 18, 30, { size: 24, weight: 800, fill: colors.navy })}
    ${wrappedText(body, x + 24, y + 198, 24, 27, { size: 20, fill: colors.muted })}
  </g>`;
}

function benefitRow(x, y, icon, title, body, tint, fg) {
  return `<g>
    ${miniIcon(x, y - 37, icon, tint, fg)}
    <text x="${x + 78}" y="${y}" font-family="Inter, Arial, sans-serif" font-size="23" font-weight="800" fill="${colors.navy}">${esc(title)}</text>
    ${wrappedText(body, x + 78, y + 34, 52, 27, { size: 20, fill: colors.muted })}
  </g>`;
}

const chips = [
  "React Native", "TypeScript", "Expo", "Expo Router", "expo-camera",
  "react-native-svg", "TanStack Query", "Zustand", "Expo SQLite",
  "SecureStore", "Node.js", "NestJS / Express", "PostgreSQL + Prisma", "JWT / RBAC",
];

let chipX = 875;
let chipY = 1682;
const chipSvg = [];
for (const chip of chips) {
  const width = Math.max(118, 30 + chip.length * 13.2);
  if (chipX + width > 1510) {
    chipX = 875;
    chipY += 58;
  }
  chipSvg.push(`<rect x="${chipX}" y="${chipY}" width="${width}" height="43" rx="21.5" fill="${colors.navy}"/>`);
  chipSvg.push(`<text x="${chipX + width / 2}" y="${chipY + 28}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="700" fill="#fff">${esc(chip)}</text>`);
  chipX += width + 14;
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${colors.bg}"/>

  <g>
    <rect x="0" y="0" width="${W}" height="12" fill="${colors.navy}"/>
    <rect x="62" y="0" width="66" height="12" fill="${colors.burgundy}"/>
    <rect x="195" y="0" width="66" height="12" fill="${colors.green}"/>
    <rect x="328" y="0" width="66" height="12" fill="${colors.burgundy}"/>
    <rect x="461" y="0" width="66" height="12" fill="${colors.green}"/>
    <rect x="594" y="0" width="66" height="12" fill="${colors.burgundy}"/>
    <rect x="727" y="0" width="66" height="12" fill="${colors.green}"/>
    <rect x="860" y="0" width="66" height="12" fill="${colors.burgundy}"/>
  </g>

  <!-- Header -->
  <g>
    <rect x="72" y="82" width="124" height="124" rx="62" fill="${colors.navy}"/>
    <rect x="108" y="119" width="52" height="52" rx="8" fill="none" stroke="#fff" stroke-width="7"/>
    <path d="M134 126v38M115 145h38" stroke="${colors.green}" stroke-width="8" stroke-linecap="round"/>
    <circle cx="166" cy="114" r="8" fill="${colors.burgundy}" stroke="#fff" stroke-width="4"/>
    <path d="M160 120l-16 15" stroke="#fff" stroke-width="4"/>

    <text x="230" y="132" font-family="Inter, Arial, sans-serif" font-size="67" font-weight="850" fill="${colors.navy}">LiveInv</text>
    <rect x="232" y="154" width="222" height="49" rx="8" fill="${colors.paleRed}" stroke="${colors.burgundy}" stroke-width="2"/>
    <text x="343" y="187" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="21" font-weight="800" fill="${colors.burgundy}" letter-spacing="2">CONCEPT PAPER</text>
    <text x="230" y="247" font-family="Inter, Arial, sans-serif" font-size="25" fill="${colors.muted}">A mobile visual inventory system for room-level hospital asset tracking.</text>

    <image x="1120" y="67" width="400" height="150" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${logoData}"/>
    <text x="1515" y="250" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="800" fill="${colors.green}" letter-spacing="1">IT DEPARTMENT PROJECT</text>
  </g>

  <path d="M72 292H1528" stroke="${colors.line}" stroke-width="3" stroke-dasharray="12 10"/>

  <!-- Problem / Solution -->
  ${sectionTag(72, 334, "The Problem", colors.burgundy, 300)}
  ${sectionTag(832, 334, "The Solution", colors.green, 310)}
  ${miniIcon(72, 430, "!", colors.paleRed, colors.burgundy)}
  ${wrappedText("Hospital assets are often tracked through spreadsheets, paper forms, and separate files. Staff can struggle to verify an item's exact floor, room, department, condition, maintenance history, QR identity, or assigned IP address while conducting physical rounds.", 152, 454, 55, 37, { size: 24, fill: colors.ink })}
  ${miniIcon(832, 430, "✓", colors.paleGreen, colors.green)}
  ${wrappedText("LiveInv is an Android-first React Native companion to the web system. Authorized staff can open a visual floor map, choose a room, scan or generate an item QR code, verify its assignment and network data, and save updates where the asset is located.", 912, 454, 54, 37, { size: 24, fill: colors.ink })}

  <path d="M72 704H1528" stroke="${colors.line}" stroke-width="3" stroke-dasharray="12 10"/>

  <!-- Features -->
  ${sectionTag(72, 746, "Key Features", colors.yellow, 288)}
  ${featureCard(72, 838, 274, "Visual Floor Maps", "Navigate floors, rooms, and their assigned assets.", "MAP", colors.paleGreen)}
  ${featureCard(366, 838, 274, "QR Scan & Labels", "Scan an item or generate its unique QR identity.", "QR", colors.paleRed)}
  ${featureCard(660, 838, 274, "Room Assignment", "Transfer items by floor, room, department, or custodian.", "RM", colors.paleYellow)}
  ${featureCard(954, 838, 274, "Asset & IP Details", "Track category, condition, hostname, IPv4, and MAC.", "IP", colors.paleBlue)}
  ${featureCard(1248, 838, 280, "Offline Sync", "Queue approved updates and sync when connected again.", "OFF", colors.paleGreen)}

  <path d="M72 1180H1528" stroke="${colors.line}" stroke-width="3" stroke-dasharray="12 10"/>

  <!-- Goal strip -->
  <rect x="72" y="1222" width="1456" height="174" rx="22" fill="${colors.navy}"/>
  <rect x="95" y="1245" width="76" height="76" rx="20" fill="${colors.green}"/>
  <path d="M119 1283h28M133 1269v28" stroke="#fff" stroke-width="7" stroke-linecap="round"/>
  <text x="198" y="1273" font-family="Inter, Arial, sans-serif" font-size="21" font-weight="800" fill="#A7D9AD" letter-spacing="2">PROJECT OBJECTIVE</text>
  ${wrappedText("Give authorized hospital staff real-time, room-level visibility of every asset's location, assignment, condition, QR identity, maintenance, and network information.", 198, 1320, 93, 34, { size: 25, weight: 600, fill: "#FFFFFF" })}

  <!-- Beneficiaries / Tech -->
  ${sectionTag(72, 1450, "Beneficiaries", colors.burgundy, 330)}
  ${sectionTag(832, 1450, "Tech Stack", colors.green, 300)}
  ${benefitRow(72, 1554, "IT", "IT inventory personnel", "Faster rounds, QR verification, room lookup, and IP registry checks.", colors.paleRed, colors.burgundy)}
  ${benefitRow(72, 1684, "MG", "Hospital management", "Reliable totals, accountability, audit trails, and condition summaries.", colors.paleGreen, colors.green)}
  ${benefitRow(72, 1814, "MT", "Departments & maintenance", "Clear assignments, faster transfers, and accessible service history.", colors.paleBlue, colors.navy)}
  ${benefitRow(72, 1944, "ST", "Student developers", "A practical mobile, mapping, QR, security, and synchronization project.", colors.paleYellow, colors.burgundy)}

  ${chipSvg.join("\n")}
  ${wrappedText("Architecture: Clean Architecture / layered modules with SOLID interfaces. Security: TLS, least privilege, secure storage, server validation, audit logs, and OWASP MASVS.", 875, 2042, 64, 27, { size: 19, fill: colors.muted })}

  <path d="M72 2132H1528" stroke="${colors.navy}" stroke-width="3"/>
  <text x="72" y="2170" font-family="Inter, Arial, sans-serif" font-size="16" fill="${colors.muted}">References: reactnative.dev · docs.expo.dev · reactnavigation.org · mas.owasp.org · privacy.gov.ph</text>
  <circle cx="1468" cy="2164" r="6" fill="${colors.burgundy}"/>
  <circle cx="1490" cy="2164" r="6" fill="${colors.yellow}"/>
  <circle cx="1512" cy="2164" r="6" fill="${colors.green}"/>
</svg>`;

fs.writeFileSync(svgPath, svg, "utf8");
await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(pngPath);
console.log(JSON.stringify({ svgPath, pngPath }));

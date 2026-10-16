/* Fiches de lecture (niveau CP) : phrases courtes + petit schéma SVG par étage. */
(function (root) {
  'use strict';
  const R = '#e0453a', B = '#2f6fd6', G = '#8a8f98', K = '#2b2b2b';
  const magnet = (x, y, w, h, flip) => `<g transform="translate(${x},${y})">
    <rect x="0" y="0" width="${w / 2}" height="${h}" rx="6" fill="${flip ? R : B}"/><rect x="${w / 2}" y="0" width="${w / 2}" height="${h}" rx="6" fill="${flip ? B : R}"/>
    <text x="${w / 4}" y="${h / 2 + 8}" text-anchor="middle" font-size="22" font-weight="700" fill="#fff">${flip ? 'N' : 'S'}</text>
    <text x="${3 * w / 4}" y="${h / 2 + 8}" text-anchor="middle" font-size="22" font-weight="700" fill="#fff">${flip ? 'S' : 'N'}</text></g>`;
  const knight = (x, y) => `<g transform="translate(${x},${y})"><rect x="0" y="0" width="40" height="64" rx="8" fill="${G}"/><rect x="6" y="8" width="28" height="18" rx="6" fill="#cfd3d9"/><rect x="10" y="30" width="20" height="26" fill="#b4b9c1"/></g>`;
  const arrow = (x1, y1, x2, y2, c = K) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="5" stroke-linecap="round"/><polygon points="${x2},${y2} ${x2 - 14 * Math.sign(x2 - x1 || 1)},${y2 - 9} ${x2 - 14 * Math.sign(x2 - x1 || 1)},${y2 + 9}" fill="${c}" transform="${x1 === x2 ? `rotate(${y2 > y1 ? 90 : -90} ${x2} ${y2})` : ''}"/>`;
  const nail = (x, y, c = G) => `<g transform="translate(${x},${y})"><rect x="0" y="0" width="8" height="40" fill="${c}"/><rect x="-5" y="-6" width="18" height="8" rx="3" fill="${c}"/></g>`;
  const svg = (inner) => `<svg viewBox="0 0 420 200" xmlns="http://www.w3.org/2000/svg" role="img">${inner}</svg>`;

  const CARDS = [
    { title: "L'aimant", lines: ["L'aimant attire le fer.", 'Le chevalier est en fer.', "Il glisse vers l'aimant."],
      svg: svg(`${knight(60, 90)}${arrow(130, 122, 250, 122)}${magnet(270, 102, 110, 40)}`) },
    { title: 'Attire ou pas', lines: ["L'aimant attire le fer.", 'Il n’attire pas la paille,', 'ni le bois, ni le chat.'],
      svg: svg(`${magnet(150, 20, 120, 40)}${nail(120, 100)}<text x="124" y="170" font-size="34" fill="#2a9d4a">✓</text>
        <rect x="200" y="100" width="30" height="44" fill="#d8b24a"/><text x="200" y="175" font-size="34" fill="${R}">✗</text>
        <rect x="280" y="100" width="34" height="44" fill="#a0632a"/><text x="282" y="175" font-size="34" fill="${R}">✗</text>`) },
    { title: 'La serrure', lines: ["L'aimant agit à travers le bois,", 'le verre et le carton.', "Il n'a pas besoin de toucher."],
      svg: svg(`<rect x="200" y="30" width="22" height="140" fill="#a0632a"/><line x1="211" y1="40" x2="211" y2="160" stroke="#7a4a1e" stroke-width="3" stroke-dasharray="8 6"/>
        ${magnet(60, 80, 110, 40)}${nail(290, 80)}<path d="M170 100 Q200 80 290 100" stroke="${B}" stroke-width="3" fill="none" stroke-dasharray="6 6"/>`) },
    { title: "L'épée", lines: ["L'aimant soulève l'épée.", "Si on enlève l'aimant,", "l'épée tombe !"],
      svg: svg(`${magnet(40, 20, 100, 36)}<rect x="84" y="56" width="12" height="90" fill="#cfd3d9"/><rect x="72" y="56" width="36" height="8" fill="#c9a227"/>
        <text x="190" y="110" font-size="40">→</text>
        <rect x="300" y="60" width="12" height="90" fill="#cfd3d9"/><rect x="288" y="60" width="36" height="8" fill="#c9a227"/>${arrow(350, 60, 350, 150)}`) },
    { title: 'Les pôles', lines: ['Un aimant a deux bouts :', 'le pôle Nord (N) et le pôle Sud (S).', 'Nord et Sud se collent.', 'Nord et Nord se repoussent.'],
      svg: svg(`${magnet(30, 30, 110, 40)}${magnet(200, 30, 110, 40)}${arrow(145, 50, 165, 50)}${arrow(195, 50, 175, 50)}
        <text x="57" y="22" font-size="15" text-anchor="middle" fill="${B}" font-weight="700">Sud</text><text x="112" y="22" font-size="15" text-anchor="middle" fill="${R}" font-weight="700">Nord</text>
        ${magnet(30, 120, 110, 40)}${magnet(240, 120, 110, 40, true)}${arrow(170, 140, 150, 140)}${arrow(210, 140, 230, 140)}
        <text x="112" y="180" font-size="15" text-anchor="middle" fill="${R}" font-weight="700">Nord</text><text x="267" y="180" font-size="15" text-anchor="middle" fill="${R}" font-weight="700">Nord</text>`) },
    { title: 'La portée', lines: ["Près de l'aimant, ça tire fort.", "Loin de l'aimant, ça tire peu.", 'Très loin, ça ne tire plus.'],
      svg: svg(`<circle cx="80" cy="100" r="80" fill="none" stroke="${B}" stroke-dasharray="6 6"/><circle cx="80" cy="100" r="130" fill="none" stroke="${B}" stroke-dasharray="4 8" opacity=".5"/>
        ${magnet(30, 82, 100, 36)}${nail(180, 80)}${arrow(176, 100, 150, 100)}${nail(270, 80)}<line x1="266" y1="100" x2="250" y2="100" stroke="${K}" stroke-width="3"/>${nail(370, 80)}`) },
    { title: 'Le fer à cheval', lines: ['Un aimant tire surtout par ses bouts.', 'Le fer à cheval met ses deux bouts', 'au même endroit : il tire plus fort.'],
      svg: svg(`<path d="M150 30 a60 60 0 0 1 120 0 v50 h-30 v-50 a30 30 0 0 0 -60 0 v50 h-30 z" fill="${R}"/><rect x="150" y="80" width="30" height="30" fill="${B}"/><rect x="240" y="80" width="30" height="30" fill="${R}"/>
        <text x="165" y="102" text-anchor="middle" font-size="18" fill="#fff" font-weight="700">S</text><text x="255" y="102" text-anchor="middle" font-size="18" fill="#fff" font-weight="700">N</text>
        <rect x="140" y="125" width="140" height="50" rx="8" fill="${G}"/><text x="210" y="158" text-anchor="middle" font-size="20" fill="#fff">lourd</text>`) },
    { title: 'La chaîne', lines: ["Un anneau collé à l'aimant", 'devient un petit aimant.', "Il attire l'anneau suivant.", 'On fait une chaîne !'],
      svg: svg(`${magnet(160, 10, 100, 34)}<circle cx="210" cy="62" r="16" fill="none" stroke="${G}" stroke-width="8"/><circle cx="210" cy="96" r="16" fill="none" stroke="${G}" stroke-width="8"/><circle cx="210" cy="130" r="16" fill="none" stroke="${G}" stroke-width="8"/>
        <rect x="196" y="150" width="28" height="36" rx="6" fill="#c9a227"/>`) },
    { title: 'Le bouclier', lines: ["L'aimant passe à travers le bois.", 'Mais pas à travers le fer.', 'Une plaque de fer fait un bouclier.'],
      svg: svg(`${magnet(20, 80, 100, 36)}<rect x="180" y="20" width="18" height="70" fill="#a0632a"/><rect x="180" y="110" width="18" height="70" fill="#555b66"/>
        <path d="M120 60 Q180 50 260 55" stroke="${B}" stroke-width="3" fill="none" stroke-dasharray="6 6"/>${nail(270, 35)}
        <path d="M120 140 L178 145" stroke="${B}" stroke-width="3" fill="none" stroke-dasharray="6 6"/><text x="200" y="160" font-size="34" fill="${R}">✗</text>${nail(270, 125)}`) },
    { title: 'Le clou aimanté', lines: ['Frotte un clou sur un aimant.', 'Le clou devient un aimant !', 'Mais pas pour longtemps.'],
      svg: svg(`<ellipse cx="90" cy="120" rx="70" ry="45" fill="#3a3a3a"/>${nail(70, 50, '#999')}${arrow(120, 60, 160, 60)}${arrow(60, 60, 20, 60)}
        ${nail(290, 70, '#999')}<circle cx="294" cy="138" r="12" fill="none" stroke="${G}" stroke-width="6"/>${arrow(320, 160, 300, 140)}
        <circle cx="380" cy="60" r="24" fill="none" stroke="${K}" stroke-width="4"/><line x1="380" y1="60" x2="380" y2="42" stroke="${K}" stroke-width="4"/><line x1="380" y1="60" x2="394" y2="60" stroke="${K}" stroke-width="4"/>`) },
    { title: "L'électroaimant", lines: ['Du courant dans un fil enroulé', 'fait un aimant.', "On l'allume. On l'éteint.", "C'est un électroaimant."],
      svg: svg(`<rect x="30" y="70" width="60" height="30" rx="4" fill="#333"/><rect x="90" y="78" width="8" height="14" fill="#333"/><text x="60" y="92" text-anchor="middle" font-size="16" fill="#fff">pile</text>
        <path d="M60 70 V30 H160 M60 100 V140 H160" stroke="${K}" stroke-width="4" fill="none"/>
        <rect x="160" y="70" width="140" height="30" rx="4" fill="${G}"/>
        <path d="M160 30 c10 0 10 10 0 10 c-10 0 -10 -10 0 -10 m22 0 c10 0 10 10 0 10 c-10 0 -10 -10 0 -10 m22 0 c10 0 10 10 0 10 c-10 0 -10 -10 0 -10 m22 0 c10 0 10 10 0 10 c-10 0 -10 -10 0 -10 m22 0 c10 0 10 10 0 10 c-10 0 -10 -10 0 -10 m22 0 c10 0 10 10 0 10 c-10 0 -10 -10 0 -10" stroke="#d96b2b" stroke-width="4" fill="none" transform="translate(0,40)"/>
        <path d="M160 140 H300 M300 140 V100 M300 60 V30 H160" stroke="#d96b2b" stroke-width="4" fill="none"/>
        <line x1="300" y1="140" x2="330" y2="115" stroke="${K}" stroke-width="5"/><circle cx="300" cy="140" r="6" fill="${K}"/><circle cx="340" cy="140" r="6" fill="${K}"/><text x="320" y="175" text-anchor="middle" font-size="16">ON / OFF</text>
        ${nail(230, 110, '#777')}`) },
    { title: 'La bobine', lines: ['Plus il y a de tours de fil,', "plus l'électroaimant est fort."],
      svg: svg(`<rect x="40" y="60" width="120" height="26" rx="4" fill="${G}"/><path d="M60 55 c8 0 8 36 0 36 m20 -36 c8 0 8 36 0 36" stroke="#d96b2b" stroke-width="4" fill="none"/>${nail(90, 100, '#aaa')}<text x="100" y="170" text-anchor="middle" font-size="18">2 tours</text>
        <rect x="240" y="60" width="140" height="26" rx="4" fill="${G}"/><path d="M250 55 c8 0 8 36 0 36 m18 -36 c8 0 8 36 0 36 m18 -36 c8 0 8 36 0 36 m18 -36 c8 0 8 36 0 36 m18 -36 c8 0 8 36 0 36 m18 -36 c8 0 8 36 0 36 m18 -36 c8 0 8 36 0 36" stroke="#d96b2b" stroke-width="4" fill="none"/>${nail(280, 100, '#777')}${nail(305, 100, '#777')}${nail(330, 100, '#777')}<text x="310" y="170" text-anchor="middle" font-size="18">7 tours</text>`) },
    { title: 'La boussole', lines: ['La Terre est un gros aimant.', "L'aiguille de la boussole", 'est un petit aimant.', 'Elle montre le Nord.'],
      svg: svg(`<circle cx="110" cy="100" r="80" fill="#5aa0e0"/><ellipse cx="90" cy="90" rx="30" ry="22" fill="#5ab35a"/><ellipse cx="135" cy="130" rx="22" ry="16" fill="#5ab35a"/>
        <text x="110" y="35" text-anchor="middle" font-size="18" font-weight="700" fill="${R}">N</text><text x="110" y="190" text-anchor="middle" font-size="18" font-weight="700" fill="${B}">S</text>
        <circle cx="300" cy="100" r="60" fill="#fff" stroke="${K}" stroke-width="4"/><polygon points="300,50 290,100 310,100" fill="${R}"/><polygon points="300,150 290,100 310,100" fill="${B}"/><circle cx="300" cy="100" r="6" fill="${K}"/>
        <text x="300" y="38" text-anchor="middle" font-size="16" font-weight="700">N</text>`) },
    { title: 'Le pôle caché', lines: ["On ne voit pas la force de l'aimant.", 'La limaille de fer la dessine.', 'On voit des lignes entre les pôles.'],
      svg: svg(`${magnet(155, 85, 110, 30)}<g fill="none" stroke="#555" stroke-width="2">
        <path d="M265 100 C330 60 330 140 265 100"/><path d="M155 100 C90 60 90 140 155 100"/><path d="M265 90 C360 20 60 20 155 90"/><path d="M265 110 C360 180 60 180 155 110"/><path d="M265 85 C400 -10 20 -10 155 85"/><path d="M265 115 C400 210 20 210 155 115"/></g>`) },
    { title: 'Tout ensemble', lines: ['Tu sais tout !', 'Le fer, les pôles, la chaîne,', 'la plaque, le bouton.', 'À toi de jouer.'],
      svg: svg(`${magnet(20, 80, 90, 34)}${knight(140, 70)}<circle cx="230" cy="100" r="16" fill="none" stroke="${G}" stroke-width="8"/><circle cx="230" cy="134" r="16" fill="none" stroke="${G}" stroke-width="8"/>
        <rect x="280" y="60" width="16" height="90" fill="#555b66"/><rect x="330" y="120" width="60" height="20" rx="4" fill="#444"/><ellipse cx="360" cy="120" rx="22" ry="10" fill="${R}"/>`) },
    { title: 'Le sommet', lines: ['Les mêmes pôles se repoussent.', 'Même un aimant géant !', 'Retourne ton aimant, et pousse.'],
      svg: svg(`${magnet(20, 90, 80, 30, true)}${magnet(180, 70, 200, 70)}${arrow(100, 105, 125, 105)}${arrow(175, 105, 160, 105)}`) },
  ];

  const INTRO = {
    lines: ['Une sorcière maligne a pris Mei Mei, notre chat.', 'Elle l’a caché tout en haut de sa tour.', 'Seize étages pleins de pièges !', 'Toi, tu as un aimant.'],
  };

  const out = { CARDS, INTRO };
  if (typeof module !== 'undefined' && module.exports) module.exports = out; else root.CARDS_DATA = out;
})(typeof window !== 'undefined' ? window : globalThis);

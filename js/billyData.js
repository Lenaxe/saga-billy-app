export const ITEMS = {
  epee: { label: 'Épée', category: 'armes', bonus: { habilite: 4 } },
  lance: { label: 'Lance', category: 'armes', bonus: { habilite: 3, adresse: 1 } },
  morgenstern: { label: 'Morgenstern', category: 'armes', bonus: { habilite: 1, endurance: 1, degats: 1 } },
  arc: { label: 'Arc', category: 'armes', bonus: { habilite: 3, adresse: 1, critique: 4 }, note: 'Deux mains : aucune autre arme équipée.' },

  cotte: { label: 'Cotte de maille', category: 'equipements', bonus: { habilite: -1, adresse: -1, endurance: 1, armure: 2 } },
  marmite: { label: 'Marmite', category: 'equipements', bonus: { endurance: 2, armure: 1 } },
  pamphlet: { label: 'Pamphlet touristique', category: 'equipements', bonus: { chance: 4 } },
  kitsoin: { label: 'Kit de soin', category: 'equipements', bonus: { chance: 1 }, note: 'Double les PV récupérés naturellement pendant l\'aventure.' },

  fourche: { label: 'Fourche', category: 'outils', bonus: { habilite: 1, endurance: 3 }, note: 'Compte comme une arme tenue en main.' },
  dague: { label: 'Dague', category: 'outils', bonus: { habilite: 1, critique: 6 }, note: 'Si Arc ou 2 armes équipées : le bonus CRIT reste, pas le bonus HAB.' },
  kitescalade: { label: 'Kit d\'escalade', category: 'outils', bonus: { adresse: 1 } },
  sacgrains: { label: 'Sac de grains', category: 'outils', bonus: { endurance: 2, chance: 2 } }
};

export const CATEGORY_LABELS = {
  armes: 'Armes',
  equipements: 'Équipements',
  outils: 'Outils'
};

export const CLASSES = {
  guerrier: {
    label: 'Guerrier',
    bonus: { habilite: 2, chance: -1 },
    power: '+1 DÉGÂTS à toutes tes attaques.'
  },
  prudent: {
    label: 'Prudent',
    bonus: { chance: 2, habilite: -1 },
    power: 'Avant un combat, tu peux faire un JET DE CHANCE pour l\'éviter entièrement (coût = ligne esquive de la Table des situations ; coûte 1 Chance si le jet échoue).'
  },
  paysan: {
    label: 'Paysan',
    bonus: { endurance: 2, adresse: -1 },
    power: 'Tu ne subis jamais plus de 3 PV de dégâts par phase d\'attaque (après bonus adverses et armure).'
  },
  debrouillard: {
    label: 'Débrouillard',
    bonus: { adresse: 2, endurance: -1 },
    power: 'Tu peux relancer ton dé de phase d\'attaque une fois par tour (le second résultat est définitif ; ne s\'applique pas aux esquives).'
  }
};

export function detectClasse(itemKeys) {
  const counts = { armes: 0, equipements: 0, outils: 0 };
  itemKeys.forEach(key => {
    const item = ITEMS[key];
    if (item) counts[item.category]++;
  });
  if (counts.armes >= 2) return 'guerrier';
  if (counts.equipements >= 2) return 'prudent';
  if (counts.outils >= 2) return 'paysan';
  if (itemKeys.length === 3 && counts.armes === 1 && counts.equipements === 1 && counts.outils === 1) return 'debrouillard';
  return null;
}

export function classeBonusFor(itemKeys, statKey) {
  const classe = detectClasse(itemKeys);
  if (!classe) return 0;
  return CLASSES[classe].bonus[statKey] || 0;
}

export function materielBonusFor(itemKeys, statKey) {
  const armesCount = itemKeys.filter(k => ITEMS[k] && ITEMS[k].category === 'armes').length;
  const hasArc = itemKeys.includes('arc');
  return itemKeys.reduce((sum, key) => {
    const item = ITEMS[key];
    if (!item) return sum;
    let bonus = item.bonus[statKey] || 0;
    // Dague : si l'Arc ou 2 armes sont équipées, le bonus CRIT reste mais pas le bonus HABILITÉ.
    if (key === 'dague' && statKey === 'habilite' && (hasArc || armesCount >= 2)) {
      bonus = 0;
    }
    return sum + bonus;
  }, 0);
}

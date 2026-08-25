/*
  Constats et recommandations du débriefing.

  Chaque entrée est une phrase entière et autonome : le moteur d'analyse
  (src/utils/analysis.js) ne produit que { key, values, context }, jamais du
  texte. La phrase peut donc être restructurée librement.

  Les variantes `_gap` sont retenues lorsque l'allure citée est ajustée à la
  pente. En français le qualificatif est placé après l'allure, comme il se doit.
*/
export default {
  pacing: {
    even: {
      title: "Allure tenue jusqu'à l'arrivée",
      body: "Votre dernier tiers a tourné à {{lastPace}} contre {{firstPace}} sur le premier tiers — soit {{fade, number(signDisplay: exceptZero)}} % d'écart — avec une variation d'un intervalle à l'autre de seulement {{cv, number(maximumFractionDigits: 1)}} %. Cette maîtrise est la signature d'un effort bien jugé.",
      body_gap: "Votre dernier tiers a tourné à {{lastPace}} en allure ajustée à la pente, contre {{firstPace}} sur le premier tiers — soit {{fade, number(signDisplay: exceptZero)}} % d'écart — avec une variation d'un intervalle à l'autre de seulement {{cv, number(maximumFractionDigits: 1)}} %. Cette maîtrise est la signature d'un effort bien jugé.",
    },
    faded: {
      title: "L'allure s'est délitée sur le dernier tiers",
      body: "Votre dernier tiers a tourné à {{lastPace}}, contre {{firstPace}} sur le premier tiers — un ralentissement de {{fade, number}} %. Il s'est installé progressivement plutôt que sur un seul mauvais intervalle, ce qui oriente vers une fatigue cumulée, la nutrition ou la chaleur, et non vers une portion isolée.",
      body_gap: "Votre dernier tiers a tourné à {{lastPace}} en allure ajustée à la pente, contre {{firstPace}} sur le premier tiers — un ralentissement de {{fade, number}} %. Il s'est installé progressivement plutôt que sur un seul mauvais intervalle, ce qui oriente vers une fatigue cumulée, la nutrition ou la chaleur, et non vers une portion isolée.",
    },
    drift: {
      title: "Une dérive tardive, mais pas d'effondrement",
      body: "Dernier tiers à {{lastPace}} contre {{firstPace}} sur le premier tiers — {{fade, number(signDisplay: exceptZero)}} % d'écart, variation de {{cv, number(maximumFractionDigits: 1)}} %. Du solide, avec encore un peu de temps à gagner sur une seconde moitié mieux tenue.",
      body_gap: "Dernier tiers à {{lastPace}} en allure ajustée à la pente, contre {{firstPace}} sur le premier tiers — {{fade, number(signDisplay: exceptZero)}} % d'écart, variation de {{cv, number(maximumFractionDigits: 1)}} %. Du solide, avec encore un peu de temps à gagner sur une seconde moitié mieux tenue.",
    },
    steady: {
      title: "Allure raisonnablement régulière",
      body: "Dernier tiers à {{lastPace}} contre {{firstPace}} sur le premier tiers — {{fade, number(signDisplay: exceptZero)}} % d'écart, variation de {{cv, number(maximumFractionDigits: 1)}} %. Du solide, avec encore un peu de temps à gagner sur une seconde moitié mieux tenue.",
      body_gap: "Dernier tiers à {{lastPace}} en allure ajustée à la pente, contre {{firstPace}} sur le premier tiers — {{fade, number(signDisplay: exceptZero)}} % d'écart, variation de {{cv, number(maximumFractionDigits: 1)}} %. Du solide, avec encore un peu de temps à gagner sur une seconde moitié mieux tenue.",
    },
  },

  heat: {
    tracked: {
      title: "Votre ralentissement a suivi la montée du thermomètre",
      body: "La température sur le parcours est passée de {{tmin, number}} °C à {{tmax, number}} °C, et votre allure a cédé au même rythme. Une hausse de {{rose, number}} °C jusqu'au milieu des vingtaines suffit à provoquer une dérive cardiovasculaire, indépendamment de la forme.",
    },
    cool: {
      title: "La fraîcheur a servi votre gestion d'allure",
      body: "Les températures sont restées entre {{tmin, number}} °C et {{tmax, number}} °C — sous le seuil où la chaleur devient un facteur limitant — et la régularité de vos intervalles le reflète.",
    },
  },

  fuel: {
    light: {
      title: "Apport en glucides trop léger pour la durée",
      body: "Vous avez pris {{taken, number}} g/h ; la fourchette validée par la recherche pour un effort de {{durationMin, number}} minutes est de {{carbsLow, number}}–{{carbsHigh, number}} g/h. Ce déficit de {{gap, number}} g/h se paie le plus souvent tard, quand le glycogène s'épuise.",
    },
    matched: {
      title: "La nutrition était à la hauteur de la distance",
      body: "{{taken, number}} g/h se situe dans la fourchette de {{carbsLow, number}}–{{carbsHigh, number}} g/h pour cette durée, et vous avez tenu l'allure jusqu'au bout — reconduisez ce débit sur votre prochain effort de longueur comparable.",
    },
  },

  section: {
    fuelDropped: {
      title: "La nutrition a chuté là où votre allure a cédé",
      body: "Entre le km {{fromKm, number(maximumFractionDigits: 1)}} et le km {{toKm, number(maximumFractionDigits: 1)}}, votre apport en glucides était de {{carbRate, number}} g/h — soit {{gap, number}} g/h sous la fourchette de {{carbsLow, number}}–{{carbsHigh, number}} g/h pour un effort de {{durationMin, number}} minutes — et c'est exactement là que votre allure est passée de {{firstPace}} à {{lastPace}}. La dérive suit la nutrition, pas seulement la distance.",
    },
    fuelledClose: {
      title: "Vous avez alimenté la fin de course, et ça a tenu",
      body: "Sur la section finale, du km {{fromKm, number(maximumFractionDigits: 1)}} au km {{toKm, number(maximumFractionDigits: 1)}}, vous avez pris {{carbRate, number}} g/h — dans la fourchette de {{carbsLow, number}}–{{carbsHigh, number}} g/h — et l'allure s'est maintenue à {{lastPace}}. C'est précisément en fin de course que s'alimenter paie.",
    },
    fluidFell: {
      title: "L'hydratation a baissé quand la chaleur montait",
      body: "Entre le km {{fromKm, number(maximumFractionDigits: 1)}} et le km {{toKm, number(maximumFractionDigits: 1)}}, le parcours affichait {{curTemp, number}} °C en moyenne — contre {{prevTemp, number}} °C auparavant — et pourtant votre apport en liquides est tombé à {{curFluid, number}} ml/h contre {{prevFluid, number}} ml/h. L'hydratation doit augmenter avec la température, pas diminuer.",
    },
  },

  climb: {
    matched: {
      title: "Votre effort en montée valait votre allure sur le plat",
      body: "Sur des portions à {{grade, number(minimumFractionDigits: 1, maximumFractionDigits: 1)}} % de pente en moyenne, votre allure ajustée à la pente est restée à {{deltaPct, number(maximumFractionDigits: 0)}} % de votre effort sur le plat — une belle économie en montée sur ce parcours.",
    },
    costly: {
      title: "Les montées ont coûté plus que la pente ne l'explique",
      body: "Sur des portions à {{grade, number(minimumFractionDigits: 1, maximumFractionDigits: 1)}} % de pente en moyenne, votre effort ajusté à la pente a été {{deltaPct, number(maximumFractionDigits: 0)}} % plus lent que sur le plat — davantage que la seule pente ne l'explique, ce qui traduit généralement une perte de puissance ou de technique propre aux montées.",
    },
  },

  descent: {
    efficient: {
      title: "Les descentes ont récupéré du temps efficacement",
      body: "Sur des pentes à {{grade, number(minimumFractionDigits: 1, maximumFractionDigits: 1)}} % en moyenne, l'allure brute a été environ {{recovered, number(maximumFractionDigits: 0)}} % plus rapide que l'allure ajustée à l'effort — la gravité a fait son travail, sans signe de freinage excessif.",
    },
  },

  rec: {
    heatPlan: {
      action: "Bâtir un plan d'allure spécifique chaleur au-delà de 24 °C",
      why: "Votre dérive sur cette course a coïncidé avec un pic à {{tmax, number}} °C. Partir 4 à 6 % plus lentement jusqu'à mi-parcours préserve plus de temps que cela n'en coûte dès qu'il fait chaud.",
    },
    raiseCarbs: {
      action: "Monter l'apport en glucides vers {{carbsLow, number}}–{{carbsHigh, number}} g/h",
      why: "À {{taken, number}} g/h, vous étiez {{gap, number}} g/h sous le bas de la fourchette de {{carbsLow, number}}–{{carbsHigh, number}} g/h pour des efforts de {{durationMin, number}} minutes. {{rationale}}",
    },
    holdCarbs: {
      action: "Tenir {{carbsLow, number}}–{{carbsHigh, number}} g/h du km {{fromKm, number(maximumFractionDigits: 1)}} au km {{toKm, number(maximumFractionDigits: 1)}}",
      why: "Vous avez sous-alimenté cette section de {{gap, number}} g/h, et c'est là que tout a lâché. Y tenir le débit cible est le changement le plus rentable sur ce parcours. {{rationale}}",
    },
    climbIntervals: {
      action: "Travailler des intervalles en côte à la pente de course",
      why: "Votre allure ajustée à la pente dans les montées de ce parcours est le signal le plus clair sur quoi travailler — des répétitions de côte autour de {{grade, number(maximumFractionDigits: 0)}} % de pente transféreront plus directement qu'un tempo sur le plat.",
    },
    openEasier: {
      action: "Tenir le premier tiers 3 à 5 s/km sous l'allure cible",
      why: "Votre écart positif de {{fade, number}} % sur cette course est la signature classique d'un départ trop rapide. Mettre quelques secondes de côté au départ est le temps le moins cher que vous trouverez.",
    },
  },

  headline: {
    strengthCool: "Une allure régulière par temps frais a produit un solide résultat.",
    strengthWarm: "L'allure est restée stable jusqu'à l'arrivée — une course bien exécutée.",
    limiterHot: "La chaleur a provoqué un ralentissement marqué dans les derniers kilomètres.",
    limiterCool: "L'allure s'est nettement délitée dans les derniers kilomètres.",
    mixed: "Un résultat mitigé — certains intervalles ont tenu, d'autres ont lâché.",
  },

  seed: {
    r1: "La chaleur et une première moitié trop rapide vous ont coûté la fin de course.",
    r2: "Un effort régulier dans les montées a livré votre meilleur ultra à ce jour.",
    r3: "De bonnes jambes, mais les secteurs face au vent ont coûté plus de temps que la nutrition.",
    r4: "Négative split par temps frais — votre forme est en avance sur votre calendrier de courses.",
  },
};

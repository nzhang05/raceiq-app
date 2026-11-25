/*
  Model answers for the fixture races, written in the shape the API returns.

  GOOD answers cite only numbers in their data block. BAD answers are the same
  text with specific numbers planted — the grounding test asserts that the
  checker flags exactly those, which is what keeps it from passing vacuously.
*/

export const rideDebrief = {
  good: {
    headline: "Valle Verde came apart between km 40 and km 80, where your carbs fell to 38g/hr as the course heated past 28°C.",
    findings: [
      { kind: "limiter", title: "Fuel dropped where the pace did", body: "Over km 40–80 you took 38g/hr, 42g/hr under the 80–120g/hr range, and pace slipped to 2:06/km.", evidence: ["km 40–80: 38g/hr carbs", "1:52/km → 2:06/km"] },
      { kind: "limiter", title: "Fluids fell as the heat rose", body: "Fluid intake dropped from 700ml/hr to 450ml/hr while the course averaged 30°C, up from 24°C.", evidence: ["km 40–80: 450ml/hr fluid", "30°C vs 24°C"] },
      { kind: "limiter", title: "The same pattern as your ultra", body: "Crête des Aiguilles 80K faded +61.3% at 65g/hr; this ride also ran under its carb range.", evidence: ["Crête des Aiguilles 80K fade +61.3%", "65g/hr carbs (target 80–120g/hr)"] },
    ],
    recommendations: [
      { action: "Hold 80g/hr or more through the middle of long, hot rides.", why: "Your middle section ran at 38g/hr against an 80–120g/hr range for a 253-minute effort.", evidence: ["km 40–80: 38g/hr carbs", "Duration: 253 min"] },
      { action: "Raise fluids as the temperature climbs, not after.", why: "You were at 450ml/hr over km 40–80 as the course reached 31°C.", evidence: ["km 80: 31°C", "km 40–80: 450ml/hr fluid"] },
    ],
  },
};
rideDebrief.bad = structuredClone(rideDebrief.good);
rideDebrief.bad.findings[0].body = "Over km 40–80 you took 38g/hr, 41g/hr under the 80–120g/hr range, and pace slipped to 2:30/km.";
rideDebrief.bad.recommendations[1].why = "Raising fluids by 17% would have offset most of the heat.";
rideDebrief.planted = ["41g/hr", "2:30", "17%"];

export const ultraCoachFr = {
  question: "Pourquoi ai-je ralenti en fin de course ?",
  good: "Sur la Crête des Aiguilles 80K (30 août 2026), votre allure ajustée à la pente est passée de 6:54/km sur le premier intervalle à 10:14/km sur le dernier, soit +48 % de dérive, avec la plus forte baisse au km 70. La nutrition est le facteur le plus net dans les données : 65 g de glucides/h pour une cible de 80–120 g/h sur un effort de 665 minutes, soit 15 g/h sous le minimum. Les conditions n'expliquent pas grand-chose ici, à 19 °C. Vos montées, en revanche, étaient bien gérées : le débriefing les classait parmi vos points forts.",
};
ultraCoachFr.bad = ultraCoachFr.good.replace("+48 %", "+50 %").replace("15 g/h sous", "15,5 g/h sous");
ultraCoachFr.planted = ["50", "15.5"];

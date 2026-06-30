"use client";

import { useState } from "react";
import { useAllProfiles } from "@/contexts/UserContext";

const ENTRY_FEE = 10;
const PRIZE_SPLITS = [60, 30, 10] as const;

type Language = "en" | "es";

const content = {
  en: {
    title: "Rules & Scoring",
    subtitle: "Everything you need to know about earning points",
    languageToggle: "Español",
    prizeTitle: "Prize Distribution",
    prizeSubtitle: "How the prize pool is divided",
    first: "1st Place",
    second: "2nd Place",
    third: "3rd Place",
    participants: "Competition participants",
    prizePool: "Prize pool",
    entryFee: "Entry fee",
    perPerson: "per person",
    phases: {
      title: "Scoring Phases",
      description:
        "Points are earned in three phases throughout the tournament",
    },
    phase1: {
      title: "Phase 1: Group Stage Predictions",
      subtitle: "Before the tournament starts",
      description:
        "Predict the score for all 48 group stage matches before the World Cup begins. Group predictions lock on June 11.",
      scoring: [
        { label: "Correct result (win/draw/loss)", points: "2 pts" },
        { label: "Exact goals for home team", points: "1 pt" },
        { label: "Exact goals for away team", points: "1 pt" },
      ],
      maxPerMatch: "Maximum per match: 4 points",
      example: {
        title: "Example",
        prediction: "Your prediction",
        actual: "Actual result",
        breakdown: "Points breakdown",
        items: [
          { reason: "Correct result (home win)", points: "+2 pts" },
          { reason: "Wrong home goals (predicted 2)", points: "+0 pts" },
          { reason: "Correct away goals (1)", points: "+1 pt" },
        ],
        total: "Total: 3 / 4 points",
      },
    },
    phase2: {
      title: "Phase 2: Group Standings Bonus",
      subtitle: "After group stage ends",
      description:
        "Points awarded based on how your group predictions align with final standings.",
      scoring: [
        { label: "Team advances from group", points: "1 pt" },
        { label: "Correct position in group", points: "1 pt" },
      ],
      maxPerGroup: "Maximum per group (3 advancing teams): 6 points",
      example: {
        title: "Example - Group A Final Standings",
        positions: ["1st", "2nd", "3rd", "4th"],
        yourPrediction: "Your prediction",
        actualResult: "Actual result",
        analysis: {
          title: "Analysis",
          items: [
            {
              team: "Mexico",
              flag: "mx",
              result: "Advanced but wrong position (predicted 1st, got 2nd)",
              points: "+1 pt",
            },
            {
              team: "USA",
              flag: "us",
              result: "Advanced but wrong position (predicted 2nd, got 1st)",
              points: "+1 pt",
            },
            {
              team: "Canada",
              flag: "ca",
              result: "Advanced + Correct position (3rd)*",
              points: "+2 pts",
            },
            {
              team: "Jamaica",
              flag: "jm",
              result: "Did not advance (no points)",
              points: "+0 pts",
            },
          ],
        },
        note: "*3rd place teams only get points if they qualify as one of the 8 best third-place teams.",
      },
    },
    phase3: {
      title: "Phase 3: Knockout Stage Predictions",
      subtitle: "After group stage ends",
      description:
        "Get a second chance to predict all knockout matches once the group stage is complete.",
      secondDraft: {
        title: "Second Draft",
        description:
          "Once the group stage ends (June 11), a new prediction window opens for knockout matches. You'll know exactly which teams qualified, allowing you to make informed predictions for all 16 Round of 32 matches through to the Final.",
        note: "The knockout prediction window closes on June 29, before the first R32 match kicks off.",
      },
      r32: {
        title: "Round of 32",
        description: "Position-based scoring (1 pt per correct goal):",
        scoring: [
          { label: "Correct result (win/draw/loss)", points: "2 pts" },
          { label: "Correct team advances (passes)", points: "1 pt" },
          { label: "Exact goals for home team", points: "1 pt" },
          { label: "Exact goals for away team", points: "1 pt" },
        ],
        max: "Maximum: 5 points per match",
      },
      advanced: {
        title: "Round of 16 and beyond",
        description: "Split winner/loser/passes scoring with multipliers:",
        scoring: [
          { label: "Correct team wins", points: "1 × multiplier" },
          { label: "Correct team loses", points: "1 × multiplier" },
          {
            label: "Correct tie (before penalties)",
            points: "1 × multiplier (each)",
          },
          { label: "Correct team advances (passes)", points: "1 × multiplier" },
          { label: "Exact goals for each team", points: "1 pt each" },
        ],
        note: "You can only score points for teams you predicted to reach that stage.",
      },
      multipliers: {
        title: "Round Multipliers",
        rounds: [
          {
            name: "Round of 32",
            mult: "1",
            perTeam: "1",
            passes: "1",
            goals: "1",
            max: "5",
          },
          {
            name: "Round of 16",
            mult: "2",
            perTeam: "2",
            passes: "2",
            goals: "1",
            max: "8",
          },
          {
            name: "Quarter-finals",
            mult: "3",
            perTeam: "3",
            passes: "3",
            goals: "1",
            max: "11",
          },
          {
            name: "Semi-finals",
            mult: "4",
            perTeam: "4",
            passes: "4",
            goals: "1",
            max: "14",
          },
          {
            name: "Third-place",
            mult: "5",
            perTeam: "5",
            passes: "5",
            goals: "1",
            max: "17",
          },
          {
            name: "Final",
            mult: "6",
            perTeam: "6",
            passes: "6",
            goals: "1",
            max: "20",
          },
        ],
        headers: ["Round", "Win/Lose/Draw", "Pass next round", "Goals", "Max"],
      },
      example: {
        title: "Example - Quarter-final (3× multiplier)",
        prediction: "Your prediction",
        actual: "Actual result",
        breakdown: "Points breakdown",
        items: [
          { reason: "Correct winner (Germany)", points: "+3 pts (1×3)" },
          { reason: "Correct loser (Brazil)", points: "+3 pts (1×3)" },
          { reason: "Germany advances (passes)", points: "+3 pts (1×3)" },
          { reason: "Wrong goals for Germany", points: "+0 pts" },
          { reason: "Correct goals for Brazil (1)", points: "+1 pt" },
        ],
        total: "Total: 10 / 11 points",
      },
      example2: {
        title:
          "Example 2 — Semi-final tie vs an opponent you didn't predict (4× multiplier)",
        note: "You predicted Mexico to draw Côte d'Ivoire and advance on penalties. The real semi-final paired Mexico with the Netherlands instead — but it ended in the same 1-1 tie and Mexico still advanced. You keep every point tied to Mexico, but lose the points tied to the opponent you got wrong (you had CIV, not NED).",
        prediction: "Your prediction",
        actual: "Actual result",
        advances: "MEX advances on pens",
        breakdown: "Points breakdown",
        items: [
          {
            reason: "Correct tie — Mexico (you had MEX in this match)",
            points: "+4 pts (1×4)",
          },
          { reason: "Mexico advances (passes)", points: "+4 pts (1×4)" },
          { reason: "Correct goals for Mexico (1)", points: "+1 pt" },
          {
            reason: "No tie credit for Netherlands (you predicted CIV)",
            points: "+0 pts",
          },
          {
            reason: "No goal credit for Netherlands (you predicted CIV)",
            points: "+0 pts",
          },
        ],
        total: "Total: 9 / 14 points",
      },
    },
    tiebreaker: {
      title: "Tiebreakers",
      description:
        "When teams have equal points in groups, use FIFA tiebreaker rules:",
      rules: [
        "1. Goal difference",
        "2. Goals scored",
        "3. Points in head-to-head",
        "4. Goal difference in head-to-head",
        "5. Goals scored in head-to-head",
      ],
      note: "If still tied, you can manually adjust positions using the swap buttons in the predictions page.",
    },
    summary: {
      title: "Points Summary",
      maxPoints: "Maximum possible points",
      groupMatches: "48 group matches × 4 pts = 192 pts",
      groupBonus: "12 groups × 6 pts = 72 pts",
      knockout: "Knockout rounds = ~253 pts",
      total: "Total possible: 517 points",
    },
  },
  es: {
    title: "Reglas y Puntuación",
    subtitle: "Todo lo que necesitas saber sobre cómo ganar puntos",
    languageToggle: "English",
    prizeTitle: "Distribución de Premios",
    prizeSubtitle: "Cómo se divide el pozo de premios",
    first: "1er Lugar",
    second: "2do Lugar",
    third: "3er Lugar",
    participants: "Participantes de la competencia",
    prizePool: "Pozo de premios",
    entryFee: "Entrada",
    perPerson: "por persona",
    phases: {
      title: "Fases de Puntuación",
      description: "Los puntos se ganan en tres fases a lo largo del torneo",
    },
    phase1: {
      title: "Fase 1: Predicciones de Fase de Grupos",
      subtitle: "Antes de que comience el torneo",
      description:
        "Predice el resultado de los 48 partidos de fase de grupos antes de que comience la Copa del Mundo.",
      scoring: [
        {
          label: "Resultado correcto (victoria/empate/derrota)",
          points: "2 pts",
        },
        { label: "Goles exactos del equipo local", points: "1 pt" },
        { label: "Goles exactos del equipo visitante", points: "1 pt" },
      ],
      maxPerMatch: "Máximo por partido: 4 puntos",
      example: {
        title: "Ejemplo",
        prediction: "Tu predicción",
        actual: "Resultado real",
        breakdown: "Desglose de puntos",
        items: [
          { reason: "Resultado correcto (victoria local)", points: "+2 pts" },
          {
            reason: "Goles locales incorrectos (predijiste 2)",
            points: "+0 pts",
          },
          { reason: "Goles visitantes correctos (1)", points: "+1 pt" },
        ],
        total: "Total: 3 / 4 puntos",
      },
    },
    phase2: {
      title: "Fase 2: Bonus por Posiciones de Grupo",
      subtitle: "Después de que termine la fase de grupos",
      description:
        "Puntos otorgados según cómo tus predicciones se alinean con las posiciones finales.",
      scoring: [
        { label: "Equipo avanza del grupo", points: "1 pt" },
        { label: "Posición correcta en el grupo", points: "1 pt" },
      ],
      maxPerGroup: "Máximo por grupo (3 equipos avanzando): 6 puntos",
      example: {
        title: "Ejemplo - Posiciones Finales Grupo A",
        positions: ["1ro", "2do", "3ro", "4to"],
        yourPrediction: "Tu predicción",
        actualResult: "Resultado real",
        analysis: {
          title: "Análisis",
          items: [
            {
              team: "México",
              flag: "mx",
              result:
                "Avanzó pero posición incorrecta (predijo 1ro, quedó 2do)",
              points: "+1 pt",
            },
            {
              team: "EE.UU.",
              flag: "us",
              result:
                "Avanzó pero posición incorrecta (predijo 2do, quedó 1ro)",
              points: "+1 pt",
            },
            {
              team: "Canadá",
              flag: "ca",
              result: "Avanzó + Posición correcta (3ro)*",
              points: "+2 pts",
            },
            {
              team: "Jamaica",
              flag: "jm",
              result: "No avanzó (sin puntos)",
              points: "+0 pts",
            },
          ],
        },
        note: "*Los equipos 3ros solo obtienen puntos si clasifican como uno de los 8 mejores terceros.",
      },
    },
    phase3: {
      title: "Fase 3: Predicciones de Eliminatorias",
      subtitle: "Después de que termine la fase de grupos",
      description:
        "Tienes una segunda oportunidad para predecir todos los partidos eliminatorios una vez que termine la fase de grupos.",
      secondDraft: {
        title: "Segundo Draft",
        description:
          "Una vez que termina la fase de grupos, se abre una nueva ventana de predicciones para los partidos eliminatorios. Sabrás exactamente qué equipos clasificaron, lo que te permite hacer predicciones informadas desde los 16 partidos de la Ronda de 32 hasta la Final.",
        note: "La ventana de predicciones de eliminatorias se cierra antes del primer partido de R32.",
      },
      r32: {
        title: "Ronda de 32",
        description: "Puntuación por posición (1 pt por gol correcto):",
        scoring: [
          {
            label: "Resultado correcto (victoria/empate/derrota)",
            points: "2 pts",
          },
          { label: "Equipo correcto avanza (pasa)", points: "1 pt" },
          { label: "Goles exactos del equipo local", points: "1 pt" },
          { label: "Goles exactos del equipo visitante", points: "1 pt" },
        ],
        max: "Máximo: 5 puntos por partido",
      },
      advanced: {
        title: "Octavos de final en adelante",
        description:
          "Puntuación dividida ganador/perdedor/pasa con multiplicadores:",
        scoring: [
          { label: "Equipo correcto gana", points: "1 × multiplicador" },
          { label: "Equipo correcto pierde", points: "1 × multiplicador" },
          {
            label: "Empate correcto (antes de penales)",
            points: "1 × multiplicador (c/u)",
          },
          { label: "Equipo correcto avanza (pasa)", points: "1 × multiplicador" },
          { label: "Goles exactos de cada equipo", points: "1 pt c/u" },
        ],
        note: "Solo puedes ganar puntos por equipos que predijiste que llegarían a esa fase.",
      },
      multipliers: {
        title: "Multiplicadores por Ronda",
        rounds: [
          {
            name: "Ronda de 32",
            mult: "1",
            perTeam: "1",
            passes: "1",
            goals: "1",
            max: "5",
          },
          {
            name: "Octavos",
            mult: "2",
            perTeam: "2",
            passes: "2",
            goals: "1",
            max: "8",
          },
          {
            name: "Cuartos",
            mult: "3",
            perTeam: "3",
            passes: "3",
            goals: "1",
            max: "11",
          },
          {
            name: "Semifinales",
            mult: "4",
            perTeam: "4",
            passes: "4",
            goals: "1",
            max: "14",
          },
          {
            name: "3er puesto",
            mult: "5",
            perTeam: "5",
            passes: "5",
            goals: "1",
            max: "17",
          },
          {
            name: "Final",
            mult: "6",
            perTeam: "6",
            passes: "6",
            goals: "1",
            max: "20",
          },
        ],
        headers: ["Ronda", "Gana/Pierde/Empata", "Pasa de ronda", "Goles", "Máx"],
      },
      example: {
        title: "Ejemplo - Cuartos de final (multiplicador 3×)",
        prediction: "Tu predicción",
        actual: "Resultado real",
        breakdown: "Desglose de puntos",
        items: [
          { reason: "Ganador correcto (Alemania)", points: "+3 pts (1×3)" },
          { reason: "Perdedor correcto (Brasil)", points: "+3 pts (1×3)" },
          { reason: "Alemania avanza (pasa)", points: "+3 pts (1×3)" },
          { reason: "Goles incorrectos de Alemania", points: "+0 pts" },
          { reason: "Goles correctos de Brasil (1)", points: "+1 pt" },
        ],
        total: "Total: 10 / 11 puntos",
      },
      example2: {
        title:
          "Ejemplo 2 — Empate en semifinal ante un rival que no predijiste (multiplicador 4×)",
        note: "Predijiste que México empataría con Costa de Marfil y avanzaría por penales. La semifinal real enfrentó a México con Países Bajos — pero terminó en el mismo empate 1-1 y México igual avanzó. Conservás todos los puntos ligados a México, pero perdés los puntos ligados al rival que erraste (tenías a CIV, no a NED).",
        prediction: "Tu predicción",
        actual: "Resultado real",
        advances: "MEX avanza por penales",
        breakdown: "Desglose de puntos",
        items: [
          {
            reason: "Empate correcto — México (tenías a MEX en este partido)",
            points: "+4 pts (1×4)",
          },
          { reason: "México avanza (pasa)", points: "+4 pts (1×4)" },
          { reason: "Goles correctos de México (1)", points: "+1 pt" },
          {
            reason: "Sin crédito de empate para Países Bajos (predijiste CIV)",
            points: "+0 pts",
          },
          {
            reason: "Sin crédito de goles para Países Bajos (predijiste CIV)",
            points: "+0 pts",
          },
        ],
        total: "Total: 9 / 14 puntos",
      },
    },
    tiebreaker: {
      title: "Desempates",
      description:
        "Cuando los equipos tienen puntos iguales en grupos, se usan las reglas de desempate de FIFA:",
      rules: [
        "1. Diferencia de goles",
        "2. Goles a favor",
        "3. Puntos en enfrentamiento directo",
        "4. Diferencia de goles en enfrentamiento directo",
        "5. Goles a favor en enfrentamiento directo",
      ],
      note: "Si siguen empatados, puedes ajustar manualmente las posiciones usando los botones de intercambio en la página de predicciones.",
    },
    summary: {
      title: "Resumen de Puntos",
      maxPoints: "Máximo de puntos posibles",
      groupMatches: "48 partidos de grupos × 4 pts = 192 pts",
      groupBonus: "12 grupos × 6 pts = 72 pts",
      knockout: "Rondas eliminatorias = ~253 pts",
      total: "Total posible: 517 puntos",
    },
  },
};

export default function RulesPage() {
  const [lang, setLang] = useState<Language>("en");
  const t = content[lang];
  const profiles = useAllProfiles();
  const participantCount = profiles.content?.length ?? 0;
  const totalPool = participantCount * ENTRY_FEE;
  const prizes = PRIZE_SPLITS.map((pct) =>
    Math.floor((totalPool * pct) / 100),
  );

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        {/* Header with Language Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              {t.title}
            </h1>
            <p className="text-white/60 mt-1">{t.subtitle}</p>
          </div>
          <button
            onClick={() => setLang(lang === "en" ? "es" : "en")}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all self-start sm:self-auto"
          >
            <img src={lang === "en" ? "https://flagcdn.com/w40/es.png" : "https://flagcdn.com/w40/us.png"} alt="" className="w-5 h-4 object-contain" />
            <span className="text-white font-medium">{t.languageToggle}</span>
          </button>
        </div>

        {/* Prize Distribution */}
        <section className="glass-card p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            {t.prizeTitle}
          </h2>
          <p className="text-white/60 text-sm mb-6">{t.prizeSubtitle}</p>

          <div className="grid grid-cols-3 gap-4">
            {/* 1st Place */}
            <div className="relative bg-gradient-to-b from-yellow-500/30 to-yellow-600/10 border border-yellow-500/40 rounded-xl p-4 text-center">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-black font-bold text-sm shadow-lg shadow-yellow-500/50">
                1
              </div>
              <div className="mt-4">
                <span className="text-3xl sm:text-4xl">🥇</span>
                <div className="mt-2 text-yellow-400 font-bold text-2xl sm:text-3xl">
                  60%
                </div>
                <div className="text-white/70 text-xs sm:text-sm mt-1">
                  {t.first}
                </div>
                {totalPool > 0 && (
                  <div className="text-yellow-300/80 font-bold text-lg sm:text-xl mt-1">
                    ${prizes[0]}
                  </div>
                )}
              </div>
            </div>

            {/* 2nd Place */}
            <div className="relative bg-gradient-to-b from-gray-400/30 to-gray-500/10 border border-gray-400/40 rounded-xl p-4 text-center">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-black font-bold text-sm shadow-lg shadow-gray-400/50">
                2
              </div>
              <div className="mt-4">
                <span className="text-3xl sm:text-4xl">🥈</span>
                <div className="mt-2 text-gray-300 font-bold text-2xl sm:text-3xl">
                  30%
                </div>
                <div className="text-white/70 text-xs sm:text-sm mt-1">
                  {t.second}
                </div>
                {totalPool > 0 && (
                  <div className="text-gray-300/80 font-bold text-lg sm:text-xl mt-1">
                    ${prizes[1]}
                  </div>
                )}
              </div>
            </div>

            {/* 3rd Place */}
            <div className="relative bg-gradient-to-b from-orange-600/30 to-orange-700/10 border border-orange-600/40 rounded-xl p-4 text-center">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-orange-600/50">
                3
              </div>
              <div className="mt-4">
                <span className="text-3xl sm:text-4xl">🥉</span>
                <div className="mt-2 text-orange-400 font-bold text-2xl sm:text-3xl">
                  10%
                </div>
                <div className="text-white/70 text-xs sm:text-sm mt-1">
                  {t.third}
                </div>
                {totalPool > 0 && (
                  <div className="text-orange-300/80 font-bold text-lg sm:text-xl mt-1">
                    ${prizes[2]}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Participants & Pool Info */}
          <div className="mt-6 flex flex-col sm:flex-row items-stretch gap-4 text-sm">
            <div className="flex-1 flex items-center justify-center gap-2 bg-white/5 px-4 py-2 rounded-lg">
              <span className="text-white/60">👥 {t.participants}:</span>
              <span className="text-white font-bold text-lg">{participantCount}</span>
            </div>
            <div className="flex-1 flex items-center justify-center gap-2 bg-white/5 px-4 py-2 rounded-lg">
              <span className="text-white/60">💰 {t.entryFee}:</span>
              <span className="text-white font-bold text-lg">${ENTRY_FEE} {t.perPerson}</span>
            </div>
            <div className="flex-1 flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 rounded-lg">
              <span className="text-emerald-400/80">🏆 {t.prizePool}:</span>
              <span className="text-emerald-400 font-bold text-lg">${totalPool}</span>
            </div>
          </div>
        </section>

        {/* Scoring Phases Overview */}
        <section className="glass-card p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-2">
            {t.phases.title}
          </h2>
          <p className="text-white/60 text-sm">{t.phases.description}</p>
        </section>

        {/* Phase 1: Group Stage */}
        <section className="glass-card p-6 mb-8">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-500/20 border border-emerald-500/40 rounded-lg flex items-center justify-center text-emerald-400 font-bold shrink-0">
              1
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{t.phase1.title}</h2>
              <p className="text-emerald-400 text-sm">{t.phase1.subtitle}</p>
            </div>
          </div>

          <p className="text-white/70 mb-6">{t.phase1.description}</p>

          {/* Scoring table */}
          <div className="bg-white/5 rounded-lg p-4 mb-6">
            <table className="w-full">
              <tbody>
                {t.phase1.scoring.map((item, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/10 last:border-0"
                  >
                    <td className="py-2 text-white/80 text-sm">{item.label}</td>
                    <td className="py-2 text-right text-emerald-400 font-bold w-16 whitespace-nowrap">
                      {item.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 pt-3 border-t border-white/20 text-white font-semibold text-sm">
              {t.phase1.maxPerMatch}
            </div>
          </div>

          {/* Example */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-white/10">
            <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
              <span className="text-amber-400">💡</span>
              {t.phase1.example.title}
            </h4>

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              {/* Prediction */}
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-white/50 text-xs mb-2">
                  {t.phase1.example.prediction}
                </div>
                <div className="flex items-center justify-center gap-3">
                  <div className="flex items-center gap-2">
                    <img src="https://flagcdn.com/w40/ar.png" alt="ARG" className="w-6 h-4 object-contain" />
                    <span className="text-white font-semibold">ARG</span>
                  </div>
                  <div className="bg-white/10 px-3 py-1 rounded font-bold text-white">
                    2 - 1
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold">NGA</span>
                    <img src="https://flagcdn.com/w40/ng.png" alt="NGA" className="w-6 h-4 object-contain" />
                  </div>
                </div>
              </div>

              {/* Actual */}
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                <div className="text-emerald-400/70 text-xs mb-2">
                  {t.phase1.example.actual}
                </div>
                <div className="flex items-center justify-center gap-3">
                  <div className="flex items-center gap-2">
                    <img src="https://flagcdn.com/w40/ar.png" alt="ARG" className="w-6 h-4 object-contain" />
                    <span className="text-white font-semibold">ARG</span>
                  </div>
                  <div className="bg-emerald-500/20 px-3 py-1 rounded font-bold text-emerald-300">
                    3 - 1
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold">NGA</span>
                    <img src="https://flagcdn.com/w40/ng.png" alt="NGA" className="w-6 h-4 object-contain" />
                  </div>
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <div className="text-white/50 text-xs mb-2">
              {t.phase1.example.breakdown}
            </div>
            <div className="space-y-1">
              {t.phase1.example.items.map((item, i) => (
                <div
                  key={i}
                  className={`flex justify-between items-center py-1.5 px-2 rounded ${
                    item.points.includes("+0")
                      ? "bg-red-500/10"
                      : "bg-emerald-500/10"
                  }`}
                >
                  <span
                    className={`text-sm ${item.points.includes("+0") ? "text-red-300" : "text-emerald-300"}`}
                  >
                    {item.reason}
                  </span>
                  <span
                    className={`font-bold text-sm ${item.points.includes("+0") ? "text-red-400" : "text-emerald-400"}`}
                  >
                    {item.points}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-2 border-t border-white/20 text-right">
              <span className="text-white font-bold">
                {t.phase1.example.total}
              </span>
            </div>
          </div>
        </section>

        {/* Phase 2: Group Standings Bonus */}
        <section className="glass-card p-6 mb-8">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-500/20 border border-blue-500/40 rounded-lg flex items-center justify-center text-blue-400 font-bold shrink-0">
              2
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{t.phase2.title}</h2>
              <p className="text-blue-400 text-sm">{t.phase2.subtitle}</p>
            </div>
          </div>

          <p className="text-white/70 mb-6">{t.phase2.description}</p>

          {/* Scoring table */}
          <div className="bg-white/5 rounded-lg p-4 mb-6">
            <table className="w-full">
              <tbody>
                {t.phase2.scoring.map((item, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/10 last:border-0"
                  >
                    <td className="py-2 text-white/80 text-sm">{item.label}</td>
                    <td className="py-2 text-right text-blue-400 font-bold w-16 whitespace-nowrap">
                      {item.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 pt-3 border-t border-white/20 text-white font-semibold text-sm">
              {t.phase2.maxPerGroup}
            </div>
          </div>

          {/* Example */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-white/10">
            <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
              <span className="text-amber-400">💡</span>
              {t.phase2.example.title}
            </h4>

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              {/* Your Prediction */}
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-white/50 text-xs mb-3">
                  {t.phase2.example.yourPrediction}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-6 text-white/50">
                      {t.phase2.example.positions[0]}
                    </span>
                    <img src="https://flagcdn.com/w40/mx.png" alt="MEX" className="w-5 h-4 object-contain" />
                    <span className="text-white">Mexico</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-6 text-white/50">
                      {t.phase2.example.positions[1]}
                    </span>
                    <img src="https://flagcdn.com/w40/us.png" alt="USA" className="w-5 h-4 object-contain" />
                    <span className="text-white">USA</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-6 text-white/50">
                      {t.phase2.example.positions[2]}
                    </span>
                    <img src="https://flagcdn.com/w40/ca.png" alt="CAN" className="w-5 h-4 object-contain" />
                    <span className="text-white">Canada</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-6 text-white/50">
                      {t.phase2.example.positions[3]}
                    </span>
                    <img src="https://flagcdn.com/w40/jm.png" alt="JAM" className="w-5 h-4 object-contain" />
                    <span className="text-white">Jamaica</span>
                  </div>
                </div>
              </div>

              {/* Actual Result */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <div className="text-blue-400/70 text-xs mb-3">
                  {t.phase2.example.actualResult}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-6 text-blue-400">
                      {t.phase2.example.positions[0]}
                    </span>
                    <img src="https://flagcdn.com/w40/us.png" alt="USA" className="w-5 h-4 object-contain" />
                    <span className="text-white font-semibold">USA</span>
                    <span className="text-xs bg-amber-500/30 text-amber-300 px-1.5 py-0.5 rounded ml-auto">
                      ↑
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-6 text-blue-400">
                      {t.phase2.example.positions[1]}
                    </span>
                    <img src="https://flagcdn.com/w40/mx.png" alt="MEX" className="w-5 h-4 object-contain" />
                    <span className="text-white font-semibold">Mexico</span>
                    <span className="text-xs bg-amber-500/30 text-amber-300 px-1.5 py-0.5 rounded ml-auto">
                      ↓
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-6 text-blue-400">
                      {t.phase2.example.positions[2]}
                    </span>
                    <img src="https://flagcdn.com/w40/ca.png" alt="CAN" className="w-5 h-4 object-contain" />
                    <span className="text-white font-semibold">Canada</span>
                    <span className="text-xs bg-emerald-500/30 text-emerald-300 px-1.5 py-0.5 rounded ml-auto">
                      ✓
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-6 text-white/30">
                      {t.phase2.example.positions[3]}
                    </span>
                    <img src="https://flagcdn.com/w40/jm.png" alt="JAM" className="w-5 h-4 object-contain" />
                    <span className="text-white/50">Jamaica</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Analysis */}
            <div className="text-white/50 text-xs mb-2">
              {t.phase2.example.analysis.title}
            </div>
            <div className="space-y-1">
              {t.phase2.example.analysis.items.map((item, i) => (
                <div
                  key={i}
                  className={`flex justify-between items-center py-1.5 px-2 rounded ${
                    item.points.includes("+0")
                      ? "bg-red-500/10"
                      : "bg-blue-500/10"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <img src={`https://flagcdn.com/w40/${item.flag}.png`} alt={item.team} className="w-5 h-4 object-contain" />
                    <span className="text-sm">{item.team}</span>
                    <span
                      className={`text-xs ${item.points.includes("+0") ? "text-red-300/70" : "text-blue-300/70"}`}
                    >
                      {item.result}
                    </span>
                  </div>
                  <span
                    className={`font-bold text-sm ${item.points.includes("+0") ? "text-red-400" : "text-blue-400"}`}
                  >
                    {item.points}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-white/50 text-xs italic">
              {t.phase2.example.note}
            </p>
          </div>
        </section>

        {/* Phase 3: Knockout Stage */}
        <section className="glass-card p-6 mb-8">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-500/20 border border-purple-500/40 rounded-lg flex items-center justify-center text-purple-400 font-bold shrink-0">
              3
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{t.phase3.title}</h2>
              <p className="text-purple-400 text-sm">{t.phase3.subtitle}</p>
            </div>
          </div>

          <p className="text-white/70 mb-6">{t.phase3.description}</p>

          {/* Second Draft Section */}
          <div className="bg-gradient-to-r from-purple-900/40 to-indigo-900/40 rounded-lg p-4 mb-6 border border-purple-500/30">
            <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
              <span className="text-lg">📝</span>
              {t.phase3.secondDraft.title}
            </h4>
            <p className="text-white/70 text-sm mb-2">
              {t.phase3.secondDraft.description}
            </p>
            <p className="text-amber-400/80 text-xs">
              ⏰ {t.phase3.secondDraft.note}
            </p>
          </div>

          {/* R32 Section */}
          <div className="bg-white/5 rounded-lg p-4 mb-6">
            <h4 className="text-white font-semibold mb-3">
              {t.phase3.r32.title}
            </h4>
            <p className="text-white/60 text-sm mb-3">
              {t.phase3.r32.description}
            </p>
            <table className="w-full">
              <tbody>
                {t.phase3.r32.scoring.map((item, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/10 last:border-0"
                  >
                    <td className="py-2 text-white/80 text-sm">{item.label}</td>
                    <td className="py-2 text-right text-purple-400 font-bold w-16 whitespace-nowrap">
                      {item.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 pt-3 border-t border-white/20 text-white font-semibold text-sm">
              {t.phase3.r32.max}
            </div>
          </div>

          {/* Advanced rounds Section */}
          <div className="bg-white/5 rounded-lg p-4 mb-6">
            <h4 className="text-white font-semibold mb-3">
              {t.phase3.advanced.title}
            </h4>
            <p className="text-white/60 text-sm mb-3">
              {t.phase3.advanced.description}
            </p>
            <table className="w-full">
              <tbody>
                {t.phase3.advanced.scoring.map((item, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/10 last:border-0"
                  >
                    <td className="py-2 text-white/80 text-sm">{item.label}</td>
                    <td className="py-2 text-right text-purple-400 font-bold w-24">
                      {item.points.match(/\((?:each|c\/u)\)/) ? (
                        (() => {
                          const match =
                            item.points.match(/\s*\((each|c\/u)\)/)!;
                          const main = item.points.slice(0, match.index);
                          const suffix = `(${match[1]})`;
                          return (
                            <>
                              <span className="whitespace-nowrap">{main}</span>
                              <br />
                              <span className="text-xs font-normal whitespace-nowrap">
                                {suffix}
                              </span>
                            </>
                          );
                        })()
                      ) : (
                        <span className="whitespace-nowrap">{item.points}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 pt-3 border-t border-white/20 text-amber-400/80 text-xs">
              ⚠️ {t.phase3.advanced.note}
            </p>
          </div>

          {/* Multipliers Table */}
          <div className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 rounded-lg p-4 mb-6 border border-purple-500/20">
            <h4 className="text-white font-semibold mb-4">
              {t.phase3.multipliers.title}
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/20">
                    {t.phase3.multipliers.headers.map((header, i) => (
                      <th
                        key={i}
                        className="py-2 px-1.5 sm:px-2 text-left text-white/60 font-medium text-xs whitespace-nowrap"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.phase3.multipliers.rounds.map((round, i) => (
                    <tr
                      key={i}
                      className="border-b border-white/10 last:border-0"
                    >
                      <td className="py-2 px-1.5 sm:px-2 text-white font-medium text-xs sm:text-sm">
                        {round.name}
                      </td>
                      <td className="py-2 px-1.5 sm:px-2 text-white/70">
                        {round.perTeam}
                        <span className="text-white/40 text-[10px]">
                          {" "}
                          / correct team
                        </span>
                      </td>
                      <td className="py-2 px-1.5 sm:px-2 text-teal-300">
                        {round.passes}
                      </td>
                      <td className="py-2 px-1.5 sm:px-2 text-white/70">
                        {round.goals}
                        <span className="text-white/40 text-[10px]">
                          {" "}
                          / correct team
                        </span>
                      </td>
                      <td className="py-2 px-1.5 sm:px-2 text-emerald-400 font-bold">
                        {round.max}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Knockout Example */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-white/10">
            <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
              <span className="text-amber-400">💡</span>
              {t.phase3.example.title}
            </h4>

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              {/* Prediction */}
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-white/50 text-xs mb-2">
                  {t.phase3.example.prediction}
                </div>
                <div className="flex items-center justify-center gap-3">
                  <div className="flex items-center gap-2">
                    <img src="https://flagcdn.com/w40/de.png" alt="GER" className="w-6 h-4 object-contain" />
                    <span className="text-white font-semibold">GER</span>
                  </div>
                  <div className="bg-white/10 px-3 py-1 rounded font-bold text-white">
                    2 - 1
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold">BRA</span>
                    <img src="https://flagcdn.com/w40/br.png" alt="BRA" className="w-6 h-4 object-contain" />
                  </div>
                </div>
              </div>

              {/* Actual */}
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                <div className="text-purple-400/70 text-xs mb-2">
                  {t.phase3.example.actual}
                </div>
                <div className="flex items-center justify-center gap-3">
                  <div className="flex items-center gap-2">
                    <img src="https://flagcdn.com/w40/de.png" alt="GER" className="w-6 h-4 object-contain" />
                    <span className="text-white font-semibold">GER</span>
                  </div>
                  <div className="bg-purple-500/20 px-3 py-1 rounded font-bold text-purple-300">
                    3 - 1
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold">BRA</span>
                    <img src="https://flagcdn.com/w40/br.png" alt="BRA" className="w-6 h-4 object-contain" />
                  </div>
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <div className="text-white/50 text-xs mb-2">
              {t.phase3.example.breakdown}
            </div>
            <div className="space-y-1">
              {t.phase3.example.items.map((item, i) => (
                <div
                  key={i}
                  className={`flex justify-between items-center py-1.5 px-2 rounded ${
                    item.points.includes("+0")
                      ? "bg-red-500/10"
                      : "bg-purple-500/10"
                  }`}
                >
                  <span
                    className={`text-sm ${item.points.includes("+0") ? "text-red-300" : "text-purple-300"}`}
                  >
                    {item.reason}
                  </span>
                  <span
                    className={`font-bold text-sm ${item.points.includes("+0") ? "text-red-400" : "text-purple-400"}`}
                  >
                    {item.points}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-2 border-t border-white/20 text-right">
              <span className="text-white font-bold">
                {t.phase3.example.total}
              </span>
            </div>
          </div>

          {/* Knockout Example 2 — tie vs an opponent you didn't predict */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-white/10 mt-4">
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <span className="text-amber-400">💡</span>
              {t.phase3.example2.title}
            </h4>

            <p className="text-white/60 text-sm mb-4">
              {t.phase3.example2.note}
            </p>

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              {/* Prediction */}
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-white/50 text-xs mb-2">
                  {t.phase3.example2.prediction}
                </div>
                <div className="flex items-center justify-center gap-3">
                  <div className="flex items-center gap-2">
                    <img src="https://flagcdn.com/w40/mx.png" alt="MEX" className="w-6 h-4 object-contain" />
                    <span className="text-white font-semibold">MEX</span>
                  </div>
                  <div className="bg-white/10 px-3 py-1 rounded font-bold text-white">
                    1 - 1
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold">CIV</span>
                    <img src="https://flagcdn.com/w40/ci.png" alt="CIV" className="w-6 h-4 object-contain" />
                  </div>
                </div>
                <div className="text-center text-white/40 text-[11px] mt-2">
                  {t.phase3.example2.advances}
                </div>
              </div>

              {/* Actual */}
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                <div className="text-purple-400/70 text-xs mb-2">
                  {t.phase3.example2.actual}
                </div>
                <div className="flex items-center justify-center gap-3">
                  <div className="flex items-center gap-2">
                    <img src="https://flagcdn.com/w40/mx.png" alt="MEX" className="w-6 h-4 object-contain" />
                    <span className="text-white font-semibold">MEX</span>
                  </div>
                  <div className="bg-purple-500/20 px-3 py-1 rounded font-bold text-purple-300">
                    1 - 1
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-300 font-semibold">NED</span>
                    <img src="https://flagcdn.com/w40/nl.png" alt="NED" className="w-6 h-4 object-contain" />
                  </div>
                </div>
                <div className="text-center text-purple-300/60 text-[11px] mt-2">
                  {t.phase3.example2.advances}
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <div className="text-white/50 text-xs mb-2">
              {t.phase3.example2.breakdown}
            </div>
            <div className="space-y-1">
              {t.phase3.example2.items.map((item, i) => (
                <div
                  key={i}
                  className={`flex justify-between items-center py-1.5 px-2 rounded ${
                    item.points.includes("+0")
                      ? "bg-red-500/10"
                      : "bg-purple-500/10"
                  }`}
                >
                  <span
                    className={`text-sm ${item.points.includes("+0") ? "text-red-300" : "text-purple-300"}`}
                  >
                    {item.reason}
                  </span>
                  <span
                    className={`font-bold text-sm ${item.points.includes("+0") ? "text-red-400" : "text-purple-400"}`}
                  >
                    {item.points}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-2 border-t border-white/20 text-right">
              <span className="text-white font-bold">
                {t.phase3.example2.total}
              </span>
            </div>
          </div>
        </section>

        {/* Tiebreakers */}
        <section className="glass-card p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <span className="text-amber-400">⚖️</span>
            {t.tiebreaker.title}
          </h2>
          <p className="text-white/60 text-sm mb-4">
            {t.tiebreaker.description}
          </p>

          <div className="bg-white/5 rounded-lg p-4">
            <ol className="space-y-2">
              {t.tiebreaker.rules.map((rule, i) => (
                <li key={i} className="text-white/80 text-sm">
                  {rule}
                </li>
              ))}
            </ol>
          </div>

          <p className="mt-4 text-white/50 text-xs italic">
            {t.tiebreaker.note}
          </p>
        </section>

        {/* Summary */}
        <section className="glass-card p-6 bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border-emerald-500/30">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-emerald-400">📊</span>
            {t.summary.title}
          </h2>

          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-white/10">
              <span className="text-white/70 text-sm">
                {t.summary.groupMatches}
              </span>
              <span className="text-emerald-400 font-bold">192</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-white/10">
              <span className="text-white/70 text-sm">
                {t.summary.groupBonus}
              </span>
              <span className="text-blue-400 font-bold">72</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-white/10">
              <span className="text-white/70 text-sm">
                {t.summary.knockout}
              </span>
              <span className="text-purple-400 font-bold">253</span>
            </div>
            <div className="flex justify-between items-center py-3 mt-2 bg-white/10 rounded-lg px-3">
              <span className="text-white font-semibold">
                {t.summary.total}
              </span>
              <span className="text-2xl font-bold text-white">517</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

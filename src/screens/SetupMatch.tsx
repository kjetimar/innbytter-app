// src/screens/SetupMatch.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "@/db/schema";
import { nanoid } from "@/utils/nanoid";
import { generatePlan } from "@/domain/planner";

export default function SetupMatch() {
  const nav = useNavigate();

  const [teamName, setTeamName] = useState("Mitt lag");
  const [playersText, setPlayersText] = useState("Anna, Bo, Cam, Dan, Eva, Finn, Gina, Hal, Ida, Jon");
  const [keepersText, setKeepersText] = useState("Anna, Bo");
  const [sport, setSport] = useState("Fotball");
  const [onField, setOnField] = useState(5);
  const [halves, setHalves] = useState(2);
  const [halfLength, setHalfLength] = useState(25);
  const [subInterval, setSubInterval] = useState(5);
  const [keeperInterval, setKeeperInterval] = useState(10);   // 0 = bruk hvert n-te vindu
  const [keeperEvery, setKeeperEvery] = useState(2);          // fallback når keeperInterval=0
  const [matchesInARow, setMatchesInARow] = useState(1);

  const parseList = (txt: string) =>
    txt.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1) Parse input
    const playerNames = parseList(playersText);
    const keeperNames = parseList(keepersText).map(s => s.toLowerCase());

    // 2) Opprett (eller gjenbruk) team-id
    const teamId = nanoid();

    // 3) Lag spillere i DB
    const playerIds: string[] = [];
    for (const name of playerNames) {
      const id = nanoid();
      playerIds.push(id);
      await db.players.put({
        id,
        teamId,
        name,
      });
    }

    // 4) Match-objekt med innstillinger
    const matchId = nanoid();
    const match = {
      id: matchId,
      teamId,
      teamName,
      sport,
      onFieldCount: onField,
      halves,
      halfLengthMin: halfLength,
      subIntervalMin: subInterval,
      keeperIntervalMin: keeperInterval, // hvis 0 → fallback under
      keeperRarity: keeperEvery,         // n-te vindu
      keeperNamesRaw: keepersText,       // for gjenkjenning senere
      matchesInARow,
      createdAt: Date.now(),
    };
    await db.matches.put(match);

    // 5) Finn keeper-IDs fra navn (case-insensitive),
    //    + inkluder evt. tidligere keeper-historikk hvis du bruker det andre steder
    const allPlayers = await db.players.where('teamId').equals(teamId).toArray();
    const keeperIds = allPlayers
      .filter(p => keeperNames.includes((p.name || '').trim().toLowerCase()))
      .map(p => p.id);

    // 6) Generer plan
    const plan = generatePlan({
      playerIds: allPlayers.map(p => p.id),
      keeperIds,
      onFieldCount: onField,
      halves,
      halfLengthMin: halfLength,
      subIntervalMin: subInterval,
      keeperRarity: keeperEvery,
      keeperIntervalMin: keeperInterval,
      historyMinutes: {}, // tom ved ny kamp
    });

    // 7) Lagre plan
    await db.plans.put({
      id: matchId,
      matchId,
      windows: plan.windows,
    });

    // 8) Videre til Plan-skjermen
    nav(`/plan/${matchId}`);
  };

  return (
    <div className="max-w-md mx-auto mt-6 card">
      <h1 className="text-xl mb-4">Kampoppsett</h1>

      <form onSubmit={handleSubmit} className="space-y-3 text-slate-200">
        {/* Lag */}
        <div>
          <label className="block mb-1">Lag</label>
          <input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Mitt lag"
          />
        </div>

        {/* Spillere */}
        <div>
          <label className="block mb-1">Spillere (kommadelt eller linjer)</label>
          <textarea
            value={playersText}
            onChange={(e) => setPlayersText(e.target.value)}
            rows={3}
          />
        </div>

        {/* Preset */}
        <div>
          <label className="block mb-1">Preset (setter sport og antall på banen)</label>
          <select
            value={sport === "Fotball" && onField === 5 ? "Fotball 5er" : "Egendefinert"}
            onChange={(e) => {
              if (e.target.value === "Fotball 5er") {
                setSport("Fotball");
                setOnField(5);
              }
            }}
          >
            <option>Fotball 5er</option>
            <option>Egendefinert</option>
          </select>
        </div>

        {/* Sport */}
        <div>
          <label className="block mb-1">Sport</label>
          <select value={sport} onChange={(e) => setSport(e.target.value)}>
            <option>Fotball</option>
            <option>Håndball</option>
            <option>Basketball</option>
          </select>
        </div>

        {/* Antall på banen */}
        <div>
          <label className="block mb-1">Antall på banen</label>
          <select value={onField} onChange={(e) => setOnField(Number(e.target.value))}>
            {[3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Antall omganger */}
        <div>
          <label className="block mb-1">Antall omganger</label>
          <select value={halves} onChange={(e) => setHalves(Number(e.target.value))}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Lengde per omgang */}
        <div>
          <label className="block mb-1">Lengde per omgang (min)</label>
          <select value={halfLength} onChange={(e) => setHalfLength(Number(e.target.value))}>
            {[5, 10, 15, 20, 25, 30].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Bytteintervall */}
        <div>
          <label className="block mb-1">Bytteintervall (min)</label>
          <input
            type="number"
            value={subInterval}
            onChange={(e) => setSubInterval(Number(e.target.value))}
          />
        </div>

        {/* Keepere */}
        <div>
          <label className="block mb-1">Keeper(e) (kommadelt eller linjer)</label>
          <textarea
            value={keepersText}
            onChange={(e) => setKeepersText(e.target.value)}
            rows={1}
          />
        </div>

        {/* Keeperbytte fallback */}
        <div>
          <label className="block mb-1">Keeper byttes hvert n-te vindu (fallback)</label>
          <input
            type="number"
            value={keeperEvery}
            onChange={(e) => setKeeperEvery(Number(e.target.value))}
          />
        </div>

        {/* Keeper-intervall */}
        <div>
          <label className="block mb-1">Keeper-intervall (min) — 0 = bruk n-te vindu</label>
          <input
            type="number"
            value={keeperInterval}
            onChange={(e) => setKeeperInterval(Number(e.target.value))}
          />
        </div>

        {/* Kamper på rad */}
        <div>
          <label className="block mb-1">Antall kamper på rad</label>
          <input
            type="number"
            value={matchesInARow}
            onChange={(e) => setMatchesInARow(Number(e.target.value))}
          />
        </div>

        <button type="submit" className="btn-primary mt-4">
          Lagre og generer plan
        </button>
      </form>
    </div>
  );
}

import { useState } from 'react'
import { db, Player } from '@/db/schema'
import { presets } from '@/domain/presets'
import { nanoid } from '@/utils/nanoid'
import { useNavigate } from 'react-router-dom'

export default function SetupMatch(){
  const nav = useNavigate()
  const [teamName, setTeamName] = useState('Mitt lag')
  const [players, setPlayers] = useState<string>('Anna, Bo, Cam, Dan, Eva, Finn, Gina, Hal, Ida, Jon')
  const [preset, setPreset] = useState<keyof typeof presets>('football5')
  const [gamesInSeries, setGamesInSeries] = useState(1)

  const [keeperNames, setKeeperNames] = useState<string>('Anna')

  const create = async () => {
    const teamId = nanoid()
    await db.teams.add({ id: teamId, name: teamName, createdAt: Date.now() })
    const playerNames = players.split(',').map(s => s.trim()).filter(Boolean)
    const pIds: string[] = []
    for (const name of playerNames){
      const id = nanoid()
      pIds.push(id)
      await db.players.add({ id, teamId, name, isActive: true })
    }
    const p = presets[preset]
    const matchId = nanoid()
    await db.matches.add({
      id: matchId, teamId, sport: p.sport as any, onFieldCount: p.onFieldCount,
      halves: p.halves, halfLengthMin: p.halfLengthMin, subIntervalMin: p.subIntervalMin,
      gamesInSeries, keeperRarity: p.keeperRarity, createdAt: Date.now()
    })
    // store keeper preference in history.lastPosition for now
    const keeperSet = new Set(keeperNames.split(',').map(s=>s.trim()))
    const playersAll = await db.players.where('teamId').equals(teamId).toArray()
    for (const pl of playersAll){
      await db.history.put({ id: pl.id, playerId: pl.id, rollingMinutes: 0, lastPosition: keeperSet.has(pl.name) ? 'keeper' : undefined })
    }
    nav(`/plan/${matchId}`)
  }

  return (
    <div className="grid">
      <div className="card">
        <h2>Kampoppsett</h2>
        <div className="grid">
          <div>
            <label>Lag</label>
            <input value={teamName} onChange={e=>setTeamName(e.target.value)} />
          </div>
          <div>
            <label>Spillere (kommadelt)</label>
            <textarea rows={4} value={players} onChange={e=>setPlayers(e.target.value)} />
          </div>
          <div>
            <label>Preset</label>
            <select value={preset} onChange={e=>setPreset(e.target.value as any)}>
              <option value="football5">Fotball 5er</option>
              <option value="football7">Fotball 7er</option>
              <option value="handball">Håndball</option>
            </select>
          </div>
          <div>
            <label>Antall kamper på rad</label>
            <input type="number" value={gamesInSeries} onChange={e=>setGamesInSeries(parseInt(e.target.value||'1'))} />
          </div>
          <div>
            <label>Keeper-navn (kommadelt, sjeldnere bytte)</label>
            <input value={keeperNames} onChange={e=>setKeeperNames(e.target.value)} />
          </div>
        </div>
        <div style={{marginTop:12}}>
          <button className="btn" onClick={create}>Lagre og generer plan</button>
        </div>
      </div>
    </div>
  )
}

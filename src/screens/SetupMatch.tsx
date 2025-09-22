import { useEffect, useState } from 'react'
import { db } from '@/db/schema'
import { presets } from '@/domain/presets'
import { nanoid } from '@/utils/nanoid'
import { useNavigate } from 'react-router-dom'

export default function SetupMatch(){
  const nav = useNavigate()

  // Grunnfelt
  const [teamName, setTeamName] = useState('Mitt lag')
  const [players, setPlayers] = useState<string>('Anna, Bo, Cam, Dan, Eva, Finn, Gina, Hal, Ida, Jon')
  const [preset, setPreset] = useState<keyof typeof presets>('football5')
  const [gamesInSeries, setGamesInSeries] = useState(1)

  // Keeper-input (kommadelt)
  const [keeperNames, setKeeperNames] = useState<string>('Anna')

  // Kamp- og bytteparametre
  const [sport, setSport] = useState<'football'|'handball'|'other'>('football')
  const [onFieldCount, setOnFieldCount] = useState<number>(5)
  const [halves, setHalves] = useState<number>(2)                 // antall omganger
  const [halfLengthMin, setHalfLengthMin] = useState<number>(25)  // min per omgang
  const [subIntervalMin, setSubIntervalMin] = useState<number>(5) // bytteintervall i min

  // Keeperregler
  const [keeperRarity, setKeeperRarity] = useState<number>(2)     // hvert n-te vindu (fallback)
  const [keeperIntervalMin, setKeeperIntervalMin] = useState<number>(0) // 0 = av, >0 = hvert X. min

  // Når preset endres: fyll inn standarder
  useEffect(()=>{
    const p = presets[preset]
    setSport(p.sport as any)
    setOnFieldCount(p.onFieldCount)
    setHalves(p.halves)
    setHalfLengthMin(p.halfLengthMin)
    setSubIntervalMin(p.subIntervalMin)
    setKeeperRarity(p.keeperRarity ?? 1)
    // Behold ev. manuell keeperIntervalMin (brukerne kan ha satt den)
  }, [preset])

  // Enkel validering
  const issues: string[] = []
  if (teamName.trim().length === 0) issues.push('Lag-navn kan ikke være tomt.')
  if (players.split(',').map(s=>s.trim()).filter(Boolean).length < onFieldCount) issues.push('Du har færre spillere enn antall på banen.')
  if (halves < 1) issues.push('Antall omganger må være minst 1.')
  if (halfLengthMin < 5) issues.push('Omganger bør være minst 5 min.')
  if (subIntervalMin < 1) issues.push('Bytteintervall må være minst 1 min.')
  if (subIntervalMin > halfLengthMin) issues.push('Bytteintervall kan ikke være lengre enn en omgang.')
  if (!Number.isInteger(halfLengthMin / subIntervalMin)) issues.push('Bytteintervall bør dele omgangslengden jevnt (f.eks. 5 i 20).')
  if (keeperRarity < 1 || !Number.isInteger(keeperRarity)) issues.push('Keeper-frekvens (n-te vindu) må være et helt tall ≥ 1.')
  if (keeperIntervalMin < 0) issues.push('Keeper-intervall (min) kan ikke være negativt.')
  if (keeperIntervalMin > 0 && (keeperIntervalMin % subIntervalMin !== 0))
    issues.push('Keeper-intervall (min) bør være et multiplum av bytteintervallet (f.eks. 10 når bytte er 5).')

  const create = async () => {
    if (issues.length) {
      alert('Rett opp før du fortsetter:\n- ' + issues.join('\n- '))
      return
    }

    // Lag lag + spillere
    const teamId = nanoid()
    await db.teams.add({ id: teamId, name: teamName.trim(), createdAt: Date.now() })

    const playerNames = players.split(',').map(s => s.trim()).filter(Boolean)
    const playerIds: string[] = []
    for (const name of playerNames){
      const id = nanoid()
      playerIds.push(id)
      await db.players.add({ id, teamId, name, isActive: true })
    }

    // Lag kamp med alle parametre
    const matchId = nanoid()
    await db.matches.add({
      id: matchId,
      teamId,
      sport,
      onFieldCount,
      halves,
      halfLengthMin,
      subIntervalMin,
      gamesInSeries,
      keeperRarity,
      keeperIntervalMin, // viktig: lagres i DB
      keeperNamesRaw: keeperNames,
      createdAt: Date.now()
    })

    // Merk keepere i history (CASE-INSENSITIV sammenligning)
    const keeperSetLC = new Set(
      keeperNames
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => s.toLowerCase())
    )
    const allPlayers = await db.players.where('teamId').equals(teamId).toArray()
    for (const pl of allPlayers){
      const isKeeper = keeperSetLC.has(pl.name.toLowerCase())
      await db.history.put({
        id: pl.id,
        playerId: pl.id,
        rollingMinutes: 0,
        lastPosition: isKeeper ? 'keeper' : undefined
      })
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
            <label>Sport</label>
            <select value={sport} onChange={e=>setSport(e.target.value as any)}>
              <option value="football">Fotball</option>
              <option value="handball">Håndball</option>
              <option value="other">Annet</option>
            </select>
          </div>

          <div>
            <label>Antall på banen</label>
            <input type="number" value={onFieldCount} onChange={e=>setOnFieldCount(parseInt(e.target.value||'0'))} />
          </div>

          <div>
            <label>Antall omganger</label>
            <input type="number" value={halves} onChange={e=>setHalves(parseInt(e.target.value||'0'))} />
          </div>

          <div>
            <label>Lengde per omgang (min)</label>
            <input type="number" value={halfLengthMin} onChange={e=>setHalfLengthMin(parseInt(e.target.value||'0'))} />
          </div>

          <div>
            <label>Bytteintervall (min)</label>
            <input type="number" value={subIntervalMin} onChange={e=>setSubIntervalMin(parseInt(e.target.value||'0'))} />
          </div>

          <div>
            <label>Keeper byttes hvert n-te vindu (1=hver gang, 2=annet hvert …)</label>
            <input type="number" value={keeperRarity} onChange={e=>setKeeperRarity(parseInt(e.target.value||'1'))} />
          </div>

          <div>
            <label>Keeper-intervall (min) — 0 = bruk n-te vindu</label>
            <input
              type="number"
              value={keeperIntervalMin}
              onChange={e=>setKeeperIntervalMin(parseInt(e.target.value || '0'))}
            />
            <div className="muted">Eks: 10 → keeper vurderes for bytte på 10, 20, 30 …</div>
          </div>

          <div>
            <label>Keeper-navn (kommadelt)</label>
            <input value={keeperNames} onChange={e=>setKeeperNames(e.target.value)} />
          </div>

          <div>
            <label>Antall kamper på rad</label>
            <input type="number" value={gamesInSeries} onChange={e=>setGamesInSeries(parseInt(e.target.value||'1'))} />
          </div>
        </div>

        {issues.length > 0 && (
          <div className="card" style={{marginTop:12, borderColor:'#b45309', background:'#1f2937'}}>
            <strong>Kontroller følgende:</strong>
            <ul className="list">
              {issues.map((msg, i)=>(<li key={i}>• {msg}</li>))}
            </ul>
          </div>
        )}

        <div style={{marginTop:12}}>
          <button className="btn" onClick={create} disabled={issues.length>0}>Lagre og generer plan</button>
        </div>
      </div>
    </div>
  )
}

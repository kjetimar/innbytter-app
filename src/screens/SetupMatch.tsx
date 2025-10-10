import { useEffect, useMemo, useState } from 'react'
import { db } from '@/db/schema'
import { presets } from '@/domain/presets'
import { nanoid } from '@/utils/nanoid'
import { useNavigate } from 'react-router-dom'

const LENGTH_CHOICES = [5,10,15,20,25]
const HALVES_CHOICES = [1,2,3,4]
const ONFIELD_CHOICES = [4,5,6,7]

export default function SetupMatch(){
  const nav = useNavigate()

  // Grunn
  const [teamName, setTeamName] = useState('Mitt lag')
  const [playersText, setPlayersText] = useState('Anna, Bo, Cam, Dan, Eva, Finn, Gina, Hal, Ida, Jon')
  const playersList = useMemo(
    () => playersText.split(/[,\n;]+/).map(s=>s.trim()).filter(Boolean),
    [playersText]
  )

  // Preset
  const [preset, setPreset] = useState<keyof typeof presets>('football5')
  const [sport, setSport] = useState<'football'|'handball'|'other'>('football')

  // Antall på banen (dropdown + “Annet”)
  const [onFieldChoice, setOnFieldChoice] = useState<number | 'OTHER'>(5)
  const [onFieldOther, setOnFieldOther] = useState<number>(5)
  const onFieldCount = onFieldChoice === 'OTHER' ? onFieldOther : onFieldChoice

  // Omganger (dropdown + “Annet”)
  const [halvesChoice, setHalvesChoice] = useState<number | 'OTHER'>(2)
  const [halvesOther, setHalvesOther] = useState<number>(2)
  const halves = halvesChoice === 'OTHER' ? halvesOther : halvesChoice

  // Lengde per omgang (dropdown + “Annet”)
  const [halfLenChoice, setHalfLenChoice] = useState<number | 'OTHER'>(20)
  const [halfLenOther, setHalfLenOther] = useState<number>(20)
  const halfLengthMin = halfLenChoice === 'OTHER' ? halfLenOther : halfLenChoice

  // Bytteintervall
  const [subIntervalMin, setSubIntervalMin] = useState(5)

  // Keeper: velges fra spillere (multi-select)
  const [keeperNames, setKeeperNames] = useState<string[]> (['Anna'])

  // Keeper-regler
  const [keeperRarity, setKeeperRarity] = useState(2)           // fallback: hvert n-te vindu
  const [keeperIntervalMin, setKeeperIntervalMin] = useState(10)// minutter: 0 = av

  // Antall kamper på rad (bugfix: heltall, ikke “11/12 etter 1”)
  const [gamesInSeries, setGamesInSeries] = useState(1)

  // Preset autofyll
  useEffect(()=>{
    const p = presets[preset]
    setSport(p.sport as any)
    setOnFieldChoice(ONFIELD_CHOICES.includes(p.onFieldCount) ? p.onFieldCount : 'OTHER')
    setOnFieldOther(p.onFieldCount)
    setHalvesChoice(HALVES_CHOICES.includes(p.halves) ? p.halves : 'OTHER')
    setHalvesOther(p.halves)
    setHalfLenChoice(LENGTH_CHOICES.includes(p.halfLengthMin) ? p.halfLengthMin : 'OTHER')
    setHalfLenOther(p.halfLengthMin)
    setSubIntervalMin(p.subIntervalMin)
    setKeeperRarity(p.keeperRarity ?? 1)
  },[preset])

  // Validering
  const issues: string[] = []
  if (!teamName.trim()) issues.push('Lag-navn kan ikke være tomt.')
  if (playersList.length < onFieldCount) issues.push('Du har færre spillere enn antall på banen.')
  if (halves < 1) issues.push('Antall omganger må være minst 1.')
  if (halfLengthMin < 5) issues.push('Omganger bør være minst 5 min.')
  if (subIntervalMin < 1) issues.push('Bytteintervall må være minst 1 min.')
  if (subIntervalMin > halfLengthMin) issues.push('Bytteintervall kan ikke være lengre enn en omgang.')
  if (!Number.isInteger(halfLengthMin / subIntervalMin)) issues.push('Bytteintervall bør dele omgangslengden jevnt.')
  if (keeperIntervalMin < 0) issues.push('Keeper-intervall (min) kan ikke være negativt.')
  if (keeperIntervalMin > 0 && (keeperIntervalMin % subIntervalMin !== 0)) issues.push('Keeper-intervall bør være multiplum av bytteintervall.')
  if (!Number.isInteger(gamesInSeries) || gamesInSeries < 1) issues.push('Antall kamper må være et heltall ≥ 1.')

  const create = async () => {
    if (issues.length) { alert('Rett opp:\n- ' + issues.join('\n- ')); return }

    // Lag nivå
    const teamId = nanoid()
    await db.teams.add({ id: teamId, name: teamName.trim(), createdAt: Date.now() })

    // Spillere
    const pids: string[] = []
    for (const name of playersList){
      const id = nanoid()
      pids.push(id)
      await db.players.add({ id, teamId, name, isActive: true })
    }

    // Kamp
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
      keeperIntervalMin,
      keeperNamesRaw: keeperNames.join(', '),
      createdAt: Date.now()
    })

    // History: markér keepere (case-insensitivt)
    const keeperSetLC = new Set(keeperNames.map(n => n.toLowerCase()))
    const all = await db.players.where('teamId').equals(teamId).toArray()
    for (const pl of all){
      await db.history.put({
        id: pl.id,
        playerId: pl.id,
        rollingMinutes: 0,
        lastPosition: keeperSetLC.has(pl.name.toLowerCase()) ? 'keeper' : undefined
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
            <label>Spillere (kommadelt eller linjer)</label>
            <textarea rows={4} value={playersText} onChange={e=>setPlayersText(e.target.value)} />
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
            <div style={{display:'flex', gap:8}}>
              <select
                value={onFieldChoice as any}
                onChange={e=>setOnFieldChoice((e.target.value==='OTHER'?'OTHER':parseInt(e.target.value)) as any)}
              >
                {ONFIELD_CHOICES.map(v=><option key={v} value={v}>{v}</option>)}
                <option value="OTHER">Annet…</option>
              </select>
              {onFieldChoice==='OTHER' && (
                <input type="number" value={onFieldOther} onChange={e=>setOnFieldOther(parseInt(e.target.value||'0'))} />
              )}
            </div>
          </div>

          <div>
            <label>Antall omganger</label>
            <div style={{display:'flex', gap:8}}>
              <select
                value={halvesChoice as any}
                onChange={e=>setHalvesChoice((e.target.value==='OTHER'?'OTHER':parseInt(e.target.value)) as any)}
              >
                {HALVES_CHOICES.map(v=><option key={v} value={v}>{v}</option>)}
                <option value="OTHER">Annet…</option>
              </select>
              {halvesChoice==='OTHER' && (
                <input type="number" value={halvesOther} onChange={e=>setHalvesOther(parseInt(e.target.value||'0'))} />
              )}
            </div>
          </div>

          <div>
            <label>Lengde per omgang (min)</label>
            <div style={{display:'flex', gap:8}}>
              <select
                value={halfLenChoice as any}
                onChange={e=>setHalfLenChoice((e.target.value==='OTHER'?'OTHER':parseInt(e.target.value)) as any)}
              >
                {LENGTH_CHOICES.map(v=><option key={v} value={v}>{v}</option>)}
                <option value="OTHER">Annet…</option>
              </select>
              {halfLenChoice==='OTHER' && (
                <input type="number" value={halfLenOther} onChange={e=>setHalfLenOther(parseInt(e.target.value||'0'))} />
              )}
            </div>
          </div>

          <div>
            <label>Bytteintervall (min)</label>
            <input type="number" value={subIntervalMin} onChange={e=>setSubIntervalMin(parseInt(e.target.value||'0'))} />
          </div>

          <div>
            <label>Keeper(e)</label>
            <select
              multiple
              size={Math.min(6, Math.max(3, playersList.length))}
              value={keeperNames}
              onChange={e=>{
                const opts = Array.from(e.target.selectedOptions).map(o=>o.value)
                setKeeperNames(opts)
              }}
            >
              {playersList.map(n=> <option key={n} value={n}>{n}</option>)}
            </select>
            <div className="muted">Hold Ctrl/⌘ for å velge flere.</div>
          </div>

          <div>
            <label>Keeper byttes hvert n-te vindu (fallback)</label>
            <input type="number" value={keeperRarity} onChange={e=>setKeeperRarity(parseInt(e.target.value||'1'))} />
          </div>

          <div>
            <label>Keeper-intervall (min) — 0 = bruk n-te vindu</label>
            <input type="number" value={keeperIntervalMin} onChange={e=>setKeeperIntervalMin(parseInt(e.target.value||'0'))} />
          </div>

          <div>
            <label>Antall kamper på rad</label>
            <input
              type="number"
              inputMode="numeric"
              value={gamesInSeries}
              onChange={e=>setGamesInSeries(parseInt(e.target.value || '1'))}
            />
          </div>
        </div>

        {issues.length>0 && (
          <div className="card" style={{marginTop:12, borderColor:'#b45309', background:'#1f2937'}}>
            <strong>Kontroller følgende:</strong>
            <ul className="list">{issues.map((m,i)=><li key={i}>• {m}</li>)}</ul>
          </div>
        )}

        <div style={{marginTop:12}}>
          <button className="btn" onClick={create} disabled={issues.length>0}>Lagre og generer plan</button>
        </div>
      </div>
    </div>
  )
}

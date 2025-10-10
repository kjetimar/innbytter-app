// src/screens/LiveView.tsx
import { useEffect, useMemo, useState } from 'react'
import { db } from '@/db/schema'
import { useParams, useNavigate } from 'react-router-dom'
import { useTimer } from '@/hooks/useTimer'

type ViewTab = 'lineup' | 'plan'

export default function LiveView() {
  const { matchId } = useParams()
  const nav = useNavigate()

  // klokke
  const { sec, running, start, pause, reset } = useTimer(0)

  // data
  const [match, setMatch] = useState<any>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [plan, setPlan] = useState<any>(null)
  const [keeperIds, setKeeperIds] = useState<string[]>([])
  const [windowIdx, setWindowIdx] = useState(0)

  // score
  const [ourScore, setOurScore] = useState(0)
  const [oppScore, setOppScore] = useState(0)

  // live-tilstand
  const [lineup, setLineup] = useState<string[]>([])
  const [disabledIds, setDisabledIds] = useState<string[]>([])
  const [tab, setTab] = useState<ViewTab>('lineup')

  // init: last kamp, spillere, plan, keeper-IDs
  useEffect(() => {
    (async () => {
      const m = await db.matches.get(matchId!)
      if (!m) return
      setMatch(m)

      const ps = await db.players.where('teamId').equals(m.teamId).toArray()
      setPlayers(ps)

      const hist = await db.history.where('playerId').anyOf(ps.map(p => p.id)).toArray()
      const fromHistory = hist.filter(h => h.lastPosition === 'keeper').map(h => h.playerId)

      const namesLC = (m.keeperNamesRaw ?? '')
        .split(/[,\n;]+/)
        .map((s: string) => s.trim().toLowerCase())
        .filter(Boolean)
      const fromNames = ps
        .filter(p => namesLC.includes((p.name || '').trim().toLowerCase()))
        .map(p => p.id)

      setKeeperIds(Array.from(new Set([...fromHistory, ...fromNames])))

      const pl = await db.plans.get(matchId!)
      setPlan(pl)
    })()
  }, [matchId])

  // helpers
  const nameOf = (id: string) => players.find(p => p.id === id)?.name || ''

  // +1 spiller for hver 4 mål under (4, 8, 12 …)
  const extraPlayers = useMemo(() => {
    const diff = oppScore - ourScore
    return diff > 0 ? Math.floor(diff / 4) : 0
  }, [ourScore, oppScore])

  const effectiveOnFieldCount = useMemo(() => {
    if (!match) return 0
    return match.onFieldCount + extraPlayers
  }, [match, extraPlayers])

  // keeper-vindu
  const isKeeperMinute = (min: number) => {
    if (!match) return false
    if (match.keeperIntervalMin && match.keeperIntervalMin > 0) return (min % match.keeperIntervalMin) === 0
    if (match.keeperRarity && match.keeperRarity > 0) {
      const winIdx = Math.floor(min / match.subIntervalMin) - 1
      return winIdx >= 0 && (winIdx % match.keeperRarity) === (match.keeperRarity - 1)
    }
    return false
  }

  // startoppsett
  const computeStartLineup = (onField: number) => {
    const active: string[] = []
    const k = keeperIds.find(id => players.some(p => p.id === id))
    if (k) active.push(k)
    for (const p of players) {
      if (active.length >= onField) break
      if (!active.includes(p.id)) active.push(p.id)
    }
    return active.slice(0, onField)
  }

  // fyll/sikring
  const ensureKeeperAndFill = (activeIn: string[], onField: number, forceKeeper: boolean, disabledList: string[]) => {
    let active = activeIn.filter(id => !disabledList.includes(id))

    if (forceKeeper && keeperIds.length > 0) {
      const hasKeeper = active.some(id => keeperIds.includes(id))
      if (!hasKeeper) {
        const benchKeeper = players
          .map(p => p.id)
          .find(id => keeperIds.includes(id) && !active.includes(id) && !disabledList.includes(id))
        if (benchKeeper) {
          if (active.length >= onField) {
            const replaceIdx = [...active].reverse().findIndex(id => !keeperIds.includes(id))
            const realIdx = replaceIdx === -1 ? active.length - 1 : active.length - 1 - replaceIdx
            active[realIdx] = benchKeeper
          } else {
            active.push(benchKeeper)
          }
        }
      }
    }

    if (active.length < onField) {
      const bench = players.map(p => p.id).filter(id => !active.includes(id) && !disabledList.includes(id))
      for (const id of bench) {
        active.push(id)
        if (active.length >= onField) break
      }
    }
    return active.slice(0, onField)
  }

  // nåværende vindu fra klokke
  useEffect(() => {
    if (!match || !plan) return
    const minutes = Math.floor(sec / 60)
    const idx = plan.windows.findIndex((w: any) => w.minute > minutes)
    setWindowIdx(idx === -1 ? Math.max(0, plan.windows.length - 1) : idx)
  }, [sec, match, plan])

  // simuler lineup frem til nå
  useEffect(() => {
    if (!match || !plan || players.length === 0) return
    let active: string[] = computeStartLineup(effectiveOnFieldCount)
    for (let i = 0; i <= windowIdx && i < plan.windows.length; i++) {
      const w = plan.windows[i]
      active = active.filter(id => !w.outs.includes(id))
      for (const id of w.ins) if (!active.includes(id)) active.push(id)
      active = ensureKeeperAndFill(active, effectiveOnFieldCount, isKeeperMinute(w.minute), disabledIds)
    }
    active = ensureKeeperAndFill(active, effectiveOnFieldCount, false, disabledIds)
    setLineup(active)
  }, [match, plan, players, windowIdx, disabledIds, effectiveOnFieldCount, keeperIds])

  // manuelle bytter
  const [manualIn, setManualIn] = useState<string>('')
  const [manualOut, setManualOut] = useState<string>('')

  const benchIds = useMemo(() => {
    const allIds = players.map(p => p.id)
    return allIds.filter(id => !lineup.includes(id) && !disabledIds.includes(id))
  }, [players, lineup, disabledIds])

  const handleManualSwap = () => {
    if (!manualIn || !manualOut) return
    setLineup(prev => {
      let next = prev.filter(id => id !== manualOut)
      if (!next.includes(manualIn)) next.push(manualIn)
      next = ensureKeeperAndFill(next, effectiveOnFieldCount, false, disabledIds)
      return next
    })
    setManualIn(''); setManualOut('')
  }

  // skade/deaktiver → umiddelbar erstatning hvis på banen
  const toggleDisabled = (id: string) => {
    const disabling = !disabledIds.includes(id)
    const updatedDisabled = disabling
      ? [...disabledIds, id]
      : disabledIds.filter(x => x !== id)

    setDisabledIds(updatedDisabled)

    if (disabling && lineup.includes(id)) {
      let next = lineup.filter(x => x !== id)
      const bench = players.map(p => p.id).filter(pid => !next.includes(pid) && !updatedDisabled.includes(pid))
      if (bench.length > 0) next.push(bench[0])
      next = ensureKeeperAndFill(next, effectiveOnFieldCount, false, updatedDisabled)
      setLineup(next)
    }
  }

  // visningshjelp
  const splitKeeper = (ids: string[]) => {
    const k = ids.find(id => keeperIds.includes(id))
    const fielders = ids.filter(id => id !== k)
    return { keeper: k, fielders }
  }
  const nextWindow = plan?.windows?.[windowIdx]
  const { keeper, fielders } = splitKeeper(lineup)

  if (!match || !plan) {
    return (
      <div className="max-w-md mx-auto p-5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-200">Laster…</div>
      </div>
    )
  }

  // status-tekst
  const keeperText =
    match.keeperIntervalMin && match.keeperIntervalMin > 0
      ? `keeper hvert ${match.keeperIntervalMin}. min`
      : match.keeperRarity
      ? `keeper hvert ${match.keeperRarity}. vindu`
      : 'keeper uten særskilt frekvens'

  return (
    <div className="max-w-md mx-auto px-3 mt-4 pb-28">
      {/* Topp: tid/score/status */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-2xl font-semibold text-slate-100">
            {String(Math.floor(sec/60)).padStart(2,'0')}:{String(Math.floor(sec%60)).padStart(2,'0')}
          </div>
          <div className="text-lg text-slate-100">
            Oss {ourScore} – {oppScore} Motstander
          </div>
        </div>

        <div className="mt-3 flex gap-2 flex-wrap">
          {!running
            ? <button className="btn-primary" onClick={start}>Start</button>
            : <button className="px-4 h-12 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700" onClick={pause}>Pause</button>}
          <button className="px-4 h-12 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700" onClick={reset}>Nullstill</button>
        </div>

        <div className="mt-3 text-sm text-slate-300">
          <div>Bytte hver <b>{match.subIntervalMin}</b> min · {keeperText}</div>
          <div className="mt-1">
            Neste bytte: <b>T={nextWindow?.minute}:00</b> · På banen: <b>{effectiveOnFieldCount}</b>
            {extraPlayers > 0 && (
              <span className="ml-2 text-blue-300">(+{extraPlayers} pga. måldiff {oppScore-ourScore})</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-3 flex gap-2">
        <button
          className={`px-3 h-10 rounded-xl border ${tab==='lineup' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-900 text-slate-200 border-slate-800'}`}
          onClick={()=>setTab('lineup')}
        >Spillere på banen</button>
        <button
          className={`px-3 h-10 rounded-xl border ${tab==='plan' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-900 text-slate-200 border-slate-800'}`}
          onClick={()=>setTab('plan')}
        >Bytteplan</button>
      </div>

      {/* Innhold */}
      {tab === 'lineup' ? (
        <div className="mt-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="text-slate-300">
              <div className="font-medium mb-2">Line-up nå ({effectiveOnFieldCount} på banen)</div>
              {keeper && <div className="mb-1"><span className="text-slate-400">Keeper:</span> {nameOf(keeper)}</div>}
              <div><span className="text-slate-400">Utespillere:</span> {fielders.map(id=>nameOf(id)).filter(Boolean).join(', ') || '—'}</div>
            </div>
          </div>

          {/* Manuelt bytte */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mt-3">
            <div className="text-slate-200 font-medium">Manuelt bytte</div>
            <div className="mt-2 flex flex-wrap gap-2 items-center">
              <span className="text-slate-400">UT:</span>
              <select value={manualOut} onChange={e=>setManualOut(e.target.value)} className="min-w-[160px]">
                <option value="">— velg —</option>
                {lineup.map(id => <option key={id} value={id}>{nameOf(id)}</option>)}
              </select>
              <span className="text-slate-400">INN:</span>
              <select value={manualIn} onChange={e=>setManualIn(e.target.value)} className="min-w-[160px]">
                <option value="">— velg —</option>
                {benchIds.map(id => <option key={id} value={id}>{nameOf(id)}</option>)}
              </select>
              <button className="btn-primary" onClick={handleManualSwap} disabled={!manualIn || !manualOut}>Utfør</button>
            </div>

            {/* Skade/deaktiver */}
            <div className="mt-3">
              <div className="text-slate-200 font-medium mb-2">Deaktiver spillere (skade)</div>
              <div className="flex flex-wrap gap-3">
                {players.map(p => (
                  <label key={p.id} className="flex items-center gap-2 text-slate-200">
                    <input type="checkbox" checked={disabledIds.includes(p.id)} onChange={()=>toggleDisabled(p.id)} />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-slate-400">Neste vindu: <b>T={nextWindow?.minute}:00</b></div>
          <div className="mt-2 text-slate-300">
            <div><span className="text-slate-400">INN:</span> {nextWindow?.ins.map((id:string)=>nameOf(id)).filter(Boolean).join(', ') || '—'}</div>
            <div><span className="text-slate-400">UT:</span> {nextWindow?.outs.map((id:string)=>nameOf(id)).filter(Boolean).join(', ') || '—'}</div>
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn-primary" onClick={()=>setWindowIdx(i=>Math.min(i+1, plan.windows.length-1))}>Bytt nå</button>
            <button className="px-4 h-12 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700" onClick={()=>setWindowIdx(i=>Math.max(0, i-1))}>Tilbake</button>
          </div>
        </div>
      )}

      {/* Bunnknapper – alltid synlige */}
      <div className="fixed bottom-0 left-0 right-0 z-20">
        <div className="mx-auto max-w-md px-3 pb-4">
          <div className="bg-slate-900/95 border border-slate-800 rounded-2xl shadow-lg p-2 flex gap-2">
            <button className="btn-primary flex-1" onClick={()=>setWindowIdx(i=>Math.min(i+1, plan.windows.length-1))}>Bytt nå</button>
            <button className="px-4 h-12 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 flex-1" onClick={()=>setOurScore(s=>s+1)}>+ Mål oss</button>
            <button className="px-4 h-12 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 flex-1" onClick={()=>setOppScore(s=>s+1)}>+ Mål motstander</button>
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-400 px-1">
            <span>Live · {match.sport}</span>
            <button className="underline" onClick={()=>nav(`/summary/${matchId}`)}>Avslutt kamp</button>
          </div>
        </div>
      </div>
    </div>
  )
}

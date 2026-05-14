import React, { useState, useEffect } from 'react'
import { PARTS, PART_COLORS, S, THEME, getWeekNum, weekLabels, calcPRs, BIG4_EXERCISES, loadBig4PRs, saveBig4PR } from './utils'

export default function WorkoutStats({
  allLogs,
  memberId,
  bigPrTable = 'personal_records',
  bigPrIdField = 'member_id',
}) {
  const [statsTab, setStatsTab] = useState('daily')
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1)
  const [selectedDate, setSelectedDate] = useState(todayStr)

  // ─── 4대 종목 PR 상태 ───
  const [big4State, setBig4State] = useState({})
  const [big4Loading, setBig4Loading] = useState(false)
  const [big4Draft, setBig4Draft] = useState({})

  useEffect(() => {
    if (statsTab === 'pr' && memberId) {
      reloadBig4()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsTab, memberId, bigPrTable, bigPrIdField])

  const reloadBig4 = async () => {
    if (!memberId) return
    setBig4Loading(true)
    const data = await loadBig4PRs(memberId, bigPrTable, bigPrIdField)
    setBig4State(data)
    const draft = {}
    BIG4_EXERCISES.forEach(({ key }) => {
      draft[key] = {
        weight: data[key]?.weight != null ? String(data[key].weight) : '',
        reps: data[key]?.reps != null ? String(data[key].reps) : '',
      }
    })
    setBig4Draft(draft)
    setBig4Loading(false)
  }

  const handleBig4Change = (key, field, value) => {
    setBig4Draft(prev => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [field]: value }
    }))
  }

  const handleBig4Save = async (key) => {
    if (!memberId) return
    const draft = big4Draft[key] || {}
    if (draft.weight === '' && draft.reps === '') return
    const result = await saveBig4PR(memberId, key, draft.weight, draft.reps, bigPrTable, bigPrIdField)
    if (!result.success) {
      alert('저장 실패: ' + result.error)
      return
    }
    await reloadBig4()
  }

  // 3대 중량 합계 (스쿼트 + 데드리프트 + 벤치)
  const big3Total = ['squat', 'deadlift', 'bench'].reduce((sum, key) => {
    const w = parseFloat(big4State[key]?.weight)
    return sum + (isNaN(w) ? 0 : w)
  }, 0)
  const squatW = big4State.squat?.weight ?? '—'
  const deadliftW = big4State.deadlift?.weight ?? '—'
  const benchW = big4State.bench?.weight ?? '—'

  const yearStr = String(viewYear)
  const monthStr = String(viewMonth).padStart(2, '0')
  const monthLogs = allLogs.filter(r => r.log_date && r.log_date.startsWith(`${yearStr}-${monthStr}`))

  const byDay = {}
  monthLogs.forEach(row => {
    if (!byDay[row.log_date]) byDay[row.log_date] = { total: 0, parts: {} }
    byDay[row.log_date].total += row.volume || 0
    if (row.body_part) byDay[row.log_date].parts[row.body_part] = (byDay[row.log_date].parts[row.body_part] || 0) + (row.volume || 0)
  })

  // 부위별 → 그 부위에 운동한 날짜·볼륨 리스트 (이번 달 한정, 최신 순)
  const byPart = {}
  PARTS.forEach(p => { byPart[p] = { dates: [], total: 0 } })
  Object.entries(byDay).forEach(([date, d]) => {
    Object.entries(d.parts).forEach(([part, vol]) => {
      if (vol > 0 && byPart[part]) {
        byPart[part].dates.push({ date, vol })
        byPart[part].total += vol
      }
    })
  })
  Object.values(byPart).forEach(p => p.dates.sort((a, b) => b.date.localeCompare(a.date)))
  const activePartsThisMonth = PARTS.filter(p => byPart[p].total > 0).sort((a, b) => byPart[b].total - byPart[a].total)

  const weeklyByPart = Array.from({ length: 5 }, () => { const o = {}; PARTS.forEach(p => o[p] = 0); return o })
  const weeklyTotals = [0, 0, 0, 0, 0]
  monthLogs.forEach(row => {
    const wk = getWeekNum(row.log_date)
    if (row.body_part) weeklyByPart[wk][row.body_part] = (weeklyByPart[wk][row.body_part] || 0) + (row.volume || 0)
    weeklyTotals[wk] += row.volume || 0
  })

  const monthlyByMonth = {}
  for (let m = 1; m <= 12; m++) {
    const mStr = String(m).padStart(2, '0')
    monthlyByMonth[mStr] = { total: 0, parts: {} }
    PARTS.forEach(p => monthlyByMonth[mStr].parts[p] = 0)
  }
  allLogs.filter(r => r.log_date && r.log_date.startsWith(yearStr)).forEach(row => {
    const mStr = row.log_date.split('-')[1]
    monthlyByMonth[mStr].total += row.volume || 0
    if (row.body_part) monthlyByMonth[mStr].parts[row.body_part] = (monthlyByMonth[mStr].parts[row.body_part] || 0) + (row.volume || 0)
  })

  const todayTotal = (allLogs.filter(r => r.log_date === todayStr)).reduce((sum, r) => sum + (r.volume || 0), 0)
  const thisWeekStart = new Date(today); thisWeekStart.setDate(today.getDate() - today.getDay() + 1)
  const thisWeekTotal = allLogs.filter(r => r.log_date >= thisWeekStart.toISOString().split('T')[0] && r.log_date <= todayStr).reduce((sum, r) => sum + (r.volume || 0), 0)
  const thisMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const thisMonthTotal = allLogs.filter(r => r.log_date && r.log_date.startsWith(thisMonthStr)).reduce((sum, r) => sum + (r.volume || 0), 0)
  const maxMonthVol = Math.max(...Object.values(monthlyByMonth).map(m => m.total), 1)
  const maxWeekVol = Math.max(...weeklyTotals, 1)

  const yearOptions = []
  for (let y = today.getFullYear(); y >= today.getFullYear() - 3; y--) yearOptions.push(y)

  const formatVol = (v) => (v || 0).toLocaleString() + 'kg'

  const firstDayOfWeek = new Date(viewYear, viewMonth - 1, 1).getDay()
  const lastDate = new Date(viewYear, viewMonth, 0).getDate()

  const calendarCells = []
  for (let i = 0; i < firstDayOfWeek; i++) calendarCells.push(null)
  for (let d = 1; d <= lastDate; d++) {
    const dateStr = `${yearStr}-${monthStr}-${String(d).padStart(2, '0')}`
    calendarCells.push({
      day: d,
      dateStr,
      data: byDay[dateStr] || null,
    })
  }
  while (calendarCells.length % 7 !== 0) calendarCells.push(null)

  const weekdayKor = ['일', '월', '화', '수', '목', '금', '토']

  const prs = calcPRs(allLogs)

  const YearMonthPicker = () => (
    <div style={{ display: 'flex', gap: '6px' }}>
      <select value={viewYear} onChange={e => setViewYear(parseInt(e.target.value))} style={{ padding: '5px 9px', borderRadius: '6px', border: 'none', background: THEME.borderLight, fontSize: '11px', color: THEME.text, fontFamily: 'inherit', outline: 'none' }}>
        {yearOptions.map(y => <option key={y} value={y}>{y}년</option>)}
      </select>
      {statsTab !== 'monthly' && statsTab !== 'pr' && (
        <select value={viewMonth} onChange={e => setViewMonth(parseInt(e.target.value))} style={{ padding: '5px 9px', borderRadius: '6px', border: 'none', background: THEME.borderLight, fontSize: '11px', color: THEME.text, fontFamily: 'inherit', outline: 'none' }}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
        </select>
      )}
    </div>
  )

  const big4Input = {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    fontSize: '20px',
    fontWeight: '500',
    color: THEME.primaryDark,
    width: '50px',
    padding: 0,
    fontFamily: 'inherit',
    textAlign: 'right',
  }
  const big4InputReps = { ...big4Input, width: '32px' }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
        {[
          { label: '오늘', val: todayTotal, color: THEME.nutCarbsDark },
          { label: '이번 주', val: thisWeekTotal, color: THEME.primary },
          { label: '이번 달', val: thisMonthTotal, color: THEME.nutFatText },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: '#FFF', borderRadius: '12px', padding: '11px', textAlign: 'center' }}>
            <p style={{ fontSize: '10px', color: THEME.textSub, margin: '0 0 4px' }}>{label}</p>
            <p style={{ fontSize: '15px', fontWeight: '500', color, margin: 0 }}>
              {formatVol(val)}
            </p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px', marginBottom: '10px' }}>
        {['daily', 'weekly', 'monthly', 'pr'].map((t, i) => {
          const active = statsTab === t
          return (
            <button key={t} style={{
              padding: '8px 4px',
              borderRadius: '8px',
              border: 'none',
              background: active ? THEME.primaryAccent : '#FFF',
              color: active ? THEME.primaryDark : THEME.textSub,
              fontSize: '11px',
              fontWeight: active ? '500' : '400',
              cursor: 'pointer'
            }} onClick={() => setStatsTab(t)}>
              {['일간', '주간', '월간', 'PR'][i]}
            </button>
          )
        })}
      </div>

      {statsTab === 'daily' && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ ...S.cardTitle, margin: 0 }}>{viewYear}년 {viewMonth}월</p>
            <YearMonthPicker />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
            {weekdayKor.map((w, i) => (
              <span key={w} style={{
                fontSize: '10px',
                textAlign: 'center',
                padding: '2px 0',
                color: i === 0 ? THEME.danger : (i === 6 ? THEME.nutCarbsDark : THEME.textHint)
              }}>{w}</span>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {calendarCells.map((cell, idx) => {
              if (!cell) return <div key={`empty-${idx}`} />

              const { day, dateStr, data } = cell
              const isToday = dateStr === todayStr
              const isSelected = dateStr === selectedDate
              const hasWorkout = !!data
              const weekday = new Date(dateStr).getDay()
              const activeParts = data ? Object.entries(data.parts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]) : []

              let bg, numColor, volColor
              if (isSelected) {
                bg = THEME.primary
                numColor = '#FFF'
                volColor = '#FFF'
              } else if (hasWorkout) {
                bg = THEME.primaryLight
                numColor = THEME.primaryDark
                volColor = THEME.primary
              } else {
                bg = THEME.cardAlt
                numColor = weekday === 0 ? THEME.danger : THEME.textHint
                volColor = THEME.textHint
              }

              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  style={{
                    aspectRatio: '1',
                    borderRadius: '8px',
                    background: bg,
                    border: !isSelected && isToday ? `1.2px solid ${THEME.primary}` : '0.5px solid transparent',
                    padding: '4px 4px 3px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxSizing: 'border-box',
                    minWidth: 0,
                  }}
                >
                  <span style={{
                    fontSize: '11px',
                    color: numColor,
                    fontWeight: '500',
                    lineHeight: 1,
                    textAlign: 'left'
                  }}>{day}</span>

                  {hasWorkout && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginTop: 'auto', minWidth: 0, alignSelf: 'stretch' }}>
                      {activeParts.slice(0, 2).map(([part]) => (
                        <div key={part} style={{ display: 'flex', alignItems: 'center', gap: '2px', minWidth: 0 }}>
                          <span style={{
                            width: '4px',
                            height: '4px',
                            borderRadius: '50%',
                            background: isSelected ? '#FFF' : PART_COLORS[part],
                            flexShrink: 0,
                          }} />
                          <span style={{
                            fontSize: '8px',
                            color: isSelected ? '#FFF' : volColor,
                            fontWeight: '500',
                            lineHeight: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            minWidth: 0,
                          }}>{part}</span>
                        </div>
                      ))}
                      {activeParts.length > 2 && (
                        <span style={{
                          fontSize: '7px',
                          color: isSelected ? '#FFF' : THEME.textHint,
                          lineHeight: 1,
                        }}>+{activeParts.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px 10px',
            marginTop: '12px',
            padding: '8px 10px',
            background: THEME.cardAlt,
            borderRadius: '8px',
          }}>
            {PARTS.map(part => (
              <div key={part} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: PART_COLORS[part] }} />
                <span style={{ fontSize: '10px', color: THEME.textSub }}>{part}</span>
              </div>
            ))}
          </div>

          {/* 부위별 → 날짜별 볼륨 리스트 (이번 달) */}
          {activePartsThisMonth.length === 0 ? (
            <p style={{ fontSize: '11px', color: THEME.textHint, margin: '14px 0 0', textAlign: 'center' }}>
              이번 달 운동 기록이 없습니다
            </p>
          ) : (
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activePartsThisMonth.map(part => {
                const { dates, total } = byPart[part]
                const partMax = Math.max(...dates.map(d => d.vol), 1)
                return (
                  <div key={part} style={{
                    background: THEME.cardAlt,
                    borderRadius: '12px',
                    padding: '10px 12px',
                    border: `0.5px solid ${THEME.border}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                      <span style={{
                        fontSize: '11px',
                        color: '#FFF',
                        background: PART_COLORS[part],
                        padding: '3px 10px',
                        borderRadius: '6px',
                        fontWeight: '500',
                      }}>{part}</span>
                      <span style={{ fontSize: '12px', color: THEME.text, fontWeight: '500', letterSpacing: '-0.3px' }}>
                        총 {formatVol(total)} · {dates.length}일
                      </span>
                    </div>
                    {dates.map(({ date, vol }) => {
                      const d = parseInt(date.split('-')[2])
                      const wk = weekdayKor[new Date(date).getDay()]
                      const isToday = date === todayStr
                      return (
                        <div key={date} style={{
                          display: 'grid',
                          gridTemplateColumns: '60px 1fr 70px',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '4px',
                        }}>
                          <span style={{ fontSize: '10px', color: isToday ? THEME.primary : THEME.textSub, fontWeight: isToday ? '500' : '400' }}>
                            {viewMonth}/{d}({wk}){isToday && ' ·오늘'}
                          </span>
                          <div style={{ height: '5px', background: '#E8E6DE', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${vol / partMax * 100}%`,
                              background: PART_COLORS[part],
                              borderRadius: '3px',
                            }} />
                          </div>
                          <span style={{ fontSize: '10px', color: THEME.text, textAlign: 'right', fontWeight: '500' }}>
                            {vol.toLocaleString()}kg
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {statsTab === 'weekly' && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ ...S.cardTitle, margin: 0 }}>{viewYear}년 {viewMonth}월 주차별</p>
            <YearMonthPicker />
          </div>
          {weeklyTotals.every(v => v === 0) ? (
            <p style={{ color: THEME.textSub, fontSize: '12px', textAlign: 'center', padding: '16px 0' }}>운동 기록이 없습니다</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {weekLabels.map((label, wk) => {
                if (weeklyTotals[wk] === 0) return null
                // 카드 내 가장 큰 부위 값 기준으로 막대 비례
                const cardMax = Math.max(...PARTS.map(p => weeklyByPart[wk][p] || 0), 1)
                return (
                  <div key={wk} style={{ background: THEME.cardAlt, borderRadius: '12px', padding: '10px', minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px', gap: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '500', color: THEME.text, whiteSpace: 'nowrap' }}>{label}</span>
                      <span style={{ fontSize: '11px', fontWeight: '500', color: THEME.nutFatText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{formatVol(weeklyTotals[wk])}</span>
                    </div>
                    {PARTS.filter(p => weeklyByPart[wk][p] > 0).map(part => (
                      <div key={part} style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px', minWidth: 0 }}>
                        <span style={{ fontSize: '10px', color: THEME.text, width: '26px', flexShrink: 0 }}>{part}</span>
                        <div style={{ flex: 1, background: THEME.borderLight, borderRadius: '4px', height: '7px', minWidth: 0 }}>
                          <div style={{ height: '7px', borderRadius: '4px', width: `${weeklyByPart[wk][part] / cardMax * 100}%`, background: PART_COLORS[part] }} />
                        </div>
                        <span style={{ fontSize: '9px', color: THEME.textSub, flexShrink: 0, whiteSpace: 'nowrap' }}>{formatVol(weeklyByPart[wk][part])}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {statsTab === 'monthly' && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ ...S.cardTitle, margin: 0 }}>{viewYear}년 월별</p>
            <YearMonthPicker />
          </div>
          {Object.values(monthlyByMonth).every(d => d.total === 0) ? (
            <p style={{ color: THEME.textSub, fontSize: '12px', textAlign: 'center', padding: '16px 0' }}>운동 기록이 없습니다</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {Object.entries(monthlyByMonth).filter(([, d]) => d.total > 0).map(([mStr, d]) => {
                // 카드 내 가장 큰 부위 값 기준
                const cardMax = Math.max(...PARTS.map(p => d.parts[p] || 0), 1)
                return (
                  <div key={mStr} style={{ background: THEME.cardAlt, borderRadius: '12px', padding: '10px', minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px', gap: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '500', color: THEME.text, whiteSpace: 'nowrap' }}>{parseInt(mStr)}월</span>
                      <span style={{ fontSize: '11px', fontWeight: '500', color: THEME.nutCarbsDark, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{formatVol(d.total)}</span>
                    </div>
                    {PARTS.filter(p => d.parts[p] > 0).map(part => (
                      <div key={part} style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px', minWidth: 0 }}>
                        <span style={{ fontSize: '10px', color: THEME.text, width: '26px', flexShrink: 0 }}>{part}</span>
                        <div style={{ flex: 1, background: THEME.borderLight, borderRadius: '4px', height: '7px', minWidth: 0 }}>
                          <div style={{ height: '7px', borderRadius: '4px', width: `${d.parts[part] / cardMax * 100}%`, background: PART_COLORS[part] }} />
                        </div>
                        <span style={{ fontSize: '9px', color: THEME.textSub, flexShrink: 0, whiteSpace: 'nowrap' }}>{formatVol(d.parts[part])}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {statsTab === 'pr' && (
        <>
          {/* ─── 4대 종목 강조 카드 (memberId 있을 때만) ─── */}
          {memberId && (
            <div style={{ ...S.card, padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <p style={{ ...S.cardTitle, margin: 0 }}>4대 종목 PR</p>
                <span style={{ fontSize: '10px', color: THEME.textHint }}>탭하여 직접 수정</span>
              </div>

              {/* 3대 중량 합계 배너 */}
              <div style={{
                background: `linear-gradient(135deg, ${THEME.primary}, ${THEME.primaryDark})`,
                borderRadius: '10px',
                padding: '14px 16px',
                marginBottom: '8px',
                color: '#FFF',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500', opacity: 0.95, marginBottom: '4px', letterSpacing: '-0.2px' }}>
                      3대 중량
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span style={{ fontSize: '30px', fontWeight: '600', letterSpacing: '-0.8px', lineHeight: 1 }}>
                        {big3Total > 0 ? big3Total : '—'}
                      </span>
                      <span style={{ fontSize: '13px', opacity: 0.9, fontWeight: '500' }}>kg</span>
                    </div>
                  </div>

                  {/* 가운데 흰색 2px 세로선 */}
                  <div style={{ width: '2px', height: '56px', background: '#FFF', borderRadius: '2px' }} />

                  <div style={{ textAlign: 'right', fontSize: '11px', opacity: 0.9, lineHeight: 1.7 }}>
                    <div>스쿼트 <span style={{ fontWeight: '500' }}>{squatW}</span></div>
                    <div>데드리프트 <span style={{ fontWeight: '500' }}>{deadliftW}</span></div>
                    <div>벤치 <span style={{ fontWeight: '500' }}>{benchW}</span></div>
                  </div>
                </div>
              </div>

              {/* 4대 종목 카드 그리드 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {BIG4_EXERCISES.map(({ key, label }) => {
                  const draft = big4Draft[key] || { weight: '', reps: '' }
                  const saved = big4State[key]
                  const recordedDate = saved?.recorded_date

                  return (
                    <div key={key} style={{
                      background: THEME.cardAlt,
                      border: `0.5px solid ${THEME.primaryAccent}`,
                      borderRadius: '10px',
                      padding: '9px',
                    }}>
                      <div style={{ fontSize: '11px', color: THEME.primary, marginBottom: '6px', fontWeight: '500' }}>
                        {label}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', whiteSpace: 'nowrap' }}>
                        <input
                          type="number"
                          inputMode="decimal"
                          placeholder="0"
                          value={draft.weight}
                          onChange={e => handleBig4Change(key, 'weight', e.target.value)}
                          onBlur={() => handleBig4Save(key)}
                          style={big4Input}
                        />
                        <span style={{ fontSize: '10px', color: THEME.textSub }}>kg</span>
                        <span style={{ fontSize: '11px', color: THEME.textSub, margin: '0 2px' }}>×</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          placeholder="0"
                          value={draft.reps}
                          onChange={e => handleBig4Change(key, 'reps', e.target.value)}
                          onBlur={() => handleBig4Save(key)}
                          style={big4InputReps}
                        />
                        <span style={{ fontSize: '10px', color: THEME.textSub }}>회</span>
                      </div>

                      <div style={{ fontSize: '9px', color: THEME.textHint, marginTop: '3px' }}>
                        {recordedDate ? recordedDate.replace(/-/g, '.') : '미기록'}
                      </div>
                    </div>
                  )
                })}
              </div>
              {big4Loading && (
                <p style={{ fontSize: '10px', color: THEME.textHint, textAlign: 'center', marginTop: '8px' }}>
                  로딩 중...
                </p>
              )}
            </div>
          )}

          {/* ─── 기존 PR 그리드 ─── */}
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <p style={{ ...S.cardTitle, margin: 0 }}>개인 최고 기록 (PR)</p>
              <span style={{ fontSize: '10px', color: THEME.textHint }}>{prs.length}개 운동</span>
            </div>

            {prs.length === 0 ? (
              <p style={{ color: THEME.textSub, fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
                아직 운동 기록이 없습니다
              </p>
            ) : (
              <>
                {PARTS.map(part => {
                  const partPRs = prs.filter(p => p.body_part === part)
                  if (partPRs.length === 0) return null
                  return (
                    <div key={part} style={{ marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '7px' }}>
                        <span style={{
                          fontSize: '10px',
                          color: '#FFF',
                          background: PART_COLORS[part],
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: '500',
                        }}>{part}</span>
                        <span style={{ fontSize: '10px', color: THEME.textSub }}>{partPRs.length}개 운동</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        {partPRs.map((pr, i) => (
                          <div key={i} style={{
                            background: THEME.cardAlt,
                            border: `0.5px solid ${THEME.border}`,
                            borderRadius: '8px',
                            padding: '8px 10px',
                          }}>
                            <p style={{ fontSize: '10px', color: THEME.textSub, margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {pr.exercise_name}
                            </p>
                            <p style={{ fontSize: '15px', color: THEME.primary, fontWeight: '500', margin: '0 0 2px', letterSpacing: '-0.3px' }}>
                              {pr.maxWeight}<span style={{ fontSize: '9px', color: THEME.textSub, fontWeight: '400' }}>kg × {pr.maxWeightReps}회</span>
                            </p>
                            <p style={{ fontSize: '9px', color: THEME.textHint, margin: 0 }}>
                              {pr.maxWeightDate.replace(/-/g, '.')} · {pr.totalSessions}회 운동
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
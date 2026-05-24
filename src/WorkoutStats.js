import React, { useState, useEffect } from 'react'
import { PARTS, PART_COLORS, S, THEME, calcPRs, BIG4_EXERCISES, loadBig4PRs, saveBig4PR, uploadPRMedia, removePRMedia, loadFavorites } from './utils'

export default function WorkoutStats({
  allLogs,
  memberId,
  bigPrTable = 'personal_records',
  bigPrIdField = 'member_id',
  readOnly = false,
  onJumpToLog,  // (dateStr) => void — 캘린더 셀 클릭 시 운동 기록 탭으로 이동
}) {
  const [statsTab, setStatsTab] = useState('workout')
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1)
  const [selectedDate, setSelectedDate] = useState(todayStr)

  // ─── 4대 종목 PR 상태 ───
  const [big4State, setBig4State] = useState({})
  const [big4Loading, setBig4Loading] = useState(false)
  const [big4Draft, setBig4Draft] = useState({})
  const [prPreview, setPRPreview] = useState(null)  // { url, isVideo, label }

  // 즐겨찾기 — PR 탭 진입 시 로드. 라인차트용 운동 선택 칩.
  const [favList, setFavList] = useState([])
  const [selectedFav, setSelectedFav] = useState(null)  // { body_part, exercise_name }

  // 월별 막대 차트 — 부위 필터 ('전체' | PARTS)
  const [monthlyPart, setMonthlyPart] = useState('전체')

  useEffect(() => {
    if (statsTab === 'pr' && memberId) {
      reloadBig4()
      const favTable = bigPrIdField === 'trainer_id' ? 'trainer_favorite_exercises' : 'member_favorite_exercises'
      loadFavorites(memberId, favTable, bigPrIdField).then(setFavList)
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

  const handlePRMediaUpload = async (key, file) => {
    if (!memberId) return
    // 기록이 없으면 미리 빈 PR row 생성 (saveBig4PR — weight/reps null 안 됨, weight=0 placeholder)
    if (!big4State[key]?.id) {
      const draft = big4Draft[key] || {}
      const w = draft.weight || '0'
      const r = draft.reps || '0'
      await saveBig4PR(memberId, key, w, r, bigPrTable, bigPrIdField)
    }
    const res = await uploadPRMedia(memberId, key, file, bigPrTable, bigPrIdField)
    if (!res.success) {
      alert('업로드 실패: ' + res.error)
      return
    }
    await reloadBig4()
  }

  const handlePRMediaRemove = async (key) => {
    if (!memberId) return
    if (!window.confirm('이 PR 영상/사진을 삭제할까요?')) return
    const res = await removePRMedia(memberId, key, bigPrTable, bigPrIdField)
    if (!res.success) {
      alert('삭제 실패: ' + res.error)
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

  // 최근 6개월 막대 차트 — 부위 필터 적용
  const last6Months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(viewYear, viewMonth - 1 - i, 1)
    last6Months.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
  }
  const monthlyBars = last6Months.map(({ year, month }) => {
    const prefix = `${year}-${String(month).padStart(2, '0')}`
    const rows = allLogs.filter(r => r.log_date && r.log_date.startsWith(prefix))
    const total = rows
      .filter(r => monthlyPart === '전체' || r.body_part === monthlyPart)
      .reduce((sum, r) => sum + (r.volume || 0), 0)
    return { year, month, total }
  })
  const maxBar = Math.max(...monthlyBars.map(d => d.total), 1)
  const currentMonthBar = monthlyBars[monthlyBars.length - 1]
  const prevMonthBar = monthlyBars[monthlyBars.length - 2]
  const monthDiff = currentMonthBar.total - (prevMonthBar?.total || 0)

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

  // 즐겨찾기 등록된 운동에 한해서만 PR 카드에 표시.
  // (즐겨찾기 안 한 운동은 "한 번 해봤다" 수준일 가능성이 커서 PR 노이즈를 만듦)
  const favKey = (p) => `${p.body_part}|${p.exercise_name}`
  const favSet = new Set((favList || []).map(favKey))
  const prs = calcPRs(allLogs).filter(p => favSet.has(favKey(p)))

  const YearMonthPicker = () => (
    <div style={{ display: 'flex', gap: '6px' }}>
      <select value={viewYear} onChange={e => setViewYear(parseInt(e.target.value))} style={{ padding: '5px 9px', borderRadius: '6px', border: 'none', background: THEME.borderLight, fontSize: '11px', color: THEME.text, fontFamily: 'inherit', outline: 'none' }}>
        {yearOptions.map(y => <option key={y} value={y}>{y}년</option>)}
      </select>
      {statsTab !== 'pr' && (
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
      {prPreview && (
        <div
          onClick={() => setPRPreview(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'pointer' }}
        >
          <div style={{ fontSize: 12, color: '#FFF', marginBottom: 10 }}>{prPreview.label}</div>
          {prPreview.isVideo ? (
            <video src={prPreview.url} controls autoPlay
              style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 8 }}
              onClick={e => e.stopPropagation()} />
          ) : (
            <img src={prPreview.url} alt={prPreview.label}
              style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 8 }} />
          )}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
        {['workout', 'pr'].map((t, i) => {
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
              {['추이', 'PR'][i]}
            </button>
          )
        })}
      </div>

      {statsTab === 'workout' && (
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

              const handleCellClick = () => {
                setSelectedDate(dateStr)
                if (!onJumpToLog) return
                const wk = weekdayKor[new Date(dateStr).getDay()]
                const msg = hasWorkout
                  ? `${viewMonth}월 ${day}일(${wk}) 운동 기록으로 이동할까요?`
                  : `${viewMonth}월 ${day}일(${wk}) 은 기록이 없습니다. 그래도 운동 기록 화면으로 이동할까요?`
                if (window.confirm(msg)) onJumpToLog(dateStr)
              }
              return (
                <div
                  key={dateStr}
                  onClick={handleCellClick}
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

      {statsTab === 'workout' && (() => {
        // 비교 텍스트
        const partLabel = monthlyPart === '전체' ? '볼륨' : `${monthlyPart} 볼륨`
        const prevLabel = prevMonthBar ? `${prevMonthBar.month}월` : '지난달'
        const diffAbs = Math.abs(monthDiff)
        const diffWord = monthDiff >= 0 ? '늘었어요' : '줄었어요'
        const diffColor = monthDiff >= 0 ? THEME.primary : THEME.danger
        const compact = (v) => v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}t` : `${v}`
        const barColor = monthlyPart === '전체' ? THEME.primary : (PART_COLORS[monthlyPart] || THEME.primary)
        const allZero = monthlyBars.every(d => d.total === 0)
        return (
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <p style={{ ...S.cardTitle, margin: 0 }}>월별 볼륨</p>
              <YearMonthPicker />
            </div>

            <p style={{ fontSize: '13px', fontWeight: '500', color: THEME.text, margin: '0 0 4px', lineHeight: 1.45 }}>
              {partLabel}이 {prevLabel}보다
            </p>
            <p style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 12px', lineHeight: 1.3, color: diffColor }}>
              {diffAbs.toLocaleString()} kg {diffWord}
            </p>

            {/* 부위 칩 — 전체 + PARTS */}
            <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '10px', WebkitOverflowScrolling: 'touch' }}>
              {['전체', ...PARTS].map(p => {
                const active = monthlyPart === p
                const chipColor = p === '전체' ? THEME.primary : (PART_COLORS[p] || THEME.primary)
                return (
                  <button key={p} onClick={() => setMonthlyPart(p)} style={{
                    padding: '5px 12px', borderRadius: '14px',
                    border: `0.5px solid ${active ? chipColor : THEME.border}`,
                    background: active ? chipColor : '#FFF',
                    color: active ? '#FFF' : THEME.textSub,
                    fontSize: '11px', fontWeight: active ? '500' : '400',
                    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                    fontFamily: 'inherit',
                  }}>{p}</button>
                )
              })}
            </div>

            {allZero ? (
              <p style={{ fontSize: '11px', color: THEME.textHint, textAlign: 'center', padding: '20px 0', margin: 0 }}>
                최근 6개월간 {monthlyPart === '전체' ? '' : `${monthlyPart} `}운동 기록이 없습니다
              </p>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '140px', padding: '4px 2px 0' }}>
                {monthlyBars.map((d, i) => {
                  const isLast = i === monthlyBars.length - 1
                  const ratio = d.total / maxBar
                  const barH = d.total > 0 ? Math.max(ratio * 110, 6) : 4
                  return (
                    <div key={`${d.year}-${d.month}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0, gap: '5px' }}>
                      <span style={{ fontSize: '9px', color: THEME.textSub, fontWeight: '500', lineHeight: 1, whiteSpace: 'nowrap' }}>
                        {compact(d.total)}
                      </span>
                      <div style={{
                        width: '100%', maxWidth: '32px',
                        height: `${barH}px`,
                        background: isLast ? barColor : THEME.borderLight,
                        borderRadius: '6px 6px 0 0',
                        transition: 'background 0.2s',
                      }} />
                      <span style={{ fontSize: '10px', color: isLast ? THEME.text : THEME.textHint, fontWeight: isLast ? '500' : '400', lineHeight: 1 }}>
                        {d.month}월
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

      {statsTab === 'pr' && (
        <>
          {/* ─── 4대 종목 강조 카드 (memberId 있을 때만) ─── */}
          {memberId && (
            <div style={{ ...S.card, padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <p style={{ ...S.cardTitle, margin: 0 }}>4대 종목 PR</p>
                <span style={{ fontSize: '10px', color: THEME.textHint }}>
                  {readOnly ? '참고용 (편집 불가)' : '탭하여 직접 수정'}
                </span>
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
                      <div style={{ marginBottom: '6px' }}>
                        <div style={{ fontSize: '11px', color: THEME.primary, fontWeight: '500' }}>{label}</div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', whiteSpace: 'nowrap', marginBottom: '6px' }}>
                        {readOnly ? (
                          <>
                            <span style={{ ...big4Input, display: 'inline-block' }}>
                              {draft.weight || '—'}
                            </span>
                            <span style={{ fontSize: '10px', color: THEME.textSub }}>kg</span>
                            <span style={{ fontSize: '11px', color: THEME.textSub, margin: '0 2px' }}>×</span>
                            <span style={{ ...big4InputReps, display: 'inline-block' }}>
                              {draft.reps || '—'}
                            </span>
                            <span style={{ fontSize: '10px', color: THEME.textSub }}>회</span>
                          </>
                        ) : (
                          <>
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
                          </>
                        )}
                      </div>

                      <div style={{ fontSize: '9px', color: THEME.textHint }}>
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

          {/* ─── PR 추이 — 부위별 즐겨찾기 운동 라인차트 (최근 60일, 일자별 최대 세트 볼륨) ─── */}
          {(() => {
            const big4Names = new Set(BIG4_EXERCISES.map(e => e.label))
            const favs = favList.filter(f => !big4Names.has((f.exercise_name || '').trim()))
            const partsWithFav = PARTS.filter(p => favs.some(f => f.body_part === p))
            const activePart = (selectedFav && partsWithFav.includes(selectedFav.body_part))
              ? selectedFav.body_part
              : (partsWithFav[0] || null)
            const partFavs = activePart ? favs.filter(f => f.body_part === activePart) : []
            return (
              <div style={{ ...S.card, padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <p style={{ ...S.cardTitle, margin: 0 }}>PR 추이</p>
                  <span style={{ fontSize: '11px', color: THEME.textHint }}>최근 60일 · 최대 세트 볼륨</span>
                </div>
                {favs.length === 0 ? (
                  <p style={{ fontSize: '12px', color: THEME.textSub, textAlign: 'center', padding: '14px 0', margin: 0 }}>
                    즐겨찾기한 운동이 없어요. 운동 기록에서 ★ 로 등록하세요.
                  </p>
                ) : (
                  <>
                    {/* 1차: 부위 칩 */}
                    <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 6, marginBottom: 8 }}>
                      {partsWithFav.map(p => {
                        const active = activePart === p
                        const color = PART_COLORS[p] || THEME.primary
                        return (
                          <button key={p}
                            onClick={() => {
                              const first = favs.find(f => f.body_part === p)
                              if (first) setSelectedFav({ body_part: p, exercise_name: first.exercise_name })
                            }}
                            style={{
                              flexShrink: 0,
                              background: active ? color : '#FFF',
                              color: active ? '#FFF' : THEME.text,
                              border: `0.5px solid ${active ? color : THEME.border}`,
                              borderRadius: 14, padding: '6px 14px',
                              fontSize: 12, fontWeight: active ? 600 : 400,
                              cursor: 'pointer', fontFamily: 'inherit',
                              whiteSpace: 'nowrap',
                            }}>{p}</button>
                        )
                      })}
                    </div>
                    {/* 2차: 그 부위 운동 칩 */}
                    <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 6, marginBottom: 10 }}>
                      {partFavs.map(f => {
                        const active = selectedFav?.exercise_name === f.exercise_name
                        const color = PART_COLORS[f.body_part] || THEME.primary
                        return (
                          <button key={f.id}
                            onClick={() => setSelectedFav({ body_part: f.body_part, exercise_name: f.exercise_name })}
                            style={{
                              flexShrink: 0,
                              background: active ? color : THEME.cardAlt,
                              color: active ? '#FFF' : THEME.textSub,
                              border: `0.5px solid ${active ? color : THEME.borderLight}`,
                              borderRadius: 12, padding: '5px 11px',
                              fontSize: 11, fontWeight: active ? 500 : 400,
                              cursor: 'pointer', fontFamily: 'inherit',
                              whiteSpace: 'nowrap',
                            }}>
                            {f.exercise_name}
                          </button>
                        )
                      })}
                    </div>
                    {(() => {
                      if (!selectedFav) {
                        return <p style={{ fontSize: '12px', color: THEME.textHint, textAlign: 'center', padding: '14px 0', margin: 0 }}>운동을 선택하세요</p>
                      }
                      const since = new Date(); since.setDate(since.getDate() - 60)
                      const sinceStr = since.toISOString().split('T')[0]
                      const rows = allLogs.filter(r =>
                        (r.exercise_name || '').trim() === selectedFav.exercise_name &&
                        r.log_date && r.log_date >= sinceStr
                      )
                      if (rows.length === 0) {
                        return <p style={{ fontSize: '12px', color: THEME.textHint, textAlign: 'center', padding: '14px 0', margin: 0 }}>최근 60일 기록이 없어요</p>
                      }
                      // 일자별 최대 세트 볼륨
                      const byDate = {}
                      rows.forEach(r => {
                        const v = r.volume || 0
                        if (!byDate[r.log_date] || v > byDate[r.log_date]) byDate[r.log_date] = v
                      })
                      const dates = Object.keys(byDate).sort()
                      const values = dates.map(d => byDate[d])
                      const maxV = Math.max(...values)
                      const minV = Math.min(...values)
                      // 변동폭 강조 + 데이터 점이 차트 edge 에 닿지 않도록 위/아래 ~15% 여유,
                      // 깔끔한 정수 단위로 라운드 → y축 숫자도 보기 좋게
                      const hasRange = maxV - minV > 0
                      const baseRange = hasRange ? maxV - minV : Math.max(1, maxV * 0.1)
                      const yPad = baseRange * (hasRange ? 0.15 : 0.5)
                      const niceStep = baseRange > 500 ? 100 : baseRange > 100 ? 50 : baseRange > 20 ? 10 : 5
                      const yMinRaw = (hasRange ? minV : minV) - yPad
                      const yMaxRaw = (hasRange ? maxV : minV) + yPad
                      const yMin = Math.max(0, Math.floor(yMinRaw / niceStep) * niceStep)
                      const yMax = Math.ceil(yMaxRaw / niceStep) * niceStep
                      // 차트 drawing area 를 위·아래로 짜내서 grid line 안쪽 배치.
                      // 상단 grid line: padT 만큼 위에서 떨어진 위치 (kg·회 와 분리)
                      // 하단 grid line: padT + innerH 위치 (날짜 라벨과 분리)
                      const W = 320, H = 210, padL = 36, padR = 12, padT = 40, padB = 50
                      const dateLabelGap = 20  // 하단 grid line ↔ 날짜 라벨 사이 간격
                      const innerW = W - padL - padR, innerH = H - padT - padB
                      const xOf = (i) => dates.length === 1 ? padL + innerW / 2 : padL + (i / (dates.length - 1)) * innerW
                      const yOf = (v) => padT + (1 - (v - yMin) / (yMax - yMin)) * innerH
                      const pts = dates.map((d, i) => `${xOf(i)},${yOf(byDate[d])}`).join(' ')
                      const color = PART_COLORS[selectedFav.body_part] || THEME.primary
                      const fmtDate = (s) => `${parseInt(s.split('-')[1])}/${parseInt(s.split('-')[2])}`
                      // 날짜 라벨 잘림 방지 — 첫 점은 start, 끝 점은 end 정렬
                      const dateAnchor = (i) => {
                        if (i === 0) return 'start'
                        if (i === dates.length - 1) return 'end'
                        return 'middle'
                      }
                      return (
                        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                          {[0, 0.5, 1].map((p, i) => (
                            <line key={i} x1={padL} y1={padT + p * innerH} x2={W - padR} y2={padT + p * innerH} stroke={THEME.borderLight} strokeWidth="0.5" />
                          ))}
                          {/* y축 숫자 — dominantBaseline=middle 로 grid line 정중앙에 정렬 */}
                          {[0, 0.5, 1].map((p, i) => (
                            <text key={i} x={padL - 5} y={padT + p * innerH} textAnchor="end" dominantBaseline="middle" fontSize="5" fill={THEME.textHint}>
                              {Math.round(yMax - (yMax - yMin) * p)}
                            </text>
                          ))}
                          <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          {dates.map((d, i) => (
                            <g key={d}>
                              <circle cx={xOf(i)} cy={yOf(byDate[d])} r="2.6" fill={color} />
                              {(i === 0 || i === dates.length - 1 || (dates.length > 2 && i === Math.floor(dates.length / 2))) && (
                                <text x={xOf(i)} y={padT + innerH + dateLabelGap} textAnchor={dateAnchor(i)} fontSize="5.5" fill={THEME.textSub}>
                                  {fmtDate(d)}
                                </text>
                              )}
                            </g>
                          ))}
                          <text x={W - padR} y={padT - 4} textAnchor="end" fontSize="5" fill={THEME.textHint}>
                            kg·회
                          </text>
                        </svg>
                      )
                    })()}
                  </>
                )}
              </div>
            )
          })()}

          {/* ─── 부위별 운동 횟수 — radar (이번 달 기준) ─── */}
          {(() => {
            const now = new Date()
            const yyyy = now.getFullYear()
            const mm = String(now.getMonth() + 1).padStart(2, '0')
            const prefix = `${yyyy}-${mm}`
            // 이번 달 row 들 부위별 unique log_date 수
            const partDays = {}
            PARTS.forEach(p => { partDays[p] = new Set() })
            allLogs.forEach(r => {
              if (r.log_date && r.log_date.startsWith(prefix) && r.body_part && partDays[r.body_part]) {
                partDays[r.body_part].add(r.log_date)
              }
            })
            const counts = PARTS.map(p => partDays[p].size)
            const maxC = Math.max(...counts, 3)  // 최소 3 (시각 안정)
            const N = PARTS.length
            // R = 42 (더 컴팩트), 라벨 ratio 2.0 → grid edge 와 라벨 사이 간격 ≈ 42px
            // 부위명 ↔ 횟수 수직 간격 16px (y-4 / y+12)
            const W = 320, H = 290, cx = W / 2, cy = 150, R = 42
            const labelR = 2.0
            const angleAt = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / N
            const ptAt = (i, ratio) => {
              const a = angleAt(i)
              return [cx + Math.cos(a) * R * ratio, cy + Math.sin(a) * R * ratio]
            }
            const dataPts = counts.map((c, i) => ptAt(i, c / maxC)).map(([x, y]) => `${x},${y}`).join(' ')
            return (
              <div style={{ ...S.card, padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <p style={{ ...S.cardTitle, margin: 0 }}>부위별 운동 횟수</p>
                  <span style={{ fontSize: '10px', color: THEME.textHint }}>{now.getMonth() + 1}월 · 일 수 기준</span>
                </div>
                <svg viewBox={`0 -10 ${W} ${H + 10}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                  {/* 배경 격자 (0.25 / 0.5 / 0.75 / 1) */}
                  {[0.25, 0.5, 0.75, 1].map((r, idx) => {
                    const pts = PARTS.map((_, i) => ptAt(i, r)).map(([x, y]) => `${x},${y}`).join(' ')
                    return <polygon key={idx} points={pts} fill="none" stroke={THEME.borderLight} strokeWidth="0.5" />
                  })}
                  {/* 축 선 */}
                  {PARTS.map((_, i) => {
                    const [x, y] = ptAt(i, 1)
                    return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={THEME.borderLight} strokeWidth="0.5" />
                  })}
                  {/* 데이터 다각형 */}
                  <polygon points={dataPts} fill={THEME.primary} fillOpacity="0.22" stroke={THEME.primary} strokeWidth="1.3" />
                  {/* 데이터 점 + 값 */}
                  {counts.map((c, i) => {
                    const [x, y] = ptAt(i, c / maxC)
                    return <circle key={i} cx={x} cy={y} r="2.4" fill={PART_COLORS[PARTS[i]] || THEME.primary} />
                  })}
                  {/* 라벨 + 횟수 — 그래프에서 충분히 떨어지고 (gap 42px), 부위명 위·횟수 아래로 16px 분리 */}
                  {PARTS.map((p, i) => {
                    const [x, y] = ptAt(i, labelR)
                    return (
                      <g key={p}>
                        <text x={x} y={y - 4} textAnchor="middle" fontSize="7" fontWeight="500" fill={PART_COLORS[p] || THEME.text}>
                          {p}
                        </text>
                        <text x={x} y={y + 12} textAnchor="middle" fontSize="6.5" fill={THEME.textSub}>
                          {counts[i]}회
                        </text>
                      </g>
                    )
                  })}
                </svg>
              </div>
            )
          })()}

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
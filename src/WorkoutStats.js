import React, { useState } from 'react'
import { PARTS, PART_COLORS, S, THEME, getWeekNum, weekLabels } from './utils'

export default function WorkoutStats({ allLogs }) {
  const [statsTab, setStatsTab] = useState('daily')
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1)
  const [selectedDate, setSelectedDate] = useState(todayStr)

  const yearStr = String(viewYear)
  const monthStr = String(viewMonth).padStart(2, '0')
  const monthLogs = allLogs.filter(r => r.log_date && r.log_date.startsWith(`${yearStr}-${monthStr}`))

  // 일간
  const byDay = {}
  monthLogs.forEach(row => {
    if (!byDay[row.log_date]) byDay[row.log_date] = { total: 0, parts: {} }
    byDay[row.log_date].total += row.volume || 0
    if (row.body_part) byDay[row.log_date].parts[row.body_part] = (byDay[row.log_date].parts[row.body_part] || 0) + (row.volume || 0)
  })

  // 주간
  const weeklyByPart = Array.from({ length: 5 }, () => { const o = {}; PARTS.forEach(p => o[p] = 0); return o })
  const weeklyTotals = [0, 0, 0, 0, 0]
  monthLogs.forEach(row => {
    const wk = getWeekNum(row.log_date)
    if (row.body_part) weeklyByPart[wk][row.body_part] = (weeklyByPart[wk][row.body_part] || 0) + (row.volume || 0)
    weeklyTotals[wk] += row.volume || 0
  })

  // 월간
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

  const formatVol = (v) => v >= 1000 ? (v / 1000).toFixed(1) + 't' : v + 'kg'

  // 캘린더용: 해당 월의 1일 요일과 마지막 날짜 계산
  const firstDayOfWeek = new Date(viewYear, viewMonth - 1, 1).getDay() // 0=일, 1=월...
  const lastDate = new Date(viewYear, viewMonth, 0).getDate()

  // 7x6 캘린더 셀 배열 만들기
  const calendarCells = []
  // 앞쪽 빈 셀
  for (let i = 0; i < firstDayOfWeek; i++) calendarCells.push(null)
  // 날짜 셀
  for (let d = 1; d <= lastDate; d++) {
    const dateStr = `${yearStr}-${monthStr}-${String(d).padStart(2, '0')}`
    calendarCells.push({
      day: d,
      dateStr,
      data: byDay[dateStr] || null,
    })
  }
  // 뒤쪽 빈 셀 (7의 배수까지)
  while (calendarCells.length % 7 !== 0) calendarCells.push(null)

  const selectedData = byDay[selectedDate]
  const selectedDayNum = selectedDate ? parseInt(selectedDate.split('-')[2]) : null
  const selectedDayWeekday = selectedDate ? new Date(selectedDate).getDay() : null
  const weekdayKor = ['일', '월', '화', '수', '목', '금', '토']
  const isSelectedToday = selectedDate === todayStr
  // 선택한 날이 현재 보고 있는 월에 속하는지
  const selectedInView = selectedDate && selectedDate.startsWith(`${yearStr}-${monthStr}`)

  const YearMonthPicker = () => (
    <div style={{ display: 'flex', gap: '6px' }}>
      <select value={viewYear} onChange={e => setViewYear(parseInt(e.target.value))} style={{ padding: '5px 9px', borderRadius: '6px', border: 'none', background: THEME.borderLight, fontSize: '11px', color: THEME.text, fontFamily: 'inherit', outline: 'none' }}>
        {yearOptions.map(y => <option key={y} value={y}>{y}년</option>)}
      </select>
      {statsTab !== 'monthly' && (
        <select value={viewMonth} onChange={e => setViewMonth(parseInt(e.target.value))} style={{ padding: '5px 9px', borderRadius: '6px', border: 'none', background: THEME.borderLight, fontSize: '11px', color: THEME.text, fontFamily: 'inherit', outline: 'none' }}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
        </select>
      )}
    </div>
  )

  return (
    <div>
      {/* 요약 카드 */}
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

      {/* 탭 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '10px' }}>
        {['daily', 'weekly', 'monthly'].map((t, i) => {
          const active = statsTab === t
          return (
            <button key={t} style={{
              padding: '8px',
              borderRadius: '8px',
              border: 'none',
              background: active ? THEME.primaryAccent : '#FFF',
              color: active ? THEME.primaryDark : THEME.textSub,
              fontSize: '11px',
              fontWeight: active ? '500' : '400',
              cursor: 'pointer'
            }} onClick={() => setStatsTab(t)}>
              {['일간', '주간', '월간'][i]}
            </button>
          )
        })}
      </div>

      {/* 일간 - 캘린더 뷰 */}
      {statsTab === 'daily' && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ ...S.cardTitle, margin: 0 }}>{viewYear}년 {viewMonth}월</p>
            <YearMonthPicker />
          </div>

          {/* 요일 헤더 */}
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

          {/* 캘린더 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {calendarCells.map((cell, idx) => {
              if (!cell) return <div key={`empty-${idx}`} />

              const { day, dateStr, data } = cell
              const isToday = dateStr === todayStr
              const isSelected = dateStr === selectedDate
              const hasWorkout = !!data
              const weekday = new Date(dateStr).getDay()
              const activeParts = data ? Object.entries(data.parts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]) : []

              // 색상 결정
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginTop: 'auto' }}>
                      {activeParts.slice(0, 3).map(([part]) => (
                        <span
                          key={part}
                          style={{
                            width: '5px',
                            height: '5px',
                            borderRadius: '50%',
                            background: isSelected ? '#FFF' : PART_COLORS[part],
                            flexShrink: 0,
                          }}
                        />
                      ))}
                      <span style={{
                        fontSize: '8px',
                        color: volColor,
                        fontWeight: '500',
                        lineHeight: 1,
                        marginLeft: 'auto',
                        whiteSpace: 'nowrap',
                      }}>{formatVol(data.total)}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* 범례 */}
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

          {/* 선택한 날 상세 */}
          {selectedInView && (
            <div style={{
              marginTop: '12px',
              background: THEME.cardAlt,
              borderRadius: '12px',
              padding: '12px',
              border: `0.5px solid ${THEME.border}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', color: THEME.text, fontWeight: '500' }}>
                  {viewMonth}월 {selectedDayNum}일 ({weekdayKor[selectedDayWeekday]})
                  {isSelectedToday && (
                    <span style={{
                      fontSize: '9px',
                      color: THEME.primary,
                      background: THEME.primaryLight,
                      padding: '1px 7px',
                      borderRadius: '8px',
                      marginLeft: '5px',
                      fontWeight: '500',
                    }}>오늘</span>
                  )}
                </span>
                {selectedData && (
                  <span style={{ fontSize: '15px', color: THEME.primary, fontWeight: '500', letterSpacing: '-0.3px' }}>
                    {formatVol(selectedData.total)}
                  </span>
                )}
              </div>

              {!selectedData ? (
                <p style={{ fontSize: '11px', color: THEME.textHint, margin: '8px 0 0', textAlign: 'center' }}>
                  운동 기록이 없습니다
                </p>
              ) : (() => {
                const activeParts = Object.entries(selectedData.parts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
                const maxPartVol = Math.max(...activeParts.map(([, v]) => v), 1)
                const totalSets = monthLogs.filter(r => r.log_date === selectedDate).length
                return (
                  <>
                    <p style={{ fontSize: '10px', color: THEME.textSub, margin: '0 0 10px' }}>
                      총 {totalSets}세트 · 부위 {activeParts.length}개
                    </p>
                    {activeParts.map(([part, vol]) => (
                      <div key={part} style={{
                        display: 'grid',
                        gridTemplateColumns: '50px 1fr 60px',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '5px',
                      }}>
                        <span style={{
                          fontSize: '10px',
                          color: '#FFF',
                          background: PART_COLORS[part],
                          padding: '3px 0',
                          borderRadius: '5px',
                          textAlign: 'center',
                          fontWeight: '500',
                        }}>{part}</span>
                        <div style={{ height: '5px', background: '#E8E6DE', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${vol / maxPartVol * 100}%`,
                            background: PART_COLORS[part],
                            borderRadius: '3px',
                          }} />
                        </div>
                        <span style={{ fontSize: '10px', color: THEME.text, textAlign: 'right', fontWeight: '500' }}>
                          {vol.toLocaleString()}kg
                        </span>
                      </div>
                    ))}
                  </>
                )
              })()}
            </div>
          )}
        </div>
      )}

      {/* 주간 */}
      {statsTab === 'weekly' && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ ...S.cardTitle, margin: 0 }}>{viewYear}년 {viewMonth}월 주차별</p>
            <YearMonthPicker />
          </div>
          {weeklyTotals.every(v => v === 0) ? (
            <p style={{ color: THEME.textSub, fontSize: '12px', textAlign: 'center', padding: '16px 0' }}>운동 기록이 없습니다</p>
          ) : weekLabels.map((label, wk) => {
            if (weeklyTotals[wk] === 0) return null
            return (
              <div key={wk} style={{ marginBottom: '12px', background: THEME.cardAlt, borderRadius: '12px', padding: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '9px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '500', color: THEME.text }}>{label}</span>
                  <span style={{ fontSize: '12px', fontWeight: '500', color: THEME.nutFatText }}>{weeklyTotals[wk].toLocaleString()}kg</span>
                </div>
                {PARTS.filter(p => weeklyByPart[wk][p] > 0).map(part => (
                  <div key={part} style={S.barRow}>
                    <span style={S.barLabel}>{part}</span>
                    <div style={S.barBg}>
                      <div style={{ ...S.barFill, width: `${weeklyByPart[wk][part] / maxWeekVol * 100}%`, background: PART_COLORS[part] }} />
                    </div>
                    <span style={S.barVal}>{weeklyByPart[wk][part].toLocaleString()}kg</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* 월간 */}
      {statsTab === 'monthly' && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ ...S.cardTitle, margin: 0 }}>{viewYear}년 월별</p>
            <YearMonthPicker />
          </div>
          {Object.values(monthlyByMonth).every(d => d.total === 0) ? (
            <p style={{ color: THEME.textSub, fontSize: '12px', textAlign: 'center', padding: '16px 0' }}>운동 기록이 없습니다</p>
          ) : Object.entries(monthlyByMonth).filter(([, d]) => d.total > 0).map(([mStr, d]) => (
            <div key={mStr} style={{ marginBottom: '12px', background: THEME.cardAlt, borderRadius: '12px', padding: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '9px' }}>
                <span style={{ fontSize: '12px', fontWeight: '500', color: THEME.text }}>{parseInt(mStr)}월</span>
                <span style={{ fontSize: '12px', fontWeight: '500', color: THEME.nutCarbsDark }}>{d.total.toLocaleString()}kg</span>
              </div>
              {PARTS.filter(p => d.parts[p] > 0).map(part => (
                <div key={part} style={S.barRow}>
                  <span style={S.barLabel}>{part}</span>
                  <div style={S.barBg}>
                    <div style={{ ...S.barFill, width: `${d.parts[part] / maxMonthVol * 100}%`, background: PART_COLORS[part] }} />
                  </div>
                  <span style={S.barVal}>{d.parts[part].toLocaleString()}kg</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import React, { useState } from 'react'
import { PARTS, PART_COLORS, S, THEME, getWeekNum, weekLabels } from './utils'

export default function WorkoutStats({ allLogs }) {
  const [statsTab, setStatsTab] = useState('daily')
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1)
  const [expandedDay, setExpandedDay] = useState(null)

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
  const monthDays = Object.keys(byDay).sort()

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

  const YearMonthPicker = () => (
    <div style={{ display: 'flex', gap: '6px' }}>
      <select value={viewYear} onChange={e => setViewYear(parseInt(e.target.value))} style={{ padding: '4px 8px', borderRadius: '8px', border: `1px solid ${THEME.border}`, fontSize: '13px', background: '#FFF' }}>
        {yearOptions.map(y => <option key={y} value={y}>{y}년</option>)}
      </select>
      {statsTab !== 'monthly' && (
        <select value={viewMonth} onChange={e => setViewMonth(parseInt(e.target.value))} style={{ padding: '4px 8px', borderRadius: '8px', border: `1px solid ${THEME.border}`, fontSize: '13px', background: '#FFF' }}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
        </select>
      )}
    </div>
  )

  return (
    <div>
      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        {[
          { label: '오늘', val: todayTotal, color: '#4472C4' },
          { label: '이번 주', val: thisWeekTotal, color: THEME.primary },
          { label: '이번 달', val: thisMonthTotal, color: '#E8A020' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: '#FFF', borderRadius: '12px', padding: '12px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '11px', color: THEME.textSub, margin: '0 0 4px' }}>{label}</p>
            <p style={{ fontSize: '16px', fontWeight: '700', color, margin: 0 }}>
              {val >= 1000 ? (val / 1000).toFixed(1) + 't' : val + 'kg'}
            </p>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        {['daily', 'weekly', 'monthly'].map((t, i) => (
          <button key={t} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: statsTab === t ? 'none' : `1px solid ${THEME.border}`, background: statsTab === t ? THEME.primary : '#FFF', color: statsTab === t ? '#FFF' : THEME.textSub, fontSize: '12px', fontWeight: statsTab === t ? '700' : '400', cursor: 'pointer' }} onClick={() => setStatsTab(t)}>
            {['📅 일간', '📊 주간', '📆 월간'][i]}
          </button>
        ))}
      </div>

      {/* 일간 - 날짜 카드 클릭하면 부위별 펼쳐짐 */}
      {statsTab === 'daily' && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ ...S.cardTitle, margin: 0 }}>📅 {viewYear}년 {viewMonth}월</p>
            <YearMonthPicker />
          </div>
          {monthDays.length === 0 ? (
            <p style={{ color: THEME.textSub, fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>운동 기록이 없습니다</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {monthDays.map(date => {
                const d = byDay[date]
                const dayNum = parseInt(date.split('-')[2])
                const isToday = date === todayStr
                const isExpanded = expandedDay === date
                const activeParts = Object.entries(d.parts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
                const maxPartVol = Math.max(...activeParts.map(([, v]) => v), 1)

                return (
                  <div key={date} style={{ borderRadius: '12px', overflow: 'hidden', border: `1px solid ${isToday ? THEME.primary : THEME.border}` }}>
                    {/* 날짜 헤더 */}
                    <div
                      onClick={() => setExpandedDay(isExpanded ? null : date)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: isToday ? THEME.primary : '#FFF', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '15px', fontWeight: '700', color: isToday ? '#FFF' : THEME.text }}>{dayNum}일</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                          {activeParts.map(([part]) => (
                            <span key={part} style={{ fontSize: '10px', background: PART_COLORS[part], color: '#FFF', padding: '1px 5px', borderRadius: '6px' }}>{part}</span>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: isToday ? '#FCD34D' : THEME.primary }}>
                          {d.total >= 1000 ? (d.total / 1000).toFixed(1) + 't' : d.total + 'kg'}
                        </span>
                        <span style={{ fontSize: '12px', color: isToday ? 'rgba(255,255,255,0.7)' : THEME.textSub }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {/* 부위별 볼륨 펼침 */}
                    {isExpanded && (
                      <div style={{ padding: '12px 14px', background: THEME.cardAlt, borderTop: `1px solid ${THEME.border}` }}>
                        {activeParts.map(([part, vol]) => (
                          <div key={part} style={S.barRow}>
                            <span style={{ ...S.barLabel, width: '36px' }}>{part}</span>
                            <div style={S.barBg}>
                              <div style={{ ...S.barFill, width: `${vol / maxPartVol * 100}%`, background: PART_COLORS[part] }} />
                            </div>
                            <span style={S.barVal}>{vol.toLocaleString()}kg</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 주간 */}
      {statsTab === 'weekly' && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ ...S.cardTitle, margin: 0 }}>📊 {viewYear}년 {viewMonth}월 주차별</p>
            <YearMonthPicker />
          </div>
          {weeklyTotals.every(v => v === 0) ? (
            <p style={{ color: THEME.textSub, fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>운동 기록이 없습니다</p>
          ) : weekLabels.map((label, wk) => {
            if (weeklyTotals[wk] === 0) return null
            return (
              <div key={wk} style={{ marginBottom: '16px', background: THEME.cardAlt, borderRadius: '12px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: THEME.text }}>{label}</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#E8A020' }}>{weeklyTotals[wk].toLocaleString()}kg</span>
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
            <p style={{ ...S.cardTitle, margin: 0 }}>📆 {viewYear}년 월별</p>
            <YearMonthPicker />
          </div>
          {Object.values(monthlyByMonth).every(d => d.total === 0) ? (
            <p style={{ color: THEME.textSub, fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>운동 기록이 없습니다</p>
          ) : Object.entries(monthlyByMonth).filter(([, d]) => d.total > 0).map(([mStr, d]) => (
            <div key={mStr} style={{ marginBottom: '16px', background: THEME.cardAlt, borderRadius: '12px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: THEME.text }}>{parseInt(mStr)}월</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#4472C4' }}>{d.total.toLocaleString()}kg</span>
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
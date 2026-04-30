import React, { useState } from 'react'
import { PARTS, PART_COLORS, S, getWeekNum, weekLabels } from './utils'

export default function WorkoutStats({ allLogs }) {
  const [statsTab, setStatsTab] = useState('daily')

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // 일간 - 날짜별 그룹핑
  const byDay = {}
  allLogs.forEach(row => {
    if (!byDay[row.log_date]) byDay[row.log_date] = { total: 0, parts: {}, exercises: {} }
    byDay[row.log_date].total += row.volume || 0
    if (row.body_part) {
      byDay[row.log_date].parts[row.body_part] = (byDay[row.log_date].parts[row.body_part] || 0) + (row.volume || 0)
    }
    if (row.exercise_name) {
      const key = `${row.body_part}__${row.exercise_name}`
      byDay[row.log_date].exercises[key] = (byDay[row.log_date].exercises[key] || 0) + (row.volume || 0)
    }
  })
  const allDays = Object.keys(byDay).sort().reverse()

  // 주간 - 이번 달 주차별
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const thisMonthLogs = allLogs.filter(r => r.log_date && r.log_date.startsWith(`${year}-${month}`))

  const weeklyByPart = Array.from({ length: 5 }, () => { const o = {}; PARTS.forEach(p => o[p] = 0); return o })
  const weeklyTotals = [0, 0, 0, 0, 0]
  thisMonthLogs.forEach(row => {
    const wk = getWeekNum(row.log_date)
    if (row.body_part) weeklyByPart[wk][row.body_part] = (weeklyByPart[wk][row.body_part] || 0) + (row.volume || 0)
    weeklyTotals[wk] += row.volume || 0
  })

  // 월간 - 1~12월별
  const monthlyByMonth = {}
  for (let m = 1; m <= 12; m++) {
    const mStr = String(m).padStart(2, '0')
    monthlyByMonth[mStr] = { total: 0, parts: {} }
    PARTS.forEach(p => monthlyByMonth[mStr].parts[p] = 0)
  }
  allLogs.forEach(row => {
    if (!row.log_date) return
    const mStr = row.log_date.split('-')[1]
    monthlyByMonth[mStr].total += row.volume || 0
    if (row.body_part) monthlyByMonth[mStr].parts[row.body_part] = (monthlyByMonth[mStr].parts[row.body_part] || 0) + (row.volume || 0)
  })

  const totalAll = allLogs.reduce((sum, r) => sum + (r.volume || 0), 0)
  const todayTotal = byDay[todayStr]?.total || 0
  const thisWeekStart = new Date(now); thisWeekStart.setDate(now.getDate() - now.getDay() + 1)
  const thisWeekLogs = allLogs.filter(r => r.log_date >= thisWeekStart.toISOString().split('T')[0] && r.log_date <= todayStr)
  const thisWeekTotal = thisWeekLogs.reduce((sum, r) => sum + (r.volume || 0), 0)
  const thisMonthTotal = thisMonthLogs.reduce((sum, r) => sum + (r.volume || 0), 0)

  const maxMonthVol = Math.max(...Object.values(monthlyByMonth).map(m => m.total), 1)
  const maxWeekVol = Math.max(...weeklyTotals, 1)

  return (
    <div>
      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        {[
          { label: '오늘', val: todayTotal, color: '#4472C4' },
          { label: '이번 주', val: thisWeekTotal, color: '#2E9E3B' },
          { label: '이번 달', val: thisMonthTotal, color: '#E8A020' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: '#FFF', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
            <p style={{ fontSize: '11px', color: '#888', margin: '0 0 4px' }}>{label}</p>
            <p style={{ fontSize: '16px', fontWeight: '700', color, margin: 0 }}>
              {val >= 1000 ? (val / 1000).toFixed(1) + 't' : val + 'kg'}
            </p>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        {['daily', 'weekly', 'monthly'].map((t, i) => (
          <button key={t} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: statsTab === t ? 'none' : '1px solid #444', background: statsTab === t ? '#E8C547' : 'transparent', color: statsTab === t ? '#1A1A2E' : '#888', fontSize: '12px', fontWeight: statsTab === t ? '700' : '400', cursor: 'pointer' }} onClick={() => setStatsTab(t)}>
            {['일간', '주간', '월간'][i]}
          </button>
        ))}
      </div>

      {/* 일간 - 날짜별 3칸 그리드 */}
      {statsTab === 'daily' && (
        <div style={S.card}>
          <p style={S.cardTitle}>📅 일별 운동 기록</p>
          {allDays.length === 0 ? (
            <p style={{ color: '#888', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>운동 기록이 없습니다</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {allDays.map(date => {
                const d = byDay[date]
                const dayNum = date.split('-')[2]
                const monthNum = date.split('-')[1]
                const activeParts = Object.entries(d.parts).filter(([, v]) => v > 0)
                return (
                  <div key={date} style={{ background: date === todayStr ? '#1A1A2E' : '#F9F9F9', borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
                    <p style={{ fontSize: '12px', fontWeight: '700', color: date === todayStr ? '#E8C547' : '#1A1A2E', margin: '0 0 4px' }}>{monthNum}/{dayNum}</p>
                    <p style={{ fontSize: '13px', fontWeight: '700', color: date === todayStr ? '#FFF' : '#2E9E3B', margin: '0 0 6px' }}>
                      {d.total >= 1000 ? (d.total / 1000).toFixed(1) + 't' : d.total + 'kg'}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', justifyContent: 'center' }}>
                      {activeParts.map(([part]) => (
                        <span key={part} style={{ fontSize: '9px', background: PART_COLORS[part], color: '#FFF', padding: '1px 4px', borderRadius: '6px' }}>{part}</span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 주간 - 1~5주차 */}
      {statsTab === 'weekly' && (
        <div style={S.card}>
          <p style={S.cardTitle}>📊 주차별 부위별 볼륨 ({year}년 {month}월)</p>
          {weeklyTotals.every(v => v === 0) ? (
            <p style={{ color: '#888', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>이번 달 운동 기록이 없습니다</p>
          ) : weekLabels.map((label, wk) => {
            if (weeklyTotals[wk] === 0) return null
            return (
              <div key={wk} style={{ marginBottom: '16px', background: '#F9F9F9', borderRadius: '12px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#1A1A2E' }}>{label}</span>
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

      {/* 월간 - 1~12월 */}
      {statsTab === 'monthly' && (
        <div style={S.card}>
          <p style={S.cardTitle}>📆 월별 부위별 볼륨 ({year}년)</p>
          {totalAll === 0 ? (
            <p style={{ color: '#888', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>운동 기록이 없습니다</p>
          ) : Object.entries(monthlyByMonth).filter(([, d]) => d.total > 0).map(([mStr, d]) => (
            <div key={mStr} style={{ marginBottom: '16px', background: '#F9F9F9', borderRadius: '12px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#1A1A2E' }}>{parseInt(mStr)}월</span>
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
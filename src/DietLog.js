import React, { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { S, THEME } from './utils'

const MEAL_TYPES = ['아침', '점심', '저녁', '간식']
const MEAL_ICONS = { '아침': '🌅', '점심': '☀️', '저녁': '🌙', '간식': '🍎' }

export default function DietLog({ user, macro, tableOverride, trainerIdField }) {
  const TABLE = tableOverride || 'diet_logs'
  const ID_FIELD = trainerIdField || 'member_id'

  const [dietTab, setDietTab] = useState('record')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [dietLogs, setDietLogs] = useState([])
  const [allDietLogs, setAllDietLogs] = useState([])
  const [statsTab, setStatsTab] = useState('daily')

  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1)

  useEffect(() => { loadDietLogs(selectedDate); loadAllDietLogs() }, [])

  const loadDietLogs = async (date) => {
    const { data } = await supabase.from(TABLE).select('*').eq(ID_FIELD, user.id).eq('log_date', date).order('meal_type')
    setDietLogs(data || [])
  }

  const loadAllDietLogs = async () => {
    const { data } = await supabase.from(TABLE).select('*').eq(ID_FIELD, user.id).order('log_date')
    setAllDietLogs(data || [])
  }

  const saveDietLog = async (mealType, field, value) => {
    const existing = dietLogs.find(l => l.meal_type === mealType)
    const numVal = parseFloat(value) || 0
    const current = existing ? { carbs: existing.carbs || 0, protein: existing.protein || 0, fat: existing.fat || 0, calories: existing.calories || 0 } : { carbs: 0, protein: 0, fat: 0, calories: 0 }
    const updated = { ...current, [field]: numVal }
    if (field !== 'calories') updated.calories = Math.round(updated.carbs * 4 + updated.protein * 4 + updated.fat * 9)

    if (existing) {
      const { data } = await supabase.from(TABLE).update(updated).eq('id', existing.id).select().single()
      if (data) setDietLogs(prev => prev.map(l => l.id === data.id ? data : l))
    } else {
      const { data } = await supabase.from(TABLE).insert({ [ID_FIELD]: user.id, log_date: selectedDate, meal_type: mealType, ...updated }).select().single()
      if (data) setDietLogs(prev => [...prev, data])
    }
    loadAllDietLogs()
  }

  const getDietVal = (mealType, field) => {
    const log = dietLogs.find(l => l.meal_type === mealType)
    return log ? (log[field] || '') : ''
  }

  const getDayTotal = (field) => dietLogs.reduce((sum, l) => sum + (l[field] || 0), 0)
  const todayCarbs = getDayTotal('carbs')
  const todayProtein = getDayTotal('protein')
  const todayFat = getDayTotal('fat')
  const todayCalories = getDayTotal('calories')

  const ProgressBar = ({ label, current, target, color }) => {
    const pct = target > 0 ? Math.min(current / target * 100, 100) : 0
    const over = target > 0 && current > target
    return (
      <div style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#FFF' }}>{label}</span>
          <span style={{ fontSize: '12px', color: over ? '#FFB3B3' : '#CCC' }}>
            {Math.round(current)}{label === '칼로리' ? 'kcal' : 'g'} / {target}{label === '칼로리' ? 'kcal' : 'g'}
            {over && <span style={{ color: '#FFB3B3', marginLeft: '4px' }}>초과!</span>}
          </span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '6px', height: '10px' }}>
          <div style={{ width: `${pct}%`, background: over ? '#FF6B6B' : color, height: '10px', borderRadius: '6px', transition: 'width 0.3s' }} />
        </div>
        <div style={{ textAlign: 'right', marginTop: '2px' }}>
          <span style={{ fontSize: '11px', color: over ? '#FF6B6B' : color, fontWeight: '700' }}>{Math.round(pct)}%</span>
        </div>
      </div>
    )
  }

  // 통계 계산
  const yearStr = String(viewYear)
  const monthStr = String(viewMonth).padStart(2, '0')

  const byDay = {}
  allDietLogs.forEach(row => {
    if (!byDay[row.log_date]) byDay[row.log_date] = { carbs: 0, protein: 0, fat: 0, calories: 0 }
    byDay[row.log_date].carbs += row.carbs || 0
    byDay[row.log_date].protein += row.protein || 0
    byDay[row.log_date].fat += row.fat || 0
    byDay[row.log_date].calories += row.calories || 0
  })

  // 선택된 달의 일별
  const monthDays = Object.keys(byDay).filter(d => d.startsWith(`${yearStr}-${monthStr}`)).sort()

  // 선택된 달 주차별
  const weeklyByWeek = Array.from({ length: 5 }, () => ({ carbs: 0, protein: 0, fat: 0, calories: 0 }))
  allDietLogs.filter(r => r.log_date && r.log_date.startsWith(`${yearStr}-${monthStr}`)).forEach(row => {
    const day = parseInt(row.log_date.split('-')[2])
    const wk = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : day <= 28 ? 3 : 4
    weeklyByWeek[wk].carbs += row.carbs || 0
    weeklyByWeek[wk].protein += row.protein || 0
    weeklyByWeek[wk].fat += row.fat || 0
    weeklyByWeek[wk].calories += row.calories || 0
  })

  // 선택된 년도 월별
  const monthlyByMonth = {}
  for (let m = 1; m <= 12; m++) {
    const mStr = String(m).padStart(2, '0')
    monthlyByMonth[mStr] = { carbs: 0, protein: 0, fat: 0, calories: 0 }
  }
  allDietLogs.filter(r => r.log_date && r.log_date.startsWith(yearStr)).forEach(row => {
    const mStr = row.log_date.split('-')[1]
    monthlyByMonth[mStr].carbs += row.carbs || 0
    monthlyByMonth[mStr].protein += row.protein || 0
    monthlyByMonth[mStr].fat += row.fat || 0
    monthlyByMonth[mStr].calories += row.calories || 0
  })

  const thisMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const thisWeekStart = new Date(today); thisWeekStart.setDate(today.getDate() - today.getDay() + 1)
  const sumField = (logs, field) => logs.reduce((sum, r) => sum + (r[field] || 0), 0)
  const todayStr = today.toISOString().split('T')[0]
  const thisWeekLogs = allDietLogs.filter(r => r.log_date >= thisWeekStart.toISOString().split('T')[0])
  const thisMonthLogs = allDietLogs.filter(r => r.log_date && r.log_date.startsWith(thisMonthStr))

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

  const DietSummary = ({ data, label }) => (
    <div style={{ background: THEME.cardAlt, borderRadius: '12px', padding: '12px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: '700', color: THEME.text }}>{label}</span>
        <span style={{ fontSize: '13px', fontWeight: '700', color: THEME.danger }}>{Math.round(data.calories)}kcal</span>
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        {[{ label: '탄', val: data.carbs, color: '#4472C4' }, { label: '단', val: data.protein, color: THEME.danger }, { label: '지', val: data.fat, color: '#E8A020' }].map(({ label: l, val, color }) => (
          <div key={l} style={{ flex: 1, background: '#FFF', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
            <p style={{ fontSize: '11px', color: THEME.textSub, margin: '0 0 2px' }}>{l}수화물</p>
            <p style={{ fontSize: '14px', fontWeight: '700', color, margin: 0 }}>{Math.round(val)}g</p>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div>
      {/* 목표 달성률 카드 */}
      {macro && (
        <div style={{ background: THEME.primary, borderRadius: '16px', padding: '16px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <p style={{ fontSize: '14px', fontWeight: '700', color: '#FFF', margin: 0 }}>🎯 오늘 목표 달성률</p>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>목표 {macro.target}kcal</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            {[
              { label: '탄', val: macro.carbs, color: '#93C5FD' },
              { label: '단', val: macro.protein, color: '#FCA5A5' },
              { label: '지', val: macro.fat, color: '#FCD34D' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ flex: 1, background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '6px', textAlign: 'center' }}>
                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', margin: '0 0 2px' }}>{label}수화물</p>
                <p style={{ fontSize: '13px', fontWeight: '700', color, margin: 0 }}>{val}g</p>
              </div>
            ))}
          </div>
          <ProgressBar label="칼로리" current={todayCalories} target={macro.target} color="#FCD34D" />
          <ProgressBar label="탄수화물" current={todayCarbs} target={macro.carbs} color="#93C5FD" />
          <ProgressBar label="단백질" current={todayProtein} target={macro.protein} color="#FCA5A5" />
          <ProgressBar label="지방" current={todayFat} target={macro.fat} color="#FCD34D" />
        </div>
      )}

      {/* 탭 */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        {['record', 'stats'].map((t, i) => (
          <button key={t} style={{ flex: 1, padding: '9px', borderRadius: '8px', border: dietTab === t ? 'none' : `1px solid ${THEME.border}`, background: dietTab === t ? THEME.primary : '#FFF', color: dietTab === t ? '#FFF' : THEME.textSub, fontSize: '12px', fontWeight: dietTab === t ? '700' : '400', cursor: 'pointer' }} onClick={() => setDietTab(t)}>
            {['🍽️ 식단 기록', '📊 통계'][i]}
          </button>
        ))}
      </div>

      {/* 식단 기록 */}
      {dietTab === 'record' && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <p style={{ ...S.cardTitle, margin: 0 }}>🍽️ 식단 기록</p>
            <input type="date" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); loadDietLogs(e.target.value) }} style={S.dateInput} />
          </div>

          <div style={{ display: 'flex', gap: '6px', padding: '6px 8px', background: THEME.cardAlt, borderRadius: '8px', marginBottom: '8px' }}>
            <span style={{ flex: 1.2, fontSize: '12px', fontWeight: '700', color: THEME.textSub }}>식사</span>
            <span style={{ flex: 1, fontSize: '12px', color: '#4472C4', textAlign: 'center', fontWeight: '700' }}>탄</span>
            <span style={{ flex: 1, fontSize: '12px', color: THEME.danger, textAlign: 'center', fontWeight: '700' }}>단</span>
            <span style={{ flex: 1, fontSize: '12px', color: '#E8A020', textAlign: 'center', fontWeight: '700' }}>지</span>
            <span style={{ flex: 1, fontSize: '12px', color: THEME.textSub, textAlign: 'center', fontWeight: '700' }}>kcal</span>
          </div>

          {MEAL_TYPES.map(meal => (
            <div key={meal} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ flex: 1.2, fontSize: '13px', fontWeight: '700', color: THEME.text }}>{MEAL_ICONS[meal]} {meal}</span>
              {['carbs', 'protein', 'fat', 'calories'].map(field => (
                <input
                  key={field}
                  style={{ ...S.numInput, flex: 1, background: '#FAFAFA' }}
                  type="number"
                  placeholder="0"
                  value={getDietVal(meal, field)}
                  onChange={e => {
                    setDietLogs(prev => {
                      const exists = prev.find(l => l.meal_type === meal)
                      if (exists) return prev.map(l => l.meal_type === meal ? { ...l, [field]: e.target.value } : l)
                      return [...prev, { meal_type: meal, [field]: e.target.value }]
                    })
                  }}
                  onBlur={e => saveDietLog(meal, field, e.target.value)}
                />
              ))}
            </div>
          ))}

          <div style={{ display: 'flex', gap: '6px', padding: '10px 8px', background: THEME.primary, borderRadius: '8px', marginTop: '4px' }}>
            <span style={{ flex: 1.2, fontSize: '13px', fontWeight: '700', color: '#FFF' }}>합계</span>
            <span style={{ flex: 1, fontSize: '13px', fontWeight: '700', color: '#93C5FD', textAlign: 'center' }}>{Math.round(todayCarbs)}g</span>
            <span style={{ flex: 1, fontSize: '13px', fontWeight: '700', color: '#FCA5A5', textAlign: 'center' }}>{Math.round(todayProtein)}g</span>
            <span style={{ flex: 1, fontSize: '13px', fontWeight: '700', color: '#FCD34D', textAlign: 'center' }}>{Math.round(todayFat)}g</span>
            <span style={{ flex: 1, fontSize: '13px', fontWeight: '700', color: '#FFF', textAlign: 'center' }}>{Math.round(todayCalories)}</span>
          </div>
        </div>
      )}

      {/* 통계 */}
      {dietTab === 'stats' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            {[
              { label: '오늘', val: sumField(allDietLogs.filter(r => r.log_date === todayStr), 'calories'), color: '#4472C4' },
              { label: '이번 주', val: sumField(thisWeekLogs, 'calories'), color: THEME.primary },
              { label: '이번 달', val: sumField(thisMonthLogs, 'calories'), color: '#E8A020' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ background: '#FFF', borderRadius: '12px', padding: '12px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <p style={{ fontSize: '11px', color: THEME.textSub, margin: '0 0 4px' }}>{label}</p>
                <p style={{ fontSize: '14px', fontWeight: '700', color, margin: 0 }}>{Math.round(val)}kcal</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            {['daily', 'weekly', 'monthly'].map((t, i) => (
              <button key={t} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: statsTab === t ? 'none' : `1px solid ${THEME.border}`, background: statsTab === t ? THEME.primary : '#FFF', color: statsTab === t ? '#FFF' : THEME.textSub, fontSize: '12px', fontWeight: statsTab === t ? '700' : '400', cursor: 'pointer' }} onClick={() => setStatsTab(t)}>
                {['📅 일간', '📊 주간', '📆 월간'][i]}
              </button>
            ))}
          </div>

          {statsTab === 'daily' && (
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <p style={{ ...S.cardTitle, margin: 0 }}>📅 {viewYear}년 {viewMonth}월</p>
                <YearMonthPicker />
              </div>
              {monthDays.length === 0 ? <p style={{ color: THEME.textSub, fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>식단 기록이 없습니다</p> : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {monthDays.map(date => {
                    const d = byDay[date]
                    const isToday = date === todayStr
                    return (
                      <div key={date} style={{ background: isToday ? THEME.primary : THEME.cardAlt, borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
                        <p style={{ fontSize: '12px', fontWeight: '700', color: isToday ? '#FFF' : THEME.text, margin: '0 0 4px' }}>{date.split('-')[2]}일</p>
                        <p style={{ fontSize: '12px', fontWeight: '700', color: isToday ? '#FCD34D' : THEME.danger, margin: '0 0 4px' }}>{Math.round(d.calories)}kcal</p>
                        <p style={{ fontSize: '10px', color: isToday ? 'rgba(255,255,255,0.7)' : THEME.textSub, margin: 0 }}>탄{Math.round(d.carbs)} 단{Math.round(d.protein)} 지{Math.round(d.fat)}</p>
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
                <p style={{ ...S.cardTitle, margin: 0 }}>📊 {viewYear}년 {viewMonth}월 주차별</p>
                <YearMonthPicker />
              </div>
              {weeklyByWeek.every(w => w.calories === 0) ? <p style={{ color: THEME.textSub, fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>식단 기록이 없습니다</p>
                : weeklyByWeek.map((w, wk) => w.calories === 0 ? null : <DietSummary key={wk} data={w} label={`${wk + 1}주차`} />)}
            </div>
          )}

          {statsTab === 'monthly' && (
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <p style={{ ...S.cardTitle, margin: 0 }}>📆 {viewYear}년 월별</p>
                <YearMonthPicker />
              </div>
              {Object.entries(monthlyByMonth).filter(([, d]) => d.calories > 0).length === 0
                ? <p style={{ color: THEME.textSub, fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>식단 기록이 없습니다</p>
                : Object.entries(monthlyByMonth).filter(([, d]) => d.calories > 0).map(([mStr, d]) => <DietSummary key={mStr} data={d} label={`${parseInt(mStr)}월`} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}
import React, { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { S, THEME } from './utils'

const MEAL_TYPES = ['아침', '점심', '저녁', '간식']

const MealIcon = ({ meal }) => {
  if (meal === '아침') return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#E8A020" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>
  if (meal === '점심') return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></svg>
  if (meal === '저녁') return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg>
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#E84747" strokeWidth="2"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
}

const StatsIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></svg>
const DietTabIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2a5 5 0 0 1 5 5c0 3-5 7-5 7S7 10 7 7a5 5 0 0 1 5-5z"/><path d="M5 21h14M8 17l1-3h6l1 3"/></svg>

// 🆕 일간 그리드 카드: 하루치 탄단지 막대 (목표 점선 + 실제값)
const DayGridCard = ({ date, data, target, isToday }) => {
  const cap = (val, max) => Math.min(Math.max(val, 0), max)
  // 목표 대비 비율 (max 50px)
  const carbsTargetH = target?.carbs ? 50 : 0
  const carbsH = target?.carbs ? cap((data.carbs / target.carbs) * 50, 50) : 0
  const proTargetH = target?.protein ? 50 : 0
  const proH = target?.protein ? cap((data.protein / target.protein) * 50, 50) : 0
  const fatTargetH = target?.fat ? 50 : 0
  const fatH = target?.fat ? cap((data.fat / target.fat) * 50, 50) : 0

  return (
    <div style={{
      background: isToday ? THEME.primary : THEME.cardAlt,
      borderRadius: '10px',
      padding: '8px 6px 7px',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '11px', fontWeight: '600', color: isToday ? '#FFF' : THEME.text, marginBottom: '3px' }}>
        {date.split('-')[2]}일
      </div>
      <svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '56px', display: 'block' }}>
        <line x1="0" y1="54" x2="60" y2="54" stroke={isToday ? 'rgba(255,255,255,0.3)' : '#D3D1C7'} strokeWidth="0.6"/>
        {/* 탄수화물 */}
        {target?.carbs > 0 && <line x1="-2" y1="4" x2="22" y2="4" stroke={isToday ? '#FFF' : '#185FA5'} strokeWidth="0.9" strokeDasharray="2,1.5" opacity={isToday ? '0.6' : '0.5'}/>}
        {target?.carbs > 0 && <rect x="0" y="4" width="20" height={carbsTargetH} fill={isToday ? '#FFF' : '#378ADD'} opacity={isToday ? '0.2' : '0.18'} rx="2"/>}
        <rect x="0" y={54 - carbsH} width="20" height={carbsH} fill={isToday ? '#93C5FD' : '#378ADD'} rx="2"/>
        {/* 단백질 */}
        {target?.protein > 0 && <line x1="18" y1="4" x2="42" y2="4" stroke={isToday ? '#FFF' : '#A32D2D'} strokeWidth="0.9" strokeDasharray="2,1.5" opacity={isToday ? '0.6' : '0.5'}/>}
        {target?.protein > 0 && <rect x="20" y="4" width="20" height={proTargetH} fill={isToday ? '#FFF' : '#E24B4A'} opacity={isToday ? '0.2' : '0.18'} rx="2"/>}
        <rect x="20" y={54 - proH} width="20" height={proH} fill={isToday ? '#FCA5A5' : '#E24B4A'} rx="2"/>
        {/* 지방 */}
        {target?.fat > 0 && <line x1="38" y1="4" x2="62" y2="4" stroke={isToday ? '#FFF' : '#854F0B'} strokeWidth="0.9" strokeDasharray="2,1.5" opacity={isToday ? '0.6' : '0.5'}/>}
        {target?.fat > 0 && <rect x="40" y="4" width="20" height={fatTargetH} fill={isToday ? '#FFF' : '#EF9F27'} opacity={isToday ? '0.2' : '0.18'} rx="2"/>}
        <rect x="40" y={54 - fatH} width="20" height={fatH} fill={isToday ? '#FDBA74' : '#EF9F27'} rx="2"/>
      </svg>
      <div style={{ fontSize: '10px', color: isToday ? '#FCD34D' : '#BA7517', fontWeight: '600', marginTop: '4px' }}>
        {Math.round(data.calories)}k
      </div>
    </div>
  )
}

export default function DietLog({ user, onDietUpdate, tableOverride, trainerIdField }) {
  const TABLE = tableOverride || 'diet_logs'
  const ID_FIELD = trainerIdField || 'member_id'

  const [dietTab, setDietTab] = useState('record')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [dietLogs, setDietLogs] = useState([])
  const [allDietLogs, setAllDietLogs] = useState([])
  const [inputVals, setInputVals] = useState({})
  const [statsTab, setStatsTab] = useState('daily')
  const [saving, setSaving] = useState(false)

  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1)

  // 🆕 본인 macro 가져오기 (회원 본인의 목표수치)
  const macro = (() => { try { const s = localStorage.getItem(`macro_result_${user.id}`); return s ? JSON.parse(s) : null } catch { return null } })()
  const macroTarget = macro ? { carbs: macro.carbs, protein: macro.protein, fat: macro.fat, calories: macro.target } : null

  useEffect(() => { loadDietLogs(selectedDate); loadAllDietLogs() }, [])

  useEffect(() => {
    if (dietTab === 'stats') loadAllDietLogs()
  }, [dietTab])

  const loadDietLogs = async (date) => {
    const { data, error } = await supabase
      .from(TABLE).select('*')
      .eq(ID_FIELD, user.id)
      .eq('log_date', date)
      .order('meal_type')

    if (error) { console.error('[DietLog] loadDietLogs error:', error); return }

    const logs = data || []
    setDietLogs(logs)
    const vals = {}
    MEAL_TYPES.forEach(meal => {
      const log = logs.find(l => l.meal_type === meal)
      vals[meal] = {
        carbs: log?.carbs ?? '', protein: log?.protein ?? '',
        fat: log?.fat ?? '', calories: log?.calories ?? ''
      }
    })
    setInputVals(vals)
  }

  const loadAllDietLogs = async () => {
    const { data, error } = await supabase
      .from(TABLE).select('*')
      .eq(ID_FIELD, user.id)
      .order('log_date')

    if (error) { console.error('[DietLog] loadAllDietLogs error:', error); return null }
    setAllDietLogs(data || [])
    return data
  }

  const handleInput = (meal, field, value) => {
    setInputVals(prev => ({ ...prev, [meal]: { ...prev[meal], [field]: value } }))
  }

  const saveAll = async () => {
    if (saving) return
    setSaving(true)
    let count = 0
    const errors = []

    try {
      for (const meal of MEAL_TYPES) {
        const vals = inputVals[meal] || {}
        const carbs = parseFloat(vals.carbs) || 0
        const protein = parseFloat(vals.protein) || 0
        const fat = parseFloat(vals.fat) || 0
        const calories = parseFloat(vals.calories) || Math.round(carbs * 4 + protein * 4 + fat * 9)
        if (carbs === 0 && protein === 0 && fat === 0 && calories === 0) continue

        const existing = dietLogs.find(l => l.meal_type === meal)
        if (existing) {
          const { error } = await supabase.from(TABLE).update({ carbs, protein, fat, calories }).eq('id', existing.id)
          if (error) { errors.push(`${meal}: ${error.message}`); console.error(error); continue }
        } else {
          const { error } = await supabase.from(TABLE).insert({
            [ID_FIELD]: user.id, log_date: selectedDate, meal_type: meal,
            carbs, protein, fat, calories
          })
          if (error) { errors.push(`${meal}: ${error.message}`); console.error(error); continue }
        }
        count++
      }

      await loadDietLogs(selectedDate)
      await loadAllDietLogs()
      if (onDietUpdate) await onDietUpdate()

      if (errors.length > 0) alert(`⚠️ 저장 실패\n\n${errors.join('\n')}`)
      else if (count === 0) alert('ℹ️ 저장할 내용이 없습니다.')
      else alert(`✅ ${count}개 식사 저장 완료!`)
    } catch (err) {
      console.error('[DietLog] saveAll exception:', err)
      alert(`❌ 저장 중 오류: ${err.message || err}`)
    } finally {
      setSaving(false)
    }
  }

  const getDayTotal = (field) => dietLogs.reduce((sum, l) => sum + (l[field] || 0), 0)
  const todayCarbs = getDayTotal('carbs')
  const todayProtein = getDayTotal('protein')
  const todayFat = getDayTotal('fat')
  const todayCalories = getDayTotal('calories')

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

  // 🆕 해당 월의 1~31일 모두 생성 (기록 없는 날도 빈 카드로 표시)
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate()
  const allMonthDays = []
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${yearStr}-${monthStr}-${String(d).padStart(2, '0')}`
    allMonthDays.push({
      date: dStr,
      data: byDay[dStr] || { carbs: 0, protein: 0, fat: 0, calories: 0 }
    })
  }

  const weeklyByWeek = Array.from({ length: 5 }, () => ({ carbs: 0, protein: 0, fat: 0, calories: 0 }))
  allDietLogs.filter(r => r.log_date?.startsWith(`${yearStr}-${monthStr}`)).forEach(row => {
    const day = parseInt(row.log_date.split('-')[2])
    const wk = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : day <= 28 ? 3 : 4
    weeklyByWeek[wk].carbs += row.carbs || 0
    weeklyByWeek[wk].protein += row.protein || 0
    weeklyByWeek[wk].fat += row.fat || 0
    weeklyByWeek[wk].calories += row.calories || 0
  })

  const monthlyByMonth = {}
  for (let m = 1; m <= 12; m++) {
    const mStr = String(m).padStart(2, '0')
    monthlyByMonth[mStr] = { carbs: 0, protein: 0, fat: 0, calories: 0 }
  }
  allDietLogs.filter(r => r.log_date?.startsWith(yearStr)).forEach(row => {
    const mStr = row.log_date.split('-')[1]
    monthlyByMonth[mStr].carbs += row.carbs || 0
    monthlyByMonth[mStr].protein += row.protein || 0
    monthlyByMonth[mStr].fat += row.fat || 0
    monthlyByMonth[mStr].calories += row.calories || 0
  })

  const todayStr = today.toISOString().split('T')[0]
  const thisMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const thisWeekStart = new Date(today); thisWeekStart.setDate(today.getDate() - today.getDay() + 1)
  const sumField = (logs, field) => logs.reduce((sum, r) => sum + (r[field] || 0), 0)
  const thisWeekLogs = allDietLogs.filter(r => r.log_date >= thisWeekStart.toISOString().split('T')[0])
  const thisMonthLogs = allDietLogs.filter(r => r.log_date?.startsWith(thisMonthStr))

  const yearOptions = []
  for (let y = today.getFullYear(); y >= today.getFullYear() - 3; y--) yearOptions.push(y)

  const YearMonthPicker = ({ showMonth = true }) => (
    <div style={{ display: 'flex', gap: '6px' }}>
      <select value={viewYear} onChange={e => setViewYear(parseInt(e.target.value))} style={{ padding: '4px 8px', borderRadius: '8px', border: `1px solid ${THEME.border}`, fontSize: '13px', background: '#FFF' }}>
        {yearOptions.map(y => <option key={y} value={y}>{y}년</option>)}
      </select>
      {showMonth && (
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

  const gridStyle = { display: 'grid', gridTemplateColumns: '54px 1fr 1fr 1fr 1fr', gap: '4px', alignItems: 'center' }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
        <button onClick={() => setDietTab('record')} style={{ padding: '9px', borderRadius: '8px', border: dietTab === 'record' ? 'none' : `1px solid ${THEME.border}`, background: dietTab === 'record' ? THEME.primary : '#FFF', color: dietTab === 'record' ? '#FFF' : THEME.textSub, fontSize: '12px', fontWeight: dietTab === 'record' ? '600' : '400', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
          <DietTabIcon />식단 기록
        </button>
        <button onClick={() => setDietTab('stats')} style={{ padding: '9px', borderRadius: '8px', border: dietTab === 'stats' ? 'none' : `1px solid ${THEME.border}`, background: dietTab === 'stats' ? THEME.primary : '#FFF', color: dietTab === 'stats' ? '#FFF' : THEME.textSub, fontSize: '12px', fontWeight: dietTab === 'stats' ? '600' : '400', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
          <StatsIcon />통계
        </button>
      </div>

      {dietTab === 'record' && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ ...S.cardTitle, margin: 0 }}>식단 기록</p>
            <input type="date" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); loadDietLogs(e.target.value) }} style={S.dateInput} />
          </div>

          <div style={{ ...gridStyle, padding: '5px 4px', background: THEME.cardAlt, borderRadius: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: THEME.textSub, fontWeight: '600', paddingLeft: '2px' }}>식사</span>
            <span style={{ fontSize: '11px', color: '#4472C4', textAlign: 'center', fontWeight: '600' }}>탄</span>
            <span style={{ fontSize: '11px', color: THEME.danger, textAlign: 'center', fontWeight: '600' }}>단</span>
            <span style={{ fontSize: '11px', color: '#E8A020', textAlign: 'center', fontWeight: '600' }}>지</span>
            <span style={{ fontSize: '11px', color: THEME.textSub, textAlign: 'center', fontWeight: '600' }}>kcal</span>
          </div>

          {MEAL_TYPES.map(meal => (
            <div key={meal} style={{ ...gridStyle, marginBottom: '7px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: THEME.text, display: 'flex', alignItems: 'center', gap: '3px' }}>
                <MealIcon meal={meal} />{meal}
              </span>
              {['carbs', 'protein', 'fat', 'calories'].map(field => (
                <input
                  key={field}
                  style={{ padding: '6px 2px', borderRadius: '6px', border: `0.5px solid ${THEME.border}`, fontSize: '12px', textAlign: 'center', width: '100%', boxSizing: 'border-box', background: '#FAFAFA' }}
                  type="number"
                  placeholder="0"
                  value={inputVals[meal]?.[field] ?? ''}
                  onChange={e => handleInput(meal, field, e.target.value)}
                />
              ))}
            </div>
          ))}

          <div style={{ ...gridStyle, padding: '9px 8px', background: THEME.primary, borderRadius: '8px', marginTop: '4px', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#FFF' }}>합계</span>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#93C5FD', textAlign: 'center' }}>{Math.round(todayCarbs)}g</span>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#FCA5A5', textAlign: 'center' }}>{Math.round(todayProtein)}g</span>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#FCD34D', textAlign: 'center' }}>{Math.round(todayFat)}g</span>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#FFF', textAlign: 'center' }}>{Math.round(todayCalories)}</span>
          </div>

          <button
            style={{ ...S.btnPrimary, fontSize: '15px', opacity: saving ? 0.6 : 1, cursor: saving ? 'wait' : 'pointer' }}
            onClick={saveAll}
            disabled={saving}
          >
            {saving ? '⏳ 저장 중...' : '💾 저장'}
          </button>
        </div>
      )}

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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '10px' }}>
            {['daily', 'weekly', 'monthly'].map((t, i) => (
              <button key={t} style={{ padding: '8px', borderRadius: '8px', border: statsTab === t ? 'none' : `1px solid ${THEME.border}`, background: statsTab === t ? THEME.primary : '#FFF', color: statsTab === t ? '#FFF' : THEME.textSub, fontSize: '12px', fontWeight: statsTab === t ? '600' : '400', cursor: 'pointer' }} onClick={() => setStatsTab(t)}>
                {['일간', '주간', '월간'][i]}
              </button>
            ))}
          </div>

          {/* 🆕 일간 — 31일 그리드 그래프 */}
          {statsTab === 'daily' && (
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <p style={{ ...S.cardTitle, margin: 0 }}>{viewYear}년 {viewMonth}월</p>
                <YearMonthPicker />
              </div>

              {/* 범례 */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', padding: '0 2px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><div style={{ width: '8px', height: '8px', background: '#378ADD', borderRadius: '2px' }} /><span style={{ fontSize: '9px', color: THEME.textSub }}>탄</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><div style={{ width: '8px', height: '8px', background: '#E24B4A', borderRadius: '2px' }} /><span style={{ fontSize: '9px', color: THEME.textSub }}>단</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><div style={{ width: '8px', height: '8px', background: '#EF9F27', borderRadius: '2px' }} /><span style={{ fontSize: '9px', color: THEME.textSub }}>지</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginLeft: 'auto' }}><div style={{ width: '12px', borderTop: '1px dashed #888780' }} /><span style={{ fontSize: '9px', color: THEME.textSub }}>목표</span></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '7px' }}>
                {allMonthDays.map(({ date, data }) => (
                  <DayGridCard key={date} date={date} data={data} target={macroTarget} isToday={date === todayStr} />
                ))}
              </div>
            </div>
          )}

          {statsTab === 'weekly' && (
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <p style={{ ...S.cardTitle, margin: 0 }}>{viewYear}년 {viewMonth}월 주차별</p>
                <YearMonthPicker />
              </div>
              {weeklyByWeek.every(w => w.calories === 0) ? <p style={{ color: THEME.textSub, fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>식단 기록이 없습니다</p>
                : weeklyByWeek.map((w, wk) => w.calories === 0 ? null : <DietSummary key={wk} data={w} label={`${wk + 1}주차`} />)}
            </div>
          )}

          {statsTab === 'monthly' && (
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <p style={{ ...S.cardTitle, margin: 0 }}>{viewYear}년 월별</p>
                <YearMonthPicker showMonth={false} />
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
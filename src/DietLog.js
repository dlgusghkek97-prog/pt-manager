import React, { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { S, THEME, calcWeightCalories } from './utils'
import DatePicker from './DatePicker'

const MEALS = [
  { key: 'breakfast', label: '아침', icon: '☀️' },
  { key: 'lunch', label: '점심', icon: '◐' },
  { key: 'dinner', label: '저녁', icon: '🌙' },
  { key: 'snack', label: '간식', icon: '📍' },
]

const NUTRIENTS = [
  { key: 'calories', label: '칼로리', unit: 'kcal', color: '#FCD34D' },
  { key: 'carbs', label: '탄수화물', unit: 'g', color: '#4472C4' },
  { key: 'protein', label: '단백질', unit: 'g', color: '#E84747' },
  { key: 'fat', label: '지방', unit: 'g', color: '#E8A020' },
  { key: 'net', label: '잉여/적자', unit: 'kcal', color: '#10B981' },
]

const COLOR_SURPLUS = '#4472C4'  // 파랑 = 초과 (살찜)
const COLOR_DEFICIT = '#E24B4A'  // 빨강 = 적자 (빠짐)
const COLOR_TODAY = '#2E7D52'    // 초록 = 오늘/이번달

export default function DietLog({ user, onDietUpdate, tableOverride, trainerIdField, weight, muscle, workoutTable, workoutIdField }) {
  const TABLE = tableOverride || 'diet_logs'
  const ID_FIELD = trainerIdField || 'member_id'
  const W_TABLE = workoutTable || 'workout_logs'
  const W_ID_FIELD = workoutIdField || 'member_id'

  const [tab, setTab] = useState('log')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [statMode, setStatMode] = useState('week')
  const [statValue, setStatValue] = useState(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const w = Math.ceil(d.getDate() / 7)
    return `${y}-${String(m).padStart(2, '0')}-W${w}`
  })
  const [activeNutrient, setActiveNutrient] = useState('calories')

  const emptyMeal = { carbs: '', protein: '', fat: '', calories: '' }
  const [meals, setMeals] = useState({
    breakfast: { ...emptyMeal },
    lunch: { ...emptyMeal },
    dinner: { ...emptyMeal },
    snack: { ...emptyMeal },
  })
  const [logIds, setLogIds] = useState({})
  const [statsLogs, setStatsLogs] = useState([])
  const [statsWorkouts, setStatsWorkouts] = useState([])

  useEffect(() => { loadLogs(selectedDate) }, [selectedDate, user.id])
  useEffect(() => { if (tab === 'stats') loadStatsLogs() }, [tab, statMode, statValue])

  const loadLogs = async (date) => {
    const { data, error } = await supabase.from(TABLE).select('*').eq(ID_FIELD, user.id).eq('log_date', date)
    if (error) { console.error('[DietLog] load error:', error); return }
    const next = {
      breakfast: { ...emptyMeal },
      lunch: { ...emptyMeal },
      dinner: { ...emptyMeal },
      snack: { ...emptyMeal },
    }
    const ids = {}
    ;(data || []).forEach(row => {
      if (next[row.meal_type]) {
        next[row.meal_type] = {
          carbs: row.carbs ?? '',
          protein: row.protein ?? '',
          fat: row.fat ?? '',
          calories: row.calories ?? '',
        }
        ids[row.meal_type] = row.id
      }
    })
    setMeals(next)
    setLogIds(ids)
  }

  const updateField = (mealKey, field, value) => {
    setMeals(prev => ({
      ...prev,
      [mealKey]: { ...prev[mealKey], [field]: value }
    }))
  }

  const saveAll = async () => {
    let savedCount = 0
    const errors = []
    for (const m of MEALS) {
      const meal = meals[m.key]
      const carbs = parseFloat(meal.carbs) || 0
      const protein = parseFloat(meal.protein) || 0
      const fat = parseFloat(meal.fat) || 0
      let calories = parseFloat(meal.calories) || 0
      if (!calories && (carbs || protein || fat)) {
        calories = Math.round(carbs * 4 + protein * 4 + fat * 9)
      }
      if (!carbs && !protein && !fat && !calories) {
        if (logIds[m.key]) {
          const { error } = await supabase.from(TABLE).delete().eq('id', logIds[m.key])
          if (error) errors.push(`${m.label} 삭제 실패: ${error.message}`)
        }
        continue
      }
      const payload = {
        [ID_FIELD]: user.id,
        log_date: selectedDate,
        meal_type: m.key,
        carbs, protein, fat, calories,
      }
      if (logIds[m.key]) {
        const { error } = await supabase.from(TABLE).update(payload).eq('id', logIds[m.key])
        if (error) errors.push(`${m.label} 업데이트 실패: ${error.message}`)
        else savedCount++
      } else {
        const { data, error } = await supabase.from(TABLE).insert(payload).select().single()
        if (error) errors.push(`${m.label} 저장 실패: ${error.message}`)
        else if (data) {
          setLogIds(prev => ({ ...prev, [m.key]: data.id }))
          savedCount++
        }
      }
    }
    if (errors.length > 0) {
      alert(`⚠️ 일부 저장 실패\n\n${errors.join('\n')}`)
    } else {
      alert(`✅ ${savedCount}개 식사 저장 완료!`)
    }
    if (onDietUpdate) await onDietUpdate()
    await loadLogs(selectedDate)
  }

  const loadStatsLogs = async () => {
    let dateRange = {}
    if (statMode === 'week') {
      const match = statValue.match(/^(\d+)-(\d+)-W(\d+)$/)
      if (!match) { setStatsLogs([]); setStatsWorkouts([]); return }
      const [, y, m, w] = match.map(Number)
      const startDay = (w - 1) * 7 + 1
      const endDay = Math.min(startDay + 6, new Date(y, m, 0).getDate())
      dateRange = {
        start: `${y}-${String(m).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`,
        end: `${y}-${String(m).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`
      }
    } else if (statMode === 'year') {
      const y = parseInt(statValue)
      dateRange = {
        start: `${y}-01-01`,
        end: `${y}-12-31`
      }
    }

    let dietQ = supabase.from(TABLE).select('*').eq(ID_FIELD, user.id).gte('log_date', dateRange.start).lte('log_date', dateRange.end)
    let workoutQ = supabase.from(W_TABLE).select('*').eq(W_ID_FIELD, user.id).gte('log_date', dateRange.start).lte('log_date', dateRange.end)

    const [{ data: dData, error: dErr }, { data: wData, error: wErr }] = await Promise.all([dietQ, workoutQ])
    if (dErr) console.error('[DietLog] diet stats error:', dErr)
    if (wErr) console.error('[DietLog] workout stats error:', wErr)
    setStatsLogs(dData || [])
    setStatsWorkouts(wData || [])
  }

  const totals = {
    carbs: Object.values(meals).reduce((s, m) => s + (parseFloat(m.carbs) || 0), 0),
    protein: Object.values(meals).reduce((s, m) => s + (parseFloat(m.protein) || 0), 0),
    fat: Object.values(meals).reduce((s, m) => s + (parseFloat(m.fat) || 0), 0),
    calories: Object.values(meals).reduce((s, m) => {
      const c = parseFloat(m.calories) || 0
      if (c) return s + c
      const carbs = parseFloat(m.carbs) || 0
      const protein = parseFloat(m.protein) || 0
      const fat = parseFloat(m.fat) || 0
      return s + Math.round(carbs * 4 + protein * 4 + fat * 9)
    }, 0),
  }

  const cellStyle = {
    width: '100%',
    padding: '8px 4px',
    border: `0.5px solid ${THEME.border}`,
    borderRadius: '6px',
    fontSize: '13px',
    textAlign: 'center',
    background: '#FFF',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  }

  const calcBurnedByDate = (dateStr) => {
    const sameDay = statsWorkouts.filter(r => r.log_date === dateStr)
    const cardioCal = sameDay.filter(r => r.exercise_type === 'cardio').reduce((s, r) => s + (r.calories_burned || 0), 0)
    const weightLogs = sameDay.filter(r => r.exercise_type !== 'cardio')
    const volume = weightLogs.reduce((s, r) => s + (r.volume || 0), 0)
    const totalSets = weightLogs.length
    const weightCal = calcWeightCalories({ volume, totalSets, weight, muscle })
    return cardioCal + weightCal
  }

  const weekDailyTotals = (() => {
    const map = {}
    if (statMode !== 'week') return map
    const match = statValue.match(/^(\d+)-(\d+)-W(\d+)$/)
    if (!match) return map
    const [, y, mo, w] = match.map(Number)
    const startDay = (w - 1) * 7 + 1
    const endDay = Math.min(startDay + 6, new Date(y, mo, 0).getDate())
    for (let d = startDay; d <= endDay; d++) {
      const dateStr = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      map[dateStr] = { calories: 0, carbs: 0, protein: 0, fat: 0, burned: calcBurnedByDate(dateStr) }
    }
    statsLogs.forEach(r => {
      if (map[r.log_date]) {
        map[r.log_date].calories += r.calories || 0
        map[r.log_date].carbs += r.carbs || 0
        map[r.log_date].protein += r.protein || 0
        map[r.log_date].fat += r.fat || 0
      }
    })
    return map
  })()
  const weekDates = Object.keys(weekDailyTotals).sort()

  const yearMonthlyAvg = (() => {
    const map = {}
    if (statMode !== 'year') return map
    for (let m = 1; m <= 12; m++) {
      map[m] = { calories: 0, carbs: 0, protein: 0, fat: 0, burned: 0, days: new Set() }
    }
    const dailyDiet = {}
    statsLogs.forEach(r => {
      if (!dailyDiet[r.log_date]) dailyDiet[r.log_date] = { calories: 0, carbs: 0, protein: 0, fat: 0 }
      dailyDiet[r.log_date].calories += r.calories || 0
      dailyDiet[r.log_date].carbs += r.carbs || 0
      dailyDiet[r.log_date].protein += r.protein || 0
      dailyDiet[r.log_date].fat += r.fat || 0
    })
    Object.entries(dailyDiet).forEach(([date, v]) => {
      const month = parseInt(date.split('-')[1])
      if (map[month]) {
        map[month].calories += v.calories
        map[month].carbs += v.carbs
        map[month].protein += v.protein
        map[month].fat += v.fat
        if (v.calories > 0) map[month].days.add(date)
      }
    })
    const dailyBurn = {}
    statsWorkouts.forEach(r => {
      if (!dailyBurn[r.log_date]) dailyBurn[r.log_date] = { volume: 0, sets: 0, cardio: 0 }
      if (r.exercise_type === 'cardio') {
        dailyBurn[r.log_date].cardio += r.calories_burned || 0
      } else {
        dailyBurn[r.log_date].volume += r.volume || 0
        dailyBurn[r.log_date].sets += 1
      }
    })
    Object.entries(dailyBurn).forEach(([date, v]) => {
      const month = parseInt(date.split('-')[1])
      const burned = v.cardio + calcWeightCalories({ volume: v.volume, totalSets: v.sets, weight, muscle })
      if (map[month]) {
        map[month].burned += burned
        if (burned > 0) map[month].days.add(date)
      }
    })
    const result = {}
    for (let m = 1; m <= 12; m++) {
      const dayCount = map[m].days.size
      result[m] = {
        calories: dayCount > 0 ? Math.round(map[m].calories / dayCount) : 0,
        carbs: dayCount > 0 ? Math.round(map[m].carbs / dayCount) : 0,
        protein: dayCount > 0 ? Math.round(map[m].protein / dayCount) : 0,
        fat: dayCount > 0 ? Math.round(map[m].fat / dayCount) : 0,
        burned: dayCount > 0 ? Math.round(map[m].burned / dayCount) : 0,
        days: dayCount,
      }
    }
    return result
  })()

  const today = new Date().toISOString().split('T')[0]
  const currentNutrient = NUTRIENTS.find(n => n.key === activeNutrient)
  const thisYear = new Date().getFullYear()
  const thisMonth = new Date().getMonth() + 1
  const isThisYear = statMode === 'year' && parseInt(statValue) === thisYear

  const weekCalIntakeTotal = weekDates.reduce((s, d) => s + weekDailyTotals[d].calories, 0)
  const weekBurnedTotal = weekDates.reduce((s, d) => s + weekDailyTotals[d].burned, 0)
  const recordedDays = weekDates.filter(d => weekDailyTotals[d].calories > 0).length
  const weekAvgIntake = recordedDays > 0 ? Math.round(weekCalIntakeTotal / recordedDays) : 0
  const weekAvgBurned = recordedDays > 0 ? Math.round(weekBurnedTotal / recordedDays) : 0
  const weekAvgNet = weekAvgIntake - weekAvgBurned

  const recordedMonths = Object.values(yearMonthlyAvg).filter(v => v.days > 0).length
  const yearAvgIntake = recordedMonths > 0 ? Math.round(Object.values(yearMonthlyAvg).reduce((s, v) => s + v.calories, 0) / recordedMonths) : 0
  const yearAvgBurned = recordedMonths > 0 ? Math.round(Object.values(yearMonthlyAvg).reduce((s, v) => s + v.burned, 0) / recordedMonths) : 0
  const yearAvgNet = yearAvgIntake - yearAvgBurned

  const CHART_VIEWBOX = "0 0 320 170"
  const CHART_TOP = 30
  const CHART_BOTTOM = 135
  const CHART_HEIGHT = CHART_BOTTOM - CHART_TOP

  const CalorieChart = ({ mode }) => {
    let data, labels, burnedData, todayIdx
    if (mode === 'week') {
      data = weekDates.map(d => weekDailyTotals[d].calories)
      labels = weekDates.map(d => `${parseInt(d.split('-')[2])}일`)
      burnedData = weekDates.map(d => weekDailyTotals[d].burned)
      todayIdx = weekDates.indexOf(today)
    } else {
      data = []; labels = []; burnedData = []
      for (let m = 1; m <= 12; m++) {
        data.push(yearMonthlyAvg[m].calories)
        burnedData.push(yearMonthlyAvg[m].burned)
        labels.push(`${m}월`)
      }
      todayIdx = isThisYear ? thisMonth - 1 : -1
    }

    const maxVal = Math.max(...data, ...burnedData, 100)
    const groupCount = data.length
    const usableW = 290
    const barW = mode === 'year' ? 6 : 10
    const groupW = barW * 2 + 2
    const gap = (usableW - groupCount * groupW) / (groupCount + 1)

    return (
      <svg viewBox={CHART_VIEWBOX} style={{ width: '100%', height: 'auto' }}>
        <line x1="20" y1={CHART_TOP} x2="310" y2={CHART_TOP} stroke="#eee" strokeWidth="0.5" />
        <line x1="20" y1={CHART_TOP + CHART_HEIGHT * 0.33} x2="310" y2={CHART_TOP + CHART_HEIGHT * 0.33} stroke="#eee" strokeWidth="0.5" />
        <line x1="20" y1={CHART_TOP + CHART_HEIGHT * 0.66} x2="310" y2={CHART_TOP + CHART_HEIGHT * 0.66} stroke="#eee" strokeWidth="0.5" />
        <line x1="20" y1={CHART_BOTTOM} x2="310" y2={CHART_BOTTOM} stroke="#ddd" strokeWidth="1" />
        <text x="14" y={CHART_TOP + 4} textAnchor="end" fontSize="9" fill="#aaa">{Math.ceil(maxVal)}</text>
        <text x="14" y={CHART_TOP + CHART_HEIGHT * 0.33 + 4} textAnchor="end" fontSize="9" fill="#aaa">{Math.ceil(maxVal * 0.66)}</text>
        <text x="14" y={CHART_TOP + CHART_HEIGHT * 0.66 + 4} textAnchor="end" fontSize="9" fill="#aaa">{Math.ceil(maxVal * 0.33)}</text>

        {data.map((val, i) => {
          const xStart = 20 + gap + i * (groupW + gap)
          const intakeH = val > 0 ? (val / maxVal) * CHART_HEIGHT : 0
          const burnedH = burnedData[i] > 0 ? (burnedData[i] / maxVal) * CHART_HEIGHT : 0
          const intakeY = CHART_BOTTOM - intakeH
          const burnedY = CHART_BOTTOM - burnedH
          const isToday = i === todayIdx
          return (
            <g key={i}>
              {val > 0 && (
                <rect x={xStart} y={intakeY} width={barW} height={intakeH} rx="2" fill={isToday ? COLOR_TODAY : '#FCD34D'} />
              )}
              {burnedData[i] > 0 && (
                <rect x={xStart + barW + 2} y={burnedY} width={barW} height={burnedH} rx="2" fill="#FF6B6B" />
              )}
              <text x={xStart + groupW / 2} y="152" textAnchor="middle" fontSize={mode === 'year' ? '8' : '10'} fill={isToday ? COLOR_TODAY : '#888'} fontWeight={isToday ? '700' : '400'}>
                {labels[i]}
              </text>
            </g>
          )
        })}
      </svg>
    )
  }

  const NutrientChart = ({ nutrientKey, color }) => {
    let data, labels, todayIdx
    if (statMode === 'week') {
      data = weekDates.map(d => weekDailyTotals[d][nutrientKey])
      labels = weekDates.map(d => `${parseInt(d.split('-')[2])}일`)
      todayIdx = weekDates.indexOf(today)
    } else {
      data = []; labels = []
      for (let m = 1; m <= 12; m++) {
        data.push(yearMonthlyAvg[m][nutrientKey])
        labels.push(`${m}월`)
      }
      todayIdx = isThisYear ? thisMonth - 1 : -1
    }

    const maxVal = Math.max(...data, 10)
    const barW = statMode === 'year' ? 14 : 22
    const usableW = 290
    const gap = (usableW - data.length * barW) / (data.length + 1)

    return (
      <svg viewBox={CHART_VIEWBOX} style={{ width: '100%', height: 'auto' }}>
        <line x1="20" y1={CHART_TOP} x2="310" y2={CHART_TOP} stroke="#eee" strokeWidth="0.5" />
        <line x1="20" y1={CHART_TOP + CHART_HEIGHT * 0.33} x2="310" y2={CHART_TOP + CHART_HEIGHT * 0.33} stroke="#eee" strokeWidth="0.5" />
        <line x1="20" y1={CHART_TOP + CHART_HEIGHT * 0.66} x2="310" y2={CHART_TOP + CHART_HEIGHT * 0.66} stroke="#eee" strokeWidth="0.5" />
        <line x1="20" y1={CHART_BOTTOM} x2="310" y2={CHART_BOTTOM} stroke="#ddd" strokeWidth="1" />
        <text x="14" y={CHART_TOP + 4} textAnchor="end" fontSize="9" fill="#aaa">{Math.ceil(maxVal)}</text>
        <text x="14" y={CHART_TOP + CHART_HEIGHT * 0.33 + 4} textAnchor="end" fontSize="9" fill="#aaa">{Math.ceil(maxVal * 0.66)}</text>
        <text x="14" y={CHART_TOP + CHART_HEIGHT * 0.66 + 4} textAnchor="end" fontSize="9" fill="#aaa">{Math.ceil(maxVal * 0.33)}</text>

        {data.map((val, i) => {
          const x = 20 + gap + i * (barW + gap)
          const h = val > 0 ? (val / maxVal) * CHART_HEIGHT : 0
          const y = CHART_BOTTOM - h
          const isToday = i === todayIdx
          return (
            <g key={i}>
              {val > 0 && (
                <>
                  <rect x={x} y={y} width={barW} height={h} rx="3" fill={isToday ? COLOR_TODAY : color} />
                  <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={statMode === 'year' ? '7' : '9'} fill={isToday ? COLOR_TODAY : '#333'} fontWeight={isToday ? '700' : '600'}>
                    {Math.round(val)}
                  </text>
                </>
              )}
              <text x={x + barW / 2} y="152" textAnchor="middle" fontSize={statMode === 'year' ? '8' : '10'} fill={isToday ? COLOR_TODAY : '#888'} fontWeight={isToday ? '700' : '400'}>
                {labels[i]}
              </text>
            </g>
          )
        })}
      </svg>
    )
  }

  const NetChart = () => {
    let rawData, labels, todayIdx
    if (statMode === 'week') {
      rawData = weekDates.map(d => weekDailyTotals[d].calories - weekDailyTotals[d].burned)
      labels = weekDates.map(d => `${parseInt(d.split('-')[2])}일`)
      todayIdx = weekDates.indexOf(today)
    } else {
      rawData = []; labels = []
      for (let m = 1; m <= 12; m++) {
        rawData.push(yearMonthlyAvg[m].calories - yearMonthlyAvg[m].burned)
        labels.push(`${m}월`)
      }
      todayIdx = isThisYear ? thisMonth - 1 : -1
    }

    const absData = rawData.map(v => Math.abs(v))
    const maxVal = Math.max(...absData, 100)
    const barW = statMode === 'year' ? 14 : 22
    const usableW = 290
    const gap = (usableW - rawData.length * barW) / (rawData.length + 1)

    return (
      <svg viewBox={CHART_VIEWBOX} style={{ width: '100%', height: 'auto' }}>
        <line x1="20" y1={CHART_TOP} x2="310" y2={CHART_TOP} stroke="#eee" strokeWidth="0.5" />
        <line x1="20" y1={CHART_TOP + CHART_HEIGHT * 0.33} x2="310" y2={CHART_TOP + CHART_HEIGHT * 0.33} stroke="#eee" strokeWidth="0.5" />
        <line x1="20" y1={CHART_TOP + CHART_HEIGHT * 0.66} x2="310" y2={CHART_TOP + CHART_HEIGHT * 0.66} stroke="#eee" strokeWidth="0.5" />
        <line x1="20" y1={CHART_BOTTOM} x2="310" y2={CHART_BOTTOM} stroke="#ddd" strokeWidth="1" />
        <text x="14" y={CHART_TOP + 4} textAnchor="end" fontSize="9" fill="#aaa">{Math.ceil(maxVal)}</text>
        <text x="14" y={CHART_TOP + CHART_HEIGHT * 0.33 + 4} textAnchor="end" fontSize="9" fill="#aaa">{Math.ceil(maxVal * 0.66)}</text>
        <text x="14" y={CHART_TOP + CHART_HEIGHT * 0.66 + 4} textAnchor="end" fontSize="9" fill="#aaa">{Math.ceil(maxVal * 0.33)}</text>

        {rawData.map((val, i) => {
          const x = 20 + gap + i * (barW + gap)
          const h = Math.abs(val) > 0 ? (Math.abs(val) / maxVal) * CHART_HEIGHT : 0
          const y = CHART_BOTTOM - h
          const isToday = i === todayIdx
          const fillColor = isToday ? COLOR_TODAY : (val >= 0 ? COLOR_SURPLUS : COLOR_DEFICIT)
          const labelColor = isToday ? COLOR_TODAY : (val >= 0 ? COLOR_SURPLUS : COLOR_DEFICIT)
          return (
            <g key={i}>
              {val !== 0 && (
                <>
                  <rect x={x} y={y} width={barW} height={h} rx="3" fill={fillColor} />
                  <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={statMode === 'year' ? '7' : '9'} fill={labelColor} fontWeight="700">
                    {val > 0 ? `+${Math.round(val)}` : Math.round(val)}
                  </text>
                </>
              )}
              <text x={x + barW / 2} y="152" textAnchor="middle" fontSize={statMode === 'year' ? '8' : '10'} fill={isToday ? COLOR_TODAY : '#888'} fontWeight={isToday ? '700' : '400'}>
                {labels[i]}
              </text>
            </g>
          )
        })}
      </svg>
    )
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '12px' }}>
        <button onClick={() => setTab('log')} style={{ background: tab === 'log' ? THEME.primary : '#FFF', color: tab === 'log' ? '#FFF' : THEME.textSub, border: tab === 'log' ? 'none' : `0.5px solid ${THEME.border}`, borderRadius: '10px', padding: '11px', fontSize: '13px', fontWeight: tab === 'log' ? '600' : '400', cursor: 'pointer' }}>
          식단 기록
        </button>
        <button onClick={() => setTab('stats')} style={{ background: tab === 'stats' ? THEME.primary : '#FFF', color: tab === 'stats' ? '#FFF' : THEME.textSub, border: tab === 'stats' ? 'none' : `0.5px solid ${THEME.border}`, borderRadius: '10px', padding: '11px', fontSize: '13px', fontWeight: tab === 'stats' ? '600' : '400', cursor: 'pointer' }}>
          통계
        </button>
      </div>

      {tab === 'log' && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '12px' }}>
            <p style={{ ...S.cardTitle, margin: 0, flexShrink: 0 }}>식단 기록</p>
            <div style={{ flex: 1, maxWidth: '260px' }}>
              <DatePicker value={selectedDate} onChange={setSelectedDate} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr 1fr', gap: '6px', marginBottom: '6px', alignItems: 'center', padding: '0 4px' }}>
            <span style={{ fontSize: '11px', color: THEME.textSub, fontWeight: '500' }}>식사</span>
            <span style={{ fontSize: '10px', color: '#4472C4', textAlign: 'center', fontWeight: '600' }}>탄수화물</span>
            <span style={{ fontSize: '10px', color: '#E84747', textAlign: 'center', fontWeight: '600' }}>단백질</span>
            <span style={{ fontSize: '10px', color: '#E8A020', textAlign: 'center', fontWeight: '600' }}>지방</span>
            <span style={{ fontSize: '11px', color: THEME.textSub, textAlign: 'center', fontWeight: '500' }}>kcal</span>
          </div>

          {MEALS.map(m => (
            <div key={m.key} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr 1fr', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '14px' }}>{m.icon}</span>
                <span style={{ fontSize: '12px', color: THEME.text, fontWeight: '500' }}>{m.label}</span>
              </div>
              <input style={cellStyle} type="number" inputMode="decimal" placeholder="0" value={meals[m.key].carbs} onChange={e => updateField(m.key, 'carbs', e.target.value)} />
              <input style={cellStyle} type="number" inputMode="decimal" placeholder="0" value={meals[m.key].protein} onChange={e => updateField(m.key, 'protein', e.target.value)} />
              <input style={cellStyle} type="number" inputMode="decimal" placeholder="0" value={meals[m.key].fat} onChange={e => updateField(m.key, 'fat', e.target.value)} />
              <input style={cellStyle} type="number" inputMode="numeric" placeholder="0" value={meals[m.key].calories} onChange={e => updateField(m.key, 'calories', e.target.value)} />
            </div>
          ))}

          <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr 1fr', gap: '6px', marginTop: '10px', alignItems: 'center', background: THEME.primary, padding: '10px 4px', borderRadius: '8px' }}>
            <span style={{ fontSize: '12px', color: '#FFF', fontWeight: '600', paddingLeft: '6px' }}>합계</span>
            <span style={{ fontSize: '13px', color: '#93C5FD', textAlign: 'center', fontWeight: '600' }}>{Math.round(totals.carbs)}g</span>
            <span style={{ fontSize: '13px', color: '#FCA5A5', textAlign: 'center', fontWeight: '600' }}>{Math.round(totals.protein)}g</span>
            <span style={{ fontSize: '13px', color: '#FDBA74', textAlign: 'center', fontWeight: '600' }}>{Math.round(totals.fat)}g</span>
            <span style={{ fontSize: '13px', color: '#FCD34D', textAlign: 'center', fontWeight: '700' }}>{Math.round(totals.calories)}</span>
          </div>

          <button style={{ ...S.btnPrimary, marginTop: '12px', fontSize: '15px' }} onClick={saveAll}>💾 저장</button>

          <p style={{ fontSize: '10px', color: THEME.textSub, margin: '8px 0 0', textAlign: 'center' }}>
            칼로리를 비워두면 자동 계산됩니다 (탄·단 × 4 + 지 × 9)
          </p>
        </div>
      )}

      {tab === 'stats' && (
        <div style={S.card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '12px' }}>
            {[
              { key: 'week', label: '주간' },
              { key: 'year', label: '월간' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => {
                setStatMode(key)
                if (key === 'week') {
                  const d = new Date()
                  const y = d.getFullYear()
                  const m = d.getMonth() + 1
                  const w = Math.ceil(d.getDate() / 7)
                  setStatValue(`${y}-${String(m).padStart(2, '0')}-W${w}`)
                } else if (key === 'year') {
                  setStatValue(String(new Date().getFullYear()))
                }
              }} style={{
                background: statMode === key ? THEME.primary : '#FFF',
                color: statMode === key ? '#FFF' : THEME.textSub,
                border: statMode === key ? 'none' : `0.5px solid ${THEME.border}`,
                borderRadius: '8px',
                padding: '8px',
                fontSize: '12px',
                fontWeight: statMode === key ? '600' : '400',
                cursor: 'pointer'
              }}>{label}</button>
            ))}
          </div>

          <div style={{ marginBottom: '14px' }}>
            <DatePicker value={statValue} onChange={setStatValue} mode={statMode} />
          </div>

          <div style={{ background: '#FAFAF7', borderRadius: '12px', padding: '14px 8px', border: `0.5px solid ${THEME.border}`, marginBottom: '12px' }}>
            <div style={{ padding: '0 8px 8px' }}>
              {statMode === 'week' ? (
                <>
                  <p style={{ fontSize: '11px', color: THEME.textSub, margin: 0 }}>평균</p>
                  {activeNutrient === 'net' ? (
                    <p style={{ fontSize: '22px', fontWeight: '700', color: weekAvgNet >= 0 ? COLOR_SURPLUS : COLOR_DEFICIT, margin: 0 }}>
                      {weekAvgNet >= 0 ? '+' : ''}{weekAvgNet}
                      <span style={{ fontSize: '13px', color: THEME.textSub, fontWeight: '400' }}> kcal/일</span>
                    </p>
                  ) : activeNutrient === 'calories' ? (
                    <p style={{ fontSize: '22px', fontWeight: '700', color: THEME.text, margin: 0 }}>
                      {weekAvgIntake} / <span style={{ color: '#FF6B6B' }}>{weekAvgBurned}</span>
                      <span style={{ fontSize: '13px', color: THEME.textSub, fontWeight: '400' }}> kcal/일</span>
                    </p>
                  ) : (
                    <p style={{ fontSize: '22px', fontWeight: '700', color: THEME.text, margin: 0 }}>
                      {recordedDays > 0 ? Math.round(weekDates.reduce((s, d) => s + weekDailyTotals[d][activeNutrient], 0) / recordedDays) : 0}
                      <span style={{ fontSize: '13px', color: THEME.textSub, fontWeight: '400' }}> {currentNutrient.unit}/일</span>
                    </p>
                  )}
                  {weekDates.length > 0 && (
                    <p style={{ fontSize: '9px', color: THEME.textSub, margin: '4px 0 0' }}>
                      {weekDates[0].replace(/-/g, '.')} ~ {weekDates[weekDates.length - 1].replace(/-/g, '.')} · 기록 {recordedDays}일
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p style={{ fontSize: '11px', color: THEME.textSub, margin: 0 }}>월별 평균</p>
                  {activeNutrient === 'net' ? (
                    <p style={{ fontSize: '22px', fontWeight: '700', color: yearAvgNet >= 0 ? COLOR_SURPLUS : COLOR_DEFICIT, margin: 0 }}>
                      {yearAvgNet >= 0 ? '+' : ''}{yearAvgNet}
                      <span style={{ fontSize: '13px', color: THEME.textSub, fontWeight: '400' }}> kcal/일</span>
                    </p>
                  ) : activeNutrient === 'calories' ? (
                    <p style={{ fontSize: '22px', fontWeight: '700', color: THEME.text, margin: 0 }}>
                      {yearAvgIntake} / <span style={{ color: '#FF6B6B' }}>{yearAvgBurned}</span>
                      <span style={{ fontSize: '13px', color: THEME.textSub, fontWeight: '400' }}> kcal/일</span>
                    </p>
                  ) : (
                    <p style={{ fontSize: '22px', fontWeight: '700', color: THEME.text, margin: 0 }}>
                      {recordedMonths > 0 ? Math.round(Object.values(yearMonthlyAvg).reduce((s, v) => s + v[activeNutrient], 0) / recordedMonths) : 0}
                      <span style={{ fontSize: '13px', color: THEME.textSub, fontWeight: '400' }}> {currentNutrient.unit}/일</span>
                    </p>
                  )}
                  <p style={{ fontSize: '9px', color: THEME.textSub, margin: '4px 0 0' }}>
                    {statValue}년 · 기록 {recordedMonths}개월
                  </p>
                </>
              )}
            </div>

            {activeNutrient === 'calories' ? (
              <CalorieChart mode={statMode} />
            ) : activeNutrient === 'net' ? (
              <NetChart />
            ) : (
              <NutrientChart nutrientKey={activeNutrient} color={currentNutrient.color} />
            )}

            {activeNutrient === 'calories' && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', padding: '6px 0', borderTop: `0.5px solid ${THEME.border}`, marginTop: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '10px', height: '10px', background: '#FCD34D', borderRadius: '2px' }} />
                  <span style={{ fontSize: '10px', color: THEME.textSub }}>섭취</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '10px', height: '10px', background: '#FF6B6B', borderRadius: '2px' }} />
                  <span style={{ fontSize: '10px', color: THEME.textSub }}>소비</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '10px', height: '10px', background: COLOR_TODAY, borderRadius: '2px' }} />
                  <span style={{ fontSize: '10px', color: THEME.textSub }}>{statMode === 'week' ? '오늘' : '이번달'}</span>
                </div>
              </div>
            )}

            {activeNutrient === 'net' && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', padding: '6px 0', borderTop: `0.5px solid ${THEME.border}`, marginTop: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '10px', height: '10px', background: COLOR_SURPLUS, borderRadius: '2px' }} />
                  <span style={{ fontSize: '10px', color: THEME.textSub }}>잉여 (살찜)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '10px', height: '10px', background: COLOR_DEFICIT, borderRadius: '2px' }} />
                  <span style={{ fontSize: '10px', color: THEME.textSub }}>적자 (빠짐)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '10px', height: '10px', background: COLOR_TODAY, borderRadius: '2px' }} />
                  <span style={{ fontSize: '10px', color: THEME.textSub }}>{statMode === 'week' ? '오늘' : '이번달'}</span>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', marginTop: '10px' }}>
              {NUTRIENTS.map(n => (
                <button
                  key={n.key}
                  onClick={() => setActiveNutrient(n.key)}
                  style={{
                    background: activeNutrient === n.key ? '#2A2A2A' : '#F5F3EF',
                    color: activeNutrient === n.key ? '#FFF' : '#888',
                    border: 'none',
                    borderRadius: '14px',
                    padding: '7px 2px',
                    fontSize: '10px',
                    fontWeight: activeNutrient === n.key ? '600' : '400',
                    cursor: 'pointer'
                  }}
                >{n.label}</button>
              ))}
            </div>
          </div>

          {statMode === 'week' && (
            <>
              <p style={{ fontSize: '11px', color: THEME.textSub, fontWeight: '600', margin: '0 0 8px' }}>일자별 영양소</p>
              {weekDates.filter(d => weekDailyTotals[d].calories > 0 || weekDailyTotals[d].burned > 0).length === 0 ? (
                <p style={{ color: THEME.textSub, fontSize: '13px', textAlign: 'center', padding: '12px 0' }}>기록이 없습니다</p>
              ) : (
                weekDates.filter(d => weekDailyTotals[d].calories > 0 || weekDailyTotals[d].burned > 0).map(date => {
                  const d = weekDailyTotals[date]
                  const isTodayLine = date === today
                  const net = d.calories - d.burned
                  return (
                    <div key={date} style={{ padding: '8px 10px', background: isTodayLine ? THEME.primaryLight : THEME.cardAlt, borderRadius: '8px', marginBottom: '6px', border: isTodayLine ? `0.5px solid ${THEME.primary}` : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: isTodayLine ? THEME.primary : THEME.text, fontWeight: isTodayLine ? '700' : '500' }}>
                          {date.replace(/-/g, '.')} {isTodayLine && '(오늘)'}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: net >= 0 ? COLOR_SURPLUS : COLOR_DEFICIT }}>
                          {net >= 0 ? '+' : ''}{Math.round(net)}
                        </span>
                      </div>
                      <p style={{ fontSize: '10px', color: THEME.textSub, margin: '3px 0 0' }}>
                        섭취 {Math.round(d.calories)} · 소비 {Math.round(d.burned)} · 탄수화물 {Math.round(d.carbs)}g · 단백질 {Math.round(d.protein)}g · 지방 {Math.round(d.fat)}g
                      </p>
                    </div>
                  )
                })
              )}
            </>
          )}

          {statMode === 'year' && (
            <>
              <p style={{ fontSize: '11px', color: THEME.textSub, fontWeight: '600', margin: '0 0 8px' }}>월별 평균</p>
              {recordedMonths === 0 ? (
                <p style={{ color: THEME.textSub, fontSize: '13px', textAlign: 'center', padding: '12px 0' }}>기록이 없습니다</p>
              ) : (
                Object.entries(yearMonthlyAvg).filter(([, v]) => v.days > 0).map(([month, d]) => {
                  const m = parseInt(month)
                  const isThisMonthLine = isThisYear && m === thisMonth
                  const net = d.calories - d.burned
                  return (
                    <div key={month} style={{ padding: '8px 10px', background: isThisMonthLine ? THEME.primaryLight : THEME.cardAlt, borderRadius: '8px', marginBottom: '6px', border: isThisMonthLine ? `0.5px solid ${THEME.primary}` : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: isThisMonthLine ? THEME.primary : THEME.text, fontWeight: isThisMonthLine ? '700' : '500' }}>
                          {statValue}년 {m}월 {isThisMonthLine && '(이번달)'} · {d.days}일 기록
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: net >= 0 ? COLOR_SURPLUS : COLOR_DEFICIT }}>
                          {net >= 0 ? '+' : ''}{Math.round(net)}
                        </span>
                      </div>
                      <p style={{ fontSize: '10px', color: THEME.textSub, margin: '3px 0 0' }}>
                        섭취 {Math.round(d.calories)} · 소비 {Math.round(d.burned)} · 탄수화물 {Math.round(d.carbs)}g · 단백질 {Math.round(d.protein)}g · 지방 {Math.round(d.fat)}g
                      </p>
                    </div>
                  )
                })
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
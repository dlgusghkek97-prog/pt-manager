import React, { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { S, THEME, calcWeightCalories, calcTDEE, calcDailyBurn } from './utils'
import DatePicker from './DatePicker'

const MEALS = [
  { key: 'breakfast', label: '아침' },
  { key: 'lunch', label: '점심' },
  { key: 'dinner', label: '저녁' },
  { key: 'snack', label: '간식' },
]

const NUTRIENTS = [
  { key: 'calories', label: '칼로리', unit: 'kcal', color: THEME.nutCalories },
  { key: 'carbs', label: '탄수화물', unit: 'g', color: THEME.nutCarbs },
  { key: 'protein', label: '단백질', unit: 'g', color: THEME.nutProtein },
  { key: 'fat', label: '지방', unit: 'g', color: THEME.nutFat },
  { key: 'net', label: '잉여 / 적자', unit: 'kcal', color: THEME.primary },
]

const COLOR_SURPLUS = THEME.surplus
const COLOR_DEFICIT = THEME.deficit

// ─── 모듈 상수 (매 렌더마다 새 객체 생성 방지) ───
const ROW_STYLE = {
  display: 'grid',
  gridTemplateColumns: '42px 1fr 1fr 1fr 1fr',
  gap: '4px',
  marginBottom: '4px',
  alignItems: 'center',
}

const HEADER_ROW_STYLE = {
  display: 'grid',
  gridTemplateColumns: '42px 1fr 1fr 1fr 1fr',
  gap: '4px',
  marginBottom: '4px',
  padding: '0 2px',
}

const TOTAL_ROW_STYLE = {
  display: 'grid',
  gridTemplateColumns: '42px 1fr 1fr 1fr 1fr',
  gap: '4px',
  marginTop: '8px',
  alignItems: 'center',
  background: THEME.primary,
  padding: '8px 2px',
  borderRadius: '8px',
}

const MEAL_LABEL_STYLE = {
  fontSize: '11px',
  color: THEME.text,
  fontWeight: '500',
}

const CELL_STYLE = {
  width: '100%',
  padding: '6px 2px',
  border: `0.5px solid ${THEME.border}`,
  borderRadius: '5px',
  fontSize: '12px',
  textAlign: 'center',
  background: THEME.cardAlt,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  color: THEME.text,
  fontWeight: '500',
  outline: 'none',
}

const CELL_STYLE_AUTO = {
  ...CELL_STYLE,
  background: '#F5FBF7',
  color: THEME.primary,
}

const CameraIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
)

// 탄·단·지로 칼로리 계산 (탄·단×4 + 지×9)
const computeCal = (carbs, protein, fat) => {
  const c = parseFloat(carbs) || 0
  const p = parseFloat(protein) || 0
  const f = parseFloat(fat) || 0
  if (!c && !p && !f) return 0
  return Math.round(c * 4 + p * 4 + f * 9)
}

// ─── MealRow: React.memo로 메모이제이션 ───
const MealRow = React.memo(function MealRow({ mealKey, label, meal, onUpdate, onBlurField }) {
  const kcalStyle = meal.calorieManual ? CELL_STYLE : CELL_STYLE_AUTO
  return (
    <div style={ROW_STYLE}>
      <span style={MEAL_LABEL_STYLE}>{label}</span>
      <input
        style={CELL_STYLE}
        type="text" inputMode="decimal" placeholder="0"
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
        value={meal.carbs}
        onChange={e => onUpdate(mealKey, 'carbs', e.target.value)}
        onBlur={() => onBlurField(mealKey)}
      />
      <input
        style={CELL_STYLE}
        type="text" inputMode="decimal" placeholder="0"
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
        value={meal.protein}
        onChange={e => onUpdate(mealKey, 'protein', e.target.value)}
        onBlur={() => onBlurField(mealKey)}
      />
      <input
        style={CELL_STYLE}
        type="text" inputMode="decimal" placeholder="0"
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
        value={meal.fat}
        onChange={e => onUpdate(mealKey, 'fat', e.target.value)}
        onBlur={() => onBlurField(mealKey)}
      />
      <input
        style={kcalStyle}
        type="text" inputMode="numeric" placeholder="0"
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
        value={meal.calories}
        onChange={e => onUpdate(mealKey, 'calories', e.target.value)}
        title={meal.calorieManual ? '직접 입력 (수동)' : '탄단지로 자동 계산 — 비우면 자동 모드 유지'}
      />
    </div>
  )
})

export default function DietLog({ user, onDietUpdate, tableOverride, trainerIdField, weight, muscle, occupation, workoutTable, workoutIdField, forcedTab, macroResult, goal, intensity }) {
  const TABLE = tableOverride || 'diet_logs'
  const ID_FIELD = trainerIdField || 'member_id'
  const W_TABLE = workoutTable || 'workout_logs'
  const W_ID_FIELD = workoutIdField || 'member_id'
  const FB_TABLE = trainerIdField ? 'trainer_diet_feedback' : 'diet_feedback'

  const [internalTab, setInternalTab] = useState('log')
  const tab = forcedTab || internalTab
  const setTab = forcedTab ? () => {} : setInternalTab

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

  const emptyMeal = { carbs: '', protein: '', fat: '', calories: '', media_url: '', calorieManual: false }
  const [meals, setMeals] = useState({
    breakfast: { ...emptyMeal },
    lunch: { ...emptyMeal },
    dinner: { ...emptyMeal },
    snack: { ...emptyMeal },
  })
  const [logIds, setLogIds] = useState({})
  const [statsLogs, setStatsLogs] = useState([])
  const [statsWorkouts, setStatsWorkouts] = useState([])

  const [feedback, setFeedback] = useState('')
  const [feedbackId, setFeedbackId] = useState(null)
  const [savingFeedback, setSavingFeedback] = useState(false)

  const [previewUrl, setPreviewUrl] = useState(null)

  useEffect(() => { loadLogs(selectedDate); loadFeedback(selectedDate) }, [selectedDate, user.id])
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
        const carbs = row.carbs != null ? String(row.carbs) : ''
        const protein = row.protein != null ? String(row.protein) : ''
        const fat = row.fat != null ? String(row.fat) : ''
        const calories = row.calories != null ? String(row.calories) : ''
        const autoCalc = computeCal(carbs, protein, fat)
        const savedCal = parseFloat(calories) || 0
        const isManual = savedCal > 0 && autoCalc > 0 && Math.abs(savedCal - autoCalc) > 1
        next[row.meal_type] = {
          carbs, protein, fat, calories,
          media_url: row.media_url ?? '',
          calorieManual: isManual,
        }
        ids[row.meal_type] = row.id
      }
    })
    setMeals(next)
    setLogIds(ids)
  }

  const loadFeedback = async (date) => {
    const { data, error } = await supabase.from(FB_TABLE).select('*').eq(ID_FIELD, user.id).eq('log_date', date).maybeSingle()
    if (error) { console.error('[DietLog] feedback load error:', error); setFeedback(''); setFeedbackId(null); return }
    if (data) {
      setFeedback(data.content || '')
      setFeedbackId(data.id)
    } else {
      setFeedback('')
      setFeedbackId(null)
    }
  }

  const saveFeedback = async () => {
    setSavingFeedback(true)
    const payload = {
      [ID_FIELD]: user.id,
      log_date: selectedDate,
      content: feedback,
      updated_at: new Date().toISOString(),
    }
    if (feedbackId) {
      const { error } = await supabase.from(FB_TABLE).update(payload).eq('id', feedbackId)
      if (error) { alert('피드백 저장 실패: ' + error.message); setSavingFeedback(false); return }
    } else {
      const { data, error } = await supabase.from(FB_TABLE).insert(payload).select().single()
      if (error) { alert('피드백 저장 실패: ' + error.message); setSavingFeedback(false); return }
      if (data) setFeedbackId(data.id)
    }
    setSavingFeedback(false)
    alert('피드백이 저장되었습니다.')
  }

  // 입력 중: state만 업데이트 (자동 재계산 X) → 다른 input value 안 바뀜 → 키보드 안 내려감
  const updateField = React.useCallback((mealKey, field, value) => {
    setMeals(prev => {
      const cur = prev[mealKey]
      const next = { ...cur, [field]: value }

      if (field === 'calories') {
        // 칼로리 직접 입력
        if (value === '' || value === null) {
          next.calorieManual = false
        } else {
          next.calorieManual = true
        }
      }
      // 탄·단·지는 입력 중엔 칼로리 재계산 안 함 → onBlur에서만

      return { ...prev, [mealKey]: next }
    })
  }, [])

  // 입력 완료(onBlur) 시: 자동 모드면 칼로리 재계산
  const onBlurField = React.useCallback((mealKey) => {
    setMeals(prev => {
      const cur = prev[mealKey]
      if (cur.calorieManual) return prev
      const auto = computeCal(cur.carbs, cur.protein, cur.fat)
      const newCal = auto > 0 ? String(auto) : ''
      if (newCal === cur.calories) return prev
      return { ...prev, [mealKey]: { ...cur, calories: newCal } }
    })
  }, [])

  const ensureMealRow = async (mealKey) => {
    const meal = meals[mealKey]
    if (logIds[mealKey]) return logIds[mealKey]
    const carbs = parseFloat(meal.carbs) || 0
    const protein = parseFloat(meal.protein) || 0
    const fat = parseFloat(meal.fat) || 0
    let calories = parseFloat(meal.calories) || 0
    if (!calories && (carbs || protein || fat)) {
      calories = computeCal(carbs, protein, fat)
    }
    const payload = {
      [ID_FIELD]: user.id,
      log_date: selectedDate,
      meal_type: mealKey,
      carbs, protein, fat, calories,
    }
    const { data, error } = await supabase.from(TABLE).insert(payload).select().single()
    if (error) { alert('식사 생성 실패: ' + error.message); return null }
    if (data) {
      setLogIds(prev => ({ ...prev, [mealKey]: data.id }))
      return data.id
    }
    return null
  }

  const uploadMealPhoto = async (mealKey, file) => {
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const fileName = `diet/${user.id}/${selectedDate}_${mealKey}_${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('workout-media').upload(fileName, file, { upsert: true })
      if (uploadError) { alert('업로드 실패: ' + uploadError.message); return }
      const { data: urlData } = supabase.storage.from('workout-media').getPublicUrl(fileName)
      const url = urlData.publicUrl

      const id = await ensureMealRow(mealKey)
      if (!id) return

      const { error: updErr } = await supabase.from(TABLE).update({ media_url: url }).eq('id', id)
      if (updErr) { alert('사진 저장 실패: ' + updErr.message); return }

      setMeals(prev => ({ ...prev, [mealKey]: { ...prev[mealKey], media_url: url } }))
    } catch (e) {
      alert('업로드 중 오류: ' + e.message)
    }
  }

  const removeMealPhoto = async (mealKey) => {
    if (!window.confirm(`${MEALS.find(m => m.key === mealKey)?.label} 사진을 삭제할까요?`)) return
    const id = logIds[mealKey]
    if (id) {
      const { error } = await supabase.from(TABLE).update({ media_url: null }).eq('id', id)
      if (error) { alert('삭제 실패: ' + error.message); return }
    }
    setMeals(prev => ({ ...prev, [mealKey]: { ...prev[mealKey], media_url: '' } }))
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
      // 칼로리 비어있으면 탄단지로 자동 계산해서 저장
      if (!calories && (carbs || protein || fat)) {
        calories = computeCal(carbs, protein, fat)
      }
      const hasPhoto = !!meal.media_url
      if (!carbs && !protein && !fat && !calories && !hasPhoto) {
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
        media_url: meal.media_url || null,
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
      alert(`일부 저장 실패\n\n${errors.join('\n')}`)
    } else {
      alert(`${savedCount}개 식사 저장 완료!`)
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

  // 합계: 칼로리 비어있어도 탄단지로 즉시 계산해서 표시 (입력 중에도 합계는 살아있음)
  const totals = {
    carbs: Object.values(meals).reduce((s, m) => s + (parseFloat(m.carbs) || 0), 0),
    protein: Object.values(meals).reduce((s, m) => s + (parseFloat(m.protein) || 0), 0),
    fat: Object.values(meals).reduce((s, m) => s + (parseFloat(m.fat) || 0), 0),
    calories: Object.values(meals).reduce((s, m) => {
      const c = parseFloat(m.calories) || 0
      if (c) return s + c
      return s + computeCal(m.carbs, m.protein, m.fat)
    }, 0),
  }

  const calcBurnedByDate = (dateStr) => {
    const sameDay = statsWorkouts.filter(r => r.log_date === dateStr)
    const cardioCal = sameDay.filter(r => r.exercise_type === 'cardio').reduce((s, r) => s + (r.calories_burned || 0), 0)
    const weightLogs = sameDay.filter(r => r.exercise_type !== 'cardio')
    const volume = weightLogs.reduce((s, r) => s + (r.volume || 0), 0)
    const totalSets = weightLogs.length
    const weightCal = calcWeightCalories({ volume, totalSets, weight, muscle })
    return { cardioCal, weightCal, total: cardioCal + weightCal }
  }

  const calcDailyBurnByDate = (dateStr) => {
    const burned = calcBurnedByDate(dateStr)
    const dailyBurn = calcDailyBurn({
      muscle,
      occupation,
      weightCal: burned.weightCal,
      cardioCal: burned.cardioCal,
    })
    return { ...burned, dailyBurn }
  }

  const fallbackTDEE = calcTDEE(macroResult, goal, intensity)
  const hasFallbackTDEE = fallbackTDEE !== null && fallbackTDEE > 0

  const burnMode = (parseFloat(muscle) || 0) > 0
    ? 'daily'
    : (hasFallbackTDEE ? 'tdee' : 'burned')

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
      const { weightCal, cardioCal, total: burned, dailyBurn } = calcDailyBurnByDate(dateStr)
      const consumption = dailyBurn !== null
        ? dailyBurn
        : (hasFallbackTDEE ? fallbackTDEE : burned)
      map[dateStr] = {
        calories: 0, carbs: 0, protein: 0, fat: 0,
        weightCal, cardioCal,
        burned,
        consumption,
      }
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
      map[m] = {
        calories: 0, carbs: 0, protein: 0, fat: 0,
        burned: 0, consumption: 0,
        days: new Set(), consumptionDays: new Set(),
      }
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
        map[month].protein += v.protein
        map[month].carbs += v.carbs
        map[month].fat += v.fat
        if (v.calories > 0) {
          map[month].days.add(date)
          const { consumption: c } = (() => {
            const { weightCal, cardioCal, total: burned, dailyBurn } = calcDailyBurnByDate(date)
            const consumption = dailyBurn !== null
              ? dailyBurn
              : (hasFallbackTDEE ? fallbackTDEE : burned)
            return { consumption }
          })()
          map[month].consumption += c
          map[month].consumptionDays.add(date)
        }
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
      const consumptionDayCount = map[m].consumptionDays.size
      result[m] = {
        calories: dayCount > 0 ? Math.round(map[m].calories / dayCount) : 0,
        carbs: dayCount > 0 ? Math.round(map[m].carbs / dayCount) : 0,
        protein: dayCount > 0 ? Math.round(map[m].protein / dayCount) : 0,
        fat: dayCount > 0 ? Math.round(map[m].fat / dayCount) : 0,
        burned: dayCount > 0 ? Math.round(map[m].burned / dayCount) : 0,
        consumption: consumptionDayCount > 0 ? Math.round(map[m].consumption / consumptionDayCount) : 0,
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
  const weekConsumptionTotal = weekDates.reduce((s, d) => s + weekDailyTotals[d].consumption, 0)
  const recordedDays = weekDates.filter(d => weekDailyTotals[d].calories > 0).length
  const weekAvgIntake = recordedDays > 0 ? Math.round(weekCalIntakeTotal / recordedDays) : 0
  const weekAvgConsumption = recordedDays > 0 ? Math.round(weekConsumptionTotal / recordedDays) : 0
  const weekAvgNet = weekAvgIntake - weekAvgConsumption

  const recordedMonths = Object.values(yearMonthlyAvg).filter(v => v.days > 0).length
  const yearAvgIntake = recordedMonths > 0 ? Math.round(Object.values(yearMonthlyAvg).reduce((s, v) => s + v.calories, 0) / recordedMonths) : 0
  const yearAvgConsumption = recordedMonths > 0 ? Math.round(Object.values(yearMonthlyAvg).reduce((s, v) => s + v.consumption, 0) / recordedMonths) : 0
  const yearAvgNet = yearAvgIntake - yearAvgConsumption

  const CHART_VIEWBOX = "0 0 320 170"
  const CHART_TOP = 30
  const CHART_BOTTOM = 135
  const CHART_HEIGHT = CHART_BOTTOM - CHART_TOP

  const CalorieChart = ({ mode }) => {
    let data, labels
    if (mode === 'week') {
      data = weekDates.map(d => weekDailyTotals[d].calories)
      labels = weekDates.map(d => `${parseInt(d.split('-')[2])}일`)
    } else {
      data = []; labels = []
      for (let m = 1; m <= 12; m++) {
        data.push(yearMonthlyAvg[m].calories)
        labels.push(`${m}월`)
      }
    }

    const maxVal = Math.max(...data, 100)
    const barW = mode === 'year' ? 14 : 22
    const usableW = 290
    const gap = (usableW - data.length * barW) / (data.length + 1)

    return (
      <svg viewBox={CHART_VIEWBOX} style={{ width: '100%', height: 'auto' }}>
        <line x1="20" y1={CHART_TOP} x2="310" y2={CHART_TOP} stroke={THEME.borderLight} strokeWidth="0.5" />
        <line x1="20" y1={CHART_TOP + CHART_HEIGHT * 0.33} x2="310" y2={CHART_TOP + CHART_HEIGHT * 0.33} stroke={THEME.borderLight} strokeWidth="0.5" />
        <line x1="20" y1={CHART_TOP + CHART_HEIGHT * 0.66} x2="310" y2={CHART_TOP + CHART_HEIGHT * 0.66} stroke={THEME.borderLight} strokeWidth="0.5" />
        <line x1="20" y1={CHART_BOTTOM} x2="310" y2={CHART_BOTTOM} stroke={THEME.border} strokeWidth="1" />
        <text x="14" y={CHART_TOP + 4} textAnchor="end" fontSize="9" fill={THEME.textHint}>{Math.ceil(maxVal)}</text>
        <text x="14" y={CHART_TOP + CHART_HEIGHT * 0.33 + 4} textAnchor="end" fontSize="9" fill={THEME.textHint}>{Math.ceil(maxVal * 0.66)}</text>
        <text x="14" y={CHART_TOP + CHART_HEIGHT * 0.66 + 4} textAnchor="end" fontSize="9" fill={THEME.textHint}>{Math.ceil(maxVal * 0.33)}</text>

        {data.map((val, i) => {
          const x = 20 + gap + i * (barW + gap)
          const h = val > 0 ? (val / maxVal) * CHART_HEIGHT : 0
          const y = CHART_BOTTOM - h
          return (
            <g key={i}>
              {val > 0 && (
                <>
                  <rect x={x} y={y} width={barW} height={h} rx="3" fill={THEME.nutCalories} />
                  <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={mode === 'year' ? '7' : '9'} fill={THEME.text} fontWeight="500">
                    {Math.round(val)}
                  </text>
                </>
              )}
              <text x={x + barW / 2} y="152" textAnchor="middle" fontSize={mode === 'year' ? '8' : '10'} fill={THEME.textSub}>
                {labels[i]}
              </text>
            </g>
          )
        })}
      </svg>
    )
  }

  const NutrientChart = ({ nutrientKey, color }) => {
    let data, labels
    if (statMode === 'week') {
      data = weekDates.map(d => weekDailyTotals[d][nutrientKey])
      labels = weekDates.map(d => `${parseInt(d.split('-')[2])}일`)
    } else {
      data = []; labels = []
      for (let m = 1; m <= 12; m++) {
        data.push(yearMonthlyAvg[m][nutrientKey])
        labels.push(`${m}월`)
      }
    }

    const maxVal = Math.max(...data, 10)
    const barW = statMode === 'year' ? 14 : 22
    const usableW = 290
    const gap = (usableW - data.length * barW) / (data.length + 1)

    return (
      <svg viewBox={CHART_VIEWBOX} style={{ width: '100%', height: 'auto' }}>
        <line x1="20" y1={CHART_TOP} x2="310" y2={CHART_TOP} stroke={THEME.borderLight} strokeWidth="0.5" />
        <line x1="20" y1={CHART_TOP + CHART_HEIGHT * 0.33} x2="310" y2={CHART_TOP + CHART_HEIGHT * 0.33} stroke={THEME.borderLight} strokeWidth="0.5" />
        <line x1="20" y1={CHART_TOP + CHART_HEIGHT * 0.66} x2="310" y2={CHART_TOP + CHART_HEIGHT * 0.66} stroke={THEME.borderLight} strokeWidth="0.5" />
        <line x1="20" y1={CHART_BOTTOM} x2="310" y2={CHART_BOTTOM} stroke={THEME.border} strokeWidth="1" />
        <text x="14" y={CHART_TOP + 4} textAnchor="end" fontSize="9" fill={THEME.textHint}>{Math.ceil(maxVal)}</text>
        <text x="14" y={CHART_TOP + CHART_HEIGHT * 0.33 + 4} textAnchor="end" fontSize="9" fill={THEME.textHint}>{Math.ceil(maxVal * 0.66)}</text>
        <text x="14" y={CHART_TOP + CHART_HEIGHT * 0.66 + 4} textAnchor="end" fontSize="9" fill={THEME.textHint}>{Math.ceil(maxVal * 0.33)}</text>

        {data.map((val, i) => {
          const x = 20 + gap + i * (barW + gap)
          const h = val > 0 ? (val / maxVal) * CHART_HEIGHT : 0
          const y = CHART_BOTTOM - h
          return (
            <g key={i}>
              {val > 0 && (
                <>
                  <rect x={x} y={y} width={barW} height={h} rx="3" fill={color} />
                  <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={statMode === 'year' ? '7' : '9'} fill={THEME.text} fontWeight="500">
                    {Math.round(val)}
                  </text>
                </>
              )}
              <text x={x + barW / 2} y="152" textAnchor="middle" fontSize={statMode === 'year' ? '8' : '10'} fill={THEME.textSub}>
                {labels[i]}
              </text>
            </g>
          )
        })}
      </svg>
    )
  }

  const NetChart = () => {
    let rawData, labels
    if (statMode === 'week') {
      rawData = weekDates.map(d => {
        const v = weekDailyTotals[d]
        if (v.calories === 0) return 0
        return v.calories - v.consumption
      })
      labels = weekDates.map(d => `${parseInt(d.split('-')[2])}일`)
    } else {
      rawData = []; labels = []
      for (let m = 1; m <= 12; m++) {
        const v = yearMonthlyAvg[m]
        if (v.calories === 0) {
          rawData.push(0)
        } else {
          rawData.push(v.calories - v.consumption)
        }
        labels.push(`${m}월`)
      }
    }

    const absData = rawData.map(v => Math.abs(v))
    const maxVal = Math.max(...absData, 100)
    const barW = statMode === 'year' ? 14 : 22
    const usableW = 290
    const gap = (usableW - rawData.length * barW) / (rawData.length + 1)

    return (
      <svg viewBox={CHART_VIEWBOX} style={{ width: '100%', height: 'auto' }}>
        <line x1="20" y1={CHART_TOP} x2="310" y2={CHART_TOP} stroke={THEME.borderLight} strokeWidth="0.5" />
        <line x1="20" y1={CHART_TOP + CHART_HEIGHT * 0.33} x2="310" y2={CHART_TOP + CHART_HEIGHT * 0.33} stroke={THEME.borderLight} strokeWidth="0.5" />
        <line x1="20" y1={CHART_TOP + CHART_HEIGHT * 0.66} x2="310" y2={CHART_TOP + CHART_HEIGHT * 0.66} stroke={THEME.borderLight} strokeWidth="0.5" />
        <line x1="20" y1={CHART_BOTTOM} x2="310" y2={CHART_BOTTOM} stroke={THEME.border} strokeWidth="1" />
        <text x="14" y={CHART_TOP + 4} textAnchor="end" fontSize="9" fill={THEME.textHint}>{Math.ceil(maxVal)}</text>
        <text x="14" y={CHART_TOP + CHART_HEIGHT * 0.33 + 4} textAnchor="end" fontSize="9" fill={THEME.textHint}>{Math.ceil(maxVal * 0.66)}</text>
        <text x="14" y={CHART_TOP + CHART_HEIGHT * 0.66 + 4} textAnchor="end" fontSize="9" fill={THEME.textHint}>{Math.ceil(maxVal * 0.33)}</text>

        {rawData.map((val, i) => {
          const x = 20 + gap + i * (barW + gap)
          const h = Math.abs(val) > 0 ? (Math.abs(val) / maxVal) * CHART_HEIGHT : 0
          const y = CHART_BOTTOM - h
          const fillColor = val >= 0 ? COLOR_SURPLUS : COLOR_DEFICIT
          return (
            <g key={i}>
              {val !== 0 && (
                <>
                  <rect x={x} y={y} width={barW} height={h} rx="3" fill={fillColor} />
                  <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={statMode === 'year' ? '7' : '9'} fill={fillColor} fontWeight="500">
                    {val > 0 ? `+${Math.round(val)}` : Math.round(val)}
                  </text>
                </>
              )}
              <text x={x + barW / 2} y="152" textAnchor="middle" fontSize={statMode === 'year' ? '8' : '10'} fill={THEME.textSub}>
                {labels[i]}
              </text>
            </g>
          )
        })}
      </svg>
    )
  }

  const burnModeLabel = burnMode === 'daily'
    ? '일일 소비'
    : (burnMode === 'tdee' ? '평균 TDEE' : '운동 소비')

  return (
    <div>
      {previewUrl && (
        <div onClick={() => setPreviewUrl(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', cursor: 'pointer' }}>
          <img src={previewUrl} alt="식단 사진" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '8px' }} />
        </div>
      )}

      {!forcedTab && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '12px' }}>
          <button onClick={() => setTab('log')} style={{ background: tab === 'log' ? THEME.primaryAccent : '#FFF', color: tab === 'log' ? THEME.primaryDark : THEME.textSub, border: 'none', borderRadius: '12px', padding: '10px', fontSize: '12px', fontWeight: tab === 'log' ? '500' : '400', cursor: 'pointer' }}>
            식단 기록
          </button>
          <button onClick={() => setTab('stats')} style={{ background: tab === 'stats' ? THEME.primaryAccent : '#FFF', color: tab === 'stats' ? THEME.primaryDark : THEME.textSub, border: 'none', borderRadius: '12px', padding: '10px', fontSize: '12px', fontWeight: tab === 'stats' ? '500' : '400', cursor: 'pointer' }}>
            통계
          </button>
        </div>
      )}

      {tab === 'log' && (
        <div style={S.card}>
          <p style={{ ...S.cardTitle, margin: '0 0 10px' }}>식단 기록</p>
          <div style={{ marginBottom: '14px' }}>
            <DatePicker value={selectedDate} onChange={setSelectedDate} />
          </div>

          <div style={HEADER_ROW_STYLE}>
            <span style={{ fontSize: '10px', color: THEME.textSub }}>식사</span>
            <span style={{ fontSize: '10px', color: THEME.nutCarbsText, textAlign: 'center', fontWeight: '500' }}>탄수</span>
            <span style={{ fontSize: '10px', color: THEME.nutProteinText, textAlign: 'center', fontWeight: '500' }}>단백</span>
            <span style={{ fontSize: '10px', color: THEME.nutFatText, textAlign: 'center', fontWeight: '500' }}>지방</span>
            <span style={{ fontSize: '10px', color: THEME.textSub, textAlign: 'center' }}>kcal</span>
          </div>

          {MEALS.map(m => (
            <MealRow
              key={m.key}
              mealKey={m.key}
              label={m.label}
              meal={meals[m.key]}
              onUpdate={updateField}
              onBlurField={onBlurField}
            />
          ))}

          <div style={TOTAL_ROW_STYLE}>
            <span style={{ fontSize: '11px', color: '#FFF', fontWeight: '500', paddingLeft: '4px' }}>합계</span>
            <span style={{ fontSize: '12px', color: '#B8E0D2', textAlign: 'center', fontWeight: '500' }}>{Math.round(totals.carbs)}g</span>
            <span style={{ fontSize: '12px', color: '#F4C8D5', textAlign: 'center', fontWeight: '500' }}>{Math.round(totals.protein)}g</span>
            <span style={{ fontSize: '12px', color: '#F2D5B5', textAlign: 'center', fontWeight: '500' }}>{Math.round(totals.fat)}g</span>
            <span style={{ fontSize: '12px', color: '#FFE8A8', textAlign: 'center', fontWeight: '500' }}>{Math.round(totals.calories)}</span>
          </div>

          <p style={{ fontSize: '11px', color: THEME.textSub, fontWeight: '500', margin: '14px 0 8px' }}>식사 사진</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            {MEALS.map(m => {
              const url = meals[m.key].media_url
              return (
                <div key={m.key}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: THEME.text, fontWeight: '500' }}>{m.label}</span>
                    {url && (
                      <button
                        onClick={() => removeMealPhoto(m.key)}
                        style={{ background: 'none', border: 'none', color: THEME.danger, fontSize: '10px', cursor: 'pointer', padding: 0 }}
                      >삭제</button>
                    )}
                  </div>
                  {url ? (
                    <div
                      onClick={() => setPreviewUrl(url)}
                      style={{ width: '100%', height: '90px', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', background: THEME.cardAlt }}
                    >
                      <img src={url} alt={m.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                  ) : (
                    <label style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', background: THEME.cardAlt, border: `0.5px dashed ${THEME.primaryAccent}`, borderRadius: '8px', height: '90px', color: THEME.textSub }}>
                      <CameraIcon />
                      <span style={{ fontSize: '10px' }}>사진 추가</span>
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files[0] && uploadMealPhoto(m.key, e.target.files[0])} />
                    </label>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ background: THEME.cardAlt, border: `0.5px solid ${THEME.border}`, borderRadius: '10px', padding: '11px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
              <span style={{ fontSize: '11px', color: THEME.primary, fontWeight: '500' }}>트레이너 피드백</span>
              <button
                onClick={saveFeedback}
                disabled={savingFeedback}
                style={{ background: THEME.primary, color: '#FFF', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '10px', fontWeight: '500', cursor: 'pointer' }}
              >{savingFeedback ? '저장 중...' : '피드백 저장'}</button>
            </div>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="오늘 식단에 대한 피드백을 입력해주세요..."
              style={{ width: '100%', background: '#FFF', borderRadius: '6px', padding: '9px 10px', minHeight: '60px', fontSize: '12px', color: THEME.text, lineHeight: '1.6', border: `0.5px solid ${THEME.border}`, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }}
            />
          </div>

          <button style={{ ...S.btnPrimary, fontSize: '13px', padding: '12px' }} onClick={saveAll}>저장</button>

          <p style={{ fontSize: '10px', color: THEME.textHint, margin: '8px 0 0', textAlign: 'center' }}>
            칼로리는 입력칸을 떠나면 자동 계산됩니다. 직접 입력 후 비우면 다시 자동 계산됩니다.
          </p>
        </div>
      )}

      {tab === 'stats' && (
        <div style={S.card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
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
                background: statMode === key ? THEME.primaryAccent : '#FFF',
                color: statMode === key ? THEME.primaryDark : THEME.textSub,
                border: 'none',
                borderRadius: '8px',
                padding: '8px',
                fontSize: '12px',
                fontWeight: statMode === key ? '500' : '400',
                cursor: 'pointer'
              }}>{label}</button>
            ))}
          </div>

          <div style={{ marginBottom: '12px' }}>
            <DatePicker value={statValue} onChange={setStatValue} mode={statMode} />
          </div>

          <div style={{ background: THEME.cardAlt, borderRadius: '12px', padding: '12px 8px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0 6px 8px', gap: '10px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {statMode === 'week' ? (
                  <>
                    <p style={{ fontSize: '10px', color: THEME.textSub, margin: 0 }}>평균</p>
                    {activeNutrient === 'net' ? (
                      <p style={{ fontSize: '20px', fontWeight: '500', color: weekAvgNet >= 0 ? COLOR_SURPLUS : COLOR_DEFICIT, margin: 0, letterSpacing: '-0.3px' }}>
                        {weekAvgNet >= 0 ? '+' : ''}{weekAvgNet}
                        <span style={{ fontSize: '11px', color: THEME.textSub, fontWeight: '400' }}> kcal/일</span>
                      </p>
                    ) : activeNutrient === 'calories' ? (
                      <p style={{ fontSize: '20px', fontWeight: '500', color: THEME.text, margin: 0, letterSpacing: '-0.3px' }}>
                        {weekAvgIntake}
                        <span style={{ fontSize: '11px', color: THEME.textSub, fontWeight: '400' }}> kcal/일</span>
                      </p>
                    ) : (
                      <p style={{ fontSize: '20px', fontWeight: '500', color: THEME.text, margin: 0, letterSpacing: '-0.3px' }}>
                        {recordedDays > 0 ? Math.round(weekDates.reduce((s, d) => s + weekDailyTotals[d][activeNutrient], 0) / recordedDays) : 0}
                        <span style={{ fontSize: '11px', color: THEME.textSub, fontWeight: '400' }}> {currentNutrient.unit}/일</span>
                      </p>
                    )}
                    {weekDates.length > 0 && (
                      <p style={{ fontSize: '9px', color: THEME.textHint, margin: '4px 0 0' }}>
                        {weekDates[0].replace(/-/g, '.')} ~ {weekDates[weekDates.length - 1].replace(/-/g, '.')} · 기록 {recordedDays}일
                        {activeNutrient === 'net' && ` · ${burnModeLabel} ${weekAvgConsumption}`}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: '10px', color: THEME.textSub, margin: 0 }}>월별 평균</p>
                    {activeNutrient === 'net' ? (
                      <p style={{ fontSize: '20px', fontWeight: '500', color: yearAvgNet >= 0 ? COLOR_SURPLUS : COLOR_DEFICIT, margin: 0, letterSpacing: '-0.3px' }}>
                        {yearAvgNet >= 0 ? '+' : ''}{yearAvgNet}
                        <span style={{ fontSize: '11px', color: THEME.textSub, fontWeight: '400' }}> kcal/일</span>
                      </p>
                    ) : activeNutrient === 'calories' ? (
                      <p style={{ fontSize: '20px', fontWeight: '500', color: THEME.text, margin: 0, letterSpacing: '-0.3px' }}>
                        {yearAvgIntake}
                        <span style={{ fontSize: '11px', color: THEME.textSub, fontWeight: '400' }}> kcal/일</span>
                      </p>
                    ) : (
                      <p style={{ fontSize: '20px', fontWeight: '500', color: THEME.text, margin: 0, letterSpacing: '-0.3px' }}>
                        {recordedMonths > 0 ? Math.round(Object.values(yearMonthlyAvg).reduce((s, v) => s + v[activeNutrient], 0) / recordedMonths) : 0}
                        <span style={{ fontSize: '11px', color: THEME.textSub, fontWeight: '400' }}> {currentNutrient.unit}/일</span>
                      </p>
                    )}
                    <p style={{ fontSize: '9px', color: THEME.textHint, margin: '4px 0 0' }}>
                      {statValue}년 · 기록 {recordedMonths}개월
                      {activeNutrient === 'net' && ` · ${burnModeLabel} ${yearAvgConsumption}`}
                    </p>
                  </>
                )}
              </div>

              {activeNutrient === 'net' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '8px', height: '8px', background: COLOR_SURPLUS, borderRadius: '2px' }} />
                    <span style={{ fontSize: '9px', color: THEME.textSub }}>잉여 (살찜)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '8px', height: '8px', background: COLOR_DEFICIT, borderRadius: '2px' }} />
                    <span style={{ fontSize: '9px', color: THEME.textSub }}>적자 (빠짐)</span>
                  </div>
                </div>
              )}
            </div>

            {activeNutrient === 'calories' ? (
              <CalorieChart mode={statMode} />
            ) : activeNutrient === 'net' ? (
              <NetChart />
            ) : (
              <NutrientChart nutrientKey={activeNutrient} color={currentNutrient.color} />
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', marginTop: '10px' }}>
              {NUTRIENTS.map(n => (
                <button
                  key={n.key}
                  onClick={() => setActiveNutrient(n.key)}
                  style={{
                    background: activeNutrient === n.key ? THEME.primaryDark : THEME.borderLight,
                    color: activeNutrient === n.key ? '#FFF' : THEME.textSub,
                    border: 'none',
                    borderRadius: '14px',
                    padding: '6px 2px',
                    fontSize: '10px',
                    fontWeight: activeNutrient === n.key ? '500' : '400',
                    cursor: 'pointer'
                  }}
                >{n.label}</button>
              ))}
            </div>
          </div>

          {statMode === 'week' && (
            <>
              <p style={{ fontSize: '11px', color: THEME.textSub, fontWeight: '500', margin: '0 0 7px' }}>일자별 영양소</p>
              {weekDates.filter(d => weekDailyTotals[d].calories > 0).length === 0 ? (
                <p style={{ color: THEME.textSub, fontSize: '12px', textAlign: 'center', padding: '12px 0' }}>기록이 없습니다</p>
              ) : (
                weekDates.filter(d => weekDailyTotals[d].calories > 0).map(date => {
                  const d = weekDailyTotals[date]
                  const isTodayLine = date === today
                  const hasMeal = d.calories > 0
                  const net = hasMeal ? (d.calories - d.consumption) : 0
                  return (
                    <div key={date} style={{ padding: '8px 11px', background: isTodayLine ? THEME.primaryLight : THEME.cardAlt, borderRadius: '8px', marginBottom: '5px', border: isTodayLine ? `0.5px solid ${THEME.primaryAccent}` : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: isTodayLine ? THEME.primaryDark : THEME.text, fontWeight: '500' }}>
                          {date.replace(/-/g, '.')} {isTodayLine && '(오늘)'}
                        </span>
                        {hasMeal ? (
                          <span style={{ fontSize: '12px', fontWeight: '500', color: net >= 0 ? COLOR_SURPLUS : COLOR_DEFICIT }}>
                            {net >= 0 ? '+' : ''}{Math.round(net)}
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: THEME.textHint }}>식단 없음</span>
                        )}
                      </div>
                      <p style={{ fontSize: '10px', color: THEME.textSub, margin: '2px 0 0' }}>
                        섭취 {Math.round(d.calories)} · 소비 {Math.round(d.consumption)} · 탄 {Math.round(d.carbs)}g · 단 {Math.round(d.protein)}g · 지 {Math.round(d.fat)}g
                      </p>
                    </div>
                  )
                })
              )}
            </>
          )}

          {statMode === 'year' && (
            <>
              <p style={{ fontSize: '11px', color: THEME.textSub, fontWeight: '500', margin: '0 0 7px' }}>월별 평균</p>
              {recordedMonths === 0 ? (
                <p style={{ color: THEME.textSub, fontSize: '12px', textAlign: 'center', padding: '12px 0' }}>기록이 없습니다</p>
              ) : (
                Object.entries(yearMonthlyAvg).filter(([, v]) => v.days > 0).map(([month, d]) => {
                  const m = parseInt(month)
                  const isThisMonthLine = isThisYear && m === thisMonth
                  const hasMeal = d.calories > 0
                  const net = hasMeal ? (d.calories - d.consumption) : 0
                  return (
                    <div key={month} style={{ padding: '8px 11px', background: isThisMonthLine ? THEME.primaryLight : THEME.cardAlt, borderRadius: '8px', marginBottom: '5px', border: isThisMonthLine ? `0.5px solid ${THEME.primaryAccent}` : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: isThisMonthLine ? THEME.primaryDark : THEME.text, fontWeight: '500' }}>
                          {statValue}년 {m}월 {isThisMonthLine && '(이번달)'} · {d.days}일 기록
                        </span>
                        {hasMeal ? (
                          <span style={{ fontSize: '12px', fontWeight: '500', color: net >= 0 ? COLOR_SURPLUS : COLOR_DEFICIT }}>
                            {net >= 0 ? '+' : ''}{Math.round(net)}
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: THEME.textHint }}>식단 없음</span>
                        )}
                      </div>
                      <p style={{ fontSize: '10px', color: THEME.textSub, margin: '2px 0 0' }}>
                        섭취 {Math.round(d.calories)} · 소비 {Math.round(d.consumption)} · 탄 {Math.round(d.carbs)}g · 단 {Math.round(d.protein)}g · 지 {Math.round(d.fat)}g
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
import { supabase } from './supabase'

export const PARTS = ['하체', '가슴', '등', '어깨', '팔', '복근', '코어']
export const PART_COLORS = {
  '하체': '#6BA8C5', '가슴': '#C57878', '등': '#8AB55C',
  '어깨': '#D4A848', '팔': '#A878B5', '복근': '#5DBDA8',
  '코어': '#8B7BD8'
}

export const generateCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length))
  return code
}

export const getWeekNum = (dateStr) => {
  const day = parseInt(dateStr.split('-')[2])
  if (day <= 7) return 0
  if (day <= 14) return 1
  if (day <= 21) return 2
  if (day <= 28) return 3
  return 4
}

export const weekLabels = ['1주차 (1~7일)', '2주차 (8~14일)', '3주차 (15~21일)', '4주차 (22~28일)', '5주차 (29~31일)']

export const CYCLE_PHASES = {
  '생리기 (1~5일)': -100,
  '여포기 (6~13일)': 0,
  '배란기 (14~16일)': 50,
  '황체기 (17~28일)': 150,
}

// ─── 직업 활동량 (NEW v5) ───
export const OCCUPATION_MULTIPLIER = {
  '사무직 / 좌식': 1.0,
  '일반 활동': 1.05,
  '활동적': 1.10,
  '매우 활동적': 1.15,
}

export const OCCUPATION_DESCRIPTION = {
  '사무직 / 좌식': '사무, 운전, 콜센터, 학생',
  '일반 활동': '매장 판매, 강사, 미용사',
  '활동적': '간호사, 웨이터, 트레이너',
  '매우 활동적': '택배, 이사, 건설, 농업',
}

export const calcMacro = ({ goal, gender, weight, muscle, activity, intensity, cyclePhase, occupation }) => {
  const leanMass = muscle * 1.4
  const bmr = Math.round(370 + 21.6 * leanMass)
  const actMap = { '가벼운 운동 (주 2~3회)': 1.375, '보통 운동 (주 4~5회)': 1.55, '고강도 운동 (주 6회+)': 1.725 }
  const occMult = OCCUPATION_MULTIPLIER[occupation] || 1.0
  const tdee = Math.round(bmr * (actMap[activity] || 1.55) * occMult)
  const adjMap = goal === '벌크업'
    ? { '완만': 300, '일반': 400, '공격적': 500 }
    : { '완만': -300, '일반': -500, '공격적': -700 }
  const cycleAdj = (gender === '여성' && cyclePhase) ? (CYCLE_PHASES[cyclePhase] || 0) : 0
  const rawTarget = tdee + (adjMap[intensity] || (goal === '벌크업' ? 400 : -500)) + 100 + cycleAdj
  const minTarget = gender === '여성' ? 1200 : 1500
  const target = Math.max(rawTarget, minTarget)
  const protein = Math.round(weight * (gender === '여성' ? 2.0 : 2.2))
  const fat = Math.round(target * 0.25 / 9)
  const carbs = Math.max(0, Math.round((target - protein * 4 - fat * 9) / 4))
  return { bmr, tdee, target, protein, fat, carbs }
}

export function calcWeightCalories({ volume = 0, totalSets = 0, weight, muscle }) {
  const w = parseFloat(weight) || 70
  const hours = (totalSets * 2.0) / 60
  const metKcal = 4.0 * w * hours
  const volumeKcal = volume * 0.017
  return Math.round(metKcal + volumeKcal)
}

export const calcDailyBurn = ({ muscle, occupation, weightCal = 0, cardioCal = 0 }) => {
  const m = parseFloat(muscle) || 0
  if (m <= 0) return null

  const leanMass = m * 1.4
  const bmr = Math.round(370 + 21.6 * leanMass)

  const occMult = OCCUPATION_MULTIPLIER[occupation] || 1.0
  const neat = Math.round(bmr * (occMult - 1.0))

  return bmr + neat + (weightCal || 0) + (cardioCal || 0)
}

export const THEME = {
  bg: '#F0F7F4',
  card: '#FFFFFF',
  cardAlt: '#F5FBF7',
  primary: '#5A8E72',
  primaryLight: '#E8F2EE',
  primaryDark: '#2F5C45',
  primaryAccent: '#B8DCC8',
  text: '#2D4A3E',
  textSub: '#7AA890',
  textHint: '#A8C8B5',
  border: '#DCEAE2',
  borderLight: '#E8F2EE',
  danger: '#C5705C',
  dangerLight: '#FCE4E0',
  dangerDark: '#8E3D2E',
  warning: '#D4A848',
  warningLight: '#FFF7E6',
  warningDark: '#5C4416',
  warningBorder: '#E8C77A',
  warningText: '#8B6F2A',
  nutCalories: '#E0B84A',
  nutCaloriesBg: '#FFF7E6',
  nutCaloriesText: '#A8893C',
  nutCaloriesDark: '#7A6322',
  nutCarbs: '#5A9CAB',
  nutCarbsBg: '#E6F2F4',
  nutCarbsText: '#5A9CAB',
  nutCarbsDark: '#2F6B7A',
  nutProtein: '#C5708F',
  nutProteinBg: '#FBE8EE',
  nutProteinText: '#C5708F',
  nutProteinDark: '#8E3D5C',
  nutFat: '#C28A52',
  nutFatBg: '#FBEDDB',
  nutFatText: '#C28A52',
  nutFatDark: '#8B5E2E',
  surplus: '#5A9CAB',
  deficit: '#C5705C',
  todayHighlight: '#5A8E72',
  inbodyWeight: '#5A8E72',
  inbodyMuscle: '#5A9CAB',
  inbodyFat: '#C28A52',
}

export const ICONS = {
  workout: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6.5 6.5h11M6.5 17.5h11M3 12h18M7 9.5V6.5M17 9.5V6.5M7 17.5v-3M17 17.5v-3"/></svg>`,
  stats: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></svg>`,
  diet: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 2a5 5 0 0 1 5 5c0 3-5 7-5 7S7 10 7 7a5 5 0 0 1 5-5z"/><path d="M5 21h14M8 17l1-3h6l1 3"/></svg>`,
  trainer: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`,
  camera: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  morning: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4A848" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>`,
  lunch: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E0B84A" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></svg>`,
  dinner: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7AA890" stroke-width="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg>`,
  snack: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C5705C" stroke-width="2"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>`,
}

export const S = {
  container: { minHeight: '100vh', background: THEME.bg, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', fontFamily: "'Apple SD Gothic Neo', sans-serif", padding: '12px 10px' },
  wrap: { width: '100%', maxWidth: '480px', paddingTop: '8px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', rowGap: '6px' },
  headerTitle: { color: THEME.primary, fontSize: '20px', fontWeight: '700', margin: 0 },
  logoutBtn: { background: 'transparent', border: `1px solid ${THEME.primary}`, color: THEME.primary, padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
  card: { background: THEME.card, borderRadius: '16px', padding: '16px', marginBottom: '12px' },
  cardTitle: { fontSize: '14px', fontWeight: '500', color: THEME.text, margin: '0 0 12px' },
  addBtn: { background: THEME.primary, color: '#FFF', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
  barRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' },
  barLabel: { fontSize: '12px', color: THEME.text, width: '32px', flexShrink: 0 },
  barBg: { flex: 1, background: THEME.borderLight, borderRadius: '4px', height: '10px' },
  barFill: { height: '10px', borderRadius: '4px' },
  barVal: { fontSize: '11px', color: THEME.textSub, width: '58px', textAlign: 'right', flexShrink: 0 },
  dateInput: { padding: '6px 10px', borderRadius: '8px', border: `1px solid ${THEME.border}`, fontSize: '13px', background: '#FFF' },
  exBox: { background: THEME.cardAlt, borderRadius: '12px', padding: '12px', marginBottom: '10px' },
  exHeader: { display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '10px' },
  partSel: { flex: 1, padding: '7px', borderRadius: '6px', border: `1px solid ${THEME.border}`, fontSize: '12px', background: '#FFF', minWidth: 0 },
  exNameInput: { flex: 2, padding: '7px', borderRadius: '6px', border: `1px solid ${THEME.border}`, fontSize: '12px', minWidth: 0 },
  delExBtn: { background: '#FBE8E8', color: '#C57878', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', fontSize: '12px', flexShrink: 0 },
  setHeaderRow: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' },
  setRow: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' },
  numInput: { flex: 1, padding: '7px 4px', borderRadius: '6px', border: `1px solid ${THEME.border}`, fontSize: '13px', textAlign: 'center', minWidth: 0 },
  delSetBtn: { flex: 0.4, background: '#EAEAE5', color: '#888', border: 'none', borderRadius: '6px', padding: '7px 6px', cursor: 'pointer', fontSize: '14px' },
  addSetBtn: { width: '100%', padding: '7px', borderRadius: '6px', border: `1px dashed ${THEME.border}`, background: 'transparent', color: THEME.textSub, fontSize: '13px', cursor: 'pointer', marginTop: '4px' },
  addExBtn: { width: '100%', padding: '12px', borderRadius: '10px', border: `1.5px dashed ${THEME.primaryAccent}`, background: 'transparent', color: THEME.primary, fontSize: '13px', fontWeight: '500', cursor: 'pointer' },
  loginCard: { background: THEME.card, borderRadius: '16px', padding: '40px 32px', width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '12px' },
  input: { width: '100%', padding: '12px 14px', borderRadius: '8px', border: `1px solid ${THEME.border}`, fontSize: '15px', outline: 'none', boxSizing: 'border-box', background: '#FAFAFA' },
  btnPrimary: { width: '100%', padding: '14px', borderRadius: '10px', border: 'none', background: THEME.primary, color: '#FFF', fontSize: '14px', fontWeight: '500', cursor: 'pointer' },
  btnSecondary: { width: '100%', padding: '14px', borderRadius: '10px', border: `1px solid ${THEME.border}`, background: '#FFF', color: THEME.textSub, fontSize: '14px', cursor: 'pointer' },
}

export const calcTDEE = (macroResult, goal, intensity) => {
  if (!macroResult || !macroResult.target) return null
  const target = parseInt(macroResult.target) || 0
  if (target <= 0) return null

  const ADJ = {
    '다이어트': { '완만': -300, '일반': -500, '공격적': -700 },
    '벌크업':   { '완만': +300, '일반': +400, '공격적': +500 },
  }

  const adj = ADJ[goal]?.[intensity] ?? -500
  return target - adj - 100
}

export const calcPRs = (allLogs) => {
  const prs = {}
  ;(allLogs || []).forEach(log => {
    if (log.exercise_type === 'cardio' || !log.exercise_name) return
    const w = parseFloat(log.weight) || 0
    const r = parseInt(log.reps) || 0
    const vol = w * r
    if (w <= 0 || r <= 0) return
    const key = `${log.body_part}_${log.exercise_name}`
    if (!prs[key]) {
      prs[key] = {
        body_part: log.body_part,
        exercise_name: log.exercise_name,
        maxWeight: w,
        maxWeightReps: r,
        maxWeightDate: log.log_date,
        maxVolume: vol,
        maxVolumeDate: log.log_date,
        totalSessions: 1,
      }
    } else {
      prs[key].totalSessions++
      if (w > prs[key].maxWeight) {
        prs[key].maxWeight = w
        prs[key].maxWeightReps = r
        prs[key].maxWeightDate = log.log_date
      } else if (w === prs[key].maxWeight && r > prs[key].maxWeightReps) {
        prs[key].maxWeightReps = r
        prs[key].maxWeightDate = log.log_date
      }
      if (vol > prs[key].maxVolume) {
        prs[key].maxVolume = vol
        prs[key].maxVolumeDate = log.log_date
      }
    }
  })
  return Object.values(prs).sort((a, b) => b.maxWeight - a.maxWeight)
}

export const checkNewPRs = (allLogs, todayDate, favorites = []) => {
  if (!allLogs || allLogs.length === 0) return []
  if (!favorites || favorites.length === 0) return []

  const favSet = new Set(favorites.map(f => `${f.body_part}_${f.exercise_name}`))

  const todayLogs = allLogs.filter(l =>
    l.log_date === todayDate &&
    l.exercise_type !== 'cardio' &&
    l.exercise_name &&
    favSet.has(`${l.body_part}_${l.exercise_name}`)
  )
  if (todayLogs.length === 0) return []

  const todayMaxByExercise = {}
  todayLogs.forEach(log => {
    const w = parseFloat(log.weight) || 0
    if (w <= 0) return
    const key = `${log.body_part}_${log.exercise_name}`
    if (!todayMaxByExercise[key] || w > todayMaxByExercise[key].weight) {
      todayMaxByExercise[key] = {
        weight: w,
        exercise_name: log.exercise_name,
        body_part: log.body_part,
      }
    }
  })

  const newPRs = []

  Object.entries(todayMaxByExercise).forEach(([key, today]) => {
    const prevLogs = allLogs.filter(l =>
      l.log_date < todayDate &&
      l.exercise_type !== 'cardio' &&
      l.exercise_name === today.exercise_name &&
      l.body_part === today.body_part
    )

    if (prevLogs.length === 0) return

    const prevMax = Math.max(...prevLogs.map(l => parseFloat(l.weight) || 0))

    if (today.weight > prevMax) {
      newPRs.push({
        exercise_name: today.exercise_name,
        body_part: today.body_part,
        newWeight: today.weight,
        prevWeight: prevMax,
        improvement: Math.round((today.weight - prevMax) * 10) / 10,
      })
    }
  })

  return newPRs
}

export const loadFavorites = async (userId, table = 'member_favorite_exercises', idField = 'member_id') => {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq(idField, userId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[loadFavorites] error:', error)
    return []
  }
  return data || []
}

export const addFavorite = async (userId, bodyPart, exerciseName, table = 'member_favorite_exercises', idField = 'member_id') => {
  if (!bodyPart || !exerciseName) return { success: false, error: '부위와 운동명이 필요합니다' }
  const payload = {
    [idField]: userId,
    body_part: bodyPart,
    exercise_name: exerciseName.trim(),
    track_pr: true,
  }
  const { data, error } = await supabase
    .from(table)
    .insert(payload)
    .select()
    .single()
  if (error) {
    if (error.code === '23505') {
      return { success: false, error: '이미 등록된 운동입니다', duplicate: true }
    }
    console.error('[addFavorite] error:', error)
    return { success: false, error: error.message }
  }
  return { success: true, data }
}

export const removeFavorite = async (favoriteId, table = 'member_favorite_exercises') => {
  const { error } = await supabase.from(table).delete().eq('id', favoriteId)
  if (error) {
    console.error('[removeFavorite] error:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// ── 구독 (SaaS 사용료) ──
// 상태: trial / active / expired / cancelled
// 트라이얼은 가입 후 30일 자동. 정식 결제는 토스페이먼츠 연동 후 활성화.
export const loadSubscription = async (trainerId) => {
  if (!trainerId) return null
  const { data, error } = await supabase
    .from('trainer_subscriptions')
    .select('*')
    .eq('trainer_id', trainerId)
    .maybeSingle()
  if (error) {
    console.error('[loadSubscription] error:', error)
    return null
  }
  return data
}

// 구독 요약 — UI 표시용
// 반환: { state: 'trial'|'active'|'expired', daysLeft: number, expiresAt: Date|null, label: string }
export const summarizeSubscription = (sub) => {
  if (!sub) {
    return { state: 'expired', daysLeft: 0, expiresAt: null, label: '구독 정보 없음' }
  }
  const now = new Date()
  const trialEnd = sub.trial_expires_at ? new Date(sub.trial_expires_at) : null
  const paidEnd = sub.paid_expires_at ? new Date(sub.paid_expires_at) : null

  // 유료가 살아있으면 active
  if (paidEnd && paidEnd > now) {
    const days = Math.ceil((paidEnd - now) / (1000 * 60 * 60 * 24))
    return { state: 'active', daysLeft: days, expiresAt: paidEnd, label: `구독 ${days}일 남음` }
  }
  // 트라이얼이 살아있으면 trial
  if (trialEnd && trialEnd > now) {
    const days = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24))
    return { state: 'trial', daysLeft: days, expiresAt: trialEnd, label: `무료 체험 ${days}일 남음` }
  }
  return { state: 'expired', daysLeft: 0, expiresAt: paidEnd || trialEnd, label: '구독 만료' }
}

// ── 미디어 업로드 공통 ──
export const MAX_MEDIA_BYTES = 100 * 1024 * 1024 // 100MB

export const checkMediaSize = (file) => {
  if (!file) return { ok: false, error: '파일이 없습니다' }
  if (file.size > MAX_MEDIA_BYTES) {
    const sizeMb = (file.size / 1024 / 1024).toFixed(1)
    return { ok: false, error: `파일이 너무 큽니다 (${sizeMb}MB). 100MB 이하로 줄여주세요.` }
  }
  return { ok: true }
}

// ── 식단 즐겨찾기 ──
export const loadDietFavorites = async (userId, table = 'diet_favorites', idField = 'member_id') => {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq(idField, userId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[loadDietFavorites] error:', error)
    return []
  }
  return data || []
}

export const addDietFavorite = async (userId, fav, table = 'diet_favorites', idField = 'member_id') => {
  if (!fav?.name || !fav.name.trim()) return { success: false, error: '이름이 필요합니다' }
  const payload = {
    [idField]: userId,
    name: fav.name.trim(),
    carbs: parseFloat(fav.carbs) || 0,
    protein: parseFloat(fav.protein) || 0,
    fat: parseFloat(fav.fat) || 0,
    calories: parseInt(fav.calories) || 0,
  }
  const { data, error } = await supabase.from(table).insert(payload).select().single()
  if (error) {
    console.error('[addDietFavorite] error:', error)
    return { success: false, error: error.message }
  }
  return { success: true, data }
}

export const removeDietFavorite = async (favId, table = 'diet_favorites') => {
  const { error } = await supabase.from(table).delete().eq('id', favId)
  if (error) {
    console.error('[removeDietFavorite] error:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

export const getLatestRecord = (allLogs, bodyPart, exerciseName) => {
  if (!allLogs || !bodyPart || !exerciseName) return null
  const matched = allLogs.filter(l =>
    l.exercise_type !== 'cardio' &&
    l.body_part === bodyPart &&
    l.exercise_name === exerciseName &&
    parseFloat(l.weight) > 0 &&
    parseInt(l.reps) > 0
  )
  if (matched.length === 0) return null
  matched.sort((a, b) => b.log_date.localeCompare(a.log_date))
  const latestDate = matched[0].log_date
  const sameDay = matched.filter(l => l.log_date === latestDate)
  const best = sameDay.reduce((max, cur) =>
    parseFloat(cur.weight) > parseFloat(max.weight) ? cur : max
  , sameDay[0])
  return {
    date: latestDate,
    weight: parseFloat(best.weight),
    reps: parseInt(best.reps),
  }
}

// ─── 인바디 관련 함수들 ───

export const loadInbody = async (userId, table = 'member_inbody', idField = 'member_id') => {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq(idField, userId)
    .order('measured_date', { ascending: true })
  if (error) {
    console.error('[loadInbody] error:', error)
    return []
  }
  return (data || []).map(r => ({
    ...r,
    _source: table === 'trainer_inbody' ? 'trainer' : 'member',
    _table: table,
  }))
}

export const loadInbodyMerged = async (memberId) => {
  if (!memberId) return []

  const [memberRes, trainerRes] = await Promise.all([
    supabase
      .from('member_inbody')
      .select('*')
      .eq('member_id', memberId)
      .order('measured_date', { ascending: true }),
    supabase
      .from('trainer_inbody')
      .select('*')
      .eq('member_id', memberId)
      .order('measured_date', { ascending: true }),
  ])

  if (memberRes.error) console.error('[loadInbodyMerged] member error:', memberRes.error)
  if (trainerRes.error) console.error('[loadInbodyMerged] trainer error:', trainerRes.error)

  const memberData = (memberRes.data || []).map(r => ({
    ...r,
    _source: 'member',
    _table: 'member_inbody',
  }))
  const trainerData = (trainerRes.data || []).map(r => ({
    ...r,
    _source: 'trainer',
    _table: 'trainer_inbody',
  }))

  const merged = [...memberData, ...trainerData].sort((a, b) => {
    if (a.measured_date !== b.measured_date) {
      return a.measured_date.localeCompare(b.measured_date)
    }
    return (a.created_at || '').localeCompare(b.created_at || '')
  })

  return merged
}

export const addInbody = async (userId, record, table = 'member_inbody', idField = 'member_id', extra = {}) => {
  const { measured_date, weight, muscle_mass, body_fat_mass, body_fat_percent } = record
  if (!measured_date || !weight || !muscle_mass || !body_fat_mass || !body_fat_percent) {
    return { success: false, error: '모든 항목을 입력해주세요' }
  }
  const payload = {
    [idField]: userId,
    measured_date,
    weight: parseFloat(weight),
    muscle_mass: parseFloat(muscle_mass),
    body_fat_mass: parseFloat(body_fat_mass),
    body_fat_percent: parseFloat(body_fat_percent),
    ...extra,
  }
  const { data, error } = await supabase
    .from(table)
    .insert(payload)
    .select()
    .single()
  if (error) {
    console.error('[addInbody] error:', error)
    return { success: false, error: error.message }
  }
  return { success: true, data }
}

export const updateInbody = async (recordId, record, table = 'member_inbody') => {
  const { measured_date, weight, muscle_mass, body_fat_mass, body_fat_percent } = record
  const payload = {
    measured_date,
    weight: parseFloat(weight),
    muscle_mass: parseFloat(muscle_mass),
    body_fat_mass: parseFloat(body_fat_mass),
    body_fat_percent: parseFloat(body_fat_percent),
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from(table).update(payload).eq('id', recordId)
  if (error) {
    console.error('[updateInbody] error:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

export const deleteInbody = async (recordId, table = 'member_inbody') => {
  const { error } = await supabase.from(table).delete().eq('id', recordId)
  if (error) {
    console.error('[deleteInbody] error:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

export const getInbodyStats = (inbodyList, metric = 'weight') => {
  if (!inbodyList || inbodyList.length === 0) {
    return { current: 0, min: 0, max: 0, diff: 0, diffPercent: 0, count: 0 }
  }
  const values = inbodyList.map(r => parseFloat(r[metric]) || 0).filter(v => v > 0)
  if (values.length === 0) {
    return { current: 0, min: 0, max: 0, diff: 0, diffPercent: 0, count: 0 }
  }
  const current = values[values.length - 1]
  const first = values[0]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const diff = Math.round((current - first) * 10) / 10
  const diffPercent = first > 0 ? Math.round((current - first) / first * 1000) / 10 : 0
  return {
    current,
    min,
    max,
    diff,
    diffPercent,
    count: values.length,
  }
}

// ─── 4대 종목 PR (v4: 회원/트레이너 양쪽 지원) ───

export const BIG4_EXERCISES = [
  { key: 'squat',    label: '스쿼트',         color: THEME.primary },
  { key: 'deadlift', label: '데드리프트',     color: THEME.primary },
  { key: 'bench',    label: '벤치 프레스',    color: THEME.primary },
  { key: 'ohp',      label: '오버헤드 프레스', color: THEME.primary },
]

export const loadBig4PRs = async (
  userId,
  table = 'personal_records',
  idField = 'member_id'
) => {
  if (!userId) return {}

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq(idField, userId)
    .in('exercise_key', ['squat', 'deadlift', 'bench', 'ohp'])

  if (error) {
    console.error('[loadBig4PRs] error:', error)
    return {}
  }

  const result = {}
  ;(data || []).forEach(row => {
    result[row.exercise_key] = {
      id: row.id,
      weight: row.weight,
      reps: row.reps,
      recorded_date: row.recorded_date,
      updated_at: row.updated_at,
    }
  })
  return result
}

export const saveBig4PR = async (
  userId,
  exerciseKey,
  weight,
  reps,
  table = 'personal_records',
  idField = 'member_id'
) => {
  if (!userId || !exerciseKey) {
    return { success: false, error: '필수 정보가 누락되었습니다' }
  }
  if (!['squat', 'deadlift', 'bench', 'ohp'].includes(exerciseKey)) {
    return { success: false, error: '유효하지 않은 종목입니다' }
  }

  const w = weight === '' || weight === null ? null : parseFloat(weight)
  const r = reps === '' || reps === null ? null : parseInt(reps)

  if (w !== null && (isNaN(w) || w < 0)) {
    return { success: false, error: '무게가 올바르지 않습니다' }
  }
  if (r !== null && (isNaN(r) || r < 0)) {
    return { success: false, error: '횟수가 올바르지 않습니다' }
  }

  const today = new Date().toISOString().split('T')[0]
  const payload = {
    [idField]: userId,
    exercise_key: exerciseKey,
    weight: w,
    reps: r,
    recorded_date: today,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from(table)
    .upsert(payload, { onConflict: `${idField},exercise_key` })
    .select()
    .single()

  if (error) {
    console.error('[saveBig4PR] error:', error)
    return { success: false, error: error.message }
  }
  return { success: true, data }
}

// ═══════════════════════════════════════════════════════════
// Phase 1A: 알림 + PT 세션 + 채팅 (NEW v5.2)
// ═══════════════════════════════════════════════════════════

// ─── 알림 ───

// 알림 생성. recipientType: 'trainer' | 'member'
// link 예시: "chat:conversation_uuid", "member:member_uuid", null
export const sendNotification = async ({
  recipientType,
  recipientId,
  senderType = 'system',
  senderId = null,
  kind,
  content,
  link = null,
}) => {
  if (!recipientType || !recipientId || !kind || !content) {
    console.error('[sendNotification] missing required params')
    return { success: false, error: '필수 정보 누락' }
  }

  const payload = {
    recipient_type: recipientType,
    recipient_id: recipientId,
    sender_type: senderType,
    sender_id: senderId,
    kind,
    content,
    link,
  }

  const { data, error } = await supabase
    .from('notifications')
    .insert(payload)
    .select()
    .single()

  if (error) {
    console.error('[sendNotification] error:', error)
    return { success: false, error: error.message }
  }
  return { success: true, data }
}

// 알림 목록 가져오기
export const loadNotifications = async (recipientId, limit = 30) => {
  if (!recipientId) return []
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', recipientId)
    .neq('kind', 'chat_message')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[loadNotifications] error:', error)
    return []
  }
  return data || []
}

// 미읽음 알림 개수
export const getUnreadNotificationCount = async (recipientId) => {
  if (!recipientId) return 0
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', recipientId)
    .eq('is_read', false)
    .neq('kind', 'chat_message')
  if (error) {
    console.error('[getUnreadNotificationCount] error:', error)
    return 0
  }
  return count || 0
}

// 알림 1개 읽음 처리
export const markNotificationRead = async (notificationId) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
  if (error) {
    console.error('[markNotificationRead] error:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// 모든 알림 읽음 처리
export const markAllNotificationsRead = async (recipientId) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_id', recipientId)
    .eq('is_read', false)
  if (error) {
    console.error('[markAllNotificationsRead] error:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// ─── PT 세션 ───

// PT 1회 차감. 10/5회 알림 자동 발송.
// 반환: { success, remaining, total } 또는 { success: false, error }
export const usePtSession = async (memberId) => {
  if (!memberId) return { success: false, error: 'memberId 누락' }

  // 1. 현재 회원 정보 가져오기
  const { data: member, error: memErr } = await supabase
    .from('members')
    .select('id, name, trainer_id, pt_total_sessions, pt_used_sessions, pt_alert_10_sent, pt_alert_5_sent')
    .eq('id', memberId)
    .single()

  if (memErr || !member) {
    console.error('[usePtSession] member load error:', memErr)
    return { success: false, error: '회원 정보 조회 실패' }
  }

  const total = member.pt_total_sessions || 0
  const used = member.pt_used_sessions || 0

  if (total <= 0) {
    return { success: false, error: 'PT 횟수가 등록되지 않았습니다' }
  }

  if (used >= total) {
    return { success: false, error: 'PT 잔여 횟수가 없습니다' }
  }

  // 2. 차감
  const newUsed = used + 1
  const remaining = total - newUsed

  const { error: updErr } = await supabase
    .from('members')
    .update({ pt_used_sessions: newUsed })
    .eq('id', memberId)

  if (updErr) {
    console.error('[usePtSession] update error:', updErr)
    return { success: false, error: '차감 실패: ' + updErr.message }
  }

  // 3. 10회/5회 알림 (트레이너에게)
  if (remaining === 10 && !member.pt_alert_10_sent) {
    await sendNotification({
      recipientType: 'trainer',
      recipientId: member.trainer_id,
      senderType: 'system',
      kind: 'pt_low_10',
      content: `${member.name} 회원 PT 10회 남았어요`,
      link: `member:${member.id}`,
    })
    await supabase
      .from('members')
      .update({ pt_alert_10_sent: true })
      .eq('id', memberId)
  } else if (remaining === 5 && !member.pt_alert_5_sent) {
    await sendNotification({
      recipientType: 'trainer',
      recipientId: member.trainer_id,
      senderType: 'system',
      kind: 'pt_low_5',
      content: `${member.name} 회원 PT 5회 남았어요`,
      link: `member:${member.id}`,
    })
    await supabase
      .from('members')
      .update({ pt_alert_5_sent: true })
      .eq('id', memberId)
  }

  return { success: true, remaining, total, used: newUsed }
}

// PT 횟수 충전. 충전 시 알림 플래그 리셋해서 다음 10/5회 도달 시 다시 알림.
export const addPtSessions = async (memberId, count) => {
  if (!memberId || !count || count <= 0) {
    return { success: false, error: '잘못된 값' }
  }

  const { data: member, error: memErr } = await supabase
    .from('members')
    .select('pt_total_sessions, pt_used_sessions')
    .eq('id', memberId)
    .single()

  if (memErr || !member) {
    return { success: false, error: '회원 조회 실패' }
  }

  const newTotal = (member.pt_total_sessions || 0) + parseInt(count)
  const used = member.pt_used_sessions || 0
  const remaining = newTotal - used

  // 충전 후 잔여가 10회 초과면 알림 플래그 리셋 (다음에 또 도달 시 알림)
  // 잔여가 5회 초과면 5회 알림 리셋
  const updatePayload = {
    pt_total_sessions: newTotal,
  }
  if (remaining > 10) {
    updatePayload.pt_alert_10_sent = false
  }
  if (remaining > 5) {
    updatePayload.pt_alert_5_sent = false
  }

  const { error: updErr } = await supabase
    .from('members')
    .update(updatePayload)
    .eq('id', memberId)

  if (updErr) {
    console.error('[addPtSessions] update error:', updErr)
    return { success: false, error: updErr.message }
  }

  return { success: true, newTotal, remaining }
}

// PT 잔여 횟수 계산 (헬퍼)
export const calcPtRemaining = (member) => {
  if (!member) return { total: 0, used: 0, remaining: 0, hasNoPt: true }
  const total = member.pt_total_sessions || 0
  const used = member.pt_used_sessions || 0
  return {
    total,
    used,
    remaining: Math.max(0, total - used),
    hasNoPt: total <= 0,
  }
}

// ─── 오늘 기록 완료 ───

// 회원이 "오늘 기록 완료" 누름. 트레이너에게 알림.
// 하루 여러 번 눌러도 매번 알림 전송됨 (중복 체크 없음).
export const markTodayComplete = async (memberId) => {
  if (!memberId) return { success: false, error: 'memberId 누락' }

  const today = new Date().toISOString().split('T')[0]

  const { data: member, error: memErr } = await supabase
    .from('members')
    .select('id, name, trainer_id')
    .eq('id', memberId)
    .single()

  if (memErr || !member) {
    return { success: false, error: '회원 조회 실패' }
  }

  // 마지막 완료 일자만 기록 (UI 표시용. 알림 전송 자체는 제한 없음)
  await supabase
    .from('members')
    .update({ daily_complete_date: today })
    .eq('id', memberId)

  // 트레이너에게 알림
  await sendNotification({
    recipientType: 'trainer',
    recipientId: member.trainer_id,
    senderType: 'member',
    senderId: memberId,
    kind: 'today_complete',
    content: `${member.name} 회원이 오늘 기록을 완료했어요`,
    link: `member:${memberId}`,
  })

  return { success: true }
}

// 오늘 이미 완료했는지 체크 (UI 비활성화용)
export const isTodayCompleted = (member) => {
  if (!member) return false
  const today = new Date().toISOString().split('T')[0]
  return member.daily_complete_date === today
}

// ─── 채팅 ───

// 트레이너-회원 대화방 가져오거나 생성
export const getOrCreateConversation = async (trainerId, memberId) => {
  if (!trainerId || !memberId) {
    return { success: false, error: 'ID 누락' }
  }

  // 1. 기존 대화방 찾기
  const { data: existing, error: findErr } = await supabase
    .from('conversations')
    .select('*')
    .eq('trainer_id', trainerId)
    .eq('member_id', memberId)
    .maybeSingle()

  if (findErr) {
    console.error('[getOrCreateConversation] find error:', findErr)
    return { success: false, error: findErr.message }
  }

  if (existing) {
    return { success: true, data: existing }
  }

  // 2. 새로 생성
  const { data: created, error: createErr } = await supabase
    .from('conversations')
    .insert({
      trainer_id: trainerId,
      member_id: memberId,
    })
    .select()
    .single()

  if (createErr) {
    console.error('[getOrCreateConversation] create error:', createErr)
    return { success: false, error: createErr.message }
  }

  return { success: true, data: created }
}

// 트레이너의 모든 대화방 (채팅 목록용)
export const loadConversationsForTrainer = async (trainerId) => {
  if (!trainerId) return []
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('trainer_id', trainerId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
  if (error) {
    console.error('[loadConversationsForTrainer] error:', error)
    return []
  }
  if (!data || data.length === 0) return []

  // 회원 정보 따로 가져와서 합치기
  const memberIds = data.map(c => c.member_id)
  const { data: mems } = await supabase
    .from('members')
    .select('id, name')
    .in('id', memberIds)
  const memberMap = {}
  ;(mems || []).forEach(m => { memberMap[m.id] = m })
  return data.map(c => ({ ...c, members: memberMap[c.member_id] || null }))
}

// 메시지 목록
export const loadMessages = async (conversationId, limit = 100) => {
  if (!conversationId) return []
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) {
    console.error('[loadMessages] error:', error)
    return []
  }
  return data || []
}

// 메시지 전송 + conversation 메타데이터 업데이트 + 상대방에게 알림
export const sendMessage = async ({
  conversationId,
  senderType,
  senderId,
  content = null,
  mediaUrl = null,
  mediaType = null,
}) => {
  if (!conversationId || !senderType || !senderId) {
    return { success: false, error: '필수 정보 누락' }
  }
  if (!content && !mediaUrl) {
    return { success: false, error: '내용이 비어있습니다' }
  }

  // 1. 메시지 저장
  const { data: msg, error: msgErr } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_type: senderType,
      sender_id: senderId,
      content,
      media_url: mediaUrl,
      media_type: mediaType,
    })
    .select()
    .single()

  if (msgErr) {
    console.error('[sendMessage] insert error:', msgErr)
    return { success: false, error: msgErr.message }
  }

  // 2. conversation 메타데이터 업데이트 + 상대 미읽음 +1
  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .select('trainer_id, member_id, trainer_unread_count, member_unread_count')
    .eq('id', conversationId)
    .single()

  if (convErr || !conv) {
    console.error('[sendMessage] conv load error:', convErr)
    return { success: true, data: msg }
  }

  const preview = mediaUrl ? '사진 1장' : (content?.length > 30 ? content.substring(0, 30) + '...' : content)

  const updatePayload = {
    last_message_at: new Date().toISOString(),
    last_message_preview: preview,
  }
  if (senderType === 'trainer') {
    updatePayload.member_unread_count = (conv.member_unread_count || 0) + 1
  } else {
    updatePayload.trainer_unread_count = (conv.trainer_unread_count || 0) + 1
  }

  await supabase
    .from('conversations')
    .update(updatePayload)
    .eq('id', conversationId)

  // 3. 채팅 알림은 notifications 테이블에 INSERT하지 않음
  //    → 채팅은 💬 아이콘의 미읽음 카운트로만 표시
  //    → 푸시 알림은 별도 경로 (messages INSERT trigger + Edge Function)에서 처리

  return { success: true, data: msg }
}

// 메시지 읽음 처리. 자기가 받은 메시지들 is_read=true + conversation unread 0으로.
export const markMessagesRead = async (conversationId, viewerType) => {
  if (!conversationId || !viewerType) return { success: false }

  // viewerType이 trainer면 회원이 보낸 메시지를 읽은 것
  const senderTypeToRead = viewerType === 'trainer' ? 'member' : 'trainer'

  await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('conversation_id', conversationId)
    .eq('sender_type', senderTypeToRead)
    .eq('is_read', false)

  // conversation의 본인 unread count 0으로
  const updatePayload = {}
  if (viewerType === 'trainer') {
    updatePayload.trainer_unread_count = 0
  } else {
    updatePayload.member_unread_count = 0
  }

  await supabase
    .from('conversations')
    .update(updatePayload)
    .eq('id', conversationId)

  return { success: true }
}

// 채팅 사진 업로드 (workout-media bucket 사용)
export const uploadChatImage = async (conversationId, senderId, file) => {
  const sizeCheck = checkMediaSize(file)
  if (!sizeCheck.ok) return { success: false, error: sizeCheck.error }
  try {
    const ext = file.name.split('.').pop().toLowerCase()
    const fileName = `chat/${conversationId}/${senderId}_${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('workout-media')
      .upload(fileName, file, { upsert: false })
    if (uploadError) {
      console.error('[uploadChatImage] upload error:', uploadError)
      return { success: false, error: uploadError.message }
    }
    const { data: urlData } = supabase.storage
      .from('workout-media')
      .getPublicUrl(fileName)
    return { success: true, url: urlData.publicUrl }
  } catch (e) {
    console.error('[uploadChatImage] exception:', e)
    return { success: false, error: e.message }
  }
}
// ═══════════════════════════════════════════════════════════
// Phase 1.5: PWA 푸시 알림 (NEW)
// ═══════════════════════════════════════════════════════════

// VAPID 키 base64 → Uint8Array 변환 (구독 등록 시 필요)
const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// 푸시 알림 지원 여부 확인
export const isPushSupported = () => {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// 현재 푸시 알림 상태 가져오기
// 반환: 'granted' | 'denied' | 'default' | 'unsupported'
export const getPushPermissionStatus = () => {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

// 현재 사용자의 구독 정보가 DB에 저장돼 있는지 확인
export const isPushSubscribed = async (userId) => {
  if (!userId || !isPushSupported()) return false
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return false

    // DB에도 있는지 확인
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('endpoint', subscription.endpoint)
      .maybeSingle()
    if (error) {
      console.error('[isPushSubscribed] error:', error)
      return false
    }
    return !!data
  } catch (e) {
    console.error('[isPushSubscribed] exception:', e)
    return false
  }
}

// 푸시 알림 구독 등록
// 1) 알림 권한 요청 (처음이면)
// 2) PushManager로 구독
// 3) DB에 저장
export const subscribeToPush = async (userId, userType) => {
  if (!isPushSupported()) {
    return { success: false, error: '이 브라우저는 푸시 알림을 지원하지 않습니다.' }
  }
  if (!userId || !userType) {
    return { success: false, error: '사용자 정보가 없습니다.' }
  }

  const vapidPublicKey = process.env.REACT_APP_VAPID_PUBLIC_KEY
  if (!vapidPublicKey) {
    return { success: false, error: 'VAPID 키가 설정되지 않았습니다.' }
  }

  try {
    // 1. 권한 요청
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return { success: false, error: '알림 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.' }
    }

    // 2. Service Worker 준비
    const registration = await navigator.serviceWorker.ready

    // 3. 기존 구독 있으면 해제
    const existingSub = await registration.pushManager.getSubscription()
    if (existingSub) {
      await existingSub.unsubscribe()
    }

    // 4. 새로 구독
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })

    // 5. 구독 정보 DB 저장
    const subJson = subscription.toJSON()
    const payload = {
      user_id: userId,
      user_type: userType,
      endpoint: subscription.endpoint,
      p256dh: subJson.keys.p256dh,
      auth: subJson.keys.auth,
      user_agent: navigator.userAgent,
      updated_at: new Date().toISOString(),
    }

    // upsert (같은 endpoint면 업데이트, 없으면 새로 추가)
    const { error: dbError } = await supabase
      .from('push_subscriptions')
      .upsert(payload, { onConflict: 'user_id,endpoint' })

    if (dbError) {
      console.error('[subscribeToPush] DB error:', dbError)
      return { success: false, error: 'DB 저장 실패: ' + dbError.message }
    }

    return { success: true }
  } catch (e) {
    console.error('[subscribeToPush] exception:', e)
    return { success: false, error: e.message }
  }
}

// 푸시 알림 구독 해제
export const unsubscribeFromPush = async (userId) => {
  if (!isPushSupported()) return { success: false, error: '미지원' }
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    if (subscription) {
      // DB에서 삭제
      const { error: dbError } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', subscription.endpoint)

      if (dbError) {
        console.error('[unsubscribeFromPush] DB error:', dbError)
      }

      // 브라우저 구독도 해제
      await subscription.unsubscribe()
    }

    return { success: true }
  } catch (e) {
    console.error('[unsubscribeFromPush] exception:', e)
    return { success: false, error: e.message }
  }
}
// ─── 푸시 알림 안내 모달 헬퍼 ───

// 푸시 안내 모달을 보여줘야 하는지 체크
// - 푸시 미지원 → 안 보임
// - 이미 권한 거절(denied) → 안 보임
// - 이미 구독됨 → 안 보임
// - 1일 이내 "나중에" 눌렀음 → 안 보임
export const shouldShowPushPrompt = async (userId) => {
  if (!isPushSupported()) return false
  const status = getPushPermissionStatus()
  if (status === 'denied') return false  // 브라우저 차단 — 모달로 풀 수 없음
  if (status === 'granted') {
    const subscribed = await isPushSubscribed(userId)
    if (subscribed) return false  // 이미 구독됨
  }
  // "나중에" 눌렀던 적 있나?
  const dismissed = localStorage.getItem(`push_prompt_dismissed_${userId}`)
  if (dismissed) {
    const dismissedAt = parseInt(dismissed)
    const oneDayMs = 24 * 60 * 60 * 1000
    if (Date.now() - dismissedAt < oneDayMs) return false
  }
  return true
}

// "나중에" 눌렀을 때 호출
export const dismissPushPrompt = (userId) => {
  localStorage.setItem(`push_prompt_dismissed_${userId}`, String(Date.now()))
}
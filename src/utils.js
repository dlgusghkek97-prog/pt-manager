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

export const calcMacro = ({ goal, gender, weight, muscle, activity, intensity, cyclePhase }) => {
  const leanMass = muscle * 1.4
  const bmr = Math.round(370 + 21.6 * leanMass)
  const actMap = { '가벼운 운동 (주 2~3회)': 1.375, '보통 운동 (주 4~5회)': 1.55, '고강도 운동 (주 6회+)': 1.725 }
  const tdee = Math.round(bmr * (actMap[activity] || 1.55))
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
  const volumeKcal = volume * 0.025
  return Math.round(metKcal + volumeKcal)
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
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' },
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

// ─── 인바디 관련 함수들 (NEW v2 - 케이스 C: trainer_inbody에 trainer_id + member_id) ───

// 인바디 측정 기록 로드 (단일 테이블, 날짜 오름차순)
// 사용 예:
//   회원: loadInbody(memberId)
//   트레이너 본인: loadInbody(trainerId, 'trainer_inbody', 'trainer_id')
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
  // 메타정보 부착 (수정/삭제 시 어느 테이블 행인지 알기 위함)
  return (data || []).map(r => ({
    ...r,
    _source: table === 'trainer_inbody' ? 'trainer' : 'member',
    _table: table,
  }))
}

// 특정 회원의 모든 인바디 기록을 합쳐서 로드 (member_inbody + trainer_inbody)
// 추이 모달에서 사용. 회원 화면이든 트레이너 화면이든 동일하게 호출.
// memberId: 대상 회원의 UUID
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

  // 날짜 오름차순으로 합쳐서 정렬 (같은 날짜면 created_at 순)
  const merged = [...memberData, ...trainerData].sort((a, b) => {
    if (a.measured_date !== b.measured_date) {
      return a.measured_date.localeCompare(b.measured_date)
    }
    return (a.created_at || '').localeCompare(b.created_at || '')
  })

  return merged
}

// 인바디 측정 기록 추가
// 회원이 입력: addInbody(memberId, record)  -> member_inbody
// 트레이너가 회원의 인바디 입력: addInbody(trainerId, record, 'trainer_inbody', 'trainer_id', { member_id: memberId })
export const addInbody = async (userId, record, table = 'member_inbody', idField = 'member_id', extra = {}) => {
  const { measured_date, weight, muscle_mass, body_fat_percent } = record
  if (!measured_date || !weight || !muscle_mass || !body_fat_percent) {
    return { success: false, error: '모든 항목을 입력해주세요' }
  }
  const payload = {
    [idField]: userId,
    measured_date,
    weight: parseFloat(weight),
    muscle_mass: parseFloat(muscle_mass),
    body_fat_percent: parseFloat(body_fat_percent),
    ...extra, // trainer_inbody에 member_id 추가용
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

// 인바디 측정 기록 수정
// table: 'member_inbody' | 'trainer_inbody' (어느 테이블의 행인지 명시 필요)
export const updateInbody = async (recordId, record, table = 'member_inbody') => {
  const { measured_date, weight, muscle_mass, body_fat_percent } = record
  const payload = {
    measured_date,
    weight: parseFloat(weight),
    muscle_mass: parseFloat(muscle_mass),
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

// 인바디 측정 기록 삭제
// table: 'member_inbody' | 'trainer_inbody'
export const deleteInbody = async (recordId, table = 'member_inbody') => {
  const { error } = await supabase.from(table).delete().eq('id', recordId)
  if (error) {
    console.error('[deleteInbody] error:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// 인바디 요약 통계 (현재값, 최고/최저값, 첫 측정 대비 변화량)
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
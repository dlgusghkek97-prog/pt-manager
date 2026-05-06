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
  const bmr = gender === '여성'
    ? Math.round((370 + 21.6 * leanMass) * 0.9)
    : Math.round(370 + 21.6 * leanMass)
  const actMap = { '가벼운 운동 (주 2~3회)': 1.375, '보통 운동 (주 4~5회)': 1.55, '고강도 운동 (주 6회+)': 1.725 }
  const tdee = Math.round(bmr * (actMap[activity] || 1.55))
  const adjMap = goal === '벌크업'
    ? { '완만': 300, '일반': 400, '공격적': 500 }
    : { '완만': -300, '일반': -500, '공격적': -700 }
  const cycleAdj = (gender === '여성' && cyclePhase) ? (CYCLE_PHASES[cyclePhase] || 0) : 0
  const target = tdee + (adjMap[intensity] || (goal === '벌크업' ? 400 : -500)) + 100 + cycleAdj
  const protein = Math.round(weight * (gender === '여성' ? 2.0 : 2.2))
  const fat = Math.round(target * 0.25 / 9)
  const carbs = Math.max(0, Math.round((target - protein * 4 - fat * 9) / 4))
  return { bmr, tdee, target, protein, fat, carbs }
}

// 웨이트 운동 순수 소비 칼로리 (BMR 제외, 옵션 C 절충안)
// 공식: 4.0 × 체중 × (세트 × 2분 / 60) + 볼륨 × 0.025
// 예: 70kg, 20세트, 볼륨 20,000kg
//   = 4.0 × 70 × 0.67 + 20000 × 0.025 = 187 + 500 = 687 kcal
export function calcWeightCalories({ volume = 0, totalSets = 0, weight, muscle }) {
  const w = parseFloat(weight) || 70  // 기본값 70kg
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
  // 영양소 색상 (소프트 톤)
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
  // 잉여/적자
  surplus: '#5A9CAB',
  deficit: '#C5705C',
  todayHighlight: '#5A8E72',
}

// SVG 아이콘 모음
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
  container: { minHeight: '100vh', background: THEME.bg, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', fontFamily: "'Apple SD Gothic Neo', sans-serif", padding: '20px' },
  wrap: { width: '100%', maxWidth: '480px', paddingTop: '16px' },
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
  // calcMacro와 정확히 역산: target = TDEE + adj + 100
  // (여성의 cyclePhase 보정은 ±50~150 kcal 범위라 무시 — 잉여/적자 본질적 정확도 내)
  return target - adj - 100
}
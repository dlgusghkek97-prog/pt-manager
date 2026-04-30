export const PARTS = ['하체', '가슴', '등', '어깨', '팔', '복근']
export const PART_COLORS = {
  '하체': '#4472C4', '가슴': '#E84747', '등': '#2E9E3B',
  '어깨': '#E8A020', '팔': '#9B59B6', '복근': '#1ABC9C'
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

export const calcMacro = ({ goal, gender, weight, muscle, activity, intensity }) => {
  const leanMass = muscle * 1.4
  const bmr = gender === '여성'
    ? Math.round((370 + 21.6 * leanMass) * 0.9)
    : Math.round(370 + 21.6 * leanMass)
  const actMap = { '가벼운 운동 (주 2~3회)': 1.375, '보통 운동 (주 4~5회)': 1.55, '고강도 운동 (주 6회+)': 1.725 }
  const tdee = Math.round(bmr * (actMap[activity] || 1.55))
  const adjMap = goal === '벌크업'
    ? { '완만': 300, '일반': 400, '공격적': 500 }
    : { '완만': -300, '일반': -500, '공격적': -700 }
  const target = tdee + (adjMap[intensity] || (goal === '벌크업' ? 400 : -500))
  const protein = Math.round(weight * (gender === '여성' ? 2.0 : 2.2))
  const fat = Math.round(target * 0.25 / 9)
  const carbs = Math.max(0, Math.round((target - protein * 4 - fat * 9) / 4))
  return { bmr, tdee, target, protein, fat, carbs }
}

export const S = {
  container: { minHeight: '100vh', background: '#1A1A2E', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', fontFamily: "'Apple SD Gothic Neo', sans-serif", padding: '20px' },
  wrap: { width: '100%', maxWidth: '480px', paddingTop: '16px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' },
  headerTitle: { color: '#E8C547', fontSize: '20px', fontWeight: '700', margin: 0 },
  logoutBtn: { background: 'transparent', border: '1px solid #E8C547', color: '#E8C547', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
  tabBar: { display: 'flex', gap: '8px', marginBottom: '12px' },
  tab: { flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #444', background: 'transparent', color: '#888', fontSize: '13px', cursor: 'pointer' },
  tabActive: { flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#E8C547', color: '#1A1A2E', fontSize: '13px', fontWeight: '700', cursor: 'pointer' },
  card: { background: '#FFFFFF', borderRadius: '16px', padding: '16px', marginBottom: '12px' },
  cardTitle: { fontSize: '15px', fontWeight: '700', color: '#1A1A2E', margin: '0 0 12px' },
  addBtn: { background: '#1A1A2E', color: '#E8C547', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700' },
  barRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' },
  barLabel: { fontSize: '12px', color: '#333', width: '32px', flexShrink: 0 },
  barBg: { flex: 1, background: '#F0F0F0', borderRadius: '4px', height: '10px' },
  barFill: { height: '10px', borderRadius: '4px' },
  barVal: { fontSize: '11px', color: '#888', width: '58px', textAlign: 'right', flexShrink: 0 },
  dateInput: { padding: '6px 10px', borderRadius: '8px', border: '1px solid #DDD', fontSize: '13px' },
  exBox: { background: '#F9F9F9', borderRadius: '12px', padding: '12px', marginBottom: '10px' },
  exHeader: { display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '10px' },
  partSel: { flex: 1, padding: '7px', borderRadius: '6px', border: '1px solid #DDD', fontSize: '12px', background: '#FFF', minWidth: 0 },
  exNameInput: { flex: 2, padding: '7px', borderRadius: '6px', border: '1px solid #DDD', fontSize: '12px', minWidth: 0 },
  delExBtn: { background: '#FFE0E0', color: '#E84747', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', fontSize: '12px', flexShrink: 0 },
  setHeaderRow: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' },
  setRow: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' },
  numInput: { flex: 1, padding: '7px 4px', borderRadius: '6px', border: '1px solid #DDD', fontSize: '13px', textAlign: 'center', minWidth: 0 },
  delSetBtn: { flex: 0.4, background: '#F0F0F0', color: '#888', border: 'none', borderRadius: '6px', padding: '7px 6px', cursor: 'pointer', fontSize: '14px' },
  addSetBtn: { width: '100%', padding: '7px', borderRadius: '6px', border: '1px dashed #CCC', background: 'transparent', color: '#888', fontSize: '13px', cursor: 'pointer', marginTop: '4px' },
  addExBtn: { width: '100%', padding: '12px', borderRadius: '10px', border: '2px dashed #1A1A2E', background: 'transparent', color: '#1A1A2E', fontSize: '14px', fontWeight: '700', cursor: 'pointer' },
  loginCard: { background: '#FFFFFF', borderRadius: '16px', padding: '40px 32px', width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '12px' },
  input: { width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #DDD', fontSize: '15px', outline: 'none', boxSizing: 'border-box' },
  btnPrimary: { width: '100%', padding: '14px', borderRadius: '8px', border: 'none', background: '#1A1A2E', color: '#E8C547', fontSize: '16px', fontWeight: '700', cursor: 'pointer' },
  btnSecondary: { width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #DDD', background: '#FFF', color: '#555', fontSize: '15px', cursor: 'pointer' },
}
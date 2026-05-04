import React, { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { S, THEME, PART_COLORS, generateCode, calcMacro, CYCLE_PHASES } from './utils'
import WorkoutLog from './WorkoutLog'
import WorkoutStats from './WorkoutStats'
import DietLog from './DietLog'
import HelpModal from './HelpModal'

const IconMembers = ({ color = 'currentColor' }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
    <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
    <line x1="16" y1="11" x2="22" y2="11"/><line x1="19" y1="8" x2="19" y2="14"/>
  </svg>
)
const IconNote = ({ color = 'currentColor' }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
  </svg>
)
const IconWorkout = ({ color = 'currentColor' }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
    <path d="M6.5 6.5h11M6.5 17.5h11M3 12h18M7 9.5V6.5M17 9.5V6.5M7 17.5v-3M17 17.5v-3"/>
  </svg>
)
const IconStats = ({ color = 'currentColor' }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/>
  </svg>
)
const IconDiet = ({ color = 'currentColor' }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
    <path d="M12 2a5 5 0 0 1 5 5c0 3-5 7-5 7S7 10 7 7a5 5 0 0 1 5-5z"/>
    <path d="M5 21h14M8 17l1-3h6l1 3"/>
  </svg>
)

export default function TrainerDashboard({ user, onLogout }) {
  const [view, setView] = useState('members')
  const [members, setMembers] = useState([])
  const [memberStats, setMemberStats] = useState({})
  const [showAddMember, setShowAddMember] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberGoal, setNewMemberGoal] = useState('다이어트')
  const [newMemberGender, setNewMemberGender] = useState('여성')
  const [generatedCode, setGeneratedCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const [memberView, setMemberView] = useState('workout')
  const [trainerView, setTrainerView] = useState('workout')
  const [exercises, setExercises] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [allLogs, setAllLogs] = useState([])
  const [topTab, setTopTab] = useState('members')
  const [memberMacro, setMemberMacro] = useState(null)
  const [memberTodayDiet, setMemberTodayDiet] = useState([])

  const [trainerMacro, setTrainerMacro] = useState(null)
  const [trainerTodayDiet, setTrainerTodayDiet] = useState([])
  const [showCalcModal, setShowCalcModal] = useState(false)

  // 회원관리 탭 날짜 셀렉터
  const [memberListDate, setMemberListDate] = useState(new Date().toISOString().split('T')[0])

  // 회원 삭제 모달
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // 도움말 모달
  const [showHelp, setShowHelp] = useState(false)

  const [goal, setGoal] = useState(() => localStorage.getItem(`tmacro_goal_${user.id}`) || '벌크업')
  const [gender, setGender] = useState(() => localStorage.getItem(`tmacro_gender_${user.id}`) || '남성')
  const [weight, setWeight] = useState(() => localStorage.getItem(`tmacro_weight_${user.id}`) || '')
  const [muscle, setMuscle] = useState(() => localStorage.getItem(`tmacro_muscle_${user.id}`) || '')
  const [activity, setActivity] = useState(() => localStorage.getItem(`tmacro_activity_${user.id}`) || '보통 운동 (주 4~5회)')
  const [intensity, setIntensity] = useState(() => localStorage.getItem(`tmacro_intensity_${user.id}`) || '일반')
  const [cyclePhase, setCyclePhase] = useState(() => localStorage.getItem(`tmacro_cycle_${user.id}`) || '')

  useEffect(() => { loadMembers(); loadTrainerMacro(); loadTrainerTodayDiet() }, [])

  useEffect(() => {
    if (members.length > 0) loadStatsByDate(members, memberListDate)
  }, [memberListDate])

  const loadMembers = async () => {
    const { data } = await supabase.from('members').select('*').eq('trainer_id', user.id).order('created_at', { ascending: false })
    if (data) { setMembers(data); loadStatsByDate(data, memberListDate) }
  }

  const loadTrainerMacro = async () => {
    const { data, error } = await supabase
      .from('trainers')
      .select('target_calories, target_carbs, target_protein, target_fat')
      .eq('id', user.id)
      .single()
    if (error) { console.error('[TrainerDashboard] loadTrainerMacro error:', error); return }
    if (data && (data.target_calories || data.target_carbs || data.target_protein || data.target_fat)) {
      setTrainerMacro({
        target: data.target_calories || 0,
        carbs: data.target_carbs || 0,
        protein: data.target_protein || 0,
        fat: data.target_fat || 0
      })
    }
  }

  const loadTrainerTodayDiet = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('trainer_diet_logs')
      .select('*')
      .eq('trainer_id', user.id)
      .eq('log_date', today)
    if (error) { console.error('[TrainerDashboard] loadTrainerTodayDiet error:', error); return }
    setTrainerTodayDiet(data || [])
  }

  const saveTrainerMacro = async (macro) => {
    const { error } = await supabase
      .from('trainers')
      .update({
        target_calories: macro.target || 0,
        target_carbs: macro.carbs || 0,
        target_protein: macro.protein || 0,
        target_fat: macro.fat || 0
      })
      .eq('id', user.id)
    if (error) { console.error('[TrainerDashboard] saveTrainerMacro error:', error); alert('목표 저장 실패: ' + error.message); return false }
    return true
  }

  const calculateTrainerMacro = async () => {
    if (!weight || !muscle) { alert('체중과 골격근량을 입력해주세요.'); return }
    const result = calcMacro({ goal, gender, weight: parseFloat(weight), muscle: parseFloat(muscle), activity, intensity, cyclePhase })
    const ok = await saveTrainerMacro(result)
    if (!ok) return
    setTrainerMacro(result)
    localStorage.setItem(`tmacro_goal_${user.id}`, goal)
    localStorage.setItem(`tmacro_gender_${user.id}`, gender)
    localStorage.setItem(`tmacro_weight_${user.id}`, weight)
    localStorage.setItem(`tmacro_muscle_${user.id}`, muscle)
    localStorage.setItem(`tmacro_activity_${user.id}`, activity)
    localStorage.setItem(`tmacro_intensity_${user.id}`, intensity)
    localStorage.setItem(`tmacro_cycle_${user.id}`, cyclePhase)
    setShowCalcModal(false)
  }

  const updateTrainerMacroField = async (field, value) => {
    const updated = { ...trainerMacro, [field]: parseInt(value) || 0 }
    setTrainerMacro(updated)
    await saveTrainerMacro(updated)
  }

  const loadStatsByDate = async (memberList, date) => {
    const stats = {}
    for (const m of memberList) {
      const [{ data: wLogs }, { data: dLogs }] = await Promise.all([
        supabase.from('workout_logs').select('body_part, volume').eq('member_id', m.id).eq('log_date', date),
        supabase.from('diet_logs').select('calories, carbs, protein, fat').eq('member_id', m.id).eq('log_date', date)
      ])
      const parts = {}
      ;(wLogs || []).forEach(r => { if (r.body_part) parts[r.body_part] = (parts[r.body_part] || 0) + (r.volume || 0) })
      const calories = (dLogs || []).reduce((s, r) => s + (r.calories || 0), 0)
      const carbs = (dLogs || []).reduce((s, r) => s + (r.carbs || 0), 0)
      const protein = (dLogs || []).reduce((s, r) => s + (r.protein || 0), 0)
      const fat = (dLogs || []).reduce((s, r) => s + (r.fat || 0), 0)
      const macro = (() => { try { const s = localStorage.getItem(`macro_result_${m.id}`); return s ? JSON.parse(s) : null } catch { return null } })()
      stats[m.id] = { parts, calories, carbs, protein, fat, macro }
    }
    setMemberStats(stats)
  }

  const moveDate = (days) => {
    const d = new Date(memberListDate)
    d.setDate(d.getDate() + days)
    setMemberListDate(d.toISOString().split('T')[0])
  }
  const goToday = () => setMemberListDate(new Date().toISOString().split('T')[0])

  const formatDateShort = (dateStr) => {
    const [, m, d] = dateStr.split('-')
    return `${parseInt(m)}/${parseInt(d)}`
  }

  const loadMemberLogs = async (memberId) => {
    const { data } = await supabase.from('workout_logs').select('*').eq('member_id', memberId).order('log_date')
    if (data) setAllLogs(data)
    return data
  }

  const loadTrainerLogs = async () => {
    const { data } = await supabase.from('trainer_workout_logs').select('*').eq('trainer_id', user.id).order('log_date')
    if (data) setAllLogs(data)
  }

  const loadMemberTodayDiet = async (memberId) => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('diet_logs').select('*').eq('member_id', memberId).eq('log_date', today)
    setMemberTodayDiet(data || [])
  }

  const addMember = async () => {
    if (!newMemberName) return
    setLoading(true)
    const code = generateCode()
    const { data, error } = await supabase.from('members').insert({ trainer_id: user.id, name: newMemberName, code, goal: newMemberGoal, gender: newMemberGender }).select().single()
    if (!error && data) { setGeneratedCode(code); setMembers([data, ...members]); setNewMemberName('') }
    setLoading(false)
  }

  const confirmDeleteMember = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const errors = []

    const { error: wErr } = await supabase.from('workout_logs').delete().eq('member_id', deleteTarget.id)
    if (wErr) { console.error('[TrainerDashboard] delete workout_logs error:', wErr); errors.push('운동 기록 삭제 실패: ' + wErr.message) }

    const { error: dErr } = await supabase.from('diet_logs').delete().eq('member_id', deleteTarget.id)
    if (dErr) { console.error('[TrainerDashboard] delete diet_logs error:', dErr); errors.push('식단 기록 삭제 실패: ' + dErr.message) }

    const { error: mErr } = await supabase.from('members').delete().eq('id', deleteTarget.id)
    if (mErr) { console.error('[TrainerDashboard] delete member error:', mErr); errors.push('회원 삭제 실패: ' + mErr.message) }

    setDeleting(false)

    if (errors.length > 0) {
      alert('⚠️ 일부 삭제 실패:\n\n' + errors.join('\n'))
    } else {
      alert(`✅ ${deleteTarget.name} 회원이 삭제되었습니다.`)
      const keys = ['macro_result', 'macro_goal', 'macro_gender', 'macro_weight', 'macro_muscle', 'macro_activity', 'macro_intensity', 'macro_cycle']
      keys.forEach(k => localStorage.removeItem(`${k}_${deleteTarget.id}`))
    }
    setDeleteTarget(null)
    await loadMembers()
  }

  const shareKakao = (code, name) => {
    alert(`아래 내용을 카카오톡으로 전송해주세요!\n\n안녕하세요 ${name}님!\nPT Manager 접속 코드: ${code}\n접속 주소: ${window.location.href}`)
  }

  const openMember = (member) => {
    setSelectedMember(member)
    setView('memberDetail')
    setMemberView('workout')
    loadMemberLogs(member.id)
    loadMemberExercises(member.id, new Date().toISOString().split('T')[0])
    loadMemberTodayDiet(member.id)
    const macro = (() => { try { const s = localStorage.getItem(`macro_result_${member.id}`); return s ? JSON.parse(s) : null } catch { return null } })()
    setMemberMacro(macro)
  }

  const loadMemberExercises = async (memberId, date) => {
    const { data } = await supabase.from('workout_logs').select('*').eq('member_id', memberId).eq('log_date', date).order('slot').order('id')
    if (data && data.length > 0) {
      const grouped = {}
      data.forEach(row => {
        if (!grouped[row.slot]) grouped[row.slot] = { slot: row.slot, body_part: row.body_part, exercise_name: row.exercise_name, memo: row.memo || '', description: row.description || '', sets: [] }
        grouped[row.slot].sets.push({ id: row.id, weight: row.weight, reps: row.reps, volume: row.volume, media_url: row.media_url || '' })
      })
      setExercises(Object.values(grouped))
    } else {
      setExercises([{ slot: 1, body_part: '', exercise_name: '', memo: '', description: '', sets: [{ id: null, weight: '', reps: '', media_url: '' }] }])
    }
  }

  const trainerAsUser = { id: user.id, name: '트레이너', goal: '벌크업', gender: '남성', type: 'trainer_self' }

  // 회원 목표수치 카드 (트레이너가 회원 들어갔을 때 표시)
  // 🆕 macro 없을 때도 안내 카드 표시 (모바일에서 안 보이는 문제 해결)
  const MemberMacroCard = ({ macro, todayDiet }) => {
    if (!macro) {
      return (
        <div style={{ background: THEME.cardAlt, borderRadius: '12px', padding: '12px 14px', marginBottom: '12px', textAlign: 'center', border: `1px dashed ${THEME.border}` }}>
          <p style={{ fontSize: '13px', color: THEME.textSub, margin: 0 }}>🎯 회원이 아직 목표를 설정하지 않았습니다</p>
        </div>
      )
    }
    const todayCalories = todayDiet.reduce((s, l) => s + (l.calories || 0), 0)
    const todayCarbs = todayDiet.reduce((s, l) => s + (l.carbs || 0), 0)
    const todayProtein = todayDiet.reduce((s, l) => s + (l.protein || 0), 0)
    const todayFat = todayDiet.reduce((s, l) => s + (l.fat || 0), 0)
    const fields = [
      { label: '칼로리', field: 'target', unit: 'kcal', current: todayCalories, color: '#FCD34D' },
      { label: '탄수화물', field: 'carbs', unit: 'g', current: todayCarbs, color: '#93C5FD' },
      { label: '단백질', field: 'protein', unit: 'g', current: todayProtein, color: '#FCA5A5' },
      { label: '지방', field: 'fat', unit: 'g', current: todayFat, color: '#FDBA74' },
    ]
    return (
      <div style={{ background: THEME.primary, borderRadius: '14px', padding: '12px 14px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#FFF' }}>🎯 목표 수치</span>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>오늘 달성률</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px' }}>
          {fields.map(({ label, field, unit, current, color }) => {
            const target = macro[field]
            const pct = target > 0 ? Math.min(Math.round(current / target * 100), 100) : 0
            const over = target > 0 && current > target
            return (
              <div key={field} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.7)', margin: '0 0 4px' }}>{label}</p>
                <p style={{ fontSize: '14px', fontWeight: '700', color, margin: '0 0 2px' }}>{target}</p>
                <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', margin: '0 0 5px' }}>{unit}</p>
                <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '4px', height: '4px', marginBottom: '3px' }}>
                  <div style={{ width: `${pct}%`, background: over ? '#FF6B6B' : color, height: '4px', borderRadius: '4px' }} />
                </div>
                <p style={{ fontSize: '9px', color: over ? '#FF6B6B' : color, margin: 0, fontWeight: '600' }}>
                  {Math.round(current)}{unit} ({pct}%)
                </p>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const TrainerMacroCard = () => {
    if (!trainerMacro) return (
      <div style={{ background: THEME.cardAlt, borderRadius: '12px', padding: '10px 14px', marginBottom: '12px', textAlign: 'center', border: `1px dashed ${THEME.border}` }}>
        <p style={{ fontSize: '13px', color: THEME.textSub, margin: 0 }}>🧮 칼로리 설정을 눌러 목표를 설정해주세요</p>
      </div>
    )
    const todayCalories = trainerTodayDiet.reduce((s, l) => s + (l.calories || 0), 0)
    const todayCarbs = trainerTodayDiet.reduce((s, l) => s + (l.carbs || 0), 0)
    const todayProtein = trainerTodayDiet.reduce((s, l) => s + (l.protein || 0), 0)
    const todayFat = trainerTodayDiet.reduce((s, l) => s + (l.fat || 0), 0)
    const fields = [
      { label: '칼로리', field: 'target', unit: 'kcal', current: todayCalories, color: '#FCD34D' },
      { label: '탄수화물', field: 'carbs', unit: 'g', current: todayCarbs, color: '#93C5FD' },
      { label: '단백질', field: 'protein', unit: 'g', current: todayProtein, color: '#FCA5A5' },
      { label: '지방', field: 'fat', unit: 'g', current: todayFat, color: '#FDBA74' },
    ]
    return (
      <div style={{ background: THEME.primary, borderRadius: '14px', padding: '12px 14px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#FFF' }}>🎯 목표 수치</span>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>탭해서 수정</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px' }}>
          {fields.map(({ label, field, unit, current, color }) => {
            const target = trainerMacro[field]
            const pct = target > 0 ? Math.min(Math.round(current / target * 100), 100) : 0
            const over = target > 0 && current > target
            return (
              <div key={field} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.7)', margin: '0 0 4px' }}>{label}</p>
                <input
                  type="number"
                  value={trainerMacro[field]}
                  onChange={e => updateTrainerMacroField(field, e.target.value)}
                  style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: `1px solid ${color}`, color, fontSize: '14px', fontWeight: '700', textAlign: 'center', padding: '2px 0', boxSizing: 'border-box', outline: 'none' }}
                />
                <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', margin: '2px 0 5px' }}>{unit}</p>
                <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '4px', height: '4px', marginBottom: '3px' }}>
                  <div style={{ width: `${pct}%`, background: over ? '#FF6B6B' : color, height: '4px', borderRadius: '4px' }} />
                </div>
                <p style={{ fontSize: '9px', color: over ? '#FF6B6B' : color, margin: 0, fontWeight: '600' }}>
                  {Math.round(current)}{unit} ({pct}%)
                </p>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const MemberCard = ({ member, stat, dateLabel }) => {
    const activeParts = Object.entries(stat.parts).filter(([, v]) => v > 0)
    const calPct = stat.macro?.target > 0 ? Math.min(Math.round(stat.calories / stat.macro.target * 100), 100) : 0
    const carbsPct = stat.macro?.carbs > 0 ? Math.min(Math.round(stat.carbs / stat.macro.carbs * 100), 100) : 0
    const proteinPct = stat.macro?.protein > 0 ? Math.min(Math.round(stat.protein / stat.macro.protein * 100), 100) : 0
    const fatPct = stat.macro?.fat > 0 ? Math.min(Math.round(stat.fat / stat.macro.fat * 100), 100) : 0
    const fatOver = stat.macro?.fat > 0 && stat.fat > stat.macro.fat

    return (
      <div style={{ background: THEME.cardAlt, borderRadius: '10px', border: `0.5px solid ${THEME.border}`, padding: '10px', cursor: 'pointer', position: 'relative' }} onClick={() => openMember(member)}>
        <button
          onClick={e => { e.stopPropagation(); setDeleteTarget(member) }}
          style={{ position: 'absolute', top: '6px', right: '6px', background: '#FCEBEB', border: '0.5px solid #F09595', color: '#A32D2D', width: '22px', height: '22px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="회원 삭제"
        >🗑</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '7px', paddingRight: '26px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: THEME.primary, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '500', flexShrink: 0 }}>{member.name.charAt(0)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '12px', fontWeight: '500', color: THEME.text, margin: 0, lineHeight: 1.2 }}>{member.name}</p>
            <p style={{ fontSize: '9px', color: THEME.textSub, margin: '1px 0 0' }}>{member.goal} · {member.gender}</p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderTop: `0.5px solid ${THEME.border}`, borderBottom: `0.5px solid ${THEME.border}` }}>
          <span style={{ fontSize: '10px', fontWeight: '500', color: THEME.text, letterSpacing: '1px' }}>{member.code}</span>
          <button
            style={{ background: '#FEE500', color: '#1A1A2E', border: 'none', padding: '2px 7px', borderRadius: '4px', cursor: 'pointer', fontSize: '9px', fontWeight: '500' }}
            onClick={e => { e.stopPropagation(); shareKakao(member.code, member.name) }}
          >전송</button>
        </div>

        <div style={{ padding: '6px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
            <span style={{ fontSize: '9px', color: THEME.textSub, fontWeight: '500' }}>🥗 {dateLabel} 식단</span>
            {stat.macro && <span style={{ fontSize: '9px', color: THEME.primary, fontWeight: '500' }}>{calPct}%</span>}
          </div>
          {stat.macro ? (
            <>
              <div style={{ background: '#E5E1DA', height: '3px', borderRadius: '2px' }}>
                <div style={{ width: `${calPct}%`, height: '3px', borderRadius: '2px', background: THEME.primary }} />
              </div>
              <div style={{ fontSize: '9px', color: THEME.text, marginTop: '3px' }}>
                <strong>{Math.round(stat.calories)}</strong>
                <span style={{ color: THEME.textSub }}> / {stat.macro.target} kcal</span>
              </div>
              <div style={{ fontSize: '9px', color: THEME.textSub, marginTop: '4px', lineHeight: '1.55' }}>
                <span style={{ color: '#4472C4' }}>탄</span> {carbsPct}% &nbsp;
                <span style={{ color: '#E84747' }}>단</span> {proteinPct}% &nbsp;
                <span style={{ color: '#E8A020' }}>지</span> <span style={{ color: fatOver ? '#FF6B6B' : '#E8A020' }}>{fatPct}%</span>
              </div>
            </>
          ) : (
            <p style={{ fontSize: '10px', color: THEME.textSub, margin: 0 }}>{stat.calories > 0 ? `${Math.round(stat.calories)}kcal` : '기록 없음'}</p>
          )}
        </div>

        <div style={{ borderTop: `0.5px dashed ${THEME.border}`, margin: '4px 0' }} />

        <div style={{ padding: '6px 0 0' }}>
          <p style={{ fontSize: '9px', color: THEME.textSub, fontWeight: '500', margin: '0 0 4px' }}>💪 {dateLabel} 운동</p>
          {activeParts.length === 0 ? (
            <p style={{ fontSize: '10px', color: THEME.textSub, margin: 0 }}>기록 없음</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
              {activeParts.map(([part, vol]) => (
                <span key={part} style={{ fontSize: '9px', color: '#FFF', background: PART_COLORS[part], padding: '2px 6px', borderRadius: '4px' }}>
                  {part} {vol >= 1000 ? (vol / 1000).toFixed(1) + 't' : vol + 'kg'}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={S.container}>
      <div style={S.wrap}>
        <div style={S.header}>
          <div style={{ width: '40px', height: '40px', background: THEME.primary, borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', flexShrink: 0 }}>
            <span style={{ color: '#FFF', fontSize: '15px', fontWeight: '700', lineHeight: 1, letterSpacing: '-0.5px' }}>PT</span>
            <div style={{ width: '18px', height: '1px', background: '#FFF', margin: '2px 0 1px', borderRadius: '1px' }} />
            <span style={{ color: '#FFF', fontSize: '4.5px', letterSpacing: '0.6px', opacity: 0.9 }}>MANAGER</span>
          </div>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <button
              onClick={() => setShowHelp(true)}
              style={{ background: '#FFF', border: `1px solid ${THEME.primary}`, color: THEME.primary, width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px', fontWeight: '700', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              title="도움말"
            >?</button>
            {view === 'members' && topTab === 'myRecord' && (
              <button onClick={() => setShowCalcModal(true)} style={{ background: THEME.primaryLight, border: `1px solid ${THEME.primary}`, color: THEME.primary, padding: '0 10px', borderRadius: '15px', cursor: 'pointer', fontSize: '11px', fontWeight: '500', height: '30px', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                🧮 식단 설정
              </button>
            )}
            {view !== 'members' && (
              <button style={{ background: '#FFF', border: `1px solid ${THEME.primary}`, color: THEME.primary, padding: '0 10px', borderRadius: '15px', cursor: 'pointer', fontSize: '11px', height: '30px', display: 'flex', alignItems: 'center', flexShrink: 0 }} onClick={() => { setView('members'); setSelectedMember(null) }}>← 목록</button>
            )}
            <button style={{ background: '#FFF', border: `1px solid ${THEME.primary}`, color: THEME.primary, padding: '0 10px', borderRadius: '15px', cursor: 'pointer', fontSize: '11px', height: '30px', display: 'flex', alignItems: 'center', flexShrink: 0 }} onClick={onLogout}>로그아웃</button>
          </div>
        </div>

        {/* 🆕 도움말 모달 */}
        {showHelp && <HelpModal type="trainer" onClose={() => setShowHelp(false)} />}

        {showCalcModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div style={{ background: '#FFF', borderRadius: '20px 20px 0 0', padding: '20px', width: '100%', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <p style={{ fontSize: '16px', fontWeight: '700', color: THEME.text, margin: 0 }}>🧮 칼로리 계산기</p>
                <button onClick={() => setShowCalcModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: THEME.textSub }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <select style={{ ...S.input, padding: '10px' }} value={goal} onChange={e => setGoal(e.target.value)}>
                  <option value="다이어트">🥗 다이어트</option>
                  <option value="벌크업">💪 벌크업</option>
                </select>
                <select style={{ ...S.input, padding: '10px' }} value={gender} onChange={e => setGender(e.target.value)}>
                  <option value="여성">👩 여성</option>
                  <option value="남성">👨 남성</option>
                </select>
                <input style={{ ...S.input, padding: '10px' }} type="number" placeholder="체중 (kg)" value={weight} onChange={e => setWeight(e.target.value)} />
                <input style={{ ...S.input, padding: '10px' }} type="number" placeholder="골격근량 (kg)" value={muscle} onChange={e => setMuscle(e.target.value)} />
              </div>
              <select style={{ ...S.input, padding: '10px', marginBottom: '8px' }} value={activity} onChange={e => setActivity(e.target.value)}>
                <option value="가벼운 운동 (주 2~3회)">🚶 가벼운 운동 (주 2~3회)</option>
                <option value="보통 운동 (주 4~5회)">🏃 보통 운동 (주 4~5회)</option>
                <option value="고강도 운동 (주 6회+)">🔥 고강도 운동 (주 6회+)</option>
              </select>
              <select style={{ ...S.input, padding: '10px', marginBottom: '8px' }} value={intensity} onChange={e => setIntensity(e.target.value)}>
                <option value="완만">🐢 완만 {goal === '벌크업' ? '(+300kcal)' : '(-300kcal)'}</option>
                <option value="일반">⚡ 일반 {goal === '벌크업' ? '(+400kcal)' : '(-500kcal)'}</option>
                <option value="공격적">🚀 공격적 {goal === '벌크업' ? '(+500kcal)' : '(-700kcal)'}</option>
              </select>
              {gender === '여성' && (
                <select style={{ ...S.input, padding: '10px', marginBottom: '12px' }} value={cyclePhase} onChange={e => setCyclePhase(e.target.value)}>
                  <option value="">🌸 생리 주기 (선택사항)</option>
                  {Object.entries(CYCLE_PHASES).map(([phase, adj]) => (
                    <option key={phase} value={phase}>{phase} ({adj > 0 ? '+' : ''}{adj}kcal)</option>
                  ))}
                </select>
              )}
              <button style={S.btnPrimary} onClick={calculateTrainerMacro}>🧮 계산 및 저장</button>
            </div>
          </div>
        )}

        {deleteTarget && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: '#FFF', borderRadius: '14px', padding: '20px', width: '100%', maxWidth: '320px' }}>
              <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#FCEBEB', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', marginBottom: '10px' }}>⚠️</div>
                <p style={{ fontSize: '15px', fontWeight: '600', color: THEME.text, margin: '0 0 6px' }}>{deleteTarget.name} 회원을 삭제할까요?</p>
                <p style={{ fontSize: '12px', color: THEME.textSub, margin: 0, lineHeight: 1.5 }}>이 회원의 모든 운동/식단 기록이<br/>함께 삭제됩니다. (복구 불가)</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '16px' }}>
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  style={{ background: '#FFF', border: `0.5px solid ${THEME.border}`, padding: '12px', borderRadius: '8px', fontSize: '13px', color: THEME.textSub, cursor: 'pointer' }}
                >취소</button>
                <button
                  onClick={confirmDeleteMember}
                  disabled={deleting}
                  style={{ background: '#E24B4A', color: '#FFF', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                >{deleting ? '삭제 중...' : '삭제'}</button>
              </div>
            </div>
          </div>
        )}

        {view === 'members' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '12px' }}>
            <button onClick={() => setTopTab('members')} style={{ background: topTab === 'members' ? THEME.primary : '#FFF', color: topTab === 'members' ? '#FFF' : THEME.textSub, border: topTab === 'members' ? 'none' : `0.5px solid ${THEME.border}`, borderRadius: '10px', padding: '11px', fontSize: '13px', fontWeight: topTab === 'members' ? '500' : '400', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <IconMembers color={topTab === 'members' ? '#FFF' : THEME.textSub} />회원 관리
            </button>
            <button onClick={() => { setTopTab('myRecord'); loadTrainerLogs(); loadTrainerTodayDiet() }} style={{ background: topTab === 'myRecord' ? THEME.primary : '#FFF', color: topTab === 'myRecord' ? '#FFF' : THEME.textSub, border: topTab === 'myRecord' ? 'none' : `0.5px solid ${THEME.border}`, borderRadius: '10px', padding: '11px', fontSize: '13px', fontWeight: topTab === 'myRecord' ? '500' : '400', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <IconNote color={topTab === 'myRecord' ? '#FFF' : THEME.textSub} />내 기록
            </button>
          </div>
        )}

        {view === 'members' && topTab === 'members' && (
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <p style={{ ...S.cardTitle, margin: 0 }}>회원 관리</p>
              <button style={S.addBtn} onClick={() => { setShowAddMember(!showAddMember); setGeneratedCode('') }}>+ 회원 추가</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', background: THEME.cardAlt, borderRadius: '8px', padding: '6px 10px', marginBottom: '14px', border: `0.5px solid ${THEME.border}` }}>
              <button
                onClick={() => moveDate(-1)}
                style={{ background: 'none', border: 'none', fontSize: '14px', color: THEME.primary, cursor: 'pointer', padding: '0 6px', fontWeight: '600' }}
              >◀</button>
              <input
                type="date"
                value={memberListDate}
                onChange={e => setMemberListDate(e.target.value)}
                style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '13px', fontWeight: '500', color: THEME.text, textAlign: 'center', outline: 'none', fontFamily: 'inherit' }}
              />
              <button
                onClick={() => moveDate(1)}
                style={{ background: 'none', border: 'none', fontSize: '14px', color: THEME.primary, cursor: 'pointer', padding: '0 6px', fontWeight: '600' }}
              >▶</button>
              <button
                onClick={goToday}
                style={{ background: THEME.primaryLight, border: `0.5px solid ${THEME.primary}`, color: THEME.primary, padding: '4px 10px', borderRadius: '5px', fontSize: '11px', fontWeight: '500', cursor: 'pointer' }}
              >오늘</button>
            </div>

            {showAddMember && (
              <div style={{ background: THEME.cardAlt, borderRadius: '12px', padding: '14px', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input style={S.input} type="text" placeholder="회원 이름" value={newMemberName} onChange={e => setNewMemberName(e.target.value)} />
                <select style={S.input} value={newMemberGoal} onChange={e => setNewMemberGoal(e.target.value)}>
                  <option value="다이어트">다이어트</option>
                  <option value="벌크업">벌크업</option>
                  <option value="체형교정">체형교정</option>
                  <option value="재활">재활</option>
                </select>
                <select style={S.input} value={newMemberGender} onChange={e => setNewMemberGender(e.target.value)}>
                  <option value="여성">여성</option>
                  <option value="남성">남성</option>
                </select>
                <button style={S.btnPrimary} onClick={addMember} disabled={loading}>{loading ? '추가 중...' : '코드 발급하기'}</button>
                {generatedCode && (
                  <div style={{ background: THEME.primary, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', margin: '0 0 4px' }}>발급된 코드</p>
                    <p style={{ color: '#FFF', fontSize: '32px', fontWeight: '700', letterSpacing: '6px', margin: '0 0 12px' }}>{generatedCode}</p>
                    <button style={{ background: '#FEE500', color: '#1A1A2E', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '700', width: '100%' }} onClick={() => shareKakao(generatedCode, newMemberName)}>카카오톡으로 전송</button>
                  </div>
                )}
              </div>
            )}

            {members.length === 0 ? (
              <p style={{ color: THEME.textSub, textAlign: 'center', padding: '20px 0', fontSize: '14px' }}>등록된 회원이 없습니다.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {members.map(member => {
                  const stat = memberStats[member.id] || { parts: {}, calories: 0, carbs: 0, protein: 0, fat: 0, macro: null }
                  return <MemberCard key={member.id} member={member} stat={stat} dateLabel={formatDateShort(memberListDate)} />
                })}
              </div>
            )}
          </div>
        )}

        {view === 'members' && topTab === 'myRecord' && (
          <>
            <TrainerMacroCard />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '12px' }}>
              {[
                { key: 'workout', label: '운동 기록', Icon: IconWorkout },
                { key: 'stats', label: '운동 통계', Icon: IconStats },
                { key: 'diet', label: '식단', Icon: IconDiet },
              ].map(({ key, label, Icon }) => (
                <button key={key} onClick={() => setTrainerView(key)} style={{ background: trainerView === key ? THEME.primary : '#FFF', border: trainerView === key ? 'none' : `0.5px solid ${THEME.border}`, borderRadius: '10px', padding: '10px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                  <Icon color={trainerView === key ? '#FFF' : THEME.textSub} />
                  <span style={{ fontSize: '11px', color: trainerView === key ? '#FFF' : THEME.textSub, fontWeight: trainerView === key ? '500' : '400' }}>{label}</span>
                </button>
              ))}
            </div>
            {trainerView === 'workout' && <WorkoutLog user={trainerAsUser} selectedDate={selectedDate} setSelectedDate={setSelectedDate} exercises={exercises} setExercises={setExercises} onUpdate={loadTrainerLogs} tableOverride="trainer_workout_logs" trainerIdField="trainer_id" />}
            {trainerView === 'stats' && <WorkoutStats allLogs={allLogs} />}
            {trainerView === 'diet' && <DietLog user={trainerAsUser} onDietUpdate={loadTrainerTodayDiet} tableOverride="trainer_diet_logs" trainerIdField="trainer_id" />}
          </>
        )}

        {view === 'memberDetail' && selectedMember && (
          <>
            <div style={{ background: THEME.primaryLight, border: `1px solid ${THEME.primary}`, borderRadius: '12px', padding: '12px 16px', marginBottom: '12px' }}>
              <p style={{ fontSize: '16px', fontWeight: '700', color: THEME.primary, margin: '0 0 2px' }}>{selectedMember.name}</p>
              <p style={{ fontSize: '13px', color: THEME.textSub, margin: 0 }}>{selectedMember.goal} · {selectedMember.gender} · {selectedMember.code}</p>
            </div>

            <MemberMacroCard macro={memberMacro} todayDiet={memberTodayDiet} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '12px' }}>
              {[
                { key: 'workout', label: '운동 기록', Icon: IconWorkout },
                { key: 'stats', label: '운동 통계', Icon: IconStats },
                { key: 'diet', label: '식단', Icon: IconDiet },
              ].map(({ key, label, Icon }) => (
                <button key={key} onClick={() => setMemberView(key)} style={{ background: memberView === key ? THEME.primary : '#FFF', border: memberView === key ? 'none' : `0.5px solid ${THEME.border}`, borderRadius: '10px', padding: '10px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                  <Icon color={memberView === key ? '#FFF' : THEME.textSub} />
                  <span style={{ fontSize: '11px', color: memberView === key ? '#FFF' : THEME.textSub, fontWeight: memberView === key ? '500' : '400' }}>{label}</span>
                </button>
              ))}
            </div>

            {memberView === 'workout' && <WorkoutLog user={selectedMember} selectedDate={selectedDate} setSelectedDate={setSelectedDate} exercises={exercises} setExercises={setExercises} onUpdate={async () => { await loadMemberLogs(selectedMember.id) }} />}
            {memberView === 'stats' && <WorkoutStats allLogs={allLogs} />}
            {memberView === 'diet' && <DietLog user={selectedMember} onDietUpdate={() => loadMemberTodayDiet(selectedMember.id)} />}
          </>
        )}
      </div>
    </div>
  )
}
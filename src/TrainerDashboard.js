import React, { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { S, THEME, PART_COLORS, generateCode, calcMacro, CYCLE_PHASES, loadFavorites } from './utils'
import WorkoutLog from './WorkoutLog'
import WorkoutStats from './WorkoutStats'
import DietLog from './DietLog'
import HelpModal from './HelpModal'
import MemberNotes from './MemberNotes'
import DatePicker from './DatePicker'
import InbodyModal from './InbodyModal'

const NOTE_COLOR_POOL = [
  { name: '코랄', bg: '#FCE4E0', text: '#8E3D2E' },
  { name: '앰버', bg: '#FFF7E6', text: '#8B6F2A' },
  { name: '그린', bg: '#E8F2EE', text: '#2F5C45' },
  { name: '블루', bg: '#E6F2F4', text: '#2F6B7A' },
  { name: '퍼플', bg: '#F0E8F2', text: '#5C3D6E' },
  { name: '핑크', bg: '#FBE8EE', text: '#8E3D5C' },
  { name: '브라운', bg: '#FBEDDB', text: '#8B5E2E' },
  { name: '틸', bg: '#E0F2EE', text: '#2A6B5E' },
]

export default function TrainerDashboard({ user, onLogout }) {
  const [view, setView] = useState('members')
  const [members, setMembers] = useState([])
  const [memberStats, setMemberStats] = useState({})
  const [showAddMember, setShowAddMember] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberGoal, setNewMemberGoal] = useState('다이어트')
  const [newMemberGender, setNewMemberGender] = useState('여성')
  const [newMemberStartDate, setNewMemberStartDate] = useState(new Date().toISOString().split('T')[0])
  const [generatedCode, setGeneratedCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const [exercises, setExercises] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [allLogs, setAllLogs] = useState([])
  const [memberFavorites, setMemberFavorites] = useState([])
  const [trainerFavorites, setTrainerFavorites] = useState([])
  const [topTab, setTopTab] = useState('members')
  const [memberMacro, setMemberMacro] = useState(null)
  const [memberTodayDiet, setMemberTodayDiet] = useState([])

  const [memberMainTab, setMemberMainTab] = useState('workout')
  const [memberSubTab, setMemberSubTab] = useState('log')
  const [trainerMainTab, setTrainerMainTab] = useState('workout')
  const [trainerSubTab, setTrainerSubTab] = useState('log')

  const [trainerMacro, setTrainerMacro] = useState(null)
  const [trainerTodayDiet, setTrainerTodayDiet] = useState([])
  const [showCalcModal, setShowCalcModal] = useState(false)

  const [showMemberCalcModal, setShowMemberCalcModal] = useState(false)
  const [memberGoal, setMemberGoal] = useState('다이어트')
  const [memberGender, setMemberGender] = useState('여성')
  const [memberWeight, setMemberWeight] = useState('')
  const [memberMuscle, setMemberMuscle] = useState('')
  const [memberActivity, setMemberActivity] = useState('보통 운동 (주 4~5회)')
  const [memberIntensity, setMemberIntensity] = useState('일반')
  const [memberCyclePhase, setMemberCyclePhase] = useState('')

  const [memberListDate, setMemberListDate] = useState(new Date().toISOString().split('T')[0])

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [showHelp, setShowHelp] = useState(false)
  const [editStartDateMember, setEditStartDateMember] = useState(null)

  const [showNotesMember, setShowNotesMember] = useState(null)
  const [importantNotes, setImportantNotes] = useState([])
  const [memberCategories, setMemberCategories] = useState([])

  // 인바디 모달 상태 (트레이너가 회원 인바디 입력/추이 보기)
  const [inbodyOpen, setInbodyOpen] = useState(false)
  const [inbodyChartOpen, setInbodyChartOpen] = useState(false)

  const [goal, setGoal] = useState(() => localStorage.getItem(`tmacro_goal_${user.id}`) || '벌크업')
  const [gender, setGender] = useState(() => localStorage.getItem(`tmacro_gender_${user.id}`) || '남성')
  const [weight, setWeight] = useState(() => localStorage.getItem(`tmacro_weight_${user.id}`) || '')
  const [muscle, setMuscle] = useState(() => localStorage.getItem(`tmacro_muscle_${user.id}`) || '')
  const [activity, setActivity] = useState(() => localStorage.getItem(`tmacro_activity_${user.id}`) || '보통 운동 (주 4~5회)')
  const [intensity, setIntensity] = useState(() => localStorage.getItem(`tmacro_intensity_${user.id}`) || '일반')
  const [cyclePhase, setCyclePhase] = useState(() => localStorage.getItem(`tmacro_cycle_${user.id}`) || '')

  useEffect(() => { loadMembers(); loadTrainerMacro(); loadTrainerTodayDiet(); loadTrainerFavorites() }, [])

  useEffect(() => {
    if (members.length > 0) loadStatsByDate(members, memberListDate)
  }, [memberListDate])

  const loadTrainerFavorites = async () => {
    const data = await loadFavorites(user.id, 'trainer_favorite_exercises', 'trainer_id')
    setTrainerFavorites(data)
  }

  const loadMemberFavorites = async (memberId) => {
    const data = await loadFavorites(memberId, 'member_favorite_exercises', 'member_id')
    setMemberFavorites(data)
  }

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

  const loadMemberNotes = async (memberId) => {
    const [{ data: cats }, { data: nts }] = await Promise.all([
      supabase.from('member_note_categories').select('*').eq('member_id', memberId).order('created_at'),
      supabase.from('member_notes').select('*').eq('member_id', memberId).eq('is_important', true).order('created_at', { ascending: false })
    ])
    setMemberCategories(cats || [])
    setImportantNotes(nts || [])
  }

  const loadMemberMacroFromDB = async (memberId) => {
    const { data, error } = await supabase
      .from('members')
      .select('goal, gender, target_calories, target_carbs, target_protein, target_fat, macro_weight, macro_muscle, macro_activity, macro_intensity, macro_cycle')
      .eq('id', memberId)
      .single()

    if (error) {
      console.error('[TrainerDashboard] loadMemberMacroFromDB error:', error)
      return null
    }

    const hasResult = data.target_calories || data.target_carbs || data.target_protein || data.target_fat
    const macro = hasResult ? {
      target: data.target_calories || 0,
      carbs: data.target_carbs || 0,
      protein: data.target_protein || 0,
      fat: data.target_fat || 0
    } : null

    return {
      macro,
      goal: data.goal || '다이어트',
      gender: data.gender || '여성',
      weight: data.macro_weight ? String(data.macro_weight) : '',
      muscle: data.macro_muscle ? String(data.macro_muscle) : '',
      activity: data.macro_activity || '보통 운동 (주 4~5회)',
      intensity: data.macro_intensity || '일반',
      cyclePhase: data.macro_cycle || '',
    }
  }

  const saveMemberMacroToDB = async (memberId, macro) => {
    const { error } = await supabase
      .from('members')
      .update({
        target_calories: macro.target || 0,
        target_carbs: macro.carbs || 0,
        target_protein: macro.protein || 0,
        target_fat: macro.fat || 0,
      })
      .eq('id', memberId)
    if (error) { console.error('[TrainerDashboard] saveMemberMacroToDB error:', error); alert('목표 저장 실패: ' + error.message); return false }
    return true
  }

  const saveMemberMacroFullToDB = async (memberId, macro, inputs) => {
    const { error } = await supabase
      .from('members')
      .update({
        target_calories: macro.target || 0,
        target_carbs: macro.carbs || 0,
        target_protein: macro.protein || 0,
        target_fat: macro.fat || 0,
        goal: inputs.goal,
        gender: inputs.gender,
        macro_weight: parseFloat(inputs.weight) || null,
        macro_muscle: parseFloat(inputs.muscle) || null,
        macro_activity: inputs.activity,
        macro_intensity: inputs.intensity,
        macro_cycle: inputs.cyclePhase || null,
      })
      .eq('id', memberId)
    if (error) { console.error('[TrainerDashboard] saveMemberMacroFullToDB error:', error); alert('식단 설정 저장 실패: ' + error.message); return false }
    return true
  }

  const calculateMemberMacro = async () => {
    if (!selectedMember) return
    if (!memberWeight || !memberMuscle) { alert('체중과 골격근량을 입력해주세요.'); return }
    const result = calcMacro({
      goal: memberGoal,
      gender: memberGender,
      weight: parseFloat(memberWeight),
      muscle: parseFloat(memberMuscle),
      activity: memberActivity,
      intensity: memberIntensity,
      cyclePhase: memberCyclePhase
    })
    const ok = await saveMemberMacroFullToDB(selectedMember.id, result, {
      goal: memberGoal,
      gender: memberGender,
      weight: memberWeight,
      muscle: memberMuscle,
      activity: memberActivity,
      intensity: memberIntensity,
      cyclePhase: memberCyclePhase,
    })
    if (!ok) return
    setMemberMacro(result)
    setShowMemberCalcModal(false)
    await loadMembers()
  }

  const updateMemberMacroField = async (field, value) => {
    if (!selectedMember || !memberMacro) return
    const updated = { ...memberMacro, [field]: parseInt(value) || 0 }
    setMemberMacro(updated)
    await saveMemberMacroToDB(selectedMember.id, updated)
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
      const hasTarget = m.target_calories || m.target_carbs || m.target_protein || m.target_fat
      const macro = hasTarget ? {
        target: m.target_calories || 0,
        carbs: m.target_carbs || 0,
        protein: m.target_protein || 0,
        fat: m.target_fat || 0
      } : null
      stats[m.id] = { parts, calories, carbs, protein, fat, macro }
    }
    setMemberStats(stats)
  }

  const formatDateShort = (dateStr) => {
    const [, m, d] = dateStr.split('-')
    return `${parseInt(m)}/${parseInt(d)}`
  }

  const calcDaysSince = (startDate) => {
    if (!startDate) return null
    const start = new Date(startDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    start.setHours(0, 0, 0, 0)
    const diff = Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1
    return diff
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
    const { data, error } = await supabase.from('members').insert({
      trainer_id: user.id,
      name: newMemberName,
      code,
      goal: newMemberGoal,
      gender: newMemberGender,
      start_date: newMemberStartDate
    }).select().single()
    if (!error && data) {
      setGeneratedCode(code)
      setMembers([data, ...members])
      setNewMemberName('')
      setNewMemberStartDate(new Date().toISOString().split('T')[0])
    } else if (error) {
      alert('회원 추가 실패: ' + error.message)
    }
    setLoading(false)
  }

  const updateStartDate = async (memberId, newDate) => {
    const { error } = await supabase.from('members').update({ start_date: newDate }).eq('id', memberId)
    if (error) { alert('시작일 저장 실패: ' + error.message); return }
    await loadMembers()
    setEditStartDateMember(null)
  }

  const confirmDeleteMember = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const errors = []

    const { error: wErr } = await supabase.from('workout_logs').delete().eq('member_id', deleteTarget.id)
    if (wErr) errors.push('운동 기록 삭제 실패: ' + wErr.message)

    const { error: dErr } = await supabase.from('diet_logs').delete().eq('member_id', deleteTarget.id)
    if (dErr) errors.push('식단 기록 삭제 실패: ' + dErr.message)

    const { error: mErr } = await supabase.from('members').delete().eq('id', deleteTarget.id)
    if (mErr) errors.push('회원 삭제 실패: ' + mErr.message)

    setDeleting(false)

    if (errors.length > 0) {
      alert('일부 삭제 실패:\n\n' + errors.join('\n'))
    } else {
      alert(`${deleteTarget.name} 회원이 삭제되었습니다.`)
      const keys = ['macro_result', 'macro_goal', 'macro_gender', 'macro_weight', 'macro_muscle', 'macro_activity', 'macro_intensity', 'macro_cycle']
      keys.forEach(k => localStorage.removeItem(`${k}_${deleteTarget.id}`))
    }
    setDeleteTarget(null)
    await loadMembers()
  }

  const shareKakao = (code, name) => {
    alert(`아래 내용을 카카오톡으로 전송해주세요!\n\n안녕하세요 ${name}님!\nPT Manager 접속 코드: ${code}\n접속 주소: ${window.location.href}`)
  }

  const openMember = async (member) => {
    setSelectedMember(member)
    setView('memberDetail')
    setMemberMainTab('workout')
    setMemberSubTab('log')
    loadMemberLogs(member.id)
    loadMemberExercises(member.id, new Date().toISOString().split('T')[0])
    loadMemberTodayDiet(member.id)
    loadMemberNotes(member.id)
    loadMemberFavorites(member.id)

    const memData = await loadMemberMacroFromDB(member.id)
    if (memData) {
      setMemberMacro(memData.macro)
      setMemberGoal(memData.goal)
      setMemberGender(memData.gender)
      setMemberWeight(memData.weight)
      setMemberMuscle(memData.muscle)
      setMemberActivity(memData.activity)
      setMemberIntensity(memData.intensity)
      setMemberCyclePhase(memData.cyclePhase)
    }
  }

  const loadMemberExercises = async (memberId, date) => {
    const { data } = await supabase.from('workout_logs').select('*').eq('member_id', memberId).eq('log_date', date).order('slot').order('id')
    if (data && data.length > 0) {
      const grouped = {}
      data.forEach(row => {
        const slotKey = `${row.exercise_type || 'weight'}_${row.slot}`
        if (!grouped[slotKey]) {
          grouped[slotKey] = {
            slot: row.slot,
            exercise_type: row.exercise_type || 'weight',
            body_part: row.body_part,
            exercise_name: row.exercise_name,
            cardio_name: row.cardio_name || '',
            calories_burned: row.calories_burned || 0,
            memo: row.memo || '',
            description: row.description || '',
            sets: []
          }
        }
        grouped[slotKey].sets.push({ id: row.id, weight: row.weight, reps: row.reps, volume: row.volume, media_url: row.media_url || '' })
      })
      setExercises(Object.values(grouped))
    } else {
      setExercises([{ slot: 1, exercise_type: 'weight', body_part: '', exercise_name: '', memo: '', description: '', sets: [{ id: null, weight: '', reps: '', media_url: '' }] }])
    }
  }

  const trainerAsUser = { id: user.id, name: '트레이너', goal: '벌크업', gender: '남성', type: 'trainer_self' }

  const PTLogo = () => (
    <div style={{
      width: '32px', height: '32px', background: THEME.primaryAccent, borderRadius: '10px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', flexShrink: 0
    }}>
      <span style={{ color: THEME.primaryDark, fontSize: '11px', fontWeight: '500', lineHeight: 1, letterSpacing: '-0.3px' }}>PT</span>
      <div style={{ width: '14px', height: '0.5px', background: THEME.primaryDark, margin: '1px 0' }} />
      <span style={{ color: THEME.primaryDark, fontSize: '4px', letterSpacing: '0.5px' }}>MANAGER</span>
    </div>
  )

  const MainTabBtn = ({ active, onClick, label }) => (
    <button onClick={onClick} style={{
      background: active ? THEME.primaryAccent : '#FFF',
      color: active ? THEME.primaryDark : THEME.textSub,
      border: 'none',
      borderRadius: '14px',
      padding: '12px',
      fontSize: '13px',
      fontWeight: active ? '500' : '400',
      cursor: 'pointer',
    }}>{label}</button>
  )

  const SubTabs = ({ value, onChange }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '12px', background: THEME.borderLight, padding: '4px', borderRadius: '12px' }}>
      {[
        { key: 'log', label: '기록' },
        { key: 'stats', label: '통계' },
      ].map(({ key, label }) => {
        const active = value === key
        return (
          <button key={key} onClick={() => onChange(key)} style={{
            background: active ? '#FFF' : 'transparent',
            color: active ? THEME.text : THEME.textSub,
            border: 'none',
            borderRadius: '9px',
            padding: '8px',
            fontSize: '12px',
            fontWeight: active ? '500' : '400',
            cursor: 'pointer',
          }}>{label}</button>
        )
      })}
    </div>
  )

  const MemberMacroCard = ({ macro, todayDiet }) => {
    if (!macro) {
      return (
        <div style={{ background: THEME.cardAlt, borderRadius: '12px', padding: '12px 14px', marginBottom: '12px', textAlign: 'center', border: `0.5px dashed ${THEME.border}` }}>
          <p style={{ fontSize: '12px', color: THEME.textSub, margin: 0 }}>회원 목표가 아직 설정되지 않았습니다</p>
          <p style={{ fontSize: '11px', color: THEME.primary, margin: '6px 0 0', fontWeight: '500' }}>상단 [식단 설정] 버튼으로 설정해주세요</p>
        </div>
      )
    }
    const todayCalories = todayDiet.reduce((s, l) => s + (l.calories || 0), 0)
    const todayCarbs = todayDiet.reduce((s, l) => s + (l.carbs || 0), 0)
    const todayProtein = todayDiet.reduce((s, l) => s + (l.protein || 0), 0)
    const todayFat = todayDiet.reduce((s, l) => s + (l.fat || 0), 0)
    const fields = [
      { label: '칼로리', field: 'target', unit: 'kcal', current: todayCalories, bg: THEME.nutCaloriesBg, mid: THEME.nutCaloriesText, dark: THEME.nutCaloriesDark, accent: THEME.nutCalories },
      { label: '탄수', field: 'carbs', unit: 'g', current: todayCarbs, bg: THEME.nutCarbsBg, mid: THEME.nutCarbsText, dark: THEME.nutCarbsDark, accent: THEME.nutCarbs },
      { label: '단백질', field: 'protein', unit: 'g', current: todayProtein, bg: THEME.nutProteinBg, mid: THEME.nutProteinText, dark: THEME.nutProteinDark, accent: THEME.nutProtein },
      { label: '지방', field: 'fat', unit: 'g', current: todayFat, bg: THEME.nutFatBg, mid: THEME.nutFatText, dark: THEME.nutFatDark, accent: THEME.nutFat },
    ]
    return (
      <div style={{ background: '#FFF', borderRadius: '14px', padding: '14px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
          <span style={{ fontSize: '12px', fontWeight: '500', color: THEME.text }}>회원 목표 / 오늘 달성률</span>
          <span style={{ fontSize: '10px', color: THEME.textHint }}>탭하여 수정</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
          {fields.map(({ label, field, unit, current, bg, mid, dark, accent }) => {
            const target = macro[field]
            const pct = target > 0 ? Math.min(Math.round(current / target * 100), 100) : 0
            const over = target > 0 && current > target
            return (
              <div key={field} style={{ background: bg, borderRadius: '12px', padding: '10px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '105px' }}>
                <div style={{ fontSize: '10px', color: mid, lineHeight: 1, height: '12px' }}>{label}</div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', justifyContent: 'center' }}>
                    <input
                      type="number"
                      value={macro[field]}
                      onChange={e => updateMemberMacroField(field, e.target.value)}
                      style={{ background: 'transparent', border: 'none', color: dark, fontSize: '16px', fontWeight: '500', textAlign: 'right', padding: 0, boxSizing: 'border-box', outline: 'none', width: '52px', letterSpacing: '-0.3px', fontFamily: 'inherit' }}
                    />
                    <span style={{ fontSize: '8px', color: mid, opacity: 0.85 }}>{unit}</span>
                  </div>
                </div>
                <div style={{ height: '3px', background: '#FFF', borderRadius: '2px', width: '100%', marginBottom: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, background: over ? THEME.danger : accent, height: '3px', borderRadius: '2px' }} />
                </div>
                <div style={{ fontSize: '9px', color: over ? THEME.danger : mid, fontWeight: '500', lineHeight: 1, height: '11px' }}>
                  {Math.round(current)}{unit} ({pct}%)
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const TrainerMacroCard = () => {
    if (!trainerMacro) return (
      <div style={{ background: THEME.cardAlt, borderRadius: '12px', padding: '10px 14px', marginBottom: '12px', textAlign: 'center', border: `0.5px dashed ${THEME.border}` }}>
        <p style={{ fontSize: '12px', color: THEME.textSub, margin: 0 }}>식단 설정을 눌러 목표를 설정해주세요</p>
      </div>
    )
    const todayCalories = trainerTodayDiet.reduce((s, l) => s + (l.calories || 0), 0)
    const todayCarbs = trainerTodayDiet.reduce((s, l) => s + (l.carbs || 0), 0)
    const todayProtein = trainerTodayDiet.reduce((s, l) => s + (l.protein || 0), 0)
    const todayFat = trainerTodayDiet.reduce((s, l) => s + (l.fat || 0), 0)
    const fields = [
      { label: '칼로리', field: 'target', unit: 'kcal', current: todayCalories, bg: THEME.nutCaloriesBg, mid: THEME.nutCaloriesText, dark: THEME.nutCaloriesDark, accent: THEME.nutCalories },
      { label: '탄수', field: 'carbs', unit: 'g', current: todayCarbs, bg: THEME.nutCarbsBg, mid: THEME.nutCarbsText, dark: THEME.nutCarbsDark, accent: THEME.nutCarbs },
      { label: '단백질', field: 'protein', unit: 'g', current: todayProtein, bg: THEME.nutProteinBg, mid: THEME.nutProteinText, dark: THEME.nutProteinDark, accent: THEME.nutProtein },
      { label: '지방', field: 'fat', unit: 'g', current: todayFat, bg: THEME.nutFatBg, mid: THEME.nutFatText, dark: THEME.nutFatDark, accent: THEME.nutFat },
    ]
    return (
      <div style={{ background: '#FFF', borderRadius: '14px', padding: '14px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
          <span style={{ fontSize: '12px', fontWeight: '500', color: THEME.text }}>오늘의 목표</span>
          <span style={{ fontSize: '10px', color: THEME.textHint }}>탭하여 수정</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
          {fields.map(({ label, field, unit, current, bg, mid, dark, accent }) => {
            const target = trainerMacro[field]
            const pct = target > 0 ? Math.min(Math.round(current / target * 100), 100) : 0
            const over = target > 0 && current > target
            return (
              <div key={field} style={{ background: bg, borderRadius: '12px', padding: '10px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '105px' }}>
                <div style={{ fontSize: '10px', color: mid, lineHeight: 1, height: '12px' }}>{label}</div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', justifyContent: 'center' }}>
                    <input
                      type="number"
                      value={trainerMacro[field]}
                      onChange={e => updateTrainerMacroField(field, e.target.value)}
                      style={{ background: 'transparent', border: 'none', color: dark, fontSize: '16px', fontWeight: '500', textAlign: 'right', padding: 0, boxSizing: 'border-box', outline: 'none', width: '52px', letterSpacing: '-0.3px', fontFamily: 'inherit' }}
                    />
                    <span style={{ fontSize: '8px', color: mid, opacity: 0.85 }}>{unit}</span>
                  </div>
                </div>
                <div style={{ height: '3px', background: '#FFF', borderRadius: '2px', width: '100%', marginBottom: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, background: over ? THEME.danger : accent, height: '3px', borderRadius: '2px' }} />
                </div>
                <div style={{ fontSize: '9px', color: over ? THEME.danger : mid, fontWeight: '500', lineHeight: 1, height: '11px' }}>
                  {Math.round(current)}{unit} ({pct}%)
                </div>
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

    const days = calcDaysSince(member.start_date)

    return (
      <div style={{ background: THEME.cardAlt, borderRadius: '10px', border: `0.5px solid ${THEME.border}`, padding: '10px', cursor: 'pointer', position: 'relative' }} onClick={() => openMember(member)}>
        <button
          onClick={e => { e.stopPropagation(); setDeleteTarget(member) }}
          style={{ position: 'absolute', top: '6px', right: '6px', background: '#FCEBEB', border: '0.5px solid #F09595', color: '#A32D2D', width: '20px', height: '20px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '500' }}
          title="회원 삭제"
        >×</button>

        <div style={{ paddingRight: '24px', marginBottom: '6px' }}>
          <p style={{ fontSize: '13px', fontWeight: '500', color: THEME.text, margin: '0 0 2px', lineHeight: 1.2 }}>{member.name}</p>
          <p style={{ fontSize: '10px', color: THEME.textSub, margin: 0, whiteSpace: 'nowrap' }}>{member.goal} · {member.gender}</p>
        </div>

        <div
          onClick={e => { e.stopPropagation(); setEditStartDateMember(member) }}
          style={{ background: '#FFF', borderRadius: '6px', padding: '5px 7px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px', border: `0.5px solid ${THEME.border}`, cursor: 'pointer' }}
          title="시작일 수정"
        >
          <span style={{ fontSize: '9px', color: THEME.primary, fontWeight: '500', flex: 1 }}>
            {member.start_date ? `시작 ${member.start_date.replace(/-/g, '.')}` : '시작일 입력'}
          </span>
          {days !== null && days > 0 && (
            <span style={{ fontSize: '9px', color: THEME.textSub, fontWeight: '500' }}>{days}일째</span>
          )}
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
            <span style={{ fontSize: '9px', color: THEME.textSub, fontWeight: '500' }}>{dateLabel} 식단</span>
            {stat.macro && <span style={{ fontSize: '9px', color: THEME.primary, fontWeight: '500' }}>{calPct}%</span>}
          </div>
          {stat.macro ? (
            <>
              <div style={{ background: THEME.borderLight, height: '3px', borderRadius: '2px' }}>
                <div style={{ width: `${calPct}%`, height: '3px', borderRadius: '2px', background: THEME.primary }} />
              </div>
              <div style={{ fontSize: '9px', color: THEME.text, marginTop: '3px' }}>
                <strong>{Math.round(stat.calories)}</strong>
                <span style={{ color: THEME.textSub }}> / {stat.macro.target} kcal</span>
              </div>
              <div style={{ fontSize: '9px', color: THEME.textSub, marginTop: '4px', lineHeight: '1.55' }}>
                <span style={{ color: THEME.nutCarbs }}>탄</span> {carbsPct}% &nbsp;
                <span style={{ color: THEME.nutProtein }}>단</span> {proteinPct}% &nbsp;
                <span style={{ color: THEME.nutFat }}>지</span> <span style={{ color: fatOver ? THEME.danger : THEME.nutFat }}>{fatPct}%</span>
              </div>
            </>
          ) : (
            <p style={{ fontSize: '10px', color: THEME.textSub, margin: 0 }}>{stat.calories > 0 ? `${Math.round(stat.calories)}kcal` : '기록 없음'}</p>
          )}
        </div>

        <div style={{ borderTop: `0.5px dashed ${THEME.border}`, margin: '4px 0' }} />

        <div style={{ padding: '6px 0 0' }}>
          <p style={{ fontSize: '9px', color: THEME.textSub, fontWeight: '500', margin: '0 0 4px' }}>{dateLabel} 운동</p>
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

  // 회원정보 박스 안에서 쓸 작은 액션 버튼 스타일
  const memberActionBtn = {
    background: '#FFF',
    border: `0.5px solid ${THEME.primaryAccent}`,
    color: THEME.primary,
    padding: '5px 11px',
    borderRadius: '14px',
    fontSize: '11px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexShrink: 0,
  }

  return (
    <div style={S.container}>
      <div style={S.wrap}>
        <div style={S.header}>
          <PTLogo />
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <button
              onClick={() => setShowHelp(true)}
              style={{ background: '#FFF', border: `0.5px solid ${THEME.border}`, color: THEME.textSub, width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontSize: '13px', fontWeight: '500', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              title="도움말"
            >?</button>
            {view === 'members' && topTab === 'myRecord' && (
              <button onClick={() => setShowCalcModal(true)} style={{ background: '#FFF', border: `0.5px solid ${THEME.border}`, color: THEME.primary, padding: '0 12px', borderRadius: '15px', cursor: 'pointer', fontSize: '11px', fontWeight: '500', height: '30px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                식단 설정
              </button>
            )}
            {view === 'memberDetail' && (
              <button onClick={() => setShowMemberCalcModal(true)} style={{ background: '#FFF', border: `0.5px solid ${THEME.border}`, color: THEME.primary, padding: '0 12px', borderRadius: '15px', cursor: 'pointer', fontSize: '11px', fontWeight: '500', height: '30px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                식단 설정
              </button>
            )}
            {view !== 'members' && (
              <button style={{ background: '#FFF', border: `0.5px solid ${THEME.border}`, color: THEME.primary, padding: '0 12px', borderRadius: '15px', cursor: 'pointer', fontSize: '11px', height: '30px', display: 'flex', alignItems: 'center', flexShrink: 0 }} onClick={() => { setView('members'); setSelectedMember(null) }}>← 목록</button>
            )}
            <button style={{ background: '#FFF', border: `0.5px solid ${THEME.border}`, color: THEME.textSub, padding: '0 12px', borderRadius: '15px', cursor: 'pointer', fontSize: '11px', height: '30px', display: 'flex', alignItems: 'center', flexShrink: 0 }} onClick={onLogout}>로그아웃</button>
          </div>
        </div>

        {showHelp && <HelpModal type="trainer" onClose={() => setShowHelp(false)} />}

        {showNotesMember && (
          <MemberNotes
            member={showNotesMember}
            onClose={() => setShowNotesMember(null)}
            onUpdate={() => loadMemberNotes(showNotesMember.id)}
          />
        )}

        {/* 인바디 입력 모달 (트레이너가 선택한 회원의 인바디 입력) */}
        {selectedMember && (
          <InbodyModal
            user={user}
            memberId={selectedMember.id}
            isOpen={inbodyOpen}
            mode="input"
            onClose={() => setInbodyOpen(false)}
            table="trainer_inbody"
            idField="trainer_id"
          />
        )}

        {/* 인바디 추이 모달 (회원/트레이너 합쳐서 표시) */}
        {selectedMember && (
          <InbodyModal
            user={user}
            memberId={selectedMember.id}
            isOpen={inbodyChartOpen}
            mode="chart"
            onClose={() => setInbodyChartOpen(false)}
            table="trainer_inbody"
            idField="trainer_id"
          />
        )}

        {showCalcModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div style={{ background: '#FFF', borderRadius: '20px 20px 0 0', padding: '20px', width: '100%', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <p style={{ fontSize: '15px', fontWeight: '500', color: THEME.text, margin: 0 }}>식단 설정</p>
                <button onClick={() => setShowCalcModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: THEME.textSub }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <select style={{ ...S.input, padding: '10px', fontSize: '13px' }} value={goal} onChange={e => setGoal(e.target.value)}>
                  <option value="다이어트">다이어트</option>
                  <option value="벌크업">벌크업</option>
                </select>
                <select style={{ ...S.input, padding: '10px', fontSize: '13px' }} value={gender} onChange={e => setGender(e.target.value)}>
                  <option value="여성">여성</option>
                  <option value="남성">남성</option>
                </select>
                <input style={{ ...S.input, padding: '10px', fontSize: '13px' }} type="number" placeholder="체중 (kg)" value={weight} onChange={e => setWeight(e.target.value)} />
                <input style={{ ...S.input, padding: '10px', fontSize: '13px' }} type="number" placeholder="골격근량 (kg)" value={muscle} onChange={e => setMuscle(e.target.value)} />
              </div>
              <select style={{ ...S.input, padding: '10px', marginBottom: '8px', fontSize: '13px' }} value={activity} onChange={e => setActivity(e.target.value)}>
                <option value="가벼운 운동 (주 2~3회)">가벼운 운동 (주 2~3회)</option>
                <option value="보통 운동 (주 4~5회)">보통 운동 (주 4~5회)</option>
                <option value="고강도 운동 (주 6회+)">고강도 운동 (주 6회+)</option>
              </select>
              <select style={{ ...S.input, padding: '10px', marginBottom: '8px', fontSize: '13px' }} value={intensity} onChange={e => setIntensity(e.target.value)}>
                <option value="완만">완만 {goal === '벌크업' ? '(+300kcal)' : '(-300kcal)'}</option>
                <option value="일반">일반 {goal === '벌크업' ? '(+400kcal)' : '(-500kcal)'}</option>
                <option value="공격적">공격적 {goal === '벌크업' ? '(+500kcal)' : '(-700kcal)'}</option>
              </select>
              {gender === '여성' && (
                <select style={{ ...S.input, padding: '10px', marginBottom: '12px', fontSize: '13px' }} value={cyclePhase} onChange={e => setCyclePhase(e.target.value)}>
                  <option value="">생리 주기 (선택사항)</option>
                  {Object.entries(CYCLE_PHASES).map(([phase, adj]) => (
                    <option key={phase} value={phase}>{phase} ({adj > 0 ? '+' : ''}{adj}kcal)</option>
                  ))}
                </select>
              )}
              <button style={S.btnPrimary} onClick={calculateTrainerMacro}>계산 및 저장</button>
            </div>
          </div>
        )}

        {showMemberCalcModal && selectedMember && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div style={{ background: '#FFF', borderRadius: '20px 20px 0 0', padding: '20px', width: '100%', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <p style={{ fontSize: '15px', fontWeight: '500', color: THEME.text, margin: 0 }}>{selectedMember.name} 회원 식단 설정</p>
                <button onClick={() => setShowMemberCalcModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: THEME.textSub }}>✕</button>
              </div>
              <p style={{ fontSize: '11px', color: THEME.textSub, margin: '0 0 14px' }}>
                저장하면 회원 화면에도 즉시 반영됩니다.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <select style={{ ...S.input, padding: '10px', fontSize: '13px' }} value={memberGoal} onChange={e => setMemberGoal(e.target.value)}>
                  <option value="다이어트">다이어트</option>
                  <option value="벌크업">벌크업</option>
                </select>
                <select style={{ ...S.input, padding: '10px', fontSize: '13px' }} value={memberGender} onChange={e => setMemberGender(e.target.value)}>
                  <option value="여성">여성</option>
                  <option value="남성">남성</option>
                </select>
                <input style={{ ...S.input, padding: '10px', fontSize: '13px' }} type="number" placeholder="체중 (kg)" value={memberWeight} onChange={e => setMemberWeight(e.target.value)} />
                <input style={{ ...S.input, padding: '10px', fontSize: '13px' }} type="number" placeholder="골격근량 (kg)" value={memberMuscle} onChange={e => setMemberMuscle(e.target.value)} />
              </div>
              <select style={{ ...S.input, padding: '10px', marginBottom: '8px', fontSize: '13px' }} value={memberActivity} onChange={e => setMemberActivity(e.target.value)}>
                <option value="가벼운 운동 (주 2~3회)">가벼운 운동 (주 2~3회)</option>
                <option value="보통 운동 (주 4~5회)">보통 운동 (주 4~5회)</option>
                <option value="고강도 운동 (주 6회+)">고강도 운동 (주 6회+)</option>
              </select>
              <select style={{ ...S.input, padding: '10px', marginBottom: '8px', fontSize: '13px' }} value={memberIntensity} onChange={e => setMemberIntensity(e.target.value)}>
                <option value="완만">완만 {memberGoal === '벌크업' ? '(+300kcal)' : '(-300kcal)'}</option>
                <option value="일반">일반 {memberGoal === '벌크업' ? '(+400kcal)' : '(-500kcal)'}</option>
                <option value="공격적">공격적 {memberGoal === '벌크업' ? '(+500kcal)' : '(-700kcal)'}</option>
              </select>
              {memberGender === '여성' && (
                <select style={{ ...S.input, padding: '10px', marginBottom: '12px', fontSize: '13px' }} value={memberCyclePhase} onChange={e => setMemberCyclePhase(e.target.value)}>
                  <option value="">생리 주기 (선택사항)</option>
                  {Object.entries(CYCLE_PHASES).map(([phase, adj]) => (
                    <option key={phase} value={phase}>{phase} ({adj > 0 ? '+' : ''}{adj}kcal)</option>
                  ))}
                </select>
              )}
              <button style={S.btnPrimary} onClick={calculateMemberMacro}>계산 및 저장</button>
            </div>
          </div>
        )}

        {deleteTarget && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: '#FFF', borderRadius: '14px', padding: '20px', width: '100%', maxWidth: '320px' }}>
              <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                <p style={{ fontSize: '15px', fontWeight: '500', color: THEME.text, margin: '0 0 6px' }}>{deleteTarget.name} 회원을 삭제할까요?</p>
                <p style={{ fontSize: '12px', color: THEME.textSub, margin: 0, lineHeight: 1.5 }}>이 회원의 모든 운동/식단 기록이<br/>함께 삭제됩니다. (복구 불가)</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '16px' }}>
                <button onClick={() => setDeleteTarget(null)} disabled={deleting} style={{ background: '#FFF', border: `0.5px solid ${THEME.border}`, padding: '12px', borderRadius: '8px', fontSize: '13px', color: THEME.textSub, cursor: 'pointer' }}>취소</button>
                <button onClick={confirmDeleteMember} disabled={deleting} style={{ background: THEME.danger, color: '#FFF', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>{deleting ? '삭제 중...' : '삭제'}</button>
              </div>
            </div>
          </div>
        )}

        {editStartDateMember && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: '#FFF', borderRadius: '14px', padding: '20px', width: '100%', maxWidth: '320px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <p style={{ fontSize: '15px', fontWeight: '500', color: THEME.text, margin: 0 }}>{editStartDateMember.name} 시작일</p>
                <button onClick={() => setEditStartDateMember(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: THEME.textSub }}>✕</button>
              </div>
              <input
                type="date"
                defaultValue={editStartDateMember.start_date || new Date().toISOString().split('T')[0]}
                onChange={e => updateStartDate(editStartDateMember.id, e.target.value)}
                style={{ width: '100%', padding: '12px', border: `0.5px solid ${THEME.border}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
              <p style={{ fontSize: '11px', color: THEME.textSub, margin: '8px 0 0' }}>날짜를 선택하면 자동 저장됩니다.</p>
            </div>
          </div>
        )}

        {view === 'members' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '12px' }}>
            <MainTabBtn active={topTab === 'members'} onClick={() => setTopTab('members')} label="회원 관리" />
            <MainTabBtn active={topTab === 'myRecord'} onClick={() => { setTopTab('myRecord'); loadTrainerLogs(); loadTrainerTodayDiet() }} label="내 기록" />
          </div>
        )}

        {view === 'members' && topTab === 'members' && (
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <p style={{ ...S.cardTitle, margin: 0 }}>회원 관리</p>
              <button style={S.addBtn} onClick={() => { setShowAddMember(!showAddMember); setGeneratedCode('') }}>+ 회원 추가</button>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <DatePicker value={memberListDate} onChange={setMemberListDate} />
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
                <div style={{ background: THEME.primaryLight, border: `0.5px solid ${THEME.primary}`, borderRadius: '8px', padding: '8px 12px' }}>
                  <p style={{ fontSize: '11px', color: THEME.primary, margin: '0 0 4px', fontWeight: '500' }}>PT 시작일</p>
                  <input
                    type="date"
                    value={newMemberStartDate}
                    onChange={e => setNewMemberStartDate(e.target.value)}
                    style={{ width: '100%', padding: '6px 0', border: 'none', background: 'transparent', fontSize: '13px', fontFamily: 'inherit', color: THEME.text, outline: 'none' }}
                  />
                </div>
                <button style={S.btnPrimary} onClick={addMember} disabled={loading}>{loading ? '추가 중...' : '코드 발급하기'}</button>
                {generatedCode && (
                  <div style={{ background: THEME.primary, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', margin: '0 0 4px' }}>발급된 코드</p>
                    <p style={{ color: '#FFF', fontSize: '32px', fontWeight: '500', letterSpacing: '6px', margin: '0 0 12px' }}>{generatedCode}</p>
                    <button style={{ background: '#FEE500', color: '#1A1A2E', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500', width: '100%' }} onClick={() => shareKakao(generatedCode, newMemberName)}>카카오톡으로 전송</button>
                  </div>
                )}
              </div>
            )}

            {members.length === 0 ? (
              <p style={{ color: THEME.textSub, textAlign: 'center', padding: '20px 0', fontSize: '13px' }}>등록된 회원이 없습니다.</p>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
              <MainTabBtn active={trainerMainTab === 'workout'} onClick={() => setTrainerMainTab('workout')} label="운동" />
              <MainTabBtn active={trainerMainTab === 'diet'} onClick={() => setTrainerMainTab('diet')} label="식단" />
            </div>

            {trainerMainTab === 'workout' && (
              <>
                <SubTabs value={trainerSubTab} onChange={setTrainerSubTab} />
                {trainerSubTab === 'log' && <WorkoutLog user={trainerAsUser} selectedDate={selectedDate} setSelectedDate={setSelectedDate} exercises={exercises} setExercises={setExercises} onUpdate={loadTrainerLogs} tableOverride="trainer_workout_logs" trainerIdField="trainer_id" weight={weight} muscle={muscle} allLogs={allLogs} favorites={trainerFavorites} onFavoritesUpdate={loadTrainerFavorites} />}
                {trainerSubTab === 'stats' && <WorkoutStats allLogs={allLogs} memberId={user.id} bigPrTable="trainer_personal_records" bigPrIdField="trainer_id" />}
              </>
            )}

            {trainerMainTab === 'diet' && (
              <>
                <SubTabs value={trainerSubTab} onChange={setTrainerSubTab} />
                <DietLog user={trainerAsUser} onDietUpdate={loadTrainerTodayDiet} tableOverride="trainer_diet_logs" trainerIdField="trainer_id" weight={weight} muscle={muscle} workoutTable="trainer_workout_logs" workoutIdField="trainer_id" forcedTab={trainerSubTab} macroResult={trainerMacro} goal={goal} intensity={intensity} />
              </>
            )}
          </>
        )}

        {view === 'memberDetail' && selectedMember && (
          <>
            <div style={{ background: THEME.primaryLight, border: `0.5px solid ${THEME.primaryAccent}`, borderRadius: '12px', padding: '12px 16px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '15px', fontWeight: '500', color: THEME.primaryDark, margin: '0 0 2px' }}>{selectedMember.name}</p>
                  <p style={{ fontSize: '12px', color: THEME.textSub, margin: 0 }}>{selectedMember.goal} · {selectedMember.gender} · {selectedMember.code}</p>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowNotesMember(selectedMember)} style={memberActionBtn}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={THEME.primary} strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    메모
                  </button>
                  <button onClick={() => setInbodyOpen(true)} style={memberActionBtn}>인바디</button>
                  <button onClick={() => setInbodyChartOpen(true)} style={memberActionBtn}>추이</button>
                </div>
              </div>

              {importantNotes.length > 0 && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `0.5px dashed ${THEME.primaryAccent}` }}>
                  {importantNotes.map(note => {
                    const cat = memberCategories.find(c => c.id === note.category_id)
                    const color = cat ? (NOTE_COLOR_POOL.find(c => c.name === cat.color) || NOTE_COLOR_POOL[0]) : null
                    return (
                      <div key={note.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '5px' }}>
                        {cat && color && (
                          <span style={{ fontSize: '9px', background: color.bg, color: color.text, padding: '2px 6px', borderRadius: '4px', fontWeight: '500', flexShrink: 0, marginTop: '1px' }}>
                            {cat.name}
                          </span>
                        )}
                        {!cat && (
                          <span style={{ fontSize: '9px', background: THEME.borderLight, color: THEME.textSub, padding: '2px 6px', borderRadius: '4px', fontWeight: '500', flexShrink: 0, marginTop: '1px' }}>
                            미분류
                          </span>
                        )}
                        <span style={{ fontSize: '11px', color: THEME.text, lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{note.content}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <MemberMacroCard macro={memberMacro} todayDiet={memberTodayDiet} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
              <MainTabBtn active={memberMainTab === 'workout'} onClick={() => setMemberMainTab('workout')} label="운동" />
              <MainTabBtn active={memberMainTab === 'diet'} onClick={() => setMemberMainTab('diet')} label="식단" />
            </div>

            {memberMainTab === 'workout' && (
              <>
                <SubTabs value={memberSubTab} onChange={setMemberSubTab} />
                {memberSubTab === 'log' && <WorkoutLog user={selectedMember} selectedDate={selectedDate} setSelectedDate={setSelectedDate} exercises={exercises} setExercises={setExercises} onUpdate={async () => { await loadMemberLogs(selectedMember.id) }} weight={memberWeight} muscle={memberMuscle} allLogs={allLogs} favorites={memberFavorites} onFavoritesUpdate={() => loadMemberFavorites(selectedMember.id)} />}
                {memberSubTab === 'stats' && <WorkoutStats allLogs={allLogs} memberId={selectedMember.id} />}
              </>
            )}

            {memberMainTab === 'diet' && (
              <>
                <SubTabs value={memberSubTab} onChange={setMemberSubTab} />
                <DietLog user={selectedMember} onDietUpdate={() => loadMemberTodayDiet(selectedMember.id)} weight={memberWeight} muscle={memberMuscle} forcedTab={memberSubTab} macroResult={memberMacro} goal={memberGoal} intensity={memberIntensity} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
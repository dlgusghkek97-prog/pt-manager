import React, { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { S, THEME, PART_COLORS, generateCode, calcMacro, CYCLE_PHASES, OCCUPATION_MULTIPLIER, OCCUPATION_DESCRIPTION, loadFavorites, calcPtRemaining, addPtSessions, formatSupabaseError } from './utils'
import WorkoutLog from './WorkoutLog'
import WorkoutStats from './WorkoutStats'
import DietLog from './DietLog'
import HelpModal from './HelpModal'
import MemberNotes from './MemberNotes'
import DatePicker from './DatePicker'
import InbodyModal from './InbodyModal'
import NotificationBell from './NotificationBell'
import ChatList from './ChatList'
import ChatRoom from './ChatRoom'
import ChatUnreadBadge from './ChatUnreadBadge'
import PushPromptModal from './PushPromptModal'
import SubscriptionModal from './SubscriptionModal'
import SubscriptionGate from './SubscriptionGate'
import useModalBackButton from './useModalBackButton'
import useTabHistory from './useTabHistory'
import { loadSubscription, summarizeSubscription, canAddMember } from './utils'

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

const MACRO_INPUT_STYLE = {
  background: 'transparent',
  border: 'none',
  fontSize: '16px',
  fontWeight: '500',
  textAlign: 'right',
  padding: 0,
  boxSizing: 'border-box',
  outline: 'none',
  width: '52px',
  letterSpacing: '-0.3px',
  fontFamily: 'inherit',
}

const MACRO_BAR_BG_STYLE = {
  height: '3px',
  background: '#FFF',
  borderRadius: '2px',
  width: '100%',
  marginBottom: '4px',
  overflow: 'hidden',
}

const ChatBubbleIcon = ({ color = THEME.textSub, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)

const MacroCell = React.memo(function MacroCell({
  field, label, unit, value, current, bg, mid, dark, accent,
  onChangeLocal, onCommit,
}) {
  const target = value
  const pct = target > 0 ? Math.min(Math.round(current / target * 100), 100) : 0
  const over = target > 0 && current > target

  const containerStyle = React.useMemo(() => ({
    background: bg,
    borderRadius: '12px',
    padding: '10px 6px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minHeight: '105px',
  }), [bg])

  const labelStyle = React.useMemo(() => ({
    fontSize: '10px', color: mid, lineHeight: 1, height: '12px',
  }), [mid])

  const inputStyle = React.useMemo(() => ({
    ...MACRO_INPUT_STYLE,
    color: dark,
  }), [dark])

  const unitStyle = React.useMemo(() => ({
    fontSize: '8px', color: mid, opacity: 0.85,
  }), [mid])

  const barFillStyle = React.useMemo(() => ({
    width: `${pct}%`,
    background: over ? THEME.danger : accent,
    height: '3px',
    borderRadius: '2px',
  }), [pct, over, accent])

  const footStyle = React.useMemo(() => ({
    fontSize: '9px',
    color: over ? THEME.danger : mid,
    fontWeight: '500',
    lineHeight: 1,
    height: '11px',
  }), [over, mid])

  return (
    <div style={containerStyle}>
      <div style={labelStyle}>{label}</div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', justifyContent: 'center' }}>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            value={value}
            onChange={e => onChangeLocal(field, e.target.value)}
            onBlur={onCommit}
            style={inputStyle}
          />
          <span style={unitStyle}>{unit}</span>
        </div>
      </div>
      <div style={MACRO_BAR_BG_STYLE}>
        <div style={barFillStyle} />
      </div>
      <div style={footStyle}>
        {Math.round(current)}{unit} ({pct}%)
      </div>
    </div>
  )
})

const TrainerMacroCard = React.memo(function TrainerMacroCard({ macro, todayDiet, onChangeLocal, onCommit }) {
  if (!macro) return (
    <div style={{ background: THEME.cardAlt, borderRadius: '12px', padding: '10px 14px', marginBottom: '12px', textAlign: 'center', border: `0.5px dashed ${THEME.border}` }}>
      <p style={{ fontSize: '12px', color: THEME.textSub, margin: 0 }}>식단 설정을 눌러 목표를 설정해주세요</p>
    </div>
  )
  const todayCalories = todayDiet.reduce((s, l) => s + (l.calories || 0), 0)
  const todayCarbs = todayDiet.reduce((s, l) => s + (l.carbs || 0), 0)
  const todayProtein = todayDiet.reduce((s, l) => s + (l.protein || 0), 0)
  const todayFat = todayDiet.reduce((s, l) => s + (l.fat || 0), 0)
  const cells = [
    { field: 'target',  label: '칼로리', unit: 'kcal', current: todayCalories, bg: THEME.nutCaloriesBg, mid: THEME.nutCaloriesText, dark: THEME.nutCaloriesDark, accent: THEME.nutCalories },
    { field: 'carbs',   label: '탄수',   unit: 'g',    current: todayCarbs,    bg: THEME.nutCarbsBg,    mid: THEME.nutCarbsText,    dark: THEME.nutCarbsDark,    accent: THEME.nutCarbs },
    { field: 'protein', label: '단백질', unit: 'g',    current: todayProtein,  bg: THEME.nutProteinBg,  mid: THEME.nutProteinText,  dark: THEME.nutProteinDark,  accent: THEME.nutProtein },
    { field: 'fat',     label: '지방',   unit: 'g',    current: todayFat,      bg: THEME.nutFatBg,      mid: THEME.nutFatText,      dark: THEME.nutFatDark,      accent: THEME.nutFat },
  ]
  return (
    <div style={{ background: '#FFF', borderRadius: '14px', padding: '14px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
        <span style={{ fontSize: '12px', fontWeight: '500', color: THEME.text }}>오늘의 목표</span>
        <span style={{ fontSize: '10px', color: THEME.textHint }}>탭하여 수정</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
        {cells.map(c => (
          <MacroCell
            key={c.field}
            field={c.field}
            label={c.label}
            unit={c.unit}
            value={macro[c.field]}
            current={c.current}
            bg={c.bg}
            mid={c.mid}
            dark={c.dark}
            accent={c.accent}
            onChangeLocal={onChangeLocal}
            onCommit={onCommit}
          />
        ))}
      </div>
    </div>
  )
})

const MemberMacroCard = React.memo(function MemberMacroCard({ macro, todayDiet, onChangeLocal, onCommit }) {
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
  const cells = [
    { field: 'target',  label: '칼로리', unit: 'kcal', current: todayCalories, bg: THEME.nutCaloriesBg, mid: THEME.nutCaloriesText, dark: THEME.nutCaloriesDark, accent: THEME.nutCalories },
    { field: 'carbs',   label: '탄수',   unit: 'g',    current: todayCarbs,    bg: THEME.nutCarbsBg,    mid: THEME.nutCarbsText,    dark: THEME.nutCarbsDark,    accent: THEME.nutCarbs },
    { field: 'protein', label: '단백질', unit: 'g',    current: todayProtein,  bg: THEME.nutProteinBg,  mid: THEME.nutProteinText,  dark: THEME.nutProteinDark,  accent: THEME.nutProtein },
    { field: 'fat',     label: '지방',   unit: 'g',    current: todayFat,      bg: THEME.nutFatBg,      mid: THEME.nutFatText,      dark: THEME.nutFatDark,      accent: THEME.nutFat },
  ]
  return (
    <div style={{ background: '#FFF', borderRadius: '14px', padding: '14px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
        <span style={{ fontSize: '12px', fontWeight: '500', color: THEME.text }}>회원 목표 / 오늘 달성률</span>
        <span style={{ fontSize: '10px', color: THEME.textHint }}>탭하여 수정</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
        {cells.map(c => (
          <MacroCell
            key={c.field}
            field={c.field}
            label={c.label}
            unit={c.unit}
            value={macro[c.field]}
            current={c.current}
            bg={c.bg}
            mid={c.mid}
            dark={c.dark}
            accent={c.accent}
            onChangeLocal={onChangeLocal}
            onCommit={onCommit}
          />
        ))}
      </div>
    </div>
  )
})

const PtCounterBox = ({ member, onPtClick, onChargeClick }) => {
  const { total, used, remaining, hasNoPt } = calcPtRemaining(member)

  if (hasNoPt) {
    return (
      <button
        onClick={onChargeClick}
        style={{
          background: THEME.warningLight,
          border: `0.5px dashed ${THEME.warning}`,
          borderRadius: '8px',
          padding: '4px 10px',
          fontSize: '10px',
          fontWeight: '500',
          color: THEME.warningDark,
          cursor: 'pointer',
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
        }}
      >+ PT 등록</button>
    )
  }

  const isZero = remaining <= 0
  const isLow = remaining <= 5 && remaining > 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <div
        onClick={onChargeClick}
        style={{
          background: isZero ? THEME.dangerLight : (isLow ? THEME.warningLight : THEME.primaryLight),
          border: `0.5px solid ${isZero ? THEME.danger : (isLow ? THEME.warning : THEME.primaryAccent)}`,
          borderRadius: '8px',
          padding: '4px 9px',
          fontSize: '11px',
          fontWeight: '500',
          color: isZero ? THEME.dangerDark : (isLow ? THEME.warningDark : THEME.primaryDark),
          cursor: 'pointer',
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
          lineHeight: 1.3,
        }}
        title="PT 횟수 추가"
      >
        PT {remaining}/{total}
      </div>
      <button
        onClick={onPtClick}
        disabled={isZero}
        style={{
          background: isZero ? '#E8E8E0' : THEME.primary,
          border: 'none',
          color: '#FFF',
          padding: '4px 10px',
          borderRadius: '8px',
          fontSize: '11px',
          fontWeight: '500',
          cursor: isZero ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
        }}
        title={isZero ? 'PT 잔여 없음' : 'PT 1회 차감'}
      >PT</button>
    </div>
  )
}

export default function TrainerDashboard({ user, onLogout }) {
  const [view, setView] = useState('members')
  const [members, setMembers] = useState([])
  const [memberStats, setMemberStats] = useState({})
  const [showAddMember, setShowAddMember] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberGoal, setNewMemberGoal] = useState('다이어트')
  const [newMemberGender, setNewMemberGender] = useState('여성')
  const [newMemberStartDate, setNewMemberStartDate] = useState(new Date().toISOString().split('T')[0])
  const [newMemberPtTotal, setNewMemberPtTotal] = useState('')
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
  const [memberHasOccupation, setMemberHasOccupation] = useState(false)

  const [memberMainTab, setMemberMainTab] = useState('workout')
  const [memberSubTab, setMemberSubTab] = useState('log')
  const [trainerMainTab, setTrainerMainTab] = useState('workout')
  const [trainerSubTab, setTrainerSubTab] = useState('log')

  const [trainerMacro, setTrainerMacro] = useState(null)
  const [trainerTodayDiet, setTrainerTodayDiet] = useState([])
  const [trainerHasOccupation, setTrainerHasOccupation] = useState(false)
  const [showCalcModal, setShowCalcModal] = useState(false)

  const [showMemberCalcModal, setShowMemberCalcModal] = useState(false)
  const [memberGoal, setMemberGoal] = useState('다이어트')
  const [memberGender, setMemberGender] = useState('여성')
  const [memberWeight, setMemberWeight] = useState('')
  const [memberMuscle, setMemberMuscle] = useState('')
  const [memberBodyFat, setMemberBodyFat] = useState('')
  const [memberActivity, setMemberActivity] = useState('보통 운동 (주 4~5회)')
  const [memberIntensity, setMemberIntensity] = useState('일반')
  const [memberCyclePhase, setMemberCyclePhase] = useState('')
  const [memberOccupation, setMemberOccupation] = useState('')

  const [memberListDate, setMemberListDate] = useState(new Date().toISOString().split('T')[0])

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [showHelp, setShowHelp] = useState(false)
  const [editStartDateMember, setEditStartDateMember] = useState(null)

  const [showNotesMember, setShowNotesMember] = useState(null)
  const [importantNotes, setImportantNotes] = useState([])
  const [memberCategories, setMemberCategories] = useState([])

  const [inbodyOpen, setInbodyOpen] = useState(false)
  const [inbodyDefaultView, setInbodyDefaultView] = useState('input')

  const [ptChargeTarget, setPtChargeTarget] = useState(null)
  const [ptChargeAmount, setPtChargeAmount] = useState('')
  const [ptChargeLoading, setPtChargeLoading] = useState(false)
  const [ptConfirmTarget, setPtConfirmTarget] = useState(null)
  const [ptConfirmLoading, setPtConfirmLoading] = useState(false)
  const [ptResetConfirm, setPtResetConfirm] = useState(false)
  const [ptResetLoading, setPtResetLoading] = useState(false)

  // 채팅
  const [chatListOpen, setChatListOpen] = useState(false)
  const [chatRoomTarget, setChatRoomTarget] = useState(null) // { memberId, memberName }

  // 푸시 알림 안내 모달
  const [showPushPrompt, setShowPushPrompt] = useState(false)

  // 구독 (SaaS 사용료) — 트라이얼/활성/만료
  const [showSubscription, setShowSubscription] = useState(false)
  const [subSummary, setSubSummary] = useState(null)

  useEffect(() => {
    if (!user?.id) return
    let alive = true
    loadSubscription(user.id).then(sub => {
      if (alive) setSubSummary(summarizeSubscription(sub, user.email))
    })
    return () => { alive = false }
  }, [user?.id, showSubscription])  // 모달 닫힐 때 갱신

  // 핸드폰 뒤로가기 → 회원 상세에서 회원 목록으로 (앱 종료 방지)
  useModalBackButton(view === 'memberDetail', () => {
    setView('members')
    setSelectedMember(null)
  })

  // 핸드폰 뒤로가기 → 직전 탭으로 복귀 (회원관리 ↔ 내기록, 운동 ↔ 식단, 기록 ↔ 통계)
  useTabHistory({
    topTab: [topTab, setTopTab],
    memberMainTab: [memberMainTab, setMemberMainTab],
    memberSubTab: [memberSubTab, setMemberSubTab],
    trainerMainTab: [trainerMainTab, setTrainerMainTab],
    trainerSubTab: [trainerSubTab, setTrainerSubTab],
  })

  // 핸드폰 뒤로가기 → 구독 모달 닫힘
  useModalBackButton(showSubscription, () => setShowSubscription(false))

  // 핸드폰 뒤로가기 → 인라인 모달 닫힘 (TrainerDashboard 자체 모달들)
  useModalBackButton(showAddMember, () => setShowAddMember(false))
  useModalBackButton(showCalcModal, () => setShowCalcModal(false))
  useModalBackButton(showMemberCalcModal, () => setShowMemberCalcModal(false))
  useModalBackButton(!!deleteTarget, () => setDeleteTarget(null))
  useModalBackButton(!!editStartDateMember, () => setEditStartDateMember(null))
  useModalBackButton(!!ptConfirmTarget, () => setPtConfirmTarget(null))
  useModalBackButton(!!ptChargeTarget, () => setPtChargeTarget(null))
  useModalBackButton(!!showNotesMember, () => setShowNotesMember(null))

  const [goal, setGoal] = useState(() => localStorage.getItem(`tmacro_goal_${user.id}`) || '벌크업')
  const [gender, setGender] = useState(() => localStorage.getItem(`tmacro_gender_${user.id}`) || '남성')
  const [weight, setWeight] = useState(() => localStorage.getItem(`tmacro_weight_${user.id}`) || '')
  const [muscle, setMuscle] = useState(() => localStorage.getItem(`tmacro_muscle_${user.id}`) || '')
  const [bodyFat, setBodyFat] = useState(() => localStorage.getItem(`tmacro_body_fat_${user.id}`) || '')
  const [activity, setActivity] = useState(() => localStorage.getItem(`tmacro_activity_${user.id}`) || '보통 운동 (주 4~5회)')
  const [intensity, setIntensity] = useState(() => localStorage.getItem(`tmacro_intensity_${user.id}`) || '일반')
  const [cyclePhase, setCyclePhase] = useState(() => localStorage.getItem(`tmacro_cycle_${user.id}`) || '')
  const [occupation, setOccupation] = useState(() => localStorage.getItem(`tmacro_occupation_${user.id}`) || '')

  useEffect(() => {
    loadMembers(); loadTrainerMacro(); loadTrainerTodayDiet(); loadTrainerFavorites()

    // 푸시 알림 안내 모달 (2초 뒤 — 화면 렌더 안정화 후)
    const timer = setTimeout(async () => {
      const { shouldShowPushPrompt } = await import('./utils')
      const should = await shouldShowPushPrompt(user.id)
      if (should) setShowPushPrompt(true)
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

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
      .select('target_calories, target_carbs, target_protein, target_fat, macro_occupation')
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
    if (data && data.macro_occupation) {
      setOccupation(data.macro_occupation)
      setTrainerHasOccupation(true)
    } else {
      setTrainerHasOccupation(false)
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

  const saveTrainerMacro = async (macro, withOccupation = null, withBodyComp = null) => {
    const payload = {
      target_calories: parseInt(macro.target) || 0,
      target_carbs: parseInt(macro.carbs) || 0,
      target_protein: parseInt(macro.protein) || 0,
      target_fat: parseInt(macro.fat) || 0
    }
    if (withOccupation !== null) {
      payload.macro_occupation = withOccupation || null
    }
    if (withBodyComp) {
      payload.macro_weight = parseFloat(withBodyComp.weight) || null
      payload.macro_muscle = parseFloat(withBodyComp.muscle) || null
      payload.macro_body_fat = parseFloat(withBodyComp.bodyFat) || null
    }
    const { error } = await supabase
      .from('trainers')
      .update(payload)
      .eq('id', user.id)
    if (error) { console.error('[TrainerDashboard] saveTrainerMacro error:', error); alert(formatSupabaseError(error, '목표 저장 실패')); return false }
    return true
  }

  const calculateTrainerMacro = async () => {
    if (!weight || !muscle) { alert('체중과 골격근량을 입력해주세요.'); return }
    if (!occupation) { alert('직업 활동량을 선택해주세요.'); return }
    const result = calcMacro({ goal, gender, weight: parseFloat(weight), muscle: parseFloat(muscle), activity, intensity, cyclePhase, occupation })
    const ok = await saveTrainerMacro(result, occupation, { weight, muscle, bodyFat })
    if (!ok) return
    setTrainerMacro(result)
    setTrainerHasOccupation(true)
    localStorage.setItem(`tmacro_goal_${user.id}`, goal)
    localStorage.setItem(`tmacro_gender_${user.id}`, gender)
    localStorage.setItem(`tmacro_weight_${user.id}`, weight)
    localStorage.setItem(`tmacro_muscle_${user.id}`, muscle)
    if (bodyFat) localStorage.setItem(`tmacro_body_fat_${user.id}`, bodyFat)
    else localStorage.removeItem(`tmacro_body_fat_${user.id}`)
    localStorage.setItem(`tmacro_activity_${user.id}`, activity)
    localStorage.setItem(`tmacro_intensity_${user.id}`, intensity)
    localStorage.setItem(`tmacro_cycle_${user.id}`, cyclePhase)
    localStorage.setItem(`tmacro_occupation_${user.id}`, occupation)
    setShowCalcModal(false)
  }

  const updateTrainerMacroFieldLocal = React.useCallback((field, value) => {
    setTrainerMacro(prev => prev ? { ...prev, [field]: value } : prev)
  }, [])

  const commitTrainerMacroField = React.useCallback(() => {
    setTrainerMacro(prev => {
      if (!prev) return prev
      const normalized = {
        target: parseInt(prev.target) || 0,
        carbs: parseInt(prev.carbs) || 0,
        protein: parseInt(prev.protein) || 0,
        fat: parseInt(prev.fat) || 0,
      }
      saveTrainerMacro(normalized)
      return normalized
    })
  }, [])

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
      .select('goal, gender, target_calories, target_carbs, target_protein, target_fat, macro_weight, macro_muscle, macro_body_fat, macro_activity, macro_intensity, macro_cycle, macro_occupation')
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
      bodyFat: data.macro_body_fat != null ? String(data.macro_body_fat) : '',
      activity: data.macro_activity || '보통 운동 (주 4~5회)',
      intensity: data.macro_intensity || '일반',
      cyclePhase: data.macro_cycle || '',
      occupation: data.macro_occupation || '',
      hasOccupation: !!data.macro_occupation,
    }
  }

  const saveMemberMacroToDB = async (memberId, macro) => {
    const { error } = await supabase
      .from('members')
      .update({
        target_calories: parseInt(macro.target) || 0,
        target_carbs: parseInt(macro.carbs) || 0,
        target_protein: parseInt(macro.protein) || 0,
        target_fat: parseInt(macro.fat) || 0,
      })
      .eq('id', memberId)
    if (error) { console.error('[TrainerDashboard] saveMemberMacroToDB error:', error); alert(formatSupabaseError(error, '목표 저장 실패')); return false }
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
        macro_body_fat: parseFloat(inputs.bodyFat) || null,
        macro_activity: inputs.activity,
        macro_intensity: inputs.intensity,
        macro_cycle: inputs.cyclePhase || null,
        macro_occupation: inputs.occupation || null,
      })
      .eq('id', memberId)
    if (error) { console.error('[TrainerDashboard] saveMemberMacroFullToDB error:', error); alert(formatSupabaseError(error, '식단 설정 저장 실패')); return false }
    return true
  }

  const calculateMemberMacro = async () => {
    if (!selectedMember) return
    if (!memberWeight || !memberMuscle) { alert('체중과 골격근량을 입력해주세요.'); return }
    if (!memberOccupation) { alert('직업 활동량을 선택해주세요.'); return }
    const result = calcMacro({
      goal: memberGoal,
      gender: memberGender,
      weight: parseFloat(memberWeight),
      muscle: parseFloat(memberMuscle),
      activity: memberActivity,
      intensity: memberIntensity,
      cyclePhase: memberCyclePhase,
      occupation: memberOccupation,
    })
    const ok = await saveMemberMacroFullToDB(selectedMember.id, result, {
      goal: memberGoal,
      gender: memberGender,
      weight: memberWeight,
      muscle: memberMuscle,
      bodyFat: memberBodyFat,
      activity: memberActivity,
      intensity: memberIntensity,
      cyclePhase: memberCyclePhase,
      occupation: memberOccupation,
    })
    if (!ok) return
    setMemberMacro(result)
    setMemberHasOccupation(true)
    setShowMemberCalcModal(false)
    await loadMembers()
  }

  const updateMemberMacroFieldLocal = React.useCallback((field, value) => {
    setMemberMacro(prev => prev ? { ...prev, [field]: value } : prev)
  }, [])

  const selectedMemberRef = React.useRef(selectedMember)
  React.useEffect(() => {
    selectedMemberRef.current = selectedMember
  }, [selectedMember])

  const commitMemberMacroField = React.useCallback(() => {
    setMemberMacro(prev => {
      if (!prev) return prev
      const normalized = {
        target: parseInt(prev.target) || 0,
        carbs: parseInt(prev.carbs) || 0,
        protein: parseInt(prev.protein) || 0,
        fat: parseInt(prev.fat) || 0,
      }
      const currentMember = selectedMemberRef.current
      if (currentMember) {
        saveMemberMacroToDB(currentMember.id, normalized)
      }
      return normalized
    })
  }, [])

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

    // 구독 상태·회원 한도 검사 (서버 RPC). 마스터 계정은 utils 에서 우회.
    const check = await canAddMember(user.id, user.email)
    if (!check.ok) {
      setLoading(false)
      const goSub = window.confirm(`${check.reason}\n\n[구독 관리] 를 여시겠습니까?`)
      if (goSub) setShowSubscription(true)
      return
    }

    const code = generateCode()
    const ptTotal = parseInt(newMemberPtTotal) || 0
    const { data, error } = await supabase.from('members').insert({
      trainer_id: user.id,
      name: newMemberName,
      code,
      goal: newMemberGoal,
      gender: newMemberGender,
      start_date: newMemberStartDate,
      pt_total_sessions: ptTotal,
      pt_used_sessions: 0,
    }).select().single()
    if (!error && data) {
      setGeneratedCode(code)
      setMembers([data, ...members])
      setNewMemberName('')
      setNewMemberStartDate(new Date().toISOString().split('T')[0])
      setNewMemberPtTotal('')
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
      const keys = ['macro_result', 'macro_goal', 'macro_gender', 'macro_weight', 'macro_muscle', 'macro_activity', 'macro_intensity', 'macro_cycle', 'macro_occupation']
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
      setMemberBodyFat(memData.bodyFat || '')
      setMemberActivity(memData.activity)
      setMemberIntensity(memData.intensity)
      setMemberCyclePhase(memData.cyclePhase)
      setMemberOccupation(memData.occupation)
      setMemberHasOccupation(memData.hasOccupation)
    }
  }

  const refreshSelectedMember = async () => {
    if (!selectedMember) return
    const { data } = await supabase.from('members').select('*').eq('id', selectedMember.id).single()
    if (data) setSelectedMember(data)
    await loadMembers()
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

  const handlePtUse = (member) => {
    setPtConfirmTarget(member)
  }

  const confirmPtUse = async () => {
    if (!ptConfirmTarget) return
    setPtConfirmLoading(true)
    const { usePtSession } = await import('./utils')
    const result = await usePtSession(ptConfirmTarget.id)
    setPtConfirmLoading(false)

    if (!result.success) {
      alert(result.error || 'PT 차감 실패')
      setPtConfirmTarget(null)
      return
    }

    alert(`PT 1회 차감 완료\n잔여: ${result.remaining}회 / ${result.total}회`)
    setPtConfirmTarget(null)
    await refreshSelectedMember()
  }

  const openPtChargeModal = (member) => {
    setPtChargeTarget(member)
    setPtChargeAmount('')
    setPtResetConfirm(false)
  }

  const closePtChargeModal = () => {
    setPtChargeTarget(null)
    setPtChargeAmount('')
    setPtResetConfirm(false)
  }

  const handlePtCharge = async () => {
    if (!ptChargeTarget) return
    const amount = parseInt(ptChargeAmount)
    if (!amount || amount <= 0) {
      alert('충전 횟수를 입력해주세요')
      return
    }
    setPtChargeLoading(true)
    const result = await addPtSessions(ptChargeTarget.id, amount)
    setPtChargeLoading(false)

    if (!result.success) {
      alert(result.error || 'PT 충전 실패')
      return
    }

    alert(`PT ${amount}회 충전 완료\n총 ${result.newTotal}회 (잔여 ${result.remaining}회)`)
    closePtChargeModal()
    await loadMembers()
    if (selectedMember) await refreshSelectedMember()
  }

  const handlePtReset = async () => {
    if (!ptChargeTarget) return
    setPtResetLoading(true)
    const { error } = await supabase
      .from('members')
      .update({
        pt_total_sessions: 0,
        pt_used_sessions: 0,
        pt_alert_10_sent: false,
        pt_alert_5_sent: false,
      })
      .eq('id', ptChargeTarget.id)
    setPtResetLoading(false)

    if (error) {
      alert('PT 삭제 실패: ' + error.message)
      return
    }

    alert(`${ptChargeTarget.name} 회원의 PT 횟수가 전체 삭제되었습니다.`)
    closePtChargeModal()
    await loadMembers()
    if (selectedMember) await refreshSelectedMember()
  }

  // 채팅 — 회원 상세에서 1:1 채팅 열기
  const openChatWithMember = (member) => {
    setChatRoomTarget({ memberId: member.id, memberName: member.name })
  }

  // 채팅 목록에서 회원 선택
  const handleSelectConversation = (conv, member) => {
    setChatListOpen(false)
    setChatRoomTarget({ memberId: member.id, memberName: member.name })
  }

  // 알림 클릭 → navigation
  const handleNavigateRef = React.useRef()

  const handleNavigate = async (link) => {
    if (!link) return
    if (link.startsWith('chat:')) {
      // chat:<member_id> 형식
      const memberId = link.split(':')[1]
      if (!memberId) return
      // 해당 회원 정보 찾기
      const member = members.find(m => m.id === memberId)
      if (member) {
        setChatRoomTarget({ memberId: member.id, memberName: member.name })
      } else {
        // 회원 목록에 없으면 DB에서 가져옴
        const { data } = await supabase.from('members').select('*').eq('id', memberId).single()
        if (data) setChatRoomTarget({ memberId: data.id, memberName: data.name })
      }
    } else if (link.startsWith('inbody:')) {
      // inbody:<member_id> — 해당 회원 상세 + 인바디 추이 모달 자동 열기
      const memberId = link.split(':')[1]
      let member = members.find(m => m.id === memberId)
      if (!member) {
        const { data } = await supabase.from('members').select('*').eq('id', memberId).single()
        if (data) member = data
      }
      if (member) {
        await openMember(member)
        setTimeout(() => { setInbodyDefaultView('chart'); setInbodyOpen(true) }, 300)
      }
    } else if (link.startsWith('member:')) {
      // member:<member_id> — 해당 회원 상세 열기
      const memberId = link.split(':')[1]
      let member = members.find(m => m.id === memberId)
      if (!member) {
        const { data } = await supabase.from('members').select('*').eq('id', memberId).single()
        if (data) member = data
      }
      if (member) openMember(member)
    }
  }

  // 항상 최신 handleNavigate를 ref에 저장 (listener 재등록 방지용)
  handleNavigateRef.current = handleNavigate

  // SW(푸시 클릭) + URL 쿼리에서 오는 navigation 이벤트 listener
  // 빈 배열 → 마운트 시 1번만 등록 (members 같은 state 변경에도 재등록 안 됨)
  useEffect(() => {
    const handleSwMessage = (event) => {
      if (event.data?.type === 'NAVIGATE_FROM_NOTIFICATION' && event.data.link) {
        handleNavigateRef.current?.(event.data.link)
      }
    }
    const handleCustomEvent = (event) => {
      if (event.detail?.link) {
        handleNavigateRef.current?.(event.detail.link)
      }
    }

    navigator.serviceWorker?.addEventListener('message', handleSwMessage)
    window.addEventListener('pt-notification-navigate', handleCustomEvent)

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleSwMessage)
      window.removeEventListener('pt-notification-navigate', handleCustomEvent)
    }
  }, [])

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

  const OccupationBanner = ({ onSetupClick, label = '식단 설정을 다시 해주세요' }) => (
    <div style={{
      background: THEME.warningLight,
      border: `0.5px solid ${THEME.warning}`,
      borderRadius: '12px',
      padding: '11px 13px',
      marginBottom: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    }}>
      <div style={{
        width: '26px', height: '26px',
        background: THEME.warning,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{ color: '#FFF', fontSize: '14px', fontWeight: '500' }}>!</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '12px', fontWeight: '500', color: THEME.warningDark, margin: '0 0 2px' }}>
          TDEE 공식이 더 정확해졌어요
        </p>
        <p style={{ fontSize: '10px', color: THEME.warningText, margin: 0, lineHeight: 1.5 }}>
          직업 활동량 추가됨. {label}
        </p>
      </div>
      <button
        onClick={onSetupClick}
        style={{
          background: THEME.warning,
          color: '#FFF',
          border: 'none',
          padding: '7px 12px',
          borderRadius: '8px',
          fontSize: '11px',
          fontWeight: '500',
          cursor: 'pointer',
          fontFamily: 'inherit',
          flexShrink: 0,
        }}
      >설정</button>
    </div>
  )

  const MemberCard = ({ member, stat, dateLabel }) => {
    const activeParts = Object.entries(stat.parts).filter(([, v]) => v > 0)
    const calPct = stat.macro?.target > 0 ? Math.min(Math.round(stat.calories / stat.macro.target * 100), 100) : 0
    const carbsPct = stat.macro?.carbs > 0 ? Math.min(Math.round(stat.carbs / stat.macro.carbs * 100), 100) : 0
    const proteinPct = stat.macro?.protein > 0 ? Math.min(Math.round(stat.protein / stat.macro.protein * 100), 100) : 0
    const fatPct = stat.macro?.fat > 0 ? Math.min(Math.round(stat.fat / stat.macro.fat * 100), 100) : 0
    const fatOver = stat.macro?.fat > 0 && stat.fat > stat.macro.fat

    const days = calcDaysSince(member.start_date)

    const hasMacro = !!stat.macro
    const needsOccupationSetup = hasMacro && !member.macro_occupation

    const { total: ptTotal, remaining: ptRemaining, hasNoPt } = calcPtRemaining(member)
    const ptIsZero = !hasNoPt && ptRemaining <= 0
    const ptIsLow = !hasNoPt && ptRemaining <= 5 && ptRemaining > 0

    return (
      <div style={{ background: THEME.cardAlt, borderRadius: '10px', border: `0.5px solid ${THEME.border}`, padding: '10px', cursor: 'pointer', position: 'relative' }} onClick={() => openMember(member)}>
        <button
          onClick={e => { e.stopPropagation(); setDeleteTarget(member) }}
          style={{ position: 'absolute', top: '6px', right: '6px', background: '#FCEBEB', border: '0.5px solid #F09595', color: '#A32D2D', width: '20px', height: '20px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '500' }}
          title="회원 삭제"
        >×</button>

        <div style={{ paddingRight: '24px', marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <p style={{ fontSize: '13px', fontWeight: '500', color: THEME.text, margin: '0 0 2px', lineHeight: 1.2 }}>{member.name}</p>
            {needsOccupationSetup && (
              <span
                style={{ width: '6px', height: '6px', borderRadius: '50%', background: THEME.warning, flexShrink: 0, display: 'inline-block' }}
                title="직업 활동량 미설정"
              />
            )}
          </div>
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

        <div
          onClick={e => { e.stopPropagation(); openPtChargeModal(member) }}
          style={{
            background: hasNoPt ? THEME.warningLight : (ptIsZero ? THEME.dangerLight : (ptIsLow ? THEME.warningLight : THEME.primaryLight)),
            border: `0.5px ${hasNoPt ? 'dashed' : 'solid'} ${hasNoPt ? THEME.warning : (ptIsZero ? THEME.danger : (ptIsLow ? THEME.warning : THEME.primaryAccent))}`,
            borderRadius: '6px',
            padding: '5px 7px',
            marginBottom: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
          title="PT 횟수 관리"
        >
          {hasNoPt ? (
            <>
              <span style={{ fontSize: '9px', color: THEME.warningDark, fontWeight: '500' }}>PT 미등록</span>
              <span style={{ fontSize: '9px', color: THEME.warning, fontWeight: '500' }}>+ 등록</span>
            </>
          ) : (
            <>
              <span style={{
                fontSize: '9px',
                color: ptIsZero ? THEME.dangerDark : (ptIsLow ? THEME.warningDark : THEME.primaryDark),
                fontWeight: '500',
              }}>
                PT {ptRemaining}회 / {ptTotal}회
              </span>
              <span style={{ fontSize: '9px', color: ptIsZero ? THEME.danger : THEME.primary, fontWeight: '500' }}>관리</span>
            </>
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

  const showTrainerOccupationBanner = trainerMacro && !trainerHasOccupation
  const showMemberOccupationBanner = memberMacro && !memberHasOccupation

  return (
    <>
      {/* 결제 모달은 Gate 외부에 두어 차단 화면에서도 띄울 수 있게 */}
      {showSubscription && (
        <SubscriptionModal
          trainerId={user.id}
          trainerEmail={user.email}
          onClose={() => setShowSubscription(false)}
        />
      )}
      <SubscriptionGate
        user={user}
        userType="trainer"
        onOpenPay={() => setShowSubscription(true)}
        onLogout={onLogout}
        refreshKey={showSubscription ? 0 : 1}
      >
    <div style={S.container}>
      <div style={S.wrap}>
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
            <PTLogo />
            {user?.name && view !== 'memberDetail' && (
              <span style={{ fontSize: '16px', color: THEME.text, fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                {user.name}님
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <NotificationBell userId={user.id} userType="trainer" onNavigate={handleNavigate} />
            <button
              onClick={() => setChatListOpen(true)}
              style={{ position: 'relative', background: '#FFF', border: `0.5px solid ${THEME.border}`, color: THEME.textSub, width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              title="채팅 목록"
            >
              <ChatBubbleIcon color={THEME.textSub} size={14} />
              <ChatUnreadBadge userId={user.id} userType="trainer" />
            </button>
            <button
              onClick={() => setShowHelp(true)}
              style={{ background: '#FFF', border: `0.5px solid ${THEME.border}`, color: THEME.textSub, width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontSize: '13px', fontWeight: '500', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              title="도움말"
            >?</button>
            {view === 'members' && topTab === 'myRecord' && (
              <button onClick={() => setShowCalcModal(true)} style={{ background: '#FFF', border: `0.5px solid ${THEME.border}`, color: THEME.primary, padding: '0 12px', borderRadius: '15px', cursor: 'pointer', fontSize: '11px', fontWeight: '500', height: '30px', display: 'flex', alignItems: 'center', flexShrink: 0, fontFamily: 'inherit' }}>
                식단 설정
              </button>
            )}
            {view === 'memberDetail' && (
              <button onClick={() => setShowMemberCalcModal(true)} style={{ background: '#FFF', border: `0.5px solid ${THEME.border}`, color: THEME.primary, padding: '0 12px', borderRadius: '15px', cursor: 'pointer', fontSize: '11px', fontWeight: '500', height: '30px', display: 'flex', alignItems: 'center', flexShrink: 0, fontFamily: 'inherit' }}>
                식단 설정
              </button>
            )}
            {view !== 'members' && (
              <button style={{ background: '#FFF', border: `0.5px solid ${THEME.border}`, color: THEME.primary, padding: '0 12px', borderRadius: '15px', cursor: 'pointer', fontSize: '11px', fontWeight: '500', height: '30px', display: 'flex', alignItems: 'center', flexShrink: 0, fontFamily: 'inherit' }} onClick={() => { setView('members'); setSelectedMember(null) }}>회원 목록</button>
            )}
            <button style={{ background: '#FFF', border: `0.5px solid ${THEME.border}`, color: THEME.textSub, padding: '0 12px', borderRadius: '15px', cursor: 'pointer', fontSize: '11px', fontWeight: '500', height: '30px', display: 'flex', alignItems: 'center', flexShrink: 0, fontFamily: 'inherit' }} onClick={onLogout}>로그아웃</button>
          </div>
        </div>

        {showHelp && <HelpModal type="trainer" onClose={() => setShowHelp(false)} />}

        {showPushPrompt && (
          <PushPromptModal
            userId={user.id}
            userType="trainer"
            onClose={() => setShowPushPrompt(false)}
          />
        )}

        {/* 채팅 목록 모달 */}
        <ChatList
          trainerId={user.id}
          isOpen={chatListOpen}
          onClose={() => setChatListOpen(false)}
          onSelectConversation={handleSelectConversation}
        />

        {/* 1:1 채팅방 */}
        {chatRoomTarget && (
          <ChatRoom
            trainerId={user.id}
            memberId={chatRoomTarget.memberId}
            trainerName={user.name || '트레이너'}
            memberName={chatRoomTarget.memberName}
            viewerType="trainer"
            viewerId={user.id}
            onClose={() => setChatRoomTarget(null)}
            ptIsZero={false}
          />
        )}

        {showNotesMember && (
          <MemberNotes
            member={showNotesMember}
            onClose={() => setShowNotesMember(null)}
            onUpdate={() => loadMemberNotes(showNotesMember.id)}
          />
        )}

        {selectedMember && (
          <InbodyModal
            user={user}
            memberId={selectedMember.id}
            isOpen={inbodyOpen}
            defaultView={inbodyDefaultView}
            onClose={() => setInbodyOpen(false)}
            table="trainer_inbody"
            idField="trainer_id"
          />
        )}

        {ptConfirmTarget && (() => {
          const { total, remaining } = calcPtRemaining(ptConfirmTarget)
          return (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <div style={{ background: '#FFF', borderRadius: '14px', padding: '20px', width: '100%', maxWidth: '320px' }}>
                <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                  <p style={{ fontSize: '15px', fontWeight: '500', color: THEME.text, margin: '0 0 6px' }}>PT 1회 차감하시겠습니까?</p>
                  <p style={{ fontSize: '12px', color: THEME.textSub, margin: 0, lineHeight: 1.5 }}>
                    {ptConfirmTarget.name} 회원<br/>
                    잔여 <span style={{ color: THEME.primary, fontWeight: '500' }}>{remaining}회</span> → <span style={{ color: THEME.danger, fontWeight: '500' }}>{remaining - 1}회</span>
                  </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '16px' }}>
                  <button onClick={() => setPtConfirmTarget(null)} disabled={ptConfirmLoading} style={{ background: '#FFF', border: `0.5px solid ${THEME.border}`, padding: '12px', borderRadius: '8px', fontSize: '13px', color: THEME.textSub, cursor: 'pointer' }}>취소</button>
                  <button onClick={confirmPtUse} disabled={ptConfirmLoading} style={{ background: THEME.primary, color: '#FFF', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>{ptConfirmLoading ? '처리 중...' : '차감'}</button>
                </div>
              </div>
            </div>
          )
        })()}

        {ptChargeTarget && (() => {
          const { total, remaining, hasNoPt } = calcPtRemaining(ptChargeTarget)
          const addAmount = parseInt(ptChargeAmount) || 0
          const newTotal = total + addAmount
          return (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <div style={{ background: '#FFF', borderRadius: '16px', padding: '20px', width: '100%', maxWidth: '360px', maxHeight: '85vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <p style={{ fontSize: '15px', fontWeight: '500', color: THEME.text, margin: 0 }}>{ptChargeTarget.name} PT 관리</p>
                  <button onClick={closePtChargeModal} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: THEME.textSub }}>✕</button>
                </div>

                {!hasNoPt && (
                  <div style={{ background: THEME.cardAlt, borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: THEME.textSub }}>현재</span>
                    <span style={{ color: THEME.text, fontWeight: '500' }}>잔여 {remaining}회 / 총 {total}회</span>
                  </div>
                )}

                {ptResetConfirm ? (
                  <div style={{ background: THEME.dangerLight, border: `0.5px solid ${THEME.danger}`, borderRadius: '10px', padding: '14px', marginBottom: '12px' }}>
                    <p style={{ fontSize: '13px', fontWeight: '500', color: THEME.dangerDark, margin: '0 0 6px', textAlign: 'center' }}>
                      정말 전체 삭제하시겠습니까?
                    </p>
                    <p style={{ fontSize: '11px', color: THEME.danger, margin: '0 0 12px', textAlign: 'center', lineHeight: 1.5 }}>
                      총 횟수와 사용 횟수가 모두 0으로 초기화됩니다.<br/>
                      복구 불가
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <button
                        onClick={() => setPtResetConfirm(false)}
                        disabled={ptResetLoading}
                        style={{ background: '#FFF', border: `0.5px solid ${THEME.border}`, color: THEME.textSub, padding: '10px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}
                      >취소</button>
                      <button
                        onClick={handlePtReset}
                        disabled={ptResetLoading}
                        style={{ background: THEME.danger, color: '#FFF', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' }}
                      >{ptResetLoading ? '처리 중...' : '전체 삭제'}</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: '11px', color: THEME.textSub, margin: '0 0 6px' }}>빠른 선택</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px', marginBottom: '12px' }}>
                      {[10, 20, 30, 50].map(n => (
                        <button
                          key={n}
                          onClick={() => setPtChargeAmount(String(n))}
                          style={{
                            background: ptChargeAmount === String(n) ? THEME.primary : '#FFF',
                            color: ptChargeAmount === String(n) ? '#FFF' : THEME.primary,
                            border: `0.5px solid ${THEME.primary}`,
                            padding: '10px 0',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >+{n}회</button>
                      ))}
                    </div>

                    <p style={{ fontSize: '11px', color: THEME.textSub, margin: '0 0 6px' }}>직접 입력</p>
                    <input
                      type="number"
                      value={ptChargeAmount}
                      onChange={e => setPtChargeAmount(e.target.value)}
                      placeholder="예: 10"
                      style={{ ...S.input, marginBottom: '12px' }}
                    />

                    {addAmount > 0 && (
                      <div style={{ background: THEME.primaryLight, borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', textAlign: 'center', fontSize: '12px', color: THEME.primaryDark }}>
                        충전 후: 총 <span style={{ fontWeight: '500' }}>{newTotal}회</span> (잔여 <span style={{ fontWeight: '500' }}>{remaining + addAmount}회</span>)
                      </div>
                    )}

                    <button
                      onClick={handlePtCharge}
                      disabled={ptChargeLoading || !addAmount}
                      style={{
                        ...S.btnPrimary,
                        background: addAmount > 0 ? THEME.primary : '#E8E8E0',
                        cursor: addAmount > 0 ? 'pointer' : 'not-allowed',
                        marginBottom: '10px',
                      }}
                    >{ptChargeLoading ? '처리 중...' : '충전'}</button>

                    {!hasNoPt && (
                      <>
                        <div style={{ borderTop: `0.5px solid ${THEME.border}`, margin: '12px 0 10px' }} />
                        <button
                          onClick={() => setPtResetConfirm(true)}
                          style={{
                            width: '100%',
                            background: '#FFF',
                            border: `0.5px solid ${THEME.danger}`,
                            color: THEME.danger,
                            padding: '10px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >PT 횟수 전체 삭제</button>
                        <p style={{ fontSize: '10px', color: THEME.textHint, textAlign: 'center', margin: '6px 0 0' }}>
                          환불/계약 종료 시 사용
                        </p>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })()}

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
                <input style={{ ...S.input, padding: '10px', fontSize: '13px', gridColumn: '1 / -1' }} type="number" step="0.1" placeholder="체지방률 (%) — 선택 (입력하면 기초대사 계산이 더 정확)" value={bodyFat} onChange={e => setBodyFat(e.target.value)} />
              </div>
              <select style={{ ...S.input, padding: '10px', marginBottom: '8px', fontSize: '13px' }} value={activity} onChange={e => setActivity(e.target.value)}>
                <option value="가벼운 운동 (주 2~3회)">가벼운 운동 (주 2~3회)</option>
                <option value="보통 운동 (주 4~5회)">보통 운동 (주 4~5회)</option>
                <option value="고강도 운동 (주 6회+)">고강도 운동 (주 6회+)</option>
              </select>

              <div style={{ marginBottom: '8px' }}>
                <select
                  style={{
                    ...S.input,
                    padding: '10px',
                    fontSize: '13px',
                    background: occupation ? '#FAFAFA' : THEME.warningLight,
                    border: occupation ? `1px solid ${THEME.border}` : `1px solid ${THEME.warning}`,
                  }}
                  value={occupation}
                  onChange={e => setOccupation(e.target.value)}
                >
                  <option value="">직업 활동량 선택 (필수)</option>
                  {Object.keys(OCCUPATION_MULTIPLIER).map(key => (
                    <option key={key} value={key}>
                      {key} (×{OCCUPATION_MULTIPLIER[key].toFixed(2)}) — {OCCUPATION_DESCRIPTION[key]}
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: '10px', color: THEME.textSub, margin: '4px 2px 0' }}>
                  본업·일상 활동량을 선택하세요. 운동 빈도(위)와는 별개입니다.
                </p>
              </div>

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
                <input style={{ ...S.input, padding: '10px', fontSize: '13px', gridColumn: '1 / -1' }} type="number" step="0.1" placeholder="체지방률 (%) — 선택 (입력하면 기초대사 계산이 더 정확)" value={memberBodyFat} onChange={e => setMemberBodyFat(e.target.value)} />
              </div>
              <select style={{ ...S.input, padding: '10px', marginBottom: '8px', fontSize: '13px' }} value={memberActivity} onChange={e => setMemberActivity(e.target.value)}>
                <option value="가벼운 운동 (주 2~3회)">가벼운 운동 (주 2~3회)</option>
                <option value="보통 운동 (주 4~5회)">보통 운동 (주 4~5회)</option>
                <option value="고강도 운동 (주 6회+)">고강도 운동 (주 6회+)</option>
              </select>

              <div style={{ marginBottom: '8px' }}>
                <select
                  style={{
                    ...S.input,
                    padding: '10px',
                    fontSize: '13px',
                    background: memberOccupation ? '#FAFAFA' : THEME.warningLight,
                    border: memberOccupation ? `1px solid ${THEME.border}` : `1px solid ${THEME.warning}`,
                  }}
                  value={memberOccupation}
                  onChange={e => setMemberOccupation(e.target.value)}
                >
                  <option value="">직업 활동량 선택 (필수)</option>
                  {Object.keys(OCCUPATION_MULTIPLIER).map(key => (
                    <option key={key} value={key}>
                      {key} (×{OCCUPATION_MULTIPLIER[key].toFixed(2)}) — {OCCUPATION_DESCRIPTION[key]}
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: '10px', color: THEME.textSub, margin: '4px 2px 0' }}>
                  회원의 본업·일상 활동량을 선택하세요. 운동 빈도(위)와는 별개입니다.
                </p>
              </div>

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

        {/* 구독 상태 배너 — 회원 목록 탭에서만 표시 (회원 상세·내 기록 진입 시 숨김) */}
        {view === 'members' && topTab === 'members' && subSummary && (() => {
          const bColor = subSummary.state === 'admin'
            ? { bg: '#2D4A3E', border: THEME.primaryDark, text: '#FFF' }
            : subSummary.state === 'expired'
            ? { bg: THEME.dangerLight, border: THEME.danger, text: THEME.dangerDark }
            : subSummary.state === 'active'
            ? { bg: '#E6F4EB', border: THEME.primary, text: THEME.primaryDark }
            : { bg: '#FFF7E6', border: THEME.warning, text: '#8B6F2A' }
          return (
            <button
              onClick={() => setShowSubscription(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', background: bColor.bg,
                border: `0.5px solid ${bColor.border}`,
                borderRadius: '12px', padding: '14px 16px',
                marginBottom: '12px', cursor: 'pointer',
                fontFamily: 'inherit', textAlign: 'left', boxSizing: 'border-box',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: '15px', fontWeight: '500', color: bColor.text, margin: '0 0 3px' }}>
                  {subSummary.label}
                </p>
                {subSummary.expiresAt && (
                  <p style={{ fontSize: '11px', color: bColor.text, opacity: 0.75, margin: 0 }}>
                    만료일 {subSummary.expiresAt.toISOString().slice(0, 10).replace(/-/g, '.')}
                  </p>
                )}
              </div>
              <span style={{ fontSize: '12px', color: bColor.text, fontWeight: '500', flexShrink: 0, marginLeft: '8px' }}>관리 ›</span>
            </button>
          )
        })()}

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
                <div style={{ background: THEME.warningLight, border: `0.5px solid ${THEME.warning}`, borderRadius: '8px', padding: '8px 12px' }}>
                  <p style={{ fontSize: '11px', color: THEME.warningDark, margin: '0 0 4px', fontWeight: '500' }}>PT 총 횟수 (결제하신 횟수)</p>
                  <input
                    type="number"
                    value={newMemberPtTotal}
                    onChange={e => setNewMemberPtTotal(e.target.value)}
                    placeholder="예: 30 (나중에 추가 가능)"
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
            {showTrainerOccupationBanner && (
              <OccupationBanner
                onSetupClick={() => setShowCalcModal(true)}
                label="식단 설정을 다시 해주세요"
              />
            )}
            <TrainerMacroCard
              macro={trainerMacro}
              todayDiet={trainerTodayDiet}
              onChangeLocal={updateTrainerMacroFieldLocal}
              onCommit={commitTrainerMacroField}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
              <MainTabBtn active={trainerMainTab === 'workout'} onClick={() => setTrainerMainTab('workout')} label="운동" />
              <MainTabBtn active={trainerMainTab === 'diet'} onClick={() => setTrainerMainTab('diet')} label="식단" />
            </div>

            {trainerMainTab === 'workout' && (
              <>
                <SubTabs value={trainerSubTab} onChange={setTrainerSubTab} />
                {trainerSubTab === 'log' && <WorkoutLog user={trainerAsUser} selectedDate={selectedDate} setSelectedDate={setSelectedDate} exercises={exercises} setExercises={setExercises} onUpdate={loadTrainerLogs} tableOverride="trainer_workout_logs" trainerIdField="trainer_id" weight={weight} muscle={muscle} allLogs={allLogs} favorites={trainerFavorites} onFavoritesUpdate={loadTrainerFavorites} />}
                {trainerSubTab === 'stats' && (
                  <WorkoutStats
                    allLogs={allLogs}
                    memberId={user.id}
                    bigPrTable="trainer_personal_records"
                    bigPrIdField="trainer_id"
                    onJumpToLog={(d) => { setSelectedDate(d); setTrainerSubTab('log') }}
                  />
                )}
              </>
            )}

            {trainerMainTab === 'diet' && (
              <>
                <SubTabs value={trainerSubTab} onChange={setTrainerSubTab} />
                <DietLog user={trainerAsUser} onDietUpdate={loadTrainerTodayDiet} tableOverride="trainer_diet_logs" trainerIdField="trainer_id" weight={weight} muscle={muscle} bodyFat={bodyFat} occupation={occupation} workoutTable="trainer_workout_logs" workoutIdField="trainer_id" forcedTab={trainerSubTab} macroResult={trainerMacro} goal={goal} intensity={intensity} />
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
                  <button onClick={() => openChatWithMember(selectedMember)} style={memberActionBtn}>
                    <ChatBubbleIcon color={THEME.primary} size={11} />
                    채팅
                  </button>
                  <button onClick={() => setShowNotesMember(selectedMember)} style={memberActionBtn}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={THEME.primary} strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    메모
                  </button>
                  <button onClick={() => { setInbodyDefaultView('input'); setInbodyOpen(true) }} style={memberActionBtn}>인바디</button>
                  <button onClick={() => { setInbodyDefaultView('chart'); setInbodyOpen(true) }} style={memberActionBtn}>추이</button>
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

              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `0.5px dashed ${THEME.primaryAccent}`, display: 'flex', justifyContent: 'flex-end' }}>
                <PtCounterBox
                  member={selectedMember}
                  onPtClick={() => handlePtUse(selectedMember)}
                  onChargeClick={() => openPtChargeModal(selectedMember)}
                />
              </div>
            </div>

            {showMemberOccupationBanner && (
              <OccupationBanner
                onSetupClick={() => setShowMemberCalcModal(true)}
                label={`${selectedMember.name} 회원의 식단 설정을 다시 해주세요`}
              />
            )}

            <MemberMacroCard
              macro={memberMacro}
              todayDiet={memberTodayDiet}
              onChangeLocal={updateMemberMacroFieldLocal}
              onCommit={commitMemberMacroField}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
              <MainTabBtn active={memberMainTab === 'workout'} onClick={() => setMemberMainTab('workout')} label="운동" />
              <MainTabBtn active={memberMainTab === 'diet'} onClick={() => setMemberMainTab('diet')} label="식단" />
            </div>

            {memberMainTab === 'workout' && (
              <>
                <SubTabs value={memberSubTab} onChange={setMemberSubTab} />
                {memberSubTab === 'log' && <WorkoutLog user={selectedMember} selectedDate={selectedDate} setSelectedDate={setSelectedDate} exercises={exercises} setExercises={setExercises} onUpdate={async () => { await loadMemberLogs(selectedMember.id) }} weight={memberWeight} muscle={memberMuscle} allLogs={allLogs} favorites={memberFavorites} onFavoritesUpdate={() => loadMemberFavorites(selectedMember.id)} ptIsZero={(() => { const r = calcPtRemaining(selectedMember); return r.hasNoPt || r.remaining <= 0 })()} />}
                {memberSubTab === 'stats' && (
                  <WorkoutStats
                    allLogs={allLogs}
                    memberId={selectedMember.id}
                    onJumpToLog={(d) => { setSelectedDate(d); setMemberSubTab('log') }}
                  />
                )}
              </>
            )}

            {memberMainTab === 'diet' && (
              <>
                <SubTabs value={memberSubTab} onChange={setMemberSubTab} />
                <DietLog user={selectedMember} onDietUpdate={() => loadMemberTodayDiet(selectedMember.id)} weight={memberWeight} muscle={memberMuscle} bodyFat={memberBodyFat} occupation={memberOccupation} forcedTab={memberSubTab} macroResult={memberMacro} goal={memberGoal} intensity={memberIntensity} ptIsZero={(() => { const r = calcPtRemaining(selectedMember); return r.hasNoPt || r.remaining <= 0 })()} />
              </>
            )}
          </>
        )}
      </div>
    </div>
      </SubscriptionGate>
    </>
  )
}
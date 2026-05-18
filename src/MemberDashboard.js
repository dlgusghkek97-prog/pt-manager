import React, { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { S, THEME, FONT, SPACING, RADIUS, BTN_HEIGHT, calcMacro, CYCLE_PHASES, OCCUPATION_MULTIPLIER, OCCUPATION_DESCRIPTION, loadFavorites, calcPtRemaining, markTodayComplete, isTodayCompleted, formatSupabaseError } from './utils'
import WorkoutLog from './WorkoutLog'
import WorkoutStats from './WorkoutStats'
import DietLog from './DietLog'
import HelpModal from './HelpModal'
import InbodyModal from './InbodyModal'
import NotificationBell from './NotificationBell'
import ChatRoom from './ChatRoom'
import ChatUnreadBadge from './ChatUnreadBadge'
import useModalBackButton from './useModalBackButton'
import useTabHistory from './useTabHistory'
import PushPromptModal from './PushPromptModal'
import SubscriptionGate from './SubscriptionGate'
import SettingsModal from './SettingsModal'
import ScheduleModal from './ScheduleModal'
import { getTrainerScheduleEnabled, loadMyUpcomingSessions } from './utils'

const MACRO_INPUT_STYLE = {
  background: 'transparent',
  border: 'none',
  fontSize: '16px',
  fontWeight: '500',
  textAlign: 'center',
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
    textAlign: 'center',
    width: '100%',
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

export default function MemberDashboard({ user, onLogout }) {
  const [mainTab, setMainTab] = useState('workout')
  const [workoutSubTab, setWorkoutSubTab] = useState('log')
  const [dietSubTab, setDietSubTab] = useState('log')
  const [trainerSubTab, setTrainerSubTab] = useState('workout') // 트레이너 보기: 운동 / 식단 / 미디어
  // 알림에서 'diet:YYYY-MM-DD' 클릭 시 DietLog 에 강제 동기화할 날짜
  const [dietTargetDate, setDietTargetDate] = useState(null)
  const [trainerWorkoutMode, setTrainerWorkoutMode] = useState('log') // 운동 → 기록 / 통계
  const [trainerDietMode, setTrainerDietMode] = useState('log')       // 식단 → 기록 / 통계
  // 트레이너 보기 → 운동 기록 보기용 selectedDate (회원 본인 selectedDate 와 분리)
  const [trainerViewDate, setTrainerViewDate] = useState(new Date().toISOString().split('T')[0])
  const [trainerExercises, setTrainerExercises] = useState([])

  // 핸드폰 뒤로가기 → 직전 탭으로 복귀 (운동 ↔ 식단 ↔ 트레이너, 기록 ↔ 통계)
  useTabHistory({
    mainTab: [mainTab, setMainTab],
    workoutSubTab: [workoutSubTab, setWorkoutSubTab],
    dietSubTab: [dietSubTab, setDietSubTab],
    trainerSubTab: [trainerSubTab, setTrainerSubTab],
    trainerWorkoutMode: [trainerWorkoutMode, setTrainerWorkoutMode],
    trainerDietMode: [trainerDietMode, setTrainerDietMode],
  })

  // 담당 트레이너의 운동 기록 (회원이 참고용으로 열람)
  const [trainerLogs, setTrainerLogs] = useState([])
  // 담당 트레이너의 체성분/목표 — DietLog 소비 계산용
  const [trainerProfile, setTrainerProfile] = useState({
    weight: '', muscle: '', bodyFat: '', occupation: '',
    macroResult: null, goal: '다이어트', intensity: '일반',
  })

  const [exercises, setExercises] = useState([{ slot: 1, exercise_type: 'weight', body_part: '', exercise_name: '', memo: '', description: '', sets: [{ id: null, weight: '', reps: '', media_url: '' }] }])
  const [allLogs, setAllLogs] = useState([])
  const [favorites, setFavorites] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [showCalcModal, setShowCalcModal] = useState(false)

  // 핸드폰 뒤로가기 → 식단 설정 모달 닫힘
  useModalBackButton(showCalcModal, () => setShowCalcModal(false))
  const [todayDiet, setTodayDiet] = useState([])
  const [showHelp, setShowHelp] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleVisible, setScheduleVisible] = useState(false)
  const [upcomingPT, setUpcomingPT] = useState([])

  // 회원의 스케줄 표시 여부 — 담당 트레이너의 schedule_enabled 만 의존.
  // 트레이너가 OFF 하면 회원도 자동 잠금 (캘린더 아이콘/카드/모달 모두 숨김).
  useEffect(() => {
    if (!user?.id || !user.trainer_id) { setScheduleVisible(false); return }
    let alive = true
    ;(async () => {
      const trainerOn = await getTrainerScheduleEnabled(user.trainer_id)
      if (alive) setScheduleVisible(trainerOn)
    })()
    return () => { alive = false }
  }, [user?.id, user?.trainer_id, showSettings])

  // 내 다가오는 PT 일정 — 상단 카드용. 스케줄 모달 닫힐 때마다 갱신.
  useEffect(() => {
    if (!user?.id || !scheduleVisible) { setUpcomingPT([]); return }
    let alive = true
    ;(async () => {
      const data = await loadMyUpcomingSessions(user.id, 3)
      if (alive) setUpcomingPT(data)
    })()
    return () => { alive = false }
  }, [user?.id, scheduleVisible, showSchedule])

  // 인바디는 메인 탭 [인바디] 로 이동 (embedded)

  const [memberInfo, setMemberInfo] = useState(user)
  const [completingToday, setCompletingToday] = useState(false)

  // 채팅
  const [chatOpen, setChatOpen] = useState(false)
  const [trainerName, setTrainerName] = useState('트레이너')

  // 푸시 알림 안내 모달
  const [showPushPrompt, setShowPushPrompt] = useState(false)

  const [goal, setGoal] = useState(() => localStorage.getItem(`macro_goal_${user.id}`) || user.goal || '다이어트')
  const [gender, setGender] = useState(() => localStorage.getItem(`macro_gender_${user.id}`) || user.gender || '여성')
  const [weight, setWeight] = useState(() => localStorage.getItem(`macro_weight_${user.id}`) || '')
  const [muscle, setMuscle] = useState(() => localStorage.getItem(`macro_muscle_${user.id}`) || '')
  const [bodyFat, setBodyFat] = useState(() => localStorage.getItem(`macro_body_fat_${user.id}`) || '')
  const [activity, setActivity] = useState(() => localStorage.getItem(`macro_activity_${user.id}`) || '보통 운동 (주 4~5회)')
  const [intensity, setIntensity] = useState(() => localStorage.getItem(`macro_intensity_${user.id}`) || '일반')
  const [cyclePhase, setCyclePhase] = useState(() => localStorage.getItem(`macro_cycle_${user.id}`) || '')
  const [occupation, setOccupation] = useState(() => localStorage.getItem(`macro_occupation_${user.id}`) || '')
  const [hasOccupation, setHasOccupation] = useState(false)

  const [macroResult, setMacroResult] = useState(() => {
    try {
      const saved = localStorage.getItem(`macro_result_${user.id}`)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })

  useEffect(() => {
    loadAllLogs()
    loadTodayDiet()
    loadMacroFromDB()
    loadAllFavorites()
    refreshMemberInfo()
    loadTrainerName()
    loadTrainerWorkoutLogs()
    loadTrainerProfile()

    // 푸시 알림 안내 모달 (2초 뒤 — 화면 렌더 안정화 후)
    const timer = setTimeout(async () => {
      const { shouldShowPushPrompt } = await import('./utils')
      const should = await shouldShowPushPrompt(user.id)
      if (should) setShowPushPrompt(true)
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

  const refreshMemberInfo = async () => {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('id', user.id)
      .single()
    if (error) {
      console.error('[MemberDashboard] refreshMemberInfo error:', error)
      return
    }
    if (data) {
      setMemberInfo(data)
      const updatedUser = { ...user, ...data, type: 'member' }
      localStorage.setItem('pt_user', JSON.stringify(updatedUser))
    }
  }

  // 담당 트레이너 이름 로드
  const loadTrainerName = async () => {
    if (!user.trainer_id) return
    const { data, error } = await supabase
      .from('trainers')
      .select('name')
      .eq('id', user.trainer_id)
      .single()
    if (error) {
      console.error('[MemberDashboard] loadTrainerName error:', error)
      return
    }
    if (data?.name) setTrainerName(data.name)
  }

  const loadAllFavorites = async () => {
    const data = await loadFavorites(user.id, 'member_favorite_exercises', 'member_id')
    setFavorites(data)
  }

  const loadMacroFromDB = async () => {
    const { data, error } = await supabase
      .from('members')
      .select('goal, gender, target_calories, target_carbs, target_protein, target_fat, macro_weight, macro_muscle, macro_body_fat, macro_activity, macro_intensity, macro_cycle, macro_occupation')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('[MemberDashboard] loadMacroFromDB error:', error)
      return
    }

    const hasResult = data.target_calories || data.target_carbs || data.target_protein || data.target_fat
    if (hasResult) {
      const dbMacro = {
        target: data.target_calories || 0,
        carbs: data.target_carbs || 0,
        protein: data.target_protein || 0,
        fat: data.target_fat || 0,
      }
      setMacroResult(dbMacro)
      localStorage.setItem(`macro_result_${user.id}`, JSON.stringify(dbMacro))
    }

    if (data.goal) setGoal(data.goal)
    if (data.gender) setGender(data.gender)
    if (data.macro_weight) setWeight(String(data.macro_weight))
    if (data.macro_muscle) setMuscle(String(data.macro_muscle))
    if (data.macro_body_fat != null) setBodyFat(String(data.macro_body_fat))
    if (data.macro_activity) setActivity(data.macro_activity)
    if (data.macro_intensity) setIntensity(data.macro_intensity)
    if (data.macro_cycle) setCyclePhase(data.macro_cycle)
    if (data.macro_occupation) {
      setOccupation(data.macro_occupation)
      setHasOccupation(true)
    } else {
      setHasOccupation(false)
    }
  }

  const saveMacroToDB = async (macro, inputs = null) => {
    const payload = {
      target_calories: parseInt(macro.target) || 0,
      target_carbs: parseInt(macro.carbs) || 0,
      target_protein: parseInt(macro.protein) || 0,
      target_fat: parseInt(macro.fat) || 0,
    }
    if (inputs) {
      payload.goal = inputs.goal
      payload.gender = inputs.gender
      payload.macro_weight = parseFloat(inputs.weight) || null
      payload.macro_muscle = parseFloat(inputs.muscle) || null
      payload.macro_body_fat = parseFloat(inputs.bodyFat) || null
      payload.macro_activity = inputs.activity
      payload.macro_intensity = inputs.intensity
      payload.macro_cycle = inputs.cyclePhase || null
      payload.macro_occupation = inputs.occupation || null
    }
    const { error } = await supabase.from('members').update(payload).eq('id', user.id)
    if (error) {
      console.error('[MemberDashboard] saveMacroToDB error:', error)
      alert(formatSupabaseError(error, '서버 저장 실패'))
      return false
    }
    return true
  }

  const loadAllLogs = async () => {
    const { data } = await supabase.from('workout_logs').select('*').eq('member_id', user.id).order('log_date')
    if (data) setAllLogs(data)
  }

  // 담당 트레이너의 운동 기록 — 회원이 참고용으로 열람 (RLS: is_my_trainer 정책)
  const loadTrainerWorkoutLogs = async () => {
    if (!user.trainer_id) return
    const { data, error } = await supabase
      .from('trainer_workout_logs')
      .select('*')
      .eq('trainer_id', user.trainer_id)
      .order('log_date')
    if (error) { console.error('[MemberDashboard] loadTrainerWorkoutLogs error:', error); return }
    setTrainerLogs(data || [])
  }

  // 담당 트레이너의 체성분/목표 — 식단 소비 계산용 (RLS: trainers SELECT 정책)
  const loadTrainerProfile = async () => {
    if (!user.trainer_id) return
    const { data, error } = await supabase
      .from('trainers')
      .select('goal, macro_weight, macro_muscle, macro_body_fat, macro_occupation, macro_intensity, target_calories, target_carbs, target_protein, target_fat')
      .eq('id', user.trainer_id)
      .maybeSingle()
    if (error) { console.error('[MemberDashboard] loadTrainerProfile error:', error); return }
    if (!data) return
    setTrainerProfile({
      weight: data.macro_weight != null ? String(data.macro_weight) : '',
      muscle: data.macro_muscle != null ? String(data.macro_muscle) : '',
      bodyFat: data.macro_body_fat != null ? String(data.macro_body_fat) : '',
      occupation: data.macro_occupation || '',
      goal: data.goal || '다이어트',
      intensity: data.macro_intensity || '일반',
      macroResult: (data.target_calories || data.target_carbs || data.target_protein || data.target_fat)
        ? {
            target: data.target_calories || 0,
            carbs: data.target_carbs || 0,
            protein: data.target_protein || 0,
            fat: data.target_fat || 0,
          }
        : null,
    })
  }

  const loadTodayDiet = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase.from('diet_logs').select('*').eq('member_id', user.id).eq('log_date', today)
    if (error) { console.error('[MemberDashboard] loadTodayDiet error:', error); return }
    setTodayDiet(data || [])
  }

  const calculateMacro = async () => {
    if (!weight || !muscle) { alert('체중과 골격근량을 입력해주세요.'); return }
    if (!occupation) { alert('직업 활동량을 선택해주세요.'); return }
    const result = calcMacro({ goal, gender, weight: parseFloat(weight), muscle: parseFloat(muscle), activity, intensity, cyclePhase, occupation })
    const ok = await saveMacroToDB(result, { goal, gender, weight, muscle, bodyFat, activity, intensity, cyclePhase, occupation })
    if (!ok) return
    setMacroResult(result)
    setHasOccupation(true)
    localStorage.setItem(`macro_result_${user.id}`, JSON.stringify(result))
    localStorage.setItem(`macro_goal_${user.id}`, goal)
    localStorage.setItem(`macro_gender_${user.id}`, gender)
    localStorage.setItem(`macro_weight_${user.id}`, weight)
    localStorage.setItem(`macro_muscle_${user.id}`, muscle)
    if (bodyFat) localStorage.setItem(`macro_body_fat_${user.id}`, bodyFat)
    else localStorage.removeItem(`macro_body_fat_${user.id}`)
    localStorage.setItem(`macro_activity_${user.id}`, activity)
    localStorage.setItem(`macro_intensity_${user.id}`, intensity)
    localStorage.setItem(`macro_cycle_${user.id}`, cyclePhase)
    localStorage.setItem(`macro_occupation_${user.id}`, occupation)
    setShowCalcModal(false)
  }

  const updateMacroFieldLocal = React.useCallback((field, value) => {
    setMacroResult(prev => prev ? { ...prev, [field]: value } : prev)
  }, [])

  const commitMacroField = React.useCallback(() => {
    setMacroResult(prev => {
      if (!prev) return prev
      const normalized = {
        target: parseInt(prev.target) || 0,
        carbs: parseInt(prev.carbs) || 0,
        protein: parseInt(prev.protein) || 0,
        fat: parseInt(prev.fat) || 0,
      }
      localStorage.setItem(`macro_result_${user.id}`, JSON.stringify(normalized))
      saveMacroToDB(normalized)
      return normalized
    })
  }, [user.id])

  const handleTodayComplete = async () => {
    if (completingToday) return
    setCompletingToday(true)
    const result = await markTodayComplete(user.id)
    setCompletingToday(false)
    if (!result.success) {
      alert(result.error || '처리 실패')
      return
    }
    alert('트레이너에게 알림을 보냈습니다.')
    await refreshMemberInfo()
  }

  // 알림 클릭 시 navigation
  const handleNavigateRef = React.useRef()

  const handleNavigate = (link) => {
    if (!link) return
    if (link.startsWith('chat:')) {
      setChatOpen(true)
    } else if (link.startsWith('diet:')) {
      const date = link.split(':')[1]
      setMainTab('diet')
      setDietSubTab('log')
      if (date) {
        // forcedDate 변경 — 같은 값이어도 useEffect 발화시키기 위해 한 번 null 거쳐 설정
        setDietTargetDate(null)
        setTimeout(() => setDietTargetDate(date), 0)
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // 항상 최신 handleNavigate를 ref에 저장 (listener 재등록 방지용)
  handleNavigateRef.current = handleNavigate

  // SW(푸시 클릭) + URL 쿼리에서 오는 navigation 이벤트 listener
  // 빈 배열 → 마운트 시 1번만 등록, 언마운트 시 해제 (무한 재등록 방지)
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

  const todayCalories = todayDiet.reduce((s, l) => s + (l.calories || 0), 0)
  const todayCarbs = todayDiet.reduce((s, l) => s + (l.carbs || 0), 0)
  const todayProtein = todayDiet.reduce((s, l) => s + (l.protein || 0), 0)
  const todayFat = todayDiet.reduce((s, l) => s + (l.fat || 0), 0)

  const PTLogo = () => (
    <div style={{
      width: '42px', height: '42px', background: THEME.primaryAccent, borderRadius: '12px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', flexShrink: 0
    }}>
      <span style={{ color: THEME.primaryDark, fontSize: '14px', fontWeight: '500', lineHeight: 1, letterSpacing: '-0.3px' }}>PT</span>
      <div style={{ width: '18px', height: '0.5px', background: THEME.primaryDark, margin: '2px 0' }} />
      <span style={{ color: THEME.primaryDark, fontSize: '5px', letterSpacing: '0.5px' }}>MANAGER</span>
    </div>
  )

  const inbodyBtnStyle = {
    background: '#FFF',
    border: `0.5px solid ${THEME.primaryAccent}`,
    color: THEME.primary,
    padding: '0 10px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: '500',
    height: '26px',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  }

  const MainTabBtn = ({ tabKey, label }) => {
    const active = mainTab === tabKey
    const longLabel = (label || '').length > 5
    return (
      <button
        onClick={() => setMainTab(tabKey)}
        style={{
          background: active ? THEME.primaryAccent : '#FFF',
          color: active ? THEME.primaryDark : THEME.textSub,
          border: 'none',
          borderRadius: RADIUS.md,
          padding: '9px 4px',
          fontSize: longLabel ? `${FONT.sm}px` : `${FONT.md}px`,
          fontWeight: active ? 500 : 400,
          cursor: 'pointer',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
          fontFamily: 'inherit',
        }}
        title={label}
      >{label}</button>
    )
  }

  const SubTabs = ({ value, onChange }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, marginBottom: SPACING.sm, background: THEME.borderLight, padding: 3, borderRadius: RADIUS.sm }}>
      {[
        { key: 'log', label: '기록' },
        { key: 'stats', label: '통계' },
      ].map(({ key, label }) => {
        const active = value === key
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              background: active ? '#FFF' : 'transparent',
              color: active ? THEME.text : THEME.textSub,
              border: 'none',
              borderRadius: 5,
              padding: '5px 0',
              fontSize: `${FONT.sm}px`,
              fontWeight: active ? 500 : 400,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >{label}</button>
        )
      })}
    </div>
  )

  const showOccupationBanner = macroResult && !hasOccupation

  const macroCells = macroResult ? [
    { field: 'target',  label: '칼로리', unit: 'kcal', current: todayCalories, bg: THEME.nutCaloriesBg, mid: THEME.nutCaloriesText, dark: THEME.nutCaloriesDark, accent: THEME.nutCalories },
    { field: 'carbs',   label: '탄수',   unit: 'g',    current: todayCarbs,    bg: THEME.nutCarbsBg,    mid: THEME.nutCarbsText,    dark: THEME.nutCarbsDark,    accent: THEME.nutCarbs },
    { field: 'protein', label: '단백질', unit: 'g',    current: todayProtein,  bg: THEME.nutProteinBg,  mid: THEME.nutProteinText,  dark: THEME.nutProteinDark,  accent: THEME.nutProtein },
    { field: 'fat',     label: '지방',   unit: 'g',    current: todayFat,      bg: THEME.nutFatBg,      mid: THEME.nutFatText,      dark: THEME.nutFatDark,      accent: THEME.nutFat },
  ] : []

  const { total: ptTotal, remaining: ptRemaining, hasNoPt } = calcPtRemaining(memberInfo)
  const ptIsZero = hasNoPt || ptRemaining <= 0
  const ptIsLow = !hasNoPt && ptRemaining <= 5 && ptRemaining > 0

  let ptBadgeBg, ptBadgeBorder, ptBadgeColor, ptBadgeText
  if (hasNoPt) {
    ptBadgeBg = THEME.warningLight
    ptBadgeBorder = THEME.warning
    ptBadgeColor = THEME.warningDark
    ptBadgeText = 'PT 미등록'
  } else if (ptRemaining <= 0) {
    ptBadgeBg = THEME.dangerLight
    ptBadgeBorder = THEME.danger
    ptBadgeColor = THEME.dangerDark
    ptBadgeText = `PT 0회`
  } else if (ptIsLow) {
    ptBadgeBg = THEME.warningLight
    ptBadgeBorder = THEME.warning
    ptBadgeColor = THEME.warningDark
    ptBadgeText = `PT ${ptRemaining}회`
  } else {
    ptBadgeBg = THEME.primaryLight
    ptBadgeBorder = THEME.primaryAccent
    ptBadgeColor = THEME.primaryDark
    ptBadgeText = `PT ${ptRemaining}회`
  }

  const todayDone = isTodayCompleted(memberInfo)

  return (
    <SubscriptionGate user={user} userType="member" onLogout={onLogout}>
    <div style={S.container}>
      <div style={S.wrap}>
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
            <PTLogo />
            <span style={{ fontSize: '16px', color: THEME.text, fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{user.name}님</span>
            <div
              style={{
                background: ptBadgeBg,
                border: `0.5px solid ${ptBadgeBorder}`,
                color: ptBadgeColor,
                padding: '5px 12px',
                borderRadius: '14px',
                fontSize: '12px',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
              title={hasNoPt ? 'PT 미등록' : `잔여 ${ptRemaining}회 / 총 ${ptTotal}회`}
            >
              {ptBadgeText}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={handleTodayComplete}
              disabled={completingToday}
              style={{
                background: THEME.primary, color: '#FFF', border: 'none',
                padding: '0 12px', borderRadius: '18px',
                cursor: completingToday ? 'default' : 'pointer',
                fontSize: '12px', fontWeight: '500',
                height: '36px',
                display: 'flex', alignItems: 'center', gap: '4px',
                fontFamily: 'inherit',
                opacity: completingToday ? 0.7 : 1,
                whiteSpace: 'nowrap',
              }}
              title="트레이너에게 오늘 기록 알림 (여러 번 가능)"
            >
              {completingToday ? '전송 중…' : '✓ 오늘 완료'}
            </button>
            <button onClick={() => setShowCalcModal(true)} style={{ background: '#FFF', border: `0.5px solid ${THEME.border}`, color: THEME.primary, padding: '0 12px', borderRadius: '18px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', height: '36px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              식단 설정
            </button>
          </div>
        </div>

        {/* 헤더 다음 줄: [🔔] [💬] [?] (📅) [⚙] 캡슐 — 스케줄은 양쪽 토글 ON 일 때만 */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${scheduleVisible ? 5 : 4}, 1fr)`, gap: '6px', marginBottom: '10px' }}>
          <NotificationBell userId={user.id} userType="member" onNavigate={handleNavigate} size={36} wide />
          <button
            onClick={() => setChatOpen(true)}
            style={{ position: 'relative', background: '#FFF', border: `0.5px solid ${THEME.border}`, color: THEME.textSub, width: '100%', height: '36px', borderRadius: '18px', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}
            title="트레이너와 채팅"
          >
            <ChatBubbleIcon color={THEME.textSub} size={17} />
            <ChatUnreadBadge userId={user.id} userType="member" />
          </button>
          <button
            onClick={() => setShowHelp(true)}
            style={{ background: '#FFF', border: `0.5px solid ${THEME.border}`, color: THEME.textSub, width: '100%', height: '36px', borderRadius: '18px', cursor: 'pointer', fontSize: '15px', fontWeight: '500', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', fontFamily: 'inherit' }}
            title="도움말"
          >?</button>
          {scheduleVisible && (
            <button
              onClick={() => setShowSchedule(true)}
              style={{ background: '#FFF', border: `0.5px solid ${THEME.border}`, color: THEME.textSub, width: '100%', height: '36px', borderRadius: '18px', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', fontFamily: 'inherit' }}
              title="스케줄"
              aria-label="스케줄"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setShowSettings(true)}
            style={{ background: '#FFF', border: `0.5px solid ${THEME.border}`, color: THEME.textSub, width: '100%', height: '36px', borderRadius: '18px', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', fontFamily: 'inherit' }}
            title="설정"
            aria-label="설정"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>

        {showSettings && (
          <SettingsModal
            user={user}
            userType="member"
            onClose={() => setShowSettings(false)}
            onLogout={onLogout}
          />
        )}

        {showSchedule && user.trainer_id && (
          <ScheduleModal
            user={user}
            userType="member"
            trainerId={user.trainer_id}
            onClose={() => setShowSchedule(false)}
          />
        )}

        {showHelp && <HelpModal type="member" onClose={() => setShowHelp(false)} />}

        {showPushPrompt && (
          <PushPromptModal
            userId={user.id}
            userType="member"
            onClose={() => setShowPushPrompt(false)}
          />
        )}

        {chatOpen && user.trainer_id && (
          <ChatRoom
            trainerId={user.trainer_id}
            memberId={user.id}
            trainerName={trainerName}
            memberName={user.name}
            viewerType="member"
            viewerId={user.id}
            onClose={() => setChatOpen(false)}
            ptIsZero={ptIsZero}
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
              <input style={{ ...S.input, padding: '10px', fontSize: '13px', marginBottom: '8px' }} type="number" step="0.1" placeholder="체지방률 (%) — 선택 (입력하면 기초대사 계산이 더 정확해져요)" value={bodyFat} onChange={e => setBodyFat(e.target.value)} />
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
              <button style={S.btnPrimary} onClick={calculateMacro}>계산 및 저장</button>
            </div>
          </div>
        )}

        {showOccupationBanner && (
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
                직업 활동량 추가됨. 식단 설정을 다시 해주세요
              </p>
            </div>
            <button
              onClick={() => setShowCalcModal(true)}
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
        )}

        {ptIsZero && (
          <div style={{
            background: THEME.dangerLight,
            border: `0.5px solid ${THEME.danger}`,
            borderRadius: '12px',
            padding: '11px 13px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <div style={{
              width: '26px', height: '26px',
              background: THEME.danger,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ color: '#FFF', fontSize: '14px', fontWeight: '500' }}>!</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '12px', fontWeight: '500', color: THEME.dangerDark, margin: '0 0 2px' }}>
                {hasNoPt ? 'PT가 등록되지 않았습니다' : 'PT 잔여 횟수가 없습니다'}
              </p>
              <p style={{ fontSize: '10px', color: THEME.danger, margin: 0, lineHeight: 1.5 }}>
                트레이너에게 결제 문의 · 사진/영상 업로드 제한
              </p>
            </div>
          </div>
        )}

        {macroResult && (
          <div style={{ background: '#FFF', borderRadius: '14px', padding: '14px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: '500', color: THEME.text }}>오늘의 목표</span>
              <span style={{ fontSize: '10px', color: THEME.textHint }}>탭하여 수정</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
              {macroCells.map(c => (
                <MacroCell
                  key={c.field}
                  field={c.field}
                  label={c.label}
                  unit={c.unit}
                  value={macroResult[c.field]}
                  current={c.current}
                  bg={c.bg}
                  mid={c.mid}
                  dark={c.dark}
                  accent={c.accent}
                  onChangeLocal={updateMacroFieldLocal}
                  onCommit={commitMacroField}
                />
              ))}
            </div>
          </div>
        )}

        {scheduleVisible && (
          <div
            onClick={() => setShowSchedule(true)}
            style={{
              background: '#FFF', borderRadius: RADIUS.lg,
              padding: '12px 14px', marginBottom: 10,
              cursor: 'pointer',
              border: `0.5px solid ${THEME.border}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={THEME.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span style={{ fontSize: 13, fontWeight: 500, color: THEME.text }}>내 PT 일정</span>
              </div>
              <span style={{ fontSize: 10, color: THEME.textHint }}>탭하면 전체 일정</span>
            </div>
            {upcomingPT.length === 0 ? (
              <p style={{ fontSize: 11, color: THEME.textSub, margin: 0 }}>
                예정된 PT가 없어요. 스케줄에서 신청해보세요.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {upcomingPT.map(s => {
                  const dt = new Date(s.start_at)
                  const dtEnd = new Date(s.end_at)
                  const wd = ['일', '월', '화', '수', '목', '금', '토'][dt.getDay()]
                  const isToday = dt.toDateString() === new Date().toDateString()
                  const isReq = s.status === 'requested' || s.status === 'changed'
                  const fmtHM = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
                  return (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 10px',
                      background: isReq ? '#FBD8CE' : (isToday ? THEME.primaryLight : THEME.cardAlt),
                      borderRadius: 6,
                    }}>
                      <span style={{ fontSize: 12, color: isReq ? '#7A2E1A' : THEME.text, fontWeight: isToday ? 500 : 400 }}>
                        {isToday ? '오늘' : `${dt.getMonth() + 1}/${dt.getDate()}(${wd})`} {fmtHM(dt)}~{fmtHM(dtEnd)}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 500,
                        padding: '2px 7px', borderRadius: 4,
                        background: isReq ? '#E08A6E' : THEME.primary,
                        color: '#FFF',
                      }}>
                        {isReq ? '대기' : '확정'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px', marginBottom: '10px' }}>
          <MainTabBtn tabKey="workout" label="운동" />
          <MainTabBtn tabKey="diet" label="식단" />
          <MainTabBtn tabKey="inbody" label="인바디" />
          <MainTabBtn tabKey="trainer" label="내 트레이너" />
        </div>

        {mainTab === 'inbody' && (
          <InbodyModal
            user={user}
            memberId={user.id}
            isOpen={true}
            defaultView="input"
            table="member_inbody"
            idField="member_id"
            embedded
            onSaved={async ({ weight: w, muscle: m, bodyFat: bf }) => {
              // 인바디 저장 즉시 소비량/그래프 반영 — state + localStorage + DB
              if (w) { setWeight(String(w)); localStorage.setItem(`macro_weight_${user.id}`, String(w)) }
              if (m) { setMuscle(String(m)); localStorage.setItem(`macro_muscle_${user.id}`, String(m)) }
              if (bf) { setBodyFat(String(bf)); localStorage.setItem(`macro_body_fat_${user.id}`, String(bf)) }
              const patch = {}
              if (w) patch.macro_weight = parseFloat(w) || null
              if (m) patch.macro_muscle = parseFloat(m) || null
              if (bf) patch.macro_body_fat = parseFloat(bf) || null
              if (Object.keys(patch).length) {
                await supabase.from('members').update(patch).eq('id', user.id)
              }
            }}
          />
        )}

        {mainTab === 'workout' && (
          <>
            <SubTabs value={workoutSubTab} onChange={setWorkoutSubTab} />
            {workoutSubTab === 'log' && <WorkoutLog user={user} selectedDate={selectedDate} setSelectedDate={setSelectedDate} exercises={exercises} setExercises={setExercises} onUpdate={loadAllLogs} weight={weight} muscle={muscle} allLogs={allLogs} favorites={favorites} onFavoritesUpdate={loadAllFavorites} ptIsZero={ptIsZero} />}
            {workoutSubTab === 'stats' && (
              <WorkoutStats
                allLogs={allLogs}
                memberId={user.id}
                onJumpToLog={(d) => { setSelectedDate(d); setWorkoutSubTab('log') }}
              />
            )}
          </>
        )}

        {mainTab === 'diet' && (
          <>
            <SubTabs value={dietSubTab} onChange={setDietSubTab} />
            <DietLog user={user} onDietUpdate={loadTodayDiet} weight={weight} muscle={muscle} bodyFat={bodyFat} occupation={occupation} forcedTab={dietSubTab} forcedDate={dietTargetDate} macroResult={macroResult} goal={goal} intensity={intensity} ptIsZero={ptIsZero} />
          </>
        )}

        {mainTab === 'trainer' && (
          <>
            {!user.trainer_id ? (
              <div style={{ ...S.card, textAlign: 'center', color: THEME.textSub, fontSize: '12px', padding: '20px' }}>
                담당 트레이너가 아직 연결되지 않았습니다.
              </div>
            ) : (
              <>
                {/* 운동 / 식단 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, marginBottom: 8, background: THEME.borderLight, padding: 3, borderRadius: 6 }}>
                  {[
                    { key: 'workout', label: '운동' },
                    { key: 'diet', label: '식단' },
                  ].map(({ key, label }) => {
                    const active = trainerSubTab === key
                    return (
                      <button
                        key={key}
                        onClick={() => setTrainerSubTab(key)}
                        style={{
                          background: active ? '#FFF' : 'transparent',
                          color: active ? THEME.text : THEME.textSub,
                          border: 'none',
                          borderRadius: 5,
                          padding: '5px 0',
                          fontSize: 11,
                          fontWeight: active ? 500 : 400,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >{label}</button>
                    )
                  })}
                </div>

                <div style={{ background: THEME.primaryLight, borderRadius: 6, padding: '5px 10px', marginBottom: 8, fontSize: 10, color: THEME.primaryDark, textAlign: 'center' }}>
                  {trainerName} 트레이너의 기록 · 참고용 (편집 불가)
                </div>

                {trainerSubTab === 'workout' && (
                  <>
                    {/* 기록 / 통계 sub-sub-tab */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, marginBottom: 8, background: THEME.borderLight, padding: 3, borderRadius: 6 }}>
                      {[{ k: 'log', l: '기록' }, { k: 'stats', l: '통계' }].map(({ k, l }) => {
                        const active = trainerWorkoutMode === k
                        return (
                          <button key={k} onClick={() => setTrainerWorkoutMode(k)} style={{
                            background: active ? '#FFF' : 'transparent',
                            color: active ? THEME.text : THEME.textSub,
                            border: 'none', borderRadius: 5, padding: '5px 0',
                            fontSize: 11, fontWeight: active ? 500 : 400, cursor: 'pointer', fontFamily: 'inherit',
                          }}>{l}</button>
                        )
                      })}
                    </div>
                    {trainerWorkoutMode === 'log' && (
                      <WorkoutLog
                        user={{ ...user, id: user.trainer_id }}
                        selectedDate={trainerViewDate}
                        setSelectedDate={setTrainerViewDate}
                        exercises={trainerExercises}
                        setExercises={setTrainerExercises}
                        onUpdate={() => {}}
                        tableOverride="trainer_workout_logs"
                        trainerIdField="trainer_id"
                        weight={trainerProfile.weight}
                        muscle={trainerProfile.muscle}
                        allLogs={trainerLogs}
                        favorites={[]}
                        onFavoritesUpdate={() => {}}
                        readOnly
                      />
                    )}
                    {trainerWorkoutMode === 'stats' && (
                      <WorkoutStats
                        allLogs={trainerLogs}
                        memberId={user.trainer_id}
                        bigPrTable="trainer_personal_records"
                        bigPrIdField="trainer_id"
                        readOnly
                      />
                    )}
                  </>
                )}

                {trainerSubTab === 'diet' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, marginBottom: 8, background: THEME.borderLight, padding: 3, borderRadius: 6 }}>
                      {[{ k: 'log', l: '기록' }, { k: 'stats', l: '통계' }].map(({ k, l }) => {
                        const active = trainerDietMode === k
                        return (
                          <button key={k} onClick={() => setTrainerDietMode(k)} style={{
                            background: active ? '#FFF' : 'transparent',
                            color: active ? THEME.text : THEME.textSub,
                            border: 'none', borderRadius: 5, padding: '5px 0',
                            fontSize: 11, fontWeight: active ? 500 : 400, cursor: 'pointer', fontFamily: 'inherit',
                          }}>{l}</button>
                        )
                      })}
                    </div>
                    <DietLog
                      user={{ ...user, id: user.trainer_id }}
                      tableOverride="trainer_diet_logs"
                      trainerIdField="trainer_id"
                      workoutTable="trainer_workout_logs"
                      workoutIdField="trainer_id"
                      forcedTab={trainerDietMode}
                      weight={trainerProfile.weight}
                      muscle={trainerProfile.muscle}
                      bodyFat={trainerProfile.bodyFat}
                      occupation={trainerProfile.occupation}
                      macroResult={trainerProfile.macroResult}
                      goal={trainerProfile.goal}
                      intensity={trainerProfile.intensity}
                      readOnly
                    />
                  </>
                )}

              </>
            )}
          </>
        )}

      </div>
    </div>
    </SubscriptionGate>
  )
}
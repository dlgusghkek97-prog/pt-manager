import React, { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { S, THEME, calcMacro, CYCLE_PHASES } from './utils'
import WorkoutLog from './WorkoutLog'
import WorkoutStats from './WorkoutStats'
import DietLog from './DietLog'
import HelpModal from './HelpModal'

export default function MemberDashboard({ user, onLogout }) {
  const [mainTab, setMainTab] = useState('workout')
  const [workoutSubTab, setWorkoutSubTab] = useState('log')
  const [dietSubTab, setDietSubTab] = useState('log')

  const [exercises, setExercises] = useState([{ slot: 1, exercise_type: 'weight', body_part: '', exercise_name: '', memo: '', description: '', sets: [{ id: null, weight: '', reps: '', media_url: '' }] }])
  const [allLogs, setAllLogs] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [showCalcModal, setShowCalcModal] = useState(false)
  const [todayDiet, setTodayDiet] = useState([])
  const [showHelp, setShowHelp] = useState(false)

  const [goal, setGoal] = useState(() => localStorage.getItem(`macro_goal_${user.id}`) || user.goal || '다이어트')
  const [gender, setGender] = useState(() => localStorage.getItem(`macro_gender_${user.id}`) || user.gender || '여성')
  const [weight, setWeight] = useState(() => localStorage.getItem(`macro_weight_${user.id}`) || '')
  const [muscle, setMuscle] = useState(() => localStorage.getItem(`macro_muscle_${user.id}`) || '')
  const [activity, setActivity] = useState(() => localStorage.getItem(`macro_activity_${user.id}`) || '보통 운동 (주 4~5회)')
  const [intensity, setIntensity] = useState(() => localStorage.getItem(`macro_intensity_${user.id}`) || '일반')
  const [cyclePhase, setCyclePhase] = useState(() => localStorage.getItem(`macro_cycle_${user.id}`) || '')
  const [macroResult, setMacroResult] = useState(() => {
    try {
      const saved = localStorage.getItem(`macro_result_${user.id}`)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })

  useEffect(() => { loadAllLogs(); loadTodayDiet() }, [])

  const loadAllLogs = async () => {
    const { data } = await supabase.from('workout_logs').select('*').eq('member_id', user.id).order('log_date')
    if (data) setAllLogs(data)
  }

  const loadTodayDiet = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase.from('diet_logs').select('*').eq('member_id', user.id).eq('log_date', today)
    if (error) { console.error('[MemberDashboard] loadTodayDiet error:', error); return }
    setTodayDiet(data || [])
  }

  const calculateMacro = () => {
    if (!weight || !muscle) { alert('체중과 골격근량을 입력해주세요.'); return }
    const result = calcMacro({ goal, gender, weight: parseFloat(weight), muscle: parseFloat(muscle), activity, intensity, cyclePhase })
    setMacroResult(result)
    localStorage.setItem(`macro_result_${user.id}`, JSON.stringify(result))
    localStorage.setItem(`macro_goal_${user.id}`, goal)
    localStorage.setItem(`macro_gender_${user.id}`, gender)
    localStorage.setItem(`macro_weight_${user.id}`, weight)
    localStorage.setItem(`macro_muscle_${user.id}`, muscle)
    localStorage.setItem(`macro_activity_${user.id}`, activity)
    localStorage.setItem(`macro_intensity_${user.id}`, intensity)
    localStorage.setItem(`macro_cycle_${user.id}`, cyclePhase)
    setShowCalcModal(false)
  }

  const updateMacroField = (field, value) => {
    const updated = { ...macroResult, [field]: parseInt(value) || 0 }
    setMacroResult(updated)
    localStorage.setItem(`macro_result_${user.id}`, JSON.stringify(updated))
  }

  const todayCalories = todayDiet.reduce((s, l) => s + (l.calories || 0), 0)
  const todayCarbs = todayDiet.reduce((s, l) => s + (l.carbs || 0), 0)
  const todayProtein = todayDiet.reduce((s, l) => s + (l.protein || 0), 0)
  const todayFat = todayDiet.reduce((s, l) => s + (l.fat || 0), 0)

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

  const MainTabBtn = ({ tabKey, label }) => {
    const active = mainTab === tabKey
    return (
      <button
        onClick={() => setMainTab(tabKey)}
        style={{
          background: active ? THEME.primaryAccent : '#FFF',
          color: active ? THEME.primaryDark : THEME.textSub,
          border: 'none',
          borderRadius: '14px',
          padding: '12px',
          fontSize: '13px',
          fontWeight: active ? '500' : '400',
          cursor: 'pointer',
        }}
      >{label}</button>
    )
  }

  const SubTabs = ({ value, onChange }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '12px', background: THEME.borderLight, padding: '4px', borderRadius: '12px' }}>
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
              borderRadius: '9px',
              padding: '8px',
              fontSize: '12px',
              fontWeight: active ? '500' : '400',
              cursor: 'pointer',
            }}
          >{label}</button>
        )
      })}
    </div>
  )

  return (
    <div style={S.container}>
      <div style={S.wrap}>
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <PTLogo />
            <span style={{ fontSize: '14px', color: THEME.text, fontWeight: '500' }}>{user.name}님</span>
          </div>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <button
              onClick={() => setShowHelp(true)}
              style={{ background: '#FFF', border: `0.5px solid ${THEME.border}`, color: THEME.textSub, width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontSize: '13px', fontWeight: '500', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              title="도움말"
            >?</button>
            <button onClick={() => setShowCalcModal(true)} style={{ background: '#FFF', border: `0.5px solid ${THEME.border}`, color: THEME.primary, padding: '0 12px', borderRadius: '15px', cursor: 'pointer', fontSize: '11px', fontWeight: '500', height: '30px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              식단 설정
            </button>
          </div>
        </div>

        {showHelp && <HelpModal type="member" onClose={() => setShowHelp(false)} />}

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
              <button style={S.btnPrimary} onClick={calculateMacro}>계산 및 저장</button>
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
              {[
                { label: '칼로리', field: 'target', unit: 'kcal', current: todayCalories, bg: THEME.nutCaloriesBg, mid: THEME.nutCaloriesText, dark: THEME.nutCaloriesDark, accent: THEME.nutCalories },
                { label: '탄수', field: 'carbs', unit: 'g', current: todayCarbs, bg: THEME.nutCarbsBg, mid: THEME.nutCarbsText, dark: THEME.nutCarbsDark, accent: THEME.nutCarbs },
                { label: '단백질', field: 'protein', unit: 'g', current: todayProtein, bg: THEME.nutProteinBg, mid: THEME.nutProteinText, dark: THEME.nutProteinDark, accent: THEME.nutProtein },
                { label: '지방', field: 'fat', unit: 'g', current: todayFat, bg: THEME.nutFatBg, mid: THEME.nutFatText, dark: THEME.nutFatDark, accent: THEME.nutFat },
              ].map(({ label, field, unit, current, bg, mid, dark, accent }) => {
                const target = macroResult[field]
                const pct = target > 0 ? Math.min(Math.round(current / target * 100), 100) : 0
                const over = target > 0 && current > target
                return (
                  <div key={field} style={{ background: bg, borderRadius: '12px', padding: '10px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '105px' }}>
                    <div style={{ fontSize: '10px', color: mid, lineHeight: 1, height: '12px' }}>{label}</div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', justifyContent: 'center' }}>
                        <input
                          type="number"
                          value={macroResult[field]}
                          onChange={e => updateMacroField(field, e.target.value)}
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
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
          <MainTabBtn tabKey="workout" label="운동" />
          <MainTabBtn tabKey="diet" label="식단" />
        </div>

        {mainTab === 'workout' && (
          <>
            <SubTabs value={workoutSubTab} onChange={setWorkoutSubTab} />
            {workoutSubTab === 'log' && <WorkoutLog user={user} selectedDate={selectedDate} setSelectedDate={setSelectedDate} exercises={exercises} setExercises={setExercises} onUpdate={loadAllLogs} weight={weight} muscle={muscle} />}
            {workoutSubTab === 'stats' && <WorkoutStats allLogs={allLogs} />}
          </>
        )}

        {mainTab === 'diet' && (
          <>
            <SubTabs value={dietSubTab} onChange={setDietSubTab} />
            <DietLog user={user} onDietUpdate={loadTodayDiet} weight={weight} muscle={muscle} forcedTab={dietSubTab} macroResult={macroResult} goal={goal} intensity={intensity} />
          </>
        )}

        <button style={{ background: '#FFF', color: THEME.textSub, border: `0.5px solid ${THEME.border}`, padding: '12px', borderRadius: '12px', cursor: 'pointer', fontSize: '12px', width: '100%', marginTop: '12px' }} onClick={onLogout}>로그아웃</button>
      </div>
    </div>
  )
}

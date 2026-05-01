import React, { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { S, THEME, calcMacro, CYCLE_PHASES } from './utils'
import WorkoutLog from './WorkoutLog'
import WorkoutStats from './WorkoutStats'
import DietLog from './DietLog'

export default function MemberDashboard({ user, onLogout }) {
  const [memberView, setMemberView] = useState('workout')
  const [exercises, setExercises] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [allLogs, setAllLogs] = useState([])
  const [trainerLogs, setTrainerLogs] = useState([])
  const [trainerDietLogs, setTrainerDietLogs] = useState([])
  const [trainerView, setTrainerView] = useState('workout')
  const [showCalcModal, setShowCalcModal] = useState(false)

  const [goal, setGoal] = useState(() => localStorage.getItem(`macro_goal_${user.id}`) || '다이어트')
  const [gender, setGender] = useState(() => localStorage.getItem(`macro_gender_${user.id}`) || '여성')
  const [weight, setWeight] = useState(() => localStorage.getItem(`macro_weight_${user.id}`) || '')
  const [muscle, setMuscle] = useState(() => localStorage.getItem(`macro_muscle_${user.id}`) || '')
  const [activity, setActivity] = useState(() => localStorage.getItem(`macro_activity_${user.id}`) || '보통 운동 (주 4~5회)')
  const [intensity, setIntensity] = useState(() => localStorage.getItem(`macro_intensity_${user.id}`) || '일반')
  const [cyclePhase, setCyclePhase] = useState(() => localStorage.getItem(`macro_cycle_${user.id}`) || '')
  const [macro, setMacro] = useState(() => {
    const saved = localStorage.getItem(`macro_result_${user.id}`)
    return saved ? JSON.parse(saved) : null
  })

  useEffect(() => { loadAllLogs(); loadTrainerLogs() }, [])

  const loadAllLogs = async () => {
    const { data } = await supabase.from('workout_logs').select('*').eq('member_id', user.id).order('log_date')
    if (data) setAllLogs(data)
  }

  const loadTrainerLogs = async () => {
    const { data: wData } = await supabase.from('trainer_workout_logs').select('*').order('log_date')
    if (wData) setTrainerLogs(wData)
    const { data: dData } = await supabase.from('trainer_diet_logs').select('*').order('log_date')
    if (dData) setTrainerDietLogs(dData)
  }

  const calculate = () => {
    if (!weight || !muscle) return
    const result = calcMacro({ goal, gender, weight: parseFloat(weight), muscle: parseFloat(muscle), activity, intensity, cyclePhase })
    saveMacro(result)
    setShowCalcModal(false)
  }

  const saveMacro = (result) => {
    setMacro(result)
    localStorage.setItem(`macro_goal_${user.id}`, goal)
    localStorage.setItem(`macro_gender_${user.id}`, gender)
    localStorage.setItem(`macro_weight_${user.id}`, weight)
    localStorage.setItem(`macro_muscle_${user.id}`, muscle)
    localStorage.setItem(`macro_activity_${user.id}`, activity)
    localStorage.setItem(`macro_intensity_${user.id}`, intensity)
    localStorage.setItem(`macro_cycle_${user.id}`, cyclePhase)
    localStorage.setItem(`macro_result_${user.id}`, JSON.stringify(result))
  }

  const updateMacroField = (field, value) => {
    const updated = { ...macro, [field]: parseInt(value) || 0 }
    setMacro(updated)
    localStorage.setItem(`macro_result_${user.id}`, JSON.stringify(updated))
  }

  return (
    <div style={S.container}>
      <div style={S.wrap}>

        {/* 헤더 */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h1 style={{ ...S.headerTitle, fontSize: '18px', margin: 0 }}>🏋️ {user.name}님</h1>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => setShowCalcModal(true)} style={{ background: THEME.primaryLight, border: `1px solid ${THEME.primary}`, color: THEME.primary, padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>
                🧮 칼로리 설정
              </button>
              <button style={S.logoutBtn} onClick={onLogout}>로그아웃</button>
            </div>
          </div>

          {/* 칼로리 수치 항시 표시 + 바로 수정 */}
          {macro ? (
            <div style={{ background: THEME.primary, borderRadius: '12px', padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', fontWeight: '700' }}>🎯 목표 수치 (탭해서 수정)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: '6px' }}>
                {[
                  { label: '칼로리', field: 'target', unit: 'kcal', color: '#FCD34D' },
                  { label: '탄수화물', field: 'carbs', unit: 'g', color: '#93C5FD' },
                  { label: '단백질', field: 'protein', unit: 'g', color: '#FCA5A5' },
                  { label: '지방', field: 'fat', unit: 'g', color: '#FCD34D' },
                ].map(({ label, field, unit, color }) => (
                  <div key={field} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '6px 8px', textAlign: 'center' }}>
                    <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', margin: '0 0 3px' }}>{label}</p>
                    <input
                      type="number"
                      value={macro[field]}
                      onChange={e => updateMacroField(field, e.target.value)}
                      style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.4)', color, fontSize: '14px', fontWeight: '700', textAlign: 'center', padding: '2px 0', boxSizing: 'border-box', outline: 'none' }}
                    />
                    <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', margin: '2px 0 0' }}>{unit}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ background: THEME.cardAlt, borderRadius: '12px', padding: '10px 14px', textAlign: 'center', border: `1px dashed ${THEME.border}` }}>
              <p style={{ fontSize: '13px', color: THEME.textSub, margin: 0 }}>🧮 칼로리 설정을 눌러 목표를 설정해주세요</p>
            </div>
          )}
        </div>

        {/* 칼로리 계산기 모달 */}
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
                <input style={{ ...S.input, padding: '10px' }} type="number" placeholder="⚖️ 체중 (kg)" value={weight} onChange={e => setWeight(e.target.value)} />
                <input style={{ ...S.input, padding: '10px' }} type="number" placeholder="💪 골격근량 (kg)" value={muscle} onChange={e => setMuscle(e.target.value)} />
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
                  <option value="">🌸 생리 주기 선택 (선택사항)</option>
                  {Object.entries(CYCLE_PHASES).map(([phase, adj]) => (
                    <option key={phase} value={phase}>{phase} ({adj > 0 ? '+' : ''}{adj}kcal)</option>
                  ))}
                </select>
              )}
              <button style={S.btnPrimary} onClick={calculate}>🧮 계산 및 저장</button>
            </div>
          </div>
        )}

        {/* 탭 */}
        <div style={S.tabBar}>
          <button style={memberView === 'workout' ? S.tabActive : S.tab} onClick={() => setMemberView('workout')}>🏋️ 운동</button>
          <button style={memberView === 'stats' ? S.tabActive : S.tab} onClick={() => setMemberView('stats')}>📊 통계</button>
          <button style={memberView === 'diet' ? S.tabActive : S.tab} onClick={() => setMemberView('diet')}>🍽️ 식단</button>
          <button style={memberView === 'trainer' ? S.tabActive : S.tab} onClick={() => setMemberView('trainer')}>👨‍💼 트레이너</button>
        </div>

        {memberView === 'workout' && (
          <WorkoutLog user={user} selectedDate={selectedDate} setSelectedDate={setSelectedDate} exercises={exercises} setExercises={setExercises} onUpdate={loadAllLogs} />
        )}
        {memberView === 'stats' && <WorkoutStats allLogs={allLogs} />}
        {memberView === 'diet' && <DietLog user={user} macro={macro} />}

        {memberView === 'trainer' && (
          <>
            <div style={{ background: THEME.primaryLight, border: `1px solid ${THEME.primary}`, borderRadius: '12px', padding: '12px 16px', marginBottom: '12px' }}>
              <p style={{ fontSize: '14px', fontWeight: '700', color: THEME.primary, margin: '0 0 2px' }}>👨‍💼 트레이너 기록</p>
              <p style={{ fontSize: '12px', color: THEME.textSub, margin: 0 }}>트레이너의 운동 및 식단 기록을 확인하세요</p>
            </div>
            <div style={S.tabBar}>
              <button style={trainerView === 'workout' ? S.tabActive : S.tab} onClick={() => setTrainerView('workout')}>🏋️ 운동 통계</button>
              <button style={trainerView === 'diet' ? S.tabActive : S.tab} onClick={() => setTrainerView('diet')}>🍽️ 식단</button>
            </div>
            {trainerView === 'workout' && <WorkoutStats allLogs={trainerLogs} />}
            {trainerView === 'diet' && (
              <div style={S.card}>
                <p style={S.cardTitle}>🍽️ 트레이너 식단 기록</p>
                {trainerDietLogs.length === 0 ? (
                  <p style={{ color: THEME.textSub, fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>트레이너 식단 기록이 없습니다</p>
                ) : (() => {
                  const byDay = {}
                  trainerDietLogs.forEach(row => {
                    if (!byDay[row.log_date]) byDay[row.log_date] = { carbs: 0, protein: 0, fat: 0, calories: 0 }
                    byDay[row.log_date].carbs += row.carbs || 0
                    byDay[row.log_date].protein += row.protein || 0
                    byDay[row.log_date].fat += row.fat || 0
                    byDay[row.log_date].calories += row.calories || 0
                  })
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      {Object.keys(byDay).sort().reverse().map(date => {
                        const d = byDay[date]
                        return (
                          <div key={date} style={{ background: THEME.cardAlt, borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
                            <p style={{ fontSize: '12px', fontWeight: '700', color: THEME.text, margin: '0 0 4px' }}>{date.split('-')[1]}/{date.split('-')[2]}</p>
                            <p style={{ fontSize: '12px', fontWeight: '700', color: THEME.danger, margin: '0 0 4px' }}>{Math.round(d.calories)}kcal</p>
                            <p style={{ fontSize: '10px', color: THEME.textSub, margin: 0 }}>탄{Math.round(d.carbs)} 단{Math.round(d.protein)} 지{Math.round(d.fat)}</p>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
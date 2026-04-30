import React, { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { S } from './utils'
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

  useEffect(() => {
    loadAllLogs()
    loadTrainerLogs()
  }, [])

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

  return (
    <div style={S.container}>
      <div style={S.wrap}>
        <div style={S.header}>
          <h1 style={S.headerTitle}>💪 {user.name}님</h1>
          <button style={S.logoutBtn} onClick={onLogout}>로그아웃</button>
        </div>

        <div style={S.tabBar}>
          <button style={memberView === 'workout' ? S.tabActive : S.tab} onClick={() => setMemberView('workout')}>운동 기록</button>
          <button style={memberView === 'stats' ? S.tabActive : S.tab} onClick={() => setMemberView('stats')}>통계</button>
          <button style={memberView === 'diet' ? S.tabActive : S.tab} onClick={() => setMemberView('diet')}>식단</button>
          <button style={memberView === 'trainer' ? S.tabActive : S.tab} onClick={() => setMemberView('trainer')}>트레이너</button>
        </div>

        {memberView === 'workout' && (
          <WorkoutLog
            user={user}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            exercises={exercises}
            setExercises={setExercises}
            onUpdate={loadAllLogs}
          />
        )}

        {memberView === 'stats' && <WorkoutStats allLogs={allLogs} />}

        {memberView === 'diet' && <DietLog user={user} />}

        {/* 트레이너 기록 보기 */}
        {memberView === 'trainer' && (
          <>
            <div style={{ background: '#E8C547', borderRadius: '12px', padding: '12px 16px', marginBottom: '12px' }}>
              <p style={{ fontSize: '14px', fontWeight: '700', color: '#1A1A2E', margin: '0 0 2px' }}>💪 트레이너 기록</p>
              <p style={{ fontSize: '12px', color: '#555', margin: 0 }}>트레이너의 운동 및 식단 기록을 확인하세요</p>
            </div>

            <div style={S.tabBar}>
              <button style={trainerView === 'workout' ? S.tabActive : S.tab} onClick={() => setTrainerView('workout')}>운동 통계</button>
              <button style={trainerView === 'diet' ? S.tabActive : S.tab} onClick={() => setTrainerView('diet')}>식단</button>
            </div>

            {trainerView === 'workout' && <WorkoutStats allLogs={trainerLogs} />}

            {trainerView === 'diet' && (
              <div style={S.card}>
                <p style={S.cardTitle}>🍽️ 트레이너 식단 기록</p>
                {trainerDietLogs.length === 0 ? (
                  <p style={{ color: '#888', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>트레이너 식단 기록이 없습니다</p>
                ) : (
                  (() => {
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
                          const dayNum = date.split('-')[2]
                          const monthNum = date.split('-')[1]
                          return (
                            <div key={date} style={{ background: '#F9F9F9', borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
                              <p style={{ fontSize: '12px', fontWeight: '700', color: '#1A1A2E', margin: '0 0 4px' }}>{monthNum}/{dayNum}</p>
                              <p style={{ fontSize: '12px', fontWeight: '700', color: '#E84747', margin: '0 0 4px' }}>{Math.round(d.calories)}kcal</p>
                              <p style={{ fontSize: '10px', color: '#888', margin: 0 }}>탄{Math.round(d.carbs)} 단{Math.round(d.protein)} 지{Math.round(d.fat)}</p>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
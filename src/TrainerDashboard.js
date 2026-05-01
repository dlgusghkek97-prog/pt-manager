import React, { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { S, THEME, PART_COLORS, generateCode } from './utils'
import WorkoutLog from './WorkoutLog'
import WorkoutStats from './WorkoutStats'
import DietLog from './DietLog'

export default function TrainerDashboard({ user, onLogout }) {
  const [view, setView] = useState('members')
  const [members, setMembers] = useState([])
  const [memberStats, setMemberStats] = useState({}) // 당일 통계
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

  useEffect(() => { loadMembers() }, [])

  const loadMembers = async () => {
    const { data } = await supabase.from('members').select('*').eq('trainer_id', user.id).order('created_at', { ascending: false })
    if (data) {
      setMembers(data)
      loadTodayStats(data)
    }
  }

  const loadTodayStats = async (memberList) => {
    const today = new Date().toISOString().split('T')[0]
    const stats = {}
    for (const m of memberList) {
      const [{ data: wLogs }, { data: dLogs }] = await Promise.all([
        supabase.from('workout_logs').select('body_part, volume').eq('member_id', m.id).eq('log_date', today),
        supabase.from('diet_logs').select('calories').eq('member_id', m.id).eq('log_date', today)
      ])
      const parts = {}
      ;(wLogs || []).forEach(r => { if (r.body_part) parts[r.body_part] = (parts[r.body_part] || 0) + (r.volume || 0) })
      const calories = (dLogs || []).reduce((sum, r) => sum + (r.calories || 0), 0)
      stats[m.id] = { parts, calories }
    }
    setMemberStats(stats)
  }

  const addMember = async () => {
    if (!newMemberName) return
    setLoading(true)
    const code = generateCode()
    const { data, error } = await supabase.from('members').insert({ trainer_id: user.id, name: newMemberName, code, goal: newMemberGoal, gender: newMemberGender }).select().single()
    if (!error && data) { setGeneratedCode(code); setMembers([data, ...members]); setNewMemberName('') }
    setLoading(false)
  }

  const shareKakao = (code, name) => {
    alert(`아래 내용을 카카오톡으로 전송해주세요!\n\n안녕하세요 ${name}님!\nPT Manager 접속 코드: ${code}\n접속 주소: ${window.location.href}`)
  }

  const loadMemberLogs = async (memberId) => {
    const { data } = await supabase.from('workout_logs').select('*').eq('member_id', memberId).order('log_date')
    if (data) setAllLogs(data)
  }

  const loadTrainerLogs = async () => {
    const { data } = await supabase.from('trainer_workout_logs').select('*').eq('trainer_id', user.id).order('log_date')
    if (data) setAllLogs(data)
  }

  const openMember = (member) => {
    setSelectedMember(member)
    setView('memberDetail')
    setMemberView('workout')
    loadMemberLogs(member.id)
    loadMemberExercises(member.id, new Date().toISOString().split('T')[0])
  }

  const loadMemberExercises = async (memberId, date) => {
    const { data } = await supabase.from('workout_logs').select('*').eq('member_id', memberId).eq('log_date', date).order('slot').order('id')
    if (data && data.length > 0) {
      const grouped = {}
      data.forEach(row => {
        if (!grouped[row.slot]) grouped[row.slot] = { slot: row.slot, body_part: row.body_part, exercise_name: row.exercise_name, memo: row.memo || '', sets: [] }
        grouped[row.slot].sets.push({ id: row.id, weight: row.weight, reps: row.reps, volume: row.volume, media_url: row.media_url || '' })
      })
      setExercises(Object.values(grouped))
    } else {
      setExercises([{ slot: 1, body_part: '', exercise_name: '', memo: '', sets: [{ id: null, weight: '', reps: '', media_url: '' }] }])
    }
  }

  const trainerAsUser = { id: user.id, name: '트레이너', goal: '벌크업', gender: '남성', type: 'trainer_self' }

  return (
    <div style={S.container}>
      <div style={S.wrap}>
        <div style={S.header}>
          <h1 style={S.headerTitle}>🏋️ PT Manager</h1>
          <div style={{ display: 'flex', gap: '8px' }}>
            {view !== 'members' && (
              <button style={S.logoutBtn} onClick={() => { setView('members'); setSelectedMember(null) }}>← 목록</button>
            )}
            <button style={S.logoutBtn} onClick={onLogout}>🚪 로그아웃</button>
          </div>
        </div>

        {view === 'members' && (
          <div style={S.tabBar}>
            <button style={memberView === 'members' ? S.tabActive : S.tab} onClick={() => setMemberView('members')}>👥 회원 관리</button>
            <button style={memberView === 'myRecord' ? S.tabActive : S.tab} onClick={() => { setMemberView('myRecord'); loadTrainerLogs() }}>📋 내 기록</button>
          </div>
        )}

        {/* 회원 목록 */}
        {view === 'members' && memberView === 'members' && (
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <p style={{ ...S.cardTitle, margin: 0 }}>👥 회원 관리</p>
              <button style={S.addBtn} onClick={() => { setShowAddMember(!showAddMember); setGeneratedCode('') }}>➕ 회원 추가</button>
            </div>

            {showAddMember && (
              <div style={{ background: THEME.cardAlt, borderRadius: '12px', padding: '14px', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input style={S.input} type="text" placeholder="🙍 회원 이름" value={newMemberName} onChange={e => setNewMemberName(e.target.value)} />
                <select style={S.input} value={newMemberGoal} onChange={e => setNewMemberGoal(e.target.value)}>
                  <option value="다이어트">🥗 다이어트</option>
                  <option value="벌크업">💪 벌크업</option>
                  <option value="체형교정">🧘 체형교정</option>
                  <option value="재활">🏥 재활</option>
                </select>
                <select style={S.input} value={newMemberGender} onChange={e => setNewMemberGender(e.target.value)}>
                  <option value="여성">👩 여성</option>
                  <option value="남성">👨 남성</option>
                </select>
                <button style={S.btnPrimary} onClick={addMember} disabled={loading}>{loading ? '⏳ 추가 중...' : '🔑 코드 발급하기'}</button>
                {generatedCode && (
                  <div style={{ background: THEME.primary, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', margin: '0 0 4px' }}>발급된 코드</p>
                    <p style={{ color: '#FFF', fontSize: '32px', fontWeight: '700', letterSpacing: '6px', margin: '0 0 12px' }}>{generatedCode}</p>
                    <button style={{ background: '#FEE500', color: '#1A1A2E', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '700', width: '100%' }} onClick={() => shareKakao(generatedCode, newMemberName)}>💬 카카오톡으로 전송</button>
                  </div>
                )}
              </div>
            )}

            {members.length === 0 ? (
              <p style={{ color: THEME.textSub, textAlign: 'center', padding: '20px 0', fontSize: '14px' }}>등록된 회원이 없습니다.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {members.map(member => {
                  const stat = memberStats[member.id] || { parts: {}, calories: 0 }
                  const activeParts = Object.entries(stat.parts).filter(([, v]) => v > 0)
                  return (
                    <div key={member.id} style={{ padding: '12px', background: THEME.cardAlt, borderRadius: '12px', cursor: 'pointer', border: `1px solid ${THEME.border}` }} onClick={() => openMember(member)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: activeParts.length > 0 || stat.calories > 0 ? '10px' : '0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: THEME.primary, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '700' }}>{member.name.charAt(0)}</div>
                          <div>
                            <p style={{ fontSize: '15px', fontWeight: '700', color: THEME.text, margin: '0 0 2px' }}>{member.name}</p>
                            <p style={{ fontSize: '12px', color: THEME.textSub, margin: 0 }}>{member.goal} · {member.gender}</p>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: '14px', fontWeight: '700', color: THEME.text, letterSpacing: '2px', margin: '0 0 4px' }}>{member.code}</p>
                          <button style={{ background: '#FEE500', color: '#1A1A2E', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }} onClick={e => { e.stopPropagation(); shareKakao(member.code, member.name) }}>💬 전송</button>
                        </div>
                      </div>

                      {/* 당일 현황 */}
                      {(activeParts.length > 0 || stat.calories > 0) && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', paddingTop: '10px', borderTop: `1px solid ${THEME.border}` }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '10px', color: THEME.textSub, margin: '0 0 4px' }}>📅 오늘 운동</p>
                            {activeParts.length === 0 ? (
                              <p style={{ fontSize: '11px', color: THEME.textSub, margin: 0 }}>기록 없음</p>
                            ) : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                {activeParts.map(([part, vol]) => (
                                  <span key={part} style={{ fontSize: '10px', background: PART_COLORS[part], color: '#FFF', padding: '2px 6px', borderRadius: '8px' }}>
                                    {part} {vol >= 1000 ? (vol / 1000).toFixed(1) + 't' : vol + 'kg'}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '10px', color: THEME.textSub, margin: '0 0 2px' }}>🍽️ 오늘 칼로리</p>
                            <p style={{ fontSize: '14px', fontWeight: '700', color: stat.calories > 0 ? THEME.primary : THEME.textSub, margin: 0 }}>
                              {stat.calories > 0 ? `${Math.round(stat.calories)}kcal` : '기록 없음'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 트레이너 본인 기록 */}
        {view === 'members' && memberView === 'myRecord' && (
          <>
            <div style={S.tabBar}>
              <button style={trainerView === 'workout' ? S.tabActive : S.tab} onClick={() => setTrainerView('workout')}>🏋️ 운동 기록</button>
              <button style={trainerView === 'stats' ? S.tabActive : S.tab} onClick={() => setTrainerView('stats')}>📊 운동 통계</button>
              <button style={trainerView === 'diet' ? S.tabActive : S.tab} onClick={() => setTrainerView('diet')}>🍽️ 식단</button>
            </div>
            {trainerView === 'workout' && <WorkoutLog user={trainerAsUser} selectedDate={selectedDate} setSelectedDate={setSelectedDate} exercises={exercises} setExercises={setExercises} onUpdate={loadTrainerLogs} tableOverride="trainer_workout_logs" trainerIdField="trainer_id" />}
            {trainerView === 'stats' && <WorkoutStats allLogs={allLogs} />}
            {trainerView === 'diet' && <DietLog user={trainerAsUser} tableOverride="trainer_diet_logs" trainerIdField="trainer_id" onDietUpdate={() => {}} />}
          </>
        )}

        {/* 회원 상세 */}
        {view === 'memberDetail' && selectedMember && (
          <>
            <div style={{ background: THEME.primaryLight, border: `1px solid ${THEME.primary}`, borderRadius: '12px', padding: '12px 16px', marginBottom: '12px' }}>
              <p style={{ fontSize: '16px', fontWeight: '700', color: THEME.primary, margin: '0 0 2px' }}>{selectedMember.name}</p>
              <p style={{ fontSize: '13px', color: THEME.textSub, margin: 0 }}>{selectedMember.goal} · {selectedMember.gender} · {selectedMember.code}</p>
            </div>

            <div style={S.tabBar}>
              <button style={memberView === 'workout' ? S.tabActive : S.tab} onClick={() => setMemberView('workout')}>🏋️ 운동 기록</button>
              <button style={memberView === 'stats' ? S.tabActive : S.tab} onClick={() => setMemberView('stats')}>📊 운동 통계</button>
              <button style={memberView === 'diet' ? S.tabActive : S.tab} onClick={() => setMemberView('diet')}>🍽️ 식단</button>
            </div>

            {memberView === 'workout' && <WorkoutLog user={selectedMember} selectedDate={selectedDate} setSelectedDate={setSelectedDate} exercises={exercises} setExercises={setExercises} onUpdate={() => loadMemberLogs(selectedMember.id)} />}
            {memberView === 'stats' && <WorkoutStats allLogs={allLogs} />}
            {memberView === 'diet' && <DietLog user={selectedMember} />}
          </>
        )}
      </div>
    </div>
  )
}
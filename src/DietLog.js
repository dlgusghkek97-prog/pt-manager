import React, { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { S, calcMacro } from './utils'

const MEAL_TYPES = ['아침', '점심', '저녁', '간식']

export default function DietLog({ user }) {
  const [dietTab, setDietTab] = useState('record')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [dietLogs, setDietLogs] = useState([])
  const [allDietLogs, setAllDietLogs] = useState([])
  const [statsTab, setStatsTab] = useState('daily')

  // 칼로리 계산기 저장값
  const [goal, setGoal] = useState(() => localStorage.getItem(`macro_goal_${user.id}`) || '다이어트')
  const [gender, setGender] = useState(() => localStorage.getItem(`macro_gender_${user.id}`) || '여성')
  const [weight, setWeight] = useState(() => localStorage.getItem(`macro_weight_${user.id}`) || '')
  const [muscle, setMuscle] = useState(() => localStorage.getItem(`macro_muscle_${user.id}`) || '')
  const [activity, setActivity] = useState(() => localStorage.getItem(`macro_activity_${user.id}`) || '보통 운동 (주 4~5회)')
  const [intensity, setIntensity] = useState(() => localStorage.getItem(`macro_intensity_${user.id}`) || '일반')
  const [macro, setMacro] = useState(() => {
    const saved = localStorage.getItem(`macro_result_${user.id}`)
    return saved ? JSON.parse(saved) : null
  })

  useEffect(() => {
    loadDietLogs(selectedDate)
    loadAllDietLogs()
  }, [])

  const loadDietLogs = async (date) => {
    const { data } = await supabase.from('diet_logs').select('*').eq('member_id', user.id).eq('log_date', date).order('meal_type')
    if (data) setDietLogs(data)
    else setDietLogs([])
  }

  const loadAllDietLogs = async () => {
    const { data } = await supabase.from('diet_logs').select('*').eq('member_id', user.id).order('log_date')
    if (data) setAllDietLogs(data)
  }

  const calculate = () => {
    if (!weight || !muscle) return
    const result = calcMacro({ goal, gender, weight: parseFloat(weight), muscle: parseFloat(muscle), activity, intensity })
    setMacro(result)
    // 저장
    localStorage.setItem(`macro_goal_${user.id}`, goal)
    localStorage.setItem(`macro_gender_${user.id}`, gender)
    localStorage.setItem(`macro_weight_${user.id}`, weight)
    localStorage.setItem(`macro_muscle_${user.id}`, muscle)
    localStorage.setItem(`macro_activity_${user.id}`, activity)
    localStorage.setItem(`macro_intensity_${user.id}`, intensity)
    localStorage.setItem(`macro_result_${user.id}`, JSON.stringify(result))
  }

  const saveDietLog = async (mealType, field, value) => {
    const existing = dietLogs.find(l => l.meal_type === mealType)
    if (existing) {
      const { data } = await supabase.from('diet_logs').update({ [field]: parseFloat(value) || 0 }).eq('id', existing.id).select().single()
      if (data) setDietLogs(prev => prev.map(l => l.id === data.id ? data : l))
    } else {
      const { data } = await supabase.from('diet_logs').insert({ member_id: user.id, log_date: selectedDate, meal_type: mealType, [field]: parseFloat(value) || 0 }).select().single()
      if (data) setDietLogs(prev => [...prev, data])
    }
    loadAllDietLogs()
  }

  const getDietVal = (mealType, field) => {
    const log = dietLogs.find(l => l.meal_type === mealType)
    return log ? (log[field] || '') : ''
  }

  const getDayTotal = (field) => dietLogs.reduce((sum, l) => sum + (l[field] || 0), 0)

  // 오늘 달성률
  const todayCarbs = getDayTotal('carbs')
  const todayProtein = getDayTotal('protein')
  const todayFat = getDayTotal('fat')
  const todayCalories = getDayTotal('calories')

  const ProgressBar = ({ label, current, target, color }) => {
    const pct = target > 0 ? Math.min(current / target * 100, 100) : 0
    const over = target > 0 && current > target
    return (
      <div style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#1A1A2E' }}>{label}</span>
          <span style={{ fontSize: '12px', color: over ? '#E84747' : '#888' }}>
            {Math.round(current)}{label === '칼로리' ? 'kcal' : 'g'} / {target}{label === '칼로리' ? 'kcal' : 'g'}
            {over && <span style={{ color: '#E84747', marginLeft: '4px' }}>초과!</span>}
          </span>
        </div>
        <div style={{ background: '#F0F0F0', borderRadius: '6px', height: '12px' }}>
          <div style={{ width: `${pct}%`, background: over ? '#E84747' : color, height: '12px', borderRadius: '6px', transition: 'width 0.3s' }} />
        </div>
        <div style={{ textAlign: 'right', marginTop: '2px' }}>
          <span style={{ fontSize: '11px', color: over ? '#E84747' : color, fontWeight: '700' }}>{Math.round(pct)}%</span>
        </div>
      </div>
    )
  }

  // 통계
  const byDay = {}
  allDietLogs.forEach(row => {
    if (!byDay[row.log_date]) byDay[row.log_date] = { carbs: 0, protein: 0, fat: 0, calories: 0 }
    byDay[row.log_date].carbs += row.carbs || 0
    byDay[row.log_date].protein += row.protein || 0
    byDay[row.log_date].fat += row.fat || 0
    byDay[row.log_date].calories += row.calories || 0
  })
  const allDays = Object.keys(byDay).sort().reverse()

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const thisMonthLogs = allDietLogs.filter(r => r.log_date && r.log_date.startsWith(`${year}-${month}`))
  const thisWeekStart = new Date(now); thisWeekStart.setDate(now.getDate() - now.getDay() + 1)
  const thisWeekLogs = allDietLogs.filter(r => r.log_date >= thisWeekStart.toISOString().split('T')[0])
  const sumField = (logs, field) => logs.reduce((sum, r) => sum + (r[field] || 0), 0)

  const weeklyByWeek = Array.from({ length: 5 }, () => ({ carbs: 0, protein: 0, fat: 0, calories: 0 }))
  thisMonthLogs.forEach(row => {
    const day = parseInt(row.log_date.split('-')[2])
    const wk = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : day <= 28 ? 3 : 4
    weeklyByWeek[wk].carbs += row.carbs || 0
    weeklyByWeek[wk].protein += row.protein || 0
    weeklyByWeek[wk].fat += row.fat || 0
    weeklyByWeek[wk].calories += row.calories || 0
  })

  const monthlyByMonth = {}
  for (let m = 1; m <= 12; m++) {
    const mStr = String(m).padStart(2, '0')
    monthlyByMonth[mStr] = { carbs: 0, protein: 0, fat: 0, calories: 0 }
  }
  allDietLogs.forEach(row => {
    if (!row.log_date) return
    const mStr = row.log_date.split('-')[1]
    monthlyByMonth[mStr].carbs += row.carbs || 0
    monthlyByMonth[mStr].protein += row.protein || 0
    monthlyByMonth[mStr].fat += row.fat || 0
    monthlyByMonth[mStr].calories += row.calories || 0
  })

  const DietSummary = ({ data, label }) => (
    <div style={{ background: '#F9F9F9', borderRadius: '12px', padding: '12px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: '700', color: '#1A1A2E' }}>{label}</span>
        <span style={{ fontSize: '13px', fontWeight: '700', color: '#E84747' }}>{Math.round(data.calories)}kcal</span>
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        {[
          { label: '탄', val: data.carbs, color: '#4472C4' },
          { label: '단', val: data.protein, color: '#E84747' },
          { label: '지', val: data.fat, color: '#E8A020' },
        ].map(({ label: l, val, color }) => (
          <div key={l} style={{ flex: 1, background: '#FFF', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
            <p style={{ fontSize: '11px', color: '#888', margin: '0 0 2px' }}>{l}수화물</p>
            <p style={{ fontSize: '14px', fontWeight: '700', color, margin: 0 }}>{Math.round(val)}g</p>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div>
      {/* 상단 목표 달성률 카드 - 계산기 저장값 있을 때만 표시 */}
      {macro && (
        <div style={{ ...S.card, background: '#1A1A2E', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ fontSize: '14px', fontWeight: '700', color: '#E8C547', margin: 0 }}>🎯 오늘 목표 달성률</p>
            <span style={{ fontSize: '12px', color: '#888' }}>목표 {macro.target}kcal</span>
          </div>
          <ProgressBar label="칼로리" current={todayCalories} target={macro.target} color="#E8C547" />
          <ProgressBar label="탄수화물" current={todayCarbs} target={macro.carbs} color="#4472C4" />
          <ProgressBar label="단백질" current={todayProtein} target={macro.protein} color="#E84747" />
          <ProgressBar label="지방" current={todayFat} target={macro.fat} color="#E8A020" />
        </div>
      )}

      {/* 탭 */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        {['record', 'calculator', 'stats'].map((t, i) => (
          <button key={t} style={{ flex: 1, padding: '9px', borderRadius: '8px', border: dietTab === t ? 'none' : '1px solid #444', background: dietTab === t ? '#E8C547' : 'transparent', color: dietTab === t ? '#1A1A2E' : '#888', fontSize: '12px', fontWeight: dietTab === t ? '700' : '400', cursor: 'pointer' }} onClick={() => setDietTab(t)}>
            {['식단 기록', '칼로리 계산기', '통계'][i]}
          </button>
        ))}
      </div>

      {/* 칼로리 계산기 */}
      {dietTab === 'calculator' && (
        <div style={S.card}>
          <p style={S.cardTitle}>🧮 탄단지 목표 계산기</p>
          {macro && (
            <div style={{ background: '#E8F4E8', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '12px', color: '#2E9E3B', fontWeight: '700' }}>
              ✅ 저장된 목표: {macro.target}kcal · 탄 {macro.carbs}g · 단 {macro.protein}g · 지 {macro.fat}g
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <select style={{ ...S.input, padding: '10px' }} value={goal} onChange={e => setGoal(e.target.value)}>
              <option value="다이어트">다이어트</option>
              <option value="벌크업">벌크업</option>
            </select>
            <select style={{ ...S.input, padding: '10px' }} value={gender} onChange={e => setGender(e.target.value)}>
              <option value="여성">여성</option>
              <option value="남성">남성</option>
            </select>
            <input style={{ ...S.input, padding: '10px' }} type="number" placeholder="체중 (kg)" value={weight} onChange={e => setWeight(e.target.value)} />
            <input style={{ ...S.input, padding: '10px' }} type="number" placeholder="골격근량 (kg)" value={muscle} onChange={e => setMuscle(e.target.value)} />
          </div>
          <select style={{ ...S.input, padding: '10px', marginBottom: '8px' }} value={activity} onChange={e => setActivity(e.target.value)}>
            <option value="가벼운 운동 (주 2~3회)">가벼운 운동 (주 2~3회)</option>
            <option value="보통 운동 (주 4~5회)">보통 운동 (주 4~5회)</option>
            <option value="고강도 운동 (주 6회+)">고강도 운동 (주 6회+)</option>
          </select>
          <select style={{ ...S.input, padding: '10px', marginBottom: '12px' }} value={intensity} onChange={e => setIntensity(e.target.value)}>
            <option value="완만">완만 {goal === '벌크업' ? '(+300kcal)' : '(-300kcal)'}</option>
            <option value="일반">일반 {goal === '벌크업' ? '(+400kcal)' : '(-500kcal)'}</option>
            <option value="공격적">공격적 {goal === '벌크업' ? '(+500kcal)' : '(-700kcal)'}</option>
          </select>
          <button style={S.btnPrimary} onClick={calculate}>계산 및 저장</button>

          {macro && (
            <div style={{ marginTop: '16px', background: '#1A1A2E', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                {[
                  { label: 'BMR', val: macro.bmr + 'kcal' },
                  { label: 'TDEE', val: macro.tdee + 'kcal' },
                  { label: '목표 칼로리', val: macro.target + 'kcal', highlight: true },
                ].map(({ label, val, highlight }) => (
                  <div key={label} style={{ background: '#2A2A4E', borderRadius: '8px', padding: '10px', textAlign: 'center', gridColumn: highlight ? 'span 2' : 'span 1' }}>
                    <p style={{ fontSize: '11px', color: '#888', margin: '0 0 4px' }}>{label}</p>
                    <p style={{ fontSize: highlight ? '20px' : '16px', fontWeight: '700', color: '#E8C547', margin: 0 }}>{val}</p>
                  </div>
                ))}
              </div>

              <p style={{ fontSize: '12px', color: '#888', margin: '0 0 8px' }}>탄단지 목표 수동 조정</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                {[
                  { label: '칼로리', field: 'target', unit: 'kcal', color: '#E8C547' },
                  { label: '탄수화물', field: 'carbs', unit: 'g', color: '#4472C4' },
                  { label: '단백질', field: 'protein', unit: 'g', color: '#E84747' },
                  { label: '지방', field: 'fat', unit: 'g', color: '#E8A020' },
                ].map(({ label, field, unit, color }) => (
                  <div key={field} style={{ background: '#2A2A4E', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                    <p style={{ fontSize: '10px', color: '#888', margin: '0 0 6px' }}>{label}</p>
                    <input
                      type="number"
                      value={macro[field]}
                      onChange={e => {
                        const updated = { ...macro, [field]: parseInt(e.target.value) || 0 }
                        setMacro(updated)
                        localStorage.setItem(`macro_result_${user.id}`, JSON.stringify(updated))
                      }}
                      style={{ width: '100%', background: '#1A1A2E', border: '1px solid #444', borderRadius: '6px', color, fontSize: '14px', fontWeight: '700', textAlign: 'center', padding: '4px 0', boxSizing: 'border-box' }}
                    />
                    <p style={{ fontSize: '10px', color: '#666', margin: '4px 0 0' }}>{unit}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '6px', padding: '10px 8px', background: '#1A1A2E', borderRadius: '8px', marginTop: '8px' }}>
            <span style={{ flex: 1.2, fontSize: '13px', fontWeight: '700', color: '#E8C547' }}>합계</span>
            <span style={{ flex: 1, fontSize: '13px', fontWeight: '700', color: '#4472C4', textAlign: 'center' }}>{Math.round(todayCarbs)}g</span>
            <span style={{ flex: 1, fontSize: '13px', fontWeight: '700', color: '#E84747', textAlign: 'center' }}>{Math.round(todayProtein)}g</span>
            <span style={{ flex: 1, fontSize: '13px', fontWeight: '700', color: '#E8A020', textAlign: 'center' }}>{Math.round(todayFat)}g</span>
            <span style={{ flex: 1, fontSize: '13px', fontWeight: '700', color: '#FFF', textAlign: 'center' }}>{Math.round(todayCalories)}kcal</span>
          </div>
        </div>
      )}

      {/* 통계 */}
      {dietTab === 'stats' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            {[
              { label: '오늘', val: sumField(allDietLogs.filter(r => r.log_date === new Date().toISOString().split('T')[0]), 'calories'), color: '#4472C4' },
              { label: '이번 주', val: sumField(thisWeekLogs, 'calories'), color: '#2E9E3B' },
              { label: '이번 달', val: sumField(thisMonthLogs, 'calories'), color: '#E8A020' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ background: '#FFF', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                <p style={{ fontSize: '11px', color: '#888', margin: '0 0 4px' }}>{label}</p>
                <p style={{ fontSize: '14px', fontWeight: '700', color, margin: 0 }}>{Math.round(val)}kcal</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            {['daily', 'weekly', 'monthly'].map((t, i) => (
              <button key={t} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: statsTab === t ? 'none' : '1px solid #444', background: statsTab === t ? '#E8C547' : 'transparent', color: statsTab === t ? '#1A1A2E' : '#888', fontSize: '12px', fontWeight: statsTab === t ? '700' : '400', cursor: 'pointer' }} onClick={() => setStatsTab(t)}>
                {['일간', '주간', '월간'][i]}
              </button>
            ))}
          </div>

          {statsTab === 'daily' && (
            <div style={S.card}>
              <p style={S.cardTitle}>📅 일별 식단</p>
              {allDays.length === 0 ? (
                <p style={{ color: '#888', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>식단 기록이 없습니다</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {allDays.map(date => {
                    const d = byDay[date]
                    const isToday = date === new Date().toISOString().split('T')[0]
                    const dayNum = date.split('-')[2]
                    const monthNum = date.split('-')[1]
                    return (
                      <div key={date} style={{ background: isToday ? '#1A1A2E' : '#F9F9F9', borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
                        <p style={{ fontSize: '12px', fontWeight: '700', color: isToday ? '#E8C547' : '#1A1A2E', margin: '0 0 4px' }}>{monthNum}/{dayNum}</p>
                        <p style={{ fontSize: '12px', fontWeight: '700', color: isToday ? '#FFF' : '#E84747', margin: '0 0 4px' }}>{Math.round(d.calories)}kcal</p>
                        <p style={{ fontSize: '10px', color: isToday ? '#AAA' : '#888', margin: 0 }}>탄{Math.round(d.carbs)} 단{Math.round(d.protein)} 지{Math.round(d.fat)}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {statsTab === 'weekly' && (
            <div style={S.card}>
              <p style={S.cardTitle}>📊 주차별 식단 ({year}년 {month}월)</p>
              {weeklyByWeek.every(w => w.calories === 0) ? (
                <p style={{ color: '#888', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>이번 달 식단 기록이 없습니다</p>
              ) : weeklyByWeek.map((w
, wk) => w.calories === 0 ? null : <DietSummary key={wk} data={w} label={`${wk + 1}주차`} />)}
            </div>
          )}

          {statsTab === 'monthly' && (
            <div style={S.card}>
              <p style={S.cardTitle}>📆 월별 식단 ({year}년)</p>
              {Object.entries(monthlyByMonth).filter(([, d]) => d.calories > 0).length === 0 ? (
                <p style={{ color: '#888', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>식단 기록이 없습니다</p>
              ) : Object.entries(monthlyByMonth).filter(([, d]) => d.calories > 0).map(([mStr, d]) => (
                <DietSummary key={mStr} data={d} label={`${parseInt(mStr)}월`} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
import React, { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { PARTS, PART_COLORS, S, THEME, calcWeightCalories } from './utils'
import DatePicker from './DatePicker'

const CameraIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
)

export default function WorkoutLog({ user, selectedDate, setSelectedDate, exercises, setExercises, onUpdate, tableOverride, trainerIdField, weight, muscle }) {
  const TABLE = tableOverride || 'workout_logs'
  const ID_FIELD = trainerIdField || 'member_id'

  const [showCardioModal, setShowCardioModal] = useState(false)
  const [cardioName, setCardioName] = useState('')
  const [cardioCalories, setCardioCalories] = useState('')

  // 자동 로드: selectedDate / user.id 변경 시
  useEffect(() => {
    if (user?.id && selectedDate) {
      loadExercises(user.id, selectedDate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, selectedDate])

  const loadExercises = async (uid, date) => {
    const { data } = await supabase.from(TABLE).select('*').eq(ID_FIELD, uid).eq('log_date', date).order('slot').order('id')
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

  const addExercise = () => {
    const newSlot = exercises.length > 0 ? Math.max(...exercises.map(e => e.slot)) + 1 : 1
    setExercises([...exercises, { slot: newSlot, exercise_type: 'weight', body_part: '', exercise_name: '', memo: '', description: '', sets: [{ id: null, weight: '', reps: '', media_url: '' }] }])
  }

  const addSet = (exIdx) => {
    const u = JSON.parse(JSON.stringify(exercises))
    u[exIdx].sets.push({ id: null, weight: '', reps: '', media_url: '' })
    setExercises(u)
  }

  const removeSet = async (exIdx, setIdx) => {
    const u = JSON.parse(JSON.stringify(exercises))
    const s = u[exIdx].sets[setIdx]
    if (s.id) await supabase.from(TABLE).delete().eq('id', s.id)
    u[exIdx].sets.splice(setIdx, 1)
    if (u[exIdx].sets.length === 0) u.splice(exIdx, 1)
    setExercises(u)
    if (onUpdate) await onUpdate()
  }

  const removeExercise = async (exIdx) => {
    const ex = exercises[exIdx]
    if (ex.exercise_type === 'cardio') {
      if (ex.sets[0]?.id) await supabase.from(TABLE).delete().eq('id', ex.sets[0].id)
    } else {
      for (const s of ex.sets) { if (s.id) await supabase.from(TABLE).delete().eq('id', s.id) }
    }
    const u = JSON.parse(JSON.stringify(exercises))
    u.splice(exIdx, 1)
    setExercises(u)
    if (onUpdate) await onUpdate()
  }

  const updateExField = (exIdx, field, value) => {
    const u = JSON.parse(JSON.stringify(exercises))
    u[exIdx][field] = value
    setExercises(u)
  }

  const updateSetField = (exIdx, setIdx, field, value) => {
    const u = JSON.parse(JSON.stringify(exercises))
    u[exIdx].sets[setIdx][field] = value
    setExercises(u)
  }

  const saveAllSets = async () => {
    const uid = user.id
    let savedCount = 0
    const errors = []
    const updated = JSON.parse(JSON.stringify(exercises))

    for (let exIdx = 0; exIdx < updated.length; exIdx++) {
      const ex = updated[exIdx]
      if (ex.exercise_type === 'cardio') continue

      if (!ex.body_part || !ex.exercise_name) continue
      for (let setIdx = 0; setIdx < ex.sets.length; setIdx++) {
        const set = ex.sets[setIdx]
        if (set.weight === '' || set.reps === '') continue
        const w = parseFloat(set.weight)
        const r = parseInt(set.reps)
        if (isNaN(w) || isNaN(r)) continue

        const payload = {
          [ID_FIELD]: uid,
          log_date: selectedDate,
          slot: ex.slot,
          exercise_type: 'weight',
          body_part: ex.body_part,
          exercise_name: ex.exercise_name,
          weight: w,
          sets: 1,
          reps: r,
          volume: w * r,
          memo: ex.memo || '',
          description: ex.description || '',
          media_url: ex.sets[0]?.media_url || null
        }

        if (set.id) {
          const { error: updErr } = await supabase.from(TABLE).update(payload).eq('id', set.id)
          if (updErr) { errors.push(`UPDATE 실패: ${updErr.message}`); continue }
          savedCount++
        } else {
          const { data, error } = await supabase.from(TABLE).insert(payload).select().single()
          if (error) { errors.push(`INSERT 실패: ${error.message}`); continue }
          if (data) {
            updated[exIdx].sets[setIdx].id = data.id
            updated[exIdx].sets[setIdx].volume = data.volume
            savedCount++
          }
        }
      }
    }

    setExercises(updated)
    if (errors.length > 0) {
      alert(`⚠️ 저장 실패\n\n${errors.join('\n')}`)
    } else {
      alert(`✅ ${savedCount}개 세트 저장 완료!`)
    }
    
    // 저장 후 DB에서 다시 로드해서 동기화 (중복 방지)
    await loadExercises(uid, selectedDate)
    if (onUpdate) await onUpdate()
  }

  const saveCardio = async () => {
    if (!cardioCalories) { alert('소비 칼로리를 입력해주세요.'); return }
    const cal = parseInt(cardioCalories) || 0
    if (cal <= 0) { alert('칼로리는 0보다 커야 합니다.'); return }

    const newSlot = exercises.length > 0 ? Math.max(...exercises.map(e => e.slot)) + 1 : 1

    const payload = {
      [ID_FIELD]: user.id,
      log_date: selectedDate,
      slot: newSlot,
      exercise_type: 'cardio',
      cardio_name: cardioName || '유산소',
      calories_burned: cal,
      body_part: '유산소',
      exercise_name: cardioName || '유산소',
      weight: 0,
      sets: 1,
      reps: 0,
      volume: 0,
    }

    const { data, error } = await supabase.from(TABLE).insert(payload).select().single()
    if (error) { alert('유산소 저장 실패: ' + error.message); return }

    setExercises([...exercises, {
      slot: newSlot,
      exercise_type: 'cardio',
      body_part: '유산소',
      exercise_name: cardioName || '유산소',
      cardio_name: cardioName || '유산소',
      calories_burned: cal,
      memo: '',
      description: '',
      sets: [{ id: data.id, weight: 0, reps: 0 }]
    }])

    setCardioName('')
    setCardioCalories('')
    setShowCardioModal(false)
    if (onUpdate) await onUpdate()
  }

  const uploadMedia = async (exIdx, file) => {
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const fileName = `${user.id}/${selectedDate}_${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('workout-media').upload(fileName, file, { upsert: true })
      if (uploadError) { alert('업로드 실패: ' + uploadError.message); return }
      const { data: urlData } = supabase.storage.from('workout-media').getPublicUrl(fileName)
      const u = JSON.parse(JSON.stringify(exercises))
      u[exIdx].sets[0].media_url = urlData.publicUrl
      setExercises(u)
    } catch (e) {
      alert('업로드 중 오류: ' + e.message)
    }
  }

  const getSetVolume = (set) => {
    const w = parseFloat(set.weight); const r = parseInt(set.reps)
    if (isNaN(w) || isNaN(r) || set.weight === '' || set.reps === '') return '—'
    return (w * r).toLocaleString() + 'kg'
  }

  const weightExercises = exercises.filter(ex => ex.exercise_type !== 'cardio')
  const cardioExercises = exercises.filter(ex => ex.exercise_type === 'cardio')

  const dailyTotal = weightExercises.reduce((sum, ex) => sum + ex.sets.reduce((s2, s) => {
    const w = parseFloat(s.weight); const r = parseInt(s.reps)
    return s2 + (!isNaN(w) && !isNaN(r) ? w * r : 0)
  }, 0), 0)

  const totalSets = weightExercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.weight !== '' && s.reps !== '').length, 0)

  const weightCalories = calcWeightCalories({ volume: dailyTotal, totalSets, weight, muscle })
  const cardioCaloriesTotal = cardioExercises.reduce((s, ex) => s + (ex.calories_burned || 0), 0)
  const totalBurnedCalories = weightCalories + cardioCaloriesTotal

  const inputBase = {
    width: '100%',
    padding: '8px 9px',
    borderRadius: '6px',
    border: `0.5px solid ${THEME.border}`,
    fontSize: '12px',
    background: '#FFF',
    boxSizing: 'border-box',
    fontFamily: 'inherit'
  }

  return (
    <div>
      {showCardioModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#FFF', borderRadius: '14px', padding: '20px', width: '100%', maxWidth: '320px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <p style={{ fontSize: '15px', fontWeight: '600', color: '#FF6B6B', margin: 0 }}>🏃 유산소 추가</p>
              <button onClick={() => { setShowCardioModal(false); setCardioName(''); setCardioCalories('') }} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: THEME.textSub }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <p style={{ fontSize: '11px', color: THEME.textSub, margin: '0 0 4px' }}>종류 (선택)</p>
                <input
                  type="text"
                  placeholder="예: 러닝, 사이클, 수영"
                  value={cardioName}
                  onChange={e => setCardioName(e.target.value)}
                  style={{ width: '100%', padding: '10px', border: `0.5px solid ${THEME.border}`, borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
              <div>
                <p style={{ fontSize: '11px', color: '#FF6B6B', margin: '0 0 4px', fontWeight: '600' }}>소비 칼로리 (kcal) *</p>
                <input
                  type="number"
                  placeholder="런닝머신/스마트워치 표시값"
                  value={cardioCalories}
                  onChange={e => setCardioCalories(e.target.value)}
                  style={{ width: '100%', padding: '10px', border: `1px solid #FF6B6B`, borderRadius: '8px', fontSize: '14px', textAlign: 'center', fontWeight: '600', color: '#FF6B6B', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
              <button onClick={saveCardio} style={{ background: '#FF6B6B', color: '#FFF', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginTop: '4px' }}>+ 추가</button>
            </div>
          </div>
        </div>
      )}

      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <p style={{ ...S.cardTitle, margin: 0 }}>오늘 운동 요약</p>
        </div>

        {(weightExercises.filter(ex => ex.exercise_name).length > 0 || cardioExercises.length > 0) && (
          <div style={{ background: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.85)', margin: '0 0 2px' }}>🔥 오늘 소비 칼로리</p>
                <p style={{ fontSize: '22px', fontWeight: '700', color: '#FFF', margin: 0 }}>
                  {totalBurnedCalories.toLocaleString()} <span style={{ fontSize: '12px', opacity: 0.85 }}>kcal</span>
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: 1.6 }}>
                  💪 웨이트 {weightCalories}<br/>
                  🏃 유산소 {cardioCaloriesTotal}
                </p>
              </div>
            </div>
          </div>
        )}

        {weightExercises.filter(ex => ex.exercise_name).length === 0 && cardioExercises.length === 0 ? (
          <p style={{ color: THEME.textSub, fontSize: '13px', textAlign: 'center', padding: '10px 0' }}>운동을 기록해주세요</p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {weightExercises.filter(ex => ex.exercise_name).map((ex, i) => {
                const vol = ex.sets.reduce((sum, s) => { const w = parseFloat(s.weight); const r = parseInt(s.reps); return sum + (!isNaN(w) && !isNaN(r) ? w * r : 0) }, 0)
                return (
                  <div key={`w-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: '#F8FAFC', borderRadius: '6px', border: `0.5px solid ${THEME.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: '8px', background: PART_COLORS[ex.body_part] || '#888', color: '#FFF', padding: '1px 5px', borderRadius: '6px', flexShrink: 0 }}>{ex.body_part}</span>
                      <span style={{ fontSize: '10px', fontWeight: '600', color: THEME.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.exercise_name}</span>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: THEME.primary, flexShrink: 0 }}>{vol.toLocaleString()}</span>
                  </div>
                )
              })}

              {cardioExercises.map((ex, i) => (
                <div key={`c-${i}`} onClick={() => {
                  if (window.confirm(`"${ex.cardio_name}" 유산소 기록을 삭제할까요?`)) {
                    const idx = exercises.findIndex(e => e.slot === ex.slot && e.exercise_type === 'cardio')
                    if (idx >= 0) removeExercise(idx)
                  }
                }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: '#FFF1EE', borderRadius: '6px', border: '0.5px solid #FFCFC5', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: '11px', flexShrink: 0 }}>🏃</span>
                    <span style={{ fontSize: '10px', fontWeight: '600', color: '#FF6B6B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.cardio_name || '유산소'}</span>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: '#FF6B6B', flexShrink: 0 }}>{ex.calories_burned}kcal</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowCardioModal(true)}
              style={{ background: '#FFF', border: '0.5px dashed #FF6B6B', color: '#FF6B6B', borderRadius: '8px', padding: '8px', fontSize: '11px', fontWeight: '500', cursor: 'pointer', marginTop: '8px', width: '100%' }}
            >+ 🏃 유산소 추가</button>

            {dailyTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', marginTop: '4px', borderTop: `0.5px solid ${THEME.border}` }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: THEME.text }}>총 볼륨</span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: THEME.primary }}>{dailyTotal.toLocaleString()}kg</span>
              </div>
            )}
          </>
        )}

        {weightExercises.filter(ex => ex.exercise_name).length === 0 && cardioExercises.length === 0 && (
          <button
            onClick={() => setShowCardioModal(true)}
            style={{ background: '#FFF', border: '0.5px dashed #FF6B6B', color: '#FF6B6B', borderRadius: '8px', padding: '8px', fontSize: '11px', fontWeight: '500', cursor: 'pointer', marginTop: '8px', width: '100%' }}
          >+ 🏃 유산소 추가</button>
        )}
      </div>

      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '12px' }}>
          <p style={{ ...S.cardTitle, margin: 0, flexShrink: 0 }}>운동 기록</p>
          <div style={{ flex: 1, maxWidth: '260px' }}>
            <DatePicker value={selectedDate} onChange={setSelectedDate} />
          </div>
        </div>

        {weightExercises.map((ex, exIdx) => {
          const realIdx = exercises.indexOf(ex)
          return (
            <div key={exIdx} style={{ background: '#FAFAF7', border: `0.5px solid ${THEME.border}`, borderRadius: '12px', padding: '12px', marginBottom: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 32px', gap: '6px', marginBottom: '7px' }}>
                <select style={inputBase} value={ex.body_part} onChange={e => updateExField(realIdx, 'body_part', e.target.value)}>
                  <option value="">부위</option>
                  {PARTS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <input style={inputBase} placeholder="운동명" value={ex.exercise_name} onChange={e => updateExField(realIdx, 'exercise_name', e.target.value)} />
                <button
                  style={{ background: '#FBE7E7', color: '#C53030', border: 'none', borderRadius: '6px', padding: '4px 0', cursor: 'pointer', fontSize: '11px' }}
                  onClick={() => removeExercise(realIdx)}
                >✕</button>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <input
                  style={{ ...inputBase, color: THEME.textSub }}
                  placeholder="특이사항 (예: 무릎 불편)"
                  value={ex.memo}
                  onChange={e => updateExField(realIdx, 'memo', e.target.value)}
                />
              </div>

              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 50px 24px', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: THEME.textSub, textAlign: 'center', fontWeight: '500' }}>세트</span>
                  <span style={{ fontSize: '11px', color: THEME.textSub, textAlign: 'center', fontWeight: '500' }}>무게(kg)</span>
                  <span style={{ fontSize: '11px', color: THEME.textSub, textAlign: 'center', fontWeight: '500' }}>횟수</span>
                  <span style={{ fontSize: '10px', color: THEME.textSub, textAlign: 'center', fontWeight: '500' }}>볼륨</span>
                  <span></span>
                </div>
                {ex.sets.map((set, setIdx) => (
                  <div key={setIdx} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 50px 24px', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: THEME.textSub, textAlign: 'center', fontWeight: '500' }}>{setIdx + 1}</span>
                    <input
                      style={{ padding: '8px 6px', borderRadius: '6px', border: `0.5px solid ${THEME.border}`, fontSize: '14px', textAlign: 'center', width: '100%', boxSizing: 'border-box', background: '#FFF', fontWeight: '500' }}
                      type="number" placeholder="0"
                      inputMode="decimal"
                      value={set.weight}
                      onChange={e => updateSetField(realIdx, setIdx, 'weight', e.target.value)}
                    />
                    <input
                      style={{ padding: '8px 6px', borderRadius: '6px', border: `0.5px solid ${THEME.border}`, fontSize: '14px', textAlign: 'center', width: '100%', boxSizing: 'border-box', background: '#FFF', fontWeight: '500' }}
                      type="number" placeholder="0"
                      inputMode="numeric"
                      value={set.reps}
                      onChange={e => updateSetField(realIdx, setIdx, 'reps', e.target.value)}
                    />
                    <span style={{ fontSize: '11px', fontWeight: '500', color: THEME.primary, textAlign: 'center' }}>{getSetVolume(set)}</span>
                    <button
                      style={{ background: '#F0EFEC', color: '#888', border: 'none', borderRadius: '4px', padding: '4px 0', cursor: 'pointer', fontSize: '12px' }}
                      onClick={() => removeSet(realIdx, setIdx)}
                    >−</button>
                  </div>
                ))}
                <button
                  style={{ background: 'transparent', border: `0.5px dashed ${THEME.primary}`, borderRadius: '6px', padding: '8px', fontSize: '12px', color: THEME.primary, width: '100%', cursor: 'pointer', marginTop: '4px', fontWeight: '500' }}
                  onClick={() => addSet(realIdx)}
                >＋ 세트 추가</button>
              </div>

              <div style={{ borderTop: `0.5px solid ${THEME.border}`, marginTop: '12px', paddingTop: '10px' }}>
                <textarea
                  style={{
                    width: '100%', padding: '8px 9px', borderRadius: '6px', border: `0.5px solid ${THEME.border}`,
                    fontSize: '12px', color: THEME.text, background: '#FFF', resize: 'none', height: '50px',
                    boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: '1.5', marginBottom: '8px'
                  }}
                  placeholder="운동 설명 (예: 등 넓게 잡고 천천히)"
                  value={ex.description || ''}
                  onChange={e => updateExField(realIdx, 'description', e.target.value)}
                />

                {ex.sets[0]?.media_url ? (
                  <div>
                    <div style={{ borderRadius: '8px', overflow: 'hidden', maxHeight: '240px', border: `0.5px solid ${THEME.border}`, marginBottom: '6px' }}>
                      {ex.sets[0].media_url.match(/\.(mp4|mov|avi|webm)$/i) ? (
                        <video src={ex.sets[0].media_url} controls playsInline style={{ width: '100%', display: 'block' }} />
                      ) : (
                        <img src={ex.sets[0].media_url} alt="운동 사진" style={{ width: '100%', display: 'block' }} />
                      )}
                    </div>
                    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: THEME.cardAlt, borderRadius: '6px', padding: '8px', border: `0.5px solid ${THEME.border}` }}>
                      <CameraIcon />
                      <span style={{ fontSize: '11px', color: THEME.textSub }}>다른 사진/영상으로 바꾸기</span>
                      <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={e => e.target.files[0] && uploadMedia(realIdx, e.target.files[0])} />
                    </label>
                  </div>
                ) : (
                  <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#FFF', borderRadius: '6px', padding: '14px', border: `1px dashed ${THEME.border}`, color: THEME.textSub }}>
                    <CameraIcon />
                    <span style={{ fontSize: '12px' }}>사진/영상 추가</span>
                    <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={e => e.target.files[0] && uploadMedia(realIdx, e.target.files[0])} />
                  </label>
                )}
              </div>
            </div>
          )
        })}

        <button style={S.addExBtn} onClick={addExercise}>＋ 종목 추가</button>
        <button style={{ ...S.btnPrimary, marginTop: '12px', fontSize: '15px' }} onClick={saveAllSets}>💾 전체 저장</button>
      </div>
    </div>
  )
}
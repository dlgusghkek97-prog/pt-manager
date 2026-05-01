import React, { useState } from 'react'
import { supabase } from './supabase'
import { PARTS, PART_COLORS, S, THEME } from './utils'

export default function WorkoutLog({ user, selectedDate, setSelectedDate, exercises, setExercises, onUpdate, tableOverride, trainerIdField }) {
  const TABLE = tableOverride || 'workout_logs'
  const ID_FIELD = trainerIdField || 'member_id'

  const loadExercises = async (uid, date) => {
    const { data } = await supabase.from(TABLE).select('*').eq(ID_FIELD, uid).eq('log_date', date).order('slot').order('id')
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

  const addExercise = () => {
    const newSlot = exercises.length > 0 ? Math.max(...exercises.map(e => e.slot)) + 1 : 1
    setExercises([...exercises, { slot: newSlot, body_part: '', exercise_name: '', memo: '', sets: [{ id: null, weight: '', reps: '', media_url: '' }] }])
  }

  const addSet = (exIdx) => {
    const u = [...exercises]
    u[exIdx].sets.push({ id: null, weight: '', reps: '', media_url: '' })
    setExercises(u)
  }

  const removeSet = async (exIdx, setIdx) => {
    const u = [...exercises]
    const s = u[exIdx].sets[setIdx]
    if (s.id) await supabase.from(TABLE).delete().eq('id', s.id)
    u[exIdx].sets.splice(setIdx, 1)
    if (u[exIdx].sets.length === 0) u.splice(exIdx, 1)
    setExercises(u)
    if (onUpdate) onUpdate()
  }

  const removeExercise = async (exIdx) => {
    const ex = exercises[exIdx]
    for (const s of ex.sets) { if (s.id) await supabase.from(TABLE).delete().eq('id', s.id) }
    const u = [...exercises]; u.splice(exIdx, 1); setExercises(u)
    if (onUpdate) onUpdate()
  }

  const updateExField = (exIdx, field, value) => {
    const u = [...exercises]; u[exIdx][field] = value; setExercises(u)
  }

  const updateSetField = (exIdx, setIdx, field, value) => {
    const u = [...exercises]; u[exIdx].sets[setIdx][field] = value; setExercises(u)
  }

  const saveAllSets = async () => {
    const uid = user.id
    let savedCount = 0
    const updated = JSON.parse(JSON.stringify(exercises))

    for (let exIdx = 0; exIdx < updated.length; exIdx++) {
      const ex = updated[exIdx]
      if (!ex.body_part || !ex.exercise_name) continue
      for (let setIdx = 0; setIdx < ex.sets.length; setIdx++) {
        const set = ex.sets[setIdx]
        if (!set.weight || !set.reps) continue
        const payload = {
          [ID_FIELD]: uid,
          log_date: selectedDate,
          slot: ex.slot,
          body_part: ex.body_part,
          exercise_name: ex.exercise_name,
          weight: parseFloat(set.weight),
          sets: 1,
          reps: parseInt(set.reps),
          volume: parseFloat(set.weight) * parseInt(set.reps),
          memo: ex.memo || '',
          media_url: set.media_url || null
        }
        if (set.id) {
          await supabase.from(TABLE).update(payload).eq('id', set.id)
          savedCount++
        } else {
          const { data, error } = await supabase.from(TABLE).insert(payload).select().single()
          if (!error && data) {
            updated[exIdx].sets[setIdx].id = data.id
            updated[exIdx].sets[setIdx].volume = data.volume
            savedCount++
          }
        }
      }
    }
    setExercises(updated)
    if (onUpdate) await onUpdate()
    alert(`✅ ${savedCount}개 세트 저장 완료!`)
  }

  const uploadMedia = async (exIdx, setIdx, file) => {
    const ext = file.name.split('.').pop()
    const fileName = `${user.id}/${selectedDate}_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('workout-media').upload(fileName, file)
    if (!error) {
      const { data: urlData } = supabase.storage.from('workout-media').getPublicUrl(fileName)
      const u = [...exercises]
      u[exIdx].sets[setIdx].media_url = urlData.publicUrl
      setExercises(u)
    }
  }

  const getSetVolume = (set) => (!set.weight || !set.reps) ? '-' : (parseFloat(set.weight) * parseInt(set.reps)).toLocaleString() + 'kg'
  const dailyTotal = exercises.reduce((sum, ex) => sum + ex.sets.reduce((s2, s) => s2 + (s.weight && s.reps ? parseFloat(s.weight) * parseInt(s.reps) : 0), 0), 0)

  return (
    <div>
      {/* 오늘 요약 */}
      <div style={S.card}>
        <p style={S.cardTitle}>📅 오늘 운동 요약</p>
        {exercises.filter(ex => ex.exercise_name).length === 0 ? (
          <p style={{ color: THEME.textSub, fontSize: '13px', textAlign: 'center', padding: '10px 0' }}>운동을 기록해주세요</p>
        ) : exercises.filter(ex => ex.exercise_name).map((ex, i) => {
          const vol = ex.sets.reduce((sum, s) => sum + (s.weight && s.reps ? parseFloat(s.weight) * parseInt(s.reps) : 0), 0)
          return (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${THEME.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', background: PART_COLORS[ex.body_part] || '#888', color: '#FFF', padding: '2px 8px', borderRadius: '10px' }}>{ex.body_part}</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: THEME.text }}>{ex.exercise_name}</span>
                <span style={{ fontSize: '11px', color: THEME.textSub }}>{ex.sets.filter(s => s.weight && s.reps).length}세트</span>
              </div>
              <span style={{ fontSize: '13px', fontWeight: '700', color: THEME.primary, flexShrink: 0 }}>{vol.toLocaleString()}kg</span>
            </div>
          )
        })}
        {dailyTotal > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: THEME.text }}>💪 총 볼륨</span>
            <span style={{ fontSize: '14px', fontWeight: '700', color: THEME.primary }}>{dailyTotal.toLocaleString()}kg</span>
          </div>
        )}
      </div>

      {/* 운동 기록 */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <p style={{ ...S.cardTitle, margin: 0 }}>🏋️ 운동 기록</p>
          <input type="date" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); loadExercises(user.id, e.target.value) }} style={S.dateInput} />
        </div>

        {exercises.map((ex, exIdx) => (
          <div key={exIdx} style={{ ...S.exBox, marginBottom: '12px' }}>

            {/* 1행: 부위 + 운동명(절반) + 특이사항(절반) + 삭제 */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', marginBottom: '8px' }}>
              {/* 부위 */}
              <select
                style={{ flex: '0 0 64px', padding: '6px 4px', borderRadius: '6px', border: `1px solid ${THEME.border}`, fontSize: '11px', background: '#FFF' }}
                value={ex.body_part}
                onChange={e => updateExField(exIdx, 'body_part', e.target.value)}
              >
                <option value="">부위</option>
                {PARTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>

              {/* 운동명 (절반) */}
              <input
                style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', border: `1px solid ${THEME.border}`, fontSize: '11px' }}
                placeholder="운동명"
                value={ex.exercise_name}
                onChange={e => updateExField(exIdx, 'exercise_name', e.target.value)}
              />

              {/* 특이사항 (절반) */}
              <input
                style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', border: `1px solid ${THEME.border}`, fontSize: '11px', color: THEME.textSub, background: '#FFF' }}
                placeholder="특이사항 (예: 무릎 불편)"
                value={ex.memo}
                onChange={e => updateExField(exIdx, 'memo', e.target.value)}
              />

              <button style={S.delExBtn} onClick={() => removeExercise(exIdx)}>✕</button>
            </div>

            {/* 2행: 세트 테이블(절반) + 운동설명+사진(절반) */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>

              {/* 왼쪽: 세트 목록 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* 헤더 */}
                <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 1fr 1fr 24px', gap: '4px', marginBottom: '4px' }}>
                  {['#', '무게', '횟수', '볼륨', ''].map((h, i) => (
                    <span key={i} style={{ fontSize: '10px', color: THEME.textSub, textAlign: 'center' }}>{h}</span>
                  ))}
                </div>

                {ex.sets.map((set, setIdx) => (
                  <div key={setIdx} style={{ display: 'grid', gridTemplateColumns: '20px 1fr 1fr 1fr 24px', gap: '4px', marginBottom: '4px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: THEME.textSub, textAlign: 'center' }}>{setIdx + 1}</span>
                    <input style={{ ...S.numInput, fontSize: '12px', padding: '5px 2px' }} type="number" placeholder="0" value={set.weight} onChange={e => updateSetField(exIdx, setIdx, 'weight', e.target.value)} />
                    <input style={{ ...S.numInput, fontSize: '12px', padding: '5px 2px' }} type="number" placeholder="0" value={set.reps} onChange={e => updateSetField(exIdx, setIdx, 'reps', e.target.value)} />
                    <span style={{ fontSize: '11px', fontWeight: '700', color: THEME.primary, textAlign: 'center' }}>{getSetVolume(set)}</span>
                    <button style={{ background: '#F0F0F0', color: '#888', border: 'none', borderRadius: '4px', padding: '3px', cursor: 'pointer', fontSize: '12px' }} onClick={() => removeSet(exIdx, setIdx)}>－</button>
                  </div>
                ))}

                <button style={{ ...S.addSetBtn, fontSize: '11px', padding: '5px' }} onClick={() => addSet(exIdx)}>➕ 세트 추가</button>
              </div>

              {/* 오른쪽: 운동설명 + 사진(첫 번째 세트만) */}
              <div style={{ flex: '0 0 100px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <textarea
                  style={{ padding: '6px', borderRadius: '6px', border: `1px solid ${THEME.border}`, fontSize: '10px', color: THEME.textSub, background: '#FFF', resize: 'none', height: '52px', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: '1.4' }}
                  placeholder="운동 설명&#10;(예: 등 넓게 잡고&#10;천천히 내려가기)"
                  value={ex.description || ''}
                  onChange={e => updateExField(exIdx, 'description', e.target.value)}
                />

                {/* 사진/영상 - 첫 번째 세트만 표시 */}
                {ex.sets[0] && (
                  <div>
                    {ex.sets[0].media_url ? (
                      ex.sets[0].media_url.match(/\.(mp4|mov|avi)$/i)
                        ? <video src={ex.sets[0].media_url} style={{ width: '100%', aspectRatio: '3/4', borderRadius: '6px', objectFit: 'cover' }} controls />
                        : <img src={ex.sets[0].media_url} alt="" style={{ width: '100%', aspectRatio: '3/4', borderRadius: '6px', objectFit: 'cover' }} />
                    ) : (
                      <label style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: THEME.cardAlt, borderRadius: '6px', aspectRatio: '3/4', border: `1px dashed ${THEME.border}` }}>
                        <span style={{ fontSize: '20px' }}>📷</span>
                        <span style={{ fontSize: '9px', color: THEME.textSub, marginTop: '2px' }}>사진/영상</span>
                        <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={e => e.target.files[0] && uploadMedia(exIdx, 0, e.target.files[0])} />
                      </label>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        <button style={S.addExBtn} onClick={addExercise}>➕ 종목 추가</button>
        <button style={{ ...S.btnPrimary, marginTop: '12px', fontSize: '15px' }} onClick={saveAllSets}>💾 전체 저장</button>
      </div>
    </div>
  )
}
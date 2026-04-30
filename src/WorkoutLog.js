import React, { useState } from 'react'
import { supabase } from './supabase'
import { PARTS, PART_COLORS, S } from './utils'

export default function WorkoutLog({ user, selectedDate, setSelectedDate, exercises, setExercises, onUpdate }) {

  const loadExercises = async (memberId, date) => {
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
    if (s.id) await supabase.from('workout_logs').delete().eq('id', s.id)
    u[exIdx].sets.splice(setIdx, 1)
    if (u[exIdx].sets.length === 0) u.splice(exIdx, 1)
    setExercises(u)
    if (onUpdate) onUpdate()
  }

  const removeExercise = async (exIdx) => {
    const ex = exercises[exIdx]
    for (const s of ex.sets) { if (s.id) await supabase.from('workout_logs').delete().eq('id', s.id) }
    const u = [...exercises]; u.splice(exIdx, 1); setExercises(u)
    if (onUpdate) onUpdate()
  }

  const updateExField = (exIdx, field, value) => {
    const u = [...exercises]; u[exIdx][field] = value; setExercises(u)
  }

  const updateSetField = (exIdx, setIdx, field, value) => {
    const u = [...exercises]; u[exIdx].sets[setIdx][field] = value; setExercises(u)
  }

  const saveSet = async (exIdx, setIdx) => {
    const ex = exercises[exIdx]; const set = ex.sets[setIdx]
    if (!ex.body_part || !ex.exercise_name || !set.weight || !set.reps) return
    const payload = {
      member_id: user.id, log_date: selectedDate, slot: ex.slot,
      body_part: ex.body_part, exercise_name: ex.exercise_name,
      weight: parseFloat(set.weight), sets: 1, reps: parseInt(set.reps),
      memo: ex.memo, media_url: set.media_url
    }
    if (set.id) {
      await supabase.from('workout_logs').update(payload).eq('id', set.id)
    } else {
      const { data } = await supabase.from('workout_logs').insert(payload).select().single()
      if (data) {
        const u = [...exercises]
        u[exIdx].sets[setIdx].id = data.id
        u[exIdx].sets[setIdx].volume = data.volume
        setExercises(u)
      }
    }
    if (onUpdate) onUpdate()
  }

  const saveMemo = async (exIdx) => {
    const ex = exercises[exIdx]
    for (const set of ex.sets) {
      if (set.id) await supabase.from('workout_logs').update({ memo: ex.memo }).eq('id', set.id)
    }
  }

  const uploadMedia = async (exIdx, setIdx, file) => {
    const ext = file.name.split('.').pop()
    const fileName = `${user.id}/${selectedDate}_${Date.now()}.${ext}`
    const { data, error } = await supabase.storage.from('workout-media').upload(fileName, file)
    if (!error) {
      const { data: urlData } = supabase.storage.from('workout-media').getPublicUrl(fileName)
      updateSetField(exIdx, setIdx, 'media_url', urlData.publicUrl)
      await saveSet(exIdx, setIdx)
    }
  }

  const getSetVolume = (set) => (!set.weight || !set.reps) ? '' : (parseFloat(set.weight) * parseInt(set.reps)).toLocaleString() + 'kg'

  const dailyTotal = exercises.reduce((sum, ex) => sum + ex.sets.reduce((s2, s) => s2 + (s.weight && s.reps ? parseFloat(s.weight) * parseInt(s.reps) : 0), 0), 0)

  return (
    <div>
      {/* 오늘 요약 */}
      <div style={S.card}>
        <p style={S.cardTitle}>📅 오늘 운동 요약</p>
        {exercises.filter(ex => ex.exercise_name).length === 0 ? (
          <p style={{ color: '#888', fontSize: '13px', textAlign: 'center', padding: '10px 0' }}>운동을 기록해주세요</p>
        ) : exercises.filter(ex => ex.exercise_name).map((ex, i) => {
          const vol = ex.sets.reduce((sum, s) => sum + (s.weight && s.reps ? parseFloat(s.weight) * parseInt(s.reps) : 0), 0)
          return (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F0F0F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', background: PART_COLORS[ex.body_part] || '#888', color: '#FFF', padding: '2px 8px', borderRadius: '10px' }}>{ex.body_part}</span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#1A1A2E' }}>{ex.exercise_name}</span>
                <span style={{ fontSize: '12px', color: '#888' }}>{ex.sets.filter(s => s.weight && s.reps).length}세트</span>
              </div>
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#2E9E3B', flexShrink: 0 }}>{vol.toLocaleString()}kg</span>
            </div>
          )
        })}
        {dailyTotal > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#1A1A2E' }}>총 볼륨</span>
            <span style={{ fontSize: '15px', fontWeight: '700', color: '#1A1A2E' }}>{dailyTotal.toLocaleString()}kg</span>
          </div>
        )}
      </div>

      {/* 운동 기록 */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <p style={{ ...S.cardTitle, margin: 0 }}>운동 기록</p>
          <input type="date" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); loadExercises(user.id, e.target.value) }} style={S.dateInput} />
        </div>

        {exercises.map((ex, exIdx) => (
          <div key={exIdx} style={S.exBox}>
            {/* 종목 헤더 */}
            <div style={S.exHeader}>
              <select style={S.partSel} value={ex.body_part} onChange={e => updateExField(exIdx, 'body_part', e.target.value)}>
                <option value="">부위 선택</option>
                {PARTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <input style={S.exNameInput} placeholder="운동명 (예: 런지)" value={ex.exercise_name} onChange={e => updateExField(exIdx, 'exercise_name', e.target.value)} />
              <button style={S.delExBtn} onClick={() => removeExercise(exIdx)}>✕</button>
            </div>

            {/* 특이사항 */}
            <input
              style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #DDD', fontSize: '12px', marginBottom: '10px', boxSizing: 'border-box', color: '#555' }}
              placeholder="특이사항 (예: 오른쪽 무릎 불편, 폼 개선됨)"
              value={ex.memo}
              onChange={e => updateExField(exIdx, 'memo', e.target.value)}
              onBlur={() => saveMemo(exIdx)}
            />

            {/* 세트 헤더 */}
            <div style={S.setHeaderRow}>
              <span style={{ flex: 0.4, fontSize: '11px', color: '#888', textAlign: 'center' }}>세트</span>
              <span style={{ flex: 1, fontSize: '11px', color: '#888', textAlign: 'center' }}>무게(kg)</span>
              <span style={{ flex: 1, fontSize: '11px', color: '#888', textAlign: 'center' }}>횟수</span>
              <span style={{ flex: 1, fontSize: '11px', color: '#888', textAlign: 'center' }}>볼륨</span>
              <span style={{ flex: 0.8, fontSize: '11px', color: '#888', textAlign: 'center' }}>미디어</span>
              <span style={{ flex: 0.4 }}></span>
            </div>

            {ex.sets.map((set, setIdx) => (
              <div key={setIdx}>
                <div style={S.setRow}>
                  <span style={{ flex: 0.4, fontSize: '12px', color: '#888', textAlign: 'center' }}>{setIdx + 1}</span>
                  <input style={S.numInput} type="number" placeholder="0" value={set.weight} onChange={e => updateSetField(exIdx, setIdx, 'weight', e.target.value)} onBlur={() => saveSet(exIdx, setIdx)} />
                  <input style={S.numInput} type="number" placeholder="0" value={set.reps} onChange={e => updateSetField(exIdx, setIdx, 'reps', e.target.value)} onBlur={() => saveSet(exIdx, setIdx)} />
                  <span style={{ flex: 1, fontSize: '12px', fontWeight: '700', color: '#2E9E3B', textAlign: 'center' }}>{getSetVolume(set)}</span>
                  <div style={{ flex: 0.8, textAlign: 'center' }}>
                    {set.media_url ? (
                      set.media_url.match(/\.(mp4|mov|avi)$/i)
                        ? <video src={set.media_url} style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }} />
                        : <img src={set.media_url} alt="" style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }} />
                    ) : (
                      <label style={{ cursor: 'pointer', fontSize: '18px' }}>
                        📷
                        <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={e => e.target.files[0] && uploadMedia(exIdx, setIdx, e.target.files[0])} />
                      </label>
                    )}
                  </div>
                  <button style={S.delSetBtn} onClick={() => removeSet(exIdx, setIdx)}>－</button>
                </div>
              </div>
            ))}

            <button style={S.addSetBtn} onClick={() => addSet(exIdx)}>+ 세트 추가</button>
          </div>
        ))}

        <button style={S.addExBtn} onClick={addExercise}>+ 종목 추가</button>
      </div>
    </div>
  )
}
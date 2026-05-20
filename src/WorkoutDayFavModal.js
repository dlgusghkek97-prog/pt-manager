import React, { useEffect, useState } from 'react'
import { THEME, loadWorkoutDayFavorites, addWorkoutDayFavorite, removeWorkoutDayFavorite, formatSupabaseError } from './utils'
import useModalBackButton from './useModalBackButton'
import CloseButton from './CloseButton'

// 일일 운동 즐겨찾기 모달.
// - 현재 화면 exercises 전체를 한 라벨로 저장
// - 저장된 일일 즐겨찾기 [적용] → 현재 exercises 교체.
//   적용 규칙: 세트·중량은 그대로, 횟수(reps)는 빈값으로 초기화.
export default function WorkoutDayFavModal({
  userId,
  currentExercises,   // [{ slot, exercise_type, body_part, exercise_name, memo, description, sets:[{weight,reps,...}] }, ...]
  onApply,            // (exercises[]) => void
  onClose,
  favTable = 'workout_day_favorites',
  favIdField = 'member_id',
}) {
  const [favs, setFavs] = useState([])
  const [loading, setLoading] = useState(true)
  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)

  useModalBackButton(true, onClose)

  useEffect(() => {
    let alive = true
    setLoading(true)
    loadWorkoutDayFavorites(userId, favTable, favIdField).then(d => {
      if (alive) { setFavs(d); setLoading(false) }
    })
    return () => { alive = false }
  }, [userId, favTable, favIdField])

  // 저장 가능한 운동만 추출 (이름+부위+1세트 이상)
  const filledExercises = (currentExercises || []).filter(ex => {
    if (!ex.exercise_name || !ex.body_part) return false
    return (ex.sets || []).some(s => (s.weight !== '' && s.weight != null) || (s.reps !== '' && s.reps != null))
  })

  const totalSets = filledExercises.reduce((s, ex) => s + (ex.sets?.length || 0), 0)
  const canSave = !!newLabel.trim() && filledExercises.length > 0

  const handleSave = async () => {
    if (!canSave) { alert('이름과 운동 내용(1개 이상)이 필요합니다.'); return }
    setSaving(true)
    const result = await addWorkoutDayFavorite(userId, newLabel, filledExercises, favTable, favIdField)
    setSaving(false)
    if (!result.success) { alert(formatSupabaseError({ message: result.error }, '저장 실패')); return }
    onClose?.()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('이 일일 운동 즐겨찾기를 삭제할까요?')) return
    const result = await removeWorkoutDayFavorite(id, favTable)
    if (!result.success) { alert(formatSupabaseError({ message: result.error }, '삭제 실패')); return }
    setFavs(prev => prev.filter(f => f.id !== id))
  }

  // 적용: 세트/중량 유지, 횟수만 빈값으로 초기화. id 새로 부여.
  const handleApply = (fav) => {
    if (!window.confirm(`"${fav.label}" 으로 오늘 운동을 통째로 교체할까요?\n(세트·중량은 그대로 / 횟수는 비워져요. 현재 기록은 사라집니다)`)) return
    const list = Array.isArray(fav.exercises) ? fav.exercises : []
    const applied = list.map((ex, i) => ({
      slot: ex.slot || i + 1,
      exercise_type: ex.exercise_type || 'weight',
      body_part: ex.body_part || '',
      exercise_name: ex.exercise_name || '',
      memo: ex.memo || '',
      description: ex.description || '',
      sets: (ex.sets || []).map(s => ({
        id: null,
        weight: s.weight !== '' && s.weight != null ? String(s.weight) : '',
        reps: '',  // 횟수 초기화
        media_url: '',
      })),
    }))
    onApply?.(applied)
    onClose?.()
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: '#FFF', borderRadius: '14px', padding: '18px', width: '100%', maxWidth: '360px', maxHeight: '85vh', overflowY: 'auto', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <p style={{ fontSize: '14px', fontWeight: '500', color: THEME.primary, margin: 0 }}>🏋️ 일일 운동 즐겨찾기</p>
          <CloseButton onClick={onClose} />
        </div>

        {/* 현재 운동 통째로 저장 */}
        <div style={{ background: THEME.cardAlt, borderRadius: '10px', padding: '11px', marginBottom: '12px' }}>
          <p style={{ fontSize: '11px', color: THEME.textSub, fontWeight: '500', margin: '0 0 6px' }}>오늘 운동을 통째로 저장</p>
          <input
            type="text"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="이름 (예: 푸시 데이, 등·이두)"
            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: `0.5px solid ${THEME.border}`, fontSize: '12px', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none', marginBottom: '6px', background: '#FFF', color: THEME.text }}
          />
          {filledExercises.length === 0 ? (
            <p style={{ fontSize: '10px', color: THEME.textHint, margin: '0 0 7px' }}>입력된 운동이 없습니다 — 먼저 운동을 입력해주세요</p>
          ) : (
            <p style={{ fontSize: '10px', color: THEME.textHint, margin: '0 0 7px', lineHeight: 1.5 }}>
              운동 {filledExercises.length}개 · 총 {totalSets}세트
            </p>
          )}
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            style={{
              background: canSave ? THEME.primary : THEME.borderLight,
              color: canSave ? '#FFF' : THEME.textHint,
              border: 'none', padding: '8px 0', borderRadius: '6px',
              fontSize: '12px', fontWeight: '500',
              cursor: canSave ? 'pointer' : 'not-allowed',
              width: '100%', fontFamily: 'inherit',
            }}
          >{saving ? '저장 중…' : '+ 일일 즐겨찾기로 저장'}</button>
        </div>

        {/* 저장된 일일 즐겨찾기 목록 */}
        <p style={{ fontSize: '11px', color: THEME.textSub, fontWeight: '500', margin: '0 0 6px' }}>저장된 일일 운동</p>
        {loading ? (
          <p style={{ fontSize: '11px', color: THEME.textHint, textAlign: 'center', padding: '12px 0', margin: 0 }}>로딩 중…</p>
        ) : favs.length === 0 ? (
          <p style={{ fontSize: '11px', color: THEME.textHint, textAlign: 'center', padding: '12px 0', margin: 0 }}>저장된 일일 운동이 없습니다</p>
        ) : (
          favs.map(f => {
            const exs = Array.isArray(f.exercises) ? f.exercises : []
            const sets = exs.reduce((s, ex) => s + (ex.sets?.length || 0), 0)
            return (
              <div key={f.id} style={{ background: '#FFF', border: `0.5px solid ${THEME.border}`, borderRadius: '8px', padding: '10px', marginBottom: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px', gap: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '500', color: THEME.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>{f.label}</span>
                  <button onClick={() => handleDelete(f.id)} style={{ background: 'none', border: 'none', color: THEME.danger, fontSize: '11px', cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>✕</button>
                </div>
                <p style={{ fontSize: '10px', color: THEME.textSub, margin: '0 0 5px', lineHeight: 1.5 }}>
                  운동 {exs.length}개 · 총 {sets}세트
                </p>
                <p style={{ fontSize: '9px', color: THEME.textHint, margin: '0 0 7px', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {exs.map(ex => ex.exercise_name || '?').join(' · ')}
                </p>
                <button
                  onClick={() => handleApply(f)}
                  style={{ background: THEME.primaryAccent, color: THEME.primaryDark, border: 'none', padding: '7px 0', borderRadius: '5px', fontSize: '11px', fontWeight: '500', cursor: 'pointer', width: '100%', fontFamily: 'inherit' }}
                >✓ 오늘 운동으로 적용 (횟수 비움)</button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

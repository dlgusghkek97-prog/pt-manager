import React, { useEffect, useState } from 'react'
import { THEME, loadDietDayFavorites, addDietDayFavorite, removeDietDayFavorite } from './utils'
import useModalBackButton from './useModalBackButton'

// 일일 식단 즐겨찾기 모달 — 하루 전체 끼니(N개)를 한 번에 저장·불러오기.
// - 현재 화면 meals 전체를 한 라벨로 저장
// - 저장된 일일 즐겨찾기 목록에서 [적용] → 현재 meals 를 통째로 교체
export default function DietDayFavModal({
  userId,
  currentMeals,   // 화면 현재 meals 배열 [{slot, name, carbs, protein, fat, calories}, ...]
  onApply,        // (meals[]) => void  — 적용 시 전체 교체
  onClose,
  favTable = 'diet_day_favorites',
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
    loadDietDayFavorites(userId, favTable, favIdField).then(d => {
      if (alive) { setFavs(d); setLoading(false) }
    })
    return () => { alive = false }
  }, [userId, favTable, favIdField])

  const filledMeals = (currentMeals || []).filter(m =>
    parseFloat(m.carbs) || parseFloat(m.protein) || parseFloat(m.fat) || parseInt(m.calories)
  )
  const totalCal = filledMeals.reduce((s, m) => s + (parseInt(m.calories) || 0), 0)
  const totalCarbs = filledMeals.reduce((s, m) => s + (parseFloat(m.carbs) || 0), 0)
  const totalProtein = filledMeals.reduce((s, m) => s + (parseFloat(m.protein) || 0), 0)
  const totalFat = filledMeals.reduce((s, m) => s + (parseFloat(m.fat) || 0), 0)

  const canSave = !!newLabel.trim() && filledMeals.length > 0

  const handleSave = async () => {
    if (!canSave) {
      alert('이름과 식단 내용(끼니 1개 이상)이 필요합니다.')
      return
    }
    setSaving(true)
    const result = await addDietDayFavorite(userId, newLabel, filledMeals, favTable, favIdField)
    setSaving(false)
    if (!result.success) { alert('저장 실패: ' + result.error); return }
    onClose?.()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('이 일일 즐겨찾기를 삭제할까요?')) return
    const result = await removeDietDayFavorite(id, favTable)
    if (!result.success) { alert('삭제 실패: ' + result.error); return }
    setFavs(prev => prev.filter(f => f.id !== id))
  }

  const handleApply = (fav) => {
    if (!window.confirm(`"${fav.label}" 으로 오늘 식단을 통째로 교체할까요?\n(현재 입력된 내용은 사라집니다)`)) return
    onApply?.(fav.meals || [])
    onClose?.()
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: '#FFF', borderRadius: '14px', padding: '18px', width: '100%', maxWidth: '360px', maxHeight: '85vh', overflowY: 'auto', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <p style={{ fontSize: '14px', fontWeight: '500', color: THEME.primary, margin: 0 }}>📅 일일 식단 즐겨찾기</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: THEME.textSub, padding: '0 4px', lineHeight: 1 }}>✕</button>
        </div>

        {/* 현재 식단 통째로 저장 */}
        <div style={{ background: THEME.cardAlt, borderRadius: '10px', padding: '11px', marginBottom: '12px' }}>
          <p style={{ fontSize: '11px', color: THEME.textSub, fontWeight: '500', margin: '0 0 6px' }}>오늘 식단을 통째로 저장</p>
          <input
            type="text"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="이름 (예: 다이어트 식단A, 평일 패턴)"
            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: `0.5px solid ${THEME.border}`, fontSize: '12px', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none', marginBottom: '6px', background: '#FFF', color: THEME.text }}
          />
          {filledMeals.length === 0 ? (
            <p style={{ fontSize: '10px', color: THEME.textHint, margin: '0 0 7px' }}>입력된 끼니가 없습니다 — 먼저 식단을 입력해주세요</p>
          ) : (
            <p style={{ fontSize: '10px', color: THEME.textHint, margin: '0 0 7px', lineHeight: 1.5 }}>
              끼니 {filledMeals.length}개 · 탄 {Math.round(totalCarbs)}g · 단 {Math.round(totalProtein)}g · 지 {Math.round(totalFat)}g · {totalCal}kcal
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
              width: '100%', fontFamily: 'inherit'
            }}
          >{saving ? '저장 중…' : '+ 일일 즐겨찾기로 저장'}</button>
        </div>

        {/* 저장된 일일 즐겨찾기 목록 */}
        <p style={{ fontSize: '11px', color: THEME.textSub, fontWeight: '500', margin: '0 0 6px' }}>저장된 일일 즐겨찾기</p>
        {loading ? (
          <p style={{ fontSize: '11px', color: THEME.textHint, textAlign: 'center', padding: '12px 0', margin: 0 }}>로딩 중…</p>
        ) : favs.length === 0 ? (
          <p style={{ fontSize: '11px', color: THEME.textHint, textAlign: 'center', padding: '12px 0', margin: 0 }}>저장된 일일 즐겨찾기가 없습니다</p>
        ) : (
          favs.map(f => {
            const ml = Array.isArray(f.meals) ? f.meals : []
            const sumCal = ml.reduce((s, m) => s + (parseInt(m.calories) || 0), 0)
            const sumC = ml.reduce((s, m) => s + (parseFloat(m.carbs) || 0), 0)
            const sumP = ml.reduce((s, m) => s + (parseFloat(m.protein) || 0), 0)
            const sumF = ml.reduce((s, m) => s + (parseFloat(m.fat) || 0), 0)
            return (
              <div key={f.id} style={{ background: '#FFF', border: `0.5px solid ${THEME.border}`, borderRadius: '8px', padding: '10px', marginBottom: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px', gap: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '500', color: THEME.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>{f.label}</span>
                  <button onClick={() => handleDelete(f.id)} style={{ background: 'none', border: 'none', color: THEME.danger, fontSize: '11px', cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>✕</button>
                </div>
                <p style={{ fontSize: '10px', color: THEME.textSub, margin: '0 0 5px', lineHeight: 1.5 }}>
                  끼니 {ml.length}개 · 탄 {Math.round(sumC)}g · 단 {Math.round(sumP)}g · 지 {Math.round(sumF)}g · {sumCal}kcal
                </p>
                {/* 끼니 라벨 한 줄로 노출 */}
                <p style={{ fontSize: '9px', color: THEME.textHint, margin: '0 0 7px', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ml.map(m => m.name || `식사 ${m.slot}`).join(' · ')}
                </p>
                <button
                  onClick={() => handleApply(f)}
                  style={{ background: THEME.primaryAccent, color: THEME.primaryDark, border: 'none', padding: '7px 0', borderRadius: '5px', fontSize: '11px', fontWeight: '500', cursor: 'pointer', width: '100%', fontFamily: 'inherit' }}
                >✓ 오늘 식단으로 적용</button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

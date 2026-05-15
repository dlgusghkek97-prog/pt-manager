import React, { useEffect, useState } from 'react'
import { THEME, loadDietFavorites, addDietFavorite, removeDietFavorite } from './utils'
import useModalBackButton from './useModalBackButton'
import CloseButton from './CloseButton'

// 식단 즐겨찾기 모달.
// - 상단: 현재 식사 입력값을 즐겨찾기로 저장
// - 하단: 저장된 즐겨찾기 목록 (적용/삭제)
export default function DietFavModal({
  userId,
  currentMeal,        // { name, carbs, protein, fat, calories }
  onApply,            // (applied) => void  ※ applied: { name, carbs, protein, fat, calories } (모두 string)
  onClose,
  favTable = 'diet_favorites',
  favIdField = 'member_id',
}) {
  const [favs, setFavs] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState(currentMeal?.name || '')
  const [saving, setSaving] = useState(false)

  // 핸드폰 뒤로가기 → 모달 닫힘
  useModalBackButton(true, onClose)

  useEffect(() => {
    let alive = true
    setLoading(true)
    loadDietFavorites(userId, favTable, favIdField).then(d => {
      if (alive) { setFavs(d); setLoading(false) }
    })
    return () => { alive = false }
  }, [userId, favTable, favIdField])

  const curCarbs = parseFloat(currentMeal?.carbs) || 0
  const curProtein = parseFloat(currentMeal?.protein) || 0
  const curFat = parseFloat(currentMeal?.fat) || 0
  let curCal = parseInt(currentMeal?.calories) || 0
  if (!curCal && (curCarbs || curProtein || curFat)) {
    curCal = Math.round(curCarbs * 4 + curProtein * 4 + curFat * 9)
  }

  const canSave = !!newName.trim() && (curCarbs || curProtein || curFat || curCal)

  const handleSave = async () => {
    if (!canSave) {
      alert('이름과 영양소(또는 칼로리) 중 하나 이상 필요합니다.')
      return
    }
    setSaving(true)
    const result = await addDietFavorite(
      userId,
      { name: newName, carbs: curCarbs, protein: curProtein, fat: curFat, calories: curCal },
      favTable, favIdField,
    )
    setSaving(false)
    if (!result.success) { alert('저장 실패: ' + result.error); return }
    // 저장 성공 시 모달 자동 닫힘 (목록 갱신 대신 닫음 — 다시 열면 보임)
    onClose?.()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('이 즐겨찾기를 삭제할까요?')) return
    const result = await removeDietFavorite(id, favTable)
    if (!result.success) { alert('삭제 실패: ' + result.error); return }
    setFavs(prev => prev.filter(f => f.id !== id))
  }

  const handleApply = (fav) => {
    onApply?.({
      name: fav.name,
      carbs: fav.carbs > 0 ? String(fav.carbs) : '',
      protein: fav.protein > 0 ? String(fav.protein) : '',
      fat: fav.fat > 0 ? String(fav.fat) : '',
      calories: fav.calories > 0 ? String(fav.calories) : '',
    })
    onClose?.()
  }

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
    >
      <div
        style={{ background: '#FFF', borderRadius: '14px', padding: '18px', width: '100%', maxWidth: '340px', maxHeight: '80vh', overflowY: 'auto', boxSizing: 'border-box' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <p style={{ fontSize: '14px', fontWeight: '500', color: THEME.primary, margin: 0 }}>★ 식단 즐겨찾기</p>
          <CloseButton onClick={onClose} />
        </div>

        {/* 현재 입력값 즐겨찾기로 저장 */}
        <div style={{ background: THEME.cardAlt, borderRadius: '10px', padding: '11px', marginBottom: '12px' }}>
          <p style={{ fontSize: '11px', color: THEME.textSub, fontWeight: '500', margin: '0 0 6px' }}>현재 입력값을 즐겨찾기로 저장</p>
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="이름 (예: 닭가슴살 100g, 오트밀 한 그릇)"
            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: `0.5px solid ${THEME.border}`, fontSize: '12px', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none', marginBottom: '6px', background: '#FFF', color: THEME.text }}
          />
          <p style={{ fontSize: '10px', color: THEME.textHint, margin: '0 0 7px', lineHeight: 1.5 }}>
            탄 {curCarbs}g · 단 {curProtein}g · 지 {curFat}g · {curCal}kcal
          </p>
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
          >{saving ? '저장 중…' : '+ 즐겨찾기로 저장'}</button>
        </div>

        {/* 저장된 즐겨찾기 목록 */}
        <p style={{ fontSize: '11px', color: THEME.textSub, fontWeight: '500', margin: '0 0 6px' }}>저장된 즐겨찾기</p>
        {loading ? (
          <p style={{ fontSize: '11px', color: THEME.textHint, textAlign: 'center', padding: '12px 0', margin: 0 }}>로딩 중…</p>
        ) : favs.length === 0 ? (
          <p style={{ fontSize: '11px', color: THEME.textHint, textAlign: 'center', padding: '12px 0', margin: 0 }}>저장된 즐겨찾기가 없습니다</p>
        ) : (
          favs.map(f => (
            <div key={f.id} style={{ background: '#FFF', border: `0.5px solid ${THEME.border}`, borderRadius: '8px', padding: '10px', marginBottom: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: '500', color: THEME.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>{f.name}</span>
                <button onClick={() => handleDelete(f.id)} style={{ background: 'none', border: 'none', color: THEME.danger, fontSize: '11px', cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>✕</button>
              </div>
              <p style={{ fontSize: '10px', color: THEME.textSub, margin: '0 0 7px', lineHeight: 1.5 }}>
                탄 {f.carbs}g · 단 {f.protein}g · 지 {f.fat}g · {f.calories}kcal
              </p>
              <button
                onClick={() => handleApply(f)}
                style={{ background: THEME.primaryAccent, color: THEME.primaryDark, border: 'none', padding: '7px 0', borderRadius: '5px', fontSize: '11px', fontWeight: '500', cursor: 'pointer', width: '100%', fontFamily: 'inherit' }}
              >✓ 이 식사에 적용</button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { THEME } from './utils'

// 카테고리 색상 풀 - 새 카테고리 만들 때 자동 배정
const COLOR_POOL = [
  { name: '코랄', bg: '#FCE4E0', text: '#8E3D2E', mid: '#C5705C' },
  { name: '앰버', bg: '#FFF7E6', text: '#8B6F2A', mid: '#D4A848' },
  { name: '그린', bg: '#E8F2EE', text: '#2F5C45', mid: '#5A8E72' },
  { name: '블루', bg: '#E6F2F4', text: '#2F6B7A', mid: '#5A9CAB' },
  { name: '퍼플', bg: '#F0E8F2', text: '#5C3D6E', mid: '#A878B5' },
  { name: '핑크', bg: '#FBE8EE', text: '#8E3D5C', mid: '#C5708F' },
  { name: '브라운', bg: '#FBEDDB', text: '#8B5E2E', mid: '#C28A52' },
  { name: '틸', bg: '#E0F2EE', text: '#2A6B5E', mid: '#5DBDA8' },
]

// 색상 키로 실제 색상 객체 찾기
const getColorByKey = (colorKey) => {
  return COLOR_POOL.find(c => c.name === colorKey) || COLOR_POOL[0]
}

export default function MemberNotes({ member, onClose, onUpdate }) {
  const [categories, setCategories] = useState([])
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)

  // 새 메모 작성 폼
  const [newContent, setNewContent] = useState('')
  const [newCategoryId, setNewCategoryId] = useState('')
  const [newIsImportant, setNewIsImportant] = useState(false)

  // 새 카테고리 추가 모드
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState(COLOR_POOL[0].name)

  // 카테고리 관리 모드
  const [managingCategories, setManagingCategories] = useState(false)

  // 메모 수정 모드
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editIsImportant, setEditIsImportant] = useState(false)

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.id])

  const loadAll = async () => {
    setLoading(true)
    const [{ data: cats }, { data: nts }] = await Promise.all([
      supabase.from('member_note_categories').select('*').eq('member_id', member.id).order('created_at'),
      supabase.from('member_notes').select('*').eq('member_id', member.id).order('is_important', { ascending: false }).order('created_at', { ascending: false })
    ])
    setCategories(cats || [])
    setNotes(nts || [])
    setLoading(false)
  }

  const addCategory = async () => {
    if (!newCatName.trim()) { alert('카테고리 이름을 입력해주세요.'); return }
    const { data, error } = await supabase
      .from('member_note_categories')
      .insert({ member_id: member.id, name: newCatName.trim(), color: newCatColor })
      .select()
      .single()
    if (error) { alert('카테고리 추가 실패: ' + error.message); return }
    setCategories([...categories, data])
    // 메모 작성 중이었으면 새 카테고리 자동 선택
    if (addingCategory && !managingCategories) {
      setNewCategoryId(String(data.id))
    }
    setNewCatName('')
    setNewCatColor(COLOR_POOL[0].name)
    setAddingCategory(false)
  }

  const deleteCategory = async (catId) => {
    if (!window.confirm('이 카테고리를 삭제할까요?\n(이 카테고리의 메모는 삭제되지 않고 카테고리만 해제됩니다)')) return
    const { error } = await supabase.from('member_note_categories').delete().eq('id', catId)
    if (error) { alert('삭제 실패: ' + error.message); return }
    await loadAll()
  }

  const addNote = async () => {
    if (!newContent.trim()) { alert('메모 내용을 입력해주세요.'); return }
    const payload = {
      member_id: member.id,
      category_id: newCategoryId ? parseInt(newCategoryId) : null,
      content: newContent.trim(),
      is_important: newIsImportant,
    }
    const { error } = await supabase.from('member_notes').insert(payload)
    if (error) { alert('메모 저장 실패: ' + error.message); return }
    setNewContent('')
    setNewCategoryId('')
    setNewIsImportant(false)
    await loadAll()
    if (onUpdate) onUpdate()
  }

  const startEditNote = (note) => {
    setEditingNoteId(note.id)
    setEditContent(note.content)
    setEditCategoryId(note.category_id ? String(note.category_id) : '')
    setEditIsImportant(note.is_important)
  }

  const saveEditNote = async () => {
    if (!editContent.trim()) { alert('메모 내용을 입력해주세요.'); return }
    const { error } = await supabase
      .from('member_notes')
      .update({
        content: editContent.trim(),
        category_id: editCategoryId ? parseInt(editCategoryId) : null,
        is_important: editIsImportant,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingNoteId)
    if (error) { alert('수정 실패: ' + error.message); return }
    setEditingNoteId(null)
    await loadAll()
    if (onUpdate) onUpdate()
  }

  const deleteNote = async (noteId) => {
    if (!window.confirm('이 메모를 삭제할까요?')) return
    const { error } = await supabase.from('member_notes').delete().eq('id', noteId)
    if (error) { alert('삭제 실패: ' + error.message); return }
    await loadAll()
    if (onUpdate) onUpdate()
  }

  const getCategoryById = (id) => categories.find(c => c.id === id)

  // 카테고리 뱃지
  const CategoryBadge = ({ category }) => {
    if (!category) return (
      <span style={{ fontSize: '9px', background: THEME.borderLight, color: THEME.textSub, padding: '2px 6px', borderRadius: '4px', fontWeight: '500' }}>
        미분류
      </span>
    )
    const color = getColorByKey(category.color)
    return (
      <span style={{ fontSize: '9px', background: color.bg, color: color.text, padding: '2px 6px', borderRadius: '4px', fontWeight: '500' }}>
        {category.name}
      </span>
    )
  }

  const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '6px',
    border: `0.5px solid ${THEME.border}`,
    fontSize: '12px',
    background: '#FFF',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    outline: 'none',
  }

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#FFF', borderRadius: '20px 20px 0 0', padding: '20px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <p style={{ fontSize: '15px', fontWeight: '500', color: THEME.text, margin: 0 }}>
            {member.name} 회원 메모
          </p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: THEME.textSub, padding: 0 }}>✕</button>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: THEME.textSub, fontSize: '12px', padding: '20px 0' }}>불러오는 중...</p>
        ) : (
          <>
            {/* 카테고리 관리 모드 */}
            {managingCategories ? (
              <div style={{ background: THEME.cardAlt, borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '500', color: THEME.text }}>카테고리 관리</span>
                  <button
                    onClick={() => setManagingCategories(false)}
                    style={{ background: 'none', border: 'none', color: THEME.primary, fontSize: '11px', cursor: 'pointer', fontWeight: '500' }}
                  >완료</button>
                </div>

                {categories.length === 0 ? (
                  <p style={{ fontSize: '11px', color: THEME.textSub, textAlign: 'center', padding: '8px 0' }}>등록된 카테고리가 없습니다</p>
                ) : (
                  categories.map(cat => {
                    const color = getColorByKey(cat.color)
                    return (
                      <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: '#FFF', borderRadius: '6px', marginBottom: '5px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color.mid }} />
                          <span style={{ fontSize: '12px', color: THEME.text, fontWeight: '500' }}>{cat.name}</span>
                        </div>
                        <button
                          onClick={() => deleteCategory(cat.id)}
                          style={{ background: '#FCEBEB', border: '0.5px solid #F09595', color: '#A32D2D', padding: '3px 8px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', fontWeight: '500' }}
                        >삭제</button>
                      </div>
                    )
                  })
                )}

                {/* 새 카테고리 추가 */}
                {addingCategory ? (
                  <div style={{ background: '#FFF', borderRadius: '6px', padding: '10px', marginTop: '8px' }}>
                    <input
                      style={{ ...inputStyle, marginBottom: '8px' }}
                      placeholder="카테고리 이름 (예: 건강, 부상, 목표)"
                      value={newCatName}
                      onChange={e => setNewCatName(e.target.value)}
                      autoFocus
                    />
                    <p style={{ fontSize: '10px', color: THEME.textSub, margin: '0 0 6px' }}>색상 선택</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                      {COLOR_POOL.map(c => (
                        <button
                          key={c.name}
                          onClick={() => setNewCatColor(c.name)}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: c.mid,
                            border: newCatColor === c.name ? `2px solid ${THEME.primaryDark}` : '0.5px solid #FFF',
                            cursor: 'pointer',
                            padding: 0,
                            outline: 'none',
                          }}
                          title={c.name}
                        />
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => { setAddingCategory(false); setNewCatName(''); setNewCatColor(COLOR_POOL[0].name) }}
                        style={{ flex: 1, background: '#FFF', border: `0.5px solid ${THEME.border}`, color: THEME.textSub, padding: '8px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}
                      >취소</button>
                      <button
                        onClick={addCategory}
                        style={{ flex: 1, background: THEME.primary, color: '#FFF', border: 'none', padding: '8px', borderRadius: '6px', fontSize: '11px', fontWeight: '500', cursor: 'pointer' }}
                      >추가</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingCategory(true)}
                    style={{ width: '100%', background: 'transparent', border: `0.5px dashed ${THEME.primaryAccent}`, color: THEME.primary, padding: '8px', borderRadius: '6px', fontSize: '11px', fontWeight: '500', cursor: 'pointer', marginTop: '6px' }}
                  >+ 카테고리 추가</button>
                )}
              </div>
            ) : (
              <>
                {/* 메모 목록 */}
                {notes.length === 0 ? (
                  <p style={{ textAlign: 'center', color: THEME.textSub, fontSize: '12px', padding: '20px 0' }}>아직 메모가 없습니다</p>
                ) : (
                  notes.map(note => {
                    const cat = getCategoryById(note.category_id)
                    const isEditing = editingNoteId === note.id

                    if (isEditing) {
                      return (
                        <div key={note.id} style={{ background: THEME.primaryLight, borderRadius: '10px', padding: '10px', marginBottom: '8px', border: `0.5px solid ${THEME.primaryAccent}` }}>
                          <textarea
                            style={{ ...inputStyle, minHeight: '60px', resize: 'vertical', marginBottom: '8px' }}
                            value={editContent}
                            onChange={e => setEditContent(e.target.value)}
                          />
                          <select
                            style={{ ...inputStyle, marginBottom: '8px' }}
                            value={editCategoryId}
                            onChange={e => setEditCategoryId(e.target.value)}
                          >
                            <option value="">카테고리 없음</option>
                            {categories.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={editIsImportant} onChange={e => setEditIsImportant(e.target.checked)} />
                            <span style={{ fontSize: '11px', color: THEME.text }}>중요 메모로 표시 (회원 카드에 노출)</span>
                          </label>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => setEditingNoteId(null)}
                              style={{ flex: 1, background: '#FFF', border: `0.5px solid ${THEME.border}`, color: THEME.textSub, padding: '7px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}
                            >취소</button>
                            <button
                              onClick={saveEditNote}
                              style={{ flex: 1, background: THEME.primary, color: '#FFF', border: 'none', padding: '7px', borderRadius: '6px', fontSize: '11px', fontWeight: '500', cursor: 'pointer' }}
                            >저장</button>
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div
                        key={note.id}
                        style={{ background: THEME.cardAlt, border: `0.5px solid ${THEME.border}`, borderRadius: '10px', padding: '10px', marginBottom: '8px', cursor: 'pointer' }}
                        onClick={() => startEditNote(note)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <CategoryBadge category={cat} />
                            {note.is_important && (
                              <span style={{ fontSize: '9px', background: THEME.danger, color: '#FFF', padding: '2px 6px', borderRadius: '4px', fontWeight: '500' }}>★ 중요</span>
                            )}
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); deleteNote(note.id) }}
                            style={{ background: 'none', border: 'none', color: THEME.textHint, fontSize: '11px', cursor: 'pointer', padding: '0 4px' }}
                          >✕</button>
                        </div>
                        <p style={{ fontSize: '11px', color: THEME.text, margin: 0, lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                          {note.content}
                        </p>
                      </div>
                    )
                  })
                )}

                {/* 새 메모 작성 영역 */}
                <div style={{ background: THEME.primaryLight, border: `0.5px solid ${THEME.primaryAccent}`, borderRadius: '10px', padding: '12px', marginTop: '12px' }}>
                  <p style={{ fontSize: '11px', fontWeight: '500', color: THEME.primaryDark, margin: '0 0 8px' }}>새 메모 작성</p>
                  <textarea
                    style={{ ...inputStyle, minHeight: '60px', resize: 'vertical', marginBottom: '8px' }}
                    placeholder="메모 내용을 입력하세요..."
                    value={newContent}
                    onChange={e => setNewContent(e.target.value)}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px', marginBottom: '8px' }}>
                    <select
                      style={inputStyle}
                      value={newCategoryId}
                      onChange={e => {
                        if (e.target.value === '__new__') {
                          setManagingCategories(true)
                          setAddingCategory(true)
                          setNewCategoryId('')
                        } else {
                          setNewCategoryId(e.target.value)
                        }
                      }}
                    >
                      <option value="">카테고리 선택</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                      <option value="__new__">+ 새 카테고리 추가</option>
                    </select>
                    <button
                      onClick={() => setManagingCategories(true)}
                      style={{ background: '#FFF', border: `0.5px solid ${THEME.border}`, color: THEME.textSub, padding: '0 10px', borderRadius: '6px', fontSize: '10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      title="카테고리 관리"
                    >관리</button>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={newIsImportant} onChange={e => setNewIsImportant(e.target.checked)} />
                    <span style={{ fontSize: '11px', color: THEME.text }}>중요 메모로 표시 (회원 카드에 노출)</span>
                  </label>
                  <button
                    onClick={addNote}
                    style={{ width: '100%', background: THEME.primary, color: '#FFF', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}
                  >메모 저장</button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
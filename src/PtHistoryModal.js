import React, { useEffect, useState } from 'react'
import { THEME, loadPtHistory } from './utils'
import useModalBackButton from './useModalBackButton'
import CloseButton from './CloseButton'

// PT 내역 모달
// - userType='member' : memberId 본인 것만
// - userType='trainer': trainerId 전체 (회원별 그룹핑 표시) 또는 특정 memberId 로 필터
export default function PtHistoryModal({ userType, memberId, trainerId, onClose }) {
  useModalBackButton(true, onClose)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterMember, setFilterMember] = useState('all')  // 트레이너 모드용

  useEffect(() => {
    let alive = true
    setLoading(true)
    const q = userType === 'trainer'
      ? { trainerId, limit: 200 }
      : { memberId, limit: 200 }
    loadPtHistory(q).then(d => {
      if (alive) { setRows(d); setLoading(false) }
    })
    return () => { alive = false }
  }, [userType, memberId, trainerId])

  // 트레이너 모드: 회원별 unique 리스트
  const uniqueMembers = userType === 'trainer'
    ? Array.from(new Map(rows.map(r => [r.member_id, r.members?.name || '?'])).entries())
    : []

  const filtered = userType === 'trainer' && filterMember !== 'all'
    ? rows.filter(r => r.member_id === filterMember)
    : rows

  const actionStyle = (action) => {
    switch (action) {
      case 'add':           return { bg: '#E0F2EE', color: '#2A6B5E', label: '+ 충전' }
      case 'use':           return { bg: '#FBE8E8', color: '#C25555', label: '− 차감' }
      case 'refund':        return { bg: '#FFF7E6', color: '#B88030', label: '복구' }
      case 'manual_adjust': return { bg: '#EDE5DA', color: '#7A6650', label: '✕ 삭제' }
      default:              return { bg: THEME.borderLight, color: THEME.textSub, label: action }
    }
  }

  const reasonText = (reason) => {
    switch (reason) {
      case 'attendance':    return '출석 처리'
      case 'no_show':       return '결석 처리 (차감)'
      case 'cancel_refund': return '취소 / 복구'
      case 'charge':        return 'PT 충전'
      case 'reset':         return 'PT 전체 삭제'
      case 'manual':        return '수동 조정'
      default: return reason || ''
    }
  }

  const fmtDate = (s) => {
    const d = new Date(s)
    const wd = ['일','월','화','수','목','금','토'][d.getDay()]
    const yy = String(d.getFullYear()).slice(2)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${yy}.${mm}.${dd}(${wd}) ${hh}:${mi}`
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#FFF', borderRadius: 14, width: '100%', maxWidth: 460, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `0.5px solid ${THEME.border}`, flexShrink: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: THEME.primary, margin: 0 }}>PT 내역</p>
          <CloseButton onClick={onClose} />
        </div>

        {/* 트레이너 모드: 회원 필터 칩 */}
        {userType === 'trainer' && uniqueMembers.length > 0 && (
          <div style={{ display: 'flex', gap: 5, overflowX: 'auto', padding: '10px 14px', borderBottom: `0.5px solid ${THEME.border}`, flexShrink: 0 }}>
            <button
              onClick={() => setFilterMember('all')}
              style={{
                background: filterMember === 'all' ? THEME.primary : THEME.cardAlt,
                color: filterMember === 'all' ? '#FFF' : THEME.textSub,
                border: 'none', borderRadius: 12, padding: '5px 11px',
                fontSize: 11, fontWeight: 500, cursor: 'pointer',
                whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit',
              }}>전체</button>
            {uniqueMembers.map(([id, name]) => (
              <button key={id}
                onClick={() => setFilterMember(id)}
                style={{
                  background: filterMember === id ? THEME.primary : THEME.cardAlt,
                  color: filterMember === id ? '#FFF' : THEME.textSub,
                  border: 'none', borderRadius: 12, padding: '5px 11px',
                  fontSize: 11, fontWeight: 500, cursor: 'pointer',
                  whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit',
                }}>{name}</button>
            ))}
          </div>
        )}

        {/* 본문 — 내역 리스트 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
          {loading ? (
            <p style={{ fontSize: 12, color: THEME.textHint, textAlign: 'center', padding: '24px 0' }}>로딩 중…</p>
          ) : filtered.length === 0 ? (
            <p style={{ fontSize: 12, color: THEME.textHint, textAlign: 'center', padding: '24px 0', lineHeight: 1.6 }}>
              PT 내역이 없습니다.<br/>
              {userType === 'member' ? '트레이너가 PT 등록 / 출석 처리 시 이 곳에 표시됩니다.' : '회원에게 PT 등록 / 출석 처리 시 이 곳에 표시됩니다.'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(r => {
                const st = actionStyle(r.action)
                return (
                  <div key={r.id} style={{ background: THEME.cardAlt, borderRadius: 10, padding: '10px 12px', border: `0.5px solid ${THEME.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                        <span style={{
                          background: st.bg, color: st.color,
                          padding: '2px 0', borderRadius: 4,
                          fontSize: 10, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0,
                          width: 74, textAlign: 'center',
                        }}>{st.label} {Math.abs(r.delta)}회</span>
                        {userType === 'trainer' && (
                          <span style={{ fontSize: 11, color: THEME.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                            {r.members?.name || '?'}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 10, color: THEME.textHint, whiteSpace: 'nowrap', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtDate(r.created_at)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: THEME.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>
                        {reasonText(r.reason)}
                      </span>
                      <span style={{ fontSize: 10, color: THEME.textHint, whiteSpace: 'nowrap', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                        잔여 <b style={{ color: THEME.text }}>{r.remaining_after ?? 0}</b> / 총 {r.total_after ?? 0}회
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div style={{ padding: '10px 14px', borderTop: `0.5px solid ${THEME.border}`, fontSize: 10, color: THEME.textHint, textAlign: 'center', flexShrink: 0, lineHeight: 1.5 }}>
          최근 200건까지 표시 · 충전 / 차감 / 복구 흐름 추적
        </div>
      </div>
    </div>
  )
}

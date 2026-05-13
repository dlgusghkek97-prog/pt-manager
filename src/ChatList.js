import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { THEME, loadConversationsForTrainer } from './utils'
import useModalBackButton from './useModalBackButton'

const ChatIcon = ({ color = THEME.text, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)

// 아바타 색상 풀 (이름 첫 글자에 따라 다양하게)
const AVATAR_COLORS = [
  { bg: '#B8DCC8', text: '#2F5C45' },
  { bg: '#FBEDDB', text: '#8B5E2E' },
  { bg: '#FBE8EE', text: '#8E3D5C' },
  { bg: '#E6F2F4', text: '#2F6B7A' },
  { bg: '#F0E8F2', text: '#5C3D6E' },
  { bg: '#E0F2EE', text: '#2A6B5E' },
  { bg: '#FCE4E0', text: '#8E3D2E' },
  { bg: '#FFF7E6', text: '#8B6F2A' },
]

const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0]
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

const formatRelativeTime = (timestamp) => {
  if (!timestamp) return ''
  const now = new Date()
  const t = new Date(timestamp)
  const isToday = now.toDateString() === t.toDateString()
  if (isToday) {
    return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (yesterday.toDateString() === t.toDateString()) return '어제'
  const diffDays = Math.floor((now - t) / (1000 * 60 * 60 * 24))
  if (diffDays < 7) return `${diffDays}일 전`
  return `${t.getMonth() + 1}/${t.getDate()}`
}

export default function ChatList({ trainerId, isOpen, onClose, onSelectConversation }) {
  useModalBackButton(isOpen, onClose)
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(false)
  const channelRef = useRef(null)

  useEffect(() => {
    if (!isOpen || !trainerId) return

    loadList()

    // Realtime — conversations 테이블 UPDATE 감지 (새 메시지 도착 시 last_message 갱신됨)
    const channel = supabase
      .channel(`conversations:trainer:${trainerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `trainer_id=eq.${trainerId}`,
        },
        () => {
          loadList()
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [isOpen, trainerId])

  const loadList = async () => {
    setLoading(true)
    const data = await loadConversationsForTrainer(trainerId)
    setConversations(data)
    setLoading(false)
  }

  if (!isOpen) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#FFF',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '380px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 16px',
          borderBottom: `0.5px solid ${THEME.border}`,
          flexShrink: 0,
        }}>
          <p style={{ fontSize: '14px', fontWeight: '500', color: THEME.text, margin: 0 }}>채팅</p>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: THEME.textSub,
              padding: 0,
              lineHeight: 1,
            }}
          >✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: THEME.textSub, fontSize: '12px', padding: '20px' }}>불러오는 중...</p>
          ) : conversations.length === 0 ? (
            <p style={{ textAlign: 'center', color: THEME.textSub, fontSize: '12px', padding: '40px 20px' }}>
              아직 시작된 대화가 없습니다.<br/>
              회원 상세 화면에서 채팅을 시작해보세요.
            </p>
          ) : (
            conversations.map(c => {
              const member = c.members || { name: c.member_id?.slice(0, 6) || '회원', id: c.member_id }
              const avatar = getAvatarColor(member.name)
              const unread = c.trainer_unread_count || 0
              return (
                <div
                  key={c.id}
                  onClick={() => onSelectConversation(c, member)}
                  style={{
                    padding: '11px 14px',
                    borderBottom: `0.5px solid ${THEME.borderLight}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: avatar.bg,
                    color: avatar.text,
                    fontSize: '13px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {member.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                      <p style={{ fontSize: '13px', fontWeight: '500', color: THEME.text, margin: 0 }}>
                        {member.name}
                      </p>
                      <span style={{ fontSize: '9px', color: THEME.textHint, flexShrink: 0, marginLeft: '8px' }}>
                        {formatRelativeTime(c.last_message_at)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <p style={{
                        fontSize: '11px',
                        color: unread > 0 ? THEME.text : THEME.textSub,
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                        minWidth: 0,
                        fontWeight: unread > 0 ? '500' : '400',
                      }}>
                        {c.last_message_preview || '대화 시작'}
                      </p>
                      {unread > 0 && (
                        <span style={{
                          background: THEME.danger,
                          color: '#FFF',
                          fontSize: '9px',
                          padding: '1px 6px',
                          borderRadius: '8px',
                          fontWeight: '500',
                          flexShrink: 0,
                        }}>
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
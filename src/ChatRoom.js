import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { THEME, loadMessages, sendMessage, markMessagesRead, uploadChatImage, getOrCreateConversation } from './utils'
import useModalBackButton from './useModalBackButton'
import CloseButton from './CloseButton'

const PhotoIcon = ({ color = THEME.primary, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
)

const SendIcon = ({ color = '#FFF', size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)

const LockIcon = ({ color = THEME.danger, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)

const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const t = new Date(timestamp)
  const hh = String(t.getHours()).padStart(2, '0')
  const mm = String(t.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

const formatDateDivider = (timestamp) => {
  const t = new Date(timestamp)
  const y = t.getFullYear()
  const m = t.getMonth() + 1
  const d = t.getDate()
  return `${y}년 ${m}월 ${d}일`
}

// 두 메시지 사이에 날짜 구분선 필요한지
const needsDateDivider = (prev, current) => {
  if (!prev) return true
  const prevDate = new Date(prev.created_at).toDateString()
  const currDate = new Date(current.created_at).toDateString()
  return prevDate !== currDate
}

const getInitial = (name) => name ? name.charAt(0) : '?'

export default function ChatRoom({
  trainerId,
  memberId,
  trainerName,
  memberName,
  viewerType,           // 'trainer' | 'member'
  viewerId,             // 현재 보고 있는 사람의 id
  onClose,
  ptIsZero = false,     // 회원/트레이너가 회원 상세에서 본 경우 — 사진 차단 여부
}) {
  useModalBackButton(true, onClose)
  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)

  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const channelRef = useRef(null)

  const otherName = viewerType === 'trainer' ? memberName : trainerName

  // 1. 대화방 가져오거나 생성
  useEffect(() => {
    if (!trainerId || !memberId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const result = await getOrCreateConversation(trainerId, memberId)
      if (cancelled) return
      if (!result.success) {
        alert('채팅방을 열 수 없습니다: ' + result.error)
        setLoading(false)
        return
      }
      setConversationId(result.data.id)
    })()
    return () => { cancelled = true }
  }, [trainerId, memberId])

  // 2. 메시지 로드 + Realtime 구독 + 읽음 처리
  useEffect(() => {
    if (!conversationId) return

    let cancelled = false

    ;(async () => {
      const list = await loadMessages(conversationId)
      if (cancelled) return
      setMessages(list)
      setLoading(false)
      // 진입 시 읽음 처리
      await markMessagesRead(conversationId, viewerType)
    })()

    // Realtime - 새 메시지
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new
          setMessages(prev => {
            // 중복 방지
            if (prev.some(m => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
          // 상대방이 보낸 거면 즉시 읽음 처리
          if (newMsg.sender_type !== viewerType) {
            markMessagesRead(conversationId, viewerType)
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      cancelled = true
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [conversationId, viewerType])

  // 메시지 추가될 때마다 맨 아래로 스크롤
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages.length])

  const handleSend = async () => {
    const text = inputText.trim()
    if (!text || sending || !conversationId) return
    setSending(true)
    const result = await sendMessage({
      conversationId,
      senderType: viewerType,
      senderId: viewerId,
      content: text,
    })
    setSending(false)
    if (!result.success) {
      alert('전송 실패: ' + result.error)
      return
    }
    setInputText('')
    // Realtime이 자동으로 추가해주지만, 본인이 보낸 건 즉시 보여주기 위해 미리 추가
    setMessages(prev => {
      if (prev.some(m => m.id === result.data.id)) return prev
      return [...prev, result.data]
    })
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !conversationId) return

    if (ptIsZero) {
      alert('PT 잔여 횟수가 없어 사진 전송이 제한됩니다.')
      return
    }

    // 100MB 제한
    if (file.size > 100 * 1024 * 1024) {
      alert('파일 크기는 100MB 이하만 가능합니다.')
      return
    }

    setUploading(true)
    const upload = await uploadChatImage(conversationId, viewerId, file)
    if (!upload.success) {
      setUploading(false)
      alert('업로드 실패: ' + upload.error)
      return
    }

    const result = await sendMessage({
      conversationId,
      senderType: viewerType,
      senderId: viewerId,
      mediaUrl: upload.url,
      mediaType: 'image',
    })
    setUploading(false)
    if (!result.success) {
      alert('전송 실패: ' + result.error)
      return
    }
    setMessages(prev => {
      if (prev.some(m => m.id === result.data.id)) return prev
      return [...prev, result.data]
    })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
      }}
    >
      <div
        style={{
          background: '#F0F7F4',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '420px',
          height: '90vh',
          maxHeight: '700px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: `0.5px solid ${THEME.border}`,
        }}
      >
        {/* 헤더 */}
        <div style={{
          background: '#FFF',
          padding: '12px 14px',
          borderBottom: `0.5px solid ${THEME.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0,
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: THEME.primaryAccent,
            color: THEME.primaryDark,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '13px',
            fontWeight: '500',
            flexShrink: 0,
          }}>
            {getInitial(otherName)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '13px', fontWeight: '500', color: THEME.text, margin: 0, lineHeight: 1.2 }}>
              {otherName}
            </p>
            <p style={{ fontSize: '10px', color: THEME.textSub, margin: '2px 0 0', lineHeight: 1 }}>
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: THEME.surplus, marginRight: '4px' }} />
              연결됨
            </p>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        {/* 메시지 영역 */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 12px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: THEME.textSub, fontSize: '12px', padding: '20px' }}>불러오는 중...</p>
          ) : messages.length === 0 ? (
            <p style={{ textAlign: 'center', color: THEME.textHint, fontSize: '12px', padding: '40px 20px', margin: 'auto' }}>
              아직 메시지가 없습니다.<br/>
              먼저 인사를 보내보세요!
            </p>
          ) : (
            messages.map((m, idx) => {
              const isSelf = m.sender_type === viewerType
              const showDate = needsDateDivider(messages[idx - 1], m)
              const hasMedia = !!m.media_url

              return (
                <React.Fragment key={m.id}>
                  {showDate && (
                    <p style={{
                      fontSize: '9px',
                      color: THEME.textHint,
                      textAlign: 'center',
                      margin: '6px 0',
                    }}>
                      {formatDateDivider(m.created_at)}
                    </p>
                  )}
                  <div style={{
                    display: 'flex',
                    gap: '6px',
                    alignItems: 'flex-end',
                    justifyContent: isSelf ? 'flex-end' : 'flex-start',
                  }}>
                    {isSelf && (
                      <span style={{ fontSize: '9px', color: THEME.textHint, flexShrink: 0 }}>
                        {formatTime(m.created_at)}
                      </span>
                    )}
                    {hasMedia ? (
                      <div
                        onClick={() => setPreviewUrl(m.media_url)}
                        style={{
                          background: isSelf ? THEME.primary : '#FFF',
                          padding: '4px',
                          borderRadius: isSelf ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                          maxWidth: '65%',
                          border: isSelf ? 'none' : `0.5px solid ${THEME.border}`,
                          cursor: 'pointer',
                        }}
                      >
                        <img
                          src={m.media_url}
                          alt="채팅 사진"
                          style={{
                            width: '100%',
                            maxHeight: '200px',
                            objectFit: 'cover',
                            borderRadius: '10px',
                            display: 'block',
                          }}
                        />
                      </div>
                    ) : (
                      <div style={{
                        background: isSelf ? THEME.primary : '#FFF',
                        padding: '8px 11px',
                        borderRadius: isSelf ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        maxWidth: '75%',
                        border: isSelf ? 'none' : `0.5px solid ${THEME.border}`,
                      }}>
                        <p style={{
                          fontSize: '12px',
                          color: isSelf ? '#FFF' : THEME.text,
                          margin: 0,
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}>
                          {m.content}
                        </p>
                      </div>
                    )}
                    {!isSelf && (
                      <span style={{ fontSize: '9px', color: THEME.textHint, flexShrink: 0 }}>
                        {formatTime(m.created_at)}
                      </span>
                    )}
                  </div>
                </React.Fragment>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* PT 0회 배너 (사진 차단 안내) */}
        {ptIsZero && (
          <div style={{
            background: THEME.dangerLight,
            padding: '6px 14px',
            borderTop: `0.5px solid ${THEME.danger}`,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0,
          }}>
            <LockIcon />
            <span style={{ fontSize: '10px', color: THEME.dangerDark }}>
              PT 잔여 없음 — 사진 전송 제한
            </span>
          </div>
        )}

        {/* 입력 영역 */}
        <div style={{
          background: '#FFF',
          padding: '10px 12px',
          borderTop: `0.5px solid ${THEME.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
        }}>
          <button
            onClick={() => {
              if (ptIsZero) {
                alert('PT 잔여 횟수가 없어 사진 전송이 제한됩니다.')
                return
              }
              fileInputRef.current?.click()
            }}
            disabled={uploading}
            style={{
              background: ptIsZero ? '#F5F5F0' : THEME.cardAlt,
              border: `0.5px solid ${ptIsZero ? THEME.border : THEME.border}`,
              color: ptIsZero ? THEME.textHint : THEME.primary,
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              cursor: ptIsZero ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              fontFamily: 'inherit',
            }}
            title={ptIsZero ? 'PT 잔여 없음' : '사진 전송'}
          >
            {ptIsZero ? <LockIcon size={14} color={THEME.textHint} /> : <PhotoIcon size={16} color={THEME.primary} />}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={uploading ? '업로드 중...' : '메시지 입력...'}
            disabled={sending || uploading}
            style={{
              flex: 1,
              background: THEME.cardAlt,
              border: `0.5px solid ${THEME.border}`,
              borderRadius: '16px',
              padding: '7px 12px',
              fontSize: '12px',
              color: THEME.text,
              fontFamily: 'inherit',
              outline: 'none',
              minWidth: 0,
            }}
          />

          <button
            onClick={handleSend}
            disabled={!inputText.trim() || sending || uploading}
            style={{
              background: inputText.trim() ? THEME.primary : '#E8E8E0',
              border: 'none',
              color: '#FFF',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              cursor: inputText.trim() ? 'pointer' : 'not-allowed',
              flexShrink: 0,
              fontFamily: 'inherit',
            }}
            title="전송"
          >
            <SendIcon />
          </button>
        </div>
      </div>

      {/* 사진 크게 보기 */}
      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.92)',
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            cursor: 'pointer',
          }}
        >
          <img
            src={previewUrl}
            alt="크게 보기"
            style={{
              maxWidth: '100%',
              maxHeight: '90vh',
              borderRadius: '8px',
            }}
          />
        </div>
      )}
    </div>
  )
}
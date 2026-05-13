import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import {
  THEME, loadNotifications, getUnreadNotificationCount,
  markNotificationRead, markAllNotificationsRead,
  isPushSupported, getPushPermissionStatus, isPushSubscribed,
  subscribeToPush, unsubscribeFromPush,
} from './utils'

const BellIcon = ({ color = THEME.text, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
)

const KIND_COLORS = {
  diet_feedback: THEME.primary,
  chat_message: THEME.nutCarbs,
  inbody_added: THEME.inbodyMuscle,
  today_complete: THEME.warning,
  pt_low_10: THEME.warning,
  pt_low_5: THEME.danger,
}

const KIND_LABELS = {
  diet_feedback: '식단 피드백',
  chat_message: '새 메시지',
  inbody_added: '인바디',
  today_complete: '기록 완료',
  pt_low_10: 'PT 10회 남음',
  pt_low_5: 'PT 5회 남음',
}

const formatRelativeTime = (createdAt) => {
  if (!createdAt) return ''
  const now = new Date()
  const created = new Date(createdAt)
  const diffMs = now - created
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffMin < 1) return '방금'
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffHour < 24) return `${diffHour}시간 전`
  if (diffDay < 7) return `${diffDay}일 전`
  return `${created.getMonth() + 1}/${created.getDate()}`
}

export default function NotificationBell({ userId, userType, onNavigate, size = 30, wide = false }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const channelRef = useRef(null)

  // 푸시 알림 상태
  const [pushStatus, setPushStatus] = useState('default') // 'granted' | 'denied' | 'default' | 'unsupported'
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushToggleLoading, setPushToggleLoading] = useState(false)

  useEffect(() => {
    if (!userId) return

    refreshUnreadCount()
    refreshPushStatus()

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          // 채팅 알림은 🔔에서 제외 (💬 아이콘에서만 표시)
          if (payload.new.kind === 'chat_message') return
          setNotifications(prev => [payload.new, ...prev])
          setUnreadCount(prev => prev + 1)
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
  }, [userId])

  const refreshUnreadCount = async () => {
    const count = await getUnreadNotificationCount(userId)
    setUnreadCount(count)
  }

  const refreshPushStatus = async () => {
    const status = getPushPermissionStatus()
    setPushStatus(status)
    if (status === 'granted') {
      const subscribed = await isPushSubscribed(userId)
      setPushSubscribed(subscribed)
    } else {
      setPushSubscribed(false)
    }
  }

  const openModal = async () => {
    setOpen(true)
    setLoading(true)
    const list = await loadNotifications(userId, 30)
    setNotifications(list)
    setLoading(false)
    await refreshPushStatus()
  }

  const handleItemClick = async (notification) => {
    if (!notification.is_read) {
      await markNotificationRead(notification.id)
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
    if (notification.link && onNavigate) {
      onNavigate(notification.link)
      setOpen(false)
    }
  }

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return
    await markAllNotificationsRead(userId)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  // 푸시 알림 토글
  const handleTogglePush = async () => {
    if (pushToggleLoading) return
    setPushToggleLoading(true)

    if (pushSubscribed) {
      // 구독 해제
      const result = await unsubscribeFromPush(userId)
      if (result.success) {
        setPushSubscribed(false)
        alert('푸시 알림이 꺼졌습니다.')
      } else {
        alert(result.error || '해제 실패')
      }
    } else {
      // 구독 등록
      const result = await subscribeToPush(userId, userType)
      if (result.success) {
        setPushSubscribed(true)
        setPushStatus('granted')
        alert('푸시 알림이 켜졌습니다!\n앱이 꺼져 있어도 알림을 받을 수 있어요.')
      } else {
        alert(result.error || '등록 실패')
        await refreshPushStatus()
      }
    }
    setPushToggleLoading(false)
  }

  // 푸시 상태별 UI 텍스트
  const getPushLabel = () => {
    if (pushStatus === 'unsupported') return '브라우저 미지원'
    if (pushStatus === 'denied') return '권한 거부됨 (설정에서 변경)'
    if (pushSubscribed) return '켜짐'
    return '꺼짐'
  }

  return (
    <>
      <button
        onClick={openModal}
        style={{
          background: '#FFF',
          border: `0.5px solid ${THEME.border}`,
          color: THEME.textSub,
          width: wide ? '100%' : `${size}px`,
          height: `${size}px`,
          borderRadius: wide ? `${Math.round(size / 2)}px` : '50%',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          position: 'relative',
          boxSizing: 'border-box',
        }}
        title="알림"
      >
        <BellIcon color={THEME.textSub} size={Math.round(size * 0.5)} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            background: THEME.danger,
            color: '#FFF',
            borderRadius: '9px',
            minWidth: '16px',
            height: '16px',
            fontSize: '9px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            lineHeight: 1,
            border: '2px solid #FFF',
            boxSizing: 'border-box',
            pointerEvents: 'none',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
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
            {/* 헤더 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 16px',
              borderBottom: `0.5px solid ${THEME.border}`,
              flexShrink: 0,
            }}>
              <p style={{ fontSize: '14px', fontWeight: '500', color: THEME.text, margin: 0 }}>
                알림 {unreadCount > 0 && <span style={{ color: THEME.danger, fontSize: '12px' }}>({unreadCount})</span>}
              </p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: THEME.primary,
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      padding: 0,
                    }}
                  >모두 읽음</button>
                )}
                <button
                  onClick={() => setOpen(false)}
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
            </div>

            {/* 푸시 알림 토글 */}
            {pushStatus !== 'unsupported' && (
              <div style={{
                padding: '10px 16px',
                borderBottom: `0.5px solid ${THEME.border}`,
                background: pushSubscribed ? THEME.primaryLight : THEME.cardAlt,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '12px', fontWeight: '500', color: THEME.text, margin: 0 }}>
                    📱 푸시 알림
                  </p>
                  <p style={{ fontSize: '10px', color: THEME.textSub, margin: '2px 0 0' }}>
                    {pushSubscribed ? '앱이 꺼져 있어도 알림을 받아요' : '앱 밖에서도 알림 받기'}
                  </p>
                </div>
                <button
                  onClick={handleTogglePush}
                  disabled={pushToggleLoading || pushStatus === 'denied'}
                  style={{
                    background: pushSubscribed ? THEME.primary : '#FFF',
                    color: pushSubscribed ? '#FFF' : THEME.primary,
                    border: `0.5px solid ${THEME.primary}`,
                    padding: '6px 12px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '500',
                    cursor: (pushToggleLoading || pushStatus === 'denied') ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    flexShrink: 0,
                    minWidth: '60px',
                  }}
                >
                  {pushToggleLoading ? '처리 중' : getPushLabel()}
                </button>
              </div>
            )}

            {/* 목록 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
              {loading ? (
                <p style={{ textAlign: 'center', color: THEME.textSub, fontSize: '12px', padding: '20px' }}>불러오는 중...</p>
              ) : notifications.length === 0 ? (
                <p style={{ textAlign: 'center', color: THEME.textSub, fontSize: '12px', padding: '40px 20px' }}>
                  알림이 없습니다
                </p>
              ) : (
                notifications.map(n => {
                  const kindColor = KIND_COLORS[n.kind] || THEME.textSub
                  const kindLabel = KIND_LABELS[n.kind] || '알림'
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleItemClick(n)}
                      style={{
                        padding: '11px 16px',
                        borderBottom: `0.5px solid ${THEME.borderLight}`,
                        cursor: 'pointer',
                        background: n.is_read ? '#FFF' : THEME.primaryLight,
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'flex-start',
                      }}
                    >
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: n.is_read ? 'transparent' : THEME.danger,
                        marginTop: '5px',
                        flexShrink: 0,
                        border: n.is_read ? `0.5px solid ${THEME.border}` : 'none',
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
                          <span style={{
                            fontSize: '10px',
                            color: kindColor,
                            fontWeight: '500',
                            background: kindColor + '15',
                            padding: '1px 6px',
                            borderRadius: '3px',
                          }}>
                            {kindLabel}
                          </span>
                          <span style={{ fontSize: '10px', color: THEME.textHint, flexShrink: 0, marginLeft: '8px' }}>
                            {formatRelativeTime(n.created_at)}
                          </span>
                        </div>
                        <p style={{
                          fontSize: '12px',
                          color: n.is_read ? THEME.textSub : THEME.text,
                          margin: 0,
                          fontWeight: n.is_read ? '400' : '500',
                          lineHeight: '1.5',
                        }}>
                          {n.content}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
import React, { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { THEME } from './utils'

// 채팅 헤더 아이콘 옆에 표시되는 미읽음 메시지 합계 배지.
// - 트레이너: 자기 모든 conversations 의 trainer_unread_count 합
// - 회원: 자기 conversations 의 member_unread_count 합
// Realtime 으로 conversations 변경 즉시 반영.
export default function ChatUnreadBadge({ userId, userType }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!userId || !userType) return
    let alive = true

    const field = userType === 'trainer' ? 'trainer_unread_count' : 'member_unread_count'
    const idField = userType === 'trainer' ? 'trainer_id' : 'member_id'

    const load = async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select(field)
        .eq(idField, userId)
      if (error) { console.error('[ChatUnreadBadge] load error:', error); return }
      if (!alive) return
      const total = (data || []).reduce((s, r) => s + (r[field] || 0), 0)
      setCount(total)
    }

    load()

    // 본인 conversations 의 INSERT/UPDATE 즉시 반영
    const channel = supabase
      .channel(`chat-unread-${userType}-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations', filter: `${idField}=eq.${userId}` },
        () => load()
      )
      .subscribe()

    return () => {
      alive = false
      supabase.removeChannel(channel)
    }
  }, [userId, userType])

  if (!count) return null

  return (
    <span style={{
      position: 'absolute',
      top: '2px',
      right: '2px',
      background: THEME.danger,
      color: '#FFF',
      borderRadius: '8px',
      minWidth: '14px',
      height: '14px',
      fontSize: '9px',
      fontWeight: '500',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 3px',
      lineHeight: 1,
      pointerEvents: 'none',
      border: '1.5px solid #FFF',
    }}>
      {count > 99 ? '99+' : count}
    </span>
  )
}

import React, { useState, useRef, useEffect } from 'react'
import { THEME } from './utils'
import { subscribeToPush, dismissPushPrompt } from './utils'
import useModalBackButton from './useModalBackButton'

export default function PushPromptModal({ userId, userType, onClose }) {
  useModalBackButton(true, onClose)
  const [loading, setLoading] = useState(false)
  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  const handleEnable = async () => {
    if (loading) return
    setLoading(true)
    // subscribeToPush 가 hang 되는 경우(브라우저 권한 다이얼로그 무시 등) 영원히
    // 닫히지 않는 문제 방지 — 10초 타임아웃.
    const TIMEOUT_MS = 10000
    let result
    try {
      result = await Promise.race([
        subscribeToPush(userId, userType),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT_MS)),
      ])
    } catch (e) {
      result = { success: false, error: e?.message === 'timeout' ? '응답 시간 초과 — 다시 시도해주세요' : (e?.message || '알 수 없는 오류') }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
    if (!mountedRef.current) return  // "나중에"로 이미 닫힘
    if (result.success) {
      alert('푸시 알림이 켜졌습니다!\n앱이 꺼져 있어도 알림을 받을 수 있어요.')
      onClose()
    } else {
      alert(result.error || '등록 실패')
      // 권한 거절 등 실패도 닫기 (계속 띄우면 짜증)
      dismissPushPrompt(userId)
      onClose()
    }
  }

  const handleLater = () => {
    dismissPushPrompt(userId)
    onClose()
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      zIndex: 1500,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: '#FFF',
        borderRadius: '16px',
        padding: '24px 20px 20px',
        width: '100%',
        maxWidth: '340px',
        textAlign: 'center',
        position: 'relative',
      }}>
        {/* 우상단 닫기 — 진행 중에도 항상 활성. 무한 대기 탈출용 안전망 */}
        <button
          onClick={handleLater}
          aria-label="닫기"
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 28, height: 28, borderRadius: '50%',
            background: 'transparent', border: 'none',
            color: THEME.textSub, fontSize: 18, lineHeight: 1,
            cursor: 'pointer', fontFamily: 'inherit', padding: 0,
          }}
        >✕</button>
        {/* 아이콘 */}
        <div style={{
          width: '56px',
          height: '56px',
          background: THEME.primaryLight,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 14px',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={THEME.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </div>

        {/* 타이틀 */}
        <p style={{
          fontSize: '16px',
          fontWeight: '500',
          color: THEME.text,
          margin: '0 0 8px',
        }}>
          푸시 알림을 켜시겠어요?
        </p>

        {/* 설명 */}
        <p style={{
          fontSize: '12px',
          color: THEME.textSub,
          margin: '0 0 18px',
          lineHeight: 1.6,
        }}>
          앱이 꺼져 있어도 새 메시지, 식단 피드백,<br/>
          PT 알림을 바로 받을 수 있어요.
        </p>

        {/* 버튼 */}
        <button
          onClick={handleEnable}
          disabled={loading}
          style={{
            width: '100%',
            background: THEME.primary,
            color: '#FFF',
            border: 'none',
            padding: '13px',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            fontFamily: 'inherit',
            marginBottom: '8px',
          }}
        >
          {loading ? '설정 중...' : '알림 켜기'}
        </button>
        <button
          onClick={handleLater}
          style={{
            width: '100%',
            background: '#FFF',
            color: THEME.textSub,
            border: 'none',
            padding: '10px',
            borderRadius: '10px',
            fontSize: '12px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          나중에
        </button>

        {/* 안내 문구 */}
        <p style={{
          fontSize: '10px',
          color: THEME.textHint,
          margin: '12px 0 0',
          lineHeight: 1.5,
        }}>
          알림 종(🔔)에서 언제든 켜고 끌 수 있어요
        </p>
      </div>
    </div>
  )
}
import React, { useEffect, useState } from 'react'
import { THEME, loadSubscription, summarizeSubscription } from './utils'
import useModalBackButton from './useModalBackButton'

// 구독 상태 + 플랜 안내 모달.
// - 현재 상태(trial / active / expired) 표시
// - 플랜 안내 (월 ₩9,900)
// - [지금 구독하기] 버튼 — 실제 결제 연동은 추후 (토스페이먼츠)
//   사업자 등록 + 토스 가맹점 가입 끝나면 onSubscribe 핸들러에 결제 위젯 연결.
export default function SubscriptionModal({ trainerId, onClose }) {
  useModalBackButton(true, onClose)

  const [sub, setSub] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    loadSubscription(trainerId).then(data => {
      if (alive) { setSub(data); setLoading(false) }
    })
    return () => { alive = false }
  }, [trainerId])

  const info = summarizeSubscription(sub)

  const stateConfig = {
    trial: { bg: THEME.primaryLight, color: THEME.primaryDark, icon: '⏳' },
    active: { bg: '#E8F4ED', color: '#1F6B3A', icon: '✓' },
    expired: { bg: THEME.dangerLight, color: THEME.dangerDark, icon: '!' },
  }
  const cfg = stateConfig[info.state] || stateConfig.expired

  const handleSubscribe = () => {
    // TODO: 토스페이먼츠 가맹점 가입 후 결제 위젯 연동
    alert('정식 결제 시스템은 곧 오픈됩니다.\n베타 기간 동안은 무료 체험이 유지됩니다.')
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 1100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    }}>
      <div style={{
        background: '#FFF', borderRadius: '14px',
        width: '100%', maxWidth: '360px', maxHeight: '85vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 16px', borderBottom: `0.5px solid ${THEME.border}`,
        }}>
          <p style={{ fontSize: '14px', fontWeight: '500', color: THEME.primary, margin: 0 }}>구독 관리</p>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer',
            color: THEME.textSub, padding: '0 4px', lineHeight: 1,
          }}>✕</button>
        </div>

        <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <p style={{ fontSize: '12px', color: THEME.textHint, textAlign: 'center', padding: '20px 0' }}>로딩 중…</p>
          ) : (
            <>
              {/* 현재 상태 */}
              <div style={{
                background: cfg.bg, borderRadius: '12px', padding: '14px',
                textAlign: 'center', marginBottom: '14px',
              }}>
                <div style={{ fontSize: '22px', marginBottom: '4px' }}>{cfg.icon}</div>
                <p style={{ fontSize: '14px', fontWeight: '500', color: cfg.color, margin: '0 0 4px' }}>
                  {info.label}
                </p>
                {info.expiresAt && (
                  <p style={{ fontSize: '11px', color: cfg.color, opacity: 0.8, margin: 0 }}>
                    만료일: {info.expiresAt.toISOString().slice(0, 10).replace(/-/g, '.')}
                  </p>
                )}
              </div>

              {/* 플랜 안내 */}
              <div style={{
                border: `0.5px solid ${THEME.primaryAccent}`, borderRadius: '12px',
                padding: '14px', marginBottom: '14px',
              }}>
                <p style={{ fontSize: '11px', color: THEME.textSub, fontWeight: '500', margin: '0 0 4px' }}>월 구독 플랜</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '24px', fontWeight: '500', color: THEME.primary, letterSpacing: '-0.5px' }}>
                    9,900
                  </span>
                  <span style={{ fontSize: '12px', color: THEME.textSub }}>원 / 월</span>
                </div>
                <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: '11px', color: THEME.text, lineHeight: 1.7 }}>
                  <li>무제한 회원 등록</li>
                  <li>운동·식단·인바디 기록 무제한</li>
                  <li>채팅·푸시 알림</li>
                  <li>30일 무료 체험 포함</li>
                </ul>
              </div>

              {/* CTA */}
              {info.state !== 'active' && (
                <button
                  onClick={handleSubscribe}
                  style={{
                    width: '100%', background: THEME.primary, color: '#FFF', border: 'none',
                    padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: '500',
                    cursor: 'pointer', fontFamily: 'inherit', marginBottom: '8px',
                  }}
                >지금 구독하기</button>
              )}

              <p style={{ fontSize: '10px', color: THEME.textHint, textAlign: 'center', margin: '8px 0 0', lineHeight: 1.5 }}>
                정식 결제 시스템은 곧 오픈 예정.<br/>
                베타 기간 동안 무료 체험이 유지됩니다.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

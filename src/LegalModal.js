import React from 'react'
import { THEME } from './utils'
import { TERMS_OF_SERVICE, PRIVACY_POLICY, REFUND_POLICY, TERMS_VERSION } from './legal'
import useModalBackButton from './useModalBackButton'

// 약관 / 개인정보 처리방침 / 환불 정책 텍스트 표시용 모달.
// kind: 'terms' | 'privacy' | 'refund'
export default function LegalModal({ kind, onClose }) {
  useModalBackButton(true, onClose)

  const title = kind === 'terms' ? '서비스 이용약관'
              : kind === 'privacy' ? '개인정보 처리방침'
              : kind === 'refund' ? '환불 정책'
              : '안내'
  const body = kind === 'terms' ? TERMS_OF_SERVICE
             : kind === 'privacy' ? PRIVACY_POLICY
             : kind === 'refund' ? REFUND_POLICY
             : ''

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', zIndex: 1200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          background: '#FFF',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 16px',
          background: '#FFF',
          borderBottom: `0.5px solid ${THEME.border}`,
          flexShrink: 0,
        }}>
          <p style={{ fontSize: '14px', fontWeight: '500', color: THEME.primary, margin: 0 }}>
            {title}
          </p>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: THEME.textSub, padding: '0 4px', lineHeight: 1 }}
          >✕</button>
        </div>
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 16px',
        }}>
          <pre style={{
            margin: 0,
            fontSize: '12px',
            color: THEME.text,
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            fontFamily: 'inherit',
          }}>{body}</pre>
          <p style={{ fontSize: '10px', color: THEME.textHint, marginTop: '14px', textAlign: 'right' }}>
            최종 개정일: {TERMS_VERSION}
          </p>
        </div>
        <div style={{
          padding: '10px 16px',
          borderTop: `0.5px solid ${THEME.border}`,
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              background: THEME.primary,
              color: '#FFF',
              border: 'none',
              padding: '10px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >확인</button>
        </div>
      </div>
    </div>
  )
}

import React from 'react'
import { THEME } from './utils'

// 모달 우상단 닫기 버튼 — 모든 모달에서 동일 디자인 사용.
// 사용: <CloseButton onClick={onClose} />
export default function CloseButton({ onClick, size = 32, color, ariaLabel = '닫기' }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      type="button"
      style={{
        background: 'transparent',
        border: 'none',
        color: color || THEME.textSub,
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: 0,
        flexShrink: 0,
        transition: 'background 0.12s ease',
        outline: 'none',
        fontFamily: 'inherit',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = THEME.borderLight }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <svg
        width={Math.round(size * 0.4)}
        height={Math.round(size * 0.4)}
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      >
        <line x1="3" y1="3" x2="11" y2="11" />
        <line x1="11" y1="3" x2="3" y2="11" />
      </svg>
    </button>
  )
}

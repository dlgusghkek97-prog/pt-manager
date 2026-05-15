import React, { useState } from 'react'
import { THEME } from './utils'
import useModalBackButton from './useModalBackButton'
import CloseButton from './CloseButton'

// 작은 ? 도움말 칩 — 카드 타이틀 옆 등에 배치.
// 클릭하면 컨텍스트별 짧은 설명 모달 띄움.
//
// 사용:
//   <HelpDot title="운동 기록" items={[
//     '부위·종목·무게·횟수 입력',
//     '입력칸 떠나면 자동 저장 (별도 저장 버튼 없음)',
//     '사진/영상 첨부 가능 (영상 100MB 이하)',
//   ]} />
export default function HelpDot({ title, items = [], size = 18 }) {
  const [open, setOpen] = useState(false)
  useModalBackButton(open, () => setOpen(false))

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        aria-label={`${title} 도움말`}
        type="button"
        style={{
          background: THEME.primaryLight,
          border: `0.5px solid ${THEME.primaryAccent}`,
          color: THEME.primary,
          width: size,
          height: size,
          borderRadius: '50%',
          fontSize: `${Math.round(size * 0.65)}px`,
          fontWeight: 600,
          cursor: 'pointer',
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
          flexShrink: 0,
          fontFamily: 'inherit',
          marginLeft: 6,
          verticalAlign: 'middle',
        }}
      >?</button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.45)', zIndex: 1100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#FFF', borderRadius: 14,
              width: '100%', maxWidth: 360, maxHeight: '80vh',
              overflowY: 'auto', padding: '16px 18px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: THEME.primary, margin: 0, letterSpacing: '-0.2px' }}>
                {title}
              </p>
              <CloseButton onClick={() => setOpen(false)} size={28} />
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((it, i) => (
                <li key={i} style={{
                  fontSize: 12, color: THEME.text, lineHeight: 1.6,
                  paddingLeft: 14, position: 'relative',
                }}>
                  <span style={{ position: 'absolute', left: 0, top: 8, width: 4, height: 4, borderRadius: '50%', background: THEME.primary }} />
                  {it}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}

import React, { useRef } from 'react'
import { THEME } from './utils'

export default function DatePicker({ value, onChange, showTodayButton = true }) {
  const inputRef = useRef(null)

  const today = new Date().toISOString().split('T')[0]
  const isToday = value === today

  const moveDate = (days) => {
    const d = new Date(value)
    d.setDate(d.getDate() + days)
    onChange(d.toISOString().split('T')[0])
  }

  const goToday = () => onChange(today)

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-')
    return `${y}. ${m}. ${d}`
  }

  const openPicker = () => {
    if (inputRef.current) {
      try { inputRef.current.showPicker() }
      catch { inputRef.current.click() }
    }
  }

  return (
    <div style={{
      background: '#FFF',
      borderRadius: '10px',
      border: `0.5px solid ${THEME.border}`,
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      height: '38px',
      fontFamily: 'inherit'
    }}>
      <button
        onClick={() => moveDate(-1)}
        style={{ background: 'transparent', border: 'none', color: THEME.primary, fontSize: '13px', width: '36px', height: '100%', cursor: 'pointer', fontWeight: '600', padding: 0 }}
      >◀</button>

      <div
        onClick={openPicker}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          height: '100%',
          borderLeft: '0.5px solid #eee',
          borderRight: '0.5px solid #eee',
          cursor: 'pointer',
          position: 'relative'
        }}
      >
        <span style={{ fontSize: '14px', fontWeight: '600', color: THEME.text, letterSpacing: '0.3px' }}>
          {formatDate(value)}
        </span>
        {!isToday && showTodayButton && (
          <span
            onClick={(e) => { e.stopPropagation(); goToday() }}
            style={{ background: THEME.primary, color: '#FFF', fontSize: '10px', fontWeight: '500', padding: '3px 8px', borderRadius: '10px', cursor: 'pointer' }}
          >오늘로</span>
        )}
        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            position: 'absolute',
            opacity: 0,
            pointerEvents: 'none',
            width: 0,
            height: 0
          }}
        />
      </div>

      <button
        onClick={() => moveDate(1)}
        style={{ background: 'transparent', border: 'none', color: THEME.primary, fontSize: '13px', width: '36px', height: '100%', cursor: 'pointer', fontWeight: '600', padding: 0 }}
      >▶</button>
    </div>
  )
}
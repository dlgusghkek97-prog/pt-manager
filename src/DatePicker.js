import React, { useRef } from 'react'
import { THEME } from './utils'

export default function DatePicker({ value, onChange, mode = 'day', showTodayButton = true }) {
  const inputRef = useRef(null)

  const today = new Date().toISOString().split('T')[0]

  const getCurrentValue = () => {
    if (mode === 'day') return value || today
    if (mode === 'week') return value || getCurrentWeekKey()
    if (mode === 'month') return value || today.substring(0, 7)
    if (mode === 'year') return value || String(new Date().getFullYear())
    return value
  }

  const getCurrentWeekKey = () => {
    const d = new Date()
    return getWeekKey(d)
  }

  const getWeekKey = (date) => {
    const y = date.getFullYear()
    const m = date.getMonth() + 1
    const day = date.getDate()
    const weekNum = Math.ceil(day / 7)
    return `${y}-${String(m).padStart(2, '0')}-W${weekNum}`
  }

  const isToday = () => {
    if (mode === 'day') return getCurrentValue() === today
    if (mode === 'month') return getCurrentValue() === today.substring(0, 7)
    if (mode === 'week') return getCurrentValue() === getCurrentWeekKey()
    if (mode === 'year') return getCurrentValue() === String(new Date().getFullYear())
    return false
  }

  const moveDate = (offset) => {
    if (typeof onChange !== 'function') return
    const v = getCurrentValue()
    if (mode === 'day') {
      const d = new Date(v)
      d.setDate(d.getDate() + offset)
      onChange(d.toISOString().split('T')[0])
    } else if (mode === 'month') {
      const [y, m] = v.split('-').map(Number)
      const d = new Date(y, m - 1 + offset, 1)
      onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    } else if (mode === 'week') {
      const m = v.match(/^(\d+)-(\d+)-W(\d+)$/)
      if (!m) return
      let [, y, mo, w] = m.map(Number)
      w += offset
      while (w > 5) { mo += 1; w -= 5; if (mo > 12) { y += 1; mo = 1 } }
      while (w < 1) { mo -= 1; w += 5; if (mo < 1) { y -= 1; mo = 12 } }
      onChange(`${y}-${String(mo).padStart(2, '0')}-W${w}`)
    } else if (mode === 'year') {
      const y = parseInt(v) + offset
      onChange(String(y))
    }
  }

  const goToday = () => {
    if (typeof onChange !== 'function') return
    if (mode === 'day') onChange(today)
    else if (mode === 'month') onChange(today.substring(0, 7))
    else if (mode === 'week') onChange(getCurrentWeekKey())
    else if (mode === 'year') onChange(String(new Date().getFullYear()))
  }

  const formatLabel = () => {
    const v = getCurrentValue()
    if (!v) return ''
    if (mode === 'day') {
      const [y, m, d] = v.split('-')
      return `${y}. ${m}. ${d}`
    }
    if (mode === 'month') {
      const [y, m] = v.split('-')
      return `${y}년 ${parseInt(m)}월`
    }
    if (mode === 'week') {
      const match = v.match(/^(\d+)-(\d+)-W(\d+)$/)
      if (!match) return v
      const [, y, mo, w] = match
      return `${y}.${parseInt(mo)}월 ${parseInt(w)}주차`
    }
    if (mode === 'year') {
      return `${v}년`
    }
    return v
  }

  const todayLabel = () => {
    if (mode === 'day') return '오늘로'
    if (mode === 'month') return '이번달'
    if (mode === 'week') return '이번주'
    if (mode === 'year') return '올해'
    return '오늘로'
  }

  const openPicker = () => {
    if (mode !== 'day') return
    if (inputRef.current) {
      try { inputRef.current.showPicker() }
      catch { inputRef.current.click() }
    }
  }

  const showToday = !isToday() && showTodayButton

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit' }}>
      <div style={{
        flex: 1,
        background: '#FFF',
        borderRadius: '10px',
        border: `0.5px solid ${THEME.border}`,
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        height: '38px'
      }}>
        <button
          onClick={() => moveDate(-1)}
          style={{ background: 'transparent', border: 'none', color: THEME.primary, fontSize: '13px', width: '36px', height: '100%', cursor: 'pointer', fontWeight: '600', padding: 0, flexShrink: 0 }}
        >◀</button>

        <div
          onClick={openPicker}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            borderLeft: '0.5px solid #eee',
            borderRight: '0.5px solid #eee',
            cursor: mode === 'day' && typeof onChange === 'function' ? 'pointer' : 'default',
            position: 'relative'
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: '600', color: THEME.text, letterSpacing: '0.3px' }}>
            {formatLabel()}
          </span>
          {mode === 'day' && (
            <input
              ref={inputRef}
              type="date"
              value={value || today}
              onChange={e => typeof onChange === 'function' && onChange(e.target.value)}
              style={{
                position: 'absolute',
                opacity: 0,
                pointerEvents: 'none',
                width: 0,
                height: 0
              }}
            />
          )}
        </div>

        <button
          onClick={() => moveDate(1)}
          style={{ background: 'transparent', border: 'none', color: THEME.primary, fontSize: '13px', width: '36px', height: '100%', cursor: 'pointer', fontWeight: '600', padding: 0, flexShrink: 0 }}
        >▶</button>
      </div>

      {showToday && (
        <button
          onClick={goToday}
          style={{
            background: THEME.primary,
            color: '#FFF',
            border: 'none',
            padding: '0 12px',
            height: '38px',
            borderRadius: '10px',
            fontSize: '11px',
            fontWeight: '500',
            cursor: 'pointer',
            flexShrink: 0,
            whiteSpace: 'nowrap'
          }}
        >{todayLabel()}</button>
      )}
    </div>
  )
}
import { useState, useEffect, useMemo } from 'react'
import {
  THEME, SPACING, FONT, RADIUS, BTN_HEIGHT,
  loadInbody, loadInbodyMerged,
  addInbody, updateInbody, deleteInbody, getInbodyStats,
} from './utils'
import useModalBackButton from './useModalBackButton'
import CloseButton from './CloseButton'

// ─── 통합 인바디 모달 — [입력] / [추이] 탭 ───
// props:
//   user        : 입력 주체 (회원/트레이너 본인)
//   memberId    : 대상 회원 UUID (트레이너가 회원 인바디 입력/조회 시)
//   isOpen      : 표시 여부
//   defaultView : 'input' | 'chart' — 진입 시 기본 탭
//   onClose     : 닫기 콜백
//   table       : 'member_inbody' | 'trainer_inbody'
//   idField     : 'member_id' | 'trainer_id'

// ─── 미니멀 디자인 토큰 적용 ───
const overlay = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.5)', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: SPACING.md,
}
const modal = {
  background: THEME.card, borderRadius: RADIUS.lg,
  width: '100%', maxWidth: '440px',
  maxHeight: '90vh', overflowY: 'auto',
  padding: `${SPACING.lg}px ${SPACING.lg}px ${SPACING.md}px`,
  boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
}
const headerStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginBottom: SPACING.md,
}
const titleStyle = {
  fontSize: `${FONT.xxl}px`, fontWeight: 500, color: THEME.text,
  margin: 0, letterSpacing: '-0.3px',
}
const closeBtn = {
  background: 'transparent', border: 'none', fontSize: '20px',
  color: THEME.textSub, cursor: 'pointer', padding: '2px 6px',
  lineHeight: 1, fontFamily: 'inherit',
}
const labelStyle = {
  display: 'block', fontSize: `${FONT.sm}px`, color: THEME.textSub,
  marginBottom: SPACING.xs, fontWeight: 500,
}
const inputStyle = {
  width: '100%', padding: '9px 11px', borderRadius: RADIUS.sm,
  border: `0.5px solid ${THEME.border}`, fontSize: `${FONT.lg}px`,
  background: '#FFF', boxSizing: 'border-box', outline: 'none',
  fontFamily: 'inherit', color: THEME.text,
}
const btnPrimary = {
  flex: 1, height: BTN_HEIGHT.md, borderRadius: RADIUS.md, border: 'none',
  background: THEME.primary, color: '#FFF', fontSize: `${FONT.lg}px`,
  fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
}
const btnDanger = {
  flex: 1, height: BTN_HEIGHT.md, borderRadius: RADIUS.md, border: 'none',
  background: THEME.danger, color: '#FFF', fontSize: `${FONT.lg}px`,
  fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
}
const btnSecondary = {
  flex: 1, height: BTN_HEIGHT.md, borderRadius: RADIUS.md,
  border: `0.5px solid ${THEME.border}`, background: '#FFF',
  color: THEME.textSub, fontSize: `${FONT.lg}px`, cursor: 'pointer',
  fontFamily: 'inherit',
}

// 메인 [입력][추이] 탭
const mainTab = (active) => ({
  flex: 1, height: BTN_HEIGHT.sm, borderRadius: RADIUS.sm,
  border: 'none', cursor: 'pointer',
  background: active ? '#FFF' : 'transparent',
  color: active ? THEME.primaryDark : THEME.textSub,
  fontSize: `${FONT.md}px`, fontWeight: active ? 500 : 400,
  fontFamily: 'inherit', transition: 'background 0.15s',
})

// 메트릭 탭 (추이 내부)
const metricTab = (active, color) => ({
  flex: 1, padding: '7px 4px', borderRadius: RADIUS.sm,
  border: 'none', cursor: 'pointer',
  background: active ? color : THEME.cardAlt,
  color: active ? '#FFF' : THEME.textSub,
  fontSize: `${FONT.sm}px`, fontWeight: active ? 500 : 400,
  fontFamily: 'inherit',
})

const sourceBadge = (source) => ({
  display: 'inline-block', padding: '1px 5px',
  borderRadius: RADIUS.sm, fontSize: `${FONT.xxs}px`, fontWeight: 500,
  background: source === 'trainer' ? THEME.primaryLight : THEME.warningLight,
  color: source === 'trainer' ? THEME.primaryDark : THEME.warningText,
  marginRight: SPACING.xs,
})

const METRICS = {
  weight:           { key: 'weight',           label: '체중',     unit: 'kg', color: THEME.inbodyWeight },
  muscle_mass:      { key: 'muscle_mass',      label: '골격근량', unit: 'kg', color: THEME.inbodyMuscle },
  body_fat_mass:    { key: 'body_fat_mass',    label: '체지방량', unit: 'kg', color: THEME.inbodyFat },
  body_fat_percent: { key: 'body_fat_percent', label: '체지방률', unit: '%',  color: THEME.inbodyFat },
}

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const shortDate = (s) => {
  if (!s) return ''
  const p = s.split('-')
  return p.length === 3 ? `${parseInt(p[1])}/${parseInt(p[2])}` : s
}

// ─── 라인 차트 ───
function LineChart({ data, metric, height = 170, showXLabels = true }) {
  const W = 420
  const H = height
  const padL = 38, padR = 16, padT = 18, padB = showXLabels ? 28 : 12
  const chartW = W - padL - padR
  const chartH = H - padT - padB

  if (!data || data.length === 0) {
    return (
      <div style={{
        height: `${H}px`, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        color: THEME.textHint, fontSize: `${FONT.md}px`,
        background: THEME.cardAlt, borderRadius: RADIUS.sm,
      }}>측정 기록이 없습니다</div>
    )
  }

  const allValues = data.map(d => parseFloat(d[metric.key])).filter(v => !isNaN(v) && v > 0)
  if (allValues.length === 0) {
    return (
      <div style={{
        height: `${H}px`, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        color: THEME.textHint, fontSize: `${FONT.md}px`,
        background: THEME.cardAlt, borderRadius: RADIUS.sm,
      }}>표시할 데이터가 없습니다</div>
    )
  }

  const minV = Math.min(...allValues)
  const maxV = Math.max(...allValues)
  const range = maxV - minV || Math.max(maxV * 0.1, 1)
  const yMin = minV - range * 0.2
  const yMax = maxV + range * 0.25
  const yRange = yMax - yMin || 1

  const xPos = (i) => data.length === 1 ? padL + chartW / 2 : padL + (i / (data.length - 1)) * chartW
  const yPos = (v) => padT + chartH - ((v - yMin) / yRange) * chartH

  const yTicks = []
  for (let i = 0; i <= 3; i++) yTicks.push(yMin + (yRange * i / 3))

  const points = data
    .map((d, i) => {
      const v = parseFloat(d[metric.key])
      if (isNaN(v) || v <= 0) return null
      return { x: xPos(i), y: yPos(v), v, date: d.measured_date, source: d._source }
    })
    .filter(Boolean)

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} preserveAspectRatio="xMidYMid meet">
      {yTicks.map((v, i) => (
        <g key={`yt-${i}`}>
          <line x1={padL} y1={yPos(v)} x2={W - padR} y2={yPos(v)} stroke={THEME.borderLight} strokeWidth="1" />
          <text x={padL - 6} y={yPos(v) + 3} fontSize="9" fill={THEME.textHint} textAnchor="end">{v.toFixed(1)}</text>
        </g>
      ))}
      {points.length > 0 && (
        <g>
          <path d={linePath} stroke={metric.color} strokeWidth="1.8" fill="none" />
          {points.map((p, i) => (
            <g key={`p-${i}`}>
              {p.source === 'trainer'
                ? <rect x={p.x - 4} y={p.y - 4} width="8" height="8" fill={metric.color} stroke="#FFF" strokeWidth="1.5" />
                : <circle cx={p.x} cy={p.y} r="4" fill={metric.color} stroke="#FFF" strokeWidth="1.5" />}
              <text x={p.x} y={p.y - 9} fontSize="10" fontWeight="500" fill={metric.color} textAnchor="middle">{p.v.toFixed(1)}</text>
            </g>
          ))}
        </g>
      )}
      {showXLabels && data.map((d, i) => {
        const show = data.length <= 6 || i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)
        if (!show) return null
        return <text key={`xl-${i}`} x={xPos(i)} y={H - 10} fontSize="10" fill={THEME.textSub} textAnchor="middle">{shortDate(d.measured_date)}</text>
      })}
    </svg>
  )
}

function MiniMetricChart({ data, metric, isLast }) {
  const stat = getInbodyStats(data, metric.key)
  return (
    <div style={{ background: THEME.cardAlt, borderRadius: RADIUS.sm, padding: '7px 9px 5px', marginBottom: isLast ? 0 : SPACING.xs + 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <span style={{ fontSize: `${FONT.sm}px`, color: metric.color, fontWeight: 500 }}>{metric.label}</span>
        <span style={{ fontSize: `${FONT.sm}px`, color: THEME.text }}>
          <span style={{ fontWeight: 500 }}>{stat.current.toFixed(1)}</span>
          <span style={{ color: THEME.textSub, fontSize: '9px', marginLeft: 2 }}>{metric.unit}</span>
        </span>
      </div>
      <LineChart data={data} metric={metric} height={75} showXLabels={isLast} />
    </div>
  )
}

// ─── 메인 컴포넌트 ───
export default function InbodyModal({
  user, memberId, isOpen, defaultView = 'input', onClose,
  table = 'member_inbody', idField = 'member_id',
}) {
  useModalBackButton(isOpen, onClose)

  const [view, setView] = useState(defaultView)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editTable, setEditTable] = useState(null)
  const [form, setForm] = useState({
    measured_date: today(), weight: '', muscle_mass: '',
    body_fat_mass: '', body_fat_percent: '',
  })
  const [activeMetric, setActiveMetric] = useState('all')

  const isTrainerInput = table === 'trainer_inbody'

  // 데이터 로드 — 두 view 모두 사용 가능하게 추이용으로 항상 merged
  const reload = async () => {
    setLoading(true)
    try {
      if (isTrainerInput) {
        // 트레이너 화면 → 추이는 회원의 모든 (회원+트레이너) 데이터, 입력 리스트는 본인이 입력한 것만
        if (memberId) {
          const mergedData = await loadInbodyMerged(memberId)
          setRecords(mergedData)
        } else {
          const data = await loadInbody(user.id, table, idField)
          setRecords(data)
        }
      } else {
        // 회원 본인 화면 — 본인의 모든 인바디 (트레이너가 측정해준 거 포함)
        const mergedData = await loadInbodyMerged(user.id)
        setRecords(mergedData)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    setView(defaultView)
    setActiveMetric('all')
    setEditId(null); setEditTable(null)
    setForm({ measured_date: today(), weight: '', muscle_mass: '', body_fat_mass: '', body_fat_percent: '' })
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user?.id, memberId, table, defaultView])

  const handleChange = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async () => {
    if (!form.measured_date || !form.weight || !form.muscle_mass || !form.body_fat_mass || !form.body_fat_percent) {
      alert('모든 항목을 입력해주세요'); return
    }
    setLoading(true)
    const wasNew = !editId
    let result
    if (editId) {
      result = await updateInbody(editId, form, editTable || table)
    } else {
      const extra = isTrainerInput && memberId ? { member_id: memberId } : {}
      result = await addInbody(user.id, form, table, idField, extra)
    }
    setLoading(false)
    if (!result.success) { alert(result.error || '저장 실패'); return }

    // 회원 본인 입력 → 트레이너에게 알림
    if (wasNew && !isTrainerInput && user.trainer_id) {
      const { sendNotification } = await import('./utils')
      await sendNotification({
        recipientType: 'trainer',
        recipientId: user.trainer_id,
        senderType: 'member',
        kind: 'inbody',
        content: `${user.name || '회원'} 님이 인바디를 입력했습니다`,
        link: 'inbody',
      })
    }

    setEditId(null); setEditTable(null)
    setForm({ measured_date: today(), weight: '', muscle_mass: '', body_fat_mass: '', body_fat_percent: '' })
    await reload()
  }

  const handleEdit = (r) => {
    setEditId(r.id)
    setEditTable(r._table || table)
    setForm({
      measured_date: r.measured_date,
      weight: String(r.weight),
      muscle_mass: String(r.muscle_mass),
      body_fat_mass: r.body_fat_mass != null ? String(r.body_fat_mass) : '',
      body_fat_percent: String(r.body_fat_percent),
    })
  }

  const handleDelete = async () => {
    if (!editId) return
    if (!window.confirm('이 측정 기록을 삭제하시겠습니까?')) return
    setLoading(true)
    const result = await deleteInbody(editId, editTable || table)
    setLoading(false)
    if (!result.success) { alert(result.error || '삭제 실패'); return }
    setEditId(null); setEditTable(null)
    setForm({ measured_date: today(), weight: '', muscle_mass: '', body_fat_mass: '', body_fat_percent: '' })
    await reload()
  }

  const handleCancelEdit = () => {
    setEditId(null); setEditTable(null)
    setForm({ measured_date: today(), weight: '', muscle_mass: '', body_fat_mass: '', body_fat_percent: '' })
  }

  const stats = useMemo(() => ({
    weight: getInbodyStats(records, 'weight'),
    muscle_mass: getInbodyStats(records, 'muscle_mass'),
    body_fat_mass: getInbodyStats(records, 'body_fat_mass'),
    body_fat_percent: getInbodyStats(records, 'body_fat_percent'),
  }), [records])

  // 입력 탭에서는 본인 입력 기록만 (수정용)
  const myRecords = useMemo(() => {
    if (!records) return []
    if (isTrainerInput) {
      // 트레이너가 본인이 측정한 것
      return records.filter(r => r._source === 'trainer' || r._table === 'trainer_inbody')
    }
    return records.filter(r => r._source === 'member' || r._table === 'member_inbody')
  }, [records, isTrainerInput])

  if (!isOpen) return null

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={headerStyle}>
          <h3 style={titleStyle}>인바디</h3>
          <CloseButton onClick={onClose} />
        </div>

        {/* 입력 / 추이 메인 탭 */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACING.xs,
          marginBottom: SPACING.md, background: THEME.borderLight,
          padding: SPACING.xs, borderRadius: RADIUS.md,
        }}>
          <button style={mainTab(view === 'input')} onClick={() => setView('input')}>입력</button>
          <button style={mainTab(view === 'chart')} onClick={() => setView('chart')}>추이</button>
        </div>

        {/* ─── 입력 탭 ─── */}
        {view === 'input' && (
          <>
            <div style={{ marginBottom: SPACING.md }}>
              <label style={labelStyle}>측정일</label>
              <input type="date" style={inputStyle} value={form.measured_date} onChange={e => handleChange('measured_date', e.target.value)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACING.md, marginBottom: SPACING.md }}>
              <div>
                <label style={labelStyle}>체중 <span style={{ color: THEME.inbodyWeight }}>●</span></label>
                <input type="number" step="0.1" inputMode="decimal" style={inputStyle} value={form.weight} onChange={e => handleChange('weight', e.target.value)} placeholder="kg" />
              </div>
              <div>
                <label style={labelStyle}>골격근량 <span style={{ color: THEME.inbodyMuscle }}>●</span></label>
                <input type="number" step="0.1" inputMode="decimal" style={inputStyle} value={form.muscle_mass} onChange={e => handleChange('muscle_mass', e.target.value)} placeholder="kg" />
              </div>
              <div>
                <label style={labelStyle}>체지방량 <span style={{ color: THEME.inbodyFat }}>●</span></label>
                <input type="number" step="0.1" inputMode="decimal" style={inputStyle} value={form.body_fat_mass} onChange={e => handleChange('body_fat_mass', e.target.value)} placeholder="kg" />
              </div>
              <div>
                <label style={labelStyle}>체지방률 <span style={{ color: THEME.inbodyFat }}>●</span></label>
                <input type="number" step="0.1" inputMode="decimal" style={inputStyle} value={form.body_fat_percent} onChange={e => handleChange('body_fat_percent', e.target.value)} placeholder="%" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: SPACING.sm, marginBottom: editId ? SPACING.sm : SPACING.md }}>
              {editId && <button style={btnSecondary} onClick={handleCancelEdit} disabled={loading}>취소</button>}
              <button style={btnPrimary} onClick={handleSubmit} disabled={loading}>
                {loading ? '저장 중…' : editId ? '수정' : '저장'}
              </button>
            </div>

            {editId && (
              <button style={{ ...btnDanger, width: '100%', marginBottom: SPACING.md }} onClick={handleDelete} disabled={loading}>
                삭제
              </button>
            )}

            {myRecords.length > 0 && (
              <div>
                <div style={{ fontSize: `${FONT.md}px`, fontWeight: 500, color: THEME.text, marginBottom: SPACING.sm }}>
                  {isTrainerInput ? '내가 측정한 기록' : '내가 입력한 기록'} ({myRecords.length}회) · 탭하여 수정
                </div>
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: `0.5px solid ${THEME.borderLight}`, borderRadius: RADIUS.sm }}>
                  {[...myRecords].reverse().map(r => (
                    <div
                      key={`${r._table}-${r.id}`}
                      onClick={() => handleEdit(r)}
                      style={{
                        padding: '9px 11px',
                        borderBottom: `0.5px solid ${THEME.borderLight}`,
                        cursor: 'pointer',
                        background: editId === r.id ? THEME.primaryLight : '#FFF',
                        fontSize: `${FONT.md}px`,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}
                    >
                      <span style={{ color: THEME.textSub, fontWeight: 500 }}>{r.measured_date}</span>
                      <span style={{ display: 'flex', gap: SPACING.sm, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <span style={{ color: THEME.inbodyWeight }}>{parseFloat(r.weight).toFixed(1)}kg</span>
                        <span style={{ color: THEME.inbodyMuscle }}>{parseFloat(r.muscle_mass).toFixed(1)}kg</span>
                        {r.body_fat_mass != null && <span style={{ color: THEME.inbodyFat }}>{parseFloat(r.body_fat_mass).toFixed(1)}kg</span>}
                        <span style={{ color: THEME.inbodyFat }}>{parseFloat(r.body_fat_percent).toFixed(1)}%</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ─── 추이 탭 ─── */}
        {view === 'chart' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: SPACING.xs, marginBottom: SPACING.sm }}>
              <button style={metricTab(activeMetric === 'all', THEME.primary)} onClick={() => setActiveMetric('all')}>전체</button>
              <button style={metricTab(activeMetric === 'weight', THEME.inbodyWeight)} onClick={() => setActiveMetric('weight')}>체중</button>
              <button style={metricTab(activeMetric === 'muscle_mass', THEME.inbodyMuscle)} onClick={() => setActiveMetric('muscle_mass')}>골격근</button>
              <button style={metricTab(activeMetric === 'body_fat_mass', THEME.inbodyFat)} onClick={() => setActiveMetric('body_fat_mass')}>체지방</button>
              <button style={metricTab(activeMetric === 'body_fat_percent', THEME.inbodyFat)} onClick={() => setActiveMetric('body_fat_percent')}>체지방률</button>
            </div>

            {activeMetric === 'all' ? (
              <div style={{ marginBottom: SPACING.sm }}>
                <MiniMetricChart data={records} metric={METRICS.weight} isLast={false} />
                <MiniMetricChart data={records} metric={METRICS.muscle_mass} isLast={false} />
                <MiniMetricChart data={records} metric={METRICS.body_fat_mass} isLast={false} />
                <MiniMetricChart data={records} metric={METRICS.body_fat_percent} isLast={true} />
              </div>
            ) : (
              <div style={{ background: THEME.cardAlt, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.sm }}>
                <LineChart data={records} metric={METRICS[activeMetric]} height={150} />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', fontSize: `${FONT.xs}px`, color: THEME.textHint, marginBottom: SPACING.sm }}>
              ● 회원 입력  ■ 트레이너 측정
            </div>

            {records.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: SPACING.xs + 2, marginBottom: SPACING.sm }}>
                {[METRICS.weight, METRICS.muscle_mass, METRICS.body_fat_mass, METRICS.body_fat_percent].map(m => {
                  const stat = stats[m.key]
                  const isPositive = stat.diff > 0
                  const isNegative = stat.diff < 0
                  return (
                    <div key={m.key} style={{
                      background: THEME.card, border: `0.5px solid ${m.color}`,
                      borderRadius: RADIUS.sm, padding: '6px 4px',
                      textAlign: 'center', minWidth: 0,
                    }}>
                      <div style={{ fontSize: `${FONT.xs}px`, color: m.color, fontWeight: 500, marginBottom: 2 }}>{m.label}</div>
                      <div style={{ fontSize: `${FONT.xl}px`, fontWeight: 500, color: THEME.text, letterSpacing: '-0.3px' }}>
                        {stat.current.toFixed(1)}
                        <span style={{ fontSize: '9px', color: THEME.textSub, marginLeft: 1, fontWeight: 400 }}>{m.unit}</span>
                      </div>
                      {stat.count > 1 && (
                        <div style={{
                          fontSize: `${FONT.xxs}px`, marginTop: 1, fontWeight: 500,
                          color: isPositive ? THEME.danger : isNegative ? THEME.primary : THEME.textSub,
                        }}>
                          {isPositive ? '+' : ''}{stat.diff}{m.unit}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {records.length > 0 ? (
              <div>
                <div style={{ fontSize: `${FONT.md}px`, fontWeight: 500, color: THEME.text, marginBottom: SPACING.sm }}>
                  측정 기록 ({records.length}회)
                </div>
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: `0.5px solid ${THEME.borderLight}`, borderRadius: RADIUS.sm }}>
                  {[...records].reverse().map(r => (
                    <div key={`${r._table}-${r.id}`} style={{
                      padding: '9px 11px',
                      borderBottom: `0.5px solid ${THEME.borderLight}`,
                      fontSize: `${FONT.md}px`,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={sourceBadge(r._source)}>{r._source === 'trainer' ? '트레이너' : '회원'}</span>
                        <span style={{ color: THEME.textSub, fontWeight: 500 }}>{r.measured_date}</span>
                      </span>
                      <span style={{ display: 'flex', gap: SPACING.xs + 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <span style={{ color: THEME.inbodyWeight }}>{parseFloat(r.weight).toFixed(1)}kg</span>
                        <span style={{ color: THEME.inbodyMuscle }}>{parseFloat(r.muscle_mass).toFixed(1)}kg</span>
                        {r.body_fat_mass != null && <span style={{ color: THEME.inbodyFat }}>{parseFloat(r.body_fat_mass).toFixed(1)}kg</span>}
                        <span style={{ color: THEME.inbodyFat }}>{parseFloat(r.body_fat_percent).toFixed(1)}%</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ padding: SPACING.xl, textAlign: 'center', color: THEME.textHint, fontSize: `${FONT.md}px` }}>
                측정 기록이 없습니다.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

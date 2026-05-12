import { useState, useEffect, useMemo } from 'react'
import { THEME } from './utils'
import {
  loadInbody, loadInbodyMerged,
  addInbody, updateInbody, deleteInbody, getInbodyStats,
} from './utils'

// ─── 공통 스타일 ───
const overlay = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.5)', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: '12px',
}
const modal = {
  background: THEME.card, borderRadius: '16px',
  width: '100%', maxWidth: '460px',
  maxHeight: '90vh', overflowY: 'auto',
  padding: '20px',
}
const headerStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginBottom: '16px',
}
const titleStyle = {
  fontSize: '17px', fontWeight: '700', color: THEME.text, margin: 0,
}
const closeBtn = {
  background: 'transparent', border: 'none', fontSize: '22px',
  color: THEME.textSub, cursor: 'pointer', padding: '0 4px',
}
const labelStyle = {
  display: 'block', fontSize: '12px', color: THEME.textSub,
  marginBottom: '4px', fontWeight: '500',
}
const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: '8px',
  border: `1px solid ${THEME.border}`, fontSize: '14px',
  background: '#FFF', boxSizing: 'border-box', outline: 'none',
}
const btnPrimary = {
  flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
  background: THEME.primary, color: '#FFF', fontSize: '14px',
  fontWeight: '600', cursor: 'pointer',
}
const btnDanger = {
  flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
  background: THEME.danger, color: '#FFF', fontSize: '14px',
  fontWeight: '600', cursor: 'pointer',
}
const btnSecondary = {
  flex: 1, padding: '12px', borderRadius: '10px',
  border: `1px solid ${THEME.border}`, background: '#FFF',
  color: THEME.textSub, fontSize: '14px', cursor: 'pointer',
}
const tabBtn = (active, color) => ({
  flex: 1, padding: '8px 4px', borderRadius: '8px',
  border: 'none', cursor: 'pointer',
  background: active ? color : THEME.cardAlt,
  color: active ? '#FFF' : THEME.textSub,
  fontSize: '12px', fontWeight: '600',
  transition: 'all 0.15s',
})

// 작은 뱃지 (회원 입력/트레이너 입력 표시)
const sourceBadge = (source) => ({
  display: 'inline-block',
  padding: '2px 6px',
  borderRadius: '4px',
  fontSize: '10px',
  fontWeight: '600',
  background: source === 'trainer' ? THEME.primaryLight : THEME.warningLight,
  color: source === 'trainer' ? THEME.primaryDark : THEME.warningText,
  marginRight: '6px',
})

// ─── 메트릭 정의 ───
const METRICS = {
  weight:           { key: 'weight',           label: '체중',     unit: 'kg', color: THEME.inbodyWeight },
  muscle_mass:      { key: 'muscle_mass',      label: '골격근량', unit: 'kg', color: THEME.inbodyMuscle },
  body_fat_percent: { key: 'body_fat_percent', label: '체지방률', unit: '%',  color: THEME.inbodyFat },
}

// ─── 오늘 날짜 (YYYY-MM-DD) ───
const today = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ─── 날짜 짧게 (MM/DD) ───
const shortDate = (dateStr) => {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  return `${parseInt(parts[1])}/${parseInt(parts[2])}`
}

// ─── SVG 라인 차트 (단일 메트릭 전용) ───
function LineChart({ data, metric, height = 180, showXLabels = true }) {
  const W = 420
  const H = height
  const padL = 38
  const padR = 16
  const padT = 18
  const padB = showXLabels ? 28 : 12

  const chartW = W - padL - padR
  const chartH = H - padT - padB

  if (!data || data.length === 0) {
    return (
      <div style={{
        height: `${H}px`, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        color: THEME.textHint, fontSize: '12px',
        background: THEME.cardAlt, borderRadius: '8px',
      }}>
        측정 기록이 없습니다
      </div>
    )
  }

  // 이 메트릭에 한정된 값만 추출
  const allValues = data
    .map(d => parseFloat(d[metric.key]))
    .filter(v => !isNaN(v) && v > 0)

  if (allValues.length === 0) {
    return (
      <div style={{
        height: `${H}px`, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        color: THEME.textHint, fontSize: '12px',
        background: THEME.cardAlt, borderRadius: '8px',
      }}>
        표시할 데이터가 없습니다
      </div>
    )
  }

  const minV = Math.min(...allValues)
  const maxV = Math.max(...allValues)
  const range = maxV - minV || Math.max(maxV * 0.1, 1)
  const yMin = minV - range * 0.2
  const yMax = maxV + range * 0.25
  const yRange = yMax - yMin || 1

  const xPos = (i) => {
    if (data.length === 1) return padL + chartW / 2
    return padL + (i / (data.length - 1)) * chartW
  }
  const yPos = (v) => padT + chartH - ((v - yMin) / yRange) * chartH

  const yTicks = []
  for (let i = 0; i <= 3; i++) {
    const v = yMin + (yRange * i / 3)
    yTicks.push(v)
  }

  const points = data
    .map((d, i) => {
      const v = parseFloat(d[metric.key])
      if (isNaN(v) || v <= 0) return null
      return { x: xPos(i), y: yPos(v), v, date: d.measured_date, source: d._source }
    })
    .filter(Boolean)

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* y축 가이드 라인 */}
      {yTicks.map((v, i) => (
        <g key={`ytick-${i}`}>
          <line
            x1={padL} y1={yPos(v)} x2={W - padR} y2={yPos(v)}
            stroke={THEME.borderLight} strokeWidth="1"
          />
          <text
            x={padL - 6} y={yPos(v) + 3}
            fontSize="9" fill={THEME.textHint} textAnchor="end"
          >
            {v.toFixed(1)}
          </text>
        </g>
      ))}

      {/* 라인 + 포인트 */}
      {points.length > 0 && (
        <g>
          <path d={linePath} stroke={metric.color} strokeWidth="2" fill="none" />
          {points.map((p, i) => (
            <g key={`pt-${i}`}>
              {p.source === 'trainer' ? (
                <rect
                  x={p.x - 4} y={p.y - 4} width="8" height="8"
                  fill={metric.color} stroke="#FFF" strokeWidth="1.5"
                />
              ) : (
                <circle cx={p.x} cy={p.y} r="4" fill={metric.color} stroke="#FFF" strokeWidth="1.5" />
              )}
              <text
                x={p.x} y={p.y - 9}
                fontSize="10" fontWeight="600"
                fill={metric.color} textAnchor="middle"
              >
                {p.v.toFixed(1)}
              </text>
            </g>
          ))}
        </g>
      )}

      {/* x축 라벨 (날짜) */}
      {showXLabels && data.map((d, i) => {
        const show = data.length <= 6 || i === 0 || i === data.length - 1 ||
                     i === Math.floor(data.length / 2)
        if (!show) return null
        return (
          <text
            key={`xlbl-${i}`}
            x={xPos(i)} y={H - 10}
            fontSize="10" fill={THEME.textSub} textAnchor="middle"
          >
            {shortDate(d.measured_date)}
          </text>
        )
      })}
    </svg>
  )
}

// ─── 단일 메트릭 카드 (전체 탭에서 3개 쌓을 때 사용) ───
function MiniMetricChart({ data, metric, isLast }) {
  const stat = getInbodyStats(data, metric.key)
  return (
    <div style={{
      background: THEME.cardAlt,
      borderRadius: '10px',
      padding: '10px 10px 8px',
      marginBottom: isLast ? 0 : '8px',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '6px',
      }}>
        <span style={{ fontSize: '12px', color: metric.color, fontWeight: '600' }}>
          {metric.label}
        </span>
        <span style={{ fontSize: '12px', color: THEME.text }}>
          <span style={{ fontWeight: '600' }}>{stat.current.toFixed(1)}</span>
          <span style={{ color: THEME.textSub, fontSize: '10px', marginLeft: '2px' }}>{metric.unit}</span>
        </span>
      </div>
      <LineChart data={data} metric={metric} height={140} showXLabels={isLast} />
    </div>
  )
}

// ─── 메인 컴포넌트 ───
//
// props:
//   user        : 입력 주체 (회원 화면이면 회원, 트레이너 화면이면 트레이너 본인)
//   memberId    : 대상 회원의 UUID. 추이 모달은 항상 memberId 기준으로 합쳐 로드.
//   isOpen      : 모달 표시 여부
//   mode        : 'input' | 'chart'
//   onClose     : 닫기 콜백
//   table       : 'member_inbody' | 'trainer_inbody' (입력 시 어느 테이블에 저장)
//   idField     : 'member_id' | 'trainer_id'
//
export default function InbodyModal({
  user, memberId, isOpen, mode = 'input', onClose,
  table = 'member_inbody', idField = 'member_id',
}) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)

  const [editId, setEditId] = useState(null)
  const [editTable, setEditTable] = useState(null)
  const [form, setForm] = useState({
    measured_date: today(),
    weight: '',
    muscle_mass: '',
    body_fat_percent: '',
  })

  const [activeTab, setActiveTab] = useState('all')

  const isTrainerInput = table === 'trainer_inbody'

  // ─── 데이터 로드 ───
  const reload = async () => {
    if (mode === 'chart') {
      if (!memberId) return
      setLoading(true)
      const data = await loadInbodyMerged(memberId)
      setRecords(data)
      setLoading(false)
    } else {
      if (!user?.id) return
      setLoading(true)
      const data = await loadInbody(user.id, table, idField)
      // 트레이너 화면이면, 자기가 이 회원에 대해 입력한 것만 필터
      const filtered = isTrainerInput && memberId
        ? data.filter(r => r.member_id === memberId)
        : data
      setRecords(filtered)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      reload()
      if (mode === 'input') {
        setEditId(null)
        setEditTable(null)
        setForm({
          measured_date: today(),
          weight: '',
          muscle_mass: '',
          body_fat_percent: '',
        })
      }
      if (mode === 'chart') {
        setActiveTab('all')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user?.id, memberId, mode, table])

  const handleChange = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  const handleSubmit = async () => {
    if (!form.measured_date || !form.weight || !form.muscle_mass || !form.body_fat_percent) {
      alert('모든 항목을 입력해주세요')
      return
    }
    setLoading(true)
    let result
    const wasNew = !editId  // 새로 추가인지 기억
    if (editId) {
      result = await updateInbody(editId, form, editTable || table)
    } else {
      const extra = isTrainerInput && memberId ? { member_id: memberId } : {}
      result = await addInbody(user.id, form, table, idField, extra)
    }
    setLoading(false)
    if (!result.success) {
      alert(result.error || '저장 실패')
      return
    }

    // 회원이 본인 인바디를 새로 입력했을 때 → 트레이너에게 알림
    if (wasNew && !isTrainerInput && user.trainer_id) {
      const { sendNotification } = await import('./utils')
      await sendNotification({
        recipientType: 'trainer',
        recipientId: user.trainer_id,
        senderType: 'member',
        senderId: user.id,
        kind: 'inbody_added',
        content: `${user.name || '회원'}님이 인바디를 입력했어요 (${form.measured_date.replace(/-/g, '.')})`,
        link: `inbody:${user.id}`,
      })
    }

    setEditId(null)
    setEditTable(null)
    setForm({
      measured_date: today(),
      weight: '',
      muscle_mass: '',
      body_fat_percent: '',
    })
    await reload()
  }

  const handleEdit = (record) => {
    setEditId(record.id)
    setEditTable(record._table || table)
    setForm({
      measured_date: record.measured_date,
      weight: String(record.weight),
      muscle_mass: String(record.muscle_mass),
      body_fat_percent: String(record.body_fat_percent),
    })
  }

  const handleDelete = async () => {
    if (!editId) return
    if (!window.confirm('이 측정 기록을 삭제하시겠습니까?')) return
    setLoading(true)
    const result = await deleteInbody(editId, editTable || table)
    setLoading(false)
    if (!result.success) {
      alert(result.error || '삭제 실패')
      return
    }
    setEditId(null)
    setEditTable(null)
    setForm({
      measured_date: today(),
      weight: '',
      muscle_mass: '',
      body_fat_percent: '',
    })
    await reload()
  }

  const handleCancelEdit = () => {
    setEditId(null)
    setEditTable(null)
    setForm({
      measured_date: today(),
      weight: '',
      muscle_mass: '',
      body_fat_percent: '',
    })
  }

  const stats = useMemo(() => ({
    weight: getInbodyStats(records, 'weight'),
    muscle_mass: getInbodyStats(records, 'muscle_mass'),
    body_fat_percent: getInbodyStats(records, 'body_fat_percent'),
  }), [records])

  if (!isOpen) return null

  // ─── 입력 모달 ───
  if (mode === 'input') {
    return (
      <div style={overlay} onClick={onClose}>
        <div style={modal} onClick={e => e.stopPropagation()}>
          <div style={headerStyle}>
            <h3 style={titleStyle}>
              {editId ? '인바디 수정' : '인바디 입력'}
            </h3>
            <button style={closeBtn} onClick={onClose}>×</button>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>측정일</label>
            <input
              type="date"
              style={inputStyle}
              value={form.measured_date}
              onChange={e => handleChange('measured_date', e.target.value)}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>
              체중 (kg)
              <span style={{ color: THEME.inbodyWeight, marginLeft: '6px' }}>●</span>
            </label>
            <input
              type="number" step="0.1" inputMode="decimal"
              style={inputStyle}
              value={form.weight}
              onChange={e => handleChange('weight', e.target.value)}
              placeholder="예: 65.5"
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>
              골격근량 (kg)
              <span style={{ color: THEME.inbodyMuscle, marginLeft: '6px' }}>●</span>
            </label>
            <input
              type="number" step="0.1" inputMode="decimal"
              style={inputStyle}
              value={form.muscle_mass}
              onChange={e => handleChange('muscle_mass', e.target.value)}
              placeholder="예: 28.3"
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>
              체지방률 (%)
              <span style={{ color: THEME.inbodyFat, marginLeft: '6px' }}>●</span>
            </label>
            <input
              type="number" step="0.1" inputMode="decimal"
              style={inputStyle}
              value={form.body_fat_percent}
              onChange={e => handleChange('body_fat_percent', e.target.value)}
              placeholder="예: 18.5"
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: editId ? '8px' : '16px' }}>
            {editId && (
              <button style={btnSecondary} onClick={handleCancelEdit} disabled={loading}>
                취소
              </button>
            )}
            <button style={btnPrimary} onClick={handleSubmit} disabled={loading}>
              {loading ? '저장 중...' : editId ? '수정' : '저장'}
            </button>
          </div>

          {editId && (
            <button
              style={{ ...btnDanger, width: '100%', marginBottom: '16px' }}
              onClick={handleDelete}
              disabled={loading}
            >
              삭제
            </button>
          )}

          {records.length > 0 && (
            <div>
              <div style={{
                fontSize: '13px', fontWeight: '600',
                color: THEME.text, marginBottom: '8px',
              }}>
                내가 입력한 기록 ({records.length}회) — 탭하여 수정
              </div>
              <div style={{
                maxHeight: '180px', overflowY: 'auto',
                border: `1px solid ${THEME.borderLight}`,
                borderRadius: '8px',
              }}>
                {[...records].reverse().map(r => (
                  <div
                    key={`${r._table}-${r.id}`}
                    onClick={() => handleEdit(r)}
                    style={{
                      padding: '10px 12px',
                      borderBottom: `1px solid ${THEME.borderLight}`,
                      cursor: 'pointer',
                      background: editId === r.id ? THEME.primaryLight : '#FFF',
                      fontSize: '12px',
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ color: THEME.textSub, fontWeight: '500' }}>
                      {r.measured_date}
                    </span>
                    <span style={{ display: 'flex', gap: '10px' }}>
                      <span style={{ color: THEME.inbodyWeight }}>{parseFloat(r.weight).toFixed(1)}kg</span>
                      <span style={{ color: THEME.inbodyMuscle }}>{parseFloat(r.muscle_mass).toFixed(1)}kg</span>
                      <span style={{ color: THEME.inbodyFat }}>{parseFloat(r.body_fat_percent).toFixed(1)}%</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── 추이 모달 ───
  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <h3 style={titleStyle}>인바디 추이</h3>
          <button style={closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
          <button
            style={tabBtn(activeTab === 'all', THEME.primary)}
            onClick={() => setActiveTab('all')}
          >
            전체
          </button>
          <button
            style={tabBtn(activeTab === 'weight', THEME.inbodyWeight)}
            onClick={() => setActiveTab('weight')}
          >
            체중
          </button>
          <button
            style={tabBtn(activeTab === 'muscle_mass', THEME.inbodyMuscle)}
            onClick={() => setActiveTab('muscle_mass')}
          >
            골격근량
          </button>
          <button
            style={tabBtn(activeTab === 'body_fat_percent', THEME.inbodyFat)}
            onClick={() => setActiveTab('body_fat_percent')}
          >
            체지방률
          </button>
        </div>

        {/* 차트 영역 - 전체 탭이면 3분할, 아니면 단일 차트 */}
        {activeTab === 'all' ? (
          <div style={{ marginBottom: '14px' }}>
            <MiniMetricChart data={records} metric={METRICS.weight} isLast={false} />
            <MiniMetricChart data={records} metric={METRICS.muscle_mass} isLast={false} />
            <MiniMetricChart data={records} metric={METRICS.body_fat_percent} isLast={true} />

            <div style={{
              display: 'flex', justifyContent: 'center', gap: '14px',
              marginTop: '8px', fontSize: '10px', flexWrap: 'wrap',
            }}>
              <span style={{ color: THEME.textHint, fontSize: '10px' }}>
                ● 회원입력 ■ 트레이너측정
              </span>
            </div>
          </div>
        ) : (
          <div style={{
            background: THEME.cardAlt, borderRadius: '12px',
            padding: '12px', marginBottom: '14px',
          }}>
            <LineChart data={records} metric={METRICS[activeTab]} height={220} />

            <div style={{
              display: 'flex', justifyContent: 'center', gap: '14px',
              marginTop: '6px', fontSize: '11px', flexWrap: 'wrap',
            }}>
              <span style={{ color: METRICS[activeTab].color, fontWeight: '600' }}>
                ● {METRICS[activeTab].label}
              </span>
              <span style={{ color: THEME.textHint, fontSize: '10px' }}>
                ● 회원입력 ■ 트레이너측정
              </span>
            </div>
          </div>
        )}

        {records.length > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gap: '8px', marginBottom: '14px',
          }}>
            {[
              { ...METRICS.weight, stat: stats.weight },
              { ...METRICS.muscle_mass, stat: stats.muscle_mass },
              { ...METRICS.body_fat_percent, stat: stats.body_fat_percent },
            ].map(m => {
              const isPositive = m.stat.diff > 0
              const isNegative = m.stat.diff < 0
              const diffSign = isPositive ? '+' : ''
              return (
                <div key={m.key} style={{
                  background: THEME.card,
                  border: `1px solid ${m.color}`,
                  borderRadius: '10px', padding: '10px 8px',
                  textAlign: 'center',
                }}>
                  <div style={{
                    fontSize: '11px', color: m.color,
                    fontWeight: '600', marginBottom: '4px',
                  }}>
                    {m.label}
                  </div>
                  <div style={{
                    fontSize: '18px', fontWeight: '700',
                    color: THEME.text,
                  }}>
                    {m.stat.current.toFixed(1)}
                    <span style={{ fontSize: '11px', color: THEME.textSub, marginLeft: '2px' }}>
                      {m.unit}
                    </span>
                  </div>
                  {m.stat.count > 1 && (
                    <div style={{
                      fontSize: '10px',
                      color: isPositive ? THEME.danger : isNegative ? THEME.primary : THEME.textSub,
                      marginTop: '2px', fontWeight: '600',
                    }}>
                      {diffSign}{m.stat.diff}{m.unit}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {records.length > 0 ? (
          <div>
            <div style={{
              fontSize: '13px', fontWeight: '600',
              color: THEME.text, marginBottom: '8px',
            }}>
              측정 기록 ({records.length}회)
            </div>
            <div style={{
              maxHeight: '180px', overflowY: 'auto',
              border: `1px solid ${THEME.borderLight}`,
              borderRadius: '8px',
            }}>
              {[...records].reverse().map(r => (
                <div
                  key={`${r._table}-${r.id}`}
                  style={{
                    padding: '10px 12px',
                    borderBottom: `1px solid ${THEME.borderLight}`,
                    fontSize: '12px',
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={sourceBadge(r._source)}>
                      {r._source === 'trainer' ? '트레이너' : '회원'}
                    </span>
                    <span style={{ color: THEME.textSub, fontWeight: '500' }}>
                      {r.measured_date}
                    </span>
                  </span>
                  <span style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ color: THEME.inbodyWeight }}>{parseFloat(r.weight).toFixed(1)}kg</span>
                    <span style={{ color: THEME.inbodyMuscle }}>{parseFloat(r.muscle_mass).toFixed(1)}kg</span>
                    <span style={{ color: THEME.inbodyFat }}>{parseFloat(r.body_fat_percent).toFixed(1)}%</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{
            padding: '20px', textAlign: 'center',
            color: THEME.textHint, fontSize: '13px',
          }}>
            측정 기록이 없습니다. 인바디 입력 버튼을 눌러 추가해주세요.
          </div>
        )}
      </div>
    </div>
  )
}
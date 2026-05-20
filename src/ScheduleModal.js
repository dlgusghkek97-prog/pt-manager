import React, { useEffect, useMemo, useState, useRef } from 'react'
import {
  THEME, FONT, RADIUS,
  loadClassSessions, createClassSession, updateClassSession, deleteClassSession,
  requestClassSession, approveClassRequest, rejectClassRequest,
  getBusinessHours, setBusinessHours, isWithinBusinessHours,
  usePtSession, refundPtSession,
} from './utils'
import { supabase } from './supabase'
import useModalBackButton from './useModalBackButton'
import CloseButton from './CloseButton'
import HelpModal from './HelpModal'

// 상태별 색상 (스크린샷 범례 참고)
const STATUS_STYLE = {
  scheduled: { bg: '#C7D6F0', border: '#7A99CB', text: '#1F3A6B', label: '수업' },
  requested: { bg: '#FBD8CE', border: '#E08A6E', text: '#7A2E1A', label: '신청' },
  changed:   { bg: '#FBD8CE', border: '#E08A6E', text: '#7A2E1A', label: '변경' },
  general:   { bg: '#D8DDE3', border: '#9AA3AD', text: '#3F4856', label: '일반' },
  off:       { bg: '#DCE7F0', border: '#B5C5D6', text: '#5A6B7A', label: 'OFF' },
  no_show:   { bg: '#FFE4E4', border: '#D45C5C', text: '#8B1F1F', label: '노쇼' },
  completed: { bg: '#D8EDD9', border: '#7AA890', text: '#2F5C45', label: '완료' },
  cancelled: { bg: '#EEE',    border: '#CCC',    text: '#888',    label: '취소' },
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

// 시작/끝 시간 → "HH:MM" string
const fmtTime = (iso) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 주의 월요일 자정 (로컬)
const mondayOfWeek = (date) => {
  const d = new Date(date)
  const day = d.getDay() // 0=일, 1=월, ...
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

const addDays = (date, n) => {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

const toISODate = (date) => {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// 풀스크린 스케줄 모달.
// userType: 'trainer' | 'member'
// trainerId: 트레이너 본인이거나 (userType=trainer), 회원의 담당 트레이너 id (userType=member)
export default function ScheduleModal({ user, userType, trainerId, initialOpenSessionId, onClose }) {
  useModalBackButton(true, onClose)

  const [weekStart, setWeekStart] = useState(mondayOfWeek(new Date()))
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState(null) // 클릭한 session or { isNew, startAt }
  const [members, setMembers] = useState([])
  const [businessHours, setBH] = useState(null)
  const [bhEditOpen, setBhEditOpen] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const initialOpenedRef = useRef(false)

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart])

  const reload = async () => {
    if (!trainerId) return
    setLoading(true)
    const fromISO = weekStart.toISOString()
    const toISO = weekEnd.toISOString()
    const data = await loadClassSessions(trainerId, fromISO, toISO)
    setSessions(data)
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload() }, [weekStart, trainerId])

  // 운영시간 로드 (트레이너/회원 모두 — 회원은 본인 트레이너 운영시간 조회)
  useEffect(() => {
    if (!trainerId) return
    let alive = true
    ;(async () => {
      const bh = await getBusinessHours(trainerId)
      if (alive) setBH(bh)
    })()
    return () => { alive = false }
  }, [trainerId, bhEditOpen])

  // 알림 등으로 특정 슬롯 자동 열기 — 마운트 시 1회.
  useEffect(() => {
    if (!initialOpenSessionId || initialOpenedRef.current) return
    initialOpenedRef.current = true
    ;(async () => {
      const { data, error } = await supabase
        .from('class_sessions')
        .select('*, members!class_sessions_member_id_fkey(id,name)')
        .eq('id', initialOpenSessionId)
        .maybeSingle()
      if (error || !data) {
        console.warn('[ScheduleModal initial open]', error)
        return
      }
      setWeekStart(mondayOfWeek(new Date(data.start_at)))
      setEditTarget(data)
    })()
  }, [initialOpenSessionId])

  // 트레이너 — 회원 리스트 (수업 등록 시 선택)
  // members 테이블의 phone/code 컬럼은 환경에 따라 없을 수 있어 안전 컬럼만 select.
  useEffect(() => {
    if (userType !== 'trainer' || !trainerId) return
    ;(async () => {
      const { data, error } = await supabase
        .from('members')
        .select('id, name, pt_total_sessions, pt_used_sessions')
        .eq('trainer_id', trainerId)
        .order('name')
      if (error) console.warn('[ScheduleModal members]', error)
      setMembers(data || [])
    })()
  }, [userType, trainerId])

  // 셀(요일×시간) 클릭 → 새 슬롯 모달
  const handleCellClick = (e, dayIdx, hour) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
      e.nativeEvent?.stopImmediatePropagation?.()
    }
    const dayDate = addDays(weekStart, dayIdx)
    dayDate.setHours(hour, 0, 0, 0)
    if (userType === 'member' && !isWithinBusinessHours(businessHours, dayDate)) {
      alert('트레이너 운영 시간이 아닙니다.')
      return
    }
    const endDate = new Date(dayDate)
    endDate.setHours(hour + 1)
    // ghost click 흡수 — 같은 click 사이클이 완전히 끝난 다음 모달 mount
    setTimeout(() => {
      setEditTarget({
        isNew: true,
        start_at: dayDate.toISOString(),
        end_at: endDate.toISOString(),
        status: userType === 'trainer' ? 'scheduled' : 'requested',
        member_id: userType === 'member' ? user.id : null,
      })
    }, 0)
  }

  // 시간 범위: 0시 ~ 23시 (전체)
  const HOURS = useMemo(() => Array.from({ length: 24 }, (_, i) => i), [])

  // 셀에 들어갈 세션 매핑 — { 'dayIdx-hour': [{ session, isHead }] }
  // 슬롯이 N 시간에 걸쳐 있으면 그 시간 셀들 모두에 표시. isHead=true 셀에만 시간 라벨.
  const sessionByCell = useMemo(() => {
    const map = {}
    sessions.forEach(s => {
      const start = new Date(s.start_at)
      const end   = new Date(s.end_at)
      const dayIdx = (start.getDay() + 6) % 7 // 월=0
      const startHour = start.getHours()

      // 같은 날 끝나면 그 hour 까지, 자정 넘어가면 23시까지 표시.
      const sameDay = end.getFullYear() === start.getFullYear()
        && end.getMonth() === start.getMonth()
        && end.getDate() === start.getDate()
      let endHour
      if (!sameDay) {
        endHour = 23
      } else {
        // 종료 분이 0 이면 직전 hour 까지 (예: 12:00~13:00 은 12시 셀 1개만)
        endHour = end.getMinutes() === 0 ? end.getHours() - 1 : end.getHours()
      }
      if (endHour < startHour) endHour = startHour

      for (let h = startHour; h <= endHour && h <= 23; h++) {
        const key = `${dayIdx}-${h}`
        if (!map[key]) map[key] = []
        map[key].push({ session: s, isHead: h === startHour })
      }
    })
    return map
  }, [sessions])

  return (
    <>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed', inset: 0, background: THEME.bg, zIndex: 1500,
          overflowY: 'auto', display: 'flex', flexDirection: 'column',
        }}>
        {/* 상단 헤더 — 닫기 + 년/월 네비 + 운영시간 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 10px', background: '#FFF',
          borderBottom: `0.5px solid ${THEME.borderLight}`,
          position: 'sticky', top: 0, zIndex: 1,
        }}>
          <CloseButton onClick={onClose} ariaLabel="닫기" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => {
                const nd = new Date(weekStart); nd.setMonth(nd.getMonth() - 1, 1)
                setWeekStart(mondayOfWeek(nd))
              }}
              style={miniNavBtn}
              aria-label="이전 달"
            >‹</button>
            <div style={{ fontSize: FONT.sm, color: THEME.textSub, fontWeight: 500, minWidth: 80, textAlign: 'center' }}>
              {weekStart.getFullYear()}년 {weekStart.getMonth() + 1}월
            </div>
            <button
              onClick={() => {
                const nd = new Date(weekStart); nd.setMonth(nd.getMonth() + 1, 1)
                setWeekStart(mondayOfWeek(nd))
              }}
              style={miniNavBtn}
              aria-label="다음 달"
            >›</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {userType === 'trainer' && (
              <button
                onClick={() => setBhEditOpen(true)}
                style={{
                  background: '#FFF', border: `0.5px solid ${THEME.border}`,
                  color: THEME.primary, padding: '0 10px', height: 28,
                  borderRadius: 14, fontSize: 11, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >운영시간</button>
            )}
            <button
              onClick={() => setShowHelp(true)}
              style={{
                background: '#FFF', border: `0.5px solid ${THEME.border}`,
                color: THEME.textHint, width: 28, height: 28,
                borderRadius: '50%', fontSize: 12, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit', padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title="스케줄 설명서"
            >?</button>
          </div>
        </div>

        {/* 큰 주차 네비 (가운데) + 범례 */}
        <div style={{ background: '#FFF', padding: '14px 14px 10px', borderBottom: `0.5px solid ${THEME.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 10 }}>
            <button onClick={() => setWeekStart(addDays(weekStart, -7))} style={bigNavBtn} aria-label="이전 주">‹</button>
            <div style={{ textAlign: 'center', minWidth: 180 }}>
              <div style={{ fontSize: 22, color: THEME.primaryDark, fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.3px' }}>
                {weekStart.getMonth() + 1}월 {Math.floor((weekStart.getDate() - 1) / 7) + 1}주차
              </div>
              <div style={{ fontSize: FONT.xs, color: THEME.textSub, marginTop: 3 }}>
                {weekStart.getMonth() + 1}/{weekStart.getDate()} ~ {addDays(weekStart, 6).getMonth() + 1}/{addDays(weekStart, 6).getDate()}
              </div>
            </div>
            <button onClick={() => setWeekStart(addDays(weekStart, 7))} style={bigNavBtn} aria-label="다음 주">›</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <button
              onClick={() => setWeekStart(mondayOfWeek(new Date()))}
              style={{
                background: THEME.primaryLight, color: THEME.primary,
                border: `0.5px solid ${THEME.primaryAccent}`,
                padding: '4px 14px', borderRadius: 12, fontSize: 11, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >오늘</button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['scheduled', 'requested', 'general', 'off', 'no_show'].map(k => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: THEME.textSub }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: STATUS_STYLE[k].bg, border: `0.5px solid ${STATUS_STYLE[k].border}` }} />
                {STATUS_STYLE[k].label}
              </div>
            ))}
          </div>
        </div>

        {/* 주간 그리드 */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '0 0 80px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(7, minmax(60px, 1fr))', minWidth: 460 }}>
            {/* 헤더 row : 요일 */}
            <div />
            {WEEKDAYS.map((w, i) => {
              const d = addDays(weekStart, i)
              const isToday = toISODate(d) === toISODate(new Date())
              return (
                <div key={i} style={{
                  padding: '8px 0', textAlign: 'center',
                  fontSize: 11, fontWeight: 500,
                  color: isToday ? THEME.primary : (i >= 5 ? THEME.danger : THEME.textSub),
                  background: '#FFF',
                  borderBottom: `0.5px solid ${THEME.border}`,
                }}>
                  <div>{w}</div>
                  <div style={{ fontSize: 13, marginTop: 2 }}>{d.getDate()}</div>
                </div>
              )
            })}

            {/* 시간 row × 요일 col */}
            {HOURS.map(hour => (
              <React.Fragment key={hour}>
                <div style={{
                  fontSize: 9, color: THEME.textHint, textAlign: 'center',
                  paddingTop: 4, background: '#FFF',
                  borderBottom: `0.5px solid ${THEME.borderLight}`,
                }}>
                  {hour}시
                </div>
                {WEEKDAYS.map((_, dayIdx) => {
                  const key = `${dayIdx}-${hour}`
                  const cellSessions = sessionByCell[key] || []
                  const cellDate = (() => {
                    const d = addDays(weekStart, dayIdx)
                    d.setHours(hour, 0, 0, 0)
                    return d
                  })()
                  const inBh = isWithinBusinessHours(businessHours, cellDate)
                  const memberBlocked = userType === 'member' && !inBh
                  const clickable = cellSessions.length === 0 && !memberBlocked
                  return (
                    <div
                      key={key}
                      onClick={(e) => clickable && handleCellClick(e, dayIdx, hour)}
                      style={{
                        minHeight: 42, padding: 2,
                        background: !inBh ? '#F2F2F2' : '#FFF',
                        borderLeft: `0.5px solid ${THEME.borderLight}`,
                        borderBottom: `0.5px solid ${THEME.borderLight}`,
                        cursor: clickable ? 'pointer' : 'default',
                        position: 'relative',
                        opacity: memberBlocked ? 0.6 : 1,
                        touchAction: 'manipulation',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      {cellSessions.map(({ session: s, isHead }) => {
                        const isMember = userType === 'member'
                        const isMine = isMember && s.member_id === user.id
                        const baseStyle = STATUS_STYLE[s.status] || STATUS_STYLE.scheduled

                        // 회원 모드: 다른 회원/일반/노쇼 슬롯은 익명 "예약됨" 회색 처리.
                        // 본인 슬롯은 강조 색상(primary 계열). OFF 는 그대로 보여 시간 차단 인지.
                        let st = baseStyle
                        let label = s.members?.name || baseStyle.label
                        if (isMember) {
                          if (isMine) {
                            st = s.status === 'requested' || s.status === 'changed'
                              ? { bg: '#FBD8CE', border: '#E08A6E', text: '#7A2E1A' }
                              : { bg: THEME.primary, border: THEME.primaryDark, text: '#FFF' }
                            label = s.status === 'requested' ? '신청 중'
                                  : s.status === 'changed'   ? '변경 요청'
                                  : '내 PT'
                          } else if (s.status === 'off') {
                            // OFF 그대로
                          } else {
                            // 다른 회원 / 일반 / 노쇼 / 완료 — 익명
                            st = { bg: '#E5E5E5', border: '#BBB', text: '#888' }
                            label = '예약됨'
                          }
                        }

                        const canEdit = userType === 'trainer' || isMine
                        return (
                          <div
                            key={`${s.id}-${isHead ? 'h' : 'c'}`}
                            onClick={e => { e.stopPropagation(); if (canEdit) setEditTarget(s) }}
                            style={{
                              background: st.bg, color: st.text,
                              borderLeft: `2px solid ${st.border}`,
                              fontSize: 10, padding: isHead ? '3px 4px' : 0,
                              borderRadius: isHead ? '3px 3px 0 0' : 0,
                              marginBottom: 1,
                              cursor: canEdit ? 'pointer' : 'default',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              height: isHead ? 'auto' : '100%',
                              minHeight: isHead ? undefined : 38,
                              fontWeight: isMine ? 600 : 400,
                            }}
                          >
                            {isHead && (
                              <>
                                <div style={{ fontWeight: 500 }}>{fmtTime(s.start_at)}</div>
                                <div style={{ fontSize: 9, opacity: 0.9, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {label}
                                </div>
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </React.Fragment>
            ))}
          </div>
          {loading && (
            <p style={{ textAlign: 'center', color: THEME.textHint, fontSize: 11, padding: 12 }}>불러오는 중...</p>
          )}
        </div>
      </div>

      {editTarget && (
        <SessionEditModal
          user={user}
          userType={userType}
          trainerId={trainerId}
          target={editTarget}
          members={members}
          onClose={() => setEditTarget(null)}
          onSaved={async () => { setEditTarget(null); await reload() }}
        />
      )}

      {bhEditOpen && (
        <BusinessHoursModal
          trainerId={trainerId}
          initial={businessHours}
          onClose={() => setBhEditOpen(false)}
        />
      )}

      {showHelp && (
        <HelpModal
          type={userType === 'trainer' ? 'trainer' : 'member'}
          section="schedule"
          onClose={() => setShowHelp(false)}
        />
      )}
    </>
  )
}

const miniNavBtn = {
  width: 24, height: 24, borderRadius: 12,
  border: 'none', background: 'transparent',
  color: THEME.textSub, fontSize: 16, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 0, fontFamily: 'inherit',
}

const bigNavBtn = {
  width: 40, height: 40, borderRadius: 20,
  border: `0.5px solid ${THEME.border}`, background: '#FFF',
  color: THEME.primary, fontSize: 22, fontWeight: 500,
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 0, fontFamily: 'inherit',
}

// ─── 슬롯 추가/편집 모달 ───
// useModalBackButton 의도적으로 안 씀 — 부모 ScheduleModal 이 백버튼 받음.
// 자식 모달까지 history 에 push 하면 cleanup cascade 로 부모까지 닫히는 race 발생.
function SessionEditModal({ user, userType, trainerId, target, members, onClose, onSaved }) {
  const isNew = !!target.isNew
  const isTrainer = userType === 'trainer'

  // 유형 — 'reserve' (예약/회원) | 'off' | 'general' | 'no_show'
  // 회원은 항상 reserve. 트레이너는 target.status 기반 초기값.
  const initialKind = (() => {
    if (!isTrainer) return 'reserve'
    if (isNew) return 'reserve'
    if (['scheduled','requested','changed','completed'].includes(target.status)) return 'reserve'
    if (['off','general','no_show'].includes(target.status)) return target.status
    return 'reserve'
  })()
  const [kind, setKind] = useState(initialKind)

  // 회원 — 검색 input. 회원 모드면 본인 고정.
  const [memberId, setMemberId] = useState(target.member_id || (isTrainer ? '' : user.id))
  const [memberQuery, setMemberQuery] = useState('')
  const [showMemberList, setShowMemberList] = useState(false)

  // 회원 검색 — 등록된 회원 모두 표시 (PT 잔여 0인 회원도 트레이너가 선택 가능).
  // 잔여 횟수는 표시만 — 예약 등록과 PT 차감은 별개 흐름.
  const allMembers = members || []
  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase()
    if (!q) return allMembers
    return allMembers.filter(m => (m.name || '').toLowerCase().includes(q))
  }, [memberQuery, allMembers])
  const selectedMember = members?.find(m => m.id === memberId)

  // 시간 — 날짜는 셀 클릭 시점 고정, 시작/종료 시각만 편집
  const targetStart = new Date(target.start_at)
  const targetEnd = new Date(target.end_at)
  const dateStr = toLocalDate(targetStart)
  const [startTime, setStartTime] = useState(toHHMM(targetStart))
  const [endTime, setEndTime] = useState(toHHMM(targetEnd))
  // 편집 모드에서는 원래 종료 시각 보존을 위해 autoEnd false 로 시작.
  // 새 등록일 때만 자동 종료 ON.
  const [autoEnd, setAutoEnd] = useState(isNew)
  // 기본 수업 길이(분) — localStorage 저장. 사용자가 변경 가능. 기본 50분.
  const [sessionLen, setSessionLen] = useState(() => {
    const v = parseInt(localStorage.getItem('pt_default_session_minutes') || '50', 10)
    return Number.isFinite(v) && v > 0 ? v : 50
  })
  useEffect(() => {
    localStorage.setItem('pt_default_session_minutes', String(sessionLen))
  }, [sessionLen])

  const [note, setNote] = useState(target.note || '')
  const [saving, setSaving] = useState(false)

  // 마운트 직후 overlay 가드 (pointer-events 차단)
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setArmed(true), 400)
    return () => clearTimeout(t)
  }, [])

  // autoEnd 켜진 상태에서 시작 시각/수업 길이 바뀌면 종료를 자동 갱신.
  // 24시 넘어가면 23:59 로 cap (자정 넘는 슬롯 미지원)
  useEffect(() => {
    if (!autoEnd) return
    const [sh, sm] = startTime.split(':').map(Number)
    const total = sh * 60 + sm + sessionLen
    let eh = Math.floor(total / 60)
    let em = total % 60
    if (eh >= 24) { eh = 23; em = 59 }
    setEndTime(`${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`)
  }, [autoEnd, startTime, sessionLen])

  const buildIso = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number)
    const [y, mo, d] = dateStr.split('-').map(Number)
    return new Date(y, mo - 1, d, h, m, 0, 0).toISOString()
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    const startAt = buildIso(startTime)
    const endAt = buildIso(endTime)
    if (new Date(endAt) <= new Date(startAt)) {
      alert('종료 시간은 시작 시간보다 뒤여야 합니다.')
      setSaving(false)
      return
    }

    let res
    if (kind === 'reserve') {
      if (isTrainer && !memberId) {
        alert('회원을 선택해주세요.')
        setSaving(false)
        return
      }
      if (isNew) {
        if (isTrainer) {
          res = await createClassSession({
            trainerId, memberId,
            startAt, endAt, status: 'scheduled', note, createdBy: user.id,
          })
        } else {
          // 회원: RPC 로 신청 (서버가 본인 trainer_id 자동 사용)
          res = await requestClassSession({ startAt, endAt, note })
        }
      } else {
        res = await updateClassSession(target.id, {
          member_id: memberId,
          start_at: startAt, end_at: endAt,
          status: isTrainer ? (target.status === 'requested' ? 'requested' : 'scheduled') : target.status,
          note,
        })
      }
    } else {
      // OFF / 일반 / 노쇼 — 트레이너 전용. kind 자체가 status.
      if (isNew) {
        res = await createClassSession({
          trainerId, memberId: null,
          startAt, endAt, status: kind, note, createdBy: user.id,
        })
      } else {
        res = await updateClassSession(target.id, {
          member_id: null,
          start_at: startAt, end_at: endAt,
          status: kind, note,
        })
      }
    }
    setSaving(false)
    if (!res.success) {
      const msg = res.error || ''
      let userMsg
      if (msg.includes('no_trainer_linked')) {
        userMsg = '담당 트레이너가 연결되어 있지 않아요. 트레이너 코드부터 연결해주세요.'
      } else if (msg.includes('schedule_disabled')) {
        userMsg = '트레이너가 스케줄 신청을 받지 않고 있습니다.'
      } else if (msg.includes('business_hours_closed') || msg.includes('business_hours_outside')) {
        userMsg = '트레이너 운영 시간이 아닙니다.'
      } else if (msg.includes('end_before_start')) {
        userMsg = '종료 시간이 시작 시간보다 빨라요.'
      } else if (msg.toLowerCase().includes('row-level security')) {
        userMsg = '권한 오류 — 관리자에게 문의해주세요. (DB 마이그레이션 확인 필요)'
      } else {
        userMsg = '저장 실패: ' + msg
      }
      console.error('[SessionEdit save failed]', { trainerId, memberId: kind === 'reserve' && !isTrainer ? user.id : memberId, kind, startAt, endAt, raw: msg })
      alert(userMsg)
      return
    }
    onSaved()
  }

  const handleDelete = async () => {
    if (!window.confirm('이 슬롯을 삭제할까요?')) return
    const res = await deleteClassSession(target.id)
    if (!res.success) { alert('삭제 실패: ' + res.error); return }
    onSaved()
  }
  const handleApprove = async () => {
    const res = await approveClassRequest(target.id)
    if (!res.success) { alert('승인 실패: ' + res.error); return }
    onSaved()
  }
  const handleReject = async () => {
    if (!window.confirm('신청을 거절(삭제)할까요?')) return
    const res = await rejectClassRequest(target.id)
    if (!res.success) { alert('거절 실패: ' + res.error); return }
    onSaved()
  }

  // 출석/결석/취소 — PT 차감·복구 동반. target.pt_charged 로 중복 차감/복구 방지.
  const [acting, setActing] = useState(false)
  const mid = target.member_id

  // 출석 처리 → completed + (아직 차감 안 됐으면) PT 1회 차감
  const handleAttend = async () => {
    if (acting) return
    if (!mid) { alert('회원이 지정된 슬롯만 출석 처리할 수 있어요.'); return }
    setActing(true)
    let charged = !!target.pt_charged
    if (!charged) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const r = await usePtSession(mid)
      if (!r.success) { alert('출석 차감 실패: ' + r.error); setActing(false); return }
      charged = true
    }
    const res = await updateClassSession(target.id, { status: 'completed', pt_charged: charged })
    setActing(false)
    if (!res.success) { alert('처리 실패: ' + res.error); return }
    onSaved()
  }

  // 결석 처리 → no_show. 차감 여부는 트레이너가 매번 선택.
  const handleNoShow = async () => {
    if (acting) return
    if (!mid) { alert('회원이 지정된 슬롯만 결석 처리할 수 있어요.'); return }
    const wantCharge = window.confirm('결석 처리합니다.\n\n[확인] PT 1회 차감\n[취소] 차감 없이 결석만 기록')
    setActing(true)
    let charged = !!target.pt_charged
    if (wantCharge && !charged) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const r = await usePtSession(mid)
      if (!r.success) { alert('차감 실패: ' + r.error); setActing(false); return }
      charged = true
    } else if (!wantCharge && charged) {
      // 이미 차감돼 있었는데 이번엔 차감 안 함 → 복구
      const r = await refundPtSession(mid)
      if (!r.success) { alert('복구 실패: ' + r.error); setActing(false); return }
      charged = false
    }
    const res = await updateClassSession(target.id, { status: 'no_show', pt_charged: charged })
    setActing(false)
    if (!res.success) { alert('처리 실패: ' + res.error); return }
    onSaved()
  }

  // 취소 → cancelled. 차감돼 있었으면 복구.
  const handleCancelSession = async () => {
    if (acting) return
    if (!window.confirm('이 수업을 취소할까요?' + (target.pt_charged ? '\n차감된 PT 1회가 복구됩니다.' : ''))) return
    setActing(true)
    if (target.pt_charged && mid) {
      const r = await refundPtSession(mid)
      if (!r.success) { alert('복구 실패: ' + r.error); setActing(false); return }
    }
    const res = await updateClassSession(target.id, { status: 'cancelled', pt_charged: false })
    setActing(false)
    if (!res.success) { alert('취소 실패: ' + res.error); return }
    onSaved()
  }

  const inp = {
    width: '100%', padding: '8px 10px', borderRadius: RADIUS.sm,
    border: `0.5px solid ${THEME.border}`, fontSize: FONT.md,
    fontFamily: 'inherit', background: '#FFF', color: THEME.text,
    boxSizing: 'border-box', outline: 'none',
  }
  const lbl = { fontSize: FONT.xs, color: THEME.textSub, marginBottom: 4, fontWeight: 500 }
  // time input — 한국 locale에서 "오전 07:00" 가 들어가 너비 충분히 필요
  const timeInp = { ...inp, padding: '8px 10px', textAlign: 'left', width: 130, minWidth: 130 }

  // 날짜 라벨 — input 없이 표시만
  const dateLabel = (() => {
    const [y, m, d] = dateStr.split('-')
    const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
    const wd = ['일','월','화','수','목','금','토'][dt.getDay()]
    return `${parseInt(m)}월 ${parseInt(d)}일 (${wd})`
  })()

  const TimeRow = (
    <div>
      <div style={lbl}>시간</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
        <input
          type="time"
          value={startTime}
          onChange={e => setStartTime(e.target.value)}
          style={{ ...timeInp, flex: 1, minWidth: 0 }}
        />
        <span style={{ fontSize: FONT.sm, color: THEME.textSub, flexShrink: 0 }}>~</span>
        <input
          type="time"
          value={endTime}
          onChange={e => { setEndTime(e.target.value); setAutoEnd(false) }}
          style={{ ...timeInp, opacity: autoEnd ? 0.7 : 1, flex: 1, minWidth: 0 }}
        />
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginTop: 10,
        flexWrap: 'wrap',
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FONT.xs, color: THEME.textSub, cursor: 'pointer' }}>
          <input type="checkbox" checked={autoEnd} onChange={e => setAutoEnd(e.target.checked)} />
          수업 길이 기준 자동 종료
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="number"
            min={5}
            max={300}
            step={5}
            value={sessionLen}
            onChange={e => {
              const v = parseInt(e.target.value || '0', 10)
              if (Number.isFinite(v) && v > 0) setSessionLen(v)
            }}
            style={{ ...inp, width: 58, padding: '4px 6px', textAlign: 'center', fontSize: FONT.sm }}
          />
          <span style={{ fontSize: FONT.xs, color: THEME.textSub }}>분</span>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 1600, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
      pointerEvents: armed ? 'auto' : 'none',
    }} onClick={() => { if (armed) onClose() }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#FFF', borderRadius: 14,
        padding: 20, width: '100%', maxWidth: 460, maxHeight: '88vh', overflowY: 'auto',
        boxSizing: 'border-box', pointerEvents: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
            <p style={{ fontSize: FONT.lg, fontWeight: 500, color: THEME.text, margin: 0 }}>
              {isNew ? '슬롯 등록' : '슬롯 편집'}
            </p>
            <span style={{ fontSize: FONT.sm, color: THEME.primary, fontWeight: 500, whiteSpace: 'nowrap' }}>{dateLabel}</span>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 유형 — 트레이너만. 회원은 항상 예약 (UI 숨김) */}
          {isTrainer && (
            <div>
              <div style={lbl}>유형</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { k: 'reserve', l: '예약',    bg: STATUS_STYLE.scheduled.bg, border: STATUS_STYLE.scheduled.border, color: STATUS_STYLE.scheduled.text },
                  { k: 'off',     l: 'OFF',     bg: STATUS_STYLE.off.bg,       border: STATUS_STYLE.off.border,       color: STATUS_STYLE.off.text },
                  { k: 'general', l: '일반',    bg: STATUS_STYLE.general.bg,   border: STATUS_STYLE.general.border,   color: STATUS_STYLE.general.text },
                  { k: 'no_show', l: '노쇼',    bg: STATUS_STYLE.no_show.bg,   border: STATUS_STYLE.no_show.border,   color: STATUS_STYLE.no_show.text },
                ].map(({ k, l, bg, border, color }) => {
                  const active = kind === k
                  return (
                    <button
                      key={k}
                      onClick={() => setKind(k)}
                      style={{
                        padding: '7px 14px', borderRadius: RADIUS.sm,
                        border: `0.5px solid ${active ? border : THEME.border}`,
                        background: active ? bg : '#FFF',
                        color: active ? color : THEME.textSub,
                        fontSize: FONT.sm, fontWeight: active ? 500 : 400,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >{l}</button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 회원 검색 — kind=reserve & 트레이너만 */}
          {kind === 'reserve' && isTrainer && (
                <div style={{ position: 'relative' }}>
                  <div style={lbl}>회원 검색</div>
                  {selectedMember ? (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 10px', borderRadius: RADIUS.sm,
                      border: `0.5px solid ${THEME.primaryAccent}`,
                      background: THEME.primaryLight,
                    }}>
                      <span style={{ fontSize: FONT.md, color: THEME.primaryDark, fontWeight: 500 }}>
                        {selectedMember.name}
                        {(() => {
                          const tot = selectedMember.pt_total_sessions || 0
                          const rem = tot - (selectedMember.pt_used_sessions || 0)
                          return (
                            <span style={{ fontSize: FONT.xs, marginLeft: 8, color: tot <= 0 ? THEME.textHint : (rem > 0 ? THEME.primary : THEME.danger) }}>
                              {tot <= 0 ? 'PT 미등록' : `잔여 ${rem} / 총 ${tot}회`}
                            </span>
                          )
                        })()}
                      </span>
                      <button
                        onClick={() => { setMemberId(''); setMemberQuery(''); setShowMemberList(true) }}
                        style={{ background: 'transparent', border: 'none', color: THEME.textSub, fontSize: FONT.xs, cursor: 'pointer', fontFamily: 'inherit' }}
                      >변경</button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={memberQuery}
                        onChange={e => { setMemberQuery(e.target.value); setShowMemberList(true) }}
                        onFocus={() => setShowMemberList(true)}
                        placeholder="이름 또는 휴대전화번호"
                        style={inp}
                      />
                      {showMemberList && (
                        <div style={{
                          marginTop: 4, maxHeight: 180, overflowY: 'auto',
                          border: `0.5px solid ${THEME.border}`, borderRadius: RADIUS.sm,
                          background: '#FFF',
                        }}>
                          {filteredMembers.length === 0 ? (
                            <div style={{ padding: 12, fontSize: FONT.xs, color: THEME.textHint, textAlign: 'center' }}>
                              {(members || []).length === 0
                                ? '등록된 회원이 아직 없어요'
                                : '검색 결과가 없어요'}
                            </div>
                          ) : filteredMembers.map(m => {
                            const total = m.pt_total_sessions || 0
                            const rem = total - (m.pt_used_sessions || 0)
                            const noPt = total <= 0
                            return (
                              <button
                                key={m.id}
                                onClick={() => { setMemberId(m.id); setMemberQuery(''); setShowMemberList(false) }}
                                style={{
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                  width: '100%', padding: '8px 10px',
                                  background: '#FFF', border: 'none',
                                  borderBottom: `0.5px solid ${THEME.borderLight}`,
                                  fontSize: FONT.sm, color: THEME.text,
                                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                                }}
                              >
                                <span>{m.name}{m.phone ? <span style={{ color: THEME.textHint, fontSize: FONT.xs, marginLeft: 6 }}>{m.phone}</span> : null}</span>
                                <span style={{ fontSize: FONT.xs, color: noPt ? THEME.textHint : (rem > 0 ? THEME.primary : THEME.danger) }}>
                                  {noPt ? 'PT 미등록' : `잔여 ${rem}회`}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )}
            </div>
          )}

          {TimeRow}

          <div>
            <div style={lbl}>메모</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="(선택)" />
          </div>

          {/* 트레이너 — 신청 슬롯에 대한 승인/거절 */}
          {!isNew && isTrainer && target.status === 'requested' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={handleApprove} style={{ ...btnPrimary, background: THEME.primary }}>승인</button>
              <button onClick={handleReject} style={{ ...btnPrimary, background: THEME.danger }}>거절</button>
            </div>
          )}

          {/* 트레이너 — 회원 확정 슬롯 출석/결석/취소 (+PT 차감·복구) */}
          {!isNew && isTrainer && mid && ['scheduled','changed','completed','no_show','cancelled'].includes(target.status) && (
            <div>
              <div style={{ ...lbl, display: 'flex', justifyContent: 'space-between' }}>
                <span>출결</span>
                <span style={{ color: target.pt_charged ? THEME.danger : THEME.textHint }}>
                  {target.status === 'completed' ? '현재: 출석'
                    : target.status === 'no_show' ? '현재: 결석'
                    : target.status === 'cancelled' ? '현재: 취소'
                    : '현재: 예정'}
                  {target.pt_charged ? ' · PT 차감됨' : ''}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <button onClick={handleAttend} disabled={acting || target.status === 'completed'}
                  style={{ ...btnPrimary, background: target.status === 'completed' ? THEME.borderLight : THEME.primary, color: target.status === 'completed' ? THEME.textHint : '#FFF' }}>
                  출석
                </button>
                <button onClick={handleNoShow} disabled={acting || target.status === 'no_show'}
                  style={{ ...btnPrimary, background: target.status === 'no_show' ? THEME.borderLight : THEME.warning, color: target.status === 'no_show' ? THEME.textHint : '#FFF' }}>
                  결석
                </button>
                <button onClick={handleCancelSession} disabled={acting || target.status === 'cancelled'}
                  style={{ ...btnPrimary, background: '#FFF', color: THEME.danger, border: `0.5px solid ${THEME.border}` }}>
                  취소
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: isNew ? '1fr 1fr' : '1fr 1fr 1fr', gap: 8, marginTop: 4 }}>
            <button onClick={onClose} style={{ ...btnPrimary, background: '#FFF', color: THEME.textSub, border: `0.5px solid ${THEME.border}` }}>취소</button>
            {!isNew && (
              <button onClick={handleDelete} style={{ ...btnPrimary, background: '#FFF', color: THEME.danger, border: `0.5px solid ${THEME.border}` }}>삭제</button>
            )}
            <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, background: THEME.primary }}>
              {saving ? '저장 중…' : (isNew ? (kind === 'reserve' ? '예약하기' : '추가') : '저장')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function toLocalDate(d) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function toHHMM(d) {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

const btnPrimary = {
  border: 'none', color: '#FFF',
  padding: '11px', borderRadius: RADIUS.sm,
  fontSize: FONT.md, fontWeight: 500, cursor: 'pointer',
  fontFamily: 'inherit',
}

// ─── 운영시간 편집 모달 (트레이너 전용) ───
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function BusinessHoursModal({ trainerId, initial, onClose }) {
  // useModalBackButton 의도적으로 안 씀 — 부모 ScheduleModal 이 백버튼 받음.

  // 마운트 직후 overlay 가드 (pointer-events 차단)
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setArmed(true), 400)
    return () => clearTimeout(t)
  }, [])

  // 7일 × (open boolean, start, end) — initial = null 이면 전체 24시간 운영 기본
  const buildInitial = () => {
    const out = {}
    for (let i = 0; i < 7; i++) {
      const r = initial?.[String(i)]
      if (r == null) {
        // initial 자체가 null 이면 24시간 운영, initial 은 있는데 i 가 null/없으면 휴무
        out[i] = initial == null
          ? { open: true, start: 0, end: 24 }
          : { open: false, start: 9, end: 22 }
      } else {
        out[i] = { open: true, start: r[0], end: r[1] }
      }
    }
    return out
  }

  const [days, setDays] = useState(buildInitial)
  const [saving, setSaving] = useState(false)

  const updateDay = (i, patch) => {
    setDays(d => ({ ...d, [i]: { ...d[i], ...patch } }))
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    const payload = {}
    for (let i = 0; i < 7; i++) {
      const d = days[i]
      if (!d.open) {
        payload[i] = null
      } else {
        if (d.end <= d.start) {
          alert(`${DAY_LABELS[i]}요일: 종료 시간이 시작 시간보다 뒤여야 합니다.`)
          setSaving(false)
          return
        }
        payload[i] = [d.start, d.end]
      }
    }
    const res = await setBusinessHours(trainerId, payload)
    setSaving(false)
    if (!res.success) { alert('저장 실패: ' + res.error); return }
    onClose()
  }

  const handleClear = async () => {
    if (!window.confirm('운영 시간 설정을 해제할까요?\n(모든 시간 운영 — 회원 신청 시간 제약 없음)')) return
    setSaving(true)
    const res = await setBusinessHours(trainerId, null)
    setSaving(false)
    if (!res.success) { alert('해제 실패: ' + res.error); return }
    onClose()
  }

  const inp = {
    width: 60, padding: '5px 6px', borderRadius: RADIUS.sm,
    border: `0.5px solid ${THEME.border}`, fontSize: FONT.sm,
    fontFamily: 'inherit', background: '#FFF', color: THEME.text,
    boxSizing: 'border-box', outline: 'none', textAlign: 'center',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 1650, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
      pointerEvents: armed ? 'auto' : 'none',
    }} onClick={() => { if (armed) onClose() }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#FFF', borderRadius: 14,
        padding: 20, width: '100%', maxWidth: 460, maxHeight: '88vh', overflowY: 'auto',
        boxSizing: 'border-box',
        pointerEvents: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <p style={{ fontSize: FONT.lg, fontWeight: 500, color: THEME.text, margin: 0 }}>운영 시간</p>
          <CloseButton onClick={onClose} />
        </div>

        <p style={{ fontSize: FONT.xs, color: THEME.textSub, margin: '0 0 14px', lineHeight: 1.5 }}>
          요일별로 운영 시간을 정해두면 회원이 그 외 시간엔 신청할 수 없어요.<br/>
          본인(트레이너)은 운영 시간 외에도 일정 추가 가능합니다.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {DAY_LABELS.map((lbl, i) => {
            const d = days[i]
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', background: THEME.cardAlt, borderRadius: RADIUS.sm,
              }}>
                <span style={{ width: 18, fontSize: FONT.sm, fontWeight: 500, color: THEME.text }}>{lbl}</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: FONT.xs, color: THEME.textSub, cursor: 'pointer' }}>
                  <input type="checkbox" checked={d.open} onChange={e => updateDay(i, { open: e.target.checked })} />
                  운영
                </label>
                {d.open ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                    <input
                      type="number"
                      min={0}
                      max={24}
                      value={d.start}
                      onChange={e => updateDay(i, { start: parseInt(e.target.value || '0', 10) })}
                      style={inp}
                    />
                    <span style={{ fontSize: FONT.xs, color: THEME.textSub }}>시 ~</span>
                    <input
                      type="number"
                      min={0}
                      max={24}
                      value={d.end}
                      onChange={e => updateDay(i, { end: parseInt(e.target.value || '0', 10) })}
                      style={inp}
                    />
                    <span style={{ fontSize: FONT.xs, color: THEME.textSub }}>시</span>
                  </div>
                ) : (
                  <span style={{ marginLeft: 'auto', fontSize: FONT.xs, color: THEME.textHint }}>휴무</span>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
          <button onClick={handleClear} disabled={saving} style={{ ...btnPrimary, background: '#FFF', color: THEME.danger, border: `0.5px solid ${THEME.border}` }}>
            제약 해제
          </button>
          <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, background: THEME.primary }}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

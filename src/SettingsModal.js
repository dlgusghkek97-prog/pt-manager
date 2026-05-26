import React, { useEffect, useState } from 'react'
import {
  THEME, SPACING, FONT, RADIUS,
  isPushSupported, getPushPermissionStatus, isPushSubscribed,
  subscribeToPush, unsubscribeFromPush,
  getFeedNotifEnabled, setFeedNotifEnabled,
  getScheduleEnabled, setScheduleEnabled,
  KAKAO_SUPPORT_URL,
} from './utils'
import useModalBackButton from './useModalBackButton'
import CloseButton from './CloseButton'
import SubscriptionModal from './SubscriptionModal'
import LegalModal from './LegalModal'

// 풀스크린 설정 모달.
// userType: 'trainer' | 'member'  — 트레이너에게만 구독 플랜 노출.
// onShareTrainerInvite (선택): 트레이너 추천 카톡 안내문 클립보드 복사 (트레이너 한정)
export default function SettingsModal({ user, userType, onClose, onLogout, onShareTrainerInvite }) {
  useModalBackButton(true, onClose)

  const [pushOn, setPushOn] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [feedOn, setFeedOn] = useState(true)
  const [feedBusy, setFeedBusy] = useState(false)
  const [scheduleOn, setScheduleOn] = useState(false)
  const [scheduleBusy, setScheduleBusy] = useState(false)
  const [subOpen, setSubOpen] = useState(false)
  const [legalOpen, setLegalOpen] = useState(null)  // 'terms' | 'privacy' | 'refund'

  useEffect(() => {
    let alive = true
    ;(async () => {
      const subscribed = await isPushSubscribed(user.id)
      if (alive) setPushOn(subscribed)
      const feed = await getFeedNotifEnabled(user.id, userType)
      if (alive) setFeedOn(feed)
      const sched = await getScheduleEnabled(user.id, userType)
      if (alive) setScheduleOn(sched)
    })()
    return () => { alive = false }
  }, [user.id, userType])

  const handlePushToggle = async () => {
    if (pushBusy) return
    setPushBusy(true)
    if (pushOn) {
      const res = await unsubscribeFromPush(user.id)
      if (res.success) setPushOn(false)
      else alert('해제 실패: ' + (res.error || ''))
    } else {
      if (!isPushSupported()) {
        alert('이 브라우저는 푸시 알림을 지원하지 않습니다.')
        setPushBusy(false)
        return
      }
      const status = getPushPermissionStatus()
      if (status === 'denied') {
        alert('브라우저에서 알림이 차단되어 있습니다.\n브라우저 설정에서 허용으로 바꿔주세요.')
        setPushBusy(false)
        return
      }
      const res = await subscribeToPush(user.id, userType)
      if (res.success) setPushOn(true)
      else alert(res.error || '등록 실패')
    }
    setPushBusy(false)
  }

  const handleFeedToggle = async () => {
    if (feedBusy) return
    setFeedBusy(true)
    const next = !feedOn
    const res = await setFeedNotifEnabled(user.id, userType, next)
    if (res.success) setFeedOn(next)
    else alert('변경 실패: ' + (res.error || ''))
    setFeedBusy(false)
  }

  const handleScheduleToggle = async () => {
    if (scheduleBusy) return
    setScheduleBusy(true)
    const next = !scheduleOn
    const res = await setScheduleEnabled(user.id, userType, next)
    if (res.success) setScheduleOn(next)
    else alert('변경 실패: ' + (res.error || ''))
    setScheduleBusy(false)
  }

  const handleKakao = () => {
    if (!KAKAO_SUPPORT_URL) {
      alert('1:1 카카오톡 상담 채널이 아직 준비되지 않았습니다.\n빠른 시일 내에 안내드릴게요.')
      return
    }
    window.open(KAKAO_SUPPORT_URL, '_blank', 'noopener,noreferrer')
  }

  const sectionLabel = {
    fontSize: FONT.xs,
    color: THEME.textHint,
    margin: `${SPACING.md}px ${SPACING.sm}px ${SPACING.xs}px`,
    fontWeight: 500,
  }

  const row = {
    display: 'flex',
    alignItems: 'center',
    gap: SPACING.sm,
    background: '#FFF',
    padding: '12px 14px',
    cursor: 'pointer',
    border: 'none',
    width: '100%',
    fontFamily: 'inherit',
    textAlign: 'left',
    boxSizing: 'border-box',
  }

  const rowTitle = { fontSize: FONT.sm, color: THEME.text, fontWeight: 500 }
  const rowSub = { fontSize: FONT.xs, color: THEME.textSub, marginTop: 2 }

  const ArrowRight = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={THEME.textHint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )

  const Toggle = ({ on, busy, onChange }) => (
    <button
      onClick={onChange}
      disabled={busy}
      style={{
        width: 44, height: 24, borderRadius: 12,
        background: on ? THEME.primary : THEME.border,
        border: 'none', position: 'relative', cursor: busy ? 'wait' : 'pointer',
        transition: 'background 0.15s ease', flexShrink: 0, padding: 0,
        opacity: busy ? 0.6 : 1,
      }}
      aria-label="토글"
    >
      <span style={{
        position: 'absolute', top: 2, left: on ? 22 : 2,
        width: 20, height: 20, borderRadius: '50%',
        background: '#FFF', transition: 'left 0.15s ease',
        boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
      }} />
    </button>
  )

  const Icon = ({ bg, children }) => (
    <div style={{
      width: 32, height: 32, borderRadius: 9,
      background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, fontSize: 16,
    }}>{children}</div>
  )

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, background: THEME.bg, zIndex: 1500,
        overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 10px', background: '#FFF',
          borderBottom: `0.5px solid ${THEME.border}`,
          position: 'sticky', top: 0, zIndex: 1,
        }}>
          <CloseButton onClick={onClose} ariaLabel="닫기" />
          <div style={{ fontSize: FONT.md, color: THEME.text, fontWeight: 500 }}>설정</div>
          <div style={{ width: 32 }} />  {/* 우측 균형 */}
        </div>

        <div style={{ paddingBottom: 32, maxWidth: 520, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          {/* 프로필 카드 */}
          <div style={{
            background: '#FFF', margin: `${SPACING.sm}px ${SPACING.sm}px 0`,
            borderRadius: RADIUS.lg, padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: SPACING.sm,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: THEME.primaryLight, color: THEME.primaryDark,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 19, fontWeight: 500, flexShrink: 0,
            }}>
              {(user.name || user.email || '?').slice(0, 1)}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: FONT.md, color: THEME.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name || (userType === 'trainer' ? '트레이너' : '회원')}
              </div>
              <div style={{ fontSize: FONT.xs, color: THEME.textSub, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.email || ''}
              </div>
            </div>
          </div>

          {/* 계정 — 트레이너만 */}
          {userType === 'trainer' && (
            <>
              <div style={sectionLabel}>계정</div>
              <button style={{ ...row, borderRadius: RADIUS.md, marginInline: SPACING.md }} onClick={() => setSubOpen(true)}>
                <Icon bg="#E8E0F4">💎</Icon>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={rowTitle}>구독 플랜</div>
                  <div style={rowSub}>플랜 변경 · 결제 수단</div>
                </div>
                <ArrowRight />
              </button>
            </>
          )}

          {/* 기능 — 트레이너만 노출 (회원은 트레이너 설정에 종속) */}
          {userType === 'trainer' && (
            <>
              <div style={sectionLabel}>기능</div>
              <div style={{
                background: '#FFF', borderRadius: RADIUS.md, marginInline: SPACING.sm,
                overflow: 'hidden',
              }}>
                <div style={{ ...row, cursor: 'default' }}>
                  <Icon bg="#DEE9F5">📅</Icon>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={rowTitle}>스케줄</div>
                    <div style={rowSub}>
                      {scheduleOn
                        ? '메인 탭에서 사용 중'
                        : '수업 시간표를 관리하려면 켜세요'}
                    </div>
                  </div>
                  <Toggle on={scheduleOn} busy={scheduleBusy} onChange={handleScheduleToggle} />
                </div>
              </div>
            </>
          )}

          {/* 알림 */}
          <div style={sectionLabel}>알림</div>
          <div style={{
            background: '#FFF', borderRadius: RADIUS.md, marginInline: SPACING.sm,
            overflow: 'hidden',
          }}>
            <div style={{ ...row, cursor: 'default' }}>
              <Icon bg="#FFF6DB">🔔</Icon>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={rowTitle}>푸시 알림</div>
                <div style={rowSub}>
                  {pushOn ? '앱이 꺼져 있어도 알림 받음' : (
                    isPushSupported()
                      ? '꺼짐 — 켜기를 권장합니다'
                      : '이 브라우저는 지원하지 않습니다'
                  )}
                </div>
              </div>
              <Toggle on={pushOn} busy={pushBusy} onChange={handlePushToggle} />
            </div>

            <div style={{ height: 0.5, background: THEME.border, marginInline: 16 }} />

            <div style={{ ...row, cursor: 'default' }}>
              <Icon bg="#FBEEDB">📝</Icon>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={rowTitle}>일지 피드 알림</div>
                <div style={rowSub}>
                  {userType === 'trainer'
                    ? '회원이 새 운동·식단 기록을 올리면 알림'
                    : '트레이너가 새 일지를 올리면 알림'}
                </div>
              </div>
              <Toggle on={feedOn} busy={feedBusy} onChange={handleFeedToggle} />
            </div>
          </div>

          {/* 기타 */}
          <div style={sectionLabel}>기타</div>
          <div style={{
            background: '#FFF', borderRadius: RADIUS.md, marginInline: SPACING.sm,
            overflow: 'hidden',
          }}>
            <button style={row} onClick={() => setLegalOpen('terms')}>
              <Icon bg={THEME.primaryLight}>📄</Icon>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={rowTitle}>이용약관</div>
              </div>
              <ArrowRight />
            </button>
            <div style={{ height: 0.5, background: THEME.border, marginInline: 16 }} />
            <button style={row} onClick={() => setLegalOpen('privacy')}>
              <Icon bg={THEME.primaryLight}>🔒</Icon>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={rowTitle}>개인정보처리방침</div>
              </div>
              <ArrowRight />
            </button>
            <div style={{ height: 0.5, background: THEME.border, marginInline: 16 }} />
            <button style={row} onClick={() => setLegalOpen('refund')}>
              <Icon bg={THEME.primaryLight}>↩️</Icon>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={rowTitle}>환불 정책</div>
              </div>
              <ArrowRight />
            </button>
            <div style={{ height: 0.5, background: THEME.border, marginInline: 16 }} />
            <button style={row} onClick={handleKakao}>
              <Icon bg="#FFEFBA">💬</Icon>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={rowTitle}>1:1 카카오톡 상담</div>
                <div style={rowSub}>건의·문의는 카카오톡으로</div>
              </div>
              <ArrowRight />
            </button>
            {userType === 'trainer' && onShareTrainerInvite && (
              <>
                <div style={{ height: 0.5, background: THEME.border, marginInline: 16 }} />
                <button style={row} onClick={onShareTrainerInvite}>
                  <Icon bg="#E0F2EE">📣</Icon>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={rowTitle}>동료 트레이너에게 추천</div>
                    <div style={rowSub}>카톡 안내 문구를 클립보드에 복사</div>
                  </div>
                  <ArrowRight />
                </button>
              </>
            )}
          </div>

          {/* 로그아웃 */}
          <button
            onClick={onLogout}
            style={{
              display: 'block',
              background: '#FFF', color: THEME.danger,
              border: 'none', borderRadius: RADIUS.md,
              padding: '12px 14px', margin: `${SPACING.md}px ${SPACING.sm}px 0`,
              width: `calc(100% - ${SPACING.sm * 2}px)`,
              fontSize: FONT.sm, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'inherit', textAlign: 'center',
              boxSizing: 'border-box',
            }}
          >
            로그아웃
          </button>

          <div style={{
            fontSize: 10, color: THEME.textHint, textAlign: 'center',
            marginTop: SPACING.lg,
          }}>
            PT Manager
          </div>
        </div>
      </div>

      {subOpen && userType === 'trainer' && (
        <SubscriptionModal
          trainerId={user.id}
          trainerEmail={user.email}
          onClose={() => setSubOpen(false)}
        />
      )}
      {legalOpen && (
        <LegalModal kind={legalOpen} onClose={() => setLegalOpen(null)} />
      )}
    </>
  )
}

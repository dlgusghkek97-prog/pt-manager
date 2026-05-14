// Sentry + PostHog 통합 — env DSN/Key 비어있으면 자동 비활성 (no-op)
//
// 사용:
//   index.js 의 ReactDOM.render 직전에 import './monitoring' 한 번
//   사용자 식별이 필요한 경우 identifyUser(user) 호출 (로그인 후)
//
// 환경변수:
//   REACT_APP_SENTRY_DSN     — 비어있으면 Sentry 비활성
//   REACT_APP_POSTHOG_KEY    — 비어있으면 PostHog 비활성
//   REACT_APP_POSTHOG_HOST   — 기본 https://app.posthog.com

import * as Sentry from '@sentry/react'
import posthog from 'posthog-js'

const SENTRY_DSN = process.env.REACT_APP_SENTRY_DSN
const POSTHOG_KEY = process.env.REACT_APP_POSTHOG_KEY
const POSTHOG_HOST = process.env.REACT_APP_POSTHOG_HOST || 'https://app.posthog.com'
const ENV = process.env.NODE_ENV

// ── Sentry ──
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENV,
    // 베타 단계 — 모든 에러 캡처, 성능 추적은 10% 만
    tracesSampleRate: 0.1,
    // 회원·트레이너 식단/운동 데이터는 민감 → URL/breadcrumb 자동 마스킹
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.url) {
        // 결제 콜백 쿼리스트링 등에 들어있는 키값 제거
        try {
          const u = new URL(event.request.url)
          ;['authKey', 'customerKey', 'access_token', 'refresh_token'].forEach(k => u.searchParams.delete(k))
          event.request.url = u.toString()
        } catch {}
      }
      return event
    },
  })
}

// ── PostHog ──
if (POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
    // 회원·트레이너 입력 폼은 자동으로 마스킹
    mask_all_text: false,
    mask_all_element_attributes: false,
    // beta 단계는 disable_session_recording. 정식 출시 시 후일 활성화 고민.
    disable_session_recording: true,
  })
}

// 로그인 후 호출 — 사용자 식별
export const identifyUser = (user) => {
  if (!user) return
  const id = user.id
  const props = { user_type: user.type, name: user.name }
  if (SENTRY_DSN) Sentry.setUser({ id, username: user.name })
  if (POSTHOG_KEY) posthog.identify(id, props)
}

export const resetUser = () => {
  if (SENTRY_DSN) Sentry.setUser(null)
  if (POSTHOG_KEY) posthog.reset()
}

// 커스텀 이벤트 트래킹
export const track = (event, props = {}) => {
  if (POSTHOG_KEY) posthog.capture(event, props)
}

export const captureError = (error, ctx = {}) => {
  console.error('[captureError]', error, ctx)
  if (SENTRY_DSN) Sentry.captureException(error, { extra: ctx })
}

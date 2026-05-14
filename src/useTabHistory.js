import { useEffect, useRef } from 'react'

// 탭 전환을 브라우저 history 에 push → 핸드폰 / 브라우저 뒤로가기로 이전 탭 상태 복원.
//
// tabs: { key: [value, setter] } — 추적할 탭 state 묶음
//   ex) { mainTab: [mainTab, setMainTab], subTab: [subTab, setSubTab] }
//
// 동작:
// 1. 첫 마운트: 현재 history entry 에 replaceState 로 초기 snapshot 을 심음 (기존 state 보존).
// 2. 추적 값이 변하면 새 snapshot 으로 pushState — 한 entry = 한 탭 상태.
// 3. popstate 가 본인 marker 일 때만 e.state.snapshot 으로 모든 setter 호출 (idempotent).
//
// useModalBackButton 과 같이 써도 됨 — 각 hook 이 자기 marker 만 처리하므로 충돌 없음.
//
// 사용:
//   useTabHistory({
//     mainTab: [mainTab, setMainTab],
//     workoutSubTab: [workoutSubTab, setWorkoutSubTab],
//     dietSubTab: [dietSubTab, setDietSubTab],
//   })
export default function useTabHistory(tabs) {
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs

  const ignoreRef = useRef(false)
  const initRef = useRef(false)
  const instanceRef = useRef(null)
  if (instanceRef.current == null) {
    instanceRef.current = `tabhist-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  const keys = Object.keys(tabs)
  const values = keys.map(k => tabs[k][0])
  const serialized = JSON.stringify({ keys, values })

  // 값 변경 → pushState (첫 호출은 replaceState)
  useEffect(() => {
    const snapshot = {}
    Object.entries(tabsRef.current).forEach(([k, [v]]) => { snapshot[k] = v })

    if (!initRef.current) {
      initRef.current = true
      const cur = window.history.state || {}
      window.history.replaceState(
        { ...cur, __tabSnapshot: instanceRef.current, snapshot },
        ''
      )
      return
    }

    if (ignoreRef.current) {
      ignoreRef.current = false
      return
    }

    window.history.pushState(
      { __tabSnapshot: instanceRef.current, snapshot },
      ''
    )
  }, [serialized])

  // popstate → snapshot 복원
  // 안전망: e.state 가 modal marker(__modalBack) 를 함께 가지고 있으면
  //   모달 닫기 흐름의 부산물 — tab snapshot 복원으로 인한 부모 state 변경 회피.
  useEffect(() => {
    const handle = (e) => {
      const s = e.state
      if (!s || s.__tabSnapshot !== instanceRef.current) return
      if (!s.snapshot) return
      // 모달 close 로 인한 popstate 면 tab 복원 안 함
      if (s.__modalBack != null) return

      let changed = false
      Object.entries(s.snapshot).forEach(([k, v]) => {
        if (tabsRef.current[k]?.[0] !== v) changed = true
      })
      if (!changed) return

      ignoreRef.current = true
      Object.entries(s.snapshot).forEach(([k, v]) => {
        const setter = tabsRef.current[k]?.[1]
        if (setter) setter(v)
      })
    }

    window.addEventListener('popstate', handle)
    return () => window.removeEventListener('popstate', handle)
  }, [])
}

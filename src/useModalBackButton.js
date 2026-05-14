import { useEffect, useRef } from 'react'

// 모달이 열려 있는 동안 핸드폰 뒤로가기 (browser back / popstate) 를 가로채서
// 라우팅 대신 모달만 닫히게 함.
//
// 동작:
// 1. 모달이 열림 → history 에 더미 state 푸시
// 2. 사용자가 뒤로가기 → popstate → onClose() 호출
// 3. 모달이 X/저장 등 다른 경로로 닫힘 → cleanup 에서 history.back() 한 번 호출해
//    푸시했던 더미 state 를 정리 (사용자 입장에선 변화 없음 — SPA 라 URL 그대로)
//
// 사용:
//   useModalBackButton(isOpen, onClose)
export default function useModalBackButton(isOpen, onClose) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!isOpen) return

    let closedByBack = false
    let armed = false  // pushState 직후 같은 tick 의 spurious popstate 가드
    const myMarker = Date.now() + Math.random()
    window.history.pushState({ __modalBack: myMarker }, '')

    // 다음 task 부터 popstate 신뢰 — pushState 가 동기적으로 발생시키는
    // 잠재적 잔여 popstate (브라우저별 차이) 차단
    setTimeout(() => { armed = true }, 0)

    const handlePopState = (e) => {
      if (!armed) return
      // 본인 marker 가 새 top 이면 — 다른 모달이 위에 있다가 pop. 본인 close 안 함.
      if (e.state?.__modalBack === myMarker) return
      // 새 top 에 다른 modal marker 가 있으면 — 본인 위에 그 modal 이 더 있었던 것.
      // 즉 본인은 stack 에 그대로 남아 있고 위쪽이 정리된 것 → close 안 함 (cascade 차단).
      if (e.state?.__modalBack != null) return
      // 새 top 이 tab marker / 빈 state 면 본인 entry 가 진짜 빠진 것 → close.
      closedByBack = true
      onCloseRef.current?.()
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      // X 버튼/외부 close 등으로 닫힘 → 본인 marker 가 stack top 일 때만 pop.
      // (다른 모달이 위에 추가로 push 되어 있는 경우엔 stale 1개 잠시 leftover 되지만,
      //  사용자의 system back 으로 자연 정리됨 — cascade close 가 가장 큰 문제라 이걸 우선.)
      if (closedByBack) return
      try {
        if (window.history.state?.__modalBack === myMarker) {
          window.history.back()
        }
      } catch {}
    }
  }, [isOpen])
}

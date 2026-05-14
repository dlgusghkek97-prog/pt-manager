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
      // 본인이 push 한 state 가 아직 top 이면 무시
      if (e.state && e.state.__modalBack === myMarker) return
      closedByBack = true
      onCloseRef.current?.()
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      // X 버튼 등으로 닫힘 → 푸시했던 state 비우기
      if (!closedByBack) {
        try { window.history.back() } catch {}
      }
    }
  }, [isOpen])
}

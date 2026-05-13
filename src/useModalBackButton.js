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
    const myMarker = Date.now() + Math.random()
    window.history.pushState({ __modalBack: myMarker }, '')

    const handlePopState = (e) => {
      // 본인이 push 한 state 가 아직 history 에 남아 있으면 (= 다른 모달/화면의
      // history.back() 으로 인한 popstate) 무시. 본인 state 가 빠졌을 때만 닫힘.
      if (e.state && e.state.__modalBack === myMarker) return
      closedByBack = true
      onCloseRef.current?.()
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      // 뒤로가기 외 경로(X 버튼/저장 등)로 닫힘 → 푸시했던 state 한 번 비워줘야 함
      if (!closedByBack) {
        try { window.history.back() } catch {}
      }
    }
  }, [isOpen])
}

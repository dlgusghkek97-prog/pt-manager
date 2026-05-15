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

    // body scroll lock — 모달 뒤 배경이 같이 스크롤되는 것 방지.
    // 중첩 모달 카운팅: data-modal-count 로 동시 마운트 추적.
    const cnt = parseInt(document.body.dataset.modalCount || '0', 10) + 1
    document.body.dataset.modalCount = String(cnt)
    if (cnt === 1) {
      document.body.dataset.prevOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }

    // 200ms 후부터 popstate 신뢰 — 마운트 직후 다른 useEffect 사이클이나
    // 잔여 popstate (브라우저별 차이) 가 모달을 즉시 닫는 케이스 차단.
    // 사용자가 모달 열자마자 200ms 내 system back 누를 가능성은 거의 없음.
    setTimeout(() => { armed = true }, 200)

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

      // body scroll lock 해제 — 중첩 카운트 -1, 0이면 원래 overflow 로
      const nextCnt = Math.max(0, parseInt(document.body.dataset.modalCount || '1', 10) - 1)
      document.body.dataset.modalCount = String(nextCnt)
      if (nextCnt === 0) {
        document.body.style.overflow = document.body.dataset.prevOverflow || ''
        delete document.body.dataset.prevOverflow
      }

      // X 버튼/외부 close 등으로 닫힘 → 본인 marker 가 stack top 일 때만 pop.
      if (closedByBack) return
      try {
        if (window.history.state?.__modalBack === myMarker) {
          window.history.back()
        }
      } catch {}
    }
  }, [isOpen])
}

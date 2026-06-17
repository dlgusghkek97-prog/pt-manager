import React from 'react'
import { THEME } from './utils'

// PT-Manager 마케팅 랜딩 페이지
// - 비로그인 진입 시 기본 화면
// - CTA 2개: [무료로 시작] (trainer signup) / [회원 접속]
// - 모바일/PC 반응형 (media query via injected <style>)
export default function LandingPage({ onStart, onMemberLogin, onTrainerLogin }) {
  const C = {
    accent: THEME.primary,
    dark: THEME.primaryDark,
    light: THEME.primaryLight,
    text: THEME.text,
    sub: THEME.textSub,
    hint: THEME.textHint,
    bg: THEME.bg,
    card: '#FFF',
    border: THEME.border,
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: 'inherit', color: C.text }}>
      <style dangerouslySetInnerHTML={{ __html: RESPONSIVE_CSS }} />

      {/* 상단 고정 헤더 */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderBottom: `0.5px solid ${C.border}`,
      }}>
        <div className="lp-container">
          <div className="lp-header-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 7,
                background: C.light, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: C.dark, fontSize: 11, fontWeight: 700, letterSpacing: '-0.5px',
                flexShrink: 0,
              }}>PT</div>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.dark, whiteSpace: 'nowrap' }}>PT Manager</span>
            </div>
            <div className="lp-header-actions">
              <button onClick={onMemberLogin} className="lp-header-ghost lp-hide-mobile">회원 접속</button>
              <button onClick={onTrainerLogin} className="lp-header-ghost">로그인</button>
              <button onClick={onStart} className="lp-header-primary">
                <span className="lp-hide-mobile">30일 </span>무료 시작
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="lp-section-hero">
        <div className="lp-container">
          <div className="lp-hero-grid">
            <div>
              <div style={{
                display: 'inline-block', background: C.light, color: C.dark,
                padding: '5px 11px', borderRadius: 12, fontSize: 11, fontWeight: 500,
                marginBottom: 16,
              }}>🎁 30일 무료 체험 · 결제 정보 입력 없이</div>
              <h1 className="lp-hero-title" style={{
                fontWeight: 700, lineHeight: 1.25,
                margin: '0 0 14px', color: C.dark, letterSpacing: '-1px',
              }}>
                PT 회원 관리,<br/>
                <span style={{ color: C.accent }}>이제 앱 하나로</span>
              </h1>
              <p className="lp-hero-sub" style={{ color: C.sub, lineHeight: 1.7, margin: '0 0 24px' }}>
                운동·식단·인바디·PT 스케줄·결제까지.<br/>
                엑셀과 카톡을 오가지 마세요.<br/>
                트레이너 한 명이 100명도 거뜬히 관리합니다.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
                <button onClick={onStart} className="lp-cta-primary">30일 무료로 시작</button>
                <button onClick={onMemberLogin} className="lp-cta-secondary">이미 회원이세요?</button>
              </div>
              <p style={{ fontSize: 11, color: C.hint, margin: 0, lineHeight: 1.6 }}>
                · 가입 2분 · 신용카드 등록 X · 회원이 가입 안 해도 코드만으로 접속
              </p>
            </div>

            {/* 시각 요소 — 폰 mockup (모바일에선 숨김) */}
            <div className="lp-hero-visual">
              <div className="lp-phone-frame">
                <div style={S.phoneScreen}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.dark, marginBottom: 10 }}>오늘의 목표</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
                    {[
                      { l: '칼로리', v: '2,200', c: '#E8A87C' },
                      { l: '탄수',   v: '180', c: '#A8D5BA' },
                      { l: '단백',   v: '220', c: '#E8B4BC' },
                      { l: '지방',   v: '60',  c: '#F2D5B5' },
                    ].map((m, i) => (
                      <div key={i} style={{ background: '#F5F5F0', borderRadius: 6, padding: 6, textAlign: 'center' }}>
                        <div style={{ fontSize: 7, color: C.sub, fontWeight: 500 }}>{m.l}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: m.c, marginTop: 2 }}>{m.v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.dark, marginBottom: 6 }}>오늘 운동 요약</div>
                  <div style={{ background: '#FFF', border: `0.5px solid ${C.border}`, borderRadius: 6, padding: 8, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
                      <span style={{ color: C.text, fontWeight: 600 }}>가슴 · 벤치프레스</span>
                      <span style={{ color: C.accent, fontWeight: 700 }}>3 set</span>
                    </div>
                    <div style={{ fontSize: 8, color: C.sub, marginTop: 3 }}>80kg × 8 · 80kg × 7 · 80kg × 6</div>
                  </div>
                  <div style={{ background: '#FFF', border: `0.5px solid ${C.border}`, borderRadius: 6, padding: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
                      <span style={{ color: C.text, fontWeight: 600 }}>등 · 랫풀다운</span>
                      <span style={{ color: C.accent, fontWeight: 700 }}>4 set</span>
                    </div>
                    <div style={{ fontSize: 8, color: C.sub, marginTop: 3 }}>60kg × 10 × 4</div>
                  </div>
                </div>
              </div>
              <div style={S.phoneShadow} />
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM / SOLUTION */}
      <section className="lp-section" style={{ background: C.card, borderTop: `0.5px solid ${C.border}`, borderBottom: `0.5px solid ${C.border}` }}>
        <div className="lp-container">
          <h2 className="lp-h2">이런 분들에게 추천드려요</h2>
          <p className="lp-h2sub">트레이너의 매일을 가볍게 만들어주는 PT 회원관리 SaaS</p>
          <div className="lp-grid3">
            {[
              { i: '📊', t: '엑셀·노트 관리가 한계라면', d: '회원 늘수록 기록이 흩어집니다. 한 화면에서 모두 보세요.' },
              { i: '⏰', t: '회원 관리가 너무 시간을 잡아먹는다면', d: '운동·식단 기록 5분, 피드백은 푸시 1번으로 끝.' },
              { i: '💪', t: 'PT 사업을 시작하려는 분', d: '회원 코드 발급·스케줄·결제까지 자동. 운영비 최소화.' },
            ].map((c, i) => (
              <div key={i} className="lp-feat-card">
                <div style={{ fontSize: 32, marginBottom: 10 }}>{c.i}</div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: C.dark, margin: '0 0 6px' }}>{c.t}</h3>
                <p style={{ fontSize: 12, color: C.sub, margin: 0, lineHeight: 1.6 }}>{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="lp-section">
        <div className="lp-container">
          <h2 className="lp-h2">핵심 기능</h2>
          <p className="lp-h2sub">회원 관리·코칭·결제·소통 — 트레이너에게 필요한 모든 것</p>
          <div className="lp-grid2">
            {[
              { i: '🏋️', t: '운동 기록 + 통계', d: '부위별·종목별 기록과 자동 PR 추적. 월별 볼륨 차트, radar 그래프로 회원의 변화를 한눈에.' },
              { i: '🍽️', t: '식단 기록 + AI 자동계산', d: '탄·단·지 입력하면 칼로리 자동. Atwater 4·4·9 공식. 즐겨찾기 · 일일 즐겨찾기로 1초 입력.' },
              { i: '📅', t: 'PT 스케줄·출결', d: '회원이 직접 신청 → 트레이너 승인/거절. 출석·결석·취소 시 PT 잔여 자동 차감/환불.' },
              { i: '📷', t: '인바디 추이', d: '체중·골격근량·체지방률 시계열 차트. 회원·트레이너 측정값 통합 표시.' },
              { i: '💬', t: '1:1 채팅 + 푸시', d: '회원 메시지가 트레이너 폰에 즉시 알림. 앱 끄고 있어도 잠금화면 푸시.' },
              { i: '💳', t: '구독 결제', d: '토스페이먼츠로 자동 정기결제. 3개 플랜(Starter / Standard / Pro). 가입 30일 무료.' },
            ].map((c, i) => (
              <div key={i} className="lp-feat-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 24 }}>{c.i}</div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: C.dark, margin: 0 }}>{c.t}</h3>
                </div>
                <p style={{ fontSize: 12, color: C.sub, margin: 0, lineHeight: 1.65 }}>{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="lp-section" style={{ background: C.light }}>
        <div className="lp-container">
          <h2 className="lp-h2">시작은 2분이면 충분합니다</h2>
          <p className="lp-h2sub">회원가입부터 첫 회원 등록까지</p>
          <div className="lp-grid3">
            {[
              { n: '1', t: '트레이너 가입', d: '이메일·비번 입력 → 인증 메일 클릭. 30일 무료 체험이 자동 시작됩니다.' },
              { n: '2', t: '회원 추가 + 코드 발급', d: '회원 이름·시작일 입력하면 6자리 접속 코드 자동 발급. 카톡으로 한 번에 전송.' },
              { n: '3', t: '회원이 코드로 접속', d: '회원은 가입·이메일 인증 불필요. 본인 이름과 코드만 입력하면 끝.' },
            ].map((c, i) => (
              <div key={i} className="lp-feat-card" style={{ background: '#FFF' }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: C.accent, color: '#FFF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 14, marginBottom: 10,
                }}>{c.n}</div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: C.dark, margin: '0 0 6px' }}>{c.t}</h3>
                <p style={{ fontSize: 12, color: C.sub, margin: 0, lineHeight: 1.65 }}>{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="lp-section">
        <div className="lp-container">
          <h2 className="lp-h2">합리적인 구독 플랜</h2>
          <p className="lp-h2sub">처음 30일은 무료 · 결제 정보 입력 없이 시작</p>
          <div className="lp-grid3">
            {[
              { code: 'Starter',  price: '9,900',  limit: '회원 10명', f: ['기본 기능 전부', '운동·식단 기록', '인바디·차트', '1:1 채팅'] },
              { code: 'Standard', price: '19,900', limit: '회원 30명', f: ['Starter 전부', 'PT 스케줄·출결', '푸시 알림', '미디어 업로드'], hot: true },
              { code: 'Pro',      price: '39,900', limit: '회원 무제한', f: ['Standard 전부', '대용량 미디어', '우선 지원', '대규모 운영 가능'] },
            ].map((p, i) => (
              <div key={i} className="lp-feat-card" style={{
                border: p.hot ? `2px solid ${C.accent}` : `0.5px solid ${C.border}`,
                position: 'relative',
              }}>
                {p.hot && (
                  <div style={{
                    position: 'absolute', top: -10, left: 14,
                    background: C.accent, color: '#FFF',
                    padding: '3px 10px', borderRadius: 10,
                    fontSize: 10, fontWeight: 600,
                  }}>가장 인기</div>
                )}
                <h3 style={{ fontSize: 14, fontWeight: 600, color: C.dark, margin: '0 0 4px' }}>{p.code}</h3>
                <p style={{ fontSize: 11, color: C.sub, margin: '0 0 12px' }}>{p.limit}</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 14 }}>
                  <span style={{ fontSize: 26, fontWeight: 700, color: C.dark }}>{p.price}</span>
                  <span style={{ fontSize: 12, color: C.sub }}>원/월</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {p.f.map((line, j) => (
                    <li key={j} style={{ fontSize: 11, color: C.text, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ color: C.accent, fontWeight: 700 }}>✓</span> {line}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: C.hint, textAlign: 'center', margin: '18px 0 0', lineHeight: 1.6 }}>
            추천 코드 입력 시 +3일 보너스 · 추천한 친구가 결제하면 추천인에게 +7일 추가
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-section" style={{ background: C.card, borderTop: `0.5px solid ${C.border}` }}>
        <div className="lp-container" style={{ maxWidth: 720 }}>
          <h2 className="lp-h2">자주 묻는 질문</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { q: '무료 체험 끝나면 자동 결제되나요?', a: '아니요. 결제 정보를 미리 입력하지 않으면 자동 결제되지 않습니다. 30일 후 본인이 직접 플랜을 선택해 결제하셔야 계속 사용 가능해요.' },
              { q: '회원도 별도 가입을 해야 하나요?', a: '아니요. 회원은 트레이너가 발급한 6자리 코드 + 본인 이름만 입력하면 접속됩니다. 이메일·비밀번호 불필요.' },
              { q: '데이터는 안전하게 보관되나요?', a: 'Supabase 의 PostgreSQL 위에 Row-Level Security 가 적용돼 본인 데이터는 본인만 볼 수 있습니다. HTTPS 전송 + 자동 백업.' },
              { q: '핸드폰에 앱을 설치해야 하나요?', a: '아니요. 브라우저 접속만으로 사용 가능. 홈 화면에 추가하면 앱처럼 전체화면 + 푸시 알림까지 받을 수 있어요.' },
              { q: '중도에 플랜 변경 / 환불 가능한가요?', a: '플랜 변경은 언제든 가능. 환불은 결제 후 7일 이내 1:1 채팅으로 요청해주세요.' },
            ].map((f, i) => (
              <div key={i} style={{ background: C.bg, borderRadius: 10, padding: '14px 16px' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.dark, margin: '0 0 6px' }}>Q. {f.q}</p>
                <p style={{ fontSize: 12, color: C.sub, margin: 0, lineHeight: 1.65 }}>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA bottom */}
      <section className="lp-section" style={{ background: C.dark, color: '#FFF' }}>
        <div className="lp-container" style={{ textAlign: 'center' }}>
          <h2 className="lp-cta-h2" style={{ fontWeight: 700, margin: '0 0 10px', letterSpacing: '-0.5px' }}>
            오늘 가입하고 30일 무료로 사용해보세요
          </h2>
          <p style={{ fontSize: 13, color: '#D8E5DD', margin: '0 0 22px', lineHeight: 1.6 }}>
            결제 정보 입력 없이 모든 기능 사용 · 부담 없이 시작
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={onStart} className="lp-cta-primary" style={{ background: '#FFF', color: C.dark }}>지금 무료로 시작</button>
            <button onClick={onMemberLogin} className="lp-cta-secondary" style={{ background: 'transparent', color: '#FFF', border: '1px solid #FFF' }}>회원 접속</button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '24px 0 36px', background: '#1A2A22', color: '#9EB5A8' }}>
        <div className="lp-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#FFF', marginBottom: 6 }}>PT Manager</div>
              <p style={{ fontSize: 11, margin: 0, lineHeight: 1.6 }}>트레이너를 위한 회원 관리 SaaS</p>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
              <a href="mailto:dlgusghkek97@gmail.com" style={{ color: '#9EB5A8', textDecoration: 'none' }}>문의</a>
              <a href="#" onClick={(e) => { e.preventDefault(); onStart() }} style={{ color: '#9EB5A8', textDecoration: 'none' }}>가입</a>
              <a href="#" onClick={(e) => { e.preventDefault(); onMemberLogin() }} style={{ color: '#9EB5A8', textDecoration: 'none' }}>회원 접속</a>
            </div>
          </div>

          {/* 사업자 정보 — 토스페이먼츠/카드사 심사 필수 */}
          <div style={{ fontSize: 10, color: '#9EB5A8', margin: '18px 0 0', lineHeight: 1.75, display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
            <span>상호명 <span style={{ color: '#C5DAD0' }}>현</span></span>
            <span>대표자 <span style={{ color: '#C5DAD0' }}>이현화</span></span>
            <span>사업자등록번호 <span style={{ color: '#C5DAD0' }}>380-23-02636</span></span>
            <span style={{ flexBasis: '100%' }}>주소 <span style={{ color: '#C5DAD0' }}>경기도 부천시 오정구 원종로29번길 55 대성주택 A동 201호</span></span>
            <span>연락처 <span style={{ color: '#C5DAD0' }}>010-2797-7389</span></span>
            <span>이메일 <span style={{ color: '#C5DAD0' }}>dlgusghkek97@gmail.com</span></span>
          </div>

          <p style={{ fontSize: 10, color: '#6B8579', margin: '14px 0 0', lineHeight: 1.6 }}>
            © {new Date().getFullYear()} PT Manager. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

// ─── 반응형 CSS ──────────────────────────────────────────
const RESPONSIVE_CSS = `
.lp-container {
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 20px;
  box-sizing: border-box;
}
.lp-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  gap: 8px;
}
.lp-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.lp-header-ghost {
  background: transparent;
  color: ${THEME.textSub};
  border: none;
  padding: 6px 8px;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
}
.lp-header-primary {
  background: ${THEME.primary};
  color: #FFF;
  border: none;
  border-radius: 8px;
  padding: 7px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
}
.lp-section-hero { padding: 60px 0 50px; }
.lp-section { padding: 50px 0; }
.lp-hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 28px;
  align-items: center;
}
.lp-hero-title { font-size: 36px; }
.lp-hero-sub { font-size: 15px; }
.lp-hero-visual {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}
.lp-phone-frame {
  width: 220px;
  height: 440px;
  background: #2D4A3E;
  border-radius: 28px;
  padding: 8px;
  box-shadow: 0 20px 60px rgba(45,74,62,0.3), 0 8px 20px rgba(0,0,0,0.1);
  position: relative;
  z-index: 2;
}
.lp-grid2 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
}
.lp-grid3 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 14px;
}
.lp-feat-card {
  background: #FFF;
  border: 0.5px solid ${THEME.border};
  border-radius: 12px;
  padding: 18px;
}
.lp-cta-primary {
  background: ${THEME.primary};
  color: #FFF;
  border: none;
  border-radius: 10px;
  padding: 14px 22px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
.lp-cta-secondary {
  background: #FFF;
  color: ${THEME.primaryDark};
  border: 1px solid ${THEME.primaryAccent};
  border-radius: 10px;
  padding: 14px 22px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
.lp-h2 {
  font-size: 24px;
  font-weight: 700;
  color: ${THEME.primaryDark};
  margin: 0 0 6px;
  letter-spacing: -0.5px;
  text-align: center;
}
.lp-h2sub {
  font-size: 13px;
  color: ${THEME.textSub};
  margin: 0 0 32px;
  line-height: 1.6;
  text-align: center;
}
.lp-cta-h2 { font-size: 26px; }

@media (max-width: 768px) {
  .lp-container { padding: 0 16px; }
  .lp-hide-mobile { display: none !important; }
  .lp-header-row { padding: 10px 0; }
  .lp-header-ghost { padding: 5px 6px; font-size: 11px; }
  .lp-header-primary { padding: 6px 10px; font-size: 11px; }
  .lp-section-hero { padding: 32px 0 40px; }
  .lp-section { padding: 40px 0; }
  .lp-hero-grid {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  .lp-hero-title { font-size: 28px; line-height: 1.3; }
  .lp-hero-sub { font-size: 14px; }
  .lp-hero-visual { display: none; }
  .lp-cta-primary { padding: 13px 18px; font-size: 13px; }
  .lp-cta-secondary { padding: 13px 18px; font-size: 13px; }
  .lp-h2 { font-size: 20px; }
  .lp-h2sub { font-size: 12px; margin: 0 0 24px; }
  .lp-cta-h2 { font-size: 22px; line-height: 1.35; }
  .lp-feat-card { padding: 14px; }
}
`

// 폰 mockup 내부 — 미디어쿼리 영향 없는 정적 스타일
const S = {
  phoneScreen: {
    background: '#F8F7F0',
    width: '100%',
    height: '100%',
    borderRadius: 22,
    padding: 14,
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  phoneShadow: {
    position: 'absolute',
    width: 240,
    height: 240,
    background: 'radial-gradient(circle, rgba(168,200,181,0.5) 0%, transparent 70%)',
    filter: 'blur(40px)',
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 1,
  },
}

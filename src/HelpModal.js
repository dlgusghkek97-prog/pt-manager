import React from 'react'
import { THEME } from './utils'

export default function HelpModal({ type, onClose }) {
  const isTrainer = type === 'trainer'

  const trainerSections = [
    {
      title: '회원 관리',
      items: [
        { label: '회원 추가', desc: '우상단 [+ 회원 추가] 클릭 → 이름·성별·목표·PT 시작일 입력 → 6자리 코드가 자동 생성됨' },
        { label: '코드 전달', desc: '회원 카드의 [전송] 버튼을 누르면 안내 메시지를 카톡으로 공유 가능' },
        { label: 'PT 시작일', desc: '회원 카드의 시작일을 탭하면 수정 가능. 자동으로 "N일째" 카운트' },
        { label: '날짜 변경', desc: '상단 ◀ ▶ 버튼으로 다른 날짜 식단/운동 확인. [오늘] 버튼으로 즉시 복귀' },
        { label: '회원 삭제', desc: '카드 우상단 ✕ 버튼 → 모든 운동/식단 기록도 함께 삭제됨 (복구 불가)' },
      ]
    },
    {
      title: '회원 상세 보기',
      items: [
        { desc: '회원 카드를 탭하면 해당 회원의 모든 기록을 자세히 볼 수 있습니다' },
        { desc: '운동·식단 탭과 그 안의 기록·통계로 회원의 진행 상황을 확인하고 피드백을 줄 수 있어요' },
      ]
    },
    {
      title: '내 기록 (트레이너 본인)',
      items: [
        { label: '목표 설정', desc: '우상단 [식단 설정] → 신체정보·활동량 입력하면 자동 계산' },
        { label: '목표 직접 수정', desc: '목표 카드를 탭하면 칼로리/탄단지 수치 직접 입력 가능' },
        { label: '체중·골격근량', desc: '식단 설정에서 입력한 정보가 운동 칼로리 자동 계산에도 사용됩니다' },
      ]
    },
    {
      title: '식단 사진 + 피드백 (NEW)',
      highlight: true,
      items: [
        { desc: '회원의 식단 페이지에서 매 식사 사진과 코멘트를 한눈에 확인하고 즉시 피드백 가능' },
      ],
      highlights: [
        { title: '식사별 사진 확인', desc: '아침/점심/저녁/간식 각 1장씩 회원이 올린 사진을 볼 수 있어요. 사진을 탭하면 크게 확대' },
        { title: '피드백 작성', desc: '식단 페이지 하단의 피드백 칸에 코멘트 입력 → [피드백 저장] 클릭. 회원 화면에도 그대로 표시됨' },
        { title: '날짜별 관리', desc: '날짜를 바꾸면 그 날짜의 사진/피드백이 따로 저장·표시됨. 과거 식단도 언제든 다시 보고 코멘트 가능' },
      ]
    },
    {
      title: '운동 칼로리 자동 계산 (NEW)',
      highlight: true,
      items: [
        { desc: '운동 기록 시 "오늘 소비 칼로리" 카드에 자동 표시됩니다' },
      ],
      highlights: [
        { title: '웨이트 칼로리', desc: '자동 추정 (식단 설정의 체중·골격근량 사용). 미입력시 70kg 기준으로 추정. 세트당 약 2분으로 계산' },
        { title: '유산소 칼로리', desc: '[+ 유산소 추가] 버튼으로 직접 입력 (런닝머신/스마트워치 표시값 그대로)' },
      ]
    },
    {
      title: '운동 기록 입력법',
      items: [
        { label: '1단계', desc: '부위 선택 (하체/가슴/등/어깨/팔/복근/코어)' },
        { label: '2단계', desc: '운동명 입력 (예: 벤치프레스)' },
        { label: '3단계', desc: '세트별 무게(kg)·횟수 입력 → 볼륨은 자동 계산' },
        { label: '4단계', desc: '사진/영상 첨부 (선택) - 운동 설명 칸 옆 카메라 버튼' },
        { label: '5단계', desc: '종목 더 추가 가능 → 마지막에 [전체 저장]' },
      ],
      highlights: [
        { title: '한 손씩 하는 운동 (덤벨컬 등)', desc: '양쪽을 합쳐서 한 세트로 기록 (예: 10kg / 10회)' },
        { title: '어시스트 운동 (어시스트 풀업 등)', desc: '본인 체중 - 어시스트 무게로 입력 (예: 60-20=40kg). 특이사항에 "어시스트 -20kg" 메모' },
        { title: '맨몸 운동 (푸쉬업, 풀업)', desc: '무게 칸에 본인 체중 입력' },
      ]
    },
    {
      title: '식단 기록 입력법',
      items: [
        { label: '입력 영역', desc: '아침/점심/저녁/간식 4개 영역으로 구분하여 입력' },
        { label: '입력 항목', desc: '탄수화물·단백질·지방(g) + 칼로리(kcal)' },
        { label: '자동 계산', desc: '칼로리를 비워두면 탄·단·지로 자동 계산됩니다 (탄·단×4 + 지×9)' },
      ],
      highlights: [
        { title: '영양정보 확인 방법', desc: '삼성헬스 앱으로 음식을 검색하면 탄·단·지·칼로리가 자동으로 나옵니다. 그 정보를 보고 입력하면 편해요. 회원에게도 동일하게 안내하시면 됩니다.' },
        { title: '회원과 공유', desc: '트레이너의 식단 기록과 목표 수치는 회원의 화면에 그대로 보입니다. 회원이 식단을 참고하고 동기부여 받을 수 있어요.' }
      ]
    },
    {
      title: '식단 통계 - 잉여 / 적자 (NEW)',
      highlight: true,
      items: [
        { desc: '식단 → 통계 → "잉여 / 적자" 탭에서 회원의 다이어트/벌크업 진행 상황을 한눈에 확인' },
      ],
      highlights: [
        { title: '파랑 (+) = 잉여 (살찜)', desc: '섭취 > 소비 → 벌크업 회원에게 좋음' },
        { title: '빨강 (−) = 적자 (빠짐)', desc: '섭취 < 소비 → 다이어트 회원에게 좋음' },
      ]
    },
    {
      title: 'TDEE 기반 잉여/적자 계산 공식 (NEW)',
      highlight: true,
      items: [
        { desc: '잉여/적자는 단순히 (섭취 − 운동소비)가 아니라, 회원의 TDEE(총 일일 에너지 소비량)를 기준으로 계산됩니다. BMR(기초대사량)과 NEAT(생활 활동)까지 모두 반영해서 정확합니다.' },
      ],
      highlights: [
        { title: '핵심 공식', desc: '잉여/적자 = 섭취 칼로리 − TDEE' },
        { title: 'TDEE 역산 공식 (다이어트)', desc: 'TDEE = 목표 섭취 + 강도값\n• 완만: 목표 + 300\n• 일반: 목표 + 500\n• 공격적: 목표 + 700' },
        { title: 'TDEE 역산 공식 (벌크업)', desc: 'TDEE = 목표 섭취 − 강도값\n• 완만: 목표 − 300\n• 일반: 목표 − 400\n• 공격적: 목표 − 500' },
        { title: '계산 예시 1 (다이어트 일반)', desc: '회원이 식단 설정에서 목표 1400kcal · 일반 강도로 설정 → TDEE = 1400 + 500 = 1900kcal\n오늘 1500kcal 섭취 → 잉여/적자 = 1500 − 1900 = -400kcal (적자, 살 빠짐)' },
        { title: '계산 예시 2 (벌크업 공격적)', desc: '목표 3500kcal · 공격적 강도 → TDEE = 3500 − 500 = 3000kcal\n오늘 3200kcal 섭취 → 잉여/적자 = 3200 − 3000 = +200kcal (잉여, 살 찜)' },
        { title: '왜 TDEE 기반인가?', desc: '운동 소비만 빼면 BMR(가만히 있어도 쓰는 에너지)이랑 NEAT(걷기·집안일 등 일상 활동)가 누락돼서 적자가 과대평가됩니다. TDEE는 이 모두를 포함하므로 실제 체중 변화 추세와 잘 맞습니다.' },
        { title: '식단 설정이 안 된 경우', desc: '회원이 식단 설정을 안 했거나 칼로리 목표가 0이면, 기존 방식(섭취 − 운동소비)으로 fallback 됩니다. 그래도 동작은 하지만 부정확하니 회원에게 식단 설정을 꼭 안내해주세요.' },
      ]
    },
    {
      title: '통계 보기',
      items: [
        { label: '주간', desc: '7일간 일자별 막대그래프. 영양소 탭(칼로리/탄수/단백/지방/잉여 적자)으로 전환' },
        { label: '월간', desc: '1~12월 비교. 각 월의 평균 칼로리/영양소 확인' },
      ]
    },
  ]

  const memberSections = [
    {
      title: '처음 시작할 때',
      highlight: true,
      items: [
        { label: '1', desc: '상단 [식단 설정] → 체중·골격근량 등 입력 → 목표 칼로리 자동 계산' },
        { label: '2', desc: '운동/식단 매일 기록 → 트레이너가 함께 확인하고 코칭' },
        { label: '3', desc: '소비/섭취 칼로리 비교해서 다이어트/벌크업 진행 상황 확인' },
      ]
    },
    {
      title: '목표 수치 카드',
      items: [
        { desc: '화면 상단에 항상 표시됨. 오늘의 식단이 목표 대비 몇 % 달성됐는지 한눈에 확인' },
        { label: '색상 의미', desc: '정상 색상(달성 중) / 빨강(목표 초과)' },
        { desc: '카드 숫자를 탭하면 언제든 목표를 직접 수정할 수 있어요' },
      ]
    },
    {
      title: '식단 사진 + 피드백 (NEW)',
      highlight: true,
      items: [
        { desc: '식사 사진을 올리면 트레이너가 보고 코멘트를 달아줘요' },
      ],
      highlights: [
        { title: '식사 사진 올리기', desc: '식단 기록 페이지 아래 "식사 사진" 영역에서 아침/점심/저녁/간식 각각 1장씩 업로드 가능. 사진을 탭하면 크게 보기' },
        { title: '사진 변경/삭제', desc: '사진 위 [삭제] 버튼으로 지우거나, 사진을 다시 탭해서 새로 올릴 수 있어요' },
        { title: '트레이너 피드백 받기', desc: '아래 "트레이너 피드백" 칸에 코멘트가 표시돼요. 본인도 자유롭게 메모 가능 - 식단 일기처럼 활용해도 좋아요' },
      ]
    },
    {
      title: '오늘 소비 칼로리 (NEW)',
      highlight: true,
      items: [
        { desc: '운동 기록 페이지 상단에 자동 표시됩니다. 웨이트 + 유산소 합산' },
      ],
      highlights: [
        { title: '웨이트 - 자동 추정', desc: '식단 설정에서 입력한 체중·골격근량 기반으로 자동 계산됨. 정확한 측정을 위해 식단 설정 먼저 해주세요' },
        { title: '유산소 - 직접 입력', desc: '[+ 유산소 추가] 버튼 → 종류와 소비 칼로리 입력 (런닝머신/스마트워치 표시값 그대로)' },
      ]
    },
    {
      title: '운동 기록',
      items: [
        { label: '기본 기록 방법', desc: '1) 부위 선택 → 2) 운동명 입력 → 3) 세트마다 무게(kg)·횟수 입력 → 4) [+ 종목 추가] → 5) [전체 저장]' },
      ],
      highlights: [
        { title: '한 손씩 하는 운동 (덤벨컬, 원암 로우 등)', desc: '양쪽을 합쳐서 한 세트로 기록하세요. 예) 덤벨컬 10kg을 양쪽 각각 10회씩 → 세트1: 10kg / 10회' },
        { title: '어시스트 운동 (어시스트 풀업, 어시스트 딥스 등)', desc: '무게 = 본인 체중 - 어시스트 무게. 예) 체중 60kg, 어시스트 -20kg → 세트1: 40kg / 10회. 특이사항에 "어시스트 -20kg" 메모해두면 좋아요' },
        { title: '맨몸 운동 (푸쉬업, 풀업, 스쿼트 등)', desc: '무게 칸에 본인 체중을 입력하세요. 예) 풀업 60kg(체중) / 8회' },
      ],
      itemsAfter: [
        { label: '사진/영상', desc: '운동 설명 칸 옆 카메라 버튼으로 첨부. 트레이너가 확인하고 피드백 줘요' },
        { label: '특이사항', desc: '무릎 통증, 컨디션 메모 등 자유롭게 작성' },
      ]
    },
    {
      title: '식단 기록',
      items: [
        { desc: '아침/점심/저녁/간식 4개 영역으로 구분하여 입력' },
        { label: '입력 항목', desc: '탄수화물·단백질·지방(g) + 칼로리(kcal)' },
        { label: '자동 계산', desc: '칼로리를 비워두면 탄·단·지로 자동 계산됩니다' },
      ],
      highlights: [
        { title: '영양정보 확인 방법', desc: '삼성헬스 앱으로 음식을 검색하면 탄·단·지·칼로리가 자동으로 나옵니다. 그 정보를 보고 입력하면 편해요.' }
      ]
    },
    {
      title: '식단 통계 - 잉여 / 적자 (NEW)',
      highlight: true,
      items: [
        { desc: '식단 → 통계 → "잉여 / 적자" 탭에서 살이 빠지는지 찌는지 확인' },
      ],
      highlights: [
        { title: '파랑 (+) = 잉여 (살찜)', desc: '먹은 칼로리 > 소비한 칼로리 → 벌크업 목표라면 좋음' },
        { title: '빨강 (−) = 적자 (빠짐)', desc: '먹은 칼로리 < 소비한 칼로리 → 다이어트 목표라면 좋음' },
      ]
    },
    {
      title: '통계 보기',
      items: [
        { label: '주간', desc: '7일간 일자별 막대그래프' },
        { label: '월간', desc: '1~12월 비교 (각 월의 평균)' },
        { label: '영양소 탭', desc: '칼로리 / 탄수화물 / 단백질 / 지방 / 잉여 적자 5가지 보기' },
      ]
    },
    {
      title: '자주 묻는 질문',
      danger: true,
      faqs: [
        { q: '코드 잊어버렸어요', a: '트레이너에게 문의하면 다시 알려드려요' },
        { q: '핸드폰 바꾸면 데이터 그대로?', a: '네! 어디서든 이름+코드로 들어오면 똑같이 사용' },
        { q: '소비 칼로리가 정확한가요?', a: '추정치예요. 운동 강도/휴식 시간에 따라 실제와 다를 수 있지만, 추세 확인용으로는 충분합니다' },
        { q: '식단 사진은 누가 볼 수 있나요?', a: '본인과 담당 트레이너만 볼 수 있어요' },
        { q: '다른 사람이 내 기록 볼 수 있나요?', a: '트레이너만 볼 수 있어요. 코드 모르는 사람은 접근 불가' },
        { q: '기록 수정/삭제 어떻게?', a: '해당 항목 탭 → 수정 또는 ✕ 버튼' },
      ]
    },
  ]

  const sections = isTrainer ? trainerSections : memberSections

  const sectionStyle = (highlight, danger) => {
    if (highlight) return { background: '#FFF7E6', borderLeft: `3px solid ${THEME.warning}`, borderRadius: '0 8px 8px 0' }
    if (danger) return { background: THEME.dangerLight, borderLeft: `3px solid ${THEME.danger}`, borderRadius: '0 8px 8px 0' }
    return { background: THEME.cardAlt, borderRadius: '8px' }
  }

  const titleColor = (highlight, danger) => {
    if (highlight) return '#8B6F2A'
    if (danger) return THEME.dangerDark
    return THEME.primary
  }

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFF',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '420px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 16px',
          background: '#FFF',
          borderBottom: `0.5px solid ${THEME.border}`,
          flexShrink: 0
        }}>
          <p style={{ fontSize: '14px', fontWeight: '500', color: THEME.primary, margin: 0 }}>
            {isTrainer ? '트레이너' : '회원'} 사용 설명서
          </p>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: THEME.textSub, padding: '0 4px', lineHeight: 1 }}
          >✕</button>
        </div>

        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 16px'
        }}>
          {sections.map((sec, idx) => (
            <div key={idx} style={{ ...sectionStyle(sec.highlight, sec.danger), padding: '11px', marginBottom: '9px' }}>
              <p style={{ fontSize: '12px', fontWeight: '500', color: titleColor(sec.highlight, sec.danger), margin: '0 0 7px' }}>
                {sec.title}
              </p>

              {sec.items && sec.items.map((item, i) => (
                <p key={i} style={{ fontSize: '11px', color: THEME.text, margin: '0 0 5px', lineHeight: '1.6' }}>
                  {item.label && <span style={{ fontWeight: '500' }}>{item.label}{item.label.length <= 2 ? '.' : ':'} </span>}
                  {item.desc}
                </p>
              ))}

              {sec.highlights && sec.highlights.map((h, i) => (
                <div key={i} style={{ background: '#FFF', borderLeft: `2px solid ${THEME.primary}`, borderRadius: '0 4px 4px 0', padding: '7px 10px', marginTop: '6px', marginBottom: '4px' }}>
                  <p style={{ fontSize: '11px', fontWeight: '500', color: THEME.primary, margin: '0 0 3px' }}>{h.title}</p>
                  <p style={{ fontSize: '10px', color: THEME.text, margin: 0, lineHeight: '1.5' }}>{h.desc}</p>
                </div>
              ))}

              {sec.itemsAfter && sec.itemsAfter.map((item, i) => (
                <p key={`after-${i}`} style={{ fontSize: '11px', color: THEME.text, margin: '6px 0 0', lineHeight: '1.6' }}>
                  {item.label && <span style={{ fontWeight: '500' }}>{item.label}: </span>}
                  {item.desc}
                </p>
              ))}

              {sec.faqs && sec.faqs.map((faq, i) => (
                <div key={i} style={{ marginBottom: i === sec.faqs.length - 1 ? 0 : '9px' }}>
                  <p style={{ fontSize: '11px', fontWeight: '500', color: THEME.text, margin: '0 0 2px' }}>Q. {faq.q}</p>
                  <p style={{ fontSize: '11px', color: THEME.textSub, margin: 0, lineHeight: '1.5' }}>A. {faq.a}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
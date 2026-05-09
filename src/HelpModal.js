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
        { label: '노란 점 표시 (NEW)', desc: '회원 이름 옆 작은 노란 점 = 직업 활동량 미설정. 회원 카드 진입 후 노란 배너 → [설정] 버튼으로 빠르게 설정 가능' },
      ]
    },
    {
      title: '회원 상세 보기',
      items: [
        { desc: '회원 카드를 탭하면 해당 회원의 모든 기록을 자세히 볼 수 있습니다' },
        { desc: '운동·식단 탭과 그 안의 기록·통계로 회원의 진행 상황을 확인하고 피드백을 줄 수 있어요' },
        { desc: '상단 회원정보 박스에서 [메모] [인바디] [추이] 버튼으로 빠르게 접근 가능' },
      ]
    },
    {
      title: '직업 활동량 (NEW v5)',
      highlight: true,
      items: [
        { desc: '식단 설정 모달에 직업 활동량(=일상 활동량) 선택이 추가됐어요. 운동 빈도와는 별개의 축으로, BMR에 곱해서 TDEE를 더 정확하게 계산합니다' },
      ],
      highlights: [
        { title: '왜 필요한가?', desc: '같은 체중·골격근량이어도 사무직과 택배기사는 하루 소비 칼로리가 크게 달라요. 기존엔 운동 빈도만 반영해서 사무직 회원의 TDEE가 과대평가되거나, 활동적인 회원은 과소평가되는 문제가 있었습니다' },
        { title: '4단계 옵션', desc: '• 사무직 / 좌식 (×1.00) — 사무, 운전, 콜센터, 학생\n• 일반 활동 (×1.05) — 매장 판매, 강사, 미용사\n• 활동적 (×1.10) — 간호사, 웨이터, 트레이너\n• 매우 활동적 (×1.15) — 택배, 이사, 건설, 농업' },
        { title: '계산 공식', desc: 'TDEE = BMR × 운동 빈도 × 직업 활동량\n(이전: BMR × 운동 빈도)' },
        { title: '기존 회원 안내', desc: 'v5 업데이트 전에 식단 설정한 회원/트레이너는 직업 활동량이 비어있어요. 회원 상세 진입 시 노란 배너로 안내되며, 트레이너가 [설정] 버튼으로 빠르게 다시 입력해주면 됩니다' },
        { title: '기본값 동작', desc: '직업 활동량이 비어있으면 자동으로 ×1.00(사무직)으로 계산됨. 동작은 멈추지 않지만 정확도가 떨어지므로 빠른 시일 내 설정 권장' },
      ]
    },
    {
      title: '회원 메모',
      items: [
        { desc: '회원 상세 화면 상단 [메모] 버튼 → 회원별 메모 작성 가능. 부상, 컨디션, 목표, 특이사항 등을 카테고리별로 정리' },
      ],
      highlights: [
        { title: '카테고리 만들기', desc: '메모창의 [관리] 버튼 → [+ 카테고리 추가]. 이름과 색상 선택해서 등록 (예: "건강", "부상", "목표"). 8가지 색상 풀에서 선택' },
        { title: '메모 작성', desc: '내용 입력 → 카테고리 선택 → [중요 메모로 표시] 체크 가능 → [메모 저장]' },
        { title: '중요 메모 노출', desc: '"중요 메모로 표시" 체크하면 해당 메모가 회원 상세 화면 상단(회원정보 박스 아래)에 항상 노출됨. PT 들어갈 때 빠르게 확인 가능' },
        { title: '메모 수정/삭제', desc: '메모 카드 탭하면 수정 모드. 우상단 ✕ 버튼으로 삭제' },
      ]
    },
    {
      title: '인바디 측정',
      items: [
        { desc: '회원 상세 화면 상단 [인바디] 버튼으로 트레이너가 직접 측정한 회원 인바디 입력. [추이] 버튼으로 변화 확인' },
      ],
      highlights: [
        { title: '입력 항목', desc: '측정일 / 체중(kg) / 골격근량(kg) / 체지방률(%). 모든 항목 필수' },
        { title: '회원 입력 + 트레이너 입력 통합', desc: '추이 차트에는 회원이 직접 입력한 측정값과 트레이너가 측정한 값이 모두 시계열로 합쳐서 표시됨. 회원입력은 ●(원), 트레이너측정은 ■(사각형)으로 구분' },
        { title: '추이 보기', desc: '전체/체중/골격근량/체지방률 탭으로 전환 가능. 시작 대비 변화량(+/-)이 카드에 자동 표시' },
        { title: '수정/삭제', desc: '인바디 입력 모달 하단 기록 목록에서 본인이 입력한 기록만 탭해서 수정/삭제 가능' },
      ]
    },
    {
      title: '4대 종목 PR',
      items: [
        { desc: '운동 → 통계 → PR 탭 상단에 스쿼트/데드리프트/벤치/오버헤드 4대 종목 카드가 항상 표시됨' },
      ],
      highlights: [
        { title: '직접 입력 + 자동 저장', desc: '카드의 무게/횟수 칸을 탭해서 직접 입력 → 입력칸 밖 클릭하면 자동 저장' },
        { title: '회원 양방향 수정', desc: '회원의 4대 종목 PR은 회원 본인과 담당 트레이너 모두 수정 가능. PT 시간에 트레이너가 새 PR 측정해서 바로 입력해주면 됨' },
        { title: '트레이너 본인 PR', desc: '"내 기록" → 운동 → 통계 → PR 탭에서 트레이너 본인의 4대 종목도 따로 관리. 트레이너 본인만 수정 가능' },
      ]
    },
    {
      title: '3대 중량 배너',
      items: [
        { desc: 'PR 탭 상단에 그라디언트 배너로 자동 표시. 스쿼트 + 데드리프트 + 벤치 합계 (오버헤드 제외)' },
        { desc: '4대 종목 PR을 입력하면 자동으로 3대 중량 합계가 계산되어 표시됨' },
      ]
    },
    {
      title: '휴식 타이머',
      items: [
        { desc: '운동 화면 우측 하단에 시계 아이콘 FAB(고정 버튼) 표시. 다른 화면(식단 등) 가면 자동으로 숨겨짐' },
      ],
      highlights: [
        { title: '시작', desc: 'FAB 탭 → 시간 선택 모달 (30/60/90/120초 + 직접 입력) → 시간 선택하면 FAB이 그 자리에서 카운트다운 위젯으로 펼쳐짐' },
        { title: '시간 조절', desc: '카운트다운 중에도 [-15s] [+15s] 버튼으로 즉시 조절 가능' },
        { title: '중지/재개/닫기', desc: '[중지] 버튼으로 일시정지, [재개]로 다시 시작, [닫기]로 위젯 접고 FAB으로 복귀' },
        { title: '종료 알림', desc: '0초 도달하면 알림음(880Hz) + 진동 + 색상 변경 + "휴식 완료" 라벨 표시. [▶ 시작] 버튼으로 같은 시간으로 재시작 가능' },
      ]
    },
    {
      title: '즐겨찾기 등록',
      items: [
        { desc: '운동 카드의 특이사항 옆에 [★] [등록] 버튼 2개로 즐겨찾기 관리' },
      ],
      highlights: [
        { title: '[등록] 버튼', desc: '부위와 운동명을 입력한 상태에서 누르면 즉시 즐겨찾기 등록. 이미 등록된 운동이면 [✓]로 표시되며, 누르면 해제 confirm' },
        { title: '[★] 버튼', desc: '즐겨찾기 목록 모달 열림. 부위 탭으로 전환 가능 → 운동 칩 탭하면 운동 카드의 부위/운동명이 자동 입력되고 모달이 닫힘' },
        { title: '최근 기록 자동 표시', desc: '즐겨찾기 등록된 운동은 운동 카드 안에 작은 띠로 최근 기록 표시 (예: "최근: 11.05 · 80kg × 5회")' },
      ]
    },
    {
      title: '식단 사진 + 피드백',
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
      title: '운동 칼로리 자동 계산',
      items: [
        { desc: '운동 기록 시 "오늘 소비 칼로리" 카드에 자동 표시됩니다' },
      ],
      highlights: [
        { title: '웨이트 칼로리', desc: '자동 추정 (식단 설정의 체중·골격근량 사용). 미입력시 70kg 기준으로 추정. 세트당 약 2분으로 계산' },
        { title: '유산소 칼로리', desc: '[+ 유산소 추가] 버튼으로 직접 입력 (런닝머신/스마트워치 표시값 그대로)' },
      ]
    },
    {
      title: '내 기록 (트레이너 본인)',
      items: [
        { label: '목표 설정', desc: '우상단 [식단 설정] → 신체정보·활동량·직업 활동량 입력하면 자동 계산' },
        { label: '목표 직접 수정', desc: '목표 카드를 탭하면 칼로리/탄단지 수치 직접 입력 가능' },
        { label: '체중·골격근량', desc: '식단 설정에서 입력한 정보가 운동 칼로리 자동 계산에도 사용됩니다' },
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
        { title: '한 손씩 하는 운동 (덤벨컬, 원암 로우 등)', desc: '양쪽 무게를 합쳐서 한 세트로 기록. 예) 5kg 덤벨 2개로 10회 → 10kg / 10회. 8kg 덤벨 2개로 12회 → 16kg / 12회' },
        { title: '어시스트 운동 (어시스트 풀업, 어시스트 딥스 등)', desc: '본인 체중 - 어시스트 무게로 입력. 예) 체중 60kg, 어시스트 -20kg → 40kg / 10회. 특이사항에 "어시스트 -20kg" 메모' },
        { title: '맨몸 운동 (경사도 반영)', desc: '무게 = 본인 체중 × 강도 비율\n• 일반 푸쉬업 / 풀업 / 딥스 → 체중 × 100%\n• 인클라인 푸쉬업 (상체 위로) → 체중 × 50~70%\n• 디클라인 푸쉬업 (다리 위로) → 체중 × 110~130%\n예) 체중 60kg, 인클라인 푸쉬업 → 약 36~42kg / 10회' },
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
      title: '식단 통계 - 잉여 / 적자',
      items: [
        { desc: '식단 → 통계 → "잉여 / 적자" 탭에서 회원의 다이어트/벌크업 진행 상황을 한눈에 확인' },
      ],
      highlights: [
        { title: '파랑 (+) = 잉여 (살찜)', desc: '섭취 > 소비 → 벌크업 회원에게 좋음' },
        { title: '빨강 (−) = 적자 (빠짐)', desc: '섭취 < 소비 → 다이어트 회원에게 좋음' },
      ]
    },
    {
      title: 'TDEE 기반 잉여/적자 계산 공식 (v5 업데이트)',
      items: [
        { desc: '잉여/적자는 단순히 (섭취 − 운동소비)가 아니라, 회원의 TDEE(총 일일 에너지 소비량)를 기준으로 계산됩니다. BMR(기초대사량)과 NEAT(생활 활동)까지 모두 반영해서 정확합니다.' },
      ],
      highlights: [
        { title: '핵심 공식', desc: '잉여/적자 = 섭취 칼로리 − TDEE' },
        { title: 'TDEE 계산 (v5)', desc: 'TDEE = BMR × 운동 빈도 × 직업 활동량\n• BMR: 골격근량 기반 자동 계산\n• 운동 빈도: 1.375 / 1.55 / 1.725\n• 직업 활동량 (NEW): 1.00 / 1.05 / 1.10 / 1.15' },
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
        { label: '1', desc: '상단 [식단 설정] → 체중·골격근량·직업 활동량 등 입력 → 목표 칼로리 자동 계산' },
        { label: '2', desc: '운동/식단 매일 기록 → 트레이너가 함께 확인하고 코칭' },
        { label: '3', desc: '소비/섭취 칼로리 비교해서 다이어트/벌크업 진행 상황 확인' },
      ]
    },
    {
      title: '직업 활동량 추가됨 (NEW v5)',
      highlight: true,
      items: [
        { desc: '식단 설정에 "직업 활동량" 항목이 새로 추가됐어요. 본업·일상 활동량(사무직 / 일반 / 활동적 / 매우 활동적)을 선택하면 TDEE가 더 정확하게 계산됩니다' },
        { desc: '예전에 식단 설정을 한 적이 있다면, 화면 상단에 노란 배너가 떠요. 식단 설정을 다시 한 번 해주면 정확한 목표가 계산됩니다' },
        { desc: '잘 모르겠으면 트레이너에게 문의하세요. 트레이너도 회원의 식단 설정을 도와줄 수 있어요' },
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
      title: '인바디 입력 / 추이',
      items: [
        { desc: '상단 [인바디] 버튼으로 측정값 입력, [추이] 버튼으로 변화 확인' },
      ],
      highlights: [
        { title: '입력 항목', desc: '측정일 / 체중(kg) / 골격근량(kg) / 체지방률(%) 모두 필수' },
        { title: '추이 차트', desc: '전체/체중/골격근량/체지방률 탭으로 전환. 시작 대비 변화량(+/-)이 카드에 자동 표시' },
        { title: '트레이너 측정값도 같은 차트', desc: '담당 트레이너가 측정한 인바디도 같은 추이 차트에 합쳐서 표시돼요. 본인 입력은 ●(원), 트레이너 측정은 ■(사각형)으로 구분' },
        { title: '수정/삭제', desc: '인바디 입력 모달 하단 기록 목록에서 본인이 입력한 기록만 탭해서 수정/삭제 가능' },
      ]
    },
    {
      title: '4대 종목 PR',
      items: [
        { desc: '운동 → 통계 → PR 탭 상단에 스쿼트/데드리프트/벤치/오버헤드 4대 종목 카드가 항상 표시됨' },
      ],
      highlights: [
        { title: '입력 방법', desc: '카드의 무게/횟수 칸을 탭해서 직접 입력 → 입력칸 밖 클릭하면 자동 저장' },
        { title: '트레이너와 공유', desc: '담당 트레이너도 같이 보고 PT 시간에 새 기록을 입력해줄 수 있어요. 트레이너가 보고 코칭해줍니다' },
      ]
    },
    {
      title: '3대 중량 배너',
      items: [
        { desc: 'PR 탭 상단에 그라디언트 배너로 자동 표시' },
        { desc: '스쿼트 + 데드리프트 + 벤치 합계 (오버헤드 제외)가 자동 계산되어 표시됨' },
      ]
    },
    {
      title: '휴식 타이머',
      items: [
        { desc: '운동 화면 우측 하단의 시계 아이콘 버튼을 누르면 휴식 타이머 시작' },
      ],
      highlights: [
        { title: '시작', desc: '버튼 탭 → 30/60/90/120초 중 선택하거나 직접 입력 → 카운트다운 시작' },
        { title: '시간 조절', desc: '카운트다운 중에도 [-15s] [+15s] 버튼으로 즉시 조절 가능' },
        { title: '중지/재개', desc: '[중지] 버튼으로 일시정지, [재개]로 다시 시작' },
        { title: '종료 알림', desc: '0초가 되면 알림음과 진동으로 알려줘요. 핸드폰을 운동복 주머니에 넣어두고 운동해도 OK' },
      ]
    },
    {
      title: '즐겨찾기 등록',
      items: [
        { desc: '운동 카드의 특이사항 옆에 [★] [등록] 버튼 2개로 자주 하는 운동 관리' },
      ],
      highlights: [
        { title: '[등록] 버튼', desc: '부위와 운동명을 입력한 상태에서 누르면 즉시 즐겨찾기 등록. 이미 등록된 운동이면 [✓]로 표시 - 다시 누르면 해제' },
        { title: '[★] 버튼', desc: '즐겨찾기 목록 모달이 열림. 부위 탭으로 전환 → 운동 칩 탭하면 운동 카드에 자동 입력. 매번 운동명 타이핑 안 해도 됨' },
        { title: '최근 기록 자동 표시', desc: '즐겨찾기 등록된 운동은 운동 카드 안에 최근 기록이 작은 띠로 자동 표시 (예: "최근: 11.05 · 80kg × 5회"). 지난번 무게/횟수 보고 다음 세트 정하기 편해요' },
      ]
    },
    {
      title: '식단 사진 + 피드백',
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
      title: '오늘 소비 칼로리',
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
        { title: '한 손씩 하는 운동 (덤벨컬, 원암 로우 등)', desc: '양쪽 무게를 합쳐서 한 세트로 기록하세요.\n예) 5kg 덤벨 2개로 양쪽 각각 10회씩 → 10kg / 10회\n예) 8kg 덤벨 2개로 12회 → 16kg / 12회' },
        { title: '어시스트 운동 (어시스트 풀업, 어시스트 딥스 등)', desc: '무게 = 본인 체중 - 어시스트 무게.\n예) 체중 60kg, 어시스트 -20kg → 40kg / 10회.\n특이사항에 "어시스트 -20kg" 메모해두면 좋아요' },
        { title: '맨몸 운동 (경사도 반영)', desc: '무게 = 본인 체중 × 강도 비율\n• 일반 푸쉬업 / 풀업 / 딥스 → 체중 × 100%\n• 인클라인 푸쉬업 (상체 위로) → 체중 × 50~70%\n• 디클라인 푸쉬업 (다리 위로) → 체중 × 110~130%\n예) 체중 60kg, 인클라인 푸쉬업 → 약 36~42kg / 10회' },
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
      title: '식단 통계 - 잉여 / 적자',
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
        { q: '직업 활동량은 뭘 골라야 하나요?', a: '본업(직장·학교)에서 하루를 어떻게 보내는지 기준으로 골라주세요. 사무직 / 매장 판매 / 간호사·웨이터 / 택배·이사 순으로 활동적이에요. 잘 모르겠으면 트레이너에게 문의' },
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
                  <p style={{ fontSize: '10px', color: THEME.text, margin: 0, lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{h.desc}</p>
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
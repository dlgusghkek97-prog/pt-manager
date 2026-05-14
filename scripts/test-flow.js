// PT Manager — 베타 직전 백엔드 흐름 검증 스크립트
//
// 사용:
//   node scripts/test-flow.js
//
// 흐름:
//   1. 임의 트레이너 가입 (auth.signUp + handle_new_trainer_signup 트리거 자동 row 생성 기대)
//   2. 트레이너 row + 구독 trial row 생성됐는지 확인
//   3. can_add_member RPC ok 확인
//   4. members 1명 추가 (트레이너 권한)
//   5. 회원 anonymous 로그인 + claim_member RPC
//   6. 회원으로 운동 1개·식단 1끼니 INSERT
//   7. is_my_trainer 정책 확인 — 회원이 trainer_workout_logs/trainer_diet_logs 읽기 가능?
//   8. 일일 즐겨찾기 INSERT (회원)
//   9. cleanup — 가입한 트레이너·회원·관련 로그 모두 삭제
//
// 출력: 단계별 PASS / FAIL + 마지막 종합.

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const URL = process.env.REACT_APP_SUPABASE_URL
const ANON = process.env.REACT_APP_SUPABASE_ANON_KEY
if (!URL || !ANON) { console.error('환경변수 누락 (.env)'); process.exit(1) }

// 별도 client 두 개 — 트레이너 / 회원 세션 분리
const trainerClient = createClient(URL, ANON, { auth: { persistSession: false } })
const memberClient  = createClient(URL, ANON, { auth: { persistSession: false } })

const stamp = Date.now()
// 트레이너도 anonymous signIn 으로 — email 가입 한도 회피 + 빠른 검증
// trainers.email 은 column-level 에서 NULL 허용. UNIQUE 가 있으면 dummy 값 unique 처리.
const TRAINER_EMAIL = `test-pt-${stamp}@flow-test.local`
const TRAINER_NAME  = `테스트트레이너${stamp}`
const MEMBER_NAME   = `테스트회원${stamp}`

const results = []
const log = (step, ok, detail) => {
  results.push({ step, ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${step}${detail ? ' — ' + detail : ''}`)
}

let trainerId, memberId, memberCode
let workoutLogId, dietLogId, dayFavId

async function main() {
  // 1. 트레이너 anonymous 세션 (email 가입 한도 회피용 — 백엔드 RLS 흐름 검증이 목표)
  try {
    const { data, error } = await trainerClient.auth.signInAnonymously()
    if (error) throw error
    trainerId = data.user.id
    log('1. 트레이너 anonymous 세션', true, `id=${trainerId.slice(0, 8)}…`)
  } catch (e) {
    log('1. 트레이너 anonymous 세션', false, e.message)
    return
  }

  // 1b. trainers row upsert (client-side 패턴 — App.js 와 동일)
  try {
    const { error } = await trainerClient.from('trainers').upsert({
      id: trainerId,
      name: TRAINER_NAME,
      email: TRAINER_EMAIL,
    }, { onConflict: 'id', ignoreDuplicates: false })
    if (error) throw error
    log('1b. trainers upsert', true)
  } catch (e) {
    log('1b. trainers upsert', false, e.message)
  }

  // 2. trainer row 확인
  try {
    const { data, error } = await trainerClient.from('trainers').select('id, name, email').eq('id', trainerId).maybeSingle()
    if (error) throw error
    if (!data) throw new Error('trainers row 없음')
    log('2. trainers row 존재', true, `name=${data.name}`)
  } catch (e) {
    log('2. trainers row 존재', false, e.message)
  }

  // 2b. trial 구독 자동 생성?
  try {
    const { data, error } = await trainerClient.from('trainer_subscriptions')
      .select('status, plan_code, member_limit, trial_expires_at')
      .eq('trainer_id', trainerId).maybeSingle()
    if (error) throw error
    if (!data) throw new Error('구독 row 없음 — create_trial_for_new_trainer 트리거 누락 가능')
    log('2b. trial 구독 자동 생성', true, `${data.status} · ${data.plan_code} · limit=${data.member_limit}`)
  } catch (e) {
    log('2b. trial 구독 자동 생성', false, e.message)
  }

  // 3. can_add_member RPC
  try {
    const { data, error } = await trainerClient.rpc('can_add_member', { _trainer_id: trainerId })
    if (error) throw error
    log('3. can_add_member RPC', data?.ok === true, JSON.stringify(data))
  } catch (e) {
    log('3. can_add_member RPC', false, e.message)
  }

  // 4. members INSERT (트레이너 권한)
  memberCode = ('TEST' + stamp.toString(36).slice(-2)).toUpperCase().slice(0, 6)
  try {
    const { data, error } = await trainerClient.from('members').insert({
      trainer_id: trainerId,
      code: memberCode,
      name: MEMBER_NAME,
      goal: '다이어트',
      gender: '여성',
      pt_total_sessions: 0,
      pt_used_sessions: 0,
      start_date: new Date().toISOString().slice(0, 10),
    }).select().single()
    if (error) throw error
    memberId = data.id
    log('4. members INSERT', true, `code=${memberCode}`)
  } catch (e) {
    log('4. members INSERT', false, e.message)
  }

  // 5. 회원 anonymous 로그인 + claim
  if (memberId) {
    try {
      const { error: anonErr } = await memberClient.auth.signInAnonymously()
      if (anonErr) throw anonErr
      const { data, error } = await memberClient.rpc('claim_member', {
        code_input: memberCode, name_input: MEMBER_NAME,
      })
      if (error) throw error
      if (data !== memberId) throw new Error(`claim_member 반환 id 불일치: ${data}`)
      log('5. 회원 anonymous + claim_member', true)
    } catch (e) {
      log('5. 회원 anonymous + claim_member', false, e.message)
    }
  }

  // 6. 회원이 본인 운동 1개 INSERT
  if (memberId) {
    try {
      const { data, error } = await memberClient.from('workout_logs').insert({
        member_id: memberId,
        log_date: new Date().toISOString().slice(0, 10),
        slot: 1,
        exercise_type: 'weight',
        body_part: '가슴',
        exercise_name: '벤치프레스 (테스트)',
        weight: 60,
        reps: 10,
        volume: 600,
      }).select().single()
      if (error) throw error
      workoutLogId = data.id
      log('6a. 회원 workout_logs INSERT', true)
    } catch (e) {
      log('6a. 회원 workout_logs INSERT', false, e.message)
    }

    try {
      const { data, error } = await memberClient.from('diet_logs').insert({
        member_id: memberId,
        log_date: new Date().toISOString().slice(0, 10),
        slot: 1,
        meal_type: '식사 1',
        carbs: 50, protein: 30, fat: 10, calories: 410,
      }).select().single()
      if (error) throw error
      dietLogId = data.id
      log('6b. 회원 diet_logs INSERT', true)
    } catch (e) {
      log('6b. 회원 diet_logs INSERT', false, e.message)
    }
  }

  // 6c. 트레이너 본인 운동/식단 INSERT (trainer_workout_logs / trainer_diet_logs)
  let tWorkoutId, tDietId
  try {
    const { data, error } = await trainerClient.from('trainer_workout_logs').insert({
      trainer_id: trainerId,
      log_date: new Date().toISOString().slice(0, 10),
      slot: 1,
      exercise_type: 'weight',
      body_part: '등',
      exercise_name: '데드리프트 (테스트)',
      weight: 100, reps: 5, volume: 500,
    }).select().single()
    if (error) throw error
    tWorkoutId = data.id
    log('6c. 트레이너 본인 workout INSERT', true)
  } catch (e) {
    log('6c. 트레이너 본인 workout INSERT', false, e.message)
  }
  try {
    const { data, error } = await trainerClient.from('trainer_diet_logs').insert({
      trainer_id: trainerId,
      log_date: new Date().toISOString().slice(0, 10),
      slot: 1, meal_type: '아침',
      carbs: 80, protein: 50, fat: 20, calories: 700,
    }).select().single()
    if (error) throw error
    tDietId = data.id
    log('6d. 트레이너 본인 diet INSERT', true)
  } catch (e) {
    log('6d. 트레이너 본인 diet INSERT', false, e.message)
  }

  // 7. is_my_trainer 정책 — 회원이 트레이너 기록 SELECT 가능?
  if (memberId) {
    try {
      const { data, error } = await memberClient.from('trainer_workout_logs')
        .select('id, exercise_name').eq('trainer_id', trainerId)
      if (error) throw error
      const found = (data || []).some(r => r.id === tWorkoutId)
      log('7a. 회원이 트레이너 workout SELECT', found, `${data.length} row, includes test workout? ${found}`)
    } catch (e) {
      log('7a. 회원이 트레이너 workout SELECT', false, e.message)
    }

    try {
      const { data, error } = await memberClient.from('trainer_diet_logs')
        .select('id, meal_type').eq('trainer_id', trainerId)
      if (error) throw error
      const found = (data || []).some(r => r.id === tDietId)
      log('7b. 회원이 트레이너 diet SELECT', found, `${data.length} row, includes test diet? ${found}`)
    } catch (e) {
      log('7b. 회원이 트레이너 diet SELECT', false, e.message)
    }

    // 7c. 회원이 트레이너 row 읽기 (이미 정책 있음)
    try {
      const { data, error } = await memberClient.from('trainers')
        .select('id, name, macro_muscle, macro_body_fat').eq('id', trainerId).maybeSingle()
      if (error) throw error
      log('7c. 회원이 trainers SELECT', !!data, JSON.stringify(data))
    } catch (e) {
      log('7c. 회원이 trainers SELECT', false, e.message)
    }
  }

  // 8. 회원 일일 즐겨찾기 INSERT
  if (memberId) {
    try {
      const { data, error } = await memberClient.from('diet_day_favorites').insert({
        member_id: memberId,
        label: '테스트 일일 즐겨찾기',
        meals: [{ slot: 1, name: '식사 1', carbs: 50, protein: 30, fat: 10, calories: 410 }],
      }).select().single()
      if (error) throw error
      dayFavId = data.id
      log('8. 일일 즐겨찾기 INSERT', true)
    } catch (e) {
      log('8. 일일 즐겨찾기 INSERT', false, e.message)
    }
  }

  // 8b. 트레이너 일일 즐겨찾기
  let tDayFavId
  try {
    const { data, error } = await trainerClient.from('trainer_diet_day_favorites').insert({
      trainer_id: trainerId,
      label: '트레이너 테스트 즐겨찾기',
      meals: [{ slot: 1, name: '아침', carbs: 80, protein: 50, fat: 20, calories: 700 }],
    }).select().single()
    if (error) throw error
    tDayFavId = data.id
    log('8b. 트레이너 일일 즐겨찾기 INSERT', true)
  } catch (e) {
    log('8b. 트레이너 일일 즐겨찾기 INSERT', false, e.message)
  }

  // 9. 트레이너 macro_* 컬럼 UPDATE (체지방률 포함)
  try {
    const { error } = await trainerClient.from('trainers').update({
      macro_weight: 70, macro_muscle: 35, macro_body_fat: 18.5,
      macro_occupation: '가벼운 활동 (×1.05) — 사무직, 주부',
      goal: '다이어트',
    }).eq('id', trainerId)
    if (error) throw error
    log('9. trainers macro_* UPDATE', true)
  } catch (e) {
    log('9. trainers macro_* UPDATE', false, e.message)
  }

  // 10. summarizeSubscription / canAddMember (master? — 일반 트레이너라 master 분기 안 탐)
  try {
    const { data, error } = await trainerClient.rpc('is_admin_trainer', { _trainer_id: trainerId })
    if (error) throw error
    log('10. is_admin_trainer (일반 계정)', data === false, `is_admin=${data}`)
  } catch (e) {
    log('10. is_admin_trainer', false, e.message)
  }

  // ─── cleanup ───
  console.log('\n--- cleanup ---')
  if (workoutLogId) await memberClient.from('workout_logs').delete().eq('id', workoutLogId)
  if (dietLogId)    await memberClient.from('diet_logs').delete().eq('id', dietLogId)
  if (dayFavId)     await memberClient.from('diet_day_favorites').delete().eq('id', dayFavId)
  if (tWorkoutId)   await trainerClient.from('trainer_workout_logs').delete().eq('id', tWorkoutId)
  if (tDietId)      await trainerClient.from('trainer_diet_logs').delete().eq('id', tDietId)
  if (tDayFavId)    await trainerClient.from('trainer_diet_day_favorites').delete().eq('id', tDayFavId)
  if (memberId)     await trainerClient.from('members').delete().eq('id', memberId)
  if (trainerId)    await trainerClient.from('trainer_subscriptions').delete().eq('trainer_id', trainerId)
  if (trainerId)    await trainerClient.from('trainers').delete().eq('id', trainerId)
  // auth.users 는 anon key 로 삭제 불가 — 운영자가 Supabase Auth Dashboard 에서
  // 익명 user 들을 수동 삭제 필요 (또는 service_role 키로 admin.deleteUser).
  const { data: { session: trainerSession } } = await trainerClient.auth.getSession()
  const { data: { session: memberSession } } = await memberClient.auth.getSession()
  console.log(`\n⚠ Supabase Auth Dashboard 에서 익명 user 수동 삭제 필요:`)
  console.log(`   - 트레이너 user_id: ${trainerSession?.user?.id || trainerId}`)
  console.log(`   - 회원 user_id:    ${memberSession?.user?.id || '(미생성)'}`)

  // 결과 요약
  console.log('\n========== 종합 ==========')
  const pass = results.filter(r => r.ok).length
  const fail = results.filter(r => !r.ok).length
  console.log(`PASS ${pass} / FAIL ${fail}`)
  if (fail > 0) {
    console.log('\n실패 항목:')
    results.filter(r => !r.ok).forEach(r => console.log(`  ✗ ${r.step} — ${r.detail}`))
    process.exit(2)
  }
}

main().catch(e => {
  console.error('fatal:', e)
  process.exit(1)
})

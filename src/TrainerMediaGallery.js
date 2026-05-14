import React, { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { THEME, S, PART_COLORS } from './utils'

// 담당 트레이너가 운동·식단에 첨부한 사진/영상을 한 곳에 모아 보여주는 갤러리.
// - 운동 영상: trainer_workout_logs.media_url
// - 식단 사진: trainer_diet_logs.media_url
// - 탭으로 운동/식단 분리, 카드 클릭 시 확대 미리보기
// 권한은 RLS (is_my_trainer) 가 보장 — 본인 담당 트레이너 row 만 SELECT 됨.
export default function TrainerMediaGallery({ trainerId }) {
  const [tab, setTab] = useState('workout') // workout | diet
  const [workoutItems, setWorkoutItems] = useState([])
  const [dietItems, setDietItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState(null) // { url, isVideo, label }

  useEffect(() => {
    if (!trainerId) return
    let alive = true
    setLoading(true)
    Promise.all([
      supabase
        .from('trainer_workout_logs')
        .select('id, log_date, exercise_name, body_part, media_url')
        .eq('trainer_id', trainerId)
        .not('media_url', 'is', null)
        .order('log_date', { ascending: false }),
      supabase
        .from('trainer_diet_logs')
        .select('id, log_date, meal_type, slot, calories, media_url')
        .eq('trainer_id', trainerId)
        .not('media_url', 'is', null)
        .order('log_date', { ascending: false }),
    ]).then(([wRes, dRes]) => {
      if (!alive) return
      if (wRes.error) console.error('[TrainerMediaGallery] workout:', wRes.error)
      if (dRes.error) console.error('[TrainerMediaGallery] diet:', dRes.error)
      setWorkoutItems((wRes.data || []).filter(r => r.media_url))
      setDietItems((dRes.data || []).filter(r => r.media_url))
      setLoading(false)
    })
    return () => { alive = false }
  }, [trainerId])

  const isVideoUrl = (url) => {
    if (!url) return false
    const u = url.toLowerCase()
    return u.endsWith('.mp4') || u.endsWith('.mov') || u.endsWith('.webm') || u.endsWith('.m4v')
  }

  const items = tab === 'workout' ? workoutItems : dietItems

  return (
    <div>
      {/* 운동 / 식단 토글 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '10px' }}>
        {[{ k: 'workout', l: `운동 영상 (${workoutItems.length})` }, { k: 'diet', l: `식단 사진 (${dietItems.length})` }].map(({ k, l }) => {
          const active = tab === k
          return (
            <button key={k} onClick={() => setTab(k)} style={{
              background: active ? THEME.primaryAccent : '#FFF',
              color: active ? THEME.primaryDark : THEME.textSub,
              border: 'none', borderRadius: '10px', padding: '8px',
              fontSize: '11px', fontWeight: active ? '500' : '400', cursor: 'pointer',
            }}>{l}</button>
          )
        })}
      </div>

      <div style={S.card}>
        {loading ? (
          <p style={{ fontSize: '12px', color: THEME.textHint, textAlign: 'center', padding: '20px 0', margin: 0 }}>로딩 중…</p>
        ) : items.length === 0 ? (
          <p style={{ fontSize: '12px', color: THEME.textHint, textAlign: 'center', padding: '20px 0', margin: 0 }}>
            {tab === 'workout' ? '트레이너가 올린 운동 영상이 없습니다' : '트레이너가 올린 식단 사진이 없습니다'}
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {items.map(item => {
              const isVid = isVideoUrl(item.media_url)
              const label = tab === 'workout'
                ? (item.exercise_name || '운동')
                : (item.meal_type || `식사 ${item.slot || ''}`)
              const sub = tab === 'workout'
                ? item.body_part
                : (item.calories ? `${item.calories} kcal` : '')
              return (
                <div
                  key={item.id}
                  onClick={() => setPreview({ url: item.media_url, isVideo: isVid, label, date: item.log_date })}
                  style={{ background: THEME.cardAlt, borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', border: `0.5px solid ${THEME.border}` }}
                >
                  <div style={{ width: '100%', height: '110px', background: '#000', position: 'relative' }}>
                    {isVid ? (
                      <video src={item.media_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline preload="metadata" />
                    ) : (
                      <img src={item.media_url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    )}
                    {isVid && (
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,0,0,0.55)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>▶</div>
                    )}
                  </div>
                  <div style={{ padding: '7px 9px' }}>
                    <p style={{ fontSize: '11px', fontWeight: '500', color: THEME.text, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</p>
                    <p style={{ fontSize: '9px', color: THEME.textHint, margin: 0, display: 'flex', justifyContent: 'space-between', gap: '4px' }}>
                      <span>{(item.log_date || '').replace(/-/g, '.')}</span>
                      {sub && tab === 'workout' ? (
                        <span style={{ color: PART_COLORS[sub] || THEME.textSub, fontWeight: '500' }}>{sub}</span>
                      ) : (
                        <span>{sub}</span>
                      )}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 확대 미리보기 */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', cursor: 'pointer' }}
        >
          <div style={{ fontSize: '12px', color: '#FFF', marginBottom: '10px' }}>
            {preview.label} · {(preview.date || '').replace(/-/g, '.')}
          </div>
          {preview.isVideo ? (
            <video src={preview.url} controls autoPlay style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '8px' }} onClick={e => e.stopPropagation()} />
          ) : (
            <img src={preview.url} alt={preview.label} style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '8px' }} />
          )}
        </div>
      )}
    </div>
  )
}

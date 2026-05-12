import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
// Service Worker 등록 (푸시 알림용)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('[SW] registered:', reg.scope)
      })
      .catch((err) => {
        console.error('[SW] registration failed:', err)
      })
  })

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'NAVIGATE_FROM_NOTIFICATION') {
      window.dispatchEvent(new CustomEvent('pt-notification-navigate', {
        detail: { link: event.data.link }
      }))
    }
  })
}
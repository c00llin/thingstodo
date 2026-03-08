import { api } from './client'

export function getVapidKey() {
  return api.get<{ public_key: string }>('/push/vapid-key')
}

export function subscribePush(data: {
  endpoint: string
  p256dh: string
  auth: string
  user_agent?: string
}) {
  return api.post('/push/subscribe', data)
}

export function unsubscribePush(endpoint: string) {
  return api.delete('/push/subscribe', { endpoint })
}

export function testNotification() {
  return api.post<{ ok: boolean }>('/push/test', {})
}

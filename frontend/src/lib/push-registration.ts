import { getVapidKey, subscribePush, unsubscribePush } from '../api/push'

export async function registerPushSubscription(): Promise<{ ok: boolean; error?: string }> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, error: 'Push notifications are not supported in this browser' }
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return { ok: false, error: 'Notification permission was denied' }
  }

  try {
    let vapidKey: string
    try {
      const { public_key } = await getVapidKey()
      if (!public_key) {
        return { ok: false, error: 'Push not configured on server — set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars' }
      }
      vapidKey = public_key
    } catch (err) {
      console.error('Failed to fetch VAPID key:', err)
      return { ok: false, error: `Failed to fetch VAPID key: ${err instanceof Error ? err.message : String(err)}` }
    }

    let registration: ServiceWorkerRegistration
    try {
      registration = await navigator.serviceWorker.ready
    } catch (err) {
      console.error('Service worker not ready:', err)
      return { ok: false, error: `Service worker not ready: ${err instanceof Error ? err.message : String(err)}` }
    }

    let subscription: PushSubscription
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      })
    } catch (err) {
      console.error('pushManager.subscribe failed:', err)
      return { ok: false, error: `Browser push subscribe failed: ${err instanceof Error ? err.message : String(err)}` }
    }

    try {
      const json = subscription.toJSON()
      await subscribePush({
        endpoint: subscription.endpoint,
        p256dh: json.keys?.p256dh ?? '',
        auth: json.keys?.auth ?? '',
      })
    } catch (err) {
      console.error('Server subscribe API failed:', err)
      return { ok: false, error: `Server subscribe failed: ${err instanceof Error ? err.message : String(err)}` }
    }

    return { ok: true }
  } catch (err) {
    console.error('Push registration failed:', err)
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error during push registration' }
  }
}

export async function unregisterPushSubscription(): Promise<void> {
  if (!('serviceWorker' in navigator)) return

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await unsubscribePush(subscription.endpoint)
      await subscription.unsubscribe()
    }
  } catch (err) {
    console.error('Push unregistration failed:', err)
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    return subscription !== null
  } catch {
    return false
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

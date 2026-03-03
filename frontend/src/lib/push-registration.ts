import { getVapidKey, subscribePush, unsubscribePush } from '../api/push'

export async function registerPushSubscription(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications not supported')
    return false
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return false
  }

  try {
    const { public_key } = await getVapidKey()
    if (!public_key) {
      console.error('Push registration failed: no VAPID public key configured')
      return false
    }
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) {
      console.error('Push registration failed: no service worker registered')
      return false
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(public_key) as BufferSource,
    })

    const json = subscription.toJSON()
    await subscribePush({
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
    })

    return true
  } catch (err) {
    console.error('Push registration failed:', err)
    return false
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
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) return false
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

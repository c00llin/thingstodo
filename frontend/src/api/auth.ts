import { api } from './client'
import type { AuthResponse, LoginRequest } from './types'

export function login(data: LoginRequest) {
  return api.post<AuthResponse>('/auth/login', data)
}

export function logout() {
  return api.delete<{ ok: boolean }>('/auth/logout')
}

export function getMe() {
  return api.get<AuthResponse>('/auth/me')
}

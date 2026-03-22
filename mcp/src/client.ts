const envUrl = process.env.THINGSTODO_URL;
const envKey = process.env.THINGSTODO_API_KEY;

if (!envUrl) throw new Error('THINGSTODO_URL environment variable is required');
if (!envKey) throw new Error('THINGSTODO_API_KEY environment variable is required');

const BASE_URL = envUrl;
const API_KEY = envKey;

async function request(method: string, path: string, body?: unknown): Promise<unknown> {
  const url = `${BASE_URL.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${API_KEY}`,
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) {
    const msg = (data as { error?: string }).error ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function get(path: string): Promise<unknown> {
  return request('GET', path);
}

export async function post(path: string, body?: unknown): Promise<unknown> {
  return request('POST', path, body);
}

export async function patch(path: string, body?: unknown): Promise<unknown> {
  return request('PATCH', path, body);
}

export async function del(path: string): Promise<unknown> {
  return request('DELETE', path);
}

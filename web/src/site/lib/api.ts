export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

interface Envelope<T> {
  data: T;
  meta?: PageMeta;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const request = async <T>(method: Method, path: string, body?: unknown): Promise<Envelope<T>> => {
  const isForm = body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined || isForm ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  if (response.status === 204) return { data: undefined as T };

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(payload?.error?.message ?? 'Something went wrong. Please try again.', response.status);
  return payload as Envelope<T>;
};

export const api = {
  get: async <T>(path: string) => (await request<T>('GET', path)).data,
  page: async <T>(path: string) => {
    const { data, meta } = await request<T[]>('GET', path);
    return { items: data, meta: meta as PageMeta };
  },
  post: async <T>(path: string, body?: unknown) => (await request<T>('POST', path, body)).data,
  put: async <T>(path: string, body?: unknown) => (await request<T>('PUT', path, body)).data,
  patch: async <T>(path: string, body?: unknown) => (await request<T>('PATCH', path, body)).data,
  delete: async <T>(path: string) => (await request<T>('DELETE', path)).data,
};

export const withQuery = (path: string, params: Record<string, string | number | undefined | null>): string => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
};

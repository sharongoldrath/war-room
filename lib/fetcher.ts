// Shared server-side fetch helper with timeout + UA.
export async function getJSON<T = any>(url: string, revalidate = 30, timeoutMs = 12000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'war-room/0.1 (+vercel)', Accept: 'application/json' },
      next: { revalidate },
    });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

export async function getText(url: string, revalidate = 120, timeoutMs = 12000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (war-room RSS reader)' },
      next: { revalidate },
    });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export function json(data: unknown, sMaxAge = 30) {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, s-maxage=${sMaxAge}, stale-while-revalidate=${sMaxAge * 4}`,
    },
  });
}

// Middle East bounding box used across layers
export const REGION = { center: [35.2, 31.8] as [number, number], bbox: [24, 10, 64, 44] as [number, number, number, number] };

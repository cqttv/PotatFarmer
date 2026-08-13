const ONE_DAY_MS = 86_400_000;

export interface EventRange {
  from: string;
  to: string;
}

export function parseEventRange(
  searchParams: URLSearchParams,
  now = Date.now(),
): EventRange {
  const parseDate = (name: "from" | "to", fallback: number): number => {
    const value = searchParams.get(name);
    if (value === null || value.trim() === "") return fallback;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? fallback : parsed;
  };

  const fromMs = parseDate("from", now - ONE_DAY_MS);
  const toMs = parseDate("to", now);
  return {
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
  };
}

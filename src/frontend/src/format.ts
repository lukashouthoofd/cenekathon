// Dutch number formatting for every number shown in the UI (e.g. 1.234,5).
const formatters = new Map<number, Intl.NumberFormat>()

function formatterFor(digits: number): Intl.NumberFormat {
  let f = formatters.get(digits)
  if (!f) {
    f = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    formatters.set(digits, f)
  }
  return f
}

export function formatNumber(n: number, digits = 0): string {
  return formatterFor(digits).format(n)
}

// Takes a fraction (0.42) and renders it as a percentage (42%).
export function formatPercent(fraction: number, digits = 0): string {
  return `${formatNumber(fraction * 100, digits)}%`
}

// Scores are 0-100; a missing score is shown as "Onbekend", never as 0.
export function formatScore(value: number | null): string {
  return value === null ? 'Onbekend' : formatNumber(value)
}

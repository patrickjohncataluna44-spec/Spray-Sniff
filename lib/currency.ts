export function formatPHP(amount: number) {
  const normalizedAmount = Math.round(amount * 100) / 100
  const minimumFractionDigits = Number.isInteger(normalizedAmount) ? 0 : 2

  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits,
    maximumFractionDigits: 2,
  }).format(normalizedAmount)
}

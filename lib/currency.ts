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

/** Standard Philippine BIR 12% VAT calculations for VAT-inclusive retail prices */
export function calculateVatBreakdown(grossAmount: number) {
  const vatableSales = Math.round((grossAmount / 1.12) * 100) / 100
  const vatAmount = Math.round((grossAmount - vatableSales) * 100) / 100
  return {
    vatableSales,
    vatAmount,
    grossAmount,
  }
}


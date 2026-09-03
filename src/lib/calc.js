// discount (optionnel) : { type: 'none' | 'percent' | 'amount', value: number }
// La réduction est appliquée sur le HT brut, avant calcul de la TVA — c'est la
// pratique comptable standard (remise globale déduite du HT, TVA sur le net).
export function computeTotals(items, taxRegime, discount) {
  let subtotalHT = 0
  let tvaAmount = 0

  for (const item of items) {
    const lineHT = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0)
    subtotalHT += lineHT
    if (taxRegime === 'assujetti') {
      tvaAmount += lineHT * ((Number(item.tva_rate) || 0) / 100)
    }
  }

  let discountAmount = 0
  if (discount && discount.type !== 'none' && Number(discount.value) > 0) {
    if (discount.type === 'percent') {
      discountAmount = subtotalHT * (Math.min(Number(discount.value), 100) / 100)
    } else if (discount.type === 'amount') {
      discountAmount = Math.min(Number(discount.value), subtotalHT)
    }
  }

  // La TVA est réduite dans la même proportion que le HT (remise répartie sur toutes les lignes)
  const ratio = subtotalHT > 0 ? (subtotalHT - discountAmount) / subtotalHT : 1
  const netSubtotalHT = round2(subtotalHT - discountAmount)
  const netTvaAmount = round2(tvaAmount * ratio)
  const totalTTC = round2(netSubtotalHT + netTvaAmount)

  return {
    subtotal_ht: netSubtotalHT,
    tva_amount: netTvaAmount,
    total_ttc: totalTTC,
    discount_type: discount?.type || 'none',
    discount_value: discount?.value ? Number(discount.value) : 0,
    discount_amount: round2(discountAmount),
  }
}

export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function formatEUR(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0)
}

export function formatDate(d) {
  if (!d) return ''
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d))
}

export function computeCreditImpot(totalTTC) {
  return round2(totalTTC * 0.5)
}

export const INVOICE_TYPE_LABELS = {
  standalone: 'Facture',
  acompte: "Facture d'acompte",
  solde: 'Facture de solde',
}

export const STATUS_LABELS = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  accepted: 'Accepté',
  refused: 'Refusé',
  expired: 'Expiré',
  partially_paid: 'Acompte payé',
  paid: 'Payée',
  overdue: 'En retard',
}

export const QUOTE_STATUS_OPTIONS = ['draft', 'sent', 'accepted', 'refused', 'expired']
export const INVOICE_STATUS_OPTIONS = ['draft', 'sent', 'partially_paid', 'paid', 'overdue']

export function isOverdue(invoice) {
  if (!invoice.due_date) return false
  if (['paid', 'draft', 'overdue'].includes(invoice.status)) return false
  const today = new Date().toISOString().slice(0, 10)
  return invoice.due_date < today
}

import { supabase } from './supabaseClient'
import { isOverdue } from './calc'

export async function flagOverdueInvoices(invoices) {
  const toFlag = invoices.filter(isOverdue)
  if (toFlag.length === 0) return invoices

  await supabase.from('invoices').update({ status: 'overdue' }).in('id', toFlag.map((i) => i.id))

  const flaggedIds = new Set(toFlag.map((i) => i.id))
  return invoices.map((i) => (flaggedIds.has(i.id) ? { ...i, status: 'overdue' } : i))
}

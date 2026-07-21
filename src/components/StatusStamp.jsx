import { STATUS_LABELS } from '../lib/calc'

export default function StatusStamp({ status }) {
  return <span className={`stamp stamp-${status}`}>{STATUS_LABELS[status] || status}</span>
}

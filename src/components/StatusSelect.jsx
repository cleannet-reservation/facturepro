import { STATUS_LABELS } from '../lib/calc'

// Même rendu visuel que StatusStamp, mais cliquable : un <select> transparent
// superposé au tampon, pour changer le statut en un clic sans ouvrir le document.
export default function StatusSelect({ status, options, onChange, disabled }) {
  return (
    <span className={`stamp stamp-${status} stamp-select`}>
      {STATUS_LABELS[status] || status}
      <select
        value={status}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        aria-label="Changer le statut"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{STATUS_LABELS[opt] || opt}</option>
        ))}
      </select>
    </span>
  )
}

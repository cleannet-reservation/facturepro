// Génère et télécharge un fichier CSV compatible Excel (séparateur point-virgule,
// BOM UTF-8 pour que les accents s'affichent correctement à l'ouverture).
export function downloadCSV(filename, headers, rows) {
  const escape = (value) => {
    const str = value === null || value === undefined ? '' : String(value)
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const lines = [
    headers.map(escape).join(';'),
    ...rows.map((row) => row.map(escape).join(';')),
  ]

  const csvContent = '\uFEFF' + lines.join('\r\n') // BOM pour Excel
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatEUR, formatDate, computeCreditImpot } from './calc'

async function loadImageAsDataURL(url) {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// doc: { type: 'DEVIS' | 'FACTURE' | "FACTURE D'ACOMPTE" | 'FACTURE DE SOLDE',
//        number, issue_date, validity_date | due_date,
//        business, client, items, subtotal_ht, tva_amount, total_ttc, deposit_requested,
//        tax_credit_eligible, deducted_invoice (pour une facture de solde : { number, total_ttc }) }
export async function generateDocumentPDF(doc_) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  let y = 20

  // Couleurs (encre marine + accent sarcelle, cohérent avec l'identité FacturePro)
  const ink = [27, 42, 74]
  const teal = [47, 111, 94]
  const grey = [110, 105, 95]

  // Logo (si configuré dans les paramètres entreprise)
  let textStartX = margin
  if (doc_.business.logo_url) {
    const dataUrl = await loadImageAsDataURL(doc_.business.logo_url)
    if (dataUrl) {
      try {
        const format = dataUrl.includes('image/png') ? 'PNG' : 'JPEG'
        doc.addImage(dataUrl, format, margin, y - 6, 18, 18, undefined, 'FAST')
        textStartX = margin + 24
      } catch {
        // logo illisible : on continue sans bloquer la génération du PDF
      }
    }
  }

  // En-tête : nom entreprise + titre document
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...ink)
  doc.text(doc_.business.name || '', textStartX, y)

  doc.setFontSize(doc_.type.length > 10 ? 14 : 20)
  doc.setTextColor(...teal)
  doc.text(doc_.type, pageWidth - margin, y, { align: 'right' })

  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...grey)
  const bizLines = [
    doc_.business.address,
    [doc_.business.postal_code, doc_.business.city].filter(Boolean).join(' '),
    doc_.business.siret ? `SIRET : ${doc_.business.siret}` : null,
    doc_.business.tva_number ? `TVA : ${doc_.business.tva_number}` : null,
    doc_.business.email,
    doc_.business.phone,
  ].filter(Boolean)
  bizLines.forEach((line) => {
    doc.text(line, textStartX, y)
    y += 4.5
  })

  doc.setTextColor(...grey)
  doc.setFontSize(10)
  doc.text(`N° ${doc_.number}`, pageWidth - margin, y - bizLines.length * 4.5 + 6, { align: 'right' })
  doc.text(`Date : ${formatDate(doc_.issue_date)}`, pageWidth - margin, y - bizLines.length * 4.5 + 12, { align: 'right' })
  if (doc_.validity_date) {
    doc.text(`Valable jusqu'au : ${formatDate(doc_.validity_date)}`, pageWidth - margin, y - bizLines.length * 4.5 + 18, { align: 'right' })
  }
  if (doc_.due_date) {
    doc.text(`Échéance : ${formatDate(doc_.due_date)}`, pageWidth - margin, y - bizLines.length * 4.5 + 18, { align: 'right' })
  }

  y += 8

  // Bloc client
  doc.setDrawColor(220, 217, 208)
  doc.setFillColor(247, 244, 236)
  doc.roundedRect(margin, y, 80, 26, 1, 1, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...ink)
  doc.text('CLIENT', margin + 4, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...grey)
  let cy = y + 11
  const clientLines = [
    doc_.client.name,
    doc_.client.address,
    [doc_.client.postal_code, doc_.client.city].filter(Boolean).join(' '),
  ].filter(Boolean)
  clientLines.forEach((line) => {
    doc.text(line, margin + 4, cy)
    cy += 4.5
  })

  y += 34

  // Tableau des lignes
  const hasTva = doc_.business.tax_regime === 'assujetti'
  const head = hasTva
    ? [['Description', 'Qté', 'PU HT', 'TVA', 'Total HT']]
    : [['Description', 'Qté', 'Prix unitaire', 'Total']]

  const body = doc_.items.map((it) => {
    const lineTotal = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0)
    return hasTva
      ? [it.description, String(it.quantity), formatEUR(it.unit_price), `${it.tva_rate}%`, formatEUR(lineTotal)]
      : [it.description, String(it.quantity), formatEUR(it.unit_price), formatEUR(lineTotal)]
  })

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: 'plain',
    headStyles: { fillColor: ink, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [40, 38, 34] },
    alternateRowStyles: { fillColor: [250, 248, 243] },
    margin: { left: margin, right: margin },
  })

  let finalY = doc.lastAutoTable.finalY + 8

  // Totaux
  const totalsX = pageWidth - margin - 60
  doc.setFontSize(9)
  doc.setTextColor(...grey)
  if (hasTva) {
    doc.text('Total HT', totalsX, finalY)
    doc.text(formatEUR(doc_.subtotal_ht), pageWidth - margin, finalY, { align: 'right' })
    finalY += 5
    doc.text('TVA', totalsX, finalY)
    doc.text(formatEUR(doc_.tva_amount), pageWidth - margin, finalY, { align: 'right' })
    finalY += 5
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...ink)
  doc.text('Total TTC', totalsX, finalY)
  doc.text(formatEUR(doc_.total_ttc), pageWidth - margin, finalY, { align: 'right' })
  finalY += 8

  if (!hasTva) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(...grey)
    doc.text('TVA non applicable, art. 293 B du CGI', totalsX, finalY, { align: 'left' })
    finalY += 6
  }

  // Facture de solde : déduction de l'acompte déjà réglé
  if (doc_.deducted_invoice) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...grey)
    doc.text(`Déjà réglé (facture ${doc_.deducted_invoice.number})`, totalsX, finalY)
    doc.text(`- ${formatEUR(doc_.deducted_invoice.total_ttc)}`, pageWidth - margin, finalY, { align: 'right' })
    finalY += 6
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...teal)
    doc.text('Net à payer', totalsX, finalY)
    doc.text(formatEUR(doc_.total_ttc - doc_.deducted_invoice.total_ttc), pageWidth - margin, finalY, { align: 'right' })
    finalY += 8
  }

  if (doc_.deposit_requested > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...teal)
    doc.text(`Acompte demandé : ${formatEUR(doc_.deposit_requested)}`, totalsX, finalY, { align: 'left' })
    finalY += 8
  }

  // Mention crédit d'impôt Services à la Personne
  if (doc_.tax_credit_eligible) {
    const creditAmount = computeCreditImpot(doc_.total_ttc)
    const netCost = doc_.total_ttc - creditAmount
    doc.setDrawColor(...teal)
    doc.setFillColor(233, 242, 238)
    doc.roundedRect(margin, finalY, pageWidth - margin * 2, 20, 1, 1, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...teal)
    doc.text('Éligible au crédit d\'impôt Services à la Personne (50%) — art. 199 sexdecies du CGI', margin + 4, finalY + 6)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...ink)
    const agrement = doc_.business.sap_agrement_number ? `Agrément n° ${doc_.business.sap_agrement_number}. ` : ''
    doc.text(
      `${agrement}Crédit d'impôt estimé : ${formatEUR(creditAmount)} — reste réellement à votre charge après crédit d'impôt : ${formatEUR(netCost)}.`,
      margin + 4, finalY + 12
    )
    doc.text('Montant sous réserve du respect des conditions et plafonds légaux applicables à votre situation.', margin + 4, finalY + 16.5)
    finalY += 26
  }

  // Notes
  if (doc_.notes) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...grey)
    doc.text(doc.splitTextToSize(doc_.notes, pageWidth - margin * 2), margin, finalY + 4)
  }

  // Pied de page — mentions légales
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...grey)
  const footerLines = [
    doc_.type === 'FACTURE' ? `Conditions de paiement : ${doc_.business.payment_terms || '30 jours'}. En cas de retard de paiement, une pénalité et une indemnité forfaitaire de 40€ pour frais de recouvrement seront exigibles.` : null,
    doc_.business.iban ? `IBAN : ${doc_.business.iban}` : null,
  ].filter(Boolean)
  footerLines.forEach((line, i) => {
    doc.text(doc.splitTextToSize(line, pageWidth - margin * 2), margin, pageHeight - 15 + i * 4)
  })

  return doc
}

export async function downloadDocumentPDF(doc_) {
  const pdf = await generateDocumentPDF(doc_)
  const safeType = doc_.type.replace(/[^a-zA-Z0-9]+/g, '-')
  pdf.save(`${safeType}-${doc_.number}.pdf`)
}

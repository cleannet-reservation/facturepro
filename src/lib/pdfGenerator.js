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

  const ink = [27, 42, 74]
  const teal = [47, 111, 94]
  const grey = [110, 105, 95]

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

  const isProClient = doc_.client.client_type === 'professionnel'
  const clientLines = isProClient
    ? [
        doc_.client.company_name,
        doc_.client.address,
        [doc_.client.address_complement].filter(Boolean).join(' '),
        [doc_.client.postal_code, doc_.client.city].filter(Boolean).join(' '),
        doc_.client.tva_number ? `TVA : ${doc_.client.tva_number}` : null,
        doc_.client.siren_siret ? `SIREN/SIRET : ${doc_.client.siren_siret}` : null,
      ].filter(Boolean)
    : [
        doc_.client.name,
        doc_.client.address,
        [doc_.client.postal_code, doc_.client.city].filter(Boolean).join(' '),
      ].filter(Boolean)

  const clientBoxHeight = Math.max(26, 10 + clientLines.length * 4.5)

  doc.setDrawColor(220, 217, 208)
  doc.setFillColor(247, 244, 236)
  doc.roundedRect(margin, y, 80, clientBoxHeight, 1, 1, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...ink)
  doc.text('CLIENT', margin + 4, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...grey)
  let cy = y + 11
  clientLines.forEach((line) => {
    doc.text(line, margin + 4, cy)
    cy += 4.5
  })

  y += clientBoxHeight + 8

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

  if (doc_.tax_credit_eligible) {
    const creditAmount = computeCreditImpot(doc_.total_ttc)
    const netCost = doc_.total_ttc - creditAmount
    doc.setDrawColor(...teal)
    doc.setFillColor(233, 242, 238)
    doc.roundedRect(margin, finalY, pageWidth - margin * 2, 20, 1, 1, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...teal)
    doc.text("Éligible au crédit d'impôt Services à la Personne (50%) — art. 199 sexdecies du CGI", margin + 4, finalY + 6)
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

  if (doc_.notes) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...grey)
    doc.text(doc.splitTextToSize(doc_.notes, pageWidth - margin * 2), margin, finalY + 4)
  }

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

export async function getDocumentPDFBase64(doc_) {
  const pdf = await generateDocumentPDF(doc_)
  const safeType = doc_.type.replace(/[^a-zA-Z0-9]+/g, '-')
  const dataUri = pdf.output('datauristring')
  const base64 = dataUri.split(',')[1]
  return { base64, filename: `${safeType}-${doc_.number}.pdf` }
}

// Génère l'attestation fiscale annuelle Services à la Personne (crédit d'impôt 50%)
// data: { business, client, year, totalPaid, invoices: [{ number, issue_date, amount }] }
export async function generateAttestationPDF(data) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  let y = 25

  const ink = [27, 42, 74]
  const teal = [47, 111, 94]
  const grey = [110, 105, 95]

  let textStartX = margin
  if (data.business.logo_url) {
    const dataUrl = await loadImageAsDataURL(data.business.logo_url)
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

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...ink)
  doc.text(data.business.name || '', textStartX, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...grey)
  const bizLines = [
    data.business.address,
    [data.business.postal_code, data.business.city].filter(Boolean).join(' '),
    data.business.siret ? `SIRET : ${data.business.siret}` : null,
    `Agrément Services à la Personne n° ${data.business.sap_agrement_number || '—'}`,
  ].filter(Boolean)
  bizLines.forEach((line) => {
    doc.text(line, textStartX, y)
    y += 4.5
  })

  y += 12
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...teal)
  doc.text('ATTESTATION FISCALE ANNUELLE', pageWidth / 2, y, { align: 'center' })
  y += 7
  doc.setFontSize(12)
  doc.text(`Services à la Personne — Année ${data.year}`, pageWidth / 2, y, { align: 'center' })
  y += 14

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.setTextColor(...ink)
  const introLines = doc.splitTextToSize(
    `Je soussigné(e), représentant de ${data.business.name}, certifie avoir fourni au cours de l'année ${data.year} des prestations de services à la personne à :`,
    pageWidth - margin * 2
  )
  doc.text(introLines, margin, y)
  y += introLines.length * 5.5 + 6

  doc.setDrawColor(220, 217, 208)
  doc.setFillColor(247, 244, 236)
  doc.roundedRect(margin, y, pageWidth - margin * 2, 22, 1, 1, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...ink)
  doc.text(data.client.name, margin + 6, y + 9)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...grey)
  const clientAddress = [data.client.address, [data.client.postal_code, data.client.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  doc.text(clientAddress, margin + 6, y + 16)
  y += 32

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.setTextColor(...ink)
  const bodyLines = doc.splitTextToSize(
    `Le montant total des sommes effectivement versées au titre de ces prestations au cours de l'année ${data.year} s'élève à :`,
    pageWidth - margin * 2
  )
  doc.text(bodyLines, margin, y)
  y += bodyLines.length * 5.5 + 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...teal)
  doc.text(formatEUR(data.totalPaid), pageWidth / 2, y, { align: 'center' })
  y += 14

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  doc.setTextColor(...grey)
  const legalLines = doc.splitTextToSize(
    "Cette attestation est délivrée conformément à l'article 199 sexdecies du Code Général des Impôts. Elle est à conserver par le bénéficiaire et à produire, le cas échéant, à l'administration fiscale. Le montant indiqué ouvre droit à un crédit ou une réduction d'impôt sur le revenu de 50%, sous réserve du respect des conditions et plafonds légaux applicables à la situation du bénéficiaire.",
    pageWidth - margin * 2
  )
  doc.text(legalLines, margin, y)
  y += legalLines.length * 4.5 + 10

  if (data.invoices && data.invoices.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['N° de facture', 'Date', 'Montant réglé']],
      body: data.invoices.map((inv) => [inv.number, formatDate(inv.issue_date), formatEUR(inv.amount)]),
      theme: 'plain',
      headStyles: { fillColor: ink, textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [40, 38, 34] },
      alternateRowStyles: { fillColor: [250, 248, 243] },
      margin: { left: margin, right: margin },
    })
    y = doc.lastAutoTable.finalY + 14
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...ink)
  doc.text(`Fait le ${formatDate(new Date().toISOString())}`, margin, y)
  doc.text('Signature et cachet', pageWidth - margin - 60, y)
  doc.setDrawColor(...grey)
  doc.rect(pageWidth - margin - 60, y + 4, 60, 24)

  return doc
}

export async function downloadAttestationPDF(data) {
  const pdf = await generateAttestationPDF(data)
  pdf.save(`Attestation-SAP-${data.year}-${data.client.name.replace(/[^a-zA-Z0-9]+/g, '-')}.pdf`)
}

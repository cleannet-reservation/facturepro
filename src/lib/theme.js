function hexToRgb(hex) {
  const clean = hex.replace('#', '')
  const bigint = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16)
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 }
}

function darken({ r, g, b }, amount = 0.25) {
  return `rgb(${Math.round(r * (1 - amount))}, ${Math.round(g * (1 - amount))}, ${Math.round(b * (1 - amount))})`
}

export function applyBrandColor(hex) {
  if (!hex || !/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex)) return
  const rgb = hexToRgb(hex)
  const root = document.documentElement.style
  root.setProperty('--cyan', hex)
  root.setProperty('--cyan-dark', darken(rgb, 0.22))
  root.setProperty('--cyan-soft', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`)
}

export const APP_NAME = import.meta.env.VITE_APP_NAME || 'FacturePro'

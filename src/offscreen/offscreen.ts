// ============================================================
// offscreen.ts
// Chrome Extension - Offscreen Document
// html2pdf.js এখানেই run হবে — DOM access আছে এখানে
// ============================================================

import html2pdf from 'html2pdf.js'

// ── Types ────────────────────────────────────────────────────
interface PDFRequest {
  action: 'GENERATE_PDF'
  html: string
  filename: string
}

interface PDFResponse {
  success: boolean
  base64?: string
  filename?: string
  error?: string
}

// ── html2pdf options ─────────────────────────────────────────
const PDF_OPTIONS = {
  margin: [10, 10, 10, 10] as [number, number, number, number],
  image: { type: 'jpeg' as const, quality: 0.98 },
  html2canvas: {
    scale: 2,
    useCORS: true,
    letterRendering: true,
    windowWidth: 794, // A4 width at 96dpi
  },
  jsPDF: {
    unit: 'mm' as const,
    format: 'a4' as const,
    orientation: 'portrait' as const,
  },
}

// ── Main: HTML string → base64 PDF ──────────────────────────
async function generatePDF(html: string): Promise<string> {
  // Step 1: DOM element বানাও — .from(string) extension এ কাজ করে না
  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  container.style.top = '0'
  container.style.width = '794px' // A4 width — page break এর জন্য জরুরি
  container.innerHTML = html
  document.body.appendChild(container)

  try {
    // Step 2: html2pdf দিয়ে blob বানাও
    const blob: Blob = await html2pdf()
      .set(PDF_OPTIONS)
      .from(container)
      .output('blob')

    // Step 3: blob → base64
    const base64 = await blobToBase64(blob)
    return base64

  } finally {
    // Step 4: cleanup — সবসময় remove করো even if error হয়
    if (document.body.contains(container)) {
      document.body.removeChild(container)
    }
  }
}

// ── Helper: Blob → base64 string ────────────────────────────
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      // "data:application/pdf;base64,XXXX" থেকে শুধু XXXX নেওয়া
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })
}

// ── Message Listener ─────────────────────────────────────────
chrome.runtime.onMessage.addListener(
  (message: PDFRequest, _sender, sendResponse) => {
    if (message.action !== 'GENERATE_PDF') return false

    const { html, filename } = message

    generatePDF(html)
      .then((base64) => {
        const response: PDFResponse = {
          success: true,
          base64,
          filename,
        }
        sendResponse(response)
      })
      .catch((error) => {
        const response: PDFResponse = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
        sendResponse(response)
      })

    return true // async response এর জন্য জরুরি
  }
)

console.log('[Offscreen] PDF generator ready')
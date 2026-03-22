/**
 * HTML-to-PDF Compiler using html2pdf.js
 * Uses HTML/CSS rendering for perfect layout (like Canva)
 */

import html2pdf from 'html2pdf.js'
import { generateHTMLCV, CVDataForHtml } from './cvHTMLTemplate'

// ============================================
// Types
// ============================================

export interface PDFCompileResult {
  success: boolean
  pdfBlob?: Blob
  error?: string
}

export interface CompileOptions {
  filename?: string
  margin?: [number, number, number, number] // [top, left, bottom, right]
  imageQuality?: number
}

// ============================================
// Utility Functions
// ============================================

/**
 * Download PDF blob as file
 */
export function downloadPDFBlob(pdfBlob: Blob, filename: string = 'cv.pdf'): void {
  const url = URL.createObjectURL(pdfBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Convert PDF blob to base64 (for chrome messaging)
 */
export async function pdfBlobToBase64(pdfBlob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      // Remove data URL prefix
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(pdfBlob)
  })
}

/**
 * Get PDF blob size in human-readable format
 */
export function getPDFSize(pdfBlob: Blob): string {
  const bytes = pdfBlob.size
  const kb = bytes / 1024
  const mb = kb / 1024

  if (mb >= 1) {
    return `${mb.toFixed(2)} MB`
  } else if (kb >= 1) {
    return `${kb.toFixed(2)} KB`
  } else {
    return `${bytes} bytes`
  }
}

// ============================================
// CV Data to PDF (Main Function)
// ============================================

/**
 * Generate PDF from CV data using html2pdf.js
 * Uses HTML/CSS rendering for perfect layout
 */
export async function compileCVDataToPDF(
  cvData: CVDataForHtml,
  options: CompileOptions = {}
): Promise<PDFCompileResult> {
  try {
    console.log('[HTML2PDF Compiler] Starting PDF generation from CV data...')
    console.log('[HTML2PDF Compiler] CV Data keys:', Object.keys(cvData))
    console.log('[HTML2PDF Compiler] CV Data:', JSON.stringify(cvData, null, 2))

    // Generate HTML from CV data
    const html = generateHTMLCV(cvData)

    console.log('[HTML2PDF Compiler] HTML generated, length:', html.length, 'bytes')
    console.log('[HTML2PDF Compiler] HTML preview (first 500 chars):', html.substring(0, 500))

    // Configure html2pdf options
    const opt = {
      margin: options.margin || [0, 0, 0, 0], // top, left, bottom, right in mm
      filename: options.filename || 'cv.pdf',
      image: { type: 'jpeg' as const, quality: options.imageQuality || 0.98 },
      html2canvas: {
        scale: 2, // Higher scale = better quality
        useCORS: true,
        letterRendering: true,
        windowWidth: 794 // Force A4 width in pixels
      },
      jsPDF: {
        unit: 'mm' as const,
        format: 'a4' as const,
        orientation: 'portrait' as const
      }
    }

    console.log('[HTML2PDF Compiler] Generating PDF from HTML...')

    // Create a temporary container for our scoped HTML to avoid MV3 iframe issues
    const container = document.createElement('div')
    container.style.position = 'absolute'
    container.style.left = '-9999px' // Hide off-screen
    container.style.top = '0'
    container.innerHTML = html
    document.body.appendChild(container)

    // Generate PDF
    let pdfBlob: Blob;
    try {
      pdfBlob = await html2pdf().set(opt).from(container).output('blob')
    } finally {
      document.body.removeChild(container)
    }

    console.log('[HTML2PDF Compiler] PDF generation complete')
    console.log('[HTML2PDF Compiler] PDF size:', getPDFSize(pdfBlob))

    return {
      success: true,
      pdfBlob
    }
  } catch (error) {
    console.error('[HTML2PDF Compiler] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Generate and download PDF directly
 */
export async function generateAndDownloadPDF(
  cvData: CVDataForHtml,
  filename: string = 'cv.pdf'
): Promise<void> {
  const result = await compileCVDataToPDF(cvData, { filename })

  if (result.success && result.pdfBlob) {
    downloadPDFBlob(result.pdfBlob, filename)
    console.log('[HTML2PDF Compiler] PDF downloaded successfully!')
  } else {
    console.error('[HTML2PDF Compiler] Failed to generate PDF:', result.error)
    throw new Error(result.error || 'Failed to generate PDF')
  }
}
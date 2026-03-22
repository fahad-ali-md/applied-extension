/**
 * Puppeteer-based PDF Generator
 *
 * Uses Puppeteer's page.pdf() for perfect HTML-to-PDF rendering
 * Works within Chrome Extension using chrome.debugger API
 */

import {
  connect,
  ExtensionTransport,
} from 'puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js'
import { generateHTMLCV } from './cvHTMLTemplate'

// ============================================
// Types
// ============================================

export interface PuppeteerPDFResult {
  success: boolean
  pdfBlob?: Blob
  pdfSize?: string
  error?: string
}

export interface PuppeteerPDFOptions {
  filename?: string
  margin?: {
    top?: string
    bottom?: string
    left?: string
    right?: string
  }
  format?: 'A4' | 'Letter'
  printBackground?: boolean
}

// ============================================
// Main PDF Generation Function
// ============================================

/**
 * Generate PDF from CV data using Puppeteer
 *
 * Process:
 * 1. Create new tab with CV HTML
 * 2. Use Puppeteer to connect via chrome.debugger
 * 3. Generate PDF using page.pdf()
 * 4. Close tab and return base64 PDF
 */
export async function generatePDFWithPuppeteer(
  cvData: any,
  options: PuppeteerPDFOptions = {}
): Promise<PuppeteerPDFResult> {
  try {
    console.log('[Puppeteer PDF] Starting PDF generation...')

    // Step 1: Generate HTML from CV data
    const html = generateHTMLCV(cvData)
    console.log('[Puppeteer PDF] HTML generated:', html.length, 'bytes')

    // Step 2: Create data URL with the HTML
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
    console.log('[Puppeteer PDF] Data URL created')

    // Step 3: Create new tab with the HTML
    const tab = await chrome.tabs.create({ url: dataUrl, active: false })
    console.log('[Puppeteer PDF] Tab created:', tab.id)

    // Wait for tab to load
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Step 4: Attach debugger to the tab
    // First, try to detach if already attached (prevents "already attached" error)
    try {
      await chrome.debugger.detach({ tabId: tab.id! })
      console.log('[Puppeteer PDF] Detached existing debugger')
    } catch (e) {
      // No debugger attached, that's fine
      console.log('[Puppeteer PDF] No existing debugger to detach')
    }

    await chrome.debugger.attach({ tabId: tab.id! }, '1.3')
    console.log('[Puppeteer PDF] Debugger attached')

    try {
      // Step 5: Connect Puppeteer
      const transport = await ExtensionTransport.connectTab(tab.id!)
      const browser = await connect({ transport })
      const [page] = await browser.pages()
      console.log('[Puppeteer PDF] Puppeteer connected')

      // Step 6: Wait for page to fully render
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Step 7: Generate PDF
      console.log('[Puppeteer PDF] Generating PDF...')
      const pdfBuffer = await page.pdf({
        format: options.format || 'A4',
        printBackground: options.printBackground !== false,
        margin: {
          top: options.margin?.top || '10mm',
          bottom: options.margin?.bottom || '10mm',
          left: options.margin?.left || '10mm',
          right: options.margin?.right || '10mm',
        },
      })

      console.log('[Puppeteer PDF] PDF generated:', pdfBuffer.length, 'bytes')

      // Step 8: Convert buffer to Blob
      const uint8Array = new Uint8Array(pdfBuffer)
      const pdfBlob = new Blob([uint8Array], { type: 'application/pdf' })

      // Step 9: Calculate size
      const sizeKB = (pdfBuffer.length / 1024).toFixed(2)
      const sizeStr = sizeKB + ' KB'

      // Step 10: Cleanup
      browser.disconnect()

      // Step 11: Close the tab
      await chrome.tabs.remove(tab.id!)
      console.log('[Puppeteer PDF] Tab closed')

      return {
        success: true,
        pdfBlob: pdfBlob,
        pdfSize: sizeStr,
      }

    } finally {
      // Always detach debugger
      try {
        await chrome.debugger.detach({ tabId: tab.id! })
      } catch (e) {
        console.warn('[Puppeteer PDF] Debugger detach warning:', e)
      }
    }

  } catch (error) {
    console.error('[Puppeteer PDF] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Convert base64 PDF to Blob
 */
export function base64ToPDFBlob(base64: string): Blob {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return new Blob([bytes], { type: 'application/pdf' })
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
 * Get PDF size from blob in human-readable format
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

/**
 * Get PDF size in human-readable format
 */
export function getPDFSizeFromBytes(bytes: number): string {
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

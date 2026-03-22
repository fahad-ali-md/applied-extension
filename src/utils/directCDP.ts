/**
 * Direct CDP PDF Generator
 * Uses chrome.debugger.sendCommand('Page.printToPDF') directly
 * This is what Puppeteer uses internally, but accessible in extensions
 */

import { generateHTMLCV, type CVDataForHtml } from './cvHTMLTemplate'

export interface DirectCDPResult {
  success: boolean
  pdfBlob?: Blob
  pdfSize?: string
  error?: string
}

export interface DirectCDPOptions {
  filename?: string
  format?: 'A4' | 'Letter'
  printBackground?: boolean
  margin?: {
    top?: number
    bottom?: number
    left?: number
    right?: number
  }
}

/**
 * Helper: Wait for tab to complete loading
 */
async function waitForTabComplete(tabId: number, timeout = 15000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const tab = await chrome.tabs.get(tabId)
    if (tab.status === 'complete') return
    await new Promise(r => setTimeout(r, 100))
  }
  throw new Error('Tab did not load in time')
}

/**
 * Generate PDF using Direct CDP (chrome.debugger)
 * This method produces 30-100 KB PDFs with full content
 */
export async function generatePDFWithDirectCDP(
  cvData: CVDataForHtml,
  options: DirectCDPOptions = {}
): Promise<DirectCDPResult> {
  try {
    console.log('[Direct CDP] Starting PDF generation...')

    // Step 1: Generate HTML
    const html = generateHTMLCV(cvData)
    console.log('[Direct CDP] HTML generated:', html.length, 'bytes')

    // Step 2: Create data URL
    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html)

    // Step 3: Create new tab
    const tab = await chrome.tabs.create({ url: dataUrl, active: false })
    console.log('[Direct CDP] Tab created:', tab.id)

    // Step 4: Wait for tab to load
    await waitForTabComplete(tab.id!)
    console.log('[Direct CDP] Tab loaded')

    // Step 5: Wait for rendering (CRITICAL for content to appear)
    await new Promise(r => setTimeout(r, 3000))
    console.log('[Direct CDP] Render wait complete')

    // Step 6: Attach debugger
    // Try to detach if already attached (prevents "already attached" error)
    try {
      await chrome.debugger.detach({ tabId: tab.id! })
      console.log('[Direct CDP] Detached existing debugger')
    } catch (e) {
      // No debugger attached, that's fine
    }

    await chrome.debugger.attach({ tabId: tab.id! }, '1.3')
    console.log('[Direct CDP] Debugger attached')

    try {
      // Enable Page domain
      await chrome.debugger.sendCommand({ tabId: tab.id! }, 'Page.enable')
      console.log('[Direct CDP] Page enabled')

      // Wait for Page to settle
      await new Promise(r => setTimeout(r, 500))

      // Generate PDF
      console.log('[Direct CDP] Calling Page.printToPDF...')
      const result = await chrome.debugger.sendCommand(
        { tabId: tab.id! },
        'Page.printToPDF',
        {
          landscape: false,
          displayHeaderFooter: false,
          printBackground: options.printBackground !== false,
          preferCSSPageSize: false,
          paperWidth: 8.27,  // A4
          paperHeight: 11.69, // A4
          marginTop: options.margin?.top || 0.5,
          marginBottom: options.margin?.bottom || 0.5,
          marginLeft: options.margin?.left || 0.5,
          marginRight: options.margin?.right || 0.5
        }
      ) as { data: string }

      const sizeKB = (result.data.length / 1024).toFixed(1)
      console.log('[Direct CDP] PDF generated! Size:', sizeKB, 'KB')

      // Convert base64 to Blob
      const binary = atob(result.data)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      const pdfBlob = new Blob([bytes], { type: 'application/pdf' })

      // Close tab after delay
      setTimeout(() => chrome.tabs.remove(tab.id!), 2000)

      return {
        success: true,
        pdfBlob: pdfBlob,
        pdfSize: sizeKB + ' KB'
      }

    } finally {
      // Always detach debugger
      try {
        await chrome.debugger.detach({ tabId: tab.id! })
        console.log('[Direct CDP] Debugger detached')
      } catch (e) {
        console.warn('[Direct CDP] Detach warning:', e)
      }
    }

  } catch (error) {
    console.error('[Direct CDP] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
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

/**
 * Puppeteer Utilities for PDF Generation
 *
 * Helper functions for reliable PDF generation with chrome.debugger
 */

/**
 * Wait for a tab to complete loading
 */
export async function waitForTabLoad(tabId: number, timeoutMs: number = 10000): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    const tab = await chrome.tabs.get(tabId)

    if (tab.status === 'complete') {
      console.log('[Puppeteer Utils] Tab fully loaded')
      return
    }

    await new Promise(resolve => setTimeout(resolve, 100))
  }

  throw new Error('Tab did not load within timeout period')
}

/**
 * Generate PDF with retry logic
 */
export async function generatePDFWithRetry(
  tabId: number,
  maxRetries: number = 3
): Promise<string> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Puppeteer Utils] PDF generation attempt ${attempt}/${maxRetries}`)

      // Attach debugger
      await chrome.debugger.attach({ tabId }, '1.3')

      try {
        // Enable Page domain
        await chrome.debugger.sendCommand({ tabId }, 'Page.enable')

        // Wait a bit for rendering
        await new Promise(resolve => setTimeout(resolve, 500))

        // Generate PDF
        const result = await chrome.debugger.sendCommand(
          { tabId },
          'Page.printToPDF',
          {
            landscape: false,
            displayHeaderFooter: false,
            printBackground: true,
            preferCSSPageSize: false,
            paperWidth: 8.27,
            paperHeight: 11.69,
            marginTop: 0.4,
            marginBottom: 0.4,
            marginLeft: 0.4,
            marginRight: 0.4
          }
        ) as { data: string }

        console.log('[Puppeteer Utils] PDF generated successfully')
        return result.data

      } finally {
        // Always detach
        try {
          await chrome.debugger.detach({ tabId })
        } catch (e) {
          // Ignore
        }
      }

    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      console.warn(`[Puppeteer Utils] Attempt ${attempt} failed:`, lastError.message)

      if (attempt < maxRetries) {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }

  throw lastError || new Error('PDF generation failed after all retries')
}

/**
 * Convert PDF base64 to blob
 */
export function base64ToBlob(base64: string): Blob {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return new Blob([bytes], { type: 'application/pdf' })
}

/**
 * Download blob as file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

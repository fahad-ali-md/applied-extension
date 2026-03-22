/**
 * CV Workflow using Puppeteer for PDF Generation
 *
 * Main workflow:
 * 1. Get CV JSON data from chrome.storage
 * 2. Generate HTML from CV data
 * 3. Use Puppeteer (via chrome.debugger) to create PDF
 * 4. Upload PDF to form inputs
 */

import { getCVData } from './storageHelpers'
import {
  validateCVData,
  hasMinimumCVData,
  getCVStats,
  type CVData
} from './latexGenerator'
import { generateHTMLCV } from './cvHTMLTemplate'

// ============================================
// Types
// ============================================

export interface CVWorkflowOptions {
  filename?: string
  autoUpload?: boolean
  onProgress?: (stage: string, message: string) => void
  onError?: (error: string) => void
}

export interface CVWorkflowResult {
  success: boolean
  stagesCompleted: string[]
  pdfBase64?: string
  pdfSize?: string
  uploadStats?: {
    uploaded: number
    errors: string[]
  }
  error?: string
}

// ============================================
// Main Workflow
// ============================================

/**
 * Complete CV workflow: JSON → HTML → PDF → Upload
 * Uses Puppeteer via chrome.debugger for PDF generation
 */
export async function executeCVWorkflow(
  options: CVWorkflowOptions = {}
): Promise<CVWorkflowResult> {
  const result: CVWorkflowResult = {
    success: false,
    stagesCompleted: []
  }

  const progress = options.onProgress || ((stage, message) => {
    console.log(`[CV Workflow] ${stage}: ${message}`)
  })

  try {
    // ========================================
    // Stage 1: Get CV Data from Storage
    // ========================================
    progress('STORAGE', 'Fetching CV data from storage...')

    const cvData = await getCVData()

    if (!cvData) {
      const error = 'No CV data found in storage'
      progress('ERROR', error)
      options.onError?.(error)
      result.error = error
      return result
    }

    progress('STORAGE', `✓ CV data loaded`)

    // Enhance education data with estimated start dates if missing
    if (cvData.education && Array.isArray(cvData.education)) {
      cvData.education = cvData.education.map((edu: any) => {
        if (edu.startDate) {
          return edu
        }

        if (edu.graduationYear) {
          const gradYear = parseInt(edu.graduationYear.toString())
          if (!isNaN(gradYear)) {
            const degree = (edu.degree || '').toLowerCase()
            let estimatedYears = 4

            if (degree.includes('master') || degree.includes('mtech') || degree.includes('ms') || degree.includes('m.sc')) {
              estimatedYears = 2
            } else if (degree.includes('phd') || degree.includes('doctorate')) {
              estimatedYears = 5
            } else if (degree.includes('associate') || degree.includes('diploma')) {
              estimatedYears = 2
            } else if (degree.includes('high school') || degree.includes('12th') || degree.includes('higher secondary')) {
              estimatedYears = 2
            }

            const startYear = gradYear - estimatedYears
            return { ...edu, startDate: `${startYear}-08` }
          }
        }

        return edu
      })
    }

    // Validate CV data
    if (!validateCVData(cvData)) {
      const error = 'Invalid CV data structure'
      progress('ERROR', error)
      options.onError?.(error)
      result.error = error
      return result
    }

    // Check minimum data
    if (!hasMinimumCVData(cvData)) {
      progress('WARNING', 'CV data may be incomplete (missing basic info)')
    }

    // Get CV statistics
    const stats = getCVStats(cvData)
    progress('INFO', `CV Stats: ${stats.experiences} experiences, ${stats.education} education, ${stats.projects} projects`)

    result.stagesCompleted.push('storage')

    // ========================================
    // Stage 2: Generate PDF using Puppeteer
    // ========================================
    progress('PDF', 'Generating CV PDF with Puppeteer...')

    const pdfResult = await generatePDFWithPuppeteer(cvData, {
      filename: options.filename || 'cv.pdf',
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '10mm',
        right: '10mm'
      }
    })

    if (!pdfResult.success || !pdfResult.pdfBase64) {
      const error = pdfResult.error || 'Failed to generate PDF'
      progress('ERROR', error)
      options.onError?.(error)
      result.error = error
      return result
    }

    progress('PDF', `✓ PDF generated successfully (${pdfResult.pdfSize})`)

    result.pdfBase64 = pdfResult.pdfBase64
    result.pdfSize = pdfResult.pdfSize
    result.stagesCompleted.push('pdf')

    console.log('[CV Workflow] PDF generated, size:', pdfResult.pdfSize)

    // ========================================
    // Stage 3: Upload to Form Inputs (if enabled)
    // ========================================
    if (options.autoUpload !== false) {
      progress('UPLOAD', 'Uploading PDF to form inputs...')

      try {
        // Convert base64 to blob for upload
        const binaryString = atob(pdfResult.pdfBase64)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        const pdfBlob = new Blob([bytes], { type: 'application/pdf' })

        // Import FileUploader dynamically
        const { getFileUploader } = await import('../contentScript/core/FileUploader')
        const uploader = getFileUploader()

        const uploadResult = await uploader.uploadCVToAllInputs(
          pdfBlob,
          options.filename || 'cv.pdf'
        )

        result.uploadStats = uploadResult

        if (uploadResult.uploaded > 0) {
          progress('UPLOAD', `✓ Uploaded to ${uploadResult.uploaded} file input(s)`)
          result.stagesCompleted.push('upload')
        } else {
          progress('WARNING', 'No file inputs found or upload failed')
          if (uploadResult.errors.length > 0) {
            progress('UPLOAD_ERRORS', uploadResult.errors.join('; '))
          }
        }
      } catch (uploadError) {
        const error = uploadError instanceof Error ? uploadError.message : 'Upload failed'
        progress('UPLOAD_WARNING', `Upload failed: ${error}`)
        result.uploadStats = {
          uploaded: 0,
          errors: [error]
        }
      }
    } else {
      progress('UPLOAD', 'Auto-upload disabled, skipping...')
    }

    // ========================================
    // Success
    // ========================================
    result.success = true
    progress('SUCCESS', 'CV workflow completed successfully!')

    return result

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    progress('ERROR', errorMessage)
    options.onError?.(errorMessage)
    result.error = errorMessage
    return result
  }
}

// ============================================
// Puppeteer PDF Generation
// ============================================

/**
 * Generate PDF from CV data using Puppeteer (chrome.debugger)
 */
async function generatePDFWithPuppeteer(
  cvData: any,
  options: {
    filename?: string
    format?: 'A4' | 'Letter'
    printBackground?: boolean
    margin?: {
      top?: string
      bottom?: string
      left?: string
      right?: string
    }
  }
): Promise<{ success: boolean; pdfBase64?: string; pdfSize?: string; error?: string }> {
  try {
    console.log('[Puppeteer PDF] Starting PDF generation...')

    // Generate HTML from CV data
    const html = generateHTMLCV(cvData)
    console.log('[Puppeteer PDF] HTML generated:', html.length, 'bytes')

    // Create data URL
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`

    // Create new tab
    const tab = await chrome.tabs.create({ url: dataUrl, active: false })
    console.log('[Puppeteer PDF] Tab created:', tab.id)

    // Wait for tab to fully load and render
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Attach debugger
    await chrome.debugger.attach({ tabId: tab.id! }, '1.3')
    console.log('[Puppeteer PDF] Debugger attached')

    try {
      // Enable Page domain first
      await chrome.debugger.sendCommand({ tabId: tab.id! }, 'Page.enable')
      console.log('[Puppeteer PDF] Page domain enabled')

      // Wait a bit more for rendering
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Generate PDF using Page.printToPDF
      const result = await chrome.debugger.sendCommand(
        { tabId: tab.id! },
        'Page.printToPDF',
        {
          landscape: false,
          displayHeaderFooter: false,
          printBackground: options.printBackground !== false,
          preferCSSPageSize: false,
          paperWidth: 8.27, // A4 width in inches
          paperHeight: 11.69, // A4 height in inches
          marginTop: 0.4,
          marginBottom: 0.4,
          marginLeft: 0.4,
          marginRight: 0.4
        }
      ) as { data: string }

      console.log('[Puppeteer PDF] PDF generated:', result.data.length, 'chars')

      // Close tab
      await chrome.tabs.remove(tab.id!)

      // Calculate size
      const binaryString = atob(result.data)
      const sizeKB = (binaryString.length / 1024).toFixed(2)
      const sizeStr = sizeKB + ' KB'

      return {
        success: true,
        pdfBase64: result.data,
        pdfSize: sizeStr
      }

    } finally {
      // Always detach debugger
      try {
        await chrome.debugger.detach({ tabId: tab.id! })
      } catch (e) {
        console.warn('[Puppeteer PDF] Detach warning:', e)
      }
    }

  } catch (error) {
    console.error('[Puppeteer PDF] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Generate CV PDF and download it (without uploading)
 */
export async function generateAndDownloadCV(
  filename: string = 'cv.pdf',
  onProgress?: (stage: string, message: string) => void
): Promise<CVWorkflowResult> {
  const result = await executeCVWorkflow({
    filename,
    autoUpload: false,
    onProgress
  })

  // Download the PDF if successful
  if (result.success && result.pdfBase64) {
    try {
      const binaryString = atob(result.pdfBase64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: 'application/pdf' })

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      console.log('[CV Workflow] PDF downloaded successfully!')
    } catch (error) {
      console.error('[CV Workflow] Failed to download PDF:', error)
    }
  }

  return result
}

// ============================================
// Chrome Message Handler
// ============================================

/**
 * Handle messages from popup/content script
 */
export async function handleCVWorkflowMessage(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse?: (response?: any) => void
): Promise<void> {
  console.log('[CV Workflow] Received message:', message)

  try {
    switch (message.action) {
      case 'generateCV': {
        const result = await generateAndDownloadCV(
          message.filename || 'cv.pdf'
        )

        console.log('[CV Workflow] generateCV result:', {
          success: result.success,
          hasPdfBase64: !!result.pdfBase64,
          pdfSize: result.pdfSize,
          stagesCompleted: result.stagesCompleted
        })

        sendResponse?.(result)
        break
      }

      case 'generateAndUploadCV': {
        const result = await executeCVWorkflow({
          filename: message.filename || 'cv.pdf',
          autoUpload: true,
          onProgress: (stage, msg) => {
            chrome.runtime.sendMessage({
              type: 'cv_workflow_progress',
              stage,
              message: msg
            }).catch(() => {})
          }
        })

        sendResponse?.(result)
        break
      }

      case 'checkCVData': {
        const cvData = await getCVData()
        sendResponse?.({
          hasCVData: !!cvData,
          valid: cvData ? validateCVData(cvData) : false
        })
        break
      }

      default:
        sendResponse?.({ success: false, error: 'Unknown action' })
    }
  } catch (error) {
    console.error('[CV Workflow] Error handling message:', error)
    sendResponse?.({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Initialize CV workflow message listener in background script
 */
export function setupCVWorkflowListener(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action?.startsWith('generateCV') ||
      message.action === 'checkCVData' ||
      message.action === 'getCVStats') {
      handleCVWorkflowMessage(message, sender, sendResponse)
      return true
    }
    return false
  })

  console.log('[CV Workflow] Message listener initialized (Puppeteer-based)')
}

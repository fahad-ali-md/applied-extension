/**
 * CV Workflow - Complete Integration
 *
 * Main workflow:
 * 1. Get CV JSON data from chrome.storage
 * 2. Generate PDF directly from CV data
 * 3. Upload PDF to form inputs
 */

import { getCVData } from './storageHelpers'
import {
  validateCVData,
  hasMinimumCVData,
  getCVStats,
  type CVData
} from './latexGenerator'
import {
  generatePDFWithPuppeteer,
  getPDFSize,
  pdfBlobToBase64
} from './puppeteerPDFGenerator'

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
  pdfBlob?: Blob
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
 * Complete CV workflow: JSON → LaTeX → PDF → Upload
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

    progress('STORAGE', `✓ CV data loaded (${JSON.stringify(cvData).length} bytes)`)

    // Enhance education data with estimated start dates if missing
    if (cvData.education && Array.isArray(cvData.education)) {
      cvData.education = cvData.education.map((edu: any) => {
        // If startDate already exists, keep it
        if (edu.startDate) {
          return edu
        }

        // Estimate startDate from graduationYear
        if (edu.graduationYear) {
          const gradYear = parseInt(edu.graduationYear.toString())
          if (!isNaN(gradYear)) {
            // Estimate duration based on degree type
            const degree = (edu.degree || '').toLowerCase()
            let estimatedYears = 4 // Default for bachelor's

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
            // Use August as typical start month
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
    // Stage 2: Compile PDF directly from CV data
    // ========================================
    progress('PDF', 'Generating CV PDF with Puppeteer...')

    const compileResult = await generatePDFWithPuppeteer(cvData as any, {
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

    if (!compileResult.success || !compileResult.pdfBlob) {
      const error = compileResult.error || 'Failed to compile PDF'
      progress('ERROR', error)
      options.onError?.(error)
      result.error = error
      return result
    }

    console.log('[CV Workflow] compileResult.pdfBlob:', compileResult.pdfBlob)
    console.log('[CV Workflow] compileResult.pdfBlob size:', compileResult.pdfBlob?.size)
    console.log('[CV Workflow] compileResult.pdfBlob type:', compileResult.pdfBlob?.type)

    const pdfSize = getPDFSize(compileResult.pdfBlob)
    progress('PDF', `✓ PDF compiled successfully (${pdfSize})`)

    result.pdfBlob = compileResult.pdfBlob
    result.pdfSize = pdfSize
    result.stagesCompleted.push('pdf')

    console.log('[CV Workflow] result.pdfBlob set:', result.pdfBlob)
    console.log('[CV Workflow] result.pdfBlob size:', result.pdfBlob?.size)

    // ========================================
    // Stage 4: Upload to Form Inputs (if enabled)
    // ========================================
    if (options.autoUpload !== false) {
      progress('UPLOAD', 'Uploading PDF to form inputs...')

      try {
        // Import FileUploader dynamically to avoid circular dependencies
        const { getFileUploader } = await import('../contentScript/core/FileUploader')
        const uploader = getFileUploader()

        const uploadResult = await uploader.uploadCVToAllInputs(
          compileResult.pdfBlob,
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
        // Don't fail the entire workflow if upload fails
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

    console.log('[CV Workflow] Returning result:', {
      success: result.success,
      hasPdfBlob: !!result.pdfBlob,
      pdfSize: result.pdfSize,
      stagesCompleted: result.stagesCompleted,
      pdfBlobType: result.pdfBlob?.type,
      pdfBlobSize: result.pdfBlob?.size
    })

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

  // Note: Don't call downloadPDFBlob here as it uses URL.createObjectURL
  // which is not available in background scripts. The frontend will handle
  // the download after receiving the PDF blob.

  return result
}

/**
 * Generate CV PDF only (no download, no upload)
 */
export async function generateCVPDF(
  onProgress?: (stage: string, message: string) => void
): Promise<CVWorkflowResult> {
  return executeCVWorkflow({
    autoUpload: false,
    onProgress
  })
}

/**
 * Quick check if CV workflow can be executed
 */
export async function canExecuteCVWorkflow(): Promise<{
  canExecute: boolean
  hasCVData: boolean
  hasMinimumData: boolean
  reason?: string
}> {
  const cvData = await getCVData()

  if (!cvData) {
    return {
      canExecute: false,
      hasCVData: false,
      hasMinimumData: false,
      reason: 'No CV data found in storage'
    }
  }

  if (!validateCVData(cvData)) {
    return {
      canExecute: false,
      hasCVData: true,
      hasMinimumData: false,
      reason: 'CV data has invalid structure'
    }
  }

  const hasMinimum = hasMinimumCVData(cvData as CVData)

  return {
    canExecute: true,
    hasCVData: true,
    hasMinimumData: hasMinimum,
    reason: hasMinimum ? undefined : 'CV data may be incomplete'
  }
}

// ============================================
// Chrome Message Handler
// ============================================

/**
 * Handle messages from popup/content script
 * This can be called from chrome.runtime.onMessage
 */
export async function handleCVWorkflowMessage(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse?: (response?: any) => void
): Promise<void> {
  console.log('[CV Workflow] Received message:', message)

  try {
    switch (message.action) {
      case 'generateCV':
      case 'generateAndUploadCV': {
        sendResponse?.({ success: false, error: 'PDF generation is no longer supported in the background script. Use frontend generators.' })
        break
      }

      case 'checkCVData': {
        const check = await canExecuteCVWorkflow()
        sendResponse?.(check)
        break
      }

      case 'getCVStats': {
        const cvData = await getCVData()
        if (cvData) {
          const stats = getCVStats(cvData as CVData)
          sendResponse?.({ success: true, stats })
        } else {
          sendResponse?.({ success: false, error: 'No CV data found' })
        }
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

// ============================================
// Setup Message Listener
// ============================================

/**
 * Initialize CV workflow message listener in background script
 * Call this from background/index.ts
 */
export function setupCVWorkflowListener(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle CV workflow messages asynchronously
    if (message.action === 'checkCVData' ||
      message.action === 'getCVStats') {
      handleCVWorkflowMessage(message, sender, sendResponse)
      return true // Keep message channel open for async response
    }
    return false
  })

  console.log('[CV Workflow] Message listener initialized')
}

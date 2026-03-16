/**
 * File Upload Utility for CV and Cover Letter
 *
 * Handles detection and upload of PDF files to file input fields on web forms.
 * Supports LinkedIn Easy Apply and other job application platforms.
 */

// ============================================
// Types
// ============================================

export interface FileUploadResult {
  cvUploaded: boolean
  coverLetterUploaded: boolean
  cvInputs: number
  coverLetterInputs: number
  cvErrors: string[]
  coverLetterErrors: string[]
}

export interface FileInputInfo {
  element: HTMLInputElement
  type: 'resume' | 'coverLetter' | 'unknown'
  confidence: number
}

// ============================================
// File Input Detection Patterns
// ============================================

const FILE_INPUT_PATTERNS = {
  // Resume/CV patterns
  resume: [
    'resume', 'cv', 'curriculum', 'vitae',
    'uploadResume', 'upload_resume', 'resumefile', 'resume_file',
    'attachment', 'document', 'portfolio'
  ],

  // Cover Letter patterns
  coverLetter: [
    'coverletter', 'cover_letter', 'cover-letter',
    'coverletterfile', 'cover_letter_file',
    'cl', 'letter', 'motivation'
  ]
}

// ============================================
// Main FileUploader Class
// ============================================

export class FileUploader {
  /**
   * Find all file input fields on the page
   */
  private findAllFileInputs(): HTMLInputElement[] {
    const fileInputs = Array.from(document.querySelectorAll('input[type="file"]')) as HTMLInputElement[]

    // Also check inside iframes (common in LinkedIn Easy Apply)
    const iframes = Array.from(document.querySelectorAll('iframe'))
    for (const iframe of iframes) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
        if (iframeDoc) {
          const iframeInputs = Array.from(iframeDoc.querySelectorAll('input[type="file"]')) as HTMLInputElement[]
          fileInputs.push(...iframeInputs)
        }
      } catch (e) {
        // Cross-origin iframe - skip
        console.debug('[FileUploader] Cannot access iframe:', iframe.src)
      }
    }

    return fileInputs
  }

  /**
   * Classify a file input based on its attributes
   */
  private classifyFileInput(input: HTMLInputElement): FileInputInfo {
    const haystack = [
      input.name,
      input.id,
      input.className,
      input.getAttribute('aria-label') || '',
      input.getAttribute('data-testid') || '',
      input.placeholder || ''
    ].join(' ').toLowerCase()

    // Check for cover letter patterns first (more specific)
    const coverLetterMatch = FILE_INPUT_PATTERNS.coverLetter.some(pattern =>
      haystack.includes(pattern.toLowerCase())
    )

    if (coverLetterMatch) {
      return {
        element: input,
        type: 'coverLetter',
        confidence: 0.9
      }
    }

    // Check for resume/CV patterns
    const resumeMatch = FILE_INPUT_PATTERNS.resume.some(pattern =>
      haystack.includes(pattern.toLowerCase())
    )

    if (resumeMatch) {
      return {
        element: input,
        type: 'resume',
        confidence: 0.85
      }
    }

    // Check accept attribute for PDF
    const acceptAttr = (input.accept || '').toLowerCase()
    if (acceptAttr.includes('.pdf') || acceptAttr.includes('application/pdf')) {
      return {
        element: input,
        type: 'unknown',
        confidence: 0.6
      }
    }

    return {
      element: input,
      type: 'unknown',
      confidence: 0.3
    }
  }

  /**
   * Find file input fields for resume/CV upload
   */
  findResumeFileInputs(): HTMLInputElement[] {
    const allInputs = this.findAllFileInputs()
    return allInputs
      .map(input => this.classifyFileInput(input))
      .filter(info => info.type === 'resume' || (info.type === 'unknown' && info.confidence >= 0.6))
      .map(info => info.element)
  }

  /**
   * Find file input fields for cover letter upload
   */
  findCoverLetterInputs(): HTMLInputElement[] {
    const allInputs = this.findAllFileInputs()
    return allInputs
      .map(input => this.classifyFileInput(input))
      .filter(info => info.type === 'coverLetter')
      .map(info => info.element)
  }

  /**
   * Get file input statistics
   */
  getFileInputStats(): { resume: number; coverLetter: number; total: number } {
    const allInputs = this.findAllFileInputs()
    const classified = allInputs.map(input => this.classifyFileInput(input))

    return {
      resume: classified.filter(i => i.type === 'resume' || (i.type === 'unknown' && i.confidence >= 0.6)).length,
      coverLetter: classified.filter(i => i.type === 'coverLetter').length,
      total: allInputs.length
    }
  }

  /**
   * Upload PDF blob to a single file input
   */
  async uploadPDFToInput(
    fileInput: HTMLInputElement,
    pdfBlob: Blob,
    filename: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if input accepts PDF files
      const acceptAttr = (fileInput.accept || '').toLowerCase()
      if (acceptAttr && !acceptAttr.includes('.pdf') && !acceptAttr.includes('application/pdf')) {
        return {
          success: false,
          error: 'Input does not accept PDF files'
        }
      }

      // Create File from Blob
      const file = new File([pdfBlob], filename, { type: 'application/pdf' })

      // Create DataTransfer object to set files
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)
      fileInput.files = dataTransfer.files

      // Trigger change events
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))
      fileInput.dispatchEvent(new Event('input', { bubbles: true }))

      // Special handling for LinkedIn Easy Apply
      // LinkedIn uses React and may need additional event handling
      if (fileInput.getAttribute('data-testid') || window.location.hostname.includes('linkedin.com')) {
        // Try to trigger React's onChange handler
        const reactEvent = new Event('change', { bubbles: true })
        Object.defineProperty(reactEvent, 'target', {
          writable: false,
          value: fileInput
        })
        fileInput.dispatchEvent(reactEvent)
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Upload CV PDF to all resume file inputs
   */
  async uploadCVToAllInputs(cvPdfBlob: Blob, filename: string): Promise<{
    uploaded: number
    errors: string[]
  }> {
    const resumeInputs = this.findResumeFileInputs()
    const errors: string[] = []
    let uploaded = 0

    for (const input of resumeInputs) {
      const result = await this.uploadPDFToInput(input, cvPdfBlob, filename)
      if (result.success) {
        uploaded++
        console.log(`[FileUploader] ✓ Uploaded CV to:`, input.id || input.name || input.className)
      } else {
        const error = `Failed to upload to ${input.id || input.name || 'unknown'}: ${result.error}`
        errors.push(error)
        console.error(`[FileUploader] ✗`, error)
      }
    }

    return { uploaded, errors }
  }

  /**
   * Upload Cover Letter PDF to all cover letter inputs
   */
  async uploadCoverLetterToAllInputs(coverLetterPdfBlob: Blob, filename: string): Promise<{
    uploaded: number
    errors: string[]
  }> {
    const coverLetterInputs = this.findCoverLetterInputs()
    const errors: string[] = []
    let uploaded = 0

    for (const input of coverLetterInputs) {
      const result = await this.uploadPDFToInput(input, coverLetterPdfBlob, filename)
      if (result.success) {
        uploaded++
        console.log(`[FileUploader] ✓ Uploaded Cover Letter to:`, input.id || input.name || input.className)
      } else {
        const error = `Failed to upload to ${input.id || input.name || 'unknown'}: ${result.error}`
        errors.push(error)
        console.error(`[FileUploader] ✗`, error)
      }
    }

    return { uploaded, errors }
  }

  /**
   * Auto-detect and upload CV and Cover Letter PDFs
   *
   * @param cvPdfBlob - CV PDF blob
   * @param cvFilename - CV filename
   * @param coverLetterPdfBlob - Optional cover letter PDF blob
   * @param coverLetterFilename - Optional cover letter filename
   * @returns Upload result with statistics
   */
  async autoUploadCV(
    cvPdfBlob: Blob,
    cvFilename: string,
    coverLetterPdfBlob?: Blob,
    coverLetterFilename?: string
  ): Promise<FileUploadResult> {
    console.log('[FileUploader] Starting auto-upload...')

    const stats = this.getFileInputStats()
    console.log(`[FileUploader] Found ${stats.resume} CV inputs, ${stats.coverLetter} cover letter inputs`)

    const result: FileUploadResult = {
      cvUploaded: false,
      coverLetterUploaded: false,
      cvInputs: stats.resume,
      coverLetterInputs: stats.coverLetter,
      cvErrors: [],
      coverLetterErrors: []
    }

    // Upload CV
    if (stats.resume > 0) {
      const cvResult = await this.uploadCVToAllInputs(cvPdfBlob, cvFilename)
      result.cvUploaded = cvResult.uploaded > 0
      result.cvErrors = cvResult.errors
      console.log(`[FileUploader] CV upload: ${cvResult.uploaded}/${stats.resume} successful`)
    }

    // Upload Cover Letter (if provided and inputs exist)
    if (stats.coverLetter > 0 && coverLetterPdfBlob && coverLetterFilename) {
      const clResult = await this.uploadCoverLetterToAllInputs(coverLetterPdfBlob, coverLetterFilename)
      result.coverLetterUploaded = clResult.uploaded > 0
      result.coverLetterErrors = clResult.errors
      console.log(`[FileUploader] Cover Letter upload: ${clResult.uploaded}/${stats.coverLetter} successful`)
    } else if (stats.coverLetter > 0 && !coverLetterPdfBlob) {
      console.warn('[FileUploader] Cover letter inputs detected but no cover letter PDF provided')
    }

    return result
  }

  /**
   * Scan page for file inputs and return info
   * Useful for UI to show available upload options
   */
  scanFileInputs(): {
    resumeInputs: number
    coverLetterInputs: number
    details: Array<{ id: string; name: string; type: string }>
  } {
    const allInputs = this.findAllFileInputs()
    const classified = allInputs.map(input => this.classifyFileInput(input))

    return {
      resumeInputs: classified.filter(i => i.type === 'resume' || (i.type === 'unknown' && i.confidence >= 0.6)).length,
      coverLetterInputs: classified.filter(i => i.type === 'coverLetter').length,
      details: classified.map(i => ({
        id: i.element.id || '',
        name: i.element.name || '',
        type: i.type
      }))
    }
  }
}

// ============================================
// Utility: Singleton instance
// ============================================

let fileUploaderInstance: FileUploader | null = null

/**
 * Get or create FileUploader singleton instance
 */
export function getFileUploader(): FileUploader {
  if (!fileUploaderInstance) {
    fileUploaderInstance = new FileUploader()
  }
  return fileUploaderInstance
}

/**
 * Quick scan for file inputs (for popup UI)
 */
export function quickScanFileInputs(): {
  resumeInputs: number
  coverLetterInputs: number
  total: number
} {
  const uploader = getFileUploader()
  const stats = uploader.getFileInputStats()
  // Transform stats to match expected return type
  return {
    resumeInputs: stats.resume,
    coverLetterInputs: stats.coverLetter,
    total: stats.total
  }
}

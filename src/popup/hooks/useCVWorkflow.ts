/**
 * React Hook for CV Workflow
 *
 * Provides easy access to CV generation and upload functionality
 * from popup components
 */

import { useState, useCallback } from 'react'
import { getCVData } from '../../utils/storageHelpers'
import { generatePDFWithDirectCDP, getPDFSize } from '../../utils/directCDP'

export interface CVWorkflowState {
  loading: boolean
  success: boolean
  error: string | null
  progress: string
  stagesCompleted: string[]
  pdfBlob?: Blob
  pdfSize?: string
  uploadStats?: {
    uploaded: number
    errors: string[]
  }
}

export interface UseCVWorkflowReturn {
  state: CVWorkflowState
  generateAndDownloadCV: (filename?: string) => Promise<void>
  generateAndUploadCV: (filename?: string) => Promise<void>
  checkCVData: () => Promise<boolean>
  resetState: () => void
}

export function useCVWorkflow(): UseCVWorkflowReturn {
  const [state, setState] = useState<CVWorkflowState>({
    loading: false,
    success: false,
    error: null,
    progress: '',
    stagesCompleted: []
  })

  const resetState = useCallback(() => {
    setState({
      loading: false,
      success: false,
      error: null,
      progress: '',
      stagesCompleted: []
    })
  }, [])

  const generateAndDownloadCV = useCallback(async (filename = 'cv.pdf') => {
    setState({
      loading: true,
      success: false,
      error: null,
      progress: 'Fetching CV data...',
      stagesCompleted: []
    })

    try {
      const cvData = await getCVData()
      if (!cvData) throw new Error('No CV data found')

      setState(prev => ({ ...prev, progress: 'Generating PDF...', stagesCompleted: ['storage'] }))

      // Generate PDF using Direct CDP (chrome.debugger)
      const compileResult = await generatePDFWithDirectCDP(cvData as any, { filename })

      if (!compileResult.success || !compileResult.pdfBlob) {
        throw new Error(compileResult.error || 'Failed to compile PDF')
      }

      const pdfSizeStr = getPDFSize(compileResult.pdfBlob)

      setState({
        loading: false,
        success: true,
        error: null,
        progress: 'CV generated successfully!',
        stagesCompleted: ['storage', 'pdf'],
        pdfSize: pdfSizeStr,
        pdfBlob: compileResult.pdfBlob
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setState(prev => ({
        ...prev,
        loading: false,
        success: false,
        error: errorMessage,
        progress: `Error: ${errorMessage}`
      }))
    }
  }, [])

  const generateAndUploadCV = useCallback(async (filename = 'cv.pdf') => {
    setState({
      loading: true,
      success: false,
      error: null,
      progress: 'Starting CV generation...',
      stagesCompleted: []
    })

    try {
      const cvData = await getCVData()
      if (!cvData) throw new Error('No CV data found')

      setState(prev => ({ ...prev, progress: 'Generating PDF...', stagesCompleted: ['storage'] }))

      // Generate PDF using Direct CDP (chrome.debugger)
      const compileResult = await generatePDFWithDirectCDP(cvData as any, { filename })

      if (!compileResult.success || !compileResult.pdfBlob) {
        throw new Error(compileResult.error || 'Failed to compile PDF')
      }

      const pdfSizeStr = getPDFSize(compileResult.pdfBlob)
      setState(prev => ({ ...prev, progress: 'Uploading PDF...', stagesCompleted: ['storage', 'pdf'] }))

      // Send to content script for upload
      let uploadStats = { uploaded: 0, errors: [] as string[] }

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tab?.id) {
          // We need to convert blob to base64 to send it via messaging
          const reader = new FileReader()
          const base64Promise = new Promise<string>((resolve) => {
            reader.onloadend = () => {
              const base64data = (reader.result as string).split(',')[1]
              resolve(base64data)
            }
          })
          reader.readAsDataURL(compileResult.pdfBlob)
          const base64pdf = await base64Promise

          const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'uploadCV',
            pdfBase64: base64pdf,
            filename
          })

          if (response?.success) {
            uploadStats = response.stats
          } else {
            uploadStats.errors.push(response?.error || 'Content script upload failed')
          }
        } else {
          uploadStats.errors.push('No active tab found')
        }
      } catch (uploadError) {
        console.error('Upload message error:', uploadError)
        uploadStats.errors.push('Could not connect to page to upload. Ensure you are on a compatible page.')
      }

      setState({
        loading: false,
        success: true,
        error: null,
        progress: 'CV generated and upload initiated!',
        stagesCompleted: ['storage', 'pdf', 'upload'],
        pdfSize: pdfSizeStr,
        uploadStats,
        pdfBlob: compileResult.pdfBlob
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setState(prev => ({
        ...prev,
        loading: false,
        success: false,
        error: errorMessage,
        progress: `Error: ${errorMessage}`
      }))
    }
  }, [])

  const checkCVData = useCallback(async (): Promise<boolean> => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'checkCVData'
      })

      return response?.canExecute || false
    } catch (error) {
      console.error('Failed to check CV data:', error)
      return false
    }
  }, [])

  return {
    state,
    generateAndDownloadCV,
    generateAndUploadCV,
    checkCVData,
    resetState
  }
}

// ============================================
// Utility Hook: CV Data Status
// ============================================

export function useCVDataStatus() {
  const [hasCVData, setHasCVData] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)

  const checkStatus = useCallback(async () => {
    setChecking(true)
    try {
      // First try via runtime message (for popup)
      const response = await chrome.runtime.sendMessage({
        action: 'checkCVData'
      })

      if (response?.canExecute !== undefined) {
        setHasCVData(response.canExecute)
        return
      }
    } catch (error) {
      console.log('Runtime message failed, checking storage directly:', error)
    }

    // Fallback: Check storage directly (works in Options page)
    try {
      const cvData = await getCVData()
      const hasData = cvData && typeof cvData === 'object' && (
        cvData.personal?.firstName ||
        cvData.personal?.lastName ||
        cvData.personal?.email
      )
      setHasCVData(hasData)
    } catch (error) {
      console.error('Failed to check CV status from storage:', error)
      setHasCVData(false)
    } finally {
      setChecking(false)
    }
  }, [])

  return {
    hasCVData,
    checking,
    checkStatus
  }
}

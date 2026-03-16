/**
 * React Hook for CV Workflow
 *
 * Provides easy access to CV generation and upload functionality
 * from popup components
 */

import { useState, useCallback } from 'react'
import { getCVData } from '../../utils/storageHelpers'

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
      progress: 'Starting CV generation...',
      stagesCompleted: []
    })

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'generateCV',
        filename
      })

      console.log('[useCVWorkflow] Received response:', response)

      if (!response) {
        throw new Error('No response from background script')
      }

      if (response.success) {
        console.log('[useCVWorkflow] Response successful, pdfBase64:', response.pdfBase64 ? 'exists' : 'MISSING')

        // Convert base64 back to Blob for preview
        let pdfBlob: Blob | undefined
        if (response.pdfBase64) {
          const binaryString = atob(response.pdfBase64)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          pdfBlob = new Blob([bytes], { type: 'application/pdf' })
          console.log('[useCVWorkflow] Created blob from base64, size:', pdfBlob.size)
        } else {
          console.error('[useCVWorkflow] No pdfBase64 in response!')
        }

        setState({
          loading: false,
          success: true,
          error: null,
          progress: 'CV generated and downloaded!',
          stagesCompleted: response.stagesCompleted || [],
          pdfSize: response.pdfSize,
          pdfBlob
        })
      } else {
        throw new Error(response.error || 'Failed to generate CV')
      }
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
      progress: 'Starting CV generation and upload...',
      stagesCompleted: []
    })

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'generateAndUploadCV',
        filename
      })

      if (!response) {
        throw new Error('No response from background script')
      }

      if (response.success) {
        // Convert base64 back to Blob for preview
        let pdfBlob: Blob | undefined
        if (response.pdfBase64) {
          const binaryString = atob(response.pdfBase64)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          pdfBlob = new Blob([bytes], { type: 'application/pdf' })
        }

        setState({
          loading: false,
          success: true,
          error: null,
          progress: 'CV generated and uploaded!',
          stagesCompleted: response.stagesCompleted || [],
          pdfSize: response.pdfSize,
          uploadStats: response.uploadStats,
          pdfBlob
        })
      } else {
        throw new Error(response.error || 'Failed to generate/upload CV')
      }
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

import { useState, useEffect } from 'react'

interface FieldProgress {
  fieldName: string
  label: string
  status: 'filled' | 'failed' | 'pending'
}

interface DetectedField {
  id: string
  name: string
  type: string
  label: string
  placeholder?: string
  options?: string[]
}

export const useFormFiller = () => {
  const [isFilling, setIsFilling] = useState(false)
  const [status, setStatus] = useState('')
  const [fieldProgress, setFieldProgress] = useState<FieldProgress[]>([])
  const [detectedFields, setDetectedFields] = useState<DetectedField[]>([])

  useEffect(() => {
    // 🎯 Clear any previous progress when component mounts
    setFieldProgress([])
    setDetectedFields([]) // Also clear detected fields

    // 🎯 Listen for progress updates from background script
    const handleMessage = (message: any) => {
      if (message.action === 'formFillProgressUpdate' && message.field) {
        setFieldProgress(prev => {
          const exists = prev.find(f => f.fieldName === message.field.fieldName)
          if (exists) {
            return prev.map(f =>
              f.fieldName === message.field.fieldName
                ? { ...f, status: message.field.status }
                : f
            )
          }
          return [...prev, {
            fieldName: message.field.fieldName,
            label: message.field.label,
            status: message.field.status
          }]
        })
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [])

  const handleFillForm = async () => {
    setIsFilling(true)
    setStatus('🔍 Detecting fields...')
    setFieldProgress([]) // Reset progress

    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab || !tab.id) {
        throw new Error('No active tab found')
      }

      console.log('[useFormFiller] Target tab:', tab.url)
      console.log('[useFormFiller] Tab ID:', tab.id)

      // Step 1: Extract raw fields from page (token-efficient)
      setStatus('🔍 Scanning form fields...')
      const extractResponse = await chrome.tabs.sendMessage(tab.id, {
        action: 'extractFormFields'
      })

      if (!extractResponse?.success || !extractResponse.fields) {
        throw new Error(extractResponse?.error || 'Failed to extract fields')
      }

      console.log('[useFormFiller] Extracted fields:', extractResponse.totalFields)

      console.log('[useFormFiller] Extracted fields all data:', extractResponse)
      // Step 2: Show detected fields to user
      setDetectedFields(extractResponse.fields)
      setStatus(`✓ Found ${extractResponse.totalFields} fields. Mapping with AI...`)

      // Step 3: Map fields with AI (smart analysis)
      const mapResponse = await chrome.runtime.sendMessage({
        action: 'mapFieldsWithAI',
        rawFields: extractResponse.fields
      })

      if (!mapResponse?.success) {
        throw new Error(mapResponse?.error || 'Failed to map fields with AI')
      }

      console.log('[useFormFiller] AI mapped fields:', mapResponse.mappedFields)

      // Step 4: Create progress list from AI mappings
      const progressList: FieldProgress[] = mapResponse.mappings.map((mapping: any) => ({
        fieldName: mapping.fieldId,
        label: mapping.detectedAs,
        status: 'pending' as const
      }))

      setFieldProgress(progressList)
      setStatus(`Filling ${progressList.length} fields...`)

      // Step 5: Send fill request with AI mappings
      const fillResponse = await chrome.tabs.sendMessage(tab.id, {
        action: 'fillFormWithMappings',
        mappings: mapResponse.mappings
      })

      if (fillResponse?.success) {
        setStatus(`✓ Successfully filled ${fillResponse.filledCount} fields!`)

        // 🎯 Auto-hide progress after 5 seconds (increased from 3)
        setTimeout(() => {
          setFieldProgress([])
          setDetectedFields([])
        }, 5000)
      } else {
        throw new Error(fillResponse?.error || 'Failed to fill form')
      }
    } catch (error) {
      console.error('[useFormFiller] Error:', error)
      setStatus('Error: ' + String(error))

      // Clear fields on error
      setTimeout(() => {
        setFieldProgress([])
        setDetectedFields([])
      }, 3000)
    } finally {
      setIsFilling(false)
    }
  }

  return {
    isFilling,
    status,
    fieldProgress,
    detectedFields,
    handleFillForm,
  }
}

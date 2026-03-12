import { useState } from 'react'
import { optimizedBatchMap, RawDetectedField } from '../../utils/optimizedFieldMapper'

interface FieldProgress {
  fieldName: string
  label: string
  status: 'filled' | 'failed' | 'pending'
}

export const useFormFiller = () => {
  const [isFilling, setIsFilling] = useState(false)
  const [status, setStatus] = useState('')
  const [fieldProgress, setFieldProgress] = useState<FieldProgress[]>([])
  const [detectedFields, setDetectedFields] = useState<RawDetectedField[]>([])

  /**
   * Step 1: Just detect fields (no AI, no fill yet)
   */
  const handleDetectFields = async () => {
    setIsFilling(true)
    setStatus('Scanning page fields...')
    setDetectedFields([])
    setFieldProgress([])

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab.id) { setStatus('No active tab found'); return }

      // Ping content script
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'ping' })
      } catch {
        setStatus('Please refresh the page to use this extension.')
        return
      }

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'detectFields' })

      if (response?.fields?.length > 0) {
        setDetectedFields(response.fields)
        setStatus(`Found ${response.fields.length} fields on this page ✓`)
      } else {
        setStatus('No fillable fields found on this page.')
      }
    } catch (error: any) {
      if (error.message?.includes('Receiving end does not exist')) {
        setStatus('Please refresh the page to use this extension.')
      } else {
        setStatus('Error scanning page: ' + String(error))
      }
    } finally {
      setIsFilling(false)
    }
  }

  /**
   * Step 2: Optimized fill — ONE AI call for ALL fields
   */
  const handleFillForm = async () => {
    setIsFilling(true)
    setStatus('Loading your CV data...')
    setFieldProgress([])

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab.id) { setStatus('No active tab found'); return }

      // 1. Load CV from storage
      const storageData = await chrome.storage.local.get(['parsedCV'])
      const cvData = storageData.parsedCV
      if (!cvData) {
        setStatus('No CV data found. Please upload your CV in the Options page first.')
        return
      }

      // 2. Detect fields if not already done
      let fields = detectedFields
      if (fields.length === 0) {
        setStatus('Scanning fields...')
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'detectFields' })
        if (!response?.fields?.length) {
          setStatus('No fillable fields found on this page.')
          return
        }
        fields = response.fields
        setDetectedFields(fields)
      }

      // Set all fields to pending in UI
      setFieldProgress(fields.map(f => ({
        fieldName: f.id || f.name,
        label: f.placeholder || f.name || f.id,
        status: 'pending'
      })))

      // 3. Single AI call — gets mappings for ALL fields at once
      setStatus(`Mapping ${fields.length} fields with AI (1 request)...`)

      const getAIResponse = async (prompt: string) => {
        const response = await chrome.runtime.sendMessage({ action: 'askAI', prompt })
        return response?.data
      }

      const mappings = await optimizedBatchMap(fields, cvData, getAIResponse)

      if (mappings.length === 0) {
        setStatus('AI could not map any fields. Check your CV data.')
        return
      }

      setStatus(`Filling ${mappings.length} fields...`)

      // 4. Send fill command to content script
      const fillResponse = await chrome.tabs.sendMessage(tab.id, {
        action: 'fillFormWithMappings',
        mappings: mappings.map(m => ({
          fieldId: m.id,
          fieldName: m.name,
          detectedAs: m.id || m.name,
          valueToFill: m.value
        }))
      })

      // 5. Update progress UI
      const successIds = new Set(fillResponse?.results?.success || [])
      const failedIds = new Set(fillResponse?.results?.failed || [])

      setFieldProgress(fields.map(f => {
        const identifier = f.id || f.name
        return {
          fieldName: identifier,
          label: f.placeholder || f.name || f.id,
          status: successIds.has(identifier) ? 'filled'
            : failedIds.has(identifier) ? 'failed'
              : 'pending'
        }
      }))

      const filled = fillResponse?.filledCount ?? mappings.length
      const total = fields.length
      setStatus(`✅ Filled ${filled} of ${total} fields`)

    } catch (error: any) {
      console.error('[useFormFiller]', error)
      if (error.message?.includes('Receiving end does not exist')) {
        setStatus('Please refresh the page to use this extension.')
      } else {
        setStatus('Error: ' + String(error))
      }
    } finally {
      setIsFilling(false)
    }
  }

  return {
    isFilling,
    status,
    fieldProgress,
    detectedFields,
    handleDetectFields,
    handleFillForm,
  }
}

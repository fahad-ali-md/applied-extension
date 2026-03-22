/**
 * Message Handlers
 *
 * Handles all Chrome runtime messages from popup/background
 */

import { FormFiller } from '../core/FormFiller'
import { FieldDetector } from '../core/FieldDetector'
// import { fieldVisualizer } from '../core/FieldVisualizer' // DISABLED: Prevents visual clutter on webpages
import { calculateFieldPriority } from '../utils/formHelpers'
import { any, success } from 'zod'

// Inject FieldVisualizer CSS
// DISABLED: Prevents visual clutter on webpages
/*
const injectFieldVisualizerCSS = () => {
  if (document.getElementById('field-visualizer-css')) return

  const link = document.createElement('link')
  link.id = 'field-visualizer-css'
  link.rel = 'stylesheet'
  link.href = chrome.runtime.getURL('contentScript/core/FieldVisualizer.css')
  document.head.appendChild(link)
}
*/

// Type for RawField from formFieldExtractorV2 (has shortened properties)
interface RawField {
  i: string      // id
  n: string      // name
  t: string      // type
  l: string      // label
  p: string      // placeholder
  o?: string[]   // options
}

// Extended field type with priority for UI display
interface FieldWithPriority extends RawField {
  priority: 'high' | 'medium' | 'low'
}

const formFiller = new FormFiller()

export function setupMessageHandlers(): void {
  // Inject visualizer CSS on setup
  // injectFieldVisualizerCSS() // DISABLED: Prevents visual clutter on webpages

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Ping handler
    if (request.action === 'ping') {
      sendResponse({ success: true, message: 'pong' })
      return
    }

    // Fill form with AI
    if (request.action === 'fillForm') {
      handleFillForm(request, sendResponse)
      return true
    }

    // Fill form with mappings
    if (request.action === 'fillFormWithMappings') {
      handleFillFormWithMappings(request, sendResponse)
      return true
    }

    // Extract form fields
    if (request.action === 'extractFormFields') {
      handleExtractFormFields(request, sendResponse)
      return true
    }

    // Extract form fields with Toon format
    if (request.action === 'extractFormFieldsWithToon') {
      handleExtractFormFieldsWithToon(request, sendResponse)
      return true
    }

    // Smart auto-fill
    if (request.action === 'smartAutoFill') {
      handleSmartAutoFill(request, sendResponse)
      return true
    }

    // Analyze form
    if (request.action === 'analyzeForm') {
      handleAnalyzeForm(request, sendResponse)
      return true
    }

    // Scan job description
    if (request.action === 'scanJobDescription') {
      handleScanJobDescription(sendResponse)
      return true  // Return true for async response
    }

    // Detect fields
    if (request.action === 'detectFields') {
      handleDetectFields(sendResponse)
      return
    }

    // Upload CV
    if (request.action === 'uploadCV') {
      handleUploadCV(request, sendResponse)
      return true
    }
  })
}

/**
 * Handle uploadCV message
 */
function handleUploadCV(request: any, sendResponse: (response?: any) => void): void {
  import('../core/FileUploader').then(({ getFileUploader }) => {
    try {
      const uploader = getFileUploader()

      if (!request.pdfBase64) {
        throw new Error('No PDF data provided')
      }

      const binaryString = atob(request.pdfBase64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: 'application/pdf' })

      uploader.uploadCVToAllInputs(blob, request.filename || 'cv.pdf')
        .then(stats => {
          sendResponse({ success: true, stats })
        })
        .catch((err: Error) => {
          sendResponse({ success: false, error: err.message })
        })
    } catch (err: any) {
      sendResponse({ success: false, error: err.message })
    }
  }).catch((err: Error) => {
    sendResponse({ success: false, error: `Failed to load FileUploader: ${err.message}` })
  })
}

/**
 * Handle fillForm message
 */
function handleFillForm(request: any, sendResponse: (response?: any) => void): void {
  const getAIResponse = async (prompt: string) => {
    const response = await chrome.runtime.sendMessage({
      action: 'askAI',
      prompt
    })
    return response?.data
  }

  const onProgress = (fieldName: string, status: 'filled' | 'failed' | 'pending', label: string) => {
    chrome.runtime.sendMessage({
      action: 'formFillProgress',
      field: { fieldName, status, label }
    }).catch(err => console.log('[Progress] Failed to send:', err))
  }

  formFiller.fillForm(request.data, getAIResponse, onProgress)
    .then(result => {
      sendResponse({ success: true, result })
    })
    .catch((error: Error) => {
      console.error('[ContentScript] fillForm error:', error)
      sendResponse({ success: false, error: error.message })
    })
}

/**
 * Handle fillFormWithMappings message
 */
function handleFillFormWithMappings(request: any, sendResponse: (response?: any) => void): void {
  console.log('[ContentScript] fillFormWithMappings - Starting async operation')

    ; (async () => {
      const { mappings } = request
      console.log('[ContentScript] Filling form with AI mappings:', mappings.length)

      // Show visual indicators on all detected fields
      // DISABLED: Prevents visual clutter on webpages
      /*
      const fieldsToShow = mappings.map((m: any) => ({
        id: m.fieldId,
        name: m.fieldName,
        label: m.detectedAs
      }))
      fieldVisualizer.showFieldIndicators(fieldsToShow)
      fieldVisualizer.showProgressCounter(mappings.length)
      */

      let filledCount = 0
      let failedCount = 0
      const results: { success: string[]; failed: string[] } = {
        success: [],
        failed: []
      }

      const sendProgress = (fieldName: string, status: 'filled' | 'failed' | 'pending', label: string) => {
        chrome.runtime.sendMessage({
          action: 'formFillProgressUpdate',
          field: { fieldName, status, label }
        }).catch(err => console.log('[Progress] Failed to send:', err))

        // Update on-page visual
        // DISABLED: Prevents visual clutter on webpages
        // fieldVisualizer.updateFieldStatus(fieldName, fieldName, status)

        // Update progress counter
        if (status === 'filled' || status === 'failed') {
          const total = filledCount + failedCount + 1
          // fieldVisualizer.updateProgress(filledCount, mappings.length)
        }
      }

      for (const mapping of mappings) {
        const { fieldId, fieldName, detectedAs, valueToFill } = mapping

        sendProgress(fieldId, 'pending', detectedAs)

        if (!valueToFill) {
          console.log(`[ContentScript] Skipping ${detectedAs} (no value)`)
          sendProgress(fieldId, 'failed', detectedAs)
          results.failed.push(fieldId)
          failedCount++
          continue
        }

        try {
          let element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null = null

          if (fieldId) {
            element = document.getElementById(fieldId) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
          }

          if (!element && fieldName) {
            element = document.querySelector(`[name="${fieldName}"]`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
          }

          if (!element) {
            console.warn(`[ContentScript] Element not found: ${fieldId || fieldName}`)
            sendProgress(fieldId, 'failed', detectedAs)
            results.failed.push(fieldId)
            failedCount++
            continue
          }

          if (element.tagName === 'SELECT') {
            // ── SELECT dropdown ──────────────────────
            const selectElement = element as HTMLSelectElement
            const options = Array.from(selectElement.options)

            const matchedOption = options.find(opt =>
              opt.value.toLowerCase() === valueToFill.toLowerCase() ||
              opt.text.toLowerCase() === valueToFill.toLowerCase() ||
              opt.text.toLowerCase().includes(valueToFill.toLowerCase())
            )

            if (matchedOption) {
              selectElement.value = matchedOption.value
              selectElement.dispatchEvent(new Event('change', { bubbles: true }))
              console.log(`[ContentScript] ✓ Filled SELECT ${detectedAs}: ${valueToFill}`)
              sendProgress(fieldId, 'filled', detectedAs)
              results.success.push(fieldId)
              filledCount++
            } else {
              console.warn(`[ContentScript] No matching option for ${detectedAs}: ${valueToFill}`)
              sendProgress(fieldId, 'failed', detectedAs)
              results.failed.push(fieldId)
              failedCount++
            }

          } else if (element.getAttribute('type') === 'radio' || (element as HTMLInputElement).type === 'radio') {
            // ── RADIO group ──────────────────────────
            // Find all radios with same name, click the matching one
            const radioName = element.getAttribute('name') || fieldName
            const allRadios = Array.from(
              document.querySelectorAll(`input[type="radio"][name="${radioName}"]`)
            ) as HTMLInputElement[]

            const target = allRadios.find(r =>
              r.value.toLowerCase() === valueToFill.toLowerCase() ||
              (r.labels?.[0]?.textContent?.trim().toLowerCase() === valueToFill.toLowerCase())
            ) || allRadios.find(r =>
              r.value.toLowerCase().includes(valueToFill.toLowerCase()) ||
              valueToFill.toLowerCase().includes(r.value.toLowerCase())
            )

            if (target) {
              target.click()
              target.dispatchEvent(new Event('change', { bubbles: true }))
              console.log(`[ContentScript] ✓ Clicked RADIO ${detectedAs}: ${target.value}`)
              sendProgress(fieldId, 'filled', detectedAs)
              results.success.push(fieldId)
              filledCount++
            } else {
              console.warn(`[ContentScript] No matching radio for ${detectedAs}: ${valueToFill}`)
              sendProgress(fieldId, 'failed', detectedAs)
              results.failed.push(fieldId)
              failedCount++
            }

          } else if ((element as HTMLInputElement).type === 'checkbox') {
            // ── CHECKBOX ────────────────────────────
            const cb = element as HTMLInputElement
            const shouldCheck = valueToFill.toLowerCase() === 'true' || valueToFill === '1'
            if (cb.checked !== shouldCheck) {
              cb.click()
              cb.dispatchEvent(new Event('change', { bubbles: true }))
            }
            console.log(`[ContentScript] ✓ Checkbox ${detectedAs}: ${shouldCheck}`)
            sendProgress(fieldId, 'filled', detectedAs)
            results.success.push(fieldId)
            filledCount++

          } else {
            // ── TEXT / TEXTAREA / EMAIL / etc ────────
            const inputElement = element as HTMLInputElement | HTMLTextAreaElement

            // React compatibility: use native setter to trigger onChange
            const nativeSetter = Object.getOwnPropertyDescriptor(
              inputElement instanceof HTMLTextAreaElement
                ? HTMLTextAreaElement.prototype
                : HTMLInputElement.prototype,
              'value'
            )?.set
            if (nativeSetter) {
              nativeSetter.call(inputElement, valueToFill)
            } else {
              inputElement.value = valueToFill
            }

            inputElement.dispatchEvent(new Event('input', { bubbles: true }))
            inputElement.dispatchEvent(new Event('change', { bubbles: true }))
            inputElement.dispatchEvent(new Event('blur', { bubbles: true }))

            console.log(`[ContentScript] ✓ Filled ${detectedAs}: ${valueToFill}`)
            sendProgress(fieldId, 'filled', detectedAs)
            results.success.push(fieldId)
            filledCount++
          }

          await new Promise(resolve => setTimeout(resolve, 80))

        } catch (error) {
          console.error(`[ContentScript] Error filling ${detectedAs}:`, error)
          sendProgress(fieldId, 'failed', detectedAs)
          results.failed.push(fieldId)
          failedCount++
        }
      }

      console.log(`[ContentScript] Fill complete: ${filledCount} filled, ${failedCount} failed`)
      sendResponse({
        success: true,
        filledCount,
        failedCount,
        results
      })
    })().catch((error: Error) => {
      console.error('[ContentScript] fillFormWithMappings error:', error)
      sendResponse({ success: false, error: error.message })
    })
}

/**
 * Handle extractFormFields message
 */
function handleExtractFormFields(request: any, sendResponse: (response?: any) => void): void {
  import('../utils/formFieldExtractorV2').then(({ extractAllFieldsRaw }) => {
    const cvData = request.cvData
    const extracted = extractAllFieldsRaw()

    const fieldsWithPriority: FieldWithPriority[] = extracted.fields.map(field => ({
      ...field,
      priority: calculateFieldPriority(field, cvData),
      // Override label (l) with fallback logic using shortened property names
      l: field.l || field.p || field.n || field.i || 'Unknown'
    }))

    const highPriorityFields = fieldsWithPriority.filter(f => f.priority === 'high').length
    const estimatedFillable = highPriorityFields

    const pageInfo = {
      url: extracted.metadata.url,
      pageTitle: extracted.metadata.pageTitle,
      formType: extracted.metadata.formType,
      detectedATS: extracted.metadata.detectedATS
    }

    sendResponse({
      success: true,
      ...pageInfo,
      totalFields: extracted.totalFields,
      highPriorityFields,
      estimatedFillable,
      fields: fieldsWithPriority
    })
  }).catch(error => {
    console.error('Failed to extract form fields:', error)
    sendResponse({
      success: false,
      error: error.message,
      fields: [],
      totalFields: 0
    })
  })
}

/**
 * Handle extractFormFieldsWithToon message
 */
function handleExtractFormFieldsWithToon(request: any, sendResponse: (response?: any) => void): void {
  Promise.all([
    import('../utils/formFieldExtractorV2'),
    import('../../utils/toonFormatter')
  ]).then(([{ extractAllFieldsRaw }, { convertToToonFields, encodeToon }]) => {
    const extracted = extractAllFieldsRaw()

    const fieldsWithPriority: FieldWithPriority[] = extracted.fields.map(field => ({
      ...field,
      priority: 'high',
      // Override label (l) with fallback logic using shortened property names
      l: field.l || field.p || field.n || field.i || 'Unknown'
    }))

    const toonFields = convertToToonFields({ fields: fieldsWithPriority, metadata: extracted.metadata })
    // Convert detectedATS from boolean to string[] for toonFormatter compatibility
    const toonMetadata = {
      ...extracted.metadata,
      detectedATS: extracted.metadata.detectedATS ? ['ATS Detected'] : []
    }
    const toonFormat = encodeToon({ fields: toonFields, metadata: toonMetadata })

    const highPriorityFields = fieldsWithPriority.filter(f => f.priority === 'high').length

    // Convert detectedATS from boolean to string[] format for compatibility
    const detectedATSList = extracted.metadata.detectedATS ? ['ATS Detected'] : []

    sendResponse({
      success: true,
      url: extracted.metadata.url,
      pageTitle: extracted.metadata.pageTitle,
      formType: extracted.metadata.formType,
      detectedATS: detectedATSList,
      totalFields: extracted.totalFields,
      highPriorityFields,
      estimatedFillable: highPriorityFields,
      fields: fieldsWithPriority,
      toonFormat
    })
  }).catch(error => {
    console.error('Failed to extract form fields with Toon:', error)
    sendResponse({
      success: false,
      error: error.message,
      fields: [],
      totalFields: 0
    })
  })
}

/**
 * Handle smartAutoFill message
 */
function handleSmartAutoFill(request: any, sendResponse: (response?: any) => void): void {
  import('../../utils/smartFormHandler').then(({ smartAutoFill }) => {
    const getAIResponse = async (prompt: string) => {
      const response = await chrome.runtime.sendMessage({
        action: 'askAI',
        prompt
      })
      return response?.data
    }

    // Execute async smart fill and handle response
    smartAutoFill(
      request.cvData,
      getAIResponse,
      {
        autoSubmit: request.autoSubmit || false,
        delayMs: request.delayMs || 100,
        maxSteps: request.maxSteps || 20,
        onProgress: (msg: string) => {
          chrome.runtime.sendMessage({
            action: 'autoFillProgress',
            message: msg
          }).catch(err => console.log('[Progress] Failed to send:', err))
        },
        onStepProgress: (step: number, msg: string) => {
          chrome.runtime.sendMessage({
            action: 'autoFillProgress',
            step,
            message: msg
          }).catch(err => console.log('[Progress] Failed to send:', err))
        }
      }
    ).then((result: any) => {
      sendResponse({ success: true, result })
    }).catch((error: Error) => {
      console.error('[SmartAutoFill] Error:', error)
      sendResponse({
        success: false,
        error: error.message
      })
    })
  }).catch((error: Error) => {
    console.error('[SmartAutoFill] Import Error:', error)
    sendResponse({
      success: false,
      error: error.message
    })
  })
}

/**
 * Handle analyzeForm message
 */
function handleAnalyzeForm(request: any, sendResponse: (response?: any) => void): void {
  import('../../utils/smartFormHandler').then(({ analyzeForm }) => {
    const getAIResponse = async (prompt: string) => {
      const response = await chrome.runtime.sendMessage({
        action: 'askAI',
        prompt
      })
      return response?.data
    }

    // Execute async analysis and handle response
    analyzeForm(getAIResponse)
      .then((analysis: any) => {
        sendResponse({ success: true, analysis })
      })
      .catch((error: Error) => {
        console.error('[FormAnalysis] Error:', error)
        sendResponse({
          success: false,
          error: error.message
        })
      })
  }).catch((error: Error) => {
    console.error('[FormAnalysis] Import Error:', error)
    sendResponse({
      success: false,
      error: error.message
    })
  })
}

/**
 * Handle scanJobDescription message
 */
function handleScanJobDescription(sendResponse: (response?: any) => void): void {
  import('../utils/formHelpers').then(({ extractJobDescription }) => {
    const jobText = extractJobDescription()
    sendResponse({ jobDescription: jobText })
  }).catch((error: Error) => {
    console.error('[JobDescription] Error:', error)
    sendResponse({
      success: false,
      error: error.message
    })
  })
}

/**
 * Handle detectFields message
 */

function handleDetectFields(sendResponse: (response?: any) => void): void {

  try {
    console.log('[DetectFields] Starting...')

    const detector = new FieldDetector()
    const rawFields = detector.findAllFormFields()

    console.log('[DetectFields] Found fields:', rawFields.length)

    const fields = rawFields.map(f => {
      let type = '';
      let valueOrText = '';

      if (f.tagName.toLowerCase() === 'button') {
        type = 'button';
        valueOrText = f.textContent?.trim() || '';
      } else if (f.tagName.toLowerCase() === 'input') {
        const inputElement = f as HTMLInputElement;
        type = inputElement.type || 'text';
        valueOrText = type === 'submit' || type === 'button' ? inputElement.value : '';
      } else {
        type = (f as HTMLInputElement).type || f.tagName.toLowerCase();
      }

      return {
        tagName: f.tagName,
        type: type,
        name: (f as HTMLInputElement).name || '',
        id: f.id || '',
        placeholder: (f as HTMLInputElement).placeholder || '',
        textOrValue: valueOrText,
        label: detector.findLabelForField(f) || ''
      };
    })

    console.log('[DetectFields] Sending response')


    sendResponse({ success: true, fields })

    console.log('[DetectFields] ✓ Response sent!')

  } catch (error) {

    console.error('[DetectFields] Error:', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      fields: []
    })
  }
}



/**
 * Structured Form Handler
 * Handles forms where ALL fields are visible at once
 * Fills everything in one pass, then submits (or waits for user)
 * NO HARDCODED SELECTORS - Uses AI for everything
 */

import { scanVisibleFields, classifyFieldsWithAI, getFillableFields } from './fieldScanner'
import { executeFillActions, getExecutionSummary } from './actionExecutor'
import { FormTypeDetection } from './formTypeDetector'

export interface StructuredFormResult {
  success: boolean
  fieldsFilled: number
  fieldsSkipped: number
  fieldsFailed: number
  message: string
  executed?: boolean
}

/**
 * Handle structured form (all fields visible at once)
 */
export async function handleStructuredForm(
  cvData: any,
  getAIResponse: (prompt: string) => Promise<any>,
  options: {
    autoSubmit?: boolean
    delayMs?: number
    onProgress?: (message: string) => void
  } = {}
): Promise<StructuredFormResult> {
  const { autoSubmit = false, delayMs = 100, onProgress } = options

  try {
    onProgress?.('🔍 Scanning form fields...')

    // Step 1: Scan all visible fields
    const fields = scanVisibleFields()

    if (fields.length === 0) {
      return {
        success: false,
        fieldsFilled: 0,
        fieldsSkipped: 0,
        fieldsFailed: 0,
        message: 'No form fields found'
      }
    }

    onProgress?.(`📋 Found ${fields.length} fields`)

    // Step 2: Classify fields with AI (determine purpose + check CV data)
    onProgress?.('🤖 Analyzing fields with AI...')

    const classifications = await classifyFieldsWithAI(fields, cvData, getAIResponse)

    onProgress?.(`✨ Analyzed ${classifications.length} fields`)

    // Step 3: Get only fillable fields (have CV data)
    const fillableFields = getFillableFields(classifications)
    const skippedFields = classifications.filter(c => !c.shouldFill)

    onProgress?.(`📝 Can fill ${fillableFields.length} fields, ${skippedFields.length} will be skipped`)

    if (fillableFields.length === 0) {
      return {
        success: true,
        fieldsFilled: 0,
        fieldsSkipped: skippedFields.length,
        fieldsFailed: 0,
        message: 'No matching CV data found for any fields',
        executed: false
      }
    }

    // Step 4: Execute fill actions
    onProgress?.('✍️ Filling fields...')

    const result = await executeFillActions(fillableFields, delayMs)

    onProgress?.(getExecutionSummary(result))

    // Step 5: Handle submit (if auto-submit enabled)
    if (autoSubmit) {
      onProgress?.('🔘 Looking for submit button...')

      const submitted = await attemptSubmitWithAI(getAIResponse)

      if (submitted) {
        onProgress?.('✅ Form submitted!')
        return {
          success: true,
          fieldsFilled: result.success.length,
          fieldsSkipped: result.skipped.length,
          fieldsFailed: result.failed.length,
          message: 'Form filled and submitted successfully',
          executed: true
        }
      } else {
        onProgress?.('⚠️ Could not find submit button - please submit manually')
      }
    } else {
      onProgress?.('⏸️ Ready for review - please submit manually')
    }

    return {
      success: true,
      fieldsFilled: result.success.length,
      fieldsSkipped: result.skipped.length,
      fieldsFailed: result.failed.length,
      message: getExecutionSummary(result),
      executed: false
    }

  } catch (error) {
    console.error('[StructuredFormHandler] Error:', error)
    return {
      success: false,
      fieldsFilled: 0,
      fieldsSkipped: 0,
      fieldsFailed: 0,
      message: `Error: ${String(error)}`
    }
  }
}

/**
 * Attempt to find and click submit button using AI
 */
async function attemptSubmitWithAI(
  getAIResponse: (prompt: string) => Promise<any>
): Promise<boolean> {
  // Extract all buttons on the page
  const buttons = Array.from(document.querySelectorAll('button, [type="submit"], [role="button"]'))

  if (buttons.length === 0) {
    console.warn('[StructuredFormHandler] No buttons found')
    return false
  }

  const buttonData = buttons.map((btn, index) => ({
    index,
    text: btn.textContent?.trim() || '',
    ariaLabel: btn.getAttribute('aria-label') || '',
    type: (btn as HTMLInputElement).type || btn.tagName.toLowerCase(),
    class: btn.className,
    id: btn.id,
    disabled: (btn as HTMLButtonElement).disabled
  }))

  const prompt = `You are a form submit button detector. Find which button is for SUBMITTING the form.

Buttons on page:
${JSON.stringify(buttonData, null, 2)}

CONTEXT:
- Look for buttons with text/label indicating submission (submit, apply, send, save, etc.)
- Can be ANY language - use context clues
- Look for symbols like ✓, →, etc.
- Ignore disabled buttons
- Avoid "Next", "Continue", "Back" buttons (those are for navigation)

Return ONLY this JSON:
{
  "buttonIndex": number (index of submit button, or -1 if not found),
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`

  try {
    const response = await getAIResponse(prompt)

    if (response && response.buttonIndex >= 0) {
      const button = buttons[response.buttonIndex] as HTMLElement

      // Check if visible
      if (!isButtonVisible(button)) {
        console.warn('[StructuredFormHandler] Submit button not visible')
        return false
      }

      console.log('[StructuredFormHandler] Clicking submit button:', response.buttonIndex)
      button.click()
      return true
    }
  } catch (error) {
    console.error('[StructuredFormHandler] AI submit detection failed:', error)
  }

  return false
}

/**
 * Check if button is visible
 */
function isButtonVisible(button: HTMLElement): boolean {
  const style = window.getComputedStyle(button)
  const rect = button.getBoundingClientRect()

  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    rect.width > 0 &&
    rect.height > 0 &&
    !(button as HTMLButtonElement).disabled
  )
}

/**
 * Check if form is structured (all fields visible)
 */
export function isStructuredForm(detection: FormTypeDetection): boolean {
  return detection.pattern === 'all-fields'
}

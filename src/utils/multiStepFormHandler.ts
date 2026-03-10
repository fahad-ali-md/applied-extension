/**
 * Multi-Step Form Handler
 * Handles forms with multiple steps (Typeform, Google Forms, etc.)
 * Loops through each step, fills fields, clicks Next, repeats
 * NO HARDCODED SELECTORS - Uses AI for everything
 */

import { scanVisibleFields, classifyFieldsWithAI, getFillableFields } from './fieldScanner'
import { executeFillActions, getExecutionSummary } from './actionExecutor'
import { FormTypeDetection, findButtonByPurpose } from './formTypeDetector'

export interface MultiStepFormResult {
  success: boolean
  stepsCompleted: number
  totalFieldsFilled: number
  totalFieldsSkipped: number
  totalFieldsFailed: number
  message: string
  submitted?: boolean
}

export interface MultiStepOptions {
  maxSteps?: number
  delayMs?: number
  autoSubmit?: boolean
  onProgress?: (step: number, message: string) => void
  onStepComplete?: (step: number, result: any) => void
}

/**
 * Handle multi-step form (single-field or few-fields per step)
 */
export async function handleMultiStepForm(
  cvData: any,
  getAIResponse: (prompt: string) => Promise<any>,
  detection: FormTypeDetection,
  options: MultiStepOptions = {}
): Promise<MultiStepFormResult> {
  const {
    maxSteps = 20,
    delayMs = 100,
    autoSubmit = false,
    onProgress,
    onStepComplete
  } = options

  let currentStep = 0
  let totalFieldsFilled = 0
  let totalFieldsSkipped = 0
  let totalFieldsFailed = 0

  console.log(`[MultiStepHandler] Starting multi-step form handling (pattern: ${detection.pattern})`)

  try {
    while (currentStep < maxSteps) {
      currentStep++

      onProgress?.(currentStep, `📍 Step ${currentStep}: Starting...`)

      // Wait for DOM to be stable after previous button click
      await waitForDOMStable()

      // Scan fields in current step
      const fields = scanVisibleFields()

      if (fields.length === 0) {
        onProgress?.(currentStep, '⏳ No fields found, waiting for next step...')
        await sleep(500)
        continue
      }

      onProgress?.(currentStep, `📋 Found ${fields.length} field(s)`)

      // Classify fields with AI
      onProgress?.(currentStep, '🤖 Analyzing fields...')

      const classifications = await classifyFieldsWithAI(fields, cvData, getAIResponse)

      // Get fillable fields
      const fillableFields = getFillableFields(classifications)
      const skippedFields = classifications.filter(c => !c.shouldFill)

      onProgress?.(currentStep, `✨ ${fillableFields.length} fillable, ${skippedFields.length} skipped`)

      // Fill fields
      if (fillableFields.length > 0) {
        onProgress?.(currentStep, '✍️ Filling fields...')

        const result = await executeFillActions(fillableFields, delayMs)

        totalFieldsFilled += result.success.length
        totalFieldsSkipped += result.skipped.length
        totalFieldsFailed += result.failed.length

        onProgress?.(currentStep, getExecutionSummary(result))
      } else {
        onProgress?.(currentStep, '⏭️ No fields to fill (no CV data)')
      }

      // Notify step complete
      onStepComplete?.(currentStep, {
        filled: fillableFields.length,
        skipped: skippedFields.length,
        total: fields.length
      })

      // Find and click button
      onProgress?.(currentStep, '🔘 Looking for next/submit button...')

      const buttonAction = await findAndClickNextOrSubmitButton(
        getAIResponse,
        detection,
        autoSubmit
      )

      if (buttonAction === 'submit') {
        onProgress?.(currentStep, '✅ Form submitted!')
        return {
          success: true,
          stepsCompleted: currentStep,
          totalFieldsFilled,
          totalFieldsSkipped,
          totalFieldsFailed,
          message: `Completed ${currentStep} steps and submitted`,
          submitted: true
        }
      } else if (buttonAction === 'none') {
        onProgress?.(currentStep, '⏸️ No button found - waiting for user')
        return {
          success: true,
          stepsCompleted: currentStep - 1,
          totalFieldsFilled,
          totalFieldsSkipped,
          totalFieldsFailed,
          message: `Completed ${currentStep - 1} steps (waiting for user)`,
          submitted: false
        }
      }

      // Button was "next" - continue loop
      onProgress?.(currentStep, '➡️ Moving to next step...')

      // Wait for next step to load
      await waitForDOMChange()
    }

    // Max steps reached
    return {
      success: true,
      stepsCompleted: currentStep,
      totalFieldsFilled,
      totalFieldsSkipped,
      totalFieldsFailed,
      message: `Completed ${currentStep} steps (max steps reached)`,
      submitted: false
    }

  } catch (error) {
    console.error('[MultiStepHandler] Error:', error)
    return {
      success: false,
      stepsCompleted: currentStep,
      totalFieldsFilled,
      totalFieldsSkipped,
      totalFieldsFailed,
      message: `Error: ${String(error)}`
    }
  }
}

/**
 * Find and click Next or Submit button using AI
 */
async function findAndClickNextOrSubmitButton(
  getAIResponse: (prompt: string) => Promise<any>,
  detection: FormTypeDetection,
  autoSubmit: boolean
): Promise<'next' | 'submit' | 'none'> {
  // Extract all buttons
  const buttons = Array.from(document.querySelectorAll('button, [type="submit"], [role="button"]'))

  if (buttons.length === 0) {
    return 'none'
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

  const prompt = `You are a form button detector. Find which button to click.

Buttons on page:
${JSON.stringify(buttonData, null, 2)}

CONTEXT:
- This is step ${detection.pattern === 'single-field' ? '1 (single field)' : 'multi-step'}
- "Next" or "Continue" = proceed to next step
- "Submit" or "Apply" = final submission
- Can be ANY language - use context clues
- Look for symbols: →, >, ✓, etc.
- Ignore disabled buttons

Return ONLY this JSON:
{
  "buttonIndex": number (index of button to click, or -1 if none),
  "purpose": "next" | "submit" | "none",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`

  try {
    const response = await getAIResponse(prompt)

    if (response && response.buttonIndex >= 0) {
      const button = buttons[response.buttonIndex] as HTMLElement

      // Check if visible
      if (!isButtonVisible(button)) {
        console.warn('[MultiStepHandler] Button not visible')
        return 'none'
      }

      // If submit and autoSubmit is false, don't click
      if (response.purpose === 'submit' && !autoSubmit) {
        console.log('[MultiStepHandler] Found submit button but autoSubmit is disabled')
        return 'submit'
      }

      console.log(`[MultiStepHandler] Clicking ${response.purpose} button:`, response.buttonIndex)
      button.click()
      return response.purpose
    }
  } catch (error) {
    console.error('[MultiStepHandler] AI button detection failed:', error)
  }

  return 'none'
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
 * Wait for DOM to be stable (no rapid changes)
 */
async function waitForDOMStable(timeoutMs: number = 3000): Promise<void> {
  const startTime = Date.now()
  let lastChangeTime = Date.now()
  let fieldCount = scanVisibleFields().length

  const observer = new MutationObserver(() => {
    const newCount = scanVisibleFields().length
    if (newCount !== fieldCount) {
      fieldCount = newCount
      lastChangeTime = Date.now()
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style']
  })

  // Wait for no changes for 500ms
  while (Date.now() - lastChangeTime < 500) {
    if (Date.now() - startTime > timeoutMs) {
      break
    }
    await sleep(100)
  }

  observer.disconnect()
}

/**
 * Wait for DOM to change (after clicking Next)
 */
async function waitForDOMChange(timeoutMs: number = 5000): Promise<void> {
  const startTime = Date.now()
  const initialFieldCount = scanVisibleFields().length

  // Wait for field count to change or timeout
  while (Date.now() - startTime < timeoutMs) {
    const currentFieldCount = scanVisibleFields().length

    if (currentFieldCount !== initialFieldCount) {
      // DOM changed
      await sleep(500) // Extra wait for animations
      return
    }

    await sleep(100)
  }

  console.warn('[MultiStepHandler] Timeout waiting for DOM change')
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Check if form is multi-step (single or few fields)
 */
export function isMultiStepForm(detection: FormTypeDetection): boolean {
  return detection.pattern === 'single-field' || detection.pattern === 'few-fields'
}

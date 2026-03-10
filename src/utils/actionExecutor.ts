/**
 * Action Executor
 * Fills form fields based on AI classification
 * Only fills fields that have CV data
 */

import { FieldClassification } from './fieldScanner'

export interface ExecutionResult {
  success: FieldClassification[]
  failed: Array<{ field: FieldClassification; error: string }>
  skipped: FieldClassification[]
}

/**
 * Execute fill actions for classified fields
 */
export async function executeFillActions(
  classifications: FieldClassification[],
  delayMs: number = 100
): Promise<ExecutionResult> {
  const result: ExecutionResult = {
    success: [],
    failed: [],
    skipped: []
  }

  console.log(`[ActionExecutor] Executing ${classifications.length} field actions`)

  for (const classification of classifications) {
    // Skip fields that shouldn't be filled (no CV data)
    if (!classification.shouldFill) {
      result.skipped.push(classification)
      console.log(`[ActionExecutor] Skipping ${classification.purpose} (no CV data)`)
      continue
    }

    // Skip fields without suggested value
    if (!classification.suggestedValue) {
      result.skipped.push(classification)
      console.log(`[ActionExecutor] Skipping ${classification.purpose} (no value)`)
      continue
    }

    try {
      await fillField(classification, delayMs)
      result.success.push(classification)
      console.log(`[ActionExecutor] ✓ Filled ${classification.purpose}`)
    } catch (error) {
      result.failed.push({
        field: classification,
        error: String(error)
      })
      console.error(`[ActionExecutor] ✗ Failed ${classification.purpose}:`, error)
    }

    // Small delay between fields (human-like)
    await sleep(delayMs + Math.random() * 50)
  }

  return result
}

/**
 * Fill a single field based on its type
 */
async function fillField(
  classification: FieldClassification,
  delayMs: number
): Promise<void> {
  const { field, suggestedValue } = classification
  const element = field.element

  // Focus on element
  element.focus()
  element.click()
  await sleep(50)

  // Handle different field types
  if (field.tagName === 'input') {
    await fillInput(element as HTMLInputElement, suggestedValue)
  } else if (field.tagName === 'textarea') {
    await fillTextarea(element as HTMLTextAreaElement, suggestedValue)
  } else if (field.tagName === 'select') {
    await fillSelect(element as HTMLSelectElement, suggestedValue)
  } else {
    throw new Error(`Unsupported field type: ${field.tagName}`)
  }

  // Blur to trigger change events
  element.blur()
  await sleep(50)
}

/**
 * Fill input field
 */
async function fillInput(input: HTMLInputElement, value: any): Promise<void> {
  // Handle different input types
  const type = input.type.toLowerCase()

  if (type === 'radio' || type === 'checkbox') {
    // For radio/checkbox, check if value matches
    if (input.value === String(value) || input.checked) {
      input.checked = true
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }
  } else if (type === 'file') {
    // File upload - skip for now (needs special handling)
    console.warn('[ActionExecutor] File upload not supported yet')
    throw new Error('File upload requires user interaction')
  } else {
    // Text input
    input.focus()
    input.click()

    // Clear existing value
    input.value = ''
    input.dispatchEvent(new Event('input', { bubbles: true }))

    // Simulate typing (character by character for realism)
    const text = String(value)
    for (let i = 0; i < text.length; i++) {
      input.value += text[i]
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await sleep(10 + Math.random() * 20)
    }

    // Trigger change event
    input.dispatchEvent(new Event('change', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }))
  }
}

/**
 * Fill textarea field
 */
async function fillTextarea(textarea: HTMLTextAreaElement, value: any): Promise<void> {
  textarea.focus()
  textarea.click()

  // For long text, set directly (too slow to type character by character)
  textarea.value = String(value)

  // Trigger events
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
  textarea.dispatchEvent(new Event('change', { bubbles: true }))

  // Auto-resize if needed
  textarea.style.height = 'auto'
  textarea.style.height = textarea.scrollHeight + 'px'
}

/**
 * Fill select field
 */
async function fillSelect(select: HTMLSelectElement, value: any): Promise<void> {
  const targetValue = String(value).toLowerCase()

  // Try exact match first
  for (let i = 0; i < select.options.length; i++) {
    const option = select.options[i]
    if (option.value === value || option.text === value) {
      select.selectedIndex = i
      select.dispatchEvent(new Event('change', { bubbles: true }))
      return
    }
  }

  // Try partial match
  for (let i = 0; i < select.options.length; i++) {
    const option = select.options[i]
    if (
      option.value.toLowerCase().includes(targetValue) ||
      option.text.toLowerCase().includes(targetValue)
    ) {
      select.selectedIndex = i
      select.dispatchEvent(new Event('change', { bubbles: true }))
      return
    }
  }

  throw new Error(`No matching option found for: ${value}`)
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Get execution summary
 */
export function getExecutionSummary(result: ExecutionResult): string {
  const parts = []

  if (result.success.length > 0) {
    parts.push(`✓ ${result.success.length} filled`)
  }

  if (result.skipped.length > 0) {
    parts.push(`○ ${result.skipped.length} skipped (no CV data)`)
  }

  if (result.failed.length > 0) {
    parts.push(`✗ ${result.failed.length} failed`)
  }

  return parts.join(', ') || 'No actions taken'
}

/**
 * AI-Based Form Type Detection System
 * NO HARDCODED PATTERNS - AI detects everything
 */

export type FormPattern = 'single-field' | 'few-fields' | 'all-fields'

export interface FormTypeDetection {
  pattern: FormPattern
  fieldCount: number
  hasNextButton: boolean
  hasSubmitButton: boolean
  hasContinueButton: boolean
  hasPreviousButton: boolean
  layoutType: string
  confidence: number
  rawAIAnalysis?: any
}

/**
 * Count visible form fields
 */
function countVisibleFields(): number {
  const selectors = [
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"])',
    'textarea',
    'select'
  ]

  const fields: HTMLElement[] = []

  document.querySelectorAll(selectors.join(', ')).forEach(el => {
    if (isFieldVisible(el as HTMLElement)) {
      fields.push(el as HTMLElement)
    }
  })

  return fields.length
}

/**
 * Check if element is visible
 */
function isFieldVisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el)
  const rect = el.getBoundingClientRect()

  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    rect.width > 0 &&
    rect.height > 0 &&
    !(el as HTMLInputElement).disabled &&
    !(el as HTMLInputElement).readOnly
  )
}

/**
 * Extract all button texts (RAW - no filtering)
 */
function extractRawButtonData(): Array<{
  text: string
  ariaLabel: string
  type: string
  html: string
  position: number
}> {
  const buttons = document.querySelectorAll(
    'button, [type="submit"], [role="button"], .btn, .button, a[class*="button"], a[class*="btn"]'
  )

  return Array.from(buttons).map((btn, index) => ({
    text: btn.textContent?.trim() || '',
    ariaLabel: btn.getAttribute('aria-label') || '',
    type: (btn as HTMLInputElement).type || btn.tagName.toLowerCase(),
    html: btn.innerHTML,
    position: index
  }))
}

/**
 * Extract page structure for AI analysis
 */
function extractPageStructure(): {
  fieldCount: number
  buttons: Array<{
    text: string
    ariaLabel: string
    type: string
    html: string
    position: number
  }>
  url: string
  title: string
  pageTitle: string
  bodyText: string
  htmlStructure: string
} {
  const fieldCount = countVisibleFields()
  const buttons = extractRawButtonData()

  // Get body text (first 500 chars for context)
  const bodyText = document.body.textContent?.slice(0, 500) || ''

  // Get basic HTML structure (as JSON string)
  const forms = document.querySelectorAll('form, [role="form"]')
  const htmlStructure = JSON.stringify(Array.from(forms).map(form => ({
    tag: form.tagName,
    class: form.className,
    id: form.id
  })))

  return {
    fieldCount,
    buttons,
    url: window.location.href,
    title: document.title,
    pageTitle: document.title,
    bodyText,
    htmlStructure
  }
}

/**
 * Use AI to detect form type and button purposes
 * NO HARDCODED RULES - AI figures it all out
 */
async function detectWithAI(
  pageStructure: any,
  getAIResponse: (prompt: string) => Promise<any>
): Promise<{
  pattern: FormPattern
  buttonAnalysis: Array<{
    text: string
    purpose: 'next' | 'submit' | 'continue' | 'previous' | 'other'
    confidence: number
  }>
  confidence: number
  reasoning: string
}> {
  const prompt = `You are a form analysis expert. Analyze this page structure and determine:

1. Form Pattern: Is this:
   - "single-field": Shows 1 field at a time (like Typeform)
   - "few-fields": Shows 2-6 fields per step with navigation (like Google Forms)
   - "all-fields": Shows all 10+ fields at once (like traditional forms)

2. Button Analysis: For each button, determine its purpose:
   - "next": Goes to next step/field
   - "submit": Final submission
   - "continue": Same as next (proceeds forward)
   - "previous": Goes back
   - "other": Other action

Page Data:
${JSON.stringify(pageStructure, null, 2)}

IMPORTANT:
- Analyze button text, aria-labels, and position to determine purpose
- Consider field count, URL, page title
- Buttons can be in ANY language - use context clues
- Look for symbols like →, ←, ✓, >, < etc.

Return ONLY this JSON:
{
  "pattern": "single-field" | "few-fields" | "all-fields",
  "buttonAnalysis": [
    {
      "text": "exact button text",
      "purpose": "next|submit|continue|previous|other",
      "confidence": 0.0-1.0
    }
  ],
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation of your analysis"
}`

  try {
    const response = await getAIResponse(prompt)

    if (response && response.pattern) {
      return {
        pattern: response.pattern,
        buttonAnalysis: response.buttonAnalysis || [],
        confidence: response.confidence || 0.7,
        reasoning: response.reasoning || ''
      }
    } else {
      throw new Error('Invalid AI response format')
    }
  } catch (error) {
    console.error('[FormTypeDetector] AI detection failed:', error)
    throw error
  }
}

/**
 * Main detection function (AI-powered only)
 */
export async function detectFormType(
  getAIResponse: (prompt: string) => Promise<any>
): Promise<FormTypeDetection> {
  const pageStructure = extractPageStructure()
  const fieldCount = pageStructure.fieldCount

  console.log('[FormTypeDetector] Page structure:', pageStructure)

  // Use AI for detection
  const detection = await detectWithAI(pageStructure, getAIResponse)

  console.log('[FormTypeDetector] AI detection result:', detection)

  // Extract button types from AI analysis
  const hasNextButton = detection.buttonAnalysis.some(b => b.purpose === 'next')
  const hasSubmitButton = detection.buttonAnalysis.some(b => b.purpose === 'submit')
  const hasContinueButton = detection.buttonAnalysis.some(b => b.purpose === 'continue')
  const hasPreviousButton = detection.buttonAnalysis.some(b => b.purpose === 'previous')

  // Determine layout type from AI reasoning
  const layoutType = detection.reasoning.toLowerCase().includes('card') ? 'card-based' :
                     detection.reasoning.toLowerCase().includes('step') ? 'multi-step' :
                     detection.pattern === 'single-field' ? 'centered' : 'traditional'

  return {
    pattern: detection.pattern,
    fieldCount,
    hasNextButton,
    hasSubmitButton,
    hasContinueButton,
    hasPreviousButton,
    layoutType,
    confidence: detection.confidence,
    rawAIAnalysis: {
      reasoning: detection.reasoning,
      buttonAnalysis: detection.buttonAnalysis
    }
  }
}

/**
 * Get detection result in human-readable format
 */
export function getDetectionSummary(detection: FormTypeDetection): string {
  const patternNames = {
    'single-field': 'Single Field (Typeform-style)',
    'few-fields': 'Few Fields (Multi-step/Google Form)',
    'all-fields': 'All Fields (Structured Form)'
  }

  return `${patternNames[detection.pattern]} (${detection.fieldCount} fields, ${Math.round(detection.confidence * 100)}% confidence)`
}

/**
 * Find button by purpose using AI analysis
 */
export function findButtonByPurpose(
  detection: FormTypeDetection,
  purpose: 'next' | 'submit' | 'continue' | 'previous'
): HTMLElement | null {
  if (!detection.rawAIAnalysis?.buttonAnalysis) {
    console.warn('[FormTypeDetector] No AI analysis available')
    return null
  }

  // Find button with this purpose from AI analysis
  const targetButton = detection.rawAIAnalysis.buttonAnalysis.find(
    (b: any) => b.purpose === purpose
  )

  if (!targetButton) {
    console.warn(`[FormTypeDetector] No button found with purpose: ${purpose}`)
    return null
  }

  // Find the button element with matching text
  const buttons = document.querySelectorAll('button, [type="submit"], [role="button"], a[class*="button"]')

  for (const btn of Array.from(buttons)) {
    const btnText = btn.textContent?.trim() || ''

    // Exact match
    if (btnText === targetButton.text) {
      console.log(`[FormTypeDetector] Found ${purpose} button: "${btnText}"`)
      return btn as HTMLElement
    }

    // Partial match (in case of extra spaces/symbols)
    if (btnText.includes(targetButton.text) || targetButton.text.includes(btnText)) {
      console.log(`[FormTypeDetector] Found ${purpose} button (partial match): "${btnText}"`)
      return btn as HTMLElement
    }
  }

  console.warn(`[FormTypeDetector] Could not find button element for: "${targetButton.text}"`)
  return null
}

/**
 * Get all buttons with their AI-determined purposes
 */
export function getButtonPurposes(detection: FormTypeDetection): Array<{
  text: string
  purpose: string
  confidence: number
}> {
  if (!detection.rawAIAnalysis?.buttonAnalysis) {
    return []
  }

  return detection.rawAIAnalysis.buttonAnalysis.map((b: any) => ({
    text: b.text,
    purpose: b.purpose,
    confidence: b.confidence || 0.5
  }))
}

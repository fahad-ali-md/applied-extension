/**
 * AI-Based Field Scanner
 * Detects and classifies form fields using AI (NO hardcoded patterns)
 */

export interface DetectedField {
  element: HTMLElement
  label: string
  name: string
  id: string
  placeholder: string
  type: string
  tagName: string
  required: boolean
  options?: string[] // For select/radio/checkbox
}

export interface FieldClassification {
  field: DetectedField
  purpose: string // AI-detected purpose (e.g., "firstName", "email", "coverLetter")
  confidence: number
  shouldFill: boolean // Whether to fill this field
  suggestedValue?: any // Value from CV data (if exists)
}

/**
 * Scan all visible form fields (RAW data)
 */
export function scanVisibleFields(): DetectedField[] {
  const selectors = [
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"])',
    'textarea',
    'select'
  ]

  const fields: DetectedField[] = []

  document.querySelectorAll(selectors.join(', ')).forEach(el => {
    if (isFieldVisible(el as HTMLElement)) {
      fields.push(extractFieldData(el as HTMLElement))
    }
  })

  return fields
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
 * Extract field data (RAW - no interpretation)
 */
function extractFieldData(el: HTMLElement): DetectedField {
  const input = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

  const field: DetectedField = {
    element: el,
    label: extractLabel(el),
    name: input.name || '',
    id: input.id || '',
    placeholder: (input as HTMLInputElement).placeholder || '',
    type: (input as HTMLInputElement).type || el.tagName.toLowerCase(),
    tagName: el.tagName.toLowerCase(),
    required: input.hasAttribute('required') || input.hasAttribute('aria-required')
  }

  // Extract options for select, radio, checkbox
  if (el.tagName === 'SELECT') {
    const select = el as HTMLSelectElement
    field.options = Array.from(select.options).map(opt => opt.value || opt.text)
  }

  return field
}

/**
 * Extract label text (RAW - find nearby text)
 */
function extractLabel(field: HTMLElement): string {
  // Try aria-label
  const ariaLabel = field.getAttribute('aria-label')
  if (ariaLabel) return ariaLabel

  // Try label with htmlFor
  if (field.id) {
    const label = document.querySelector(`label[for="${field.id}"]`)
    if (label) return label.textContent?.trim() || ''
  }

  // Try parent label
  const parentLabel = field.closest('label')
  if (parentLabel) {
    return parentLabel.textContent?.replace(field.textContent || '', '').trim() || ''
  }

  // Try nearby text (previous sibling or parent's previous sibling)
  let text = ''

  const prevSibling = field.previousElementSibling
  if (prevSibling) {
    text = prevSibling.textContent?.trim() || ''
  }

  if (!text && field.parentElement) {
    const parentPrev = field.parentElement.previousElementSibling
    if (parentPrev) {
      text = parentPrev.textContent?.trim() || ''
    }
  }

  return text
}

/**
 * Use AI to classify field purposes
 */
export async function classifyFieldsWithAI(
  fields: DetectedField[],
  cvData: any,
  getAIResponse: (prompt: string) => Promise<any>
): Promise<FieldClassification[]> {
  if (fields.length === 0) {
    return []
  }

  // Prepare field data for AI (minimal info)
  const fieldsForAI = fields.map(f => ({
    label: f.label,
    name: f.name,
    id: f.id,
    placeholder: f.placeholder,
    type: f.type,
    tagName: f.tagName,
    required: f.required,
    hasOptions: !!f.options?.length
  }))

  // Prepare CV data summary (what fields have data)
  const cvSummary = {
    hasFirstName: !!cvData?.personal?.firstName,
    hasLastName: !!cvData?.personal?.lastName,
    hasEmail: !!cvData?.personal?.email,
    hasPhone: !!cvData?.personal?.phone,
    hasAddress: !!cvData?.personal?.address,
    hasCity: !!cvData?.personal?.city,
    hasState: !!cvData?.personal?.state,
    hasZipCode: !!cvData?.personal?.zipCode,
    hasCountry: !!cvData?.personal?.country,
    hasLinkedIn: !!cvData?.personal?.linkedIn,
    hasPortfolio: !!cvData?.personal?.portfolio,
    hasSummary: !!cvData?.professional?.summary,
    hasCurrentTitle: !!cvData?.professional?.currentTitle,
    hasDegree: !!cvData?.education?.[0]?.degree,
    hasSchool: !!cvData?.education?.[0]?.school
  }

  const prompt = `You are a form field classifier. Analyze these fields and:

1. Determine each field's purpose (e.g., "firstName", "lastName", "email", "phone", "coverLetter", "resume", "linkedin", "portfolio", etc.)
2. Decide if we should fill this field (only if we have data in CV)
3. If we have CV data, provide the value

Fields to classify:
${JSON.stringify(fieldsForAI, null, 2)}

Available CV Data (only these fields exist):
${JSON.stringify(cvSummary, null, 2)}

IMPORTANT RULES:
- Only set "shouldFill": true if CV has that data
- For fields like "coverLetter", "whyDoYouWantToWorkHere", etc. - we have "summary" in CV
- For file upload fields - shouldFill: true if it's for resume/CV
- If CV doesn't have data for a field, shouldFill: false
- Field labels can be in ANY language - use context clues

Return ONLY this JSON:
{
  "classifications": [
    {
      "label": "exact field label from input",
      "purpose": "detected purpose (e.g., firstName, email, etc.)",
      "confidence": 0.0-1.0,
      "shouldFill": true/false,
      "suggestedValue": "value from CV (if shouldFill is true)"
    }
  ]
}`

  try {
    const response = await getAIResponse(prompt)

    if (response?.classifications && Array.isArray(response.classifications)) {
      // Merge AI classifications with original field data
      return fields.map((field, index) => {
        const aiClassification = response.classifications.find(
          (c: any) => c.label === field.label ||
                     c.label === field.name ||
                     c.label === field.id
        )

        return {
          field,
          purpose: aiClassification?.purpose || 'unknown',
          confidence: aiClassification?.confidence || 0.5,
          shouldFill: aiClassification?.shouldFill || false,
          suggestedValue: aiClassification?.suggestedValue
        }
      })
    }
  } catch (error) {
    console.error('[FieldScanner] AI classification failed:', error)
  }

  // Fallback: Return all fields as unknown (won't fill without AI)
  return fields.map(field => ({
    field,
    purpose: 'unknown',
    confidence: 0.0,
    shouldFill: false
  }))
}

/**
 * Get fields that should be filled (have CV data)
 */
export function getFillableFields(classifications: FieldClassification[]): FieldClassification[] {
  return classifications.filter(c => c.shouldFill)
}

/**
 * Get fields that should be skipped (no CV data)
 */
export function getSkippedFields(classifications: FieldClassification[]): FieldClassification[] {
  return classifications.filter(c => !c.shouldFill)
}

/**
 * Get summary of field classification
 */
export function getFieldClassificationSummary(classifications: FieldClassification[]): {
  total: number
  fillable: number
  skipped: number
  byPurpose: Record<string, number>
} {
  const fillable = classifications.filter(c => c.shouldFill)
  const skipped = classifications.filter(c => !c.shouldFill)

  const byPurpose: Record<string, number> = {}
  classifications.forEach(c => {
    byPurpose[c.purpose] = (byPurpose[c.purpose] || 0) + 1
  })

  return {
    total: classifications.length,
    fillable: fillable.length,
    skipped: skipped.length,
    byPurpose
  }
}

/**
 * 🧠 Smart Field Extractor V2
 *
 * AI-Driven Field Detection - No Hardcoded Patterns!
 *
 * Approach:
 * 1. Extract minimal field data from DOM
 * 2. Send to AI for analysis
 * 3. AI figures out field types & mappings
 * 4. Get back fill plan
 *
 * Token Optimization:
 * - Short property names (i, t, l, p instead of id, type, label, placeholder)
 * - Limited field count (max 50)
 * - Filtered fields (only relevant ones)
 * - No HTML, just data
 */

// ============================================
// TYPES
// ============================================

interface RawField {
  i: string      // id (shortened)
  n: string      // name (shortened)
  t: string      // type
  l: string      // label (shortened)
  p: string      // placeholder (shortened)
  o?: string[]   // options (for select)
}

interface FieldExtractionResult {
  fields: RawField[]
  metadata: {
    url: string
    pageTitle: string
    formType: string
    detectedATS: boolean
  }
  totalFields: number
}

// ============================================
// CONSTANTS
// ============================================

const MAX_FIELDS = 50
const MAX_STRING_LENGTH = 50
const MAX_OPTIONS = 10

// ============================================
// FIELD EXTRACTION
// ============================================

/**
 * Extract all form fields with minimal data (token-efficient)
 */
export function extractAllFieldsRaw(): FieldExtractionResult {
  const fields: RawField[] = []
  const seenKeys = new Set<string>()

  // Select all relevant form elements
  const elements = document.querySelectorAll<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
  )

  // Process each element
  Array.from(elements)
    .slice(0, MAX_FIELDS) // Limit to max fields
    .forEach(element => {
      try {
        const field = extractFieldData(element)

        // Skip if no identifier
        if (!field.i && !field.n) return

        // Create unique key to detect duplicates
        const key = `${field.i}-${field.n}-${field.t}-${field.l}`.toLowerCase()

        // Skip duplicates
        if (seenKeys.has(key)) return
        seenKeys.add(key)

        // Add to fields list
        fields.push(field)
      } catch (error) {
        // Skip problematic elements
        console.warn('[FieldExtractor] Error extracting field:', error)
      }
    })

  // Detect form type
  const formType = detectFormType(fields)

  return {
    fields,
    metadata: {
      url: window.location.href,
      pageTitle: document.title.substring(0, 100),
      formType,
      detectedATS: isATSPlatform()
    },
    totalFields: fields.length
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Extract essential data from a single field
 */
function extractFieldData(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
): RawField {
  const id = element.id?.substring(0, MAX_STRING_LENGTH) || ''
  const name = element.name?.substring(0, MAX_STRING_LENGTH) || ''
  const type = element.type || 'text'
  const placeholder = (element as HTMLInputElement).placeholder?.substring(0, MAX_STRING_LENGTH) || ''

  // Get label text
  const label = extractLabel(element)

  // Get options for select elements
  let options: string[] | undefined
  if (element.tagName === 'SELECT') {
    options = extractSelectOptions(element as HTMLSelectElement)
  }

  return {
    i: id,
    n: name,
    t: type,
    l: label,
    p: placeholder,
    o: options
  }
}

/**
 * Extract label text for an element
 */
function extractLabel(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
): string {
  // Method 1: Check for <label> with for attribute
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`)
    if (label?.textContent) {
      return label.textContent.trim().substring(0, MAX_STRING_LENGTH)
    }
  }

  // Method 2: Check parent <label>
  const parentLabel = element.closest('label')
  if (parentLabel?.textContent) {
    // Remove the element's own value if it's an input
    const text = parentLabel.textContent
      .replace((element as HTMLInputElement).value || '', '')
      .trim()
    return text.substring(0, MAX_STRING_LENGTH)
  }

  // Method 3: Check aria-label
  if (element.getAttribute('aria-label')) {
    return element.getAttribute('aria-label')!.substring(0, MAX_STRING_LENGTH)
  }

  // Method 4: Check placeholder
  const placeholder = (element as HTMLInputElement).placeholder
  if (placeholder) {
    return placeholder.substring(0, MAX_STRING_LENGTH)
  }

  // Method 5: Check nearby text
  const nearbyText = findNearbyText(element)
  if (nearbyText) {
    return nearbyText
  }

  return ''
}

/**
 * Extract options from select element
 */
function extractSelectOptions(select: HTMLSelectElement): string[] {
  const options: string[] = []

  Array.from(select.options)
    .slice(0, MAX_OPTIONS)
    .forEach(option => {
      if (option.value && option.text) {
        options.push(option.text.substring(0, 30))
      }
    })

  return options
}

/**
 * Find nearby text (for label detection)
 */
function findNearbyText(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
): string {
  // Check previous sibling
  let prev = element.previousElementSibling
  while (prev) {
    if (prev.textContent && prev.textContent.trim().length > 0 && prev.textContent.trim().length < 100) {
      return prev.textContent.trim().substring(0, MAX_STRING_LENGTH)
    }
    prev = prev.previousElementSibling
  }

  // Check next sibling
  let next = element.nextElementSibling
  while (next) {
    if (next.textContent && next.textContent.trim().length > 0 && next.textContent.trim().length < 100) {
      return next.textContent.trim().substring(0, MAX_STRING_LENGTH)
    }
    next = next.nextElementSibling
  }

  // Check parent's previous sibling
  if (element.parentElement) {
    const parentPrev = element.parentElement.previousElementSibling
    if (parentPrev?.textContent && parentPrev.textContent.trim().length < 100) {
      return parentPrev.textContent.trim().substring(0, MAX_STRING_LENGTH)
    }
  }

  return ''
}

/**
 * Detect form type based on fields
 */
function detectFormType(fields: RawField[]): string {
  const labels = fields.map(f => f.l.toLowerCase()).join(' ')

  if (labels.includes('job') || labels.includes('position') || labels.includes('role')) {
    return 'job_application'
  }

  if (labels.includes('contact') || labels.includes('newsletter')) {
    return 'contact_form'
  }

  if (labels.includes('survey') || labels.includes('feedback')) {
    return 'survey'
  }

  return 'unknown'
}

/**
 * Check if current page is an ATS platform
 */
function isATSPlatform(): boolean {
  const domain = window.location.hostname.toLowerCase()
  const atsDomains = [
    'workday.com',
    'greenhouse.io',
    'lever.co',
    'myworkdayjobs.com',
    'successfactors.com',
    'taleo.net',
    'icims.com',
    'bamboohr.com',
    'smartrecruiters.com',
    'workable.com'
  ]

  return atsDomains.some(atsDomain => domain.includes(atsDomain))
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Calculate estimated token count for field data
 */
export function estimateTokenCount(fields: RawField[]): number {
  const jsonString = JSON.stringify(fields)
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(jsonString.length / 4)
}

/**
 * Convert raw fields to display format (for popup)
 */
export function convertToDisplayFormat(rawFields: RawField[]) {
  return rawFields.map(field => ({
    id: field.i,
    name: field.n,
    type: field.t,
    label: field.l || field.p || field.n || field.i || 'Unknown',
    placeholder: field.p,
    options: field.o
  }))
}

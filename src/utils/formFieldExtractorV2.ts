/**
 * AI-FIRST FORM FIELD EXTRACTOR V2
 *
 * NO HARDCODED PATTERNS - Extract everything, let AI figure it out!
 * This is cleaner, more flexible, and leverages AI properly.
 */

interface RawFormField {
  selector: string              // CSS selector
  tagName: string              // 'INPUT', 'TEXTAREA', 'SELECT'
  type: string                 // input type or tagName
  name: string                 // name attribute
  id: string                   // id attribute
  placeholder: string          // placeholder text
  ariaLabel: string            // aria-label attribute
  label: string                // <label> text content
  currentValue: string         // current value
  required: boolean            // required attribute
  options?: Array<{            // for SELECT fields
    value: string
    text: string
  }>
  keywords: string             // combined searchable text
  category: string             // guessed category
}

interface ExtractedFormData {
  fields: RawFormField[]
  totalFields: number
  requiredFields: number
  metadata: {
    url: string
    pageTitle: string
    formType: string
    detectedATS: string[]
  }
}

/**
 * Extract ALL form fields with full context
 * No filtering, no hardcoded patterns - just raw data!
 */
export function extractAllFieldsRaw(): ExtractedFormData {
  // Check if this is Typeform (special handling!)
  if (isTypeform()) {
    return extractTypeformFields()
  }

  const fields: RawFormField[] = []

  // All input types (excluding hidden/submit/button)
  const inputs = document.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select'
  )

  inputs.forEach(input => {
    if (isVisible(input as HTMLElement)) {
      fields.push(extractFieldInfo(input as HTMLElement))
    }
  })

  return {
    fields,
    totalFields: fields.length,
    requiredFields: fields.filter(f => f.required).length,
    metadata: detectFormMetadata()
  }
}

/**
 * Extract field information - captures everything!
 */
function extractFieldInfo(element: HTMLElement): RawFormField {
  const input = element as HTMLInputElement
  const textarea = element as HTMLTextAreaElement
  const select = element as HTMLSelectElement

  // Collect ALL attributes
  const name = input.name || ''
  const id = input.id || ''
  const type = input.type || ''
  const placeholder = input.placeholder || ''
  const ariaLabel = input.getAttribute('aria-label') || ''
  const required = input.hasAttribute('required')

  // Get label text
  const label = getFieldLabel(element)

  // Get current value
  const currentValue = input.value || textarea.value || ''

  // Get options for select
  const options = select.tagName === 'SELECT'
    ? Array.from(select.options).map(o => ({ value: o.value, text: o.text }))
    : undefined

  // Generate selector
  const selector = generateSelector(element)

  // Combine all searchable text
  const keywords = [
    name, id, placeholder, ariaLabel, label
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  // Simple category guess (no exhaustive lists!)
  const category = guessCategory(keywords, type)

  return {
    selector,
    tagName: input.tagName,
    type: type || input.tagName.toLowerCase(),
    name,
    id,
    placeholder,
    ariaLabel,
    label,
    currentValue,
    required,
    options,
    keywords,
    category
  }
}

/**
 * Simple category guess - no hardcoded lists!
 */
function guessCategory(text: string, type: string): string {
  const t = text.toLowerCase()

  // Simple keyword checks
  if (t.includes('email') || type === 'email') return 'email'
  if (t.includes('phone') || t.includes('mobile') || type === 'tel') return 'phone'
  if (t.includes('name')) return 'name'
  if (t.includes('address') || t.includes('street')) return 'address'
  if (t.includes('city') || t.includes('town')) return 'city'
  if (t.includes('state') || t.includes('province')) return 'state'
  if (t.includes('zip') || t.includes('postal') || t.includes('pincode')) return 'zip'
  if (t.includes('country')) return 'country'
  if (t.includes('cover') || t.includes('letter') || t.includes('message')) return 'coverLetter'
  if (t.includes('resume') || t.includes('cv')) return 'resume'
  if (t.includes('linkedin') || t.includes('github')) return 'social'
  if (t.includes('title') || t.includes('position') || t.includes('role')) return 'title'
  if (t.includes('company') || t.includes('employer')) return 'company'
  if (t.includes('skill') || t.includes('technology')) return 'skill'
  if (t.includes('experience') || t.includes('work')) return 'experience'
  if (t.includes('education') || t.includes('degree') || t.includes('school')) return 'education'

  return 'unknown'
}

/**
 * Get label text from various sources
 */
function getFieldLabel(element: HTMLElement): string {
  // Try aria-label
  const ariaLabel = element.getAttribute('aria-label')
  if (ariaLabel) return ariaLabel

  // Try placeholder
  const placeholder = element.getAttribute('placeholder')
  if (placeholder) return placeholder

  // Try associated label element
  const id = element.id
  if (id) {
    const label = document.querySelector(`label[for="${id}"]`)
    if (label) return label.textContent?.trim() || ''
  }

  // Try parent label
  const parentLabel = element.closest('label')
  if (parentLabel) {
    // Exclude the input text itself
    const text = parentLabel.textContent?.replace(element.textContent || '', '').trim()
    if (text) return text
  }

  // Try name attribute
  const name = element.getAttribute('name')
  if (name) return name

  return 'Unknown'
}

/**
 * Generate CSS selector for element
 */
function generateSelector(element: HTMLElement): string {
  // Try ID first
  if (element.id) {
    return `#${element.id}`
  }

  // Try name
  const name = element.getAttribute('name')
  if (name) {
    return `[name="${name}"]`
  }

  // Try data attributes
  const dataTestId = element.getAttribute('data-testid')
  if (dataTestId) {
    return `[data-testid="${dataTestId}"]`
  }

  // Fallback: generic selector
  const tag = element.tagName.toLowerCase()
  const type = element.getAttribute('type')
  return type ? `${tag}[type="${type}"]` : tag
}

/**
 * Check if element is visible
 */
function isVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element)
  const rect = element.getBoundingClientRect()

  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    rect.width > 0 &&
    rect.height > 0
  )
}

/**
 * Detect form metadata
 */
function detectFormMetadata() {
  return {
    url: window.location.href,
    pageTitle: document.title,
    formType: detectFormType(),
    detectedATS: detectATS(),
  }
}

/**
 * Detect form type (application, contact, etc.)
 */
function detectFormType(): string {
  // Check for Typeform first
  if (isTypeform()) return 'typeform-application'

  // Check for multi-step forms (Next/Continue buttons with few fields)
  const allButtons = Array.from(document.querySelectorAll('button'))
  const nextButtons = allButtons.filter(btn => {
    const text = btn.textContent?.toLowerCase() || ''
    return text.includes('next') || text.includes('continue')
  })

  const totalFields = document.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]), textarea, select'
  ).length

  // If Next/Continue buttons exist AND very few fields visible → multi-step form
  if (nextButtons.length > 0 && totalFields <= 3) {
    return 'multi-step-form'
  }

  const titleLower = document.title.toLowerCase()
  const urlLower = window.location.href.toLowerCase()

  if (titleLower.includes('apply') || urlLower.includes('apply')) return 'job-application'
  if (titleLower.includes('contact') || urlLower.includes('contact')) return 'contact'
  if (titleLower.includes('register') || urlLower.includes('register')) return 'registration'
  if (titleLower.includes('survey') || urlLower.includes('survey')) return 'survey'

  return 'unknown'
}

/**
 * Detect ATS (Applicant Tracking System)
 */
function detectATS(): string[] {
  const ats: string[] = []
  const scripts = Array.from(document.querySelectorAll('script'))
  const metas = Array.from(document.querySelectorAll('meta'))

  // Check for common ATS indicators
  const atsPatterns = {
    'Greenhouse': /greenhouse|gh_src/i,
    'Lever': /lever|lever-co/i,
    'Workday': /workday|wd-|myworkday/i,
    'Ashby': /ashbyhq|ashby/i,
    'JazzHR': /jazzhr|iCIMS/i,
    'SmartRecruiters': /smartrecruiters|sr_/i,
    'BambooHR': /bamboohr|bamboo/i,
    'Typeform': /typeform|typeform\.com/i,
  }

  for (const [atsName, pattern] of Object.entries(atsPatterns)) {
    // Check in script sources
    if (scripts.some(s => pattern.test(s.src || s.textContent || ''))) {
      ats.push(atsName)
    }

    // Check in meta tags
    if (metas.some(m => pattern.test(m.content || m.name || ''))) {
      ats.push(atsName)
    }

    // Check in URL
    if (pattern.test(window.location.href)) {
      ats.push(atsName)
    }
  }

  return ats
}

/**
 * Detect if current page is using Typeform
 */
function isTypeform(): boolean {
  // Check URL
  if (window.location.href.includes('typeform.com')) return true
  if (window.location.href.includes('typeform')) return true

  // Check for Typeform-specific DOM structure
  const typeformElements = document.querySelectorAll('[class*="typeform"]')
  if (typeformElements.length > 0) return true

  // Check for Typeform embed
  const typeformEmbed = document.querySelector('[data-tf-widget]')
  if (typeformEmbed) return true

  // Check for Typeform scripts
  const scripts = Array.from(document.querySelectorAll('script'))
  if (scripts.some(s => (s.src || '').includes('typeform'))) return true

  return false
}

/**
 * Extract fields from Typeform (special handling!)
 * Typeform uses contenteditable divs instead of inputs
 */
function extractTypeformFields(): ExtractedFormData {
  const fields: RawFormField[] = []

  // Typeform uses different DOM structure
  // Try to find questions and inputs
  const questionContainers = document.querySelectorAll(
    '[class*="question"], [class*="Question"], [data-qa="question"]'
  )

  questionContainers.forEach((container, index) => {
    // Get question text
    const questionText = container.querySelector(
      '[class*="text"], [class*="label"], h1, h2, h3, p'
    )?.textContent?.trim() || `Question ${index + 1}`

    // Get input element (contenteditable or input)
    const input = container.querySelector(
      '[contenteditable="true"], input, textarea'
    )

    if (input) {
      const element = input as HTMLElement
      const placeholder = element.getAttribute('placeholder') || ''
      const currentValue = element.textContent?.trim() ||
                          (element as HTMLInputElement).value || ''

      fields.push({
        selector: generateTypeformSelector(container, index),
        tagName: element.tagName,
        type: element.getAttribute('data-type') ||
               (element as HTMLInputElement).type ||
               'text',
        name: `typeform_question_${index}`,
        id: element.id || `tf_q_${index}`,
        placeholder,
        ariaLabel: element.getAttribute('aria-label') || '',
        label: questionText,
        currentValue,
        required: true, // Typeform questions are usually required
        keywords: [questionText, placeholder].join(' ').toLowerCase(),
        category: guessCategory(questionText + ' ' + placeholder, '')
      })
    }
  })

  // Also try to find all contenteditable elements (fallback)
  if (fields.length === 0) {
    const editableElements = document.querySelectorAll('[contenteditable="true"]')
    editableElements.forEach((element, index) => {
      if (isVisible(element as HTMLElement)) {
        const parent = element.parentElement
        const labelText = parent?.querySelector('[class*="text"]')?.textContent?.trim() ||
                         parent?.querySelector('h1, h2, h3, p')?.textContent?.trim() ||
                         `Field ${index + 1}`

        fields.push({
          selector: `[contenteditable="true"]:nth-of-type(${index + 1})`,
          tagName: element.tagName,
          type: 'text',
          name: `typeform_field_${index}`,
          id: element.id || `tf_field_${index}`,
          placeholder: element.getAttribute('placeholder') || '',
          ariaLabel: element.getAttribute('aria-label') || '',
          label: labelText,
          currentValue: element.textContent?.trim() || '',
          required: true,
          keywords: [labelText].join(' ').toLowerCase(),
          category: guessCategory(labelText, '')
        })
      }
    })
  }

  return {
    fields,
    totalFields: fields.length,
    requiredFields: fields.length, // Typeform fields are usually required
    metadata: {
      url: window.location.href,
      pageTitle: document.title,
      formType: 'typeform-application',
      detectedATS: ['Typeform']
    }
  }
}

/**
 * Generate selector for Typeform fields
 */
function generateTypeformSelector(container: Element, index: number): string {
  // Try to get a unique selector for the Typeform question
  const dataQa = container.getAttribute('data-qa')
  if (dataQa) return `[data-qa="${dataQa}"]`

  const classes = container.className.split(' ').filter(c => c.length > 0)
  if (classes.length > 0) {
    const mainClass = classes.find(c => c.includes('question') || c.includes('Question'))
    if (mainClass) return `.${mainClass}`
  }

  // Fallback: nth-child selector
  return `[class*="question"]:nth-of-type(${index + 1})`
}

/**
 * Generate AI-ready context - sends EVERYTHING to AI!
 */
export function generateAIContextRaw(cvData: any): string {
  const extracted = extractAllFieldsRaw()

  let context = `# Form Analysis for ${window.location.href}\n\n`

  context += `## CV Data\n`
  context += `Name: ${cvData.personal?.firstName} ${cvData.personal?.lastName}\n`
  context += `Email: ${cvData.personal?.email}\n`
  context += `Phone: ${cvData.personal?.phone}\n`
  context += `Location: ${cvData.personal?.city}, ${cvData.personal?.state}\n`
  context += `Skills: ${cvData.skills?.technical?.join(', ') || 'N/A'}\n\n`

  context += `## Page Information\n`
  context += `- Page: ${extracted.metadata.pageTitle}\n`
  context += `- Form Type: ${extracted.metadata.formType}\n`
  context += `- ATS: ${extracted.metadata.detectedATS.join(', ') || 'None'}\n`
  context += `- Total Fields: ${extracted.totalFields}\n`
  context += `- Required Fields: ${extracted.requiredFields}\n\n`

  context += `## Form Fields (All ${extracted.fields.length} fields)\n\n`

  extracted.fields.forEach((field, i) => {
    context += `### Field ${i + 1}\n`
    context += `- Selector: \`${field.selector}\`\n`
    context += `- Type: ${field.type}\n`
    if (field.name) context += `- Name: "${field.name}"\n`
    if (field.id) context += `- ID: "${field.id}"\n`
    if (field.placeholder) context += `- Placeholder: "${field.placeholder}"\n`
    if (field.ariaLabel) context += `- Aria Label: "${field.ariaLabel}"\n`
    if (field.label !== 'Unknown') context += `- Label: "${field.label}"\n`
    if (field.required) context += `- Required: Yes\n`
    if (field.currentValue) context += `- Current: "${field.currentValue}"\n`
    if (field.options) {
      context += `- Options: ${field.options.map(o => `"${o.text}" (${o.value})`).join(', ')}\n`
    }
    context += `- Keywords: ${field.keywords}\n`
    context += `- Guessed Category: ${field.category}\n\n`
  })

  return context
}

/**
 * Lightweight export - just the raw data
 */
export type { RawFormField, ExtractedFormData }

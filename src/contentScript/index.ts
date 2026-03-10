console.info('contentScript is running')

// ============================================
// FORM FILLING ENGINE - Supports all form types
// ============================================

interface FormField {
  name: string
  value: string
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'file' | 'date'
}

interface FormFillData {
  personal: {
    firstName: string
    lastName: string
    email: string
    phone: string
    address?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
  }
  professional: {
    currentTitle?: string
    company?: string
    experience?: string
    skills?: string[]
    summary?: string
  }
  education: {
    degree?: string
    school?: string
    graduationYear?: string
  }
  coverLetter?: string
  resumeFile?: string
  customAnswers?: Record<string, string>
}

// Field name mappings - comprehensive patterns for different naming conventions
const FIELD_MAPPINGS: Record<string, string[]> = {
  // Personal Information
  firstName: ['firstName', 'first_name', 'fname', 'first-name', 'first', 'given-name', 'givenName'],
  lastName: ['lastName', 'last_name', 'lname', 'last-name', 'last', 'surname', 'family-name', 'familyName'],
  fullName: ['fullName', 'full_name', 'name', 'applicant-name', 'candidate-name'],
  email: ['email', 'e-mail', 'emailAddress', 'email_address', 'mail', 'applicant-email'],
  phone: ['phone', 'phoneNumber', 'phone_number', 'mobile', 'tel', 'cell', 'cellphone', 'applicant-phone'],

  // Address
  address: ['address', 'street', 'streetAddress', 'street_address', 'addr', 'location'],
  city: ['city', 'town', 'cityTown'],
  state: ['state', 'province', 'region', 'stateProvince'],
  zipCode: ['zip', 'zipCode', 'zip_code', 'postal', 'postalCode', 'postal_code', 'pincode'],
  country: ['country', 'countryCode', 'country_code'],

  // Professional
  currentTitle: ['title', 'jobTitle', 'job_title', 'position', 'currentTitle', 'current_title', 'role'],
  company: ['company', 'employer', 'organization', 'currentCompany', 'current_company'],
  experience: ['experience', 'yearsExperience', 'years_experience', 'yoe', 'exp'],
  skills: ['skills', 'keySkills', 'key_skills', 'technicalSkills', 'technical_skills'],
  linkedIn: ['linkedin', 'linkedIn', 'linkedinUrl', 'linkedin_url', 'linkedin-profile'],
  portfolio: ['portfolio', 'website', 'personalWebsite', 'github', 'githubUrl'],

  // Education
  degree: ['degree', 'education', 'highestDegree', 'highest_degree', 'qualification'],
  school: ['school', 'university', 'college', 'institution', 'almaMater'],
  graduationYear: ['gradYear', 'grad_year', 'graduationYear', 'graduation_year', 'yearGraduated'],

  // Application Specific
  coverLetter: ['coverLetter', 'cover_letter', 'coverletter', 'letter', 'message', 'additionalInfo'],
  resume: ['resume', 'cv', 'uploadResume', 'upload_resume', 'resumeFile', 'resume_file'],
  salary: ['salary', 'expectedSalary', 'expected_salary', 'salaryExpectation', 'pay'],
  startDate: ['startDate', 'start_date', 'availability', 'whenStart', 'noticePeriod'],
  referral: ['referral', 'referrer', 'howDidYouHear', 'source', 'referredBy'],
}

// ============================================
// FIELD DETECTION ENGINE
// ============================================

/**
 * AI-Based Field Detector - Uses semantic understanding instead of hardcoded patterns
 */
class AIFieldDetector {
  private cache = new Map<string, HTMLElement>()

  /**
   * Find the best matching field using AI semantic analysis
   */
  async findFieldWithAI(
    fieldType: string,
    cvData: any,
    getAIResponse: (prompt: string) => Promise<any>
  ): Promise<HTMLElement | null> {
    // Check cache first
    const cacheKey = `${fieldType}`
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    try {
      // Get all form fields
      const allFields = this.getAllFieldsWithMetadata()

      if (allFields.length === 0) {
        return null
      }

      // Build prompt for AI
      const prompt = this.buildAIPrompt(fieldType, cvData, allFields)

      // Ask AI to find the best match
      const aiResponse = await getAIResponse(prompt)

      if (!aiResponse || !aiResponse.bestMatch) {
        console.warn(`[AIFieldDetector] No AI match found for ${fieldType}`)
        return null
      }

      // Find the element by ID or selector returned by AI
      const matchedField = this.findFieldByAIResponse(aiResponse.bestMatch, allFields)

      if (matchedField) {
        // Cache the result
        this.cache.set(cacheKey, matchedField)
        console.log(`[AIFieldDetector] ✓ Matched "${fieldType}" to field:`, this.getFieldIdentifier(matchedField))
      }

      return matchedField
    } catch (error) {
      console.error(`[AIFieldDetector] Error finding field for ${fieldType}:`, error)
      return null
    }
  }

  /**
   * Get all form fields with their metadata
   */
  private getAllFieldsWithMetadata(): Array<{
    element: HTMLElement
    name: string
    id: string
    type: string
    placeholder: string
    label: string
    ariaLabel: string
  }> {
    const fields: any[] = []
    const selectors = [
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"])',
      'textarea',
      'select',
    ]

    document.querySelectorAll(selectors.join(', ')).forEach(el => {
      if (!this.isFieldAvailable(el as HTMLElement)) return

      const field = el as HTMLInputElement
      fields.push({
        element: el as HTMLElement,
        name: field.name || '',
        id: field.id || '',
        type: field.type || el.tagName.toLowerCase(),
        placeholder: field.placeholder || '',
        label: this.findLabelForField(el as HTMLElement) || '',
        ariaLabel: field.getAttribute('aria-label') || '',
      })
    })

    return fields
  }

  /**
   * Build AI prompt for field matching
   */
  private buildAIPrompt(fieldType: string, cvData: any, fields: any[]): string {
    const fieldsDescription = fields.map(f => ({
      selector: f.id ? `#${f.id}` : f.name ? `[name="${f.name}"]` : 'unknown',
      name: f.name || 'none',
      id: f.id || 'none',
      type: f.type,
      placeholder: f.placeholder || 'none',
      label: f.label || 'none',
      ariaLabel: f.ariaLabel || 'none',
    }))

    return `You are a form field matching expert. I need you to match a fieldType to the best form field.

**Target FieldType:** ${fieldType}

**Available CV Data:**
${JSON.stringify(cvData, null, 2)}

**Available Form Fields:**
${JSON.stringify(fieldsDescription, null, 2)}

**Your Task:**
1. Understand what the fieldType is asking for (e.g., "firstName" = person's first name)
2. Look at the available fields and find the BEST semantic match
3. Consider: field names, labels, placeholders, types, and aria-labels
4. Think about variations like "first_name", "fname", "given-name", "First Name", etc.
5. Be smart about context - "currentAddress" could match "address" or "location"

**Rules:**
- Match by semantic meaning, NOT exact string matching
- Consider common naming conventions (camelCase, snake_case, kebab-case)
- Labels are often more descriptive than field names
- Return the selector (CSS selector like #id or [name="..."])

**Return ONLY this JSON format:**
{
  "bestMatch": "#field-id or [name='field-name']",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation of why this field matches"
}`
  }

  /**
   * Find field element by AI response
   */
  private findFieldByAIResponse(selector: string, fields: any[]): HTMLElement | null {
    try {
      // Try the selector directly
      const element = document.querySelector(selector)
      if (element && this.isFieldAvailable(element as HTMLElement)) {
        return element as HTMLElement
      }

      // Fallback: search in our field list
      for (const field of fields) {
        const fieldIdentifier = this.getFieldIdentifier(field.element)
        if (selector.includes(fieldIdentifier)) {
          return field.element
        }
      }

      return null
    } catch (error) {
      console.error('[AIFieldDetector] Error finding field by AI response:', error)
      return null
    }
  }

  /**
   * Find label text for a field
   */
  private findLabelForField(field: HTMLElement): string | null {
    // Check for label with htmlFor
    if (field.id) {
      const label = document.querySelector(`label[for="${field.id}"]`)
      if (label) return label.textContent?.trim() || null
    }

    // Check for parent label
    const parentLabel = field.closest('label')
    if (parentLabel) {
      // Get text excluding the input itself
      const clone = parentLabel.cloneNode(true) as HTMLElement
      const inputInClone = clone.querySelector('input, textarea, select')
      if (inputInClone) inputInClone.remove()
      return clone.textContent?.trim() || null
    }

    // Check for nearby label (previous sibling or parent's previous sibling)
    let previous = field.previousElementSibling
    if (previous?.matches('label')) {
      return previous.textContent?.trim() || null
    }

    if (field.parentElement) {
      const parentPrevious = field.parentElement.previousElementSibling
      if (parentPrevious?.matches('label')) {
        return parentPrevious.textContent?.trim() || null
      }
    }

    return null
  }

  /**
   * Check if field is available (visible and enabled)
   */
  private isFieldAvailable(el: HTMLElement): boolean {
    const style = window.getComputedStyle(el)
    const rect = el.getBoundingClientRect()

    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      rect.width > 0 &&
      rect.height > 0 &&
      !(el as HTMLInputElement).disabled
    )
  }

  /**
   * Get field identifier for logging/debugging
   */
  private getFieldIdentifier(field: HTMLElement): string {
    const id = field.id
    const name = (field as HTMLInputElement).name
    return id ? `#${id}` : name ? `[name="${name}"]` : 'unknown'
  }

  /**
   * Clear cache (call when form changes)
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Find all fields containing a keyword (dynamic approach)
   */
  findAllFieldsContaining(keyword: string): HTMLElement[] {
    const keywordLower = keyword.toLowerCase()
    const fields: HTMLElement[] = []

    const allFields = this.getAllFieldsWithMetadata()

    for (const field of allFields) {
      // Check all attributes and label for keyword
      const searchStrings = [
        field.name,
        field.id,
        field.placeholder,
        field.label,
        field.ariaLabel,
      ].join(' ').toLowerCase()

      if (searchStrings.includes(keywordLower)) {
        fields.push(field.element)
      }
    }

    return fields
  }
}

/**
 * Hybrid Field Detector - Uses AI first, falls back to patterns
 * Combines the best of both approaches
 */
class HybridFieldDetector {
  private aiDetector = new AIFieldDetector()
  private patternDetector = new FieldDetector()

  /**
   * Find field using AI first, fallback to patterns
   */
  async findField(
    fieldType: string,
    cvData: any,
    getAIResponse: (prompt: string) => Promise<any>
  ): Promise<HTMLElement | null> {
    // Try AI first (smarter, handles variations)
    try {
      const aiField = await this.aiDetector.findFieldWithAI(fieldType, cvData, getAIResponse)
      if (aiField) {
        console.log(`[HybridFieldDetector] ✓ AI found field for ${fieldType}`)
        return aiField
      }
    } catch (error) {
      console.warn(`[HybridFieldDetector] AI failed for ${fieldType}, trying patterns...`)
    }

    // Fallback to pattern matching (fast, reliable)
    console.log(`[HybridFieldDetector] Trying pattern matching for ${fieldType}`)
    return this.patternDetector.findField(fieldType)
  }

  /**
   * Find all fields containing a keyword
   */
  findAllFieldsContaining(keyword: string): HTMLElement[] {
    return this.aiDetector.findAllFieldsContaining(keyword)
  }

  /**
   * Clear cache when form changes
   */
  clearCache(): void {
    this.aiDetector.clearCache()
  }
}

class FieldDetector {
  private getAllPossibleSelectors(fieldType: string): string {
    const patterns = FIELD_MAPPINGS[fieldType] || [fieldType]
    const selectors: string[] = []

    patterns.forEach(pattern => {
      // Input fields
      selectors.push(`input[name*="${pattern}" i]`)
      selectors.push(`input[id*="${pattern}" i]`)
      selectors.push(`input[placeholder*="${pattern}" i]`)
      selectors.push(`input[data-field*="${pattern}" i]`)
      selectors.push(`input[aria-label*="${pattern}" i]`)

      // Textareas
      selectors.push(`textarea[name*="${pattern}" i]`)
      selectors.push(`textarea[id*="${pattern}" i]`)
      selectors.push(`textarea[placeholder*="${pattern}" i]`)

      // Selects
      selectors.push(`select[name*="${pattern}" i]`)
      selectors.push(`select[id*="${pattern}" i]`)

      // Note: :has-text() is NOT a valid CSS selector for querySelectorAll
      // Label text matching is handled separately in findByLabelText() method
    })

    return selectors.join(', ')
  }

  findField(fieldType: string): HTMLElement | null {
    const selector = this.getAllPossibleSelectors(fieldType)
    const elements = document.querySelectorAll(selector)

    // Return the first visible, enabled field
    for (const el of Array.from(elements)) {
      if (this.isFieldAvailable(el as HTMLElement)) {
        return el as HTMLElement
      }
    }

    // Try fuzzy label matching
    return this.findByLabelText(fieldType)
  }

  private isFieldAvailable(el: HTMLElement): boolean {
    const style = window.getComputedStyle(el)
    const rect = el.getBoundingClientRect()

    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      rect.width > 0 &&
      rect.height > 0 &&
      !(el as HTMLInputElement).disabled
    )
  }

  private findByLabelText(fieldType: string): HTMLElement | null {
    const patterns = FIELD_MAPPINGS[fieldType] || []
    const labels = document.querySelectorAll('label, .label, .field-label, .form-label')

    for (const label of Array.from(labels)) {
      const text = label.textContent?.toLowerCase() || ''

      for (const pattern of patterns) {
        if (text.includes(pattern.toLowerCase())) {
          // Find associated input
          const htmlFor = (label as HTMLLabelElement).htmlFor
          if (htmlFor) {
            const input = document.getElementById(htmlFor)
            if (input) return input
          }

          // Check for input inside or next to label
          const input = label.querySelector('input, textarea, select')
          if (input) return input as HTMLElement

          // Check next sibling
          const next = label.nextElementSibling
          if (next?.matches('input, textarea, select')) {
            return next as HTMLElement
          }
        }
      }
    }

    return null
  }

  findAllFormFields(): HTMLElement[] {
    const fields: HTMLElement[] = []
    const selectors = [
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"])',
      'textarea',
      'select',
    ]

    document.querySelectorAll(selectors.join(', ')).forEach(el => {
      if (this.isFieldAvailable(el as HTMLElement)) {
        fields.push(el as HTMLElement)
      }
    })

    return fields
  }
}

// ============================================
// FORM FILLING STRATEGIES
// ============================================

class FormFiller {
  private hybridDetector = new HybridFieldDetector()
  private aiDetector = new AIFieldDetector() // For direct access
  private patternDetector = new FieldDetector() // Fallback

  /**
   * AI-Powered Form Filling - Uses semantic understanding
   */
  async fillForm(
    data: FormFillData,
    getAIResponse?: (prompt: string) => Promise<any>,
    onProgress?: (fieldName: string, status: 'filled' | 'failed' | 'pending', label: string) => void
  ): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = []
    const failed: string[] = []

    // If no AI response function provided, use pattern matching only
    if (!getAIResponse) {
      return await this.fillFormWithPatterns(data)
    }

    // 🎯 Helper function to send progress updates
    const trackProgress = (fieldName: string, status: 'filled' | 'failed' | 'pending', label: string) => {
      onProgress?.(fieldName, status, label)
    }

    // 🎯 Send initial pending updates for all fields we'll try to fill
    const fieldsToFill = [
      { field: 'fullName', label: 'Full Name' },
      { field: 'firstName', label: 'First Name' },
      { field: 'lastName', label: 'Last Name' },
      { field: 'email', label: 'Email' },
      { field: 'phone', label: 'Phone' },
      { field: 'address', label: 'Address' },
      { field: 'currentTitle', label: 'Current Title' },
      { field: 'company', label: 'Company' },
      { field: 'summary', label: 'Professional Summary' },
      { field: 'degree', label: 'Degree' },
      { field: 'school', label: 'School' },
      { field: 'coverLetter', label: 'Cover Letter' },
    ]

    // Send pending status for all fields first with a small delay
    await new Promise(resolve => setTimeout(resolve, 50))
    for (const field of fieldsToFill) {
      trackProgress(field.field, 'pending', field.label)
    }
    await new Promise(resolve => setTimeout(resolve, 50))

    // Personal Information
    // Try fullName first, then firstName + lastName separately
    const fullName = `${data.personal.firstName} ${data.personal.lastName}`.trim()
    if (await this.fillTextFieldWithAI('fullName', fullName, data, getAIResponse)) {
      success.push('fullName')
      trackProgress('fullName', 'filled', 'Full Name')
    } else {
      // fullName not found, try separate fields
      if (await this.fillTextFieldWithAI('firstName', data.personal.firstName, data, getAIResponse)) {
        success.push('firstName')
        trackProgress('firstName', 'filled', 'First Name')
      } else {
        failed.push('firstName')
        trackProgress('firstName', 'failed', 'First Name')
      }

      if (await this.fillTextFieldWithAI('lastName', data.personal.lastName, data, getAIResponse)) {
        success.push('lastName')
        trackProgress('lastName', 'filled', 'Last Name')
      } else {
        failed.push('lastName')
        trackProgress('lastName', 'failed', 'Last Name')
      }
    }

    if (await this.fillTextFieldWithAI('email', data.personal.email, data, getAIResponse)) {
      success.push('email')
      trackProgress('email', 'filled', 'Email')
    } else {
      failed.push('email')
      trackProgress('email', 'failed', 'Email')
    }

    if (await this.fillTextFieldWithAI('phone', data.personal.phone, data, getAIResponse)) {
      success.push('phone')
      trackProgress('phone', 'filled', 'Phone')
    } else {
      failed.push('phone')
      trackProgress('phone', 'failed', 'Phone')
    }

    // NEW: Fill ALL address fields with combined address
    if (data.personal.address || data.personal.city || data.personal.state || data.personal.country) {
      const filledAddresses = await this.fillAllAddressFields(data, getAIResponse, trackProgress)
      filledAddresses.forEach(field => success.push(field))
    }

    // Professional
    if (data.professional?.currentTitle) {
      if (await this.fillTextFieldWithAI('currentTitle', data.professional.currentTitle, data, getAIResponse)) {
        success.push('currentTitle')
        trackProgress('currentTitle', 'filled', 'Current Title')
      }
    }

    if (data.professional?.company) {
      if (await this.fillTextFieldWithAI('company', data.professional.company, data, getAIResponse)) {
        success.push('company')
        trackProgress('company', 'filled', 'Company')
      }
    }

    if (data.professional?.summary) {
      if (await this.fillTextareaWithAI('summary', data.professional.summary, data, getAIResponse)) {
        success.push('summary')
        trackProgress('summary', 'filled', 'Professional Summary')
      }
    }

    // Education
    if (data.education?.degree) {
      if (await this.fillTextFieldWithAI('degree', data.education.degree, data, getAIResponse)) {
        success.push('degree')
        trackProgress('degree', 'filled', 'Degree')
      }
    }

    if (data.education?.school) {
      if (await this.fillTextFieldWithAI('school', data.education.school, data, getAIResponse)) {
        success.push('school')
        trackProgress('school', 'filled', 'School')
      }
    }

    // Cover Letter
    if (data.coverLetter) {
      if (await this.fillTextareaWithAI('coverLetter', data.coverLetter, data, getAIResponse)) {
        success.push('coverLetter')
        trackProgress('coverLetter', 'filled', 'Cover Letter')
      }
    }

    // Professional
    if (data.professional?.currentTitle) {
      if (await this.fillTextField('currentTitle', data.professional.currentTitle)) success.push('currentTitle')
    }

    if (data.professional?.company) {
      if (await this.fillTextField('company', data.professional.company)) success.push('company')
    }

    if (data.professional?.summary) {
      if (await this.fillTextarea('summary', data.professional.summary)) success.push('summary')
    }

    // Education
    if (data.education?.degree) {
      if (await this.fillTextField('degree', data.education.degree)) success.push('degree')
    }

    if (data.education?.school) {
      if (await this.fillTextField('school', data.education.school)) success.push('school')
    }

    // Cover Letter
    if (data.coverLetter) {
      if (await this.fillTextarea('coverLetter', data.coverLetter)) success.push('coverLetter')
    }

    // Custom answers for specific questions
    if (data.customAnswers) {
      for (const [question, answer] of Object.entries(data.customAnswers)) {
        if (await this.fillByQuestionText(question, answer)) {
          success.push(`custom: ${question}`)
        }
      }
    }

    return { success, failed }
  }

  /**
   * Fallback: Fill form using pattern matching (no AI)
   */
  private async fillFormWithPatterns(data: FormFillData): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = []
    const failed: string[] = []

    // Personal Information
    const fullName = `${data.personal.firstName} ${data.personal.lastName}`.trim()
    if (await this.fillTextField('fullName', fullName)) {
      success.push('fullName')
    } else {
      if (await this.fillTextField('firstName', data.personal.firstName)) success.push('firstName')
      else failed.push('firstName')

      if (await this.fillTextField('lastName', data.personal.lastName)) success.push('lastName')
      else failed.push('lastName')
    }

    if (await this.fillTextField('email', data.personal.email)) success.push('email')
    else failed.push('email')

    if (await this.fillTextField('phone', data.personal.phone)) success.push('phone')
    else failed.push('phone')

    // Fill ALL address fields with combined address
    if (data.personal.address || data.personal.city || data.personal.state || data.personal.country) {
      const filledAddresses = await this.fillAllAddressFieldsPattern(data)
      filledAddresses.forEach((field: string) => success.push(field))
    }

    // Professional
    if (data.professional?.currentTitle) {
      if (await this.fillTextField('currentTitle', data.professional.currentTitle)) success.push('currentTitle')
    }

    if (data.professional?.company) {
      if (await this.fillTextField('company', data.professional.company)) success.push('company')
    }

    if (data.professional?.summary) {
      if (await this.fillTextarea('summary', data.professional.summary)) success.push('summary')
    }

    // Education
    if (data.education?.degree) {
      if (await this.fillTextField('degree', data.education.degree)) success.push('degree')
    }

    if (data.education?.school) {
      if (await this.fillTextField('school', data.education.school)) success.push('school')
    }

    // Cover Letter
    if (data.coverLetter) {
      if (await this.fillTextarea('coverLetter', data.coverLetter)) success.push('coverLetter')
    }

    return { success, failed }
  }

  /**
   * Fill text field using AI-powered field detection
   */
  private async fillTextFieldWithAI(
    fieldType: string,
    value: string,
    cvData: FormFillData,
    getAIResponse: (prompt: string) => Promise<any>
  ): Promise<boolean> {
    try {
      const field = await this.hybridDetector.findField(fieldType, cvData, getAIResponse)
      if (!field) return false

      const input = field as HTMLInputElement
      input.value = value
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))

      return true
    } catch (error) {
      console.error(`[FormFiller] Error filling ${fieldType}:`, error)
      return false
    }
  }

  /**
   * Fill textarea using AI-powered field detection
   */
  private async fillTextareaWithAI(
    fieldType: string,
    value: string,
    cvData: FormFillData,
    getAIResponse: (prompt: string) => Promise<any>
  ): Promise<boolean> {
    try {
      const field = await this.hybridDetector.findField(fieldType, cvData, getAIResponse)
      if (!field) return false

      const textarea = field as HTMLTextAreaElement
      textarea.focus()
      textarea.value = value
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      textarea.dispatchEvent(new Event('change', { bubbles: true }))

      // Auto-resize if needed
      textarea.style.height = 'auto'
      textarea.style.height = textarea.scrollHeight + 'px'

      return true
    } catch (error) {
      console.error(`[FormFiller] Error filling ${fieldType}:`, error)
      return false
    }
  }

  /**
   * Fill ALL address fields with combined address (AI-powered)
   */
  private async fillAllAddressFields(
    data: FormFillData,
    getAIResponse: (prompt: string) => Promise<any>,
    onProgress?: (fieldName: string, status: 'filled' | 'failed' | 'pending', label: string) => void
  ): Promise<string[]> {
    const filled: string[] = []

    // Combine all address parts into one string
    const fullAddress = [
      data.personal.address,
      data.personal.city,
      data.personal.state,
      data.personal.country
    ].filter(Boolean).join(', ')

    console.log('[FormFiller] Combined address:', fullAddress)

    // Find ALL fields containing "address" (dynamic, no hardcoded patterns)
    const addressFields = this.aiDetector.findAllFieldsContaining('address')

    console.log(`[FormFiller] Found ${addressFields.length} address fields`)

    // Fill all of them
    for (const field of addressFields) {
      try {
        const input = field as HTMLInputElement
        input.value = fullAddress
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))

        const fieldId = field.id || (field as HTMLInputElement).name || 'unknown'
        filled.push(`address: ${fieldId}`)
        console.log(`[FormFiller] ✓ Filled address field: ${fieldId}`)

        // 🎯 Send progress update for each address field
        onProgress?.('address', 'filled', 'Address')
      } catch (error) {
        console.error('[FormFiller] Error filling address field:', error)
        onProgress?.('address', 'failed', 'Address')
      }
    }

    return filled
  }

  /**
   * Fill ALL address fields using pattern matching (fallback)
   */
  private async fillAllAddressFieldsPattern(data: FormFillData): Promise<string[]> {
    const filled: string[] = []

    // Combine all address parts
    const fullAddress = [
      data.personal.address,
      data.personal.city,
      data.personal.state,
      data.personal.country
    ].filter(Boolean).join(', ')

    // Try to find and fill any field with "address" in the name
    const allFields = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea'
    )

    for (const field of Array.from(allFields)) {
      const attrs = [
        (field as HTMLInputElement).name || '',
        field.id || '',
        (field as HTMLInputElement).placeholder || '',
        (field as HTMLInputElement).getAttribute('aria-label') || ''
      ].join(' ').toLowerCase()

      // Also check label text
      const label = this.findLabelForField(field as HTMLElement)
      const labelText = label?.textContent?.toLowerCase() || ''

      if (attrs.includes('address') || labelText.includes('address')) {
        try {
          (field as HTMLInputElement).value = fullAddress
          field.dispatchEvent(new Event('input', { bubbles: true }))
          field.dispatchEvent(new Event('change', { bubbles: true }))
          filled.push(`address: ${field.id || (field as HTMLInputElement).name || 'unknown'}`)
        } catch (error) {
          console.error('[FormFiller] Error filling address field:', error)
        }
      }
    }

    return filled
  }

  /**
   * Find label for a field
   */
  private findLabelForField(field: HTMLElement): HTMLElement | null {
    // Check for label with htmlFor
    if (field.id) {
      const label = document.querySelector(`label[for="${field.id}"]`)
      if (label) return label as HTMLElement
    }

    // Check for parent label
    const parentLabel = field.closest('label')
    if (parentLabel) return parentLabel as HTMLElement

    // Check for nearby label
    let previous = field.previousElementSibling
    if (previous?.matches('label')) {
      return previous as HTMLElement
    }

    if (field.parentElement) {
      const parentPrevious = field.parentElement.previousElementSibling
      if (parentPrevious?.matches('label')) {
        return parentPrevious as HTMLElement
      }
    }

    return null
  }

  private async fillTextField(fieldType: string, value: string): Promise<boolean> {
    const field = this.patternDetector.findField(fieldType)
    if (!field) return false

    const input = field as HTMLInputElement
    input.value = value
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))

    return true
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private async fillTextarea(fieldType: string, value: string): Promise<boolean> {
    const field = this.patternDetector.findField(fieldType)
    if (!field) return false

    const textarea = field as HTMLTextAreaElement

    textarea.focus()
    textarea.value = value
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    textarea.dispatchEvent(new Event('change', { bubbles: true }))

    // Auto-resize if needed
    textarea.style.height = 'auto'
    textarea.style.height = textarea.scrollHeight + 'px'

    return true
  }

  private async fillSelect(fieldType: string, value: string): Promise<boolean> {
    const field = this.patternDetector.findField(fieldType)
    if (!field || field.tagName !== 'SELECT') return false

    const select = field as HTMLSelectElement

    // Try exact match first
    for (let i = 0; i < select.options.length; i++) {
      const option = select.options[i]
      if (option.value === value || option.text === value) {
        select.selectedIndex = i
        select.dispatchEvent(new Event('change', { bubbles: true }))
        return true
      }
    }

    // Try partial match
    for (let i = 0; i < select.options.length; i++) {
      const option = select.options[i]
      if (option.text.toLowerCase().includes(value.toLowerCase())) {
        select.selectedIndex = i
        select.dispatchEvent(new Event('change', { bubbles: true }))
        return true
      }
    }

    return false
  }

  private async fillByQuestionText(question: string, answer: string): Promise<boolean> {
    // Find labels containing the question text
    const labels = document.querySelectorAll('label, .question, .field-label, legend, h3, h4')

    for (const label of Array.from(labels)) {
      const text = label.textContent?.toLowerCase() || ''

      if (text.includes(question.toLowerCase())) {
        // Find associated input
        let input: HTMLElement | null = null

        // Check for input inside label
        input = label.querySelector('input, textarea, select')

        // Check for input referenced by htmlFor
        if (!input && (label as HTMLLabelElement).htmlFor) {
          input = document.getElementById((label as HTMLLabelElement).htmlFor)
        }

        // Check next sibling
        if (!input) {
          const next = label.nextElementSibling
          if (next?.matches('input, textarea, select')) {
            input = next as HTMLElement
          }
        }

        // Check parent's next sibling
        if (!input && label.parentElement) {
          const parentNext = label.parentElement.nextElementSibling
          if (parentNext?.querySelector('input, textarea, select')) {
            input = parentNext.querySelector('input, textarea, select') as HTMLElement
          }
        }

        if (input) {
          if (input.tagName === 'INPUT') {
            ; (input as HTMLInputElement).value = answer
          } else if (input.tagName === 'TEXTAREA') {
            ; (input as HTMLTextAreaElement).value = answer
          }
          input.dispatchEvent(new Event('input', { bubbles: true }))
          input.dispatchEvent(new Event('change', { bubbles: true }))
          return true
        }
      }
    }

    return false
  }

  // ============================================
  // MULTI-STEP / SLIDING FORM HANDLING
  // ============================================

  async handleMultiStepForm(data: FormFillData): Promise<void> {
    // Fill current step
    await this.fillForm(data)

    // Look for and click next/submit buttons
    const nextButton = this.findNextButton()
    if (nextButton) {
      nextButton.click()

      // Wait for next step to load
      await this.waitForStepTransition()

      // Recursively fill next step
      await this.handleMultiStepForm(data)
    }
  }

  private findNextButton(): HTMLElement | null {
    const buttonSelectors = [
      'button[type="submit"]',
      'button:contains("Next")',
      'button:contains("Continue")',
      'button:contains("Save")',
      '.next-button',
      '.continue-button',
      '[data-testid="next-button"]',
      'input[type="submit"]',
    ]

    for (const selector of buttonSelectors) {
      // Simple selector
      if (!selector.includes(':contains')) {
        const btn = document.querySelector(selector) as HTMLElement
        if (btn && this.isVisible(btn)) return btn
      } else {
        // Text-based selector
        const text = selector.match(/:contains\("([^"]+)"\)/)?.[1]
        if (text) {
          const buttons = document.querySelectorAll('button, input[type="submit"]')
          for (const btn of Array.from(buttons)) {
            if (btn.textContent?.includes(text) && this.isVisible(btn as HTMLElement)) {
              return btn as HTMLElement
            }
          }
        }
      }
    }

    return null
  }

  private isVisible(el: HTMLElement): boolean {
    const style = window.getComputedStyle(el)
    return style.display !== 'none' && style.visibility !== 'hidden'
  }

  private async waitForStepTransition(): Promise<void> {
    // Wait for any loading indicators to disappear
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Wait for new form fields to appear
    let attempts = 0
    while (attempts < 10) {
      const fields = this.patternDetector.findAllFormFields()
      if (fields.length > 0) return
      await new Promise(resolve => setTimeout(resolve, 500))
      attempts++
    }
  }

  // ============================================
  // DYNAMIC FORM DETECTION
  // ============================================

  observeFormChanges(callback: () => void): void {
    const observer = new MutationObserver(mutations => {
      let shouldCallback = false

      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of Array.from(mutation.addedNodes)) {
            if (node instanceof HTMLElement) {
              if (node.matches('input, textarea, select') || node.querySelector('input, textarea, select')) {
                shouldCallback = true
              }
            }
          }
        }
      }

      if (shouldCallback) {
        callback()
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }
}

// ============================================
// MESSAGE HANDLING
// ============================================

const formFiller = new FormFiller()

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Ping to check if content script is loaded
  if (request.action === 'ping') {
    sendResponse({ success: true, message: 'pong' })
    return
  }

  if (request.action === 'fillForm') {
    // Create AI response wrapper
    const getAIResponse = async (prompt: string) => {
      const response = await chrome.runtime.sendMessage({
        action: 'askAI',
        prompt
      })
      return response?.data
    }

    // 🎯 Progress callback for dynamic UI updates
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
    return true // Keep channel open for async
  }

  // 🧠 Fill form with AI mappings (new approach)
  if (request.action === 'fillFormWithMappings') {
    console.log('[ContentScript] fillFormWithMappings - Starting async operation')

    // Use IIFE pattern for async support
    ;(async () => {
      const { mappings } = request

      console.log('[ContentScript] Filling form with AI mappings:', mappings.length)

      let filledCount = 0
      let failedCount = 0
      const results: { success: string[]; failed: string[] } = {
        success: [],
        failed: []
      }

      // 🎯 Progress callback for dynamic UI updates
      const sendProgress = (fieldName: string, status: 'filled' | 'failed' | 'pending', label: string) => {
        chrome.runtime.sendMessage({
          action: 'formFillProgressUpdate',
          field: { fieldName, status, label }
        }).catch(err => console.log('[Progress] Failed to send:', err))
      }

      // Process each mapping
      for (const mapping of mappings) {
        const { fieldId, fieldName, detectedAs, valueToFill } = mapping

        // Send pending status
        sendProgress(fieldId, 'pending', detectedAs)

        // Skip if no value to fill
        if (!valueToFill) {
          console.log(`[ContentScript] Skipping ${detectedAs} (no value)`)
          sendProgress(fieldId, 'failed', detectedAs)
          results.failed.push(fieldId)
          failedCount++
          continue
        }

        try {
          // Find element by ID or name
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

          // Fill the field based on type
          if (element.tagName === 'SELECT') {
            // Handle select dropdown
            const selectElement = element as HTMLSelectElement
            const options = Array.from(selectElement.options)

            // Try to find matching option (case-insensitive, partial match)
            const matchedOption = options.find(opt =>
              opt.value.toLowerCase() === valueToFill.toLowerCase() ||
              opt.text.toLowerCase() === valueToFill.toLowerCase() ||
              opt.text.toLowerCase().includes(valueToFill.toLowerCase())
            )

            if (matchedOption) {
              selectElement.value = matchedOption.value
              // Trigger change event
              selectElement.dispatchEvent(new Event('change', { bubbles: true }))
              console.log(`[ContentScript] ✓ Filled ${detectedAs}: ${valueToFill}`)
              sendProgress(fieldId, 'filled', detectedAs)
              results.success.push(fieldId)
              filledCount++
            } else {
              console.warn(`[ContentScript] No matching option for ${detectedAs}: ${valueToFill}`)
              sendProgress(fieldId, 'failed', detectedAs)
              results.failed.push(fieldId)
              failedCount++
            }
          } else {
            // Handle input/textarea
            const inputElement = element as HTMLInputElement | HTMLTextAreaElement
            inputElement.value = valueToFill

            // Trigger input and change events
            inputElement.dispatchEvent(new Event('input', { bubbles: true }))
            inputElement.dispatchEvent(new Event('change', { bubbles: true }))

            console.log(`[ContentScript] ✓ Filled ${detectedAs}: ${valueToFill}`)
            sendProgress(fieldId, 'filled', detectedAs)
            results.success.push(fieldId)
            filledCount++
          }

          // Small delay between fills (natural typing simulation)
          await new Promise(resolve => setTimeout(resolve, 100))

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

    return true // Keep channel open for async
  }

  if (request.action === 'fillMultiStepForm') {
    formFiller.handleMultiStepForm(request.data)
      .then(() => {
        sendResponse({ success: true })
      })
      .catch((error: Error) => {
        console.error('[ContentScript] fillMultiStepForm error:', error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (request.action === 'detectFields') {
    const detector = new FieldDetector()
    const fields = detector.findAllFormFields().map(f => ({
      tagName: f.tagName,
      type: (f as HTMLInputElement).type || f.tagName.toLowerCase(),
      name: (f as HTMLInputElement).name || '',
      id: f.id || '',
      placeholder: (f as HTMLInputElement).placeholder || '',
    }))
    sendResponse({ fields })
  }

  if (request.action === 'scanJobDescription') {
    const jobText = extractJobDescription()
    sendResponse({ jobDescription: jobText })
  }

  if (request.action === 'extractFormFields') {
    // Import and use V2 (AI-first approach - no hardcoded patterns!)
    import('../utils/formFieldExtractorV2').then(({ extractAllFieldsRaw }) => {
      const cvData = request.cvData
      const extracted = extractAllFieldsRaw()

      // Add priority for UI display (calculated on-the-fly)
      const fieldsWithPriority = extracted.fields.map(field => ({
        ...field,
        priority: calculateFieldPriority(field, cvData),
        label: field.label || field.placeholder || field.name || field.id || 'Unknown',
        type: field.type
      }))

      // Calculate stats
      const highPriorityFields = fieldsWithPriority.filter(f => f.priority === 'high').length
      const estimatedFillable = highPriorityFields

      // Add current page info
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
    return true // Keep channel open for async
  }

  if (request.action === 'extractFormFieldsWithToon') {
    // Import both V2 extractor and Toon formatter
    Promise.all([
      import('../utils/formFieldExtractorV2'),
      import('../utils/toonFormatter')
    ]).then(([{ extractAllFieldsRaw }, { convertToToonFields, encodeToon }]) => {
      const extracted = extractAllFieldsRaw()

      // Add priority for UI display
      const fieldsWithPriority = extracted.fields.map(field => ({
        ...field,
        priority: 'high', // Simplified priority for Toon view
        label: field.label || field.placeholder || field.name || field.id || 'Unknown',
        type: field.type
      }))

      // Convert to Toon format
      const toonFields = convertToToonFields({ fields: fieldsWithPriority, metadata: extracted.metadata })
      const toonFormat = encodeToon({ fields: toonFields, metadata: extracted.metadata })

      // Calculate stats
      const highPriorityFields = fieldsWithPriority.filter(f => f.priority === 'high').length

      sendResponse({
        success: true,
        url: extracted.metadata.url,
        pageTitle: extracted.metadata.pageTitle,
        formType: extracted.metadata.formType,
        detectedATS: extracted.metadata.detectedATS,
        totalFields: extracted.totalFields,
        highPriorityFields,
        estimatedFillable: highPriorityFields,
        fields: fieldsWithPriority,
        toonFormat // Include Toon format string
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
    return true // Keep channel open for async
  }

  // NEW: Smart Auto-Fill with AI (NO hardcoded patterns)
  if (request.action === 'smartAutoFill') {
    import('../utils/smartFormHandler').then(async ({ smartAutoFill }) => {
      // Create AI response wrapper that calls background script
      const getAIResponse = async (prompt: string) => {
        const response = await chrome.runtime.sendMessage({
          action: 'askAI',
          prompt
        })
        return response?.data
      }

      const result = await smartAutoFill(
        request.cvData,
        getAIResponse,
        {
          autoSubmit: request.autoSubmit || false,
          delayMs: request.delayMs || 100,
          maxSteps: request.maxSteps || 20,
          onProgress: (msg: string) => {
            // Send progress updates
            chrome.runtime.sendMessage({
              action: 'autoFillProgress',
              message: msg
            })
          },
          onStepProgress: (step: number, msg: string) => {
            chrome.runtime.sendMessage({
              action: 'autoFillProgress',
              step,
              message: msg
            })
          }
        }
      )

      sendResponse({ success: true, result })
    }).catch((error: Error) => {
      console.error('[SmartAutoFill] Error:', error)
      sendResponse({
        success: false,
        error: error.message
      })
    })
    return true // Keep channel open for async
  }

  // NEW: Form analysis (without filling)
  if (request.action === 'analyzeForm') {
    import('../utils/smartFormHandler').then(async ({ analyzeForm }) => {
      const getAIResponse = async (prompt: string) => {
        const response = await chrome.runtime.sendMessage({
          action: 'askAI',
          prompt
        })
        return response?.data
      }

      const analysis = await analyzeForm(getAIResponse)
      sendResponse({ success: true, analysis })
    }).catch((error: Error) => {
      console.error('[FormAnalysis] Error:', error)
      sendResponse({
        success: false,
        error: error.message
      })
    })
    return true // Keep channel open for async
  }
})

function extractJobDescription(): string {
  // Common selectors for job descriptions
  const selectors = [
    '[data-testid="job-description"]',
    '.job-description',
    '.description',
    '#job-description',
    '[class*="description"]',
    '[class*="jobDetails"]',
    'article',
  ]

  for (const selector of selectors) {
    const el = document.querySelector(selector)
    if (el) {
      return el.textContent || ''
    }
  }

  // Fallback: look for large text blocks
  const paragraphs = document.querySelectorAll('p')
  let longestText = ''

  for (const p of Array.from(paragraphs)) {
    const text = p.textContent || ''
    if (text.length > longestText.length && text.length > 200) {
      longestText = text
    }
  }

  return longestText
}

function detectFormType(): string {
  const titleLower = document.title.toLowerCase()
  const urlLower = window.location.href.toLowerCase()

  if (titleLower.includes('apply') || urlLower.includes('apply')) return 'job-application'
  if (titleLower.includes('contact') || urlLower.includes('contact')) return 'contact'
  if (titleLower.includes('register') || urlLower.includes('register')) return 'registration'
  if (titleLower.includes('survey') || urlLower.includes('survey')) return 'survey'

  return 'unknown'
}

function detectATSSystem(): string[] {
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
 * Calculate field priority based on CV data and field attributes
 * This is for UI display only - AI will do actual semantic matching!
 */
function calculateFieldPriority(field: any, cvData: any): 'high' | 'medium' | 'low' {
  // Required fields are high priority
  if (field.required) return 'high'

  // Check if field category matches CV data
  const keywords = field.keywords?.toLowerCase() || ''
  const hasEmail = keywords.includes('email') && cvData?.personal?.email
  const hasPhone = keywords.includes('phone') && cvData?.personal?.phone
  const hasName = keywords.includes('name') && (cvData?.personal?.firstName || cvData?.personal?.lastName)
  const hasLinkedIn = keywords.includes('linkedin') && cvData?.personal?.linkedIn
  const hasPortfolio = (keywords.includes('portfolio') || keywords.includes('github')) && cvData?.personal?.portfolio

  if (hasEmail || hasPhone || hasName) return 'high'
  if (hasLinkedIn || hasPortfolio) return 'medium'

  // Other common fields
  if (keywords.includes('address') ||
    keywords.includes('city') ||
    keywords.includes('state') ||
    keywords.includes('zip') ||
    keywords.includes('country') ||
    keywords.includes('title') ||
    keywords.includes('company') ||
    keywords.includes('experience') ||
    keywords.includes('education')) {
    return 'medium'
  }

  return 'low'
}

// Auto-detect forms on page load
formFiller.observeFormChanges(() => {
  console.log('Form fields changed - new fields available')
})

console.info('Form filling engine loaded')

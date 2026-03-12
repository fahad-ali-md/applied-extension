/**
 * Field Detection System
 *
 * Three-tier detection approach:
 * 1. AIFieldDetector - AI-powered semantic matching
 * 2. HybridFieldDetector - AI + Pattern matching
 * 3. FieldDetector - Pattern-based fallback
 */

import { FIELD_MAPPINGS } from './constants'

// ============================================
// AI FIELD DETECTOR
// ============================================

/**
 * AI-Based Field Detector - Uses semantic understanding
 */
export class AIFieldDetector {
  private cache = new Map<string, HTMLElement>()

  /**
   * Find the best matching field using AI semantic analysis
   */
  async findFieldWithAI(
    fieldType: string,
    cvData: any,
    getAIResponse: (prompt: string) => Promise<any>
  ): Promise<HTMLElement | null> {
    const cacheKey = `${fieldType}`
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    try {
      const allFields = this.getAllFieldsWithMetadata()
      if (allFields.length === 0) return null

      const prompt = this.buildAIPrompt(fieldType, cvData, allFields)
      const aiResponse = await getAIResponse(prompt)

      if (!aiResponse?.bestMatch) {
        console.warn(`[AIFieldDetector] No AI match found for ${fieldType}`)
        return null
      }

      const matchedField = this.findFieldByAIResponse(aiResponse.bestMatch, allFields)

      if (matchedField) {
        this.cache.set(cacheKey, matchedField)
        console.log(`[AIFieldDetector] ✓ Matched "${fieldType}"`)
      }

      return matchedField
    } catch (error) {
      console.error(`[AIFieldDetector] Error:`, error)
      return null
    }
  }

  private getAllFieldsWithMetadata() {
    const fields: any[] = []
    const selectors = [
      'input:not([type="hidden"])',
      'button',
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

  private buildAIPrompt(fieldType: string, cvData: any, fields: any[]): string {
    const fieldsDescription = fields.map(f => ({
      selector: f.id ? `#${f.id}` : f.name ? `[name="${f.name}"]` : 'unknown',
      name: f.name || 'none',
      id: f.id || 'none',
      type: f.type,
      placeholder: f.placeholder || 'none',
      label: f.label || 'none',
    }))

    return `You are a form field matching expert.
**Target:** ${fieldType}
**CV Data:** ${JSON.stringify(cvData)}
**Fields:** ${JSON.stringify(fieldsDescription)}

**Return ONLY this JSON:**
{
  "bestMatch": "#field-id or [name='field-name']",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`
  }

  private findFieldByAIResponse(selector: string, fields: any[]): HTMLElement | null {
    try {
      const element = document.querySelector(selector)
      if (element && this.isFieldAvailable(element as HTMLElement)) {
        return element as HTMLElement
      }

      for (const field of fields) {
        const fieldIdentifier = this.getFieldIdentifier(field.element)
        if (selector.includes(fieldIdentifier)) {
          return field.element
        }
      }

      return null
    } catch (error) {
      return null
    }
  }

  private findLabelForField(field: HTMLElement): string | null {
    if (field.id) {
      const label = document.querySelector(`label[for="${field.id}"]`)
      if (label) return label.textContent?.trim() || null
    }

    const parentLabel = field.closest('label')
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true) as HTMLElement
      const inputInClone = clone.querySelector('input, textarea, select')
      if (inputInClone) inputInClone.remove()
      return clone.textContent?.trim() || null
    }

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

  private getFieldIdentifier(field: HTMLElement): string {
    const id = field.id
    const name = (field as HTMLInputElement).name
    return id ? `#${id}` : name ? `[name="${name}"]` : 'unknown'
  }

  clearCache(): void {
    this.cache.clear()
  }

  findAllFieldsContaining(keyword: string): HTMLElement[] {
    const keywordLower = keyword.toLowerCase()
    const fields: HTMLElement[] = []
    const allFields = this.getAllFieldsWithMetadata()

    for (const field of allFields) {
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

// ============================================
// HYBRID FIELD DETECTOR
// ============================================

/**
 * Hybrid Field Detector - AI first, patterns fallback
 */
export class HybridFieldDetector {
  private aiDetector = new AIFieldDetector()
  private patternDetector = new FieldDetector()

  async findField(
    fieldType: string,
    cvData: any,
    getAIResponse: (prompt: string) => Promise<any>
  ): Promise<HTMLElement | null> {
    try {
      const aiField = await this.aiDetector.findFieldWithAI(fieldType, cvData, getAIResponse)
      if (aiField) {
        console.log(`[HybridFieldDetector] ✓ AI found field for ${fieldType}`)
        return aiField
      }
    } catch (error) {
      console.warn(`[HybridFieldDetector] AI failed, trying patterns...`)
    }

    console.log(`[HybridFieldDetector] Trying pattern matching for ${fieldType}`)
    return this.patternDetector.findField(fieldType)
  }

  findAllFieldsContaining(keyword: string): HTMLElement[] {
    return this.aiDetector.findAllFieldsContaining(keyword)
  }

  clearCache(): void {
    this.aiDetector.clearCache()
  }
}

// ============================================
// PATTERN FIELD DETECTOR
// ============================================

/**
 * Pattern-based Field Detector - Fast, reliable fallback
 */
export class FieldDetector {
  findField(fieldType: string): HTMLElement | null {
    const selector = this.getAllPossibleSelectors(fieldType)
    const elements = document.querySelectorAll(selector)

    for (const el of Array.from(elements)) {
      if (this.isFieldAvailable(el as HTMLElement)) {
        return el as HTMLElement
      }
    }

    return this.findByLabelText(fieldType)
  }

  private getAllPossibleSelectors(fieldType: string): string {
    const patterns = FIELD_MAPPINGS[fieldType] || [fieldType]
    const selectors: string[] = []

    patterns.forEach(pattern => {
      selectors.push(`input[name*="${pattern}" i]`)
      selectors.push(`input[id*="${pattern}" i]`)
      selectors.push(`input[placeholder*="${pattern}" i]`)
      selectors.push(`textarea[name*="${pattern}" i]`)
      selectors.push(`textarea[id*="${pattern}" i]`)
      selectors.push(`select[name*="${pattern}" i]`)
      selectors.push(`select[id*="${pattern}" i]`)
    })

    return selectors.join(', ')
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
    const labels = document.querySelectorAll('label, .label, .field-label')

    for (const label of Array.from(labels)) {
      const text = label.textContent?.toLowerCase() || ''

      for (const pattern of patterns) {
        if (text.includes(pattern.toLowerCase())) {
          const htmlFor = (label as HTMLLabelElement).htmlFor
          if (htmlFor) {
            const input = document.getElementById(htmlFor)
            if (input) return input
          }

          const input = label.querySelector('input, textarea, select')
          if (input) return input as HTMLElement

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
      'input:not([type="hidden"])',
      'button',
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

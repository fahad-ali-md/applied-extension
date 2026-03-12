/**
 * Form Filler Engine
 *
 * Handles form filling with AI-powered field detection
 */

import { FormFillData, ProgressCallback, AIResponseGetter } from '../types/form.types'
import { HybridFieldDetector, AIFieldDetector, FieldDetector } from './FieldDetector'

export class FormFiller {
  private hybridDetector = new HybridFieldDetector()
  private aiDetector = new AIFieldDetector()
  private patternDetector = new FieldDetector()

  /**
   * AI-Powered Form Filling - Main entry point
   */
  async fillForm(
    data: FormFillData,
    getAIResponse?: AIResponseGetter,
    onProgress?: ProgressCallback
  ): Promise<{ success: string[]; failed: string[] }> {
    if (!getAIResponse) {
      return await this.fillFormWithPatterns(data)
    }

    const success: string[] = []
    const failed: string[] = []

    const trackProgress = (fieldName: string, status: 'filled' | 'failed' | 'pending', label: string) => {
      onProgress?.(fieldName, status, label)
    }

    // Define fields to fill
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

    // Send pending status
    await new Promise(resolve => setTimeout(resolve, 50))
    for (const field of fieldsToFill) {
      trackProgress(field.field, 'pending', field.label)
    }
    await new Promise(resolve => setTimeout(resolve, 50))

    // Fill Personal Information
    const fullName = `${data.personal.firstName} ${data.personal.lastName}`.trim()
    if (await this.fillTextFieldWithAI('fullName', fullName, data, getAIResponse)) {
      success.push('fullName')
      trackProgress('fullName', 'filled', 'Full Name')
    } else {
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

    // Fill address fields
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

    // Custom answers
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
   * Fallback: Pattern-based form filling
   */
  private async fillFormWithPatterns(data: FormFillData): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = []
    const failed: string[] = []

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

    // Address
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
   * Fill text field using AI
   */
  private async fillTextFieldWithAI(
    fieldType: string,
    value: string,
    cvData: FormFillData,
    getAIResponse: AIResponseGetter
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
   * Fill textarea using AI
   */
  private async fillTextareaWithAI(
    fieldType: string,
    value: string,
    cvData: FormFillData,
    getAIResponse: AIResponseGetter
  ): Promise<boolean> {
    try {
      const field = await this.hybridDetector.findField(fieldType, cvData, getAIResponse)
      if (!field) return false

      const textarea = field as HTMLTextAreaElement
      textarea.focus()
      textarea.value = value
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      textarea.dispatchEvent(new Event('change', { bubbles: true }))

      textarea.style.height = 'auto'
      textarea.style.height = textarea.scrollHeight + 'px'

      return true
    } catch (error) {
      console.error(`[FormFiller] Error filling ${fieldType}:`, error)
      return false
    }
  }

  /**
   * Fill all address fields with combined address
   */
  private async fillAllAddressFields(
    data: FormFillData,
    getAIResponse: AIResponseGetter,
    onProgress?: ProgressCallback
  ): Promise<string[]> {
    const filled: string[] = []

    const fullAddress = [
      data.personal.address,
      data.personal.city,
      data.personal.state,
      data.personal.country
    ].filter(Boolean).join(', ')

    const addressFields = this.aiDetector.findAllFieldsContaining('address')

    for (const field of addressFields) {
      try {
        const input = field as HTMLInputElement
        input.value = fullAddress
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))

        const fieldId = field.id || (field as HTMLInputElement).name || 'unknown'
        filled.push(`address: ${fieldId}`)
        onProgress?.('address', 'filled', 'Address')
      } catch (error) {
        onProgress?.('address', 'failed', 'Address')
      }
    }

    return filled
  }

  /**
   * Fill address fields using pattern matching
   */
  private async fillAllAddressFieldsPattern(data: FormFillData): Promise<string[]> {
    const filled: string[] = []

    const fullAddress = [
      data.personal.address,
      data.personal.city,
      data.personal.state,
      data.personal.country
    ].filter(Boolean).join(', ')

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
    if (field.id) {
      const label = document.querySelector(`label[for="${field.id}"]`)
      if (label) return label as HTMLElement
    }

    const parentLabel = field.closest('label')
    if (parentLabel) return parentLabel as HTMLElement

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

  /**
   * Fill text field using patterns
   */
  private async fillTextField(fieldType: string, value: string): Promise<boolean> {
    const field = this.patternDetector.findField(fieldType)
    if (!field) return false

    const input = field as HTMLInputElement
    input.value = value
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))

    return true
  }

  /**
   * Fill textarea using patterns
   */
  private async fillTextarea(fieldType: string, value: string): Promise<boolean> {
    const field = this.patternDetector.findField(fieldType)
    if (!field) return false

    const textarea = field as HTMLTextAreaElement
    textarea.focus()
    textarea.value = value
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    textarea.dispatchEvent(new Event('change', { bubbles: true }))

    textarea.style.height = 'auto'
    textarea.style.height = textarea.scrollHeight + 'px'

    return true
  }

  /**
   * Fill field by question text
   */
  private async fillByQuestionText(question: string, answer: string): Promise<boolean> {
    const labels = document.querySelectorAll('label, .question, .field-label, legend')

    for (const label of Array.from(labels)) {
      const text = label.textContent?.toLowerCase() || ''

      if (text.includes(question.toLowerCase())) {
        let input: HTMLElement | null = null

        input = label.querySelector('input, textarea, select')

        if (!input && (label as HTMLLabelElement).htmlFor) {
          input = document.getElementById((label as HTMLLabelElement).htmlFor)
        }

        if (!input) {
          const next = label.nextElementSibling
          if (next?.matches('input, textarea, select')) {
            input = next as HTMLElement
          }
        }

        if (!input && label.parentElement) {
          const parentNext = label.parentElement.nextElementSibling
          if (parentNext?.querySelector('input, textarea, select')) {
            input = parentNext.querySelector('input, textarea, select') as HTMLElement
          }
        }

        if (input) {
          if (input.tagName === 'INPUT') {
            (input as HTMLInputElement).value = answer
          } else if (input.tagName === 'TEXTAREA') {
            (input as HTMLTextAreaElement).value = answer
          }
          input.dispatchEvent(new Event('input', { bubbles: true }))
          input.dispatchEvent(new Event('change', { bubbles: true }))
          return true
        }
      }
    }

    return false
  }

  /**
   * Observe form changes for dynamic forms
   */
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

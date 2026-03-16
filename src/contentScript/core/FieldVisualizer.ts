/**
 * Field Visualizer - Todo Checklist Animation on Form Fields
 *
 * Shows real-time visual feedback on form elements as they're being filled
 */

interface FieldVisual {
  element: HTMLElement
  indicator: HTMLElement
  status: 'pending' | 'filled' | 'failed'
}

export class FieldVisualizer {
  private visuals = new Map<string, FieldVisual>()
  private container: HTMLElement | null = null
  private active = false

  /**
   * Show visual indicators on all detected form fields
   */
  showFieldIndicators(fields: Array<{ id?: string; name?: string; label?: string }>): void {
    if (this.active) return
    this.active = true

    // Create overlay container if not exists
    this.ensureContainer()

    fields.forEach((field, index) => {
      const element = this.findFieldElement(field)
      if (!element) return
    })
  }

  /**
   * Update a specific field's visual status
   */
  updateFieldStatus(
    fieldId: string,
    fieldName: string,
    status: 'filled' | 'failed' | 'pending'
  ): void {
    const key = fieldId || fieldName
    const visual = this.visuals.get(key)

    if (!visual) {
      console.warn(`[FieldVisualizer] No visual found for ${key}`)
      return
    }

    // Update status
    visual.status = status
    visual.indicator.className = `field-indicator field-indicator-${status}`

    // Add animation class
    setTimeout(() => {
      visual.indicator.classList.add(`field-indicator-${status}-animate`)
    }, 10)

    // Add highlight effect to the actual form field
    if (status === 'filled') {
      this.highlightField(visual.element, 'success')
    } else if (status === 'failed') {
      this.highlightField(visual.element, 'error')
    }
  }

  /**
   * Remove all visual indicators
   */
  hideIndicators(): void {
    this.visuals.forEach((visual, key) => {
      visual.indicator.classList.add('field-indicator-hide')
      setTimeout(() => {
        visual.indicator.remove()
      }, 300)
    })

    this.visuals.clear()
    this.active = false
  }

  /**
   * Update progress counter
   */
  updateProgress(filled: number, total: number): void {
    const progressContainer = document.getElementById('form-fill-progress-counter')
    if (progressContainer) {
      const percent = total > 0 ? Math.round((filled / total) * 100) : 0
      progressContainer.innerHTML = `
        <div class="progress-counter">${filled}/${total}</div>
        <div class="progress-percent">${percent}%</div>
      `
    }
  }

  /**
   * Find the actual form field element
   */
  private findFieldElement(field: { id?: string; name?: string }): HTMLElement | null {
    if (field.id) {
      const el = document.getElementById(field.id)
      if (el) return el
    }

    if (field.name) {
      const el = document.querySelector(`[name="${field.name}"]`)
      if (el) return el as HTMLElement
    }

    return null
  }

  /**
   * Highlight the form field with success/error effect
   */
  private highlightField(element: HTMLElement, type: 'success' | 'error'): void {
    const originalStyle = element.style.cssText

    element.classList.add(`field-highlight-${type}`)

    setTimeout(() => {
      element.classList.remove(`field-highlight-${type}`)
    }, 1500)
  }

  /**
   * Ensure overlay container exists
   */
  private ensureContainer(): void {
    if (!this.container) {
      this.container = document.createElement('div')
      this.container.id = 'form-fill-visual-container'
      this.container.className = 'form-fill-visual-container'
      document.body.appendChild(this.container)
    }
  }

  /**
   * Create progress counter element
   */
  showProgressCounter(total: number): void {
    let counter = document.getElementById('form-fill-progress-counter')
    if (!counter) {
      counter = document.createElement('div')
      counter.id = 'form-fill-progress-counter'
      counter.className = 'form-fill-progress-counter'
      document.body.appendChild(counter)
    }
    counter.innerHTML = `
      <div class="progress-counter">0/${total}</div>
      <div class="progress-percent">0%</div>
    `
  }

  hideProgressCounter(): void {
    const counter = document.getElementById('form-fill-progress-counter')
    if (counter) {
      counter.remove()
    }
  }
}

// Singleton instance
export const fieldVisualizer = new FieldVisualizer()

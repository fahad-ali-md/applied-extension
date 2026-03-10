/**
 * PUPPETEER DOM EXTRACTOR & AUTOMATION FOR CHROME EXTENSIONS
 *
 * Uses chrome.debugger API + Puppeteer to:
 * 1. Extract form data
 * 2. Automate clicking, typing, and filling forms
 *
 * This provides more powerful extraction and automation for complex SPAs
 */

import {
  connect,
  ExtensionTransport,
} from 'puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js'

export interface PuppeteerExtractResult {
  fields: any[]
  toonFormat: string
  metadata: {
    url: string
    pageTitle: string
    formType: string
  }
}

export interface AutomationAction {
  type: 'click' | 'type' | 'fill' | 'select'
  selector: string
  value?: string
  delay?: number
}

export interface AutomationResult {
  success: boolean
  action: AutomationAction
  result?: any
  error?: string
}

/**
 * Extract form fields using Puppeteer
 *
 * Process:
 * 1. Attach chrome.debugger to tab
 * 2. Connect Puppeteer via ExtensionTransport
 * 3. Evaluate extraction script in page context
 * 4. Get metadata
 * 5. Convert to Toon format
 * 6. Detach debugger
 */
export async function extractWithPuppeteer(tabId: number): Promise<PuppeteerExtractResult> {
  // 1. Attach debugger to tab (version 1.3)
  await chrome.debugger.attach({ tabId }, '1.3')

  try {
    // 2. Connect Puppeteer using ExtensionTransport
    const transport = await ExtensionTransport.connectTab(tabId)
    const browser = await connect({
      transport,
    })

    // 3. Get page (only one page available in extension mode)
    const [page] = await browser.pages()

    // 4. Extract DOM using Puppeteer page.evaluate
    const extracted = await page.evaluate(() => {
      // Get all form inputs
      const inputs = document.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select'
      )

      // Map inputs to field data
      return Array.from(inputs).map(input => {
        const element = input as HTMLElement
        const htmlInput = element as HTMLInputElement
        const htmlSelect = element as HTMLSelectElement

        return {
          selector: generateSelector(element),
          tagName: element.tagName,
          type: htmlInput.type || element.tagName.toLowerCase(),
          name: htmlInput.name || '',
          id: element.id || '',
          placeholder: htmlInput.placeholder || '',
          ariaLabel: element.getAttribute('aria-label') || '',
          label: getFieldLabel(element),
          value: htmlInput.value || htmlSelect.value || '',
          required: element.hasAttribute('required'),
          options: element.tagName === 'SELECT'
            ? Array.from(htmlSelect.options).map(o => ({ value: o.value, text: o.text }))
            : undefined,
        }
      })

      function generateSelector(el: HTMLElement): string {
        // Try ID first
        if (el.id) {
          return `#${el.id}`
        }

        // Try name attribute
        const name = el.getAttribute('name')
        if (name) {
          return `[name="${name}"]`
        }

        // Try data-testid
        const dataTestId = el.getAttribute('data-testid')
        if (dataTestId) {
          return `[data-testid="${dataTestId}"]`
        }

        // Fallback: generic selector
        const tag = el.tagName.toLowerCase()
        const type = el.getAttribute('type')
        return type ? `${tag}[type="${type}"]` : tag
      }

      function getFieldLabel(el: HTMLElement): string {
        // Try aria-label
        const ariaLabel = el.getAttribute('aria-label')
        if (ariaLabel) return ariaLabel

        // Try placeholder
        const placeholder = el.getAttribute('placeholder')
        if (placeholder) return placeholder

        // Try associated label element
        const id = el.id
        if (id) {
          const label = document.querySelector(`label[for="${id}"]`)
          if (label) return label.textContent?.trim() || ''
        }

        // Try parent label
        const parentLabel = el.closest('label')
        if (parentLabel) {
          const text = parentLabel.textContent?.replace(el.textContent || '', '').trim()
          if (text) return text
        }

        // Try name attribute
        const name = el.getAttribute('name')
        if (name) return name

        return 'Unknown'
      }
    })

    // 5. Get page metadata
    const metadata = await page.evaluate(() => {
      // Detect ATS
      const scripts = Array.from(document.querySelectorAll('script'))
      const metas = Array.from(document.querySelectorAll('meta'))
      const detectedATS: string[] = []

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
        if (scripts.some(s => pattern.test(s.src || s.textContent || ''))) {
          detectedATS.push(atsName)
        }
        if (metas.some(m => pattern.test(m.content || m.name || ''))) {
          detectedATS.push(atsName)
        }
      }

      // Detect form type
      const titleLower = document.title.toLowerCase()
      const urlLower = window.location.href.toLowerCase()

      let formType = 'unknown'
      if (titleLower.includes('apply') || urlLower.includes('apply')) formType = 'job-application'
      else if (titleLower.includes('contact') || urlLower.includes('contact')) formType = 'contact'
      else if (titleLower.includes('register') || urlLower.includes('register')) formType = 'registration'
      else if (titleLower.includes('survey') || urlLower.includes('survey')) formType = 'survey'

      return {
        url: window.location.href,
        pageTitle: document.title,
        formType,
        detectedATS,
      }
    })

    // 6. Disconnect browser
    browser.disconnect()

    // 7. Import toonFormatter and convert to Toon format
    const { convertToToonFields, encodeToon } = await import('../utils/toonFormatter.js')
    const toonFields = convertToToonFields({ fields: extracted, metadata })
    const toonFormat = encodeToon({ fields: toonFields, metadata })

    return {
      fields: extracted,
      toonFormat,
      metadata: {
        url: metadata.url,
        pageTitle: metadata.pageTitle,
        formType: metadata.formType,
      },
    }
  } finally {
    // 8. Always detach debugger (even if error occurs)
    try {
      await chrome.debugger.detach({ tabId })
    } catch (e) {
      // Ignore detach errors (might already be detached)
      console.warn('Debugger detach warning:', e)
    }
  }
}

/**
 * Helper function to execute actions with Puppeteer
 * This is used by all automation functions
 */
async function withPuppeteer<T>(
  tabId: number,
  fn: (page: any) => Promise<T>
): Promise<T> {
  await chrome.debugger.attach({ tabId }, '1.3')

  try {
    const transport = await ExtensionTransport.connectTab(tabId)
    const browser = await connect({ transport })
    const [page] = await browser.pages()

    const result = await fn(page)

    browser.disconnect()
    return result
  } finally {
    try {
      await chrome.debugger.detach({ tabId })
    } catch (e) {
      console.warn('Debugger detach warning:', e)
    }
  }
}

/**
 * Click an element using Puppeteer
 *
 * @param tabId - The tab ID to automate
 * @param selector - CSS selector for the element to click
 * @param delay - Optional delay in milliseconds before click
 */
export async function clickElement(
  tabId: number,
  selector: string,
  delay: number = 0
): Promise<AutomationResult> {
  try {
    await withPuppeteer(tabId, async (page) => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      // Wait for element to be available
      await page.waitForSelector(selector, { timeout: 5000 })

      // Click the element
      await page.click(selector)

      // Wait a bit for any page updates
      await new Promise(resolve => setTimeout(resolve, 500))
    })

    return {
      success: true,
      action: { type: 'click', selector, delay },
      result: `Clicked ${selector}`,
    }
  } catch (error) {
    return {
      success: false,
      action: { type: 'click', selector, delay },
      error: error instanceof Error ? error.message : 'Failed to click element',
    }
  }
}

/**
 * Type text into an input element using Puppeteer
 *
 * @param tabId - The tab ID to automate
 * @param selector - CSS selector for the input element
 * @param text - Text to type
 * @param delay - Optional delay in milliseconds before typing
 * @param clearFirst - Whether to clear the field before typing (default: true)
 */
export async function typeInElement(
  tabId: number,
  selector: string,
  text: string,
  delay: number = 0
): Promise<AutomationResult> {
  try {
    await withPuppeteer(tabId, async (page) => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      // Wait for element to be available
      await page.waitForSelector(selector, { timeout: 5000 })

      // Clear the field first
      await page.click(selector, { clickCount: 3 }) // Triple-click to select all
      await page.keyboard.press('Backspace')

      // Type into the element
      await page.type(selector, text, { delay: 10 }) // Small delay between keystrokes for natural typing

      // Wait a bit for any field updates
      await new Promise(resolve => setTimeout(resolve, 200))
    })

    return {
      success: true,
      action: { type: 'type', selector, value: text, delay },
      result: `Typed "${text}" into ${selector}`,
    }
  } catch (error) {
    return {
      success: false,
      action: { type: 'type', selector, value: text, delay },
      error: error instanceof Error ? error.message : 'Failed to type in element',
    }
  }
}

/**
 * Fill multiple form fields at once using Puppeteer
 *
 * @param tabId - The tab ID to automate
 * @param fields - Array of field data with selector and value
 */
export async function fillForm(
  tabId: number,
  fields: Array<{ selector: string; value: string; type?: string }>
): Promise<{ success: boolean; results: AutomationResult[]; errors: string[] }> {
  const results: AutomationResult[] = []
  const errors: string[] = []

  await chrome.debugger.attach({ tabId }, '1.3')

  try {
    const transport = await ExtensionTransport.connectTab(tabId)
    const browser = await connect({ transport })
    const [page] = await browser.pages()

    for (const field of fields) {
      try {
        await page.waitForSelector(field.selector, { timeout: 5000 })

        // Handle different field types
        if (field.type === 'select') {
          await page.select(field.selector, field.value)
        } else if (field.type === 'file' || field.selector.includes('resume') || field.selector.includes('cv')) {
          // Skip file inputs - they require special handling
          results.push({
            success: true,
            action: { type: 'fill', selector: field.selector, value: '[FILE]' },
            result: `Skipped file input ${field.selector}`,
          })
          continue
        } else {
          // Regular input/textarea
          await page.type(field.selector, field.value, { delay: 10 })
        }

        await new Promise(resolve => setTimeout(resolve, 200))

        results.push({
          success: true,
          action: { type: 'fill', selector: field.selector, value: field.value },
          result: `Filled ${field.selector}`,
        })
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to fill field'
        errors.push(`${field.selector}: ${errorMsg}`)
        results.push({
          success: false,
          action: { type: 'fill', selector: field.selector, value: field.value },
          error: errorMsg,
        })
      }
    }

    browser.disconnect()
  } finally {
    try {
      await chrome.debugger.detach({ tabId })
    } catch (e) {
      console.warn('Debugger detach warning:', e)
    }
  }

  return {
    success: errors.length === 0,
    results,
    errors,
  }
}

/**
 * Execute multiple automation actions in sequence
 *
 * @param tabId - The tab ID to automate
 * @param actions - Array of automation actions to execute
 */
export async function automateActions(
  tabId: number,
  actions: AutomationAction[]
): Promise<{ success: boolean; results: AutomationResult[]; errors: string[] }> {
  const results: AutomationResult[] = []
  const errors: string[] = []

  for (const action of actions) {
    let result: AutomationResult

    switch (action.type) {
      case 'click':
        result = await clickElement(tabId, action.selector, action.delay)
        break
      case 'type':
        result = await typeInElement(tabId, action.selector, action.value || '', action.delay)
        break
      case 'fill':
        result = await typeInElement(tabId, action.selector, action.value || '', action.delay)
        break
      case 'select':
        result = await typeInElement(tabId, action.selector, action.value || '', action.delay)
        break
      default:
        result = {
          success: false,
          action,
          error: `Unknown action type: ${(action as any).type}`,
        }
    }

    results.push(result)

    if (!result.success) {
      errors.push(result.error || 'Unknown error')
    }

    // Small delay between actions
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  return {
    success: errors.length === 0,
    results,
    errors,
  }
}

/**
 * Form Helper Utilities
 *
 * Utility functions for form detection, job extraction, and field analysis
 */

/**
 * Extract job description from current page
 */
export function extractJobDescription(): string {
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

/**
 * Detect form type based on page content
 */
export function detectFormType(): string {
  const titleLower = document.title.toLowerCase()
  const urlLower = window.location.href.toLowerCase()

  if (titleLower.includes('apply') || urlLower.includes('apply')) return 'job-application'
  if (titleLower.includes('contact') || urlLower.includes('contact')) return 'contact'
  if (titleLower.includes('register') || urlLower.includes('register')) return 'registration'
  if (titleLower.includes('survey') || urlLower.includes('survey')) return 'survey'

  return 'unknown'
}

/**
 * Detect ATS (Applicant Tracking System) used by the website
 */
export function detectATSSystem(): string[] {
  const ats: string[] = []
  const scripts = Array.from(document.querySelectorAll('script'))
  const metas = Array.from(document.querySelectorAll('meta'))

  // Common ATS patterns
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
 * Calculate field priority for UI display
 * This is for UI only - AI handles actual semantic matching
 * Supports both full field format (required, keywords) and RawField format (i, n, t, l, p, o)
 */
export function calculateFieldPriority(
  field: any,
  cvData: any
): 'high' | 'medium' | 'low' {
  // Build keywords from available properties (supports both formats)
  const keywords = (
    field.keywords?.toLowerCase() || // Full format
    field.l?.toLowerCase() || // RawField label
    field.p?.toLowerCase() || // RawField placeholder
    field.n?.toLowerCase() || // RawField name
    ''
  )

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

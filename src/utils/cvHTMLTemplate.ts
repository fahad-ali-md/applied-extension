/**
 * Professional HTML CV Template Generator
 * Styled like cv-complete.html with beautiful typography and spacing
 */

export interface CVDataForHtml {
  personal?: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    linkedIn?: string
    portfolio?: string
    city?: string
    country?: string
  }
  professional?: {
    summary?: string
    currentTitle?: string
    yearsOfExperience?: number
  }
  experience?: Array<{
    role?: string
    company?: string
    startDate?: string
    endDate?: string
    current?: boolean
    highlights?: string[]
  }>
  projects?: Array<{
    name?: string
    description?: string
    technologies?: string[]
    url?: string
    startDate?: string
    endDate?: string
  }>
  education?: Array<{
    degree?: string
    school?: string
    field?: string
    startDate?: string
    endDate?: string
    graduationYear?: string
  }>
  skills?: Record<string, string[]>
}

/**
 * Generate professional HTML CV
 */
export function generateHTMLCV(cvData: CVDataForHtml): string {
  const fullName = `${cvData.personal?.firstName || ''} ${cvData.personal?.lastName || ''}`.trim()
  const title = cvData.professional?.currentTitle || 'Professional'
  const summary = cvData.professional?.summary || ''

  // Auto-fix missing education start dates based on graduation year
  const processedEducation = (cvData.education || []).map(edu => {
    if (!edu.startDate && (edu.graduationYear || edu.endDate)) {
      const gradYearStr = edu.graduationYear || edu.endDate || ''
      const yearMatch = gradYearStr.match(/\b(19|20)\d{2}\b/)

      if (yearMatch) {
        const gradYear = parseInt(yearMatch[0], 10)
        let estimatedYears = 4 // Default to 4 years for Bachelor's
        const degree = (edu.degree || '').toLowerCase()

        if (degree.includes('master') || degree.includes('m.s') || degree.includes('m.a')) {
          estimatedYears = 2
        } else if (degree.includes('phd') || degree.includes('doctorate')) {
          estimatedYears = 5
        } else if (degree.includes('associate') || degree.includes('diploma')) {
          estimatedYears = 2
        } else if (degree.includes('high school') || degree.includes('12th') || degree.includes('higher secondary')) {
          estimatedYears = 2
        }

        const startYear = gradYear - estimatedYears
        return { ...edu, startDate: `${startYear}-08` }
      }
    }
    return edu
  })

  // Contact information
  const contactParts: string[] = []
  if (cvData.personal?.email) contactParts.push(cvData.personal.email)
  if (cvData.personal?.phone) contactParts.push(cvData.personal.phone)

  const linkParts: string[] = []
  if (cvData.personal?.linkedIn) linkParts.push(`<a href="${cvData.personal.linkedIn}">LinkedIn</a>`)
  if (cvData.personal?.portfolio) linkParts.push(`<a href="${cvData.personal.portfolio}">Portfolio</a>`)

  // Format date helper - handles both MM/YYYY and YYYY-MM formats
  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return ''
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    // Handle YYYY-MM format
    const match = dateStr.match(/(\d{4})-(\d{1,2})/)
    if (match) {
      const monthIdx = parseInt(match[2]) - 1
      if (monthIdx >= 0 && monthIdx < 12) {
        return `${months[monthIdx]} ${match[1]}`
      }
    }

    // Handle MM/YYYY format (e.g., "01/2019")
    const slashMatch = dateStr.match(/(\d{1,2})\/(\d{4})/)
    if (slashMatch) {
      const monthIdx = parseInt(slashMatch[1]) - 1
      if (monthIdx >= 0 && monthIdx < 12) {
        return `${months[monthIdx]} ${slashMatch[2]}`
      }
    }

    return dateStr
  }

  // Helper function to safely parse a date for sorting
  const safelyGetTime = (dateStr?: string, isCurrent?: boolean): number => {
    if (isCurrent || dateStr === 'Present' || dateStr?.toLowerCase() === 'present') return Date.now()
    if (!dateStr) return 0
    // Try to handle YYYY-MM or MM/YYYY directly first
    let year = 0
    let month = 0
    const match = dateStr.match(/(\d{4})-(\d{1,2})/)
    if (match) {
      year = parseInt(match[1])
      month = parseInt(match[2]) - 1
    } else {
      const slashMatch = dateStr.match(/(\d{1,2})\/(\d{4})/)
      if (slashMatch) {
        year = parseInt(slashMatch[2])
        month = parseInt(slashMatch[1]) - 1
      }
    }

    if (year > 0) {
      return new Date(year, month).getTime()
    }

    // Fallback to Date parsing
    const time = new Date(dateStr).getTime()
    return isNaN(time) ? 0 : time
  }

  // Sort experience by date (most recent first)
  const sortedExperience = [...(cvData.experience || [])].sort((a, b) => {
    const timeA = safelyGetTime(a.endDate || a.startDate, a.current)
    const timeB = safelyGetTime(b.endDate || b.startDate, b.current)
    return timeB - timeA
  })

  // Sort projects by date (most recent first)
  const sortedProjects = [...(cvData.projects || [])].sort((a, b) => {
    const timeA = safelyGetTime(a.endDate || a.startDate)
    const timeB = safelyGetTime(b.endDate || b.startDate)
    return timeB - timeA
  })

  return `<div id="cv-container" style="background: white;">
  <style>
    #cv-container {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #1a1a1a;
      background: #ffffff;
      width: 794px; /* A4 width */
      margin: 0 auto;
      padding: 48px;
      box-sizing: border-box;
      position: relative;
    }

    #cv-container *, #cv-container *:before, #cv-container *:after {
      box-sizing: border-box;
    }

    #cv-container .header {
      text-align: center;
      margin-bottom: 30px;
    }

    #cv-container .name {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 26px;
      font-weight: bold;   
    }

    #cv-container .title {
      font-size: 16px;
    }

    #cv-container .contact {
      font-size: 12px;
    }

    #cv-container .contact a {
      color: #000000;
      text-decoration: none;
      font-weight: 500;
    }

    #cv-container .contact a:hover {
      text-decoration: underline;
    }

    #cv-container .section {
      margin-bottom: 25px;
    }

    #cv-container .section-title {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 13px;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 6px;
      border-bottom: 1px solid #1a1a1a;
      padding-bottom: 3px;
    }

    #cv-container .summary {
      margin-bottom: 15px;
    }

    #cv-container .exp-entry {
      margin-bottom: 15px;
      overflow: hidden; /* Prevent overlapping with floated date */
    }

    #cv-container .exp-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      font-weight: bold;
      margin-bottom: 5px;
      gap: 12px;
    }

    #cv-container .exp-header-title {
      flex: 1;
      min-width: 0;
    }

    #cv-container .exp-header-date {
      font-size: 11px;
      font-weight: normal;
      white-space: nowrap;
      flex-shrink: 0;
      color: #333;
    }

    #cv-container .exp-date {
      font-size: 11px;
      font-weight: normal;
      margin-top: 2px;
      margin-bottom: 8px;
    }

    #cv-container .highlights {
      margin: 8px 0;
      padding-left: 20px;
    }

    #cv-container .highlights li {
      margin-bottom: 4px;
    }

    #cv-container .skill-category {
      margin-bottom: 8px;
    }

    @media print {
      body { padding: 20px; }
    }

    @media screen and (max-width: 768px) {
      body {
        padding: 20px;
      }
      #cv-container .name {
        font-size: 22px;
      }
      #cv-container .title {
        font-size: 14px;
      }
    }
  </style>

  <div class="header">
    <div class="name">${fullName}</div>
    <div class="title">${title}</div>
    ${contactParts.length > 0 || linkParts.length > 0 ? `<div class="contact">${[...contactParts, ...linkParts].join(' | ')}</div>` : ''}
  </div>

  ${summary ? `
  <div class="section">
    <div class="section-title">Professional Summary</div>
    <div class="summary">${summary}</div>
  </div>
  ` : ''}

  ${sortedExperience.length > 0 ? `
  <div class="section">
    <div class="section-title">Experience</div>
    ${sortedExperience.map(exp => {
    const dateStr = exp.current
      ? `${formatDate(exp.startDate)} - Present`
      : `${formatDate(exp.startDate)} - ${formatDate(exp.endDate)}`

    return `
        <div class="exp-entry">
          <div class="exp-header">
            <span class="exp-header-title">${exp.role || ''} - ${exp.company || ''}</span>
            <span class="exp-header-date">${dateStr}</span>
          </div>
          ${exp.highlights && exp.highlights.length > 0 ? `
            <ul class="highlights">
              ${exp.highlights.map(h => `<li>${h}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
      `
  }).join('')}
  </div>
  ` : ''}

  ${sortedProjects.length > 0 ? `
  <div class="section">
    <div class="section-title">Projects</div>
    ${sortedProjects.map(proj => {
      // Format project date
      const projDateStr = proj.startDate
        ? `${formatDate(proj.startDate)}${proj.endDate ? ' - ' + formatDate(proj.endDate) : ''}`
        : ''

      return `
      <div class="exp-entry">
        <div class="exp-header">
          <span class="exp-header-title"><strong>${proj.name || ''}</strong></span>
          ${projDateStr ? `<span class="exp-header-date">${projDateStr}</span>` : ''}
        </div>
        ${proj.description ? `<div>${proj.description}</div>` : ''}
        ${proj.technologies && proj.technologies.length > 0 ? `<div><strong>Tech Stack:</strong> ${proj.technologies.join(', ')}</div>` : ''}
      </div>
    `
    }).join('')}
  </div>
  ` : ''}

  ${processedEducation.length > 0 ? `
  <div class="section">
    <div class="section-title">Education</div>
    ${processedEducation.map(edu => {
    // Use 'field' as starting date (MM/YYYY format), fallback to 'startDate'
    const formattedStart = formatDate(edu.field || edu.startDate || edu.startDate)
    const gradYear = edu.graduationYear || ''
    const dateStr = formattedStart
      ? `${formattedStart} – ${gradYear || 'Present'}`
      : gradYear

    return `
      <div class="exp-entry">
        <div class="exp-header">
          <span class="exp-header-title">${edu.degree || ''}${edu.school ? ` - ${edu.school}` : ''}</span>
          ${dateStr ? `<span class="exp-header-date">${dateStr}</span>` : ''}
        </div>
      </div>
    `
  }).join('')}
  </div>
  ` : ''}

  ${cvData.skills && Object.keys(cvData.skills).length > 0 ? `
  <div class="section">
    <div class="section-title">Skills</div>
    ${Object.entries(cvData.skills).map(([category, skillList]) => `
      <div class="skill-category">${category}: ${skillList.join(', ')}</div>
    `).join('')}
  </div>
  ` : ''}

</div>`
}

/**
 * Convert HTML to blob for download
 */
export async function htmlToBlob(html: string): Promise<Blob> {
  return new Blob([html], { type: 'text/html' })
}

/**
 * Download HTML CV as file
 */
export function downloadHTMLCV(html: string, filename: string = 'cv.html'): void {
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Convert HTML to PDF using browser's print functionality
 * This opens a new window with the HTML and triggers print dialog
 */
export function htmlToPDF(html: string): void {
  // Create a new window
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Please allow popups to print PDF')
    return
  }

  // Write HTML to the new window
  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()

  // Wait for the content to load, then trigger print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }
}

/**
 * Download HTML as PDF file using browser print dialog
 */
export function downloadHTMLAsPDF(html: string): void {
  htmlToPDF(html)
}

/**
 * Print HTML CV directly
 */
export function printHTMLCV(html: string): void {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Please allow popups to print PDF')
    return
  }

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()

  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }
}

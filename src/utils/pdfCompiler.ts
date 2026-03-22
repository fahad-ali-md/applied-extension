/**
 * PDF Compiler for CV Generation
 *
 * Direct CV data → PDF using jsPDF (no LaTeX needed)
 */

import { jsPDF } from 'jspdf'

// ============================================
// Types
// ============================================

export interface PDFCompileResult {
  success: boolean
  pdfBlob?: Blob
  error?: string
}

export interface CompileOptions {
  filename?: string
  fontSize?: number
  lineHeight?: number
  margin?: number
}

// ============================================
// Utility Functions
// ============================================

/**
 * Download PDF blob as file
 */
export function downloadPDFBlob(pdfBlob: Blob, filename: string = 'cv.pdf'): void {
  const url = URL.createObjectURL(pdfBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Convert PDF blob to base64 (for chrome messaging)
 */
export async function pdfBlobToBase64(pdfBlob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      // Remove data URL prefix
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(pdfBlob)
  })
}

/**
 * Get PDF blob size in human-readable format
 */
export function getPDFSize(pdfBlob: Blob): string {
  const bytes = pdfBlob.size
  const kb = bytes / 1024
  const mb = kb / 1024

  if (mb >= 1) {
    return `${mb.toFixed(2)} MB`
  } else if (kb >= 1) {
    return `${kb.toFixed(2)} KB`
  } else {
    return `${bytes} bytes`
  }
}

// ============================================
// CV Data to PDF (Main Function)
// ============================================

/**
 * CV Data Types (matching storage structure)
 */
export interface CVDataForPdf {
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
    highlights?: string[]
  }>
  education?: Array<{
    degree?: string
    school?: string
    field?: string  // Starting date in MM/YYYY format
    startDate?: string
    graduationYear?: string
  }>
  skills?: Record<string, string[] | undefined>
}

/**
 * Generate PDF directly from CV data using jsPDF
 * Auto-sorts experience and projects by date (most recent first)
 * Styled professionally for ATS compatibility
 */
export async function compileCVDataToPDF(
  cvData: CVDataForPdf,
  options: CompileOptions = {}
): Promise<PDFCompileResult> {
  try {
    console.log('[PDF Compiler] Starting PDF generation from CV data...')

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    // Professional margins for better readability and spacing
    const margin = 18 // 18mm margins (more generous like Canva)
    const pageWidth = 210
    const pageHeight = 297
    const maxWidth = pageWidth - (2 * margin)
    const fontSize = options.fontSize || 11 // 11pt optimal for ATS

    let yPosition = margin

    // Helper: Check for new page
    const checkNewPage = (y: number): number => {
      if (y > pageHeight - margin) {
        pdf.addPage()
        return margin
      }
      return y
    }

    // Helper: Pass through date as-is (universal format support)
    const formatDate = (dateStr?: string): string => {
      if (!dateStr) return ''
      return dateStr // Display whatever format user provided
    }

    // Helper: Parse date for sorting
    const parseDateValue = (dateStr?: string): Date | null => {
      if (!dateStr) return null
      try {
        const match = dateStr.match(/(\d{4})-(\d{1,2})/)
        if (match) {
          return new Date(parseInt(match[1]), parseInt(match[2]) - 1)
        }
        return new Date(dateStr)
      } catch {
        return null
      }
    }

    // Helper: Smart text wrapping that preserves metrics/numbers
    const wrapTextSmartly = (text: string, maxWidth: number): string[] => {
      const words = text.split(' ')
      const lines: string[] = []
      let currentLine = ''

      for (let i = 0; i < words.length; i++) {
        const word = words[i]
        const testLine = currentLine + (currentLine ? ' ' : '') + word
        const testWidth = pdf.getTextWidth(testLine)

        if (testWidth > maxWidth && currentLine !== '') {
          // Check if next word starts with a number/metric pattern
          const nextWord = words[i + 1]
          const isMetricPattern = /^\d+%?\s*(users?|transactions?|developers?|downloads?|customers?|clients?|requests?|calls?|messages?|emails?|views?|visitors?|subscribers?|members?|projects?|products?|services?|teams?|partners?|investors?|employees?|students?|teachers?|courses?|lessons?|hours?|days?|weeks?|months?|years?)?/i.test(nextWord || '')

          if (isMetricPattern && i + 1 < words.length) {
            // Keep metric pattern with current line
            currentLine += ' ' + word
            lines.push(currentLine.trim())
            currentLine = ''
          } else {
            lines.push(currentLine.trim())
            currentLine = word
          }
        } else {
          currentLine = testLine
        }
      }

      if (currentLine.trim()) {
        lines.push(currentLine.trim())
      }

      return lines.length > 0 ? lines : [text]
    }

    // ========================================
    // Header - Professional & Clean (like Canva)
    // ========================================
    const fullName = `${cvData.personal?.firstName || ''} ${cvData.personal?.lastName || ''}`.trim()

    // Name - 22pt, bold, centered (larger for impact)
    pdf.setFontSize(22)
    pdf.setFont('helvetica', 'bold')
    pdf.text(fullName, pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 7

    // Title - 14pt, centered, with more spacing
    const title = cvData.professional?.currentTitle || 'Professional'
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'normal')
    pdf.text(title, pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 6

    // Contact - 10pt, centered with better spacing
    const contactParts: string[] = []
    if (cvData.personal?.email) contactParts.push(cvData.personal.email)
    if (cvData.personal?.phone) contactParts.push(cvData.personal.phone)

    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    if (contactParts.length > 0) {
      pdf.text(contactParts.join(' | '), pageWidth / 2, yPosition, { align: 'center' })
      yPosition += 5
    }

    const linkParts: string[] = []
    if (cvData.personal?.linkedIn) linkParts.push(cvData.personal.linkedIn)
    if (cvData.personal?.portfolio) linkParts.push(cvData.personal.portfolio)
    if (linkParts.length > 0) {
      pdf.setFontSize(9)
      pdf.text(linkParts.join(' | '), pageWidth / 2, yPosition, { align: 'center' })
      yPosition += 5
    }

    yPosition += 7 // More space after header

    // ========================================
    // Professional Summary
    // ========================================
    if (cvData.professional?.summary) {
      yPosition = checkNewPage(yPosition)

      // Section title - 13pt, bold, uppercase, with underline (larger & bolder)
      pdf.setFontSize(13)
      pdf.setFont('helvetica', 'bold')
      pdf.text('PROFESSIONAL SUMMARY', margin, yPosition)
      yPosition += 2.5

      // Thicker underline for better visual separation
      pdf.setDrawColor(0, 0, 0)
      pdf.setLineWidth(0.5)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 5

      // Summary text - 11pt with better line height
      pdf.setFontSize(fontSize)
      pdf.setFont('helvetica', 'normal')
      const summaryLines = wrapTextSmartly(cvData.professional.summary || '', maxWidth)
      summaryLines.forEach((line) => {
        yPosition = checkNewPage(yPosition)
        pdf.text(line, margin, yPosition)
        yPosition += 5.5 // Better line height
      })
      yPosition += 6 // More space after section
    }

    // ========================================
    // Experience
    // ========================================
    if (cvData.experience && cvData.experience.length > 0) {
      yPosition = checkNewPage(yPosition)

      // Section title - 13pt, bold, uppercase with thicker underline
      pdf.setFontSize(13)
      pdf.setFont('helvetica', 'bold')
      pdf.text('EXPERIENCE', margin, yPosition)
      yPosition += 2.5

      // Thicker underline for better visual separation
      pdf.setDrawColor(0, 0, 0)
      pdf.setLineWidth(0.5)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 5

      // Auto-sort by date (most recent first)
      const sortedExperience = [...cvData.experience].sort((a, b) => {
        const dateA = parseDateValue(a.endDate || a.startDate)
        const dateB = parseDateValue(b.endDate || b.startDate)
        if (!dateA) return 1
        if (!dateB) return -1
        return dateB.getTime() - dateA.getTime()
      })

      console.log('[PDF Compiler] Experience auto-sorted by date (most recent first)')

      sortedExperience.forEach((exp) => {
        yPosition = checkNewPage(yPosition)
        yPosition += 2

        // Role + Company on LEFT, Date on RIGHT
        const dateStr = exp.current
          ? `${formatDate(exp.startDate)} - Present`
          : `${formatDate(exp.startDate)} - ${formatDate(exp.endDate)}`

        const headerText = `${exp.role || ''} - ${exp.company || ''}`

        // Left: bold role/company
        pdf.setFontSize(fontSize)
        pdf.setFont('helvetica', 'bold')
        pdf.text(headerText, margin, yPosition)

        // Right: normal date (right-aligned)
        pdf.setFontSize(fontSize - 1)
        pdf.setFont('helvetica', 'normal')
        pdf.text(dateStr, pageWidth - margin, yPosition, { align: 'right' })

        yPosition += 5

        // Highlights - with professional bullets (•) and better indentation
        if (exp.highlights && exp.highlights.length > 0) {
          pdf.setFontSize(fontSize)
          pdf.setFont('helvetica', 'normal')

          exp.highlights.forEach((highlight) => {
            yPosition = checkNewPage(yPosition)
            const bulletWidth = pdf.getTextWidth('•  ')
            const availableWidth = maxWidth - bulletWidth - 3

            // Use smart wrapping that preserves metrics/numbers
            const highlightLines = wrapTextSmartly(highlight, availableWidth)

            highlightLines.forEach((line: string, index: number) => {
              yPosition = checkNewPage(yPosition)
              if (index === 0) {
                pdf.text('•  ' + line, margin, yPosition)
              } else {
                pdf.text('    ' + line, margin, yPosition)
              }
              yPosition += 5 // Better line height for bullets
            })
          })
        }

        yPosition += 5 // More space between experiences
      })

      yPosition += 6 // More space after section
    }

    // ========================================
    // Projects
    // ========================================
    if (cvData.projects && cvData.projects.length > 0) {
      yPosition = checkNewPage(yPosition)

      // Section title
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.text('PROJECTS', margin, yPosition)
      yPosition += 2

      // Underline
      pdf.setDrawColor(0, 0, 0)
      pdf.setLineWidth(0.3)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 4

      // Auto-sort by date (most recent first)
      const sortedProjects = [...cvData.projects].sort((a, b) => {
        const dateA = parseDateValue(a.endDate || a.startDate)
        const dateB = parseDateValue(b.endDate || b.startDate)
        if (!dateA) return 1
        if (!dateB) return -1
        return dateB.getTime() - dateA.getTime()
      })

      console.log('[PDF Compiler] Projects auto-sorted by date (most recent first)')

      sortedProjects.forEach((proj) => {
        yPosition = checkNewPage(yPosition)
        yPosition += 2

        // Project name - Bold
        pdf.setFontSize(fontSize)
        pdf.setFont('helvetica', 'bold')
        pdf.text(`${proj.name || ''}`, margin, yPosition)
        yPosition += 4

        // Description
        if (proj.description) {
          pdf.setFontSize(fontSize)
          pdf.setFont('helvetica', 'normal')
          const descLines = pdf.splitTextToSize(proj.description, maxWidth)
          pdf.text(descLines, margin, yPosition)
          yPosition += descLines.length * 5 + 2
        }

        // Tech Stack - Italic
        if (proj.technologies && proj.technologies.length > 0) {
          yPosition = checkNewPage(yPosition)
          pdf.setFontSize(fontSize - 1)
          pdf.setFont('helvetica', 'italic')
          const techText = `Tech Stack: ${proj.technologies.join(', ')}`
          const techLines = pdf.splitTextToSize(techText, maxWidth)
          pdf.text(techLines, margin, yPosition)
          yPosition += techLines.length * 4 + 2
        }

        yPosition += 5
      })

      yPosition += 4
    }

    // ========================================
    // Education
    // ========================================
    if (cvData.education && cvData.education.length > 0) {
      yPosition = checkNewPage(yPosition)

      // Section title
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.text('EDUCATION', margin, yPosition)
      yPosition += 2

      // Underline
      pdf.setDrawColor(0, 0, 0)
      pdf.setLineWidth(0.3)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 4

      cvData.education.forEach((edu) => {
        yPosition = checkNewPage(yPosition)
        yPosition += 2

        const school = edu.school || ''
        const degree = edu.degree || ''

        // Use 'field' as starting date (MM/YYYY format), fallback to 'startDate'
        const formattedStart = formatDate(edu.field || edu.startDate)
        const gradYear = edu.graduationYear || ''
        const dateStr = formattedStart
          ? `${formattedStart} – ${gradYear || 'Present'}`
          : gradYear

        pdf.setFontSize(fontSize)

        // Draw School name in BOLD
        pdf.setFont('helvetica', 'bold')
        const schoolWidth = pdf.getTextWidth(school)
        pdf.text(school, margin, yPosition)

        // Draw ", Degree" in NORMAL
        if (degree) {
          pdf.setFont('helvetica', 'normal')
          pdf.text(`, ${degree}`, margin + schoolWidth, yPosition)
        }

        // Draw Date range RIGHT-aligned
        if (dateStr) {
          pdf.setFontSize(fontSize - 1)
          pdf.setFont('helvetica', 'normal')
          pdf.text(dateStr, pageWidth - margin, yPosition, { align: 'right' })
        }

        yPosition += 5
      })

      yPosition += 4
    }

    // ========================================
    // Skills
    // ========================================
    if (cvData.skills && Object.keys(cvData.skills).length > 0) {
      yPosition = checkNewPage(yPosition)

      // Section title
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.text('SKILLS', margin, yPosition)
      yPosition += 2

      // Underline
      pdf.setDrawColor(0, 0, 0)
      pdf.setLineWidth(0.3)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 4

      // Each skill category on its own line
      Object.entries(cvData.skills).forEach(([category, skillList]) => {
        if (!skillList || skillList.length === 0) return

        yPosition = checkNewPage(yPosition)

        pdf.setFontSize(fontSize)
        pdf.setFont('helvetica', 'bold')

        const categoryText = `${category}: `
        const skillsText = skillList.join(', ')
        const fullText = categoryText + skillsText

        const textLines = pdf.splitTextToSize(fullText, maxWidth)

        textLines.forEach((line: string, index: number) => {
          yPosition = checkNewPage(yPosition)

          if (index === 0) {
            const categoryWidth = pdf.getTextWidth(categoryText)
            pdf.text(categoryText, margin, yPosition)

            pdf.setFont('helvetica', 'normal')
            const remainingText = line.substring(categoryText.length) || skillsText
            pdf.text(remainingText, margin + categoryWidth, yPosition)
          } else {
            pdf.setFont('helvetica', 'normal')
            pdf.text(line, margin, yPosition)
          }

          yPosition += 4.5
        })
      })
    }

    console.log('[PDF Compiler] PDF generation complete')

    const pdfBlob = pdf.output('blob')
    return {
      success: true,
      pdfBlob
    }
  } catch (error) {
    console.error('[PDF Compiler] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

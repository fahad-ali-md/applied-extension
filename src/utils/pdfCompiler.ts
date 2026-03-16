/**
 * PDF Compiler for LaTeX CV
 *
 * Converts LaTeX content to PDF using client-side JavaScript
 * Uses jsPDF for PDF generation (no external server needed)
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
// Default CV LaTeX Template
// ============================================

export const DEFAULT_CV_TEMPLATE = `\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=2cm]{geometry}
\\usepackage{hyperref}
\\usepackage{enumitem}
\\usepackage{parskip}
\\usepackage{titlesec}
\\usepackage{array}

% Section formatting
\\titleformat{\\section}
  {\\normalfont\\small\\bfseries\\uppercase}
  {}{0em}{}[\\vspace{-4pt}\\rule{\\linewidth}{0.4pt}]
\\titlespacing{\\section}{0pt}{10pt}{6pt}

% No page numbers
\\pagestyle{empty}

% List spacing
\\setlist[itemize]{noitemsep, topsep=2pt, leftmargin=1.2em}

\\begin{document}

% ════════════════════════════════════════════════════
% HEADER
% ════════════════════════════════════════════════════
\\begin{center}
  {\\LARGE\\textbf{Rakib Hasan}}\\\\[4pt]
  {\\normalsize Software Engineer · Full Stack Developer}\\\\[6pt]
  {\\small
    rakib@email.com \\quad|\\quad
    +880-1700-000000 \\quad|\\quad
    \\href{https://linkedin.com/in/rakib}{linkedin.com/in/rakib} \\quad|\\quad
    \\href{https://github.com/rakib}{github.com/rakib}
  }
\\end{center}

\\vspace{8pt}

% ════════════════════════════════════════════════════
% EXPERIENCE
% ════════════════════════════════════════════════════
\\section{Experience}

\\textbf{Senior Software Engineer} \\hfill \\textit{2022 -- Present}\\\\
TechCorp Ltd, Dhaka
\\begin{itemize}
  \\item Built microservices architecture serving 500k+ daily users
  \\item Reduced API response time by 40\\% through Redis caching
  \\item Led a team of 5 engineers across 3 product verticals
\\end{itemize}

\\vspace{4pt}

\\textbf{Junior Developer} \\hfill \\textit{2020 -- 2022}\\\\
Startup BD, Dhaka
\\begin{itemize}
  \\item Developed REST APIs using Node.js and PostgreSQL
  \\item Delivered 10+ client projects on time and within budget
\\end{itemize}

% ════════════════════════════════════════════════════
% EDUCATION
% ════════════════════════════════════════════════════
\\section{Education}

\\textbf{B.Sc in Computer Science \\& Engineering} \\hfill \\textit{2016 -- 2020}\\\\
Bangladesh University of Engineering and Technology (BUET)\\\\
CGPA: 3.75 / 4.00

% ════════════════════════════════════════════════════
% SKILLS
% ════════════════════════════════════════════════════
\\section{Skills}

\\begin{tabular}{@{} l l}
  \\textbf{Languages}  & TypeScript, Python, Go, SQL \\\\[2pt]
  \\textbf{Frameworks} & React, Next.js, Node.js, FastAPI \\\\[2pt]
  \\textbf{Tools}      & Docker, Kubernetes, AWS, PostgreSQL, Redis \\\\
\\end{tabular}

% ════════════════════════════════════════════════════
% PROJECTS
% ════════════════════════════════════════════════════
\\section{Projects}

\\textbf{OpenBazaar BD} \\hfill
\\href{https://github.com/rakib/openbazaar}{\\small github.com/rakib/openbazaar}\\\\
E-commerce platform for local artisans — Next.js, Stripe, Supabase. 2k+ active users.

\\vspace{4pt}

\\textbf{BanglaNLP Toolkit} \\hfill
\\href{https://github.com/rakib/bangla-nlp}{\\small github.com/rakib/bangla-nlp}\\\\
Open-source NLP library for Bangla text processing. 300+ GitHub stars.

\\end{document}`

// ============================================
// LaTeX to Simple Text Parser
// ============================================

/**
 * Parse simple LaTeX subset to plain text with formatting
 * This is a simplified parser that handles common LaTeX commands
 * For full LaTeX support, consider using a server-side LaTeX compiler
 */
class LatexParser {
  private text: string = ''
  private fontSize: number = 12
  private isBold: boolean = false
  private isSection: boolean = false
  private x: number = 20
  private y: number = 20
  private lineHeight: number = 7
  private pageHeight: number = 280
  private pageWidth: number = 190
  private margin: number = 20

  constructor(latex: string, options: CompileOptions = {}) {
    this.lineHeight = options.lineHeight || 7
    this.margin = options.margin || 20
    this.x = this.margin
    this.y = this.margin

    // Parse LaTeX and extract text content
    this.text = this.parseLatexToText(latex)
  }

  /**
   * Parse LaTeX to extract plain text content
   * Handles common LaTeX commands
   */
  private parseLatexToText(latex: string): string {
    let text = latex

    // Remove document class and packages
    text = text.replace(/\\documentclass\[[^\]]*\]\{[^}]*\}/g, '')
    text = text.replace(/\\usepackage\[[^\]]*\]\{[^}]*\}/g, '')
    text = text.replace(/\\usepackage\{[^}]*\}/g, '')
    text = text.replace(/\\hypersetup\{[^}]*\}/g, '')

    // Remove formatting commands but keep content
    text = text.replace(/\\textbf\{([^}]*)\}/g, '**$1**') // Bold
    text = text.replace(/\\textit\{([^}]*)\}/g, '*$1*')   // Italic
    text = text.replace(/\\underline\{([^}]*)\}/g, '_$1_') // Underline
    text = text.replace(/\\texttt\{([^}]*)\}/g, '`$1`')   // Monospace
    text = text.replace(/\\textsc\{([^}]*)\}/g, '$1')     // Small caps
    text = text.replace(/\\textbackslash\{}/g, '\\\\')
    text = text.replace(/\\textasciitilde\{}/g, '~')
    text = text.replace(/\\textasciicircum\{}/g, '^')

    // Handle href
    text = text.replace(/\\href\{([^}]*)\}\{([^}]*)\}/g, '$2 ($1)')

    // Remove environments
    text = text.replace(/\\begin\{[^}]*\}/g, '')
    text = text.replace(/\\end\{[^}]*\}/g, '')

    // Remove other LaTeX commands
    text = text.replace(/\\[a-zA-Z]+(\[[^\]]*\])?\{?/g, ' ')
    text = text.replace(/\\vspace\{[^}]*\}/g, '\n\n')
    text = text.replace(/\\hfill/g, '           ')
    text = text.replace(/\\newline/g, '\n')
    text = text.replace(/\\rule\{[^}]*\}\{[^}]*\}/g, '____________________\n')

    // Clean up
    text = text.replace(/\{}/g, '')
    text = text.replace(/\\\\/g, '\n')
    text = text.replace(/\\\\/g, '\n')

    // Remove document environment
    text = text.replace(/\\begin\{document\}/g, '')
    text = text.replace(/\\end\{document\}/g, '')

    // Clean up extra whitespace
    text = text.replace(/\n{3,}/g, '\n\n')
    text = text.trim()

    return text
  }

  /**
   * Add text to PDF with word wrapping
   */
  addTextToPDF(pdf: jsPDF, text: string, fontSize: number = 12, isBold: boolean = false): void {
    pdf.setFontSize(fontSize)
    pdf.setFont('helvetica', isBold ? 'bold' : 'normal')

    const lines = text.split('\n')
    const maxWidth = this.pageWidth - (2 * this.margin)

    for (const line of lines) {
      if (this.y > this.pageHeight) {
        pdf.addPage()
        this.y = this.margin
      }

      // Check for bold markers
      const processedLine = this.processBoldMarkers(line)
      const segments = processedLine.segments

      let currentX = this.x
      const words: Array<{ text: string; bold: boolean }> = []

      // Split into words with their bold status
      for (let i = 0; i < segments.length; i++) {
        const segmentWords = segments[i].text.split(' ')
        const isBold = segments[i].bold

        for (const word of segmentWords) {
          if (word) {
            words.push({ text: word, bold: isBold })
          }
        }
      }

      // Word wrap
      let lineText = ''
      let lastBoldState = false

      for (const wordObj of words) {
        pdf.setFont('helvetica', wordObj.bold ? 'bold' : 'normal')
        const wordWidth = pdf.getTextWidth(wordObj.text + ' ')

        if (currentX + wordWidth > this.pageWidth - this.margin && lineText !== '') {
          // Print current line
          pdf.text(lineText.trim(), this.x, this.y)
          this.y += this.lineHeight
          currentX = this.x
          lineText = ''
        }

        if (lastBoldState !== wordObj.bold && lineText !== '') {
          pdf.setFont('helvetica', lastBoldState ? 'bold' : 'normal')
          pdf.text(lineText.trim(), this.x + currentX - this.x, this.y)
          currentX += pdf.getTextWidth(lineText)
          lineText = ''
        }

        lineText += wordObj.text + ' '
        lastBoldState = wordObj.bold
      }

      if (lineText.trim()) {
        pdf.setFont('helvetica', lastBoldState ? 'bold' : 'normal')
        pdf.text(lineText.trim(), this.x, this.y)
      }

      this.y += this.lineHeight
    }
  }

  /**
   * Process **bold** markers in text
   */
  private processBoldMarkers(text: string): { segments: Array<{ text: string; bold: boolean }> } {
    const segments: Array<{ text: string; bold: boolean }> = []
    const regex = /\*\*([^*]+)\*\*/g
    let lastIndex = 0
    let match

    while ((match = regex.exec(text)) !== null) {
      // Add text before bold (normal)
      if (match.index > lastIndex) {
        const normalText = text.substring(lastIndex, match.index)
        segments.push({ text: normalText, bold: false })
      }

      // Add bold text
      segments.push({ text: match[1], bold: true })
      lastIndex = regex.lastIndex
    }

    // Add remaining text (normal)
    if (lastIndex < text.length) {
      segments.push({ text: text.substring(lastIndex), bold: false })
    }

    // If no bold markers found, treat entire text as normal
    if (segments.length === 0) {
      segments.push({ text, bold: false })
    }

    return { segments }
  }

  /**
   * Get parsed text content
   */
  getText(): string {
    return this.text
  }
}

// ============================================
// Main Compiler Function
// ============================================

/**
 * Compile LaTeX content to PDF blob
 * If no latexContent provided, uses the DEFAULT_CV_TEMPLATE
 */
export async function compileLatexToPDF(
  latexContent: string = DEFAULT_CV_TEMPLATE,
  options: CompileOptions = {}
): Promise<PDFCompileResult> {
  try {
    console.log('[PDF Compiler] Starting PDF compilation...')

    // Create new PDF document (A4 size)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    // Parse LaTeX content
    const parser = new LatexParser(latexContent, options)
    const text = parser.getText()

    // Split into sections based on lines
    const lines = text.split('\n')
    let yPosition = 20
    const margin = 20
    const lineHeight = options.lineHeight || 7
    const pageHeight = 280

    // Process header section (name, title, contact)
    let inHeader = true
    let headerLines: string[] = []
    let lineIndex = 0

    for (const line of lines) {
      if (line.trim() === '') {
        if (inHeader && headerLines.length > 0) {
          inHeader = false
        }
        continue
      }

      // Check for page break
      if (yPosition > pageHeight) {
        pdf.addPage()
        yPosition = 20
      }

      // Determine font style
      const isBold = line.startsWith('**') || line.includes('**')
      const cleanLine = line.replace(/\*\*/g, '').trim()

      if (!cleanLine) {
        yPosition += lineHeight / 2
        continue
      }

      // Header section (centered, larger)
      if (inHeader) {
        if (headerLines.length === 0) {
          // Name (largest)
          pdf.setFontSize(20)
          pdf.setFont('helvetica', 'bold')
          pdf.text(cleanLine, 105, yPosition, { align: 'center' })
          yPosition += 10
        } else if (headerLines.length === 1) {
          // Title
          pdf.setFontSize(14)
          pdf.setFont('helvetica', 'normal')
          pdf.text(cleanLine, 105, yPosition, { align: 'center' })
          yPosition += 8
        } else {
          // Contact info (smaller)
          pdf.setFontSize(10)
          pdf.setFont('helvetica', 'normal')
          pdf.text(cleanLine, 105, yPosition, { align: 'center' })
          yPosition += lineHeight
        }
        headerLines.push(cleanLine)

        // Check if header is done (when we see an empty line or section marker)
        if (lineIndex > 5 || (headerLines.length > 3 && lines[lineIndex + 1]?.trim() === '')) {
          inHeader = false
          yPosition += 5
        }
      } else {
        // Body content (left-aligned)
        // Check for section headers (UPPERCASE lines or lines with ___)
        const isSectionHeader = cleanLine === cleanLine.toUpperCase() ||
          cleanLine.includes('_____') ||
          cleanLine.includes('======')

        if (isSectionHeader) {
          pdf.setFontSize(14)
          pdf.setFont('helvetica', 'bold')
          pdf.text(cleanLine.replace(/_/g, '').replace(/=/g, ''), margin, yPosition)
          yPosition += lineHeight + 2

          // Add underline for section
          pdf.setLineWidth(0.5)
          pdf.line(margin, yPosition, 190 - margin, yPosition)
          yPosition += lineHeight
        } else {
          // Regular content
          const fontSize = cleanLine.length < 50 ? 12 : 11
          pdf.setFontSize(fontSize)
          pdf.setFont('helvetica', isBold ? 'bold' : 'normal')

          // Word wrap for long lines
          const maxWidth = 190 - (2 * margin)
          const words = cleanLine.split(' ')
          let currentLine = ''

          for (const word of words) {
            const testLine = currentLine + (currentLine ? ' ' : '') + word
            const textWidth = pdf.getTextWidth(testLine)

            if (textWidth > maxWidth && currentLine !== '') {
              pdf.text(currentLine, margin, yPosition)
              yPosition += lineHeight
              currentLine = word

              if (yPosition > pageHeight) {
                pdf.addPage()
                yPosition = 20
              }
            } else {
              currentLine = testLine
            }
          }

          if (currentLine) {
            pdf.text(currentLine, margin, yPosition)
            yPosition += lineHeight
          }
        }
      }

      lineIndex++
    }

    // Generate PDF blob
    const pdfBlob = pdf.output('blob')
    console.log('[PDF Compiler] PDF generated successfully')

    return {
      success: true,
      pdfBlob
    }
  } catch (error) {
    console.error('[PDF Compiler] Error compiling PDF:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
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
 * Convert PDF blob to base64 (for debugging)
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
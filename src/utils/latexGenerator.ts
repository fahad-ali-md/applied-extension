/**
 * LaTeX CV Generator
 *
 * Converts JSON CV data to LaTeX format using template-based approach
 * Template placeholders are replaced with actual data
 */

// ============================================
// Types
// ============================================

export interface CVPersonalInfo {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  city?: string
  country?: string
  linkedIn?: string
  portfolio?: string
  github?: string
}

export interface CVExperience {
  company?: string
  role?: string
  startDate?: string
  endDate?: string
  current?: boolean
  highlights?: string[]
}

export interface CVEducation {
  degree?: string
  school?: string
  graduationYear?: string
  startDate?: string
  endDate?: string
}

export interface CVProject {
  name?: string
  description?: string
  highlights?: string[]
  technologies?: string[]
  url?: string
  date?: string
}

export interface CVCertification {
  name?: string
  issuer?: string
  date?: string
}

export interface CVSkills {
  technical?: string[]
  tools?: string[]
  languages?: string[]
}

export interface CVData {
  personal?: CVPersonalInfo
  professional?: {
    summary?: string
    currentTitle?: string
  }
  experience?: CVExperience[]
  education?: CVEducation[]
  projects?: CVProject[]
  certifications?: CVCertification[]
  skills?: CVSkills
}

// ============================================
// Date Formatting
// ============================================

/**
 * Format date string to LaTeX-friendly format
 * Handles: "09/2025", "2025-09", "September 2025", etc.
 */
function formatDate(dateStr?: string): string {
  if (!dateStr) return ''

  // Handle MM/YYYY format
  const monthYearMatch = dateStr.match(/^(\d{1,2})\/(\d{4})$/)
  if (monthYearMatch) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const month = months[parseInt(monthYearMatch[1]) - 1]
    const year = monthYearMatch[2]
    return `${month} ${year}`
  }

  // Handle YYYY-MM format
  const yearMonthMatch = dateStr.match(/^(\d{4})-(\d{1,2})$/)
  if (yearMonthMatch) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const month = months[parseInt(yearMonthMatch[2]) - 1]
    const year = yearMonthMatch[1]
    return `${month} ${year}`
  }

  // Return as-is if can't parse
  return dateStr
}

/**
 * Format date range for experience/education
 */
function formatDateRange(startDate?: string, endDate?: string, current?: boolean): string {
  const start = formatDate(startDate)
  const end = current ? 'Present' : formatDate(endDate)

  if (!start && !end) return ''
  if (!start) return end
  if (!end) return `${start} -- Present`

  return `${start} -- ${end}`
}

// ============================================
// LaTeX Escaping
// ============================================

/**
 * Escape special LaTeX characters
 */
function escapeLatex(text: string): string {
  if (!text) return ''
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
}

// ============================================
// Section Generators
// ============================================

/**
 * Generate header section
 */
function generateHeader(personal: CVPersonalInfo, professionalTitle?: string): {
  full_name: string
  title: string
  phone_line: string
  email_line: string
  links_line: string
} {
  const fullName = [
    personal.firstName,
    personal.lastName
  ].filter(Boolean).join(' ') || 'Your Name'

  const title = professionalTitle || 'Full Stack Developer' // Use professional title if provided

  // Phone line
  let phoneLine = ''
  if (personal.phone) {
    phoneLine = `\\hrefWithoutArrow{tel:${personal.phone}}{${escapeLatex(personal.phone)}} \\par`
  }

  // Email line
  let emailLine = ''
  if (personal.email) {
    emailLine = `\\hrefWithoutArrow{mailto:${personal.email}}{${escapeLatex(personal.email)}} \\par`
  }

  // Build links line with separators
  const links: string[] = []
  if (personal.github) {
    links.push(`\\hrefWithoutArrow{https://github.com/${personal.github.replace('https://github.com/', '')}}{GitHub}`)
  }
  if (personal.linkedIn) {
    links.push(`\\hrefWithoutArrow{${personal.linkedIn}}{LinkedIn}`)
  }
  if (personal.portfolio) {
    links.push(`\\hrefWithoutArrow{${personal.portfolio}}{Portfolio}`)
  }

  // Join with kern and textbar separators
  const linksLine = links.map(link => link).join(' \\kern 5.0 pt \\textbar \\kern 5.0 pt ')

  return {
    full_name: escapeLatex(fullName.toUpperCase()),
    title: escapeLatex(title),
    phone_line: phoneLine,
    email_line: emailLine,
    links_line: linksLine
  }
}

/**
 * Generate summary section
 */
function generateSummary(summary?: string): string {
  if (!summary) return ''
  return `\\section{Summary}\n\\begin{onecolentry}\n${escapeLatex(summary)}\n\\end{onecolentry}\n`
}

/**
 * Generate experience section
 */
function generateExperienceSection(experiences: CVExperience[] = []): string {
  if (!experiences || experiences.length === 0) {
    return '\\textit{No experience details available}'
  }

  return experiences.map(exp => {
    const company = escapeLatex(exp.company || '')
    const role = escapeLatex(exp.role || '')
    const dateRange = escapeLatex(formatDateRange(exp.startDate, exp.endDate, exp.current))

    let content = `\\begin{twocolentry}{${dateRange}}\n`
    content += `\\textbf{${company}}: ${role}\\end{twocolentry}\n`
    content += `\\begin{onecolentry}\n`

    // Add highlights if exist
    if (exp.highlights && exp.highlights.length > 0) {
      content += '\\begin{highlightsforbulletentries}\n'
      exp.highlights.forEach(highlight => {
        content += `\\item ${escapeLatex(highlight)}\n`
      })
      content += '\\end{highlightsforbulletentries}\n'
    }

    content += '\\end{onecolentry}\n'

    return content
  }).join('\n')
}

/**
 * Generate education section
 */
function generateEducationSection(education: CVEducation[] = []): string {
  if (!education || education.length === 0) {
    return '\\textit{No education details available}'
  }

  return education.map(edu => {
    const degree = escapeLatex(edu.degree || '')
    const school = escapeLatex(edu.school || '')
    // Use endDate to extract the year, or graduationYear as fallback
    let year = ''
    if (edu.endDate) {
      const dateMatch = edu.endDate.match(/(\d{4})/)
      year = dateMatch ? dateMatch[1] : ''
    }
    if (!year && edu.graduationYear) {
      const dateMatch = edu.graduationYear.match(/(\d{4})/)
      year = dateMatch ? dateMatch[1] : ''
    }

    let content = `\\begin{twocolentry}{${escapeLatex(year)}}\n`
    content += `\\textbf{${degree}}, ${school}\\end{twocolentry}\n`

    return content
  }).join('\n')
}

/**
 * Generate projects section
 */
function generateProjectsSection(projects: CVProject[] = []): string {
  if (!projects || projects.length === 0) {
    return ''
  }

  const projectsLatex = projects.map(project => {
    const name = escapeLatex(project.name || '')
    const description = escapeLatex(project.description || '')
    const technologies = project.technologies
      ? project.technologies.map(escapeLatex).join(', ')
      : ''
    const url = project.url
    const date = project.date ? escapeLatex(formatDate(project.date)) : ''

    let content = `\\begin{twocolentry}{${date}}\n`
    content += `\\textbf{${name}}\\end{twocolentry}\n`
    content += `\\begin{onecolentry}\n`
    content += `\\begin{highlights}\n`

    // Add description as first item
    if (description) {
      content += `\\item ${description}\n`
    }

    // Add highlights as bullets
    if (project.highlights && project.highlights.length > 0) {
      project.highlights.forEach(highlight => {
        content += `\\item ${escapeLatex(highlight)}\n`
      })
    }

    // Add tech stack
    if (technologies) {
      content += `\\item \\textbf{Tech Stack:} ${technologies}\n`
    }

    // Add URL if exists
    if (url) {
      content += `\\item \\textbf{Website:} \\hrefWithoutArrow{${url}}{${escapeLatex(url)}}\n`
    }

    content += `\\end{highlights}\n`
    content += `\\end{onecolentry}\n`

    return content
  }).join('\n')

  return projectsLatex
}

/**
 * Generate skills section
 */
function generateSkillsSection(skills?: CVSkills): string {
  if (!skills) {
    return '\\textit{No skills information available}'
  }

  const sections: string[] = []

  // Combine technical and tools skills into one frontend section
  const frontendSkills = [
    ...(skills.technical || []),
    ...(skills.tools || [])
  ]

  if (frontendSkills.length > 0) {
    sections.push(`\\textbf{Frontend:} ${frontendSkills.slice(0, 8).map(escapeLatex).join(', ')}`)
  }

  if (skills.languages && skills.languages.length > 0) {
    sections.push(`\\textbf{Languages:} ${skills.languages.map(escapeLatex).join(' \\dotfill ')}`)
  }

  return sections.length > 0
    ? `\\begin{onecolentry}\n${sections.join(' \\\\\n')}\n\\end{onecolentry}\n`
    : '\\textit{No skills information available}'
}

/**
 * Generate certifications section
 */
function generateCertificationsSection(certifications?: CVCertification[]): string {
  if (!certifications || certifications.length === 0) {
    return ''
  }

  const certsLatex = certifications.map(cert => {
    const name = escapeLatex(cert.name || '')
    const issuer = escapeLatex(cert.issuer || '')

    return `\\textbf{${name}} - ${issuer}`
  }).join(' \\\\\n')

  return `\\section{Certification}\n\n\\begin{twocolentry}{}\n${certsLatex}\\end{twocolentry}\n\n`
}

// ============================================
// Main Generator Function
// ============================================

/**
 * Convert CV JSON data to complete LaTeX document
 */
export function generateLatexCV(cvData: CVData): string {
  // Read template
  const template = getLatexTemplate()

  // Generate all sections
  const header = generateHeader(cvData.personal || {}, cvData.professional?.currentTitle)
  const summary = generateSummary(cvData.professional?.summary)
  const experience = generateExperienceSection(cvData.experience)
  const education = generateEducationSection(cvData.education)
  const projects = generateProjectsSection(cvData.projects)
  const skills = generateSkillsSection(cvData.skills)
  const certifications = generateCertificationsSection(cvData.certifications)

  // Replace placeholders in template
  let latex = template
  latex = latex.replace(/{{FULL_NAME}}/g, header.full_name)
  latex = latex.replace(/{{TITLE}}/g, header.title)
  latex = latex.replace(/{{PHONE_LINE}}/g, header.phone_line)
  latex = latex.replace(/{{EMAIL_LINE}}/g, header.email_line)
  latex = latex.replace(/{{LINKS_LINE}}/g, header.links_line)
  latex = latex.replace(/{{SUMMARY_SECTION}}/g, summary)
  latex = latex.replace(/{{EXPERIENCE_SECTION}}/g, experience)
  latex = latex.replace(/{{EDUCATION_SECTION}}/g, education)
  latex = latex.replace(/{{PROJECTS_SECTION}}/g, projects)
  latex = latex.replace(/{{SKILLS_SECTION}}/g, skills)
  latex = latex.replace(/{{CERTIFICATIONS_SECTION}}/g, certifications)

  return latex
}

/**
 * Get LaTeX template string
 * In production, this could be loaded from a file or stored in storage
 */
function getLatexTemplate(): string {
  // Professional CV template with custom environments
  return `\\documentclass[10pt, letterpaper]{article}

% Packages:
\\usepackage[
    ignoreheadfoot,
    top=1.5 cm,
    bottom=1.5 cm,
    left=1.5 cm,
    right=1.5 cm,
    footskip=0.8 cm
]{geometry}
\\usepackage{titlesec}
\\usepackage{tabularx}
\\usepackage{array}
\\usepackage[dvipsnames]{xcolor}
\\definecolor{primaryColor}{RGB}{0, 0, 0}
\\usepackage{enumitem}
\\usepackage{amsmath}
\\usepackage[
    pdftitle={{{FULL_NAME}}'s CV},
    pdfauthor={{{FULL_NAME}}},
    pdfcreator={LaTeX with RenderCV},
    colorlinks=true,
    urlcolor=primaryColor
]{hyperref}
\\usepackage[pscoord]{eso-pic}
\\usepackage{calc}
\\usepackage{bookmark}
\\usepackage{lastpage}
\\usepackage{changepage}
\\usepackage{paracol}
\\usepackage{ifthen}
\\usepackage{needspace}
\\usepackage{iftex}

% Ensure ATS compatibility:
\\ifPDFTeX
    \\input{glyphtounicode}
    \\pdfgentounicode=1
    \\usepackage[T1]{fontenc}
    \\usepackage[utf8]{inputenc}
\\fi

\\usepackage{XCharter}

% Settings:
\\raggedright
\\AtBeginEnvironment{adjustwidth}{\\partopsep0pt}
\\pagestyle{empty}
\\setcounter{secnumdepth}{0}
\\setlength{\\parindent}{0pt}
\\setlength{\\topskip}{0pt}
\\setlength{\\columnsep}{0.15cm}
\\pagenumbering{gobble}

\\titleformat{\\section}{\\needspace{4\\baselineskip}\\bfseries\\large}{}{0pt}{}[\\vspace{1pt}\\titlerule]

\\titlespacing{\\section}{
    0pt
}{
    0.15 cm
}{
    0.1 cm
}

\\renewcommand\\labelitemi{$\\vcenter{\\hbox{\\small$\\bullet$}}$}

\\newenvironment{highlights}{
    \\begin{itemize}[
        topsep=0pt,
        parsep=0pt,
        partopsep=0pt,
        itemsep=0pt,
        leftmargin=0 cm + 10pt
    ]
}{
    \\end{itemize}
}

\\newenvironment{highlightsforbulletentries}{
    \\begin{itemize}[
        topsep=0pt,
        parsep=0pt,
        partopsep=0pt,
        itemsep=0pt,
        leftmargin=10pt
    ]
}{
    \\end{itemize}
}

\\newenvironment{onecolentry}{
    \\begin{adjustwidth}{
        0 cm + 0.00001 cm
    }{
        0 cm + 0.00001 cm
    }
}{
    \\end{adjustwidth}
}

\\newenvironment{twocolentry}[2][]{
    \\onecolentry
    \\def\\secondColumn{#2}
    \\setcolumnwidth{\\fill, 4.5 cm}
    \\begin{paracol}{2}
}{
    \\switchcolumn \\raggedleft \\secondColumn
    \\end{paracol}
    \\endonecolentry
}

\\newenvironment{threecolentry}[3][]{
    \\onecolentry
    \\def\\thirdColumn{#3}
    \\setcolumnwidth{, \\fill, 4.5 cm}
    \\begin{paracol}{3}
    {\\raggedright #2} \\switchcolumn
}{
    \\switchcolumn \\raggedleft \\thirdColumn
    \\end{paracol}
    \\endonecolentry
}

\\newenvironment{header}{
    \\setlength{\\topsep}{0pt}\\par\\kern\\topsep\\centering\\linespread{1.5}
}{
    \\par\\kern\\topsep
}

\\newcommand{\\placelastupdatedtext}{
  \\AddToShipoutPictureFG*{
    \\put(
        \\LenToUnit{\\paperwidth-2 cm-0 cm+0.05cm},
        \\LenToUnit{\\paperheight-1.0 cm}
    ){\\vtop{{\\null}\\makebox[0pt][c]{
        \\small\\color{gray}\\textit{Last updated in March 2026}\\hspace{\\widthof{Last updated in March 2026}}
    }}}
  }%
}

% Save original href command:
\\let\\hrefWithoutArrow\\href

% External links:
\\newcommand{\\externalLink}[2]{%
  \\hrefWithoutArrow{#1}{#2}\\kern 0.15em\\raisebox{-0.1ex}{\\smaller\\faExternalLink*}%
}

\\begin{document}
    \\newcommand{\\AND}{\\unskip
        \\cleaders\\copy\\ANDbox\\hskip\\wd\\ANDbox
        \\ignorespaces
    }
    \\newsavebox\\ANDbox
    \\sbox\\ANDbox{$|$}

    \\begin{header}
        {\\fontsize{25 pt}{25 pt}\\selectfont \\centering {{FULL_NAME}} \\\\%}
        \\normalsize
        {{TITLE}}
        \\par
        {{PHONE_LINE}}
        \\par
        {{EMAIL_LINE}}
        \\par
        {{LINKS_LINE}}
    \\end{header}

    \\placelastupdatedtext

% Summary Section
{{SUMMARY_SECTION}}

% Experience Section
\\section{Experience}
{{EXPERIENCE_SECTION}}

% Education Section
\\section{Education}
{{EDUCATION_SECTION}}

% Projects Section
\\section{Projects}
{{PROJECTS_SECTION}}

% Skills Section
\\section{Skills}
{{SKILLS_SECTION}}

% Certifications Section (if exists)
{{CERTIFICATIONS_SECTION}}

\\end{document}`
}

// ============================================
// Utility Functions
// ============================================

/**
 * Validate CV data structure
 */
export function validateCVData(cvData: any): cvData is CVData {
  return cvData && typeof cvData === 'object'
}

/**
 * Check if CV has minimum required data
 */
export function hasMinimumCVData(cvData: CVData): boolean {
  return !!(
    cvData.personal?.firstName ||
    cvData.personal?.lastName ||
    cvData.personal?.email
  )
}

/**
 * Get CV statistics
 */
export function getCVStats(cvData: CVData): {
  experiences: number
  education: number
  projects: number
  certifications: number
  hasSkills: boolean
} {
  return {
    experiences: cvData.experience?.length || 0,
    education: cvData.education?.length || 0,
    projects: cvData.projects?.length || 0,
    certifications: cvData.certifications?.length || 0,
    hasSkills: !!(
      cvData.skills?.technical?.length ||
      cvData.skills?.tools?.length ||
      cvData.skills?.languages?.length
    )
  }
}

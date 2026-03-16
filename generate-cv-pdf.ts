/**
 * Test Script: Template-based CV PDF Generation (Inline Template)
 * LaTeX template is hardcoded as string literal
 */

import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'

// Types
interface CVEducation {
  degree?: string
  school?: string
  graduationYear?: string
}

interface CVExperience {
  company?: string
  role?: string
  startDate?: string
  endDate?: string
  current?: boolean
  highlights?: string[]
}

interface CVProject {
  name?: string
  description?: string
  technologies?: string[]
}

interface CVSkills {
  [category: string]: string[] | undefined // Dynamic categories: { "Frontend Development": [...], "Backend Development": [...] }
}

interface CVData {
  personal?: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    linkedIn?: string
    github?: string
    portfolio?: string
  }
  professional?: {
    summary?: string
    currentTitle?: string
  }
  experience?: CVExperience[]
  education?: CVEducation[]
  projects?: CVProject[]
  skills?: CVSkills
  rawText?: string
}

console.log('📄 Template-based CV PDF Generator (Inline Template)')
console.log('=================================================\n')

// Step 1: Read cv.json
console.log('📄 Step 1: Reading cv.json...')
const cvJsonPath = './cv.json'
const cvData: CVData = JSON.parse(readFileSync(cvJsonPath, 'utf-8'))
console.log('✅ CV Data loaded')

// Step 2: LaTeX Template (inline)
console.log('\n📄 Step 2: Using inline template...')

let latex = `
\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=0.75in]{geometry}
\\usepackage{enumitem}
\\usepackage{hyperref}
\\usepackage{titlesec}
\\usepackage{xcolor}

% Custom formatting
\\pagestyle{empty}
\\setlist[itemize]{noitemsep, topsep=2pt, leftmargin=1.2em}
\\hypersetup{
    colorlinks=true,
    linkcolor=blue,
    urlcolor=blue,
    pdftitle={{{FULL_NAME}} - CV},
    pdfauthor={{{FULL_NAME}}}
}

% Section formatting
\\titleformat{\\section}{
  \\large\\bfseries\\uppercase
}{}{0em}{}[\\titlerule]

% Custom command for experience entries
\\newcommand{\\expentry}[3]{%
  \\vspace{4pt}%
  \\noindent\\textbf{#1} - #2 \\hfill \\textbf{#3}\\\\[-2pt]%
}

\\begin{document}

% Header Section
\\begin{center}
  {\\huge\\textbf{{{FULL_NAME}}}}\\\\[0.3cm]
  {{TITLE}}\\\\[0.4cm]
  {\\footnotesize {{EMAIL_PHONE_LINE}} \\textbar{} {{LINKS_LINE}}}
\\end{center}

\\vspace{0.2cm}

% Summary Section
{{SUMMARY_SECTION}}

\\vspace{0.2cm}

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
\\section{Certificate}
{{CERTIFICATIONS_SECTION}}

\\end{document}
`

console.log('✅ Template loaded')

// Step 3: Generate sections from CV data
console.log('\n📝 Step 3: Generating sections...')

// Header
const fullName = `${cvData.personal?.firstName || ''} ${cvData.personal?.lastName || ''}`.trim()
const title = cvData.professional?.currentTitle || 'Full Stack Developer'

// Combine email and phone with pipe separator (using LaTeX \textbar)
const contactParts = [cvData.personal?.email, cvData.personal?.phone].filter(Boolean)
const emailPhoneLine = contactParts.join(' \\textbar{} ')

// Links line with hyperlinks
const linkParts: string[] = []
if (cvData.personal?.linkedIn) {
  linkParts.push(`\\href{${cvData.personal.linkedIn}}{LinkedIn}`)
}
if (cvData.personal?.portfolio) {
  linkParts.push(`\\href{${cvData.personal.portfolio}}{Portfolio}`)
}
const links = linkParts.join(' \\textbar{} ')

console.log('  ✅ Header generated')

// Summary (with section formatting)
const summary = cvData.professional?.summary
  ? `\\section{Professional Summary}\n\\noindent ${escapeLatex(cvData.professional.summary)}\n`
  : ''

console.log('  ✅ Summary generated')

// Experience (sorted by date, most recent first)
const sortedExperience = [...(cvData.experience || [])].sort((a, b) => {
  // Parse dates in MM/YYYY format
  function parseDate(dateStr?: string): number {
    if (!dateStr) return 0
    // Handle MM/YYYY format
    const match = dateStr.match(/(\d{1,2})\/(\d{4})/)
    if (match) {
      const month = parseInt(match[1]) - 1 // 0-indexed
      const year = parseInt(match[2])
      return new Date(year, month).getTime()
    }
    // Try standard date parsing
    return dateStr ? new Date(dateStr).getTime() : 0
  }

  const dateA = parseDate(a.startDate)
  const dateB = parseDate(b.startDate)
  return dateB - dateA // Descending order (most recent first)
})

const experience = sortedExperience.map(exp => {
  const date = exp.current
    ? `${formatDate(exp.startDate)} - Present`
    : `${formatDate(exp.startDate)} - ${formatDate(exp.endDate)}`

  // Use \expentry command for consistent formatting
  let content = `\\expentry{${escapeLatex(exp.company || '')}}{${escapeLatex(exp.role || '')}}{${date}}\n`

  if (exp.highlights?.length) {
    content += '\\begin{itemize}\n'
    exp.highlights.forEach(h => {
      content += `  \\item ${escapeLatex(h)}\n`
    })
    content += '\\end{itemize}\n'
  }

  return content
}).join('\n') || '\\textit{No experience}'

console.log('  ✅ Experience generated')

// Education
const education = cvData.education?.map(edu => {
  return `\\textbf{${escapeLatex(edu.degree || '')}} - ${escapeLatex(edu.school || '')} \\hfill \\textbf{${edu.graduationYear || ''}}\\\\[2pt]\n`
}).join('') || '\\textit{No education}'

console.log('  ✅ Education generated')

// Projects
const projects = cvData.projects?.map(proj => {
  let content = `\\textbf{${escapeLatex(proj.name || '')}}\\\\\n`
  if (proj.description) {
    content += `${escapeLatex(proj.description)}\\\\\n`
  }
  if (proj.technologies?.length) {
    content += `\\textbf{Tech Stack:} ${proj.technologies.map(t => escapeLatex(t)).join(', ')}\n`
  }
  // Add \vspace{4pt} between projects
  content += '\\vspace{4pt}\n'
  return content
}).join('') || ''

console.log('  ✅ Projects generated')

// Skills - Dynamic Categories
const skills = (() => {
  if (!cvData.skills || Object.keys(cvData.skills).length === 0) {
    return '\\textit{No skills}'
  }

  const categoryLines: string[] = []
  const categories = Object.entries(cvData.skills).filter(([_, skills]) => skills && skills.length > 0)

  categories.forEach(([category, skillList]) => {
    if (!skillList) return

    // Capitalize first letter of category name
    const capitalizedCategory = category.charAt(0).toUpperCase() + category.slice(1)

    // Category name in bold with skills on same line
    const skillsText = skillList.map(s => escapeLatex(s)).join(', ')
    categoryLines.push(`\\textbf{${escapeLatex(capitalizedCategory)}}: ${skillsText}`)
  })

  // Join categories with line break
  return categoryLines.join('\\\\\n') || '\\textit{No skills}'
})()

console.log('  ✅ Skills generated (dynamic categories)')

// Helper function to escape LaTeX special characters
function escapeLatex(text: string): string {
  return text
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
}

function formatDate(date?: string): string {
  if (!date) return ''
  // Handle MM/YYYY format (from cv.json)
  const matchSlash = date.match(/(\d{1,2})\/(\d{4})/)
  if (matchSlash) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return months[parseInt(matchSlash[1]) - 1] + ' ' + matchSlash[2]
  }
  // Handle YYYY-MM format
  const match = date.match(/(\d{4})-(\d{1,2})/)
  if (match) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return months[parseInt(match[2]) - 1] + ' ' + match[1]
  }
  return date
}

// Step 4: Replace placeholders in template
console.log('\n🔄 Step 4: Replacing placeholders...')

latex = latex.replace(/{{FULL_NAME}}/g, fullName)
latex = latex.replace(/{{TITLE}}/g, title)
latex = latex.replace(/{{EMAIL_PHONE_LINE}}/g, emailPhoneLine)
latex = latex.replace(/{{LINKS_LINE}}/g, links)
latex = latex.replace(/{{SUMMARY_SECTION}}/g, summary)
latex = latex.replace(/{{EXPERIENCE_SECTION}}/g, experience)
latex = latex.replace(/{{EDUCATION_SECTION}}/g, education)
latex = latex.replace(/{{PROJECTS_SECTION}}/g, projects)
latex = latex.replace(/{{SKILLS_SECTION}}/g, skills)
latex = latex.replace(/{{CERTIFICATIONS_SECTION}}/g, '')

console.log('✅ All placeholders replaced')

// Step 5: Save final LaTeX
console.log('\n💾 Step 5: Saving LaTeX...')
writeFileSync('./cv_final.tex', latex, 'utf-8')
console.log('✅ Saved to: cv_final.tex')

// Step 6: Compile to PDF
console.log('\n📦 Step 6: Compiling to PDF...')
console.log('⏳ Please wait...')

try {
  execSync('pdflatex -interaction=nonstopmode cv_final.tex', { stdio: 'inherit' })
} catch (error) {
  // pdflatex may return non-zero exit code even if PDF is generated
  // Check if PDF file exists before failing
}

// Check if PDF was actually created
const { existsSync } = await import('fs')
if (existsSync('./cv_final.pdf')) {
  console.log('✅ PDF compiled successfully!')

  const { statSync } = await import('fs')
  const pdfSize = (statSync('./cv_final.pdf').size / 1024).toFixed(2)

  console.log('\n🎉 Success! Generated files:')
  console.log('   - cv_final.tex (LaTeX source)')
  console.log(`   - cv_final.pdf (Final PDF - ${pdfSize} KB)`)

} else {
  console.error('\n❌ PDF was not generated')
  console.log('\n💡 Make sure pdflatex is installed:')
  console.log('   brew install --cask mactex')
  process.exit(1)
}

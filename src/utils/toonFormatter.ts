/**
 * TOON FORMAT - Tabular Object Oriented Notation
 *
 * Compressed tabular format for AI context
 * Reduces token usage by ~60% compared to JSON
 */

export interface ToonField {
  selector: string
  label: string
  type: string
  value: string
  required: boolean
  action: 'fill' | 'click' | 'select' | 'wait'
}

/**
 * Convert extracted fields to Toon format
 *
 * Input (JSON):
 * {
 *   fields: [
 *     { selector: "#email", label: "Email", type: "email", value: "", required: true }
 *   ]
 * }
 *
 * Output (Toon):
 * fields[4]{selector,label,type,value,required,action}:
 *   #email,Email,email,,true,fill
 *   #name,Name,text,,false,fill
 *   #submit,Submit,button,,false,click
 */
export function encodeToon(data: {
  fields: ToonField[]
  metadata?: {
    url: string
    pageTitle: string
    formType: string
    detectedATS: string[]
  }
}): string {
  let toon = ''

  // Add metadata
  if (data.metadata) {
    toon += `metadata{url,title,type,ats}:\n`
    toon += `  ${data.metadata.url},`
    toon += `${data.metadata.pageTitle},`
    toon += `${data.metadata.formType},`
    toon += `[${data.metadata.detectedATS.join('|')}]\n\n`
  }

  // Add fields
  if (data.fields.length > 0) {
    const sampleField = data.fields[0]
    const headers = Object.keys(sampleField).join(',')

    toon += `fields[${data.fields.length}]{${headers}}:\n`

    data.fields.forEach(field => {
      const values = Object.values(field).map(v =>
        typeof v === 'string' ? `"${v}"` : String(v)
      ).join(',')
      toon += `  ${values}\n`
    })
  }

  return toon
}

/**
 * Convert extracted form data to Toon fields
 */
export function convertToToonFields(extractedData: any): ToonField[] {
  return extractedData.fields.map((field: any) => ({
    selector: field.selector,
    label: field.label || field.placeholder || field.name || field.id || 'Unknown',
    type: field.type,
    value: field.currentValue || '',
    required: field.required || false,
    action: getFieldAction(field)
  }))
}

/**
 * Determine action type for field
 */
function getFieldAction(field: any): 'fill' | 'click' | 'select' | 'wait' {
  const type = field.type?.toLowerCase() || ''
  const label = (field.label || '').toLowerCase()

  // Buttons
  if (type === 'submit' || type === 'button' || label.includes('submit') || label.includes('next')) {
    return 'click'
  }

  // Select dropdowns
  if (type === 'select' || field.options) {
    return 'select'
  }

  // Input fields (text, email, tel, textarea)
  if (['text', 'email', 'tel', 'number', 'textarea'].includes(type)) {
    return 'fill'
  }

  // Default
  return 'fill'
}

/**
 * Generate AI-friendly context with Toon format
 */
export function generateToonContext(
  extractedData: any,
  cvData: any
): string {
  const toonFields = convertToToonFields(extractedData)

  let context = `# FORM INTERACTION PLAN\n\n`
  context += `## User Goal\n`
  context += `Fill the job application form using CV data\n\n`

  context += `## CV Data Available\n`
  context += `name:${cvData?.personal?.firstName || ''} ${cvData?.personal?.lastName || ''}\n`
  context += `email:${cvData?.personal?.email || ''}\n`
  context += `phone:${cvData?.personal?.phone || ''}\n`
  context += `location:${cvData?.personal?.city || ''}, ${cvData?.personal?.state || ''}\n`
  context += `linkedin:${cvData?.personal?.linkedIn || ''}\n`
  context += `github:${cvData?.personal?.portfolio || ''}\n\n`

  context += `## Form Structure (Toon Format)\n\n`
  context += encodeToon({
    fields: toonFields,
    metadata: extractedData.metadata
  })

  context += `\n## Instructions for AI\n`
  context += `1. Map CV data to fields based on label/type\n`
  context += `2. For 'fill' action: provide the value to fill\n`
  context += `3. For 'click' action: confirm when ready to proceed\n`
  context += `4. For 'select' action: choose best matching option\n`
  context += `5. Return response in format: selector:value\n\n`

  return context
}

/**
 * Example output:
 *
 * metadata{url,title,type,ats}:
 *   https://jobs.company.com/apply,Frontend Developer,job-application,[Greenhouse]
 *
 * fields[5]{selector,label,type,value,required,action}:
 *   "#first_name","First Name","text","",true,fill
 *   "#last_name","Last Name","text","",true,fill
 *   "#email","Email","email","",true,fill
 *   "#resume","Resume","file","",false,fill
 *   "#submit","Submit Application","submit","",false,click
 */

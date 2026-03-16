/**
 * Optimized Field Mapper v2
 *
 * Optimization strategy (3 layers):
 *
 * Layer 1 — Pattern Match (FREE, zero tokens)
 *   Known field names → fill directly from CV, no AI needed
 *
 * Layer 2 — Single AI Batch (cheap, one call)
 *   Ambiguous fields → send to AI with select options included
 *   Batched at 10 fields max per call for rate limit safety
 *
 * Layer 3 — Fallback for unfilled fields
 *   Force-fill remaining fields with aggressive AI prompt
 */

import { parsePhone } from '../utils/phoneParser'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface RawDetectedField {
    tagName: string
    type: string
    name: string
    id: string
    placeholder: string
    textOrValue?: string
    options?: string[]  // for radio groups — extracted option labels
    isRadioGroup?: boolean
    label?: string
}

interface CompactField {
    i: string    // identifier
    t: string    // type
    p?: string   // placeholder
    o?: string[] // options (for select only — max 8)
    l?: string   // label
}

interface CVSnapshot {
    fn?: string   // firstName
    ln?: string   // lastName
    em?: string   // email
    ph?: string   // full phone
    ac?: string   // area code
    gn?: string   // gender
    ad?: string   // address line 1
    ad2?: string  // address line 2
    cy?: string   // city
    st?: string   // state
    zp?: string   // zipCode
    co?: string   // country
    dob?: string  // dateOfBirth YYYY-MM-DD
    age?: string  // estimated age
    ti?: string   // jobTitle
    cp?: string   // company
    su?: string   // summary
    li?: string   // linkedIn
    po?: string   // portfolio
    dg?: string   // degree
    sc?: string   // school
    gy?: string   // gradYear
    oc?: string   // occupation
}

export interface FieldMapping {
    id: string
    name: string
    value: string
    source: 'pattern' | 'ai'  // NEW: track how it was matched
}

// ─────────────────────────────────────────────
// Layer 1: Pattern matching (no AI, instant)
// ─────────────────────────────────────────────

// Known field patterns → CV key mapping
const PATTERN_MAP: Array<{ patterns: RegExp; cvKey: keyof CVSnapshot }> = [
    { patterns: /first.?name|fname|given.?name/i, cvKey: 'fn' },
    { patterns: /last.?name|lname|surname|family/i, cvKey: 'ln' },
    { patterns: /\b(full.?name|name|applicant.?name)\b/i, cvKey: 'fn' }, // will concat ln
    { patterns: /email|e-mail/i, cvKey: 'em' },
    { patterns: /area.?code|country.?code/i, cvKey: 'ac' },
    { patterns: /\bphone\b|\btel\b|\bmobile\b|phone.?num/i, cvKey: 'ph' },
    { patterns: /\baddress\b|street.?address|street.?addr|addr.?line.?1/i, cvKey: 'ad' },
    { patterns: /address.?2|addr.?line.?2|apt|suite/i, cvKey: 'ad2' },
    { patterns: /\bcity\b|\btown\b/i, cvKey: 'cy' },
    { patterns: /\bstate\b|\bprovince\b|\bregion\b/i, cvKey: 'st' },
    { patterns: /zip|postal/i, cvKey: 'zp' },
    { patterns: /\bcountry\b/i, cvKey: 'co' },
    { patterns: /linkedin/i, cvKey: 'li' },
    { patterns: /portfolio|github|website/i, cvKey: 'po' },
    { patterns: /degree|qualification/i, cvKey: 'dg' },
    { patterns: /school|university|college/i, cvKey: 'sc' },
    { patterns: /grad.?year|graduation/i, cvKey: 'gy' },
    { patterns: /job.?title|current.?title|position/i, cvKey: 'ti' },
    { patterns: /company|employer|organization/i, cvKey: 'cp' },
    { patterns: /summary|bio|about|description/i, cvKey: 'su' },
    { patterns: /\bgender\b|\bsex\b/i, cvKey: 'gn' },
    { patterns: /\bage\b/i, cvKey: 'age' },
    { patterns: /occupation|industry/i, cvKey: 'oc' },
]

const SKIP_TYPES = new Set(['file', 'submit', 'button', 'hidden', 'reset', 'image'])
const ALWAYS_SEND_TO_AI_TYPES = new Set(['select-one', 'radio', 'checkbox'])

/** Try to match a field via pattern, return value if found */
function tryPatternMatch(field: RawDetectedField, cv: CVSnapshot): string | null {
    if (field.tagName === 'BUTTON') return null
    if (SKIP_TYPES.has(field.type?.toLowerCase())) return null

    const fieldType = String(field.type || '').toLowerCase()
    // Don't pattern-match selects/checkboxes — need AI for option matching
    if (ALWAYS_SEND_TO_AI_TYPES.has(fieldType)) return null

    const haystack = [field.label, field.id, field.name, field.placeholder].join(' ')

    for (const { patterns, cvKey } of PATTERN_MAP) {
        if (patterns.test(haystack)) {
            const val = cv[cvKey]
            if (!val) return null

            // Special case: full name field combines first + last
            if (/^(full.?name|name)$/i.test(haystack) && cvKey === 'fn' && cv.ln) {
                return `${val} ${cv.ln}`
            }
            return val
        }
    }
    return null
}

/**
 * Check if a field has enough information for AI to map it
 * Returns false for fields that would just waste tokens
 *
 * Relaxed criteria: Send almost everything to AI except completely empty fields
 */
function hasEnoughContextForAI(field: RawDetectedField): boolean {
    const fieldType = String(field.type || '').toLowerCase()

    // Always allow select/radio/checkbox to go to AI
    if (ALWAYS_SEND_TO_AI_TYPES.has(fieldType)) return true

    // For text inputs, be more permissive - send if we have ANY identifier
    const hasLabel = Boolean(field.label && field.label.trim().length > 0)
    const hasPlaceholder = Boolean(field.placeholder && field.placeholder.trim().length > 0)
    const hasId = Boolean(field.id && field.id.trim().length > 0)
    const hasName = Boolean(field.name && field.name.trim().length > 0)

    // Need at least ONE identifier (even short ones like "fn", "ln", etc.)
    return hasLabel || hasPlaceholder || hasId || hasName
}

// ─────────────────────────────────────────────
// Layer 2: Extract select options from DOM
// ─────────────────────────────────────────────

/** Read actual <option> texts from a <select> element in the DOM */
function getSelectOptions(fieldId: string, fieldName: string): string[] {
    let el: HTMLSelectElement | null = null
    if (fieldId) el = document.getElementById(fieldId) as HTMLSelectElement
    if (!el && fieldName) el = document.querySelector(`select[name="${fieldName}"]`) as HTMLSelectElement
    if (!el) return []

    return Array.from(el.options)
        .filter(o => o.value !== '' && o.text.trim() !== '')
        .map(o => o.text.trim())
        .slice(0, 8) // max 8 options to keep tokens low
}

// ─────────────────────────────────────────────
// Build CV Snapshot
// ─────────────────────────────────────────────

export function buildCVSnapshot(cv: any): CVSnapshot {
    const p = cv?.personal || {}
    const pr = cv?.professional || {}
    const edu = (cv?.education || [])[0] || {}
    const snap: CVSnapshot = {}

    if (p.firstName) snap.fn = p.firstName
    if (p.lastName) snap.ln = p.lastName
    if (p.email) snap.em = p.email

    // Phone — use libphonenumber-js for accurate country detection
    if (p.phone) {
        const raw = String(p.phone).trim()
        snap.ph = raw

        // Try to parse with libphonenumber-js for accurate country/area code detection
        const parsed = parsePhone(raw, 'BD') // Default to BD for local numbers

        if (parsed.isValid && parsed.countryCode) {
            // Successfully parsed - use accurate data
            snap.ac = parsed.countryCode // +880 for BD, +1 for US/CA, etc.
            snap.ph = parsed.nationalNumber // Number without country code
        } else {
            // Fallback to simple regex for unparsable numbers
            const spaceMatch = raw.match(/^(\+\d{1,4})[\s-]+(\d.*)$/)
            if (spaceMatch) {
                snap.ac = spaceMatch[1]
                snap.ph = spaceMatch[2].replace(/[\s-]/g, '')
            } else {
                const fallbackMatch = raw.match(/^(\+\d{1,3})(\d{9,12})$/)
                if (fallbackMatch) {
                    snap.ac = fallbackMatch[1]
                    snap.ph = fallbackMatch[2]
                }
            }
        }
    }

    if (p.gender) snap.gn = p.gender
    if (p.address) snap.ad = p.address
    if (p.city) snap.cy = p.city
    if (p.state) snap.st = p.state
    if (p.zipCode) snap.zp = p.zipCode
    if (p.country) snap.co = p.country
    if (p.linkedIn) snap.li = p.linkedIn
    if (p.portfolio) snap.po = p.portfolio

    if (pr.currentTitle) { snap.ti = pr.currentTitle; snap.oc = pr.currentTitle }
    if (pr.company) snap.cp = pr.company
    if (pr.summary) snap.su = pr.summary?.slice(0, 200) // trim long summaries

    if (edu.degree) snap.dg = edu.degree
    if (edu.school) snap.sc = edu.school
    if (edu.graduationYear) {
        snap.gy = String(edu.graduationYear)
        const g = parseInt(edu.graduationYear)
        if (!isNaN(g)) snap.age = String(new Date().getFullYear() - g + 22)
    }

    return snap
}

// ─────────────────────────────────────────────
// Build AI prompt for a batch of fields
// ─────────────────────────────────────────────

function buildBatchPrompt(fields: CompactField[], cv: CVSnapshot): string {
    return `MANDATORY: Fill EVERY field listed below. Return an ARRAY with ALL fields.

CV:
${JSON.stringify(cv)}

Fields to fill (i=id, t=type, l=label, p=placeholder, o=options):
${JSON.stringify(fields)}

RULES - Follow exactly:
1. Return ALL fields in an array, never a single object
2. For each field, use the exact "i" value from above
3. Simple mappings:
   - First/Last/Given name → firstName/lastName from CV
   - Email fields → email from CV
   - Phone/Mobile/Tel → phone from CV
   - Address/Street/Addr → address from CV (USE REAL DATA, NEVER FAKE)
   - City → city, State → state, Zip/Postal → zipCode, Country → country
   - Company → company, Job/Position/Title → jobTitle
   - School → school, Degree → degree
4. For SELECT/RADIO: Pick the closest option from o[] array
5. For textareas: Fill with summary or jobTitle
6. Cover Letter Fields (label/placeholder contains "cover letter" or "coverletter"):
   - Write a PROFESSIONAL cover letter using CV data
   - CRITICAL: Use ACTUAL line breaks, NOT \n or \\n characters
   - Keep it 150-200 words, professional & confident tone
   - Use CV data: name (${cv.fn || 'Your Name'} ${cv.ln || ''}), email (${cv.em || ''}), phone (${cv.ph || ''})
   - Return as clean formatted text with real paragraph breaks
   - DO NOT use escape sequences like \n, \\n, or \r\n
   - Example structure (format as real paragraphs):
     Dear Hiring Manager,

     I'm excited to apply for the Full Stack Developer role. With expertise in JavaScript, TypeScript, and modern web technologies, I specialize in building scalable SaaS applications.

     Key Skills:
     - Full Stack: TypeScript, Next.js, Node.js
     - APIs: Fastify, Express.js, RESTful architecture
     - SaaS: Multi-tenant systems, authentication, CI/CD

     I'm ready to hit the ground running and deliver immediate value.

     Best regards,
     ${cv.fn || 'Your Name'} ${cv.ln || ''}
7. NO SKIPPING - Every field with a label/id/placeholder must be filled
8. ALWAYS use real CV data - NEVER make up fake addresses or fake data

Response format - MANDATORY ARRAY:
[
  {"i":"exact_id_1","v":"value1"},
  {"i":"exact_id_2","v":"value2"},
  {"i":"exact_id_3","v":"value3"}
]

WARNING: You MUST return an ARRAY with ALL fields. Do NOT return a single object. Do NOT skip fields.`
}

function buildFallbackPrompt(fields: CompactField[], cv: CVSnapshot): string {
    return `CRITICAL: These fields were NOT filled. Fill them ALL now using the CV.

CV:
${JSON.stringify(cv)}

Remaining fields (i=id, t=type, l=label, p=placeholder):
${JSON.stringify(fields)}

AGGRESSIVE MAPPING - Fill EVERYTHING:
1. Name fields → use firstName or lastName or fullName
2. Email → use email
3. Phone/Mobile/Tel → use phone
4. Address/Street/Location → use address (NEVER FAKE - use real CV data)
5. City/Town → use city
6. State/Region/Province → use state
7. Zip/Postal → use zipCode
8. Country → use country
9. Company/Employer/Organization → use company
10. Job/Position/Role/Title → use jobTitle
11. School/University/College → use school
12. Degree/Education → use degree
13. Cover Letter fields → Generate professional cover letter:
   CRITICAL: Use REAL line breaks, NOT \n or escape sequences
   "Dear Hiring Manager,

   I'm excited to apply for the Full Stack Developer role. With expertise in JavaScript, TypeScript, and modern web technologies, I specialize in building scalable SaaS applications.

   Key Skills:
   - Full Stack: TypeScript, Next.js, Node.js
   - APIs: Fastify, Express.js, RESTful architecture
   - SaaS: Multi-tenant systems, authentication, CI/CD

   I'm ready to hit the ground running and deliver immediate value.

   Best regards,
   ${cv.fn || 'Your Name'} ${cv.ln || ''}"

For SELECT fields: Pick ANY reasonable option that matches
For TEXT fields: Fill with closest CV data
For TEXTAREA: Fill with summary or jobTitle

MANDATORY: Return an ARRAY with ALL fields:
[
  {"i":"id1","v":"val1"},
  {"i":"id2","v":"val2"}
]

DO NOT SKIP. Fill ALL fields now.`
}

// ─────────────────────────────────────────────
// Extract radio groups from DOM
// ─────────────────────────────────────────────

interface RadioGroupInfo {
    name: string
    label: string
    options: string[]
}

function extractRadioGroupsFromDOM(): RadioGroupInfo[] {
    if (typeof document === 'undefined') return []
    const radios = Array.from(document.querySelectorAll('input[type="radio"]')) as HTMLInputElement[]
    const groups = new Map<string, RadioGroupInfo>()

    for (const radio of radios) {
        const gName = radio.name || radio.id
        if (!gName) continue

        let optLabel = radio.value
        const labelEl = document.querySelector(`label[for="${radio.id}"]`) || radio.closest('label')
        if (labelEl?.textContent?.trim()) optLabel = labelEl.textContent.trim()

        if (!groups.has(gName)) {
            let groupLabel = gName
            const legend = radio.closest('fieldset')?.querySelector('legend')
            if (legend?.textContent?.trim()) groupLabel = legend.textContent.trim()
            groups.set(gName, { name: gName, label: groupLabel, options: [] })
        }

        const g = groups.get(gName)!
        if (!g.options.includes(optLabel)) g.options.push(optLabel)
    }

    return Array.from(groups.values()).filter(g => g.options.length > 0)
}

// ─────────────────────────────────────────────
// Parse AI response safely
// ─────────────────────────────────────────────

function parseAIResponse(response: any, rawFields: RawDetectedField[]): Array<{ i: string; v: string }> {
    try {
        let parsed: any[] = []

        if (typeof response === 'string') {
            // Try multiple extraction patterns
            // Pattern 1: JSON array
            const arrayMatch = response.match(/\[[\s\S]*\]/)
            if (arrayMatch) {
                try {
                    parsed = JSON.parse(arrayMatch[0])
                } catch (e) {
                    console.warn('[Mapper] Failed to parse JSON array:', e)
                }
            }

            // Pattern 2: Single object - convert to array
            if (parsed.length === 0) {
                const objectMatch = response.match(/\{[\s\S]*\}/)
                if (objectMatch) {
                    try {
                        const obj = JSON.parse(objectMatch[0])
                        if (obj.i && obj.v !== undefined) {
                            parsed = [obj]
                            console.log('[Mapper] Converted single object to array')
                        }
                    } catch (e) {
                        console.warn('[Mapper] Failed to parse JSON object:', e)
                    }
                }
            }

            if (parsed.length === 0) {
                console.warn('[Mapper] No valid JSON found in AI response')
                return []
            }
        } else if (Array.isArray(response)) {
            parsed = response
        } else if (response?.data && Array.isArray(response.data)) {
            parsed = response.data
        } else if (typeof response === 'object' && response?.i) {
            // Single object response
            parsed = [response]
        }

        // Filter out invalid entries
        const valid = parsed.filter((m: any) => m?.i && m?.v !== undefined && m?.v !== null && m?.v !== '')

        if (valid.length === 0) {
            console.warn('[Mapper] AI returned no valid mappings')
        } else if (valid.length < parsed.length) {
            console.log(`[Mapper] Filtered ${parsed.length - valid.length} invalid entries from AI response`)
        }

        return valid
    } catch (err) {
        console.error('[Mapper] parseAIResponse failed to parse AI JSON:', response, err)
        return []
    }
}

// ─────────────────────────────────────────────
// Main exported function
// ─────────────────────────────────────────────

const BATCH_SIZE = 10 // max fields per AI call (rate limit safe)
const BATCH_DELAY_MS = 500 // wait between batches

/**
 * Optimized field mapper:
 * 1. Pattern match known fields instantly (free)
 * 2. Send only unknown/ambiguous fields to AI in batches of 10
 * 3. Include select options in the prompt
 * 4. Force-fill remaining fields with fallback AI call
 */
export async function optimizedBatchMap(
    rawFields: RawDetectedField[],
    cvData: any,
    getAIResponse: (prompt: string) => Promise<any>
): Promise<FieldMapping[]> {

    const cv = buildCVSnapshot(cvData)
    const results: FieldMapping[] = []
    const needsAI: RawDetectedField[] = []
    const skippedFields: Array<{ field: RawDetectedField; reason: string }> = []

    // ── Layer 1: Pattern match (free) ──────────
    for (const field of rawFields) {
        if (field.tagName === 'BUTTON') continue
        if (SKIP_TYPES.has(field.type?.toLowerCase())) continue

        const value = tryPatternMatch(field, cv)
        if (value) {
            results.push({
                id: field.id || field.name,
                name: field.name || field.id,
                value,
                source: 'pattern'
            })
        } else if (hasEnoughContextForAI(field)) {
            // Unknown field with enough context → needs AI
            needsAI.push(field)
        } else {
            // Track why we're skipping this field
            skippedFields.push({
                field,
                reason: `No label, placeholder, id, or name`
            })
        }
    }

    console.log(`[Mapper] Pattern matched: ${results.length}, Needs AI: ${needsAI.length}, Skipped: ${skippedFields.length}`)

    // Log skipped fields for debugging (only in development)
    if (skippedFields.length > 0 && process.env.NODE_ENV === 'development') {
        console.log('[Mapper] Skipped fields:', skippedFields.map(s => ({
            id: s.field.id || s.field.name,
            reason: s.reason
        })))
    }

    // ── Also scan radio groups from DOM ────────
    const radioGroups = extractRadioGroupsFromDOM()
    for (const rg of radioGroups) {
        // Skip if we already have a result for this name
        if (results.find(r => r.name === rg.name || r.id === rg.name)) continue
        needsAI.push({
            tagName: 'INPUT',
            type: 'radio',
            name: rg.name,
            id: rg.name,
            placeholder: rg.label,
            options: rg.options,
            isRadioGroup: true,
            label: rg.label,
        } as RawDetectedField)
    }

    if (needsAI.length === 0) return results

    // ── Layer 2: AI batches ────────────────────
    const batches: RawDetectedField[][] = []
    for (let i = 0; i < needsAI.length; i += BATCH_SIZE) {
        batches.push(needsAI.slice(i, i + BATCH_SIZE))
    }

    console.log(`[Mapper] AI batches: ${batches.length} (${BATCH_SIZE} fields each)`)

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx]

        // Build compact fields with select/radio options from DOM
        const compactFields: CompactField[] = batch.map(f => {
            const identifier = f.id || f.name
            const field: CompactField = {
                i: identifier,
                t: f.isRadioGroup ? 'radio' : (f.type === 'select-one' ? 'select' : (f.type || f.tagName.toLowerCase())),
            }
            if (f.placeholder) field.p = f.placeholder
            if (f.label) field.l = f.label

            // Include options for select fields (from DOM)
            if (f.type === 'select-one') {
                const options = getSelectOptions(f.id, f.name)
                if (options.length > 0) field.o = options
            }

            // Include options for radio groups (already extracted)
            if (f.isRadioGroup && f.options && f.options.length > 0) {
                field.o = f.options
            }

            return field
        })

        const prompt = buildBatchPrompt(compactFields, cv)
        console.log(`[Mapper] Batch ${batchIdx + 1}/${batches.length}: ${batch.length} fields, ~${Math.ceil(prompt.length / 4)} tokens`)
        console.log(`[Mapper] Batch ${batchIdx + 1} fields:`, compactFields.map(f => ({ i: f.i, t: f.t, l: f.l })))

        try {
            const response = await getAIResponse(prompt)
            console.log(`[Mapper] Batch ${batchIdx + 1} AI raw response:`, response)
            const mapped = parseAIResponse(response, rawFields)

            for (const m of mapped) {
                // Try exact ID match first
                let original = rawFields.find(f => f.id === m.i || f.name === m.i)

                // Fallback: Try fuzzy matching by label/placeholder
                if (!original) {
                    original = rawFields.find(f => {
                        const targetId = String(m.i).toLowerCase()
                        const fieldLabel = String(f.label || '').toLowerCase()
                        const fieldName = String(f.name || '').toLowerCase()
                        const fieldId = String(f.id || '').toLowerCase()
                        const fieldPlaceholder = String(f.placeholder || '').toLowerCase()

                        // Check if AI response ID is contained in any field identifier
                        return fieldLabel.includes(targetId) ||
                               fieldName.includes(targetId) ||
                               fieldId.includes(targetId) ||
                               fieldPlaceholder.includes(targetId)
                    })
                }

                if (original) {
                    results.push({
                        id: original.id,
                        name: original.name,
                        value: String(m.v),
                        source: 'ai'
                    })
                } else {
                    console.warn(`[Mapper] Could not find field for AI response: ${m.i}`)
                }
            }

            console.log(`[Mapper] Batch ${batchIdx + 1} mapped: ${mapped.length} fields`)
        } catch (err) {
            console.error(`[Mapper] Batch ${batchIdx + 1} failed:`, err)
        }

        // Rate limit delay between batches (skip after last batch)
        if (batchIdx < batches.length - 1) {
            await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
        }
    }

    // ── Layer 3: Fallback - Force-fill remaining fields ─────
    const filledIdsSet = new Set(results.map(r => r.id || r.name))
    const unfilledFields = needsAI.filter(f => {
        const id = f.id || f.name
        return !filledIdsSet.has(id)
    })

    if (unfilledFields.length > 0) {
        console.log(`[Mapper] ⚠ ${unfilledFields.length} fields remain unfilled after AI pass. Forcing retry...`)

        // Build compact fields for unfilled fields
        const fallbackCompactFields: CompactField[] = unfilledFields.map(f => {
            const identifier = f.id || f.name
            const field: CompactField = {
                i: identifier,
                t: f.isRadioGroup ? 'radio' : (f.type === 'select-one' ? 'select' : (f.type || f.tagName.toLowerCase())),
            }
            if (f.placeholder) field.p = f.placeholder
            if (f.label) field.l = f.label

            if (f.type === 'select-one') {
                const options = getSelectOptions(f.id, f.name)
                if (options.length > 0) field.o = options
            }
            if (f.isRadioGroup && f.options && f.options.length > 0) {
                field.o = f.options
            }

            return field
        })

        // Aggressive fallback prompt
        const fallbackPrompt = buildFallbackPrompt(fallbackCompactFields, cv)
        console.log(`[Mapper] Fallback: Sending ${unfilledFields.length} unfilled fields with aggressive prompt`)

        try {
            const fallbackResponse = await getAIResponse(fallbackPrompt)
            console.log(`[Mapper] Fallback AI response:`, fallbackResponse)
            const fallbackMapped = parseAIResponse(fallbackResponse, rawFields)

            for (const m of fallbackMapped) {
                let original = rawFields.find(f => f.id === m.i || f.name === m.i)

                if (!original) {
                    original = rawFields.find(f => {
                        const targetId = String(m.i).toLowerCase()
                        const fieldLabel = String(f.label || '').toLowerCase()
                        const fieldName = String(f.name || '').toLowerCase()
                        const fieldId = String(f.id || '').toLowerCase()
                        const fieldPlaceholder = String(f.placeholder || '').toLowerCase()

                        return fieldLabel.includes(targetId) ||
                               fieldName.includes(targetId) ||
                               fieldId.includes(targetId) ||
                               fieldPlaceholder.includes(targetId)
                    })
                }

                if (original) {
                    results.push({
                        id: original.id,
                        name: original.name,
                        value: String(m.v),
                        source: 'ai'
                    })
                }
            }

            console.log(`[Mapper] Fallback filled ${fallbackMapped.length} more fields`)
        } catch (err) {
            console.error(`[Mapper] Fallback failed:`, err)
        }
    }

    console.log(`[Mapper] ✓ Total mapped: ${results.length} (pattern: ${results.filter(r => r.source === 'pattern').length}, ai: ${results.filter(r => r.source === 'ai').length})`)

    // Debug: Show which fields were detected but not filled
    const filledIds = new Set(results.map(r => r.id || r.name))
    const unfilled = rawFields.filter(f => {
        const id = f.id || f.name
        return !filledIds.has(id)
    })

    if (unfilled.length > 0) {
        console.log(`[Mapper] ⚠ ${unfilled.length} fields detected but not filled:`, unfilled.map(f => ({
            id: f.id || f.name,
            label: f.label || f.placeholder || 'none',
            type: f.type
        })))
    }

    return results
}

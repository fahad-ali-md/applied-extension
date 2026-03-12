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
 * Layer 3 — Merge results
 *   Combine pattern matches + AI mappings → fill all at once
 */

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
}

interface CompactField {
    i: string    // identifier
    t: string    // type
    p?: string   // placeholder
    o?: string[] // options (for select only — max 8)
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
    { patterns: /^(full.?name|name|applicant.?name)$/i, cvKey: 'fn' }, // will concat ln
    { patterns: /email/i, cvKey: 'em' },
    { patterns: /area.?code|country.?code/i, cvKey: 'ac' },
    { patterns: /^phone$|^tel$|^mobile$|phone.?num/i, cvKey: 'ph' },
    { patterns: /^address$|street.?addr|addr.?line.?1/i, cvKey: 'ad' },
    { patterns: /address.?2|addr.?line.?2|apt|suite/i, cvKey: 'ad2' },
    { patterns: /^city$|^town$/i, cvKey: 'cy' },
    { patterns: /^state$|^province$|^region$/i, cvKey: 'st' },
    { patterns: /zip|postal/i, cvKey: 'zp' },
    { patterns: /^country$/i, cvKey: 'co' },
    { patterns: /linkedin/i, cvKey: 'li' },
    { patterns: /portfolio|github|website/i, cvKey: 'po' },
    { patterns: /degree|qualification/i, cvKey: 'dg' },
    { patterns: /school|university|college/i, cvKey: 'sc' },
    { patterns: /grad.?year|graduation/i, cvKey: 'gy' },
    { patterns: /job.?title|current.?title|position/i, cvKey: 'ti' },
    { patterns: /company|employer|organization/i, cvKey: 'cp' },
    { patterns: /summary|bio|about|description/i, cvKey: 'su' },
    { patterns: /^gender$/i, cvKey: 'gn' },
    { patterns: /^age$/i, cvKey: 'age' },
    { patterns: /occupation|industry/i, cvKey: 'oc' },
]

const SKIP_TYPES = new Set(['file', 'submit', 'button', 'hidden', 'reset', 'image'])

/** Try to match a field via pattern, return value if found */
function tryPatternMatch(field: RawDetectedField, cv: CVSnapshot): string | null {
    if (field.tagName === 'BUTTON') return null
    if (SKIP_TYPES.has(field.type?.toLowerCase())) return null
    // Don't pattern-match selects — need options list
    if (field.type === 'select-one') return null

    const haystack = [field.id, field.name, field.placeholder].join(' ')

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

    // Phone — smart area code splitting
    if (p.phone) {
        const raw = String(p.phone).trim()
        snap.ph = raw
        // +880XXXXXXXXXX → ac=+880, ph=XXXXXXXXXX
        const m = raw.match(/^(\+\d{1,4})\s*(\d+)$/)
        if (m) { snap.ac = m[1]; snap.ph = m[2] }
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
    return `Autofill form. Map CV→fields. Return JSON only.

CV: ${JSON.stringify(cv)}

Fields (i=id,t=type,p=placeholder,o=options):
${JSON.stringify(fields)}

Rules:
- areacode/area_code field → use ac
- phone field → use ph (full number)
- select field → pick EXACT text from o[] array that best matches CV
- radio field → pick EXACT value from o[] array that best matches CV (e.g. gender radio → pick "male" or "female")
- checkbox field → "true" if CV suggests it applies, else skip
- gender select/radio → match gn to closest option
- occupation select → match oc/ti to closest option text
- date type → YYYY-MM-DD
- age field → use age value
- message/textarea with no CV mapping → skip
- file/submit/button → skip
- Only include fields with confident match

Return: [{"i":"id","v":"value"},...]`
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
            const match = response.match(/\[[\s\S]*\]/)
            if (match) parsed = JSON.parse(match[0])
        } else if (Array.isArray(response)) {
            parsed = response
        }
        return parsed.filter((m: any) => m?.i && m?.v !== undefined && m?.v !== null && m?.v !== '')
    } catch {
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
 */
export async function optimizedBatchMap(
    rawFields: RawDetectedField[],
    cvData: any,
    getAIResponse: (prompt: string) => Promise<any>
): Promise<FieldMapping[]> {

    const cv = buildCVSnapshot(cvData)
    const results: FieldMapping[] = []
    const needsAI: RawDetectedField[] = []

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
        } else if (field.type !== 'file') {
            // Unknown field or select → needs AI
            needsAI.push(field)
        }
    }

    console.log(`[Mapper] Pattern matched: ${results.length}, Needs AI: ${needsAI.length}`)

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
        })
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

        try {
            const response = await getAIResponse(prompt)
            const mapped = parseAIResponse(response, rawFields)

            for (const m of mapped) {
                const original = rawFields.find(f => f.id === m.i || f.name === m.i)
                results.push({
                    id: original?.id || m.i,
                    name: original?.name || m.i,
                    value: String(m.v),
                    source: 'ai'
                })
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

    console.log(`[Mapper] ✓ Total mapped: ${results.length} (pattern: ${results.filter(r => r.source === 'pattern').length}, ai: ${results.filter(r => r.source === 'ai').length})`)
    return results
}

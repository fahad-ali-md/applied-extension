# AI-Powered CV Customization - Implementation Plan

## 🎯 Overview

Users can paste a **Job Description**, and AI automatically customizes their CV to match that specific job's requirements.

---

## 📋 Feature Requirements

### Input
- **Job Description**: Text area or URL to paste job posting
- **Current CV Data**: User's existing CV from storage

### Output
- **Customized CV**: Content-enhanced CV with chronological order maintained
- **Changes Summary**: Show what AI changed and why
- **Multiple Versions**: Save different CVs for different jobs

---

## 🏗️ Architecture

```
┌─────────────────┐
│  User Input     │
│  Job Description│
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  AI Analysis Engine                 │
│  - Extract skills required          │
│  - Identify experience level needed │
│  - Find keywords                    │
│  - Detect company culture/values    │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  CV Customization Strategy          │
│  ✅ RULE: Keep date order (always!) │
│  1. Emphasize relevant experience    │
│     (visual highlighting, not reorder)│
│  2. Highlight matching skills       │
│  3. Rewrite descriptions for job   │
│  4. Add job-specific keywords       │
│  5. Rewrite summary to match job    │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Customized CV Data                 │
│  - New order of items               │
│  - Rewritten sections               │
│  - Highlighted skills               │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Preview & Export                   │
│  - Show side-by-side comparison     │
│  - Allow manual adjustments         │
│  - Generate PDF                     │
└─────────────────────────────────────┘
```

---

## 🔧 Technical Implementation

### Phase 1: Job Description Analysis

**File**: `src/utils/jobAnalyzer.ts`

```typescript
export interface JobAnalysis {
  requiredSkills: string[]
  preferredSkills: string[]
  experienceLevel: 'entry' | 'mid' | 'senior' | 'lead'
  keyResponsibilities: string[]
  companyValues: string[]
  keywords: string[]
  suggestedSummary: string
}

export async function analyzeJobDescription(
  jobDescription: string,
  aiProvider: 'claude' | 'openai' = 'claude'
): Promise<JobAnalysis>
```

**What it does:**
- Extracts required/preferred skills from job posting
- Identifies experience level needed
- Finds key responsibilities
- Detects company culture/values
- Generates a list of important keywords

---

### Phase 2: CV Customization Engine

**File**: `src/utils/cvCustomizer.ts`

```typescript
export interface CustomizationOptions {
  targetJob: JobAnalysis
  currentCV: CVData
  customizationLevel: 'conservative' | 'moderate' | 'aggressive'
}

export interface CustomizedCV {
  originalCV: CVData
  customizedCV: CVData
  changes: CVChange[]
  summary: string
}

export async function customizeCVForJob(
  options: CustomizationOptions
): Promise<CustomizedCV>
```

**Customization Strategies:**

1. **Experience Enhancement (NOT Reordering)**
   ```typescript
   // ⚠️ IMPORTANT: Keep chronological date order!
   // DO NOT change sequence - always newest first
   // ✓ DO: Add visual emphasis to relevant items
   // ✓ DO: Bold matching technologies
   // ✓ DO: Add job-specific context to descriptions
   // ✗ DON'T: Reorder by relevance (looks dishonest!)
   ```

2. **Skill Prioritization**
   ```typescript
   // Matching skills → appear first & bolded
   // Related skills → appear in middle
   // Unrelated skills → appear last or removed
   ```

3. **Summary Rewriting**
   ```typescript
   // Incorporate job keywords
   // Highlight relevant experience
   // Match company tone/voice
   ```

4. **Project Description Enhancement**
   ```typescript
   // Add job-specific context
   // Emphasize relevant achievements
   // Use job posting language
   ```

---

### Phase 3: UI Components

#### 3.1 Job Description Input

**File**: `src/popup/components/JobInput/JobInput.tsx`

```tsx
export function JobInput() {
  return (
    <div className="job-input">
      <textarea
        placeholder="Paste job description here..."
        onChange={handleJobInput}
      />
      <button onClick={analyzeJob}>
        🤖 Analyze & Customize CV
      </button>
    </div>
  )
}
```

#### 3.2 Customization Preview

**File**: `src/popup/components/CVPreview/CVPreview.tsx`

```tsx
export function CVComparison({ original, customized }) {
  return (
    <div className="cv-comparison">
      <div className="cv-original">
        <h3>Original CV</h3>
        <CVPreview data={original} />
      </div>

      <div className="cv-customized">
        <h3>Customized for Job</h3>
        <CVPreview data={customized} />
      </div>

      <div className="changes-summary">
        <h3>🤖 AI Changes</h3>
        <ChangeList changes={changes} />
      </div>
    </div>
  )
}
```

---

## 🤖 AI Integration Options

### Option 1: Claude API (Recommended)

**Pros:**
- Best at understanding context
- Great at natural language rewriting
- More nuanced customization

**Implementation:**
```typescript
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: userSettings.claudeApiKey
})

async function customizeWithClaude(job, cv) {
  const prompt = `
    Job Description:
    ${job.description}

    Current CV:
    ${JSON.stringify(cv)}

    Customize this CV for the job above.
    Return JSON with:
    - reordered experience
    - rewritten summary
    - prioritized skills
    - highlighted projects
  `

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }]
  })

  return JSON.parse(response.content[0].text)
}
```

### Option 2: OpenAI GPT-4

**Pros:**
- Faster
- Cheaper
- Good at keyword matching

**Implementation:**
```typescript
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: userSettings.openaiApiKey })

async function customizeWithGPT(job, cv) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{
      role: 'user',
      content: `Customize CV for job: ${JSON.stringify({ job, cv })}`
    }],
    response_format: { type: 'json_object' }
  })

  return JSON.parse(response.choices[0].message.content)
}
```

---

## 📊 Data Flow

```
1. User inputs job description
   ↓
2. AI analyzes job (skills, level, keywords)
   ↓
3. AI scores each CV item for relevance:
   - Experience entries: 0-100 score (for emphasis only!)
   - Projects: 0-100 score (for emphasis only!)
   - Skills: match/no-match
   ↓
4. CV content enhanced (order maintained):
   - Keep date order (newest first) ✅
   - Add visual emphasis to high-scoring items
   - Rewrite descriptions to include job keywords
   - Prioritize skills (matching ones first)
   - Rewrite summary
   ↓
5. User reviews & approves
   ↓
6. Generate customized PDF
```

---

## 🎯 Example Transformation

### Input Job Description:
```
Senior React Developer at TechCorp
Requirements:
- 5+ years React experience
- TypeScript, Next.js, Node.js
- Experience with e-commerce
- Team leadership experience
```

### Original CV:
```
Experience:
1. Full Stack Developer - Pirhotech (Jul 2022 - Sep 2025)
   • Built SaaS applications
   • Tech Stack: JavaScript, React, Node.js
2. Member - NASA Space Apps (Sep 2024)
   • Built educational prototype
3. Open Source Contributor - Devsonket (Mar 2023)

Skills:
JavaScript, Python, React, Node.js, Docker
```

### Customized CV (Date Order KEPT, Content Enhanced):
```
Experience:
1. Full Stack Developer - SolveTech Solution (Sep 2025 - Present) ⭐
   • Developed PropDNA.ai using React, Next.js ← Matching tech BOLDED
   • AI slide generation using LLMs ← Kept relevant

2. Full Stack Developer - Pirhotech (Jul 2022 - Sep 2025) ⭐
   • Built e-commerce platforms handling 700+ users ← HIGHLIGHTED (matches job!)
   • Tech Stack: React, TypeScript, Next.js, PostgreSQL ← BOLDED matching skills
   • SaaS and e-commerce focus ← Emphasized

3. Member - NASA Space Apps (Sep 2024)
   • Built educational prototype ← Less emphasis

Skills:
React ⭐, TypeScript ⭐, Next.js ⭐, Node.js, PostgreSQL, Docker, Python
   ↑ Matching skills starred & prioritized (order changed, but experience NOT reordered)
```

---

## 📁 File Structure

```
src/
├── utils/
│   ├── jobAnalyzer.ts           # Job description analysis
│   ├── cvCustomizer.ts           # CV customization logic
│   ├── cvScorer.ts              # Score CV items for relevance
│   └── aiProviders/
│       ├── claudeProvider.ts     # Claude API integration
│       └── openaiProvider.ts     # OpenAI API integration
├── popup/components/
│   ├── JobInput/                 # Job description input UI
│   ├── CVComparison/             # Side-by-side preview
│   └── ChangeSummary/            # List of AI changes
└── types/
    └── customization.ts          # TypeScript interfaces
```

---

## 🔐 API Key Storage

Store user's API keys securely:
```typescript
// chrome.storage.local
{
  aiSettings: {
    provider: 'claude' | 'openai',
    claudeApiKey: 'sk-ant-...',
    openaiApiKey: 'sk-...'
  }
}
```

---

## 🚀 Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create job analyzer
- [ ] Create CV scorer
- [ ] Basic UI for job input

### Phase 2: AI Integration (Week 2)
- [ ] Integrate Claude API
- [ ] Implement customization logic
- [ ] Test with sample job descriptions

### Phase 3: UI & UX (Week 3)
- [ ] Side-by-side comparison
- [ ] Change summary display
- [ ] Edit & approve workflow

### Phase 4: Polish (Week 4)
- [ ] Save multiple versions
- [ ] Version comparison
- [ ] Export to PDF

---

## 💰 Estimated Costs

| API | Cost per customization | Monthly (50 uses) |
|-----|---------------------|-------------------|
| Claude Sonnet | $0.015 | $0.75 |
| GPT-4 | $0.03 | $1.50 |
| GPT-3.5 Turbo | $0.002 | $0.10 |

---

## 🎨 UI Mockup

```
┌─────────────────────────────────────────┐
│  AI Job Customizer                      │
├─────────────────────────────────────────┤
│                                         │
│  📝 Job Description                     │
│  ┌───────────────────────────────────┐  │
│  │ Paste job posting here...         │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│  [🤖 Analyze & Customize]               │
│                                         │
│  📊 Analysis Results:                   │
│  • Required Skills: React, TypeScript   │
│  • Experience Level: Senior             │
│  • Keywords: e-commerce, leadership     │
│                                         │
│  🔄 Compare CVs:                        │
│  ┌──────────────┬──────────────┐       │
│  │ Original     │ Customized   │       │
│  │              │              │       │
│  │ Experience:  │ Experience:  │       │
│  │ 1. Pirhotech │ 1. Pirhotech│       │
│  │ 2. NASA      │ 2. NASA     │       │
│  │ 3. Devsonket │              │       │
│  │              │              │       │
│  └──────────────┴──────────────┘       │
│                                         │
│  ✅ [Approve] [Edit] [Download PDF]     │
└─────────────────────────────────────────┘
```

---

## 📝 Next Steps

1. **Choose AI Provider**: Claude (recommended) or OpenAI
2. **Create Job Analyzer**: Extract requirements from job postings
3. **Create CV Scorer**: Score CV items by relevance
4. **Build Customization Engine**: Reorder and rewrite CV
5. **Design UI**: Job input and comparison view
6. **Test**: Try with real job descriptions
7. **Deploy**: Ship the feature!

---

**Ready to start implementing? Which phase should we tackle first?**
# Applied Chrome Extension

You are an expert assistant for the **Applied** Chrome extension project - an AI-powered CV/Resume management and job application optimization tool.

## Project Overview

**Applied** is a Chrome extension built with React, TypeScript, and Vite (Manifest V3) that helps users:
- Parse and analyze CV/Resume from PDF files
- Manage profile information, skills, and work experience
- Optimize resumes for job applications
- Access dashboard via side panel, popup, and options page

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **State Management**: Zustand
- **PDF Processing**: pdfjs-dist
- **Validation**: Zod
- **Chrome Extension**: Manifest V3

## Project Structure

```
applied/
├── src/
│   ├── background/          # Service worker
│   ├── contentScript/       # Web page interaction & form filling
│   ├── contexts/            # DashboardContext.tsx
│   ├── devtools/            # DevTools integration
│   ├── newtab/              # Custom new tab
│   ├── options/             # Options.tsx (CV management)
│   ├── popup/               # Popup interface
│   ├── sidepanel/           # Dashboard.tsx
│   ├── store/               # dashboardStore.ts (Zustand)
│   ├── utils/               # pdfExtractor.ts, formFieldExtractorV2.ts (active) | formFieldExtractor.ts (legacy)
│   └── manifest.ts          # Extension manifest
├── public/                  # Static assets
└── build/                   # Build output
```

## Key Features

### 1. CV Upload & Parsing
- Drag-and-drop PDF upload in `Options.tsx`
- Multi-stage progress: Uploading → Uploaded → Parsing → Processing → Complete
- PDF text extraction via `pdfExtractor.ts` using pdfjs-dist
- Data persistence in localStorage

### 2. Dashboard Components
- **Side Panel**: Main dashboard (`sidepanel/Dashboard.tsx`)
- **Options Page**: CV settings and management (`options/Options.tsx`)
- **Popup**: Quick access interface (`popup/Popup.tsx`)
- **Custom New Tab**: Branded new tab page

### 3. Smart Form Filling ⭐ (V2 AI-First Approach - Active)
- **Field Detection**: Automatically finds form fields by name, id, placeholder, label
- **AI-First Extraction (V2)**: Extracts ALL fields with full context - **NO HARDCODED PATTERNS**
  - 100% field coverage - no field is missed
  - Language-agnostic - works with any language
  - Zero maintenance - no pattern lists to update
  - AI does semantic matching intelligently
  - Bundle size: ~500 bytes (vs 3KB with patterns)
- **Legacy V1**: `formFieldExtractor.ts` (hardcoded patterns - NOT in use)
- **ATS Detection**: Identifies Greenhouse, Lever, Workday, Ashby, etc.
- **Multi-step Forms**: Handles sliding/multi-page job applications
- **Test Scan**: Popup feature to preview extracted fields before filling

**See [REFACTOR_HARDODED_FIELDS.md](REFACTOR_HARDODED_FIELDS.md)** for V1 vs V2 comparison

### 4. State Management
- Zustand store in `store/dashboardStore.ts`
- React Context in `contexts/DashboardContext.tsx`
- Storage keys: `parsedCV`, `selectedRole`, `cvVisibility`

## Important File Locations

| File | Purpose |
|------|---------|
| [src/manifest.ts](src/manifest.ts) | Chrome extension manifest configuration |
| [src/options/Options.tsx](src/options/Options.tsx) | Main CV management interface |
| [src/sidepanel/Dashboard.tsx](src/sidepanel/Dashboard.tsx) | Dashboard component |
| [src/utils/pdfExtractor.ts](src/utils/pdfExtractor.ts) | PDF text extraction utility |
| [src/utils/formFieldExtractorV2.ts](src/utils/formFieldExtractorV2.ts) | AI-first field extraction (active - no patterns) |
| [src/utils/formFieldExtractor.ts](src/utils/formFieldExtractor.ts) | Legacy pattern-based extraction (NOT in use) |
| [src/contentScript/index.ts](src/contentScript/index.ts) | Form filling engine & field detection |
| [src/store/dashboardStore.ts](src/store/dashboardStore.ts) | Zustand state management |
| [src/background/index.ts](src/background/index.ts) | Service worker |

## Common Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run fmt          # Format code with Prettier
npm run zip          # Create distribution zip
```

## Chrome Extension Loading

1. Run `npm run dev`
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select `build` folder

## Key Data Structures

### ParsedCV Interface
```typescript
interface ParsedCV {
  personal: {
    firstName, lastName, email, phone
    address?, city?, state?, zipCode?, country?
    linkedIn?, portfolio?
  }
  professional: {
    currentTitle, summary, yearsOfExperience
  }
  skills: {
    technical[], soft[], tools[], languages[]
  }
  experience: Experience[]
  projects: Project[]
  education: Education[]
  rawText: string
  parsedAt: number
}
```

### Dashboard Store
```typescript
interface DashboardStore {
  activeNav: 'cv' | 'api-keys' | 'preferences' | 'history'
  planUsage: { used: number; total: number }
  lastSync: Date | null
  setActiveNav, updatePlanUsage, updateSyncStatus
}
```

## Chrome Permissions

- `sidePanel` - Side panel access
- `storage` - Local storage
- `activeTab` - Current tab access
- `scripting` - Script injection
- Host permissions for all URLs

## Keyboard Shortcuts

- `Ctrl+Shift+D` / `Cmd+Shift+D` - Open Applied Dashboard

## Storage Keys

```typescript
const STORAGE_KEYS = {
  PARSED_CV: 'parsedCV',
  SELECTED_ROLE: 'selectedRole',
  CV_VISIBILITY: 'cvVisibility'
}
```

## AI Integration

The extension is ready for AI integration. To connect:
1. In `Options.tsx`, replace sample data with AI API call
2. Use `pdfExtractor.ts` for PDF text extraction
3. Process extracted text and create `ParsedCV` structure

### DOM → AI Context Optimization ⭐ (NEW - March 2026)

**Problem:** Job application forms can be 500KB+ DOM, too large for AI context

**Solution:** Smart field extraction reduces context from ~500KB to ~5KB (99% reduction!)

#### Key Strategy: CV-Driven Field Extraction

Located in [src/utils/formFieldExtractor.ts](src/utils/formFieldExtractor.ts):

```typescript
// Extract only relevant fields based on CV data
const extracted = extractRelevantFields(cvData)

// Output structure:
interface ExtractedFormContext {
  fields: ExtractedField[]      // Only matching fields
  totalFields: number
  highPriorityFields: number    // Ready to fill
  estimatedFillable: number
  metadata: {
    url: string
    pageTitle: string
    formType: string            // 'job-application', 'contact', etc.
    detectedATS: string[]       // ['Lever', 'Greenhouse', etc.]
  }
}
```

#### Supported Strategies:

1. **CV-Driven Extraction** - Only extract fields that match CV data
2. **Hierarchical Grouping** - Group fields by visual structure
3. **Progressive Processing** - Quick scan → Smart match → Targeted fill
4. **ATS-Specific Templates** - Known patterns for Greenhouse, Lever, Workday, Ashby
5. **Confidence-Based Filtering** - Only send high-confidence fields to AI
6. **Hybrid Approach** - Handle standard fields locally, use AI for complex ones

#### Form Filling Engine

Located in [src/contentScript/index.ts](src/contentScript/index.ts):

- **FieldDetector** - Finds fields by name, id, placeholder, aria-label
- **FormFiller** - Fills forms with proper event simulation
- **Multi-step Forms** - Handles sliding/multi-page forms
- **Dynamic Detection** - Observes form changes

#### Usage Example:

```typescript
// From sidepanel/background
chrome.tabs.sendMessage(tabId, {
  action: 'prepareFormForAI',
  cvData: parsedCV
}, (response) => {
  // response.context is only ~5KB instead of 500KB!
  const aiResponse = await callAIAPI(response.context)
})
```

#### ATS Detection:

Supports detection of:
- Greenhouse: `application_form[in][attributes]` pattern
- Lever: `data-qa` attributes
- Workday: `data-automation-id` or `wd-` prefixes
- Ashby: Clean IDs with `candidate_` prefix
- JazzHR, SmartRecruiters, BambooHR

See [RESEARCH_DOM_AI_MAPPING.md](RESEARCH_DOM_AI_MAPPING.md) for complete research.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| PDF not parsing | Check pdf.worker.min.mjs in public folder |
| Data not persisting | Check localStorage quota and permissions |
| Extension not loading | Verify build folder and Chrome version |

## Documentation Files

- [CV_UPLOAD_IMPLEMENTATION.md](CV_UPLOAD_IMPLEMENTATION.md) - CV upload details
- [MODEL_FETCHING_RESTORATION.md](MODEL_FETCHING_RESTORATION.md) - AI model fetching
- [NAVIGATION_FIX.md](NAVIGATION_FIX.md) - Navigation fixes
- [REAL_AI_PARSING_FIX.md](REAL_AI_PARSING_FIX.md) - AI parsing
- [RENDER_OPTIMIZATION_GUIDE.md](RENDER_OPTIMIZATION_GUIDE.md) - Performance
- [RESEARCH_DOM_AI_MAPPING.md](RESEARCH_DOM_AI_MAPPING.md) - DOM to AI context optimization ⭐ NEW

## Advanced: Puppeteer in Chrome Extensions (Experimental)

Puppeteer CAN run in Chrome extensions using `chrome.debugger` API, but it's experimental with limitations.

### How It Works:

```typescript
import {
  connect,
  ExtensionTransport,
} from 'puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js';

// Create or find a tab
const tab = await chrome.tabs.create({ url })

// Connect Puppeteer using ExtensionTransport
const browser = await connect({
  transport: await ExtensionTransport.connectTab(tab.id),
})

// Single page corresponds to the tab
const [page] = await browser.pages()

// Perform usual Puppeteer operations
console.log(await page.evaluate('document.title'))
browser.disconnect()
```

### Limitations:
- ⚠️ Experimental - may have bugs
- 🔒 Single page only - cannot create new pages via Puppeteer
- 🔨 Requires bundler (Rollup/Webpack) for browser build
- 📦 Uses `chrome.debugger` - restricted CDP access
- 🎯 Use `chrome.tabs` API for new pages

### When to Use Puppeteer vs Content Scripts:

| Use Case | Recommended Approach |
|----------|---------------------|
| Simple form filling | **Content Scripts** ✅ (current approach) |
| Complex page automation | **Puppeteer** ⚠️ (experimental) |
| Screenshot/PDF generation | **Puppeteer** ✅ |
| Multi-tab coordination | **Chrome APIs** ✅ |
| Testing the extension | **Puppeteer** ✅ |
| Production form filling | **Content Scripts** ✅ (proven, stable) |

### Build Configuration (Rollup example):

```javascript
import {nodeResolve} from '@rollup/plugin-node-resolve'

export default {
  input: 'main.mjs',
  output: {
    format: 'esm',
    dir: 'out',
  },
  external: ['chromium-bidi/lib/cjs/bidiMapper/BidiMapper.js'],
  plugins: [
    nodeResolve({
      browser: true,
      resolveOnly: ['puppeteer-core'],
    }),
  ],
}
```

### Current Recommendation:
For your CV/Resume form filling use case, **Content Scripts are still better**:
- ✅ Stable and production-ready
- ✅ Direct DOM access (faster)
- ✅ No build complexity
- ✅ Works on all pages simultaneously
- ⚠️ Puppeteer is experimental, single-page only

See official docs: https://github.com/puppeteer/puppeteer/tree/main/examples/puppeteer-in-extension

## Recent Updates

### March 7, 2026
**MIGRATED: V1 → V2 (AI-First Form Extraction)** ⭐ NEW
- **Test Scan now uses V2**: `formFieldExtractorV2.ts` instead of V1
- **No hardcoded patterns**: 100% field coverage, language-agnostic
- **Migration**: Updated `src/contentScript/index.ts` to use `extractAllFieldsRaw()`
- **Priority calculation**: Now done on-the-fly based on CV data + field attributes
- **Benefits**:
  - ✅ 100% coverage - no field missed
  - ✅ Language-agnostic (German, Japanese, etc.)
  - ✅ Zero maintenance (no pattern lists)
  - ✅ AI fully utilized for semantic matching
  - ✅ Bundle size reduced from ~3KB to ~500 bytes
- **Comparison**: See [REFACTOR_HARDODED_FIELDS.md](REFACTOR_HARDODED_FIELDS.md)

**Added: DOM to AI Context Optimization (V1 - Legacy)**
- Original file: [src/utils/formFieldExtractor.ts](src/utils/formFieldExtractor.ts) (now legacy)
- Smart field extraction reduces context from ~500KB to ~5KB (99% reduction)
- CV-driven field extraction - only extracts relevant fields
- ATS detection for Greenhouse, Lever, Workday, Ashby, etc.
- Progressive processing: Quick scan → Smart match → Targeted fill
- Hierarchical field grouping by visual structure
- Confidence-based filtering for AI queries
- Research documentation: [RESEARCH_DOM_AI_MAPPING.md](RESEARCH_DOM_AI_MAPPING.md)

**Added: Test Scan Feature in Popup**
- Replaced "History" button with "Test Scan" in popup navigation
- Test scan functionality in [src/popup/Popup.tsx](src/popup/Popup.tsx)
- Scans current page for form fields using V2 AI-first extraction
- Displays: page info, statistics (total fields, high priority, fillable), extracted fields list
- Shows detected ATS, form type, field priority levels (high/medium/low)
- Real-time DOM extraction with visual feedback
- CSS styles added in [src/popup/Popup.css](src/popup/Popup.css)
- Message handler in [src/contentScript/index.ts](src/contentScript/index.ts)

**Added: Puppeteer in Chrome Extensions (Experimental)**
- Puppeteer CAN run in extensions using `chrome.debugger`
- Uses `ExtensionTransport.connectTab()` for single-page access
- Requires Rollup/Webpack bundler for browser build
- Limitations: Experimental, single-page only, larger bundle
- Use case: Screenshots, PDFs, advanced automation (NOT for simple form filling)
- Recommendation: Stick with Content Scripts for production form filling

**Key Functions:**
- `extractAllFieldsRaw()` - Extract ALL fields without filtering (V2 - Active)
- `calculateFieldPriority(field, cvData)` - Calculate priority on-the-fly
- `generateAIContextRaw(cvData)` - Generate AI context with all fields
- `detectATS()` - Detect Applicant Tracking System
- `handleTestScan()` - Test scan from popup
- `detectFormType()` - Detect form type (job-application, contact, etc.)
- `detectATSSystem()` - Detect ATS from page source
- Legacy V1: `extractRelevantFields(cvData)` - Pattern-based extraction (NOT in use)

## Author

**Md. Fahad Ali**

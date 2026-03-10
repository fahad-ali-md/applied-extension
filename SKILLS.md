# Applied - Chrome Extension Skills & Capabilities

## 🎯 Project Overview

**Applied** is an AI-powered Chrome extension for CV/Resume management and job application optimization. Built with React, TypeScript, and Vite, it helps users parse, analyze, and optimize their resumes for job applications.

### Tech Stack
- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **State Management**: Zustand
- **PDF Processing**: pdfjs-dist
- **Validation**: Zod
- **Chrome Extension**: Manifest V3

---

## 📁 Project Structure

```
applied/
├── src/
│   ├── background/          # Service worker for background tasks
│   ├── contentScript/       # Content scripts for web page interaction
│   ├── contexts/            # React contexts (DashboardContext)
│   ├── devtools/            # Chrome DevTools integration
│   ├── newtab/              # Custom new tab page
│   ├── options/             # Extension settings page (CV management)
│   ├── popup/               # Extension popup interface
│   ├── sidepanel/           # Side panel dashboard
│   ├── store/               # Zustand stores
│   ├── utils/               # Utility functions (PDF extractor)
│   ├── manifest.ts          # Extension manifest configuration
│   └── global.d.ts          # Global TypeScript definitions
├── public/                  # Static assets
├── build/                   # Build output
└── docs/                    # Implementation documentation
```

---

## ✨ Core Features

### 1. **CV Upload & Parsing** ✅
- Drag-and-drop PDF upload interface
- Multi-stage parsing progress indicator
- PDF text extraction using pdfjs-dist
- AI-ready processing pipeline
- Data persistence with localStorage

### 2. **Dashboard Management** ✅
- Side panel navigation
- Profile information editing
- Skills management (technical, soft, tools, languages)
- Work experience timeline
- Project showcase
- Education history

### 3. **Chrome Integration** ✅
- **Popup**: Quick access interface
- **Options Page**: Full CV management
- **Side Panel**: Dashboard view
- **Custom New Tab**: Branded new tab page
- **DevTools**: Developer tools integration
- **Content Scripts**: Web page interaction
- **Background Service Worker**: Background processing

### 4. **State Management** ✅
- Zustand store for dashboard state
- React Context for component communication
- Optimized re-renders using split contexts
- localStorage persistence

---

## 🔧 Available Commands

### Development
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run fmt          # Format code with Prettier
npm run zip          # Create distribution zip
```

### Chrome Extension Loading
1. Run `npm run dev`
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `build` folder

---

## 📊 Data Models

### ParsedCV Structure
```typescript
interface ParsedCV {
  personal: {
    firstName: string
    lastName: string
    email: string
    phone: string
    address?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
    linkedIn?: string
    portfolio?: string
  }
  professional: {
    currentTitle: string
    summary: string
    yearsOfExperience: number
  }
  skills: {
    technical: string[]
    soft: string[]
    tools: string[]
    languages: string[]
  }
  experience: Experience[]
  projects: Project[]
  education: Education[]
  rawText: string
  parsedAt: number
}
```

### Dashboard Store State
```typescript
interface DashboardStore {
  activeNav: 'cv' | 'api-keys' | 'preferences' | 'history'
  planUsage: { used: number; total: number }
  lastSync: Date | null
  setActiveNav: (nav) => void
  updatePlanUsage: (used) => void
  updateSyncStatus: () => void
}
```

---

## 🎨 UI Components

### Key Components
- **UploadDropzone**: Drag-and-drop PDF upload
- **ParsingStatus**: Multi-stage progress indicator
- **ProfileSection**: Personal information form
- **SkillsEditor**: Tag-based skill management
- **ExperienceTimeline**: Work experience timeline
- **GlassCard**: Glass morphism card component

### CSS Features
- Glass morphism effects
- Dark theme with gradients
- Responsive layout
- Timeline animations
- Skill tag badges

---

## 🔐 Permissions & Capabilities

### Chrome Permissions
- `sidePanel` - Side panel access
- `storage` - Local storage access
- `activeTab` - Current tab access
- `scripting` - Script injection
- Host permissions for all URLs

### Keyboard Shortcuts
- `Ctrl+Shift+D` / `Cmd+Shift+D` - Open Applied Dashboard

---

## 📝 Storage Keys

```typescript
const STORAGE_KEYS = {
  PARSED_CV: 'parsedCV',           // Full parsed CV data
  SELECTED_ROLE: 'selectedRole',   // Selected job role
  CV_VISIBILITY: 'cvVisibility'    // Field visibility settings
}
```

---

## 🚀 AI Integration Ready

The extension is ready for AI integration. Current implementation includes:

1. **PDF Extraction**: Full text extraction from PDFs
2. **Data Pipeline**: Structured data flow from upload to storage
3. **Progress Stages**: Visual feedback for each processing step
4. **Error Handling**: Comprehensive error management

### To Connect AI:
In `Options.tsx`, replace the sample data generation with:
```typescript
const aiResponse = await fetch('your-ai-endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    cvText: result.text,
    prompt: 'Extract structured data from this CV...'
  })
})
const processedCV = await aiResponse.json()
```

---

## 🐛 Troubleshooting

### PDF Not Parsing
- Ensure file is valid PDF
- Check browser console for errors
- Verify `pdf.worker.min.mjs` is in public folder

### Data Not Persisting
- Check localStorage quota
- Verify browser allows localStorage
- Check for privacy mode settings

### Extension Not Loading
- Ensure build folder exists
- Check Chrome version compatibility
- Verify Manifest V3 support
- Check browser console for errors

---

## 📖 Documentation Files

- [CV_UPLOAD_IMPLEMENTATION.md](CV_UPLOAD_IMPLEMENTATION.md) - CV upload & parsing details
- [MODEL_FETCHING_RESTORATION.md](MODEL_FETCHING_RESTORATION.md) - AI model fetching
- [NAVIGATION_FIX.md](NAVIGATION_FIX.md) - Navigation fixes
- [REAL_AI_PARSING_FIX.md](REAL_AI_PARSING_FIX.md) - AI parsing implementation
- [RENDER_OPTIMIZATION_GUIDE.md](RENDER_OPTIMIZATION_GUIDE.md) - Performance optimization

---

## 🎯 Future Enhancements

- [ ] Role template selection
- [ ] CV visibility toggles
- [ ] Export to different formats
- [ ] AI enhancement suggestions
- [ ] Job application tracking
- [ ] Cover letter generation
- [ ] LinkedIn integration

---

## 👤 Author

**Md. Fahad Ali**

---

## 📄 License

MIT License - See LICENSE file for details

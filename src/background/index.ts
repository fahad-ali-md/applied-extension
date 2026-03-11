import { z } from 'zod'
import { enhanceCVDataWithPhoneInfo } from '../utils/phoneParser'

// ============================================
// ZOD VALIDATION SCHEMAS
//============================================

const PersonalInfoSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email format"),
  phone: z.string().min(1, "Phone is required"),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).default('prefer_not_to_say'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  linkedIn: z.string().optional(),
  portfolio: z.string().optional(),
})

const WorkExperienceSchema = z.object({
  id: z.string().min(1),
  role: z.string().min(1, "Role is required"),
  company: z.string().min(1, "Company is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  current: z.boolean(),
  highlights: z.array(z.string()),
  skills: z.array(z.string()),
  visibleInCV: z.boolean().optional().default(true),
})

const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Project name is required"),
  description: z.string(),
  technologies: z.array(z.string()),
  url: z.string().optional(),
  highlights: z.array(z.string()),
  visibleInCV: z.boolean().optional().default(true),
})

const EducationSchema = z.object({
  id: z.string().min(1),
  degree: z.string().min(1, "Degree is required"),
  school: z.string().min(1, "School is required"),
  field: z.string().optional(),
  graduationYear: z.string().optional(),
  visibleInCV: z.boolean().optional().default(true),
})

const ParsedCVSchema = z.object({
  personal: PersonalInfoSchema,
  professional: z.object({
    currentTitle: z.string(),
    summary: z.string(),
    yearsOfExperience: z.number().nonnegative(),
  }),
  skills: z.object({
    technical: z.array(z.string()),
    soft: z.array(z.string()),
    tools: z.array(z.string()),
    languages: z.array(z.string()),
  }),
  experience: z.array(WorkExperienceSchema),
  projects: z.array(ProjectSchema),
  education: z.array(EducationSchema),
  rawText: z.string(),
  parsedAt: z.number(),
})

// ============================================
// TYPES
// ============================================

interface PersonalInfo {
  firstName: string
  lastName: string
  email: string
  phone: string
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say'
  address?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  linkedIn?: string
  portfolio?: string
}

interface WorkExperience {
  id: string
  role: string
  company: string
  startDate: string
  endDate?: string
  current: boolean
  highlights: string[]
  skills: string[]
}

interface Project {
  id: string
  name: string
  description: string
  technologies: string[]
  url?: string
  highlights: string[]
}

interface Education {
  id: string
  degree: string
  school: string
  field?: string
  graduationYear?: string
}

interface ParsedCV {
  personal: PersonalInfo
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
  experience: WorkExperience[]
  projects: Project[]
  education: Education[]
  rawText: string
  parsedAt: number
}

interface CVData {
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
  }
  professional: {
    currentTitle?: string
    company?: string
    experience?: string
    skills?: string[]
    summary?: string
  }
  education: {
    degree?: string
    school?: string
    graduationYear?: string
  }
  rawText?: string
}

interface ProviderConfig {
  provider: 'openai' | 'gemini' | 'zhipu' | 'openrouter'
  apiKey: string
  model: string
  modelName: string
  savedAt: number
}

interface AIProvider {
  name: string
  key: string
  baseUrl: string
  defaultModel: string
}

interface RoleTemplate {
  id: string
  name: string
  description: string
  emphasize: string[]
  deEmphasize: string[]
  sections: string[]
  keywords: string[]
}

// ============================================
// CONSTANTS
// ============================================

// 🎯 Request queue to prevent rate limiting
let lastParseRequestTime = 0
const MIN_REQUEST_INTERVAL_MS = 3000  // Minimum 3 seconds between requests

const STORAGE_KEYS = {
  CV_DATA: 'cv_data',
  PARSED_CV: 'parsedCV',
  ROLE_TEMPLATES: 'role_templates',
  SELECTED_ROLE: 'selectedRole',
  API_KEY_OPENAI: 'openai_api_key',
  API_KEY_GEMINI: 'gemini_api_key',
  API_KEY_ZHIPU: 'zhipu_api_key',
  API_KEY_OPENROUTER: 'openrouter_api_key',
  SETTINGS: 'settings',
  PROVIDER_CONFIGS: 'provider_configs',
}

// 🎯 CV PARSING CONSTANTS - Make parsing consistent across uploads
const CV_PARSING = {
  // Token limits for each provider
  MAX_TOKENS: {
    openai: 16384,
    gemini: 32768,  // Increased to handle larger CVs
    zhipu: 16384,
    openrouter: 8192,  // Increased for CV parsing
  },
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 2000,
  // Timeout configuration
  TIMEOUT_MS: 60000, // 60 seconds
  // JSON extraction patterns
  JSON_PATTERNS: [
    /```json\s*(\{[\s\S]*\})\s*```/,  // ```json ... ```
    /```\s*(\{[\s\S]*\})\s*```/,        // ``` ... ```
    /\{[\s\S]*\}/,                       // Raw JSON object
  ],
  // Truncation handling
  MIN_JSON_LENGTH: 100,   // Minimum valid JSON length
  MAX_RESPONSE_LENGTH: 50000, // Maximum response length to accept
}

const AI_PROVIDERS: Record<string, AIProvider> = {
  openai: {
    name: 'OpenAI',
    key: STORAGE_KEYS.API_KEY_OPENAI,
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  },
  gemini: {
    name: 'Google Gemini',
    key: STORAGE_KEYS.API_KEY_GEMINI,
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.5-flash',
  },
  zhipu: {
    name: 'Zhipu AI (Z.ai)',
    key: STORAGE_KEYS.API_KEY_ZHIPU,
    baseUrl: 'https://api.z.ai/api/paas/v4',
    defaultModel: 'glm-4-flash',
  },
  openrouter: {
    name: 'OpenRouter',
    key: STORAGE_KEYS.API_KEY_OPENROUTER,
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'nvidia/nemotron-3-nano-30b-a3b:free', // 🚀 Fastest working model (584ms)
  },
}

const DEFAULT_ROLE_TEMPLATES: Record<string, RoleTemplate> = {
  fullstack: {
    id: 'fullstack',
    name: 'Full-Stack Developer',
    description: 'End-to-end development with both frontend and backend skills',
    emphasize: ['Full-stack', 'React', 'Node.js', 'Database', 'API', 'Architecture'],
    deEmphasize: [],
    sections: ['personal', 'skills', 'experience', 'projects', 'education'],
    keywords: ['full-stack', 'frontend', 'backend', 'web development', 'javascript', 'typescript']
  },
  frontend: {
    id: 'frontend',
    name: 'Frontend Developer',
    description: 'User interface and client-side development',
    emphasize: ['React', 'JavaScript', 'TypeScript', 'UI/UX', 'CSS', 'Frontend'],
    deEmphasize: ['Backend', 'Database', 'DevOps'],
    sections: ['personal', 'skills', 'experience', 'projects', 'education'],
    keywords: ['frontend', 'react', 'vue', 'angular', 'javascript', 'css', 'html']
  },
  backend: {
    id: 'backend',
    name: 'Backend Developer',
    description: 'Server-side development and API design',
    emphasize: ['Node.js', 'Python', 'Database', 'API', 'Architecture'],
    deEmphasize: ['UI', 'CSS', 'Frontend'],
    sections: ['personal', 'skills', 'experience', 'projects', 'education'],
    keywords: ['backend', 'api', 'database', 'server', 'python', 'node']
  },
}

const DEFAULT_MODELS = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
  ],
  gemini: [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-flash-8b', name: 'Gemini 2.5 Flash (8B)' },
  ],
  zhipu: [
    { id: 'glm-5', name: 'GLM-5' },
    { id: 'glm-4', name: 'GLM-4' },
    { id: 'glm-4-flash', name: 'GLM-4 Flash' },
  ],
  openrouter: [
    { id: 'nvidia/nemotron-3-nano-30b-a3b:free', name: 'NVIDIA Nemotron 30B (Free)' }, // 🚀 FASTEST (620ms)
    { id: 'arcee-ai/trinity-large-preview:free', name: 'Arcee Trinity Large (Free)' }, // ✅ Excellent (1135ms)
    { id: 'liquid/lfm-2.5-1.2b-instruct:free', name: 'LFM 2.5 Instruct (Free)' }, // ✅ Good quality (1161ms)
    { id: 'openrouter/free', name: 'Free Models Router (Auto)' }, // ✅ Working (1971ms)
    { id: 'z-ai/glm-4.5-air:free', name: 'Z.ai GLM 4.5 Air (Free)' }, // ✅ Working but slow (9838ms)
    { id: 'google/gemma-3-4b-it:free', name: 'Google Gemma 3 4B (Free)' }, // 🔴 Rate limited
    // Removed: google/gemma-3-12b-it:free (returns 400 error)
  ],
}

// ============================================
// MESSAGE HANDLERS
// ============================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Received message:', request.action)

  // Form filling
  if (request.action === 'fillForm') {
    handleFillForm(request.tabId).then(sendResponse)
    return true
  }

  // 🧠 AI Field Mapping (Dynamic field detection + AI analysis)
  if (request.action === 'mapFieldsWithAI') {
    const { rawFields } = request

    // Get CV data
    chrome.storage.local.get([STORAGE_KEYS.PARSED_CV, STORAGE_KEYS.CV_DATA]).then(async (result) => {
      const cvData = result[STORAGE_KEYS.PARSED_CV] || result[STORAGE_KEYS.CV_DATA]

      if (!cvData) {
        sendResponse({ success: false, error: 'No CV data found' })
        return
      }

      // Use AI to map fields
      const mappings = await mapFieldsWithAI(rawFields, cvData)

      sendResponse({
        success: true,
        mappings,
        totalFields: rawFields.length,
        mappedFields: mappings.length
      })
    }).catch(error => {
      sendResponse({ success: false, error: error.message })
    })

    return true // Keep channel open for async
  }

  // CV data storage
  if (request.action === 'saveCV') {
    chrome.storage.local.set({ [STORAGE_KEYS.CV_DATA]: request.data }).then(() => {
      sendResponse({ success: true })
    })
    return true
  }

  // CV data retrieval
  if (request.action === 'getCV') {
    chrome.storage.local.get([STORAGE_KEYS.CV_DATA, STORAGE_KEYS.PARSED_CV]).then(result => {
      const cvData = result[STORAGE_KEYS.PARSED_CV] || result[STORAGE_KEYS.CV_DATA]
      sendResponse({ data: cvData })
    })
    return true
  }

  // Settings storage
  if (request.action === 'saveSettings') {
    chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: request.data }).then(() => {
      sendResponse({ success: true })
    })
    return true
  }

  // Settings retrieval
  if (request.action === 'getSettings') {
    chrome.storage.local.get([STORAGE_KEYS.SETTINGS, STORAGE_KEYS.API_KEY_OPENAI, STORAGE_KEYS.API_KEY_GEMINI, STORAGE_KEYS.API_KEY_ZHIPU]).then(result => {
      const settings = result[STORAGE_KEYS.SETTINGS] || {}
      sendResponse({
        settings: {
          ...settings,
          apiKeyOpenAI: result[STORAGE_KEYS.API_KEY_OPENAI] || '',
          apiKeyGemini: result[STORAGE_KEYS.API_KEY_GEMINI] || '',
          apiKeyZhipu: result[STORAGE_KEYS.API_KEY_ZHIPU] || '',
        },
        hasApiKey: !!(result[STORAGE_KEYS.API_KEY_OPENAI] || result[STORAGE_KEYS.API_KEY_GEMINI] || result[STORAGE_KEYS.API_KEY_ZHIPU]),
      })
    })
    return true
  }

  // Provider configuration
  if (request.action === 'saveProviderConfig') {
    const { provider, apiKey, model, modelName } = request
    chrome.storage.local.get(STORAGE_KEYS.PROVIDER_CONFIGS).then(result => {
      const configs: Record<string, ProviderConfig> = result[STORAGE_KEYS.PROVIDER_CONFIGS] || {}
      configs[provider] = { provider, apiKey, model, modelName: modelName || model, savedAt: Date.now() }
      chrome.storage.local.set({ [STORAGE_KEYS.PROVIDER_CONFIGS]: configs }).then(() => {
        sendResponse({ success: true })
      })
    })
    return true
  }

  // Save API key (called from Options page)
  if (request.action === 'saveApiKey') {
    const { provider, apiKey } = request
    const storageKey = STORAGE_KEYS[`API_KEY_${provider.toUpperCase()}` as keyof typeof STORAGE_KEYS]
    if (storageKey) {
      chrome.storage.local.set({ [storageKey]: apiKey }).then(() => {
        sendResponse({ success: true })
      })
    } else {
      sendResponse({ success: false, error: 'Unknown provider' })
    }
    return true
  }

  // Save model selection (called from Options page)
  if (request.action === 'saveModel') {
    const { model, modelName } = request
    chrome.storage.local.get(STORAGE_KEYS.SETTINGS).then(result => {
      const settings = result[STORAGE_KEYS.SETTINGS] || {}
      settings.aiModel = model
      settings.aiModelName = modelName || model
      chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings }).then(() => {
        sendResponse({ success: true })
      })
    })
    return true
  }

  // Get available providers
  if (request.action === 'getAvailableProviders') {
    chrome.storage.local.get([STORAGE_KEYS.PROVIDER_CONFIGS, STORAGE_KEYS.SETTINGS, STORAGE_KEYS.API_KEY_OPENAI, STORAGE_KEYS.API_KEY_GEMINI, STORAGE_KEYS.API_KEY_ZHIPU, STORAGE_KEYS.API_KEY_OPENROUTER]).then(result => {
      console.log('[getAvailableProviders] Storage result:', result)

      const configs: Record<string, ProviderConfig> = result[STORAGE_KEYS.PROVIDER_CONFIGS] || {}
      const settings = result[STORAGE_KEYS.SETTINGS] || {}

      console.log('[getAvailableProviders] Configs:', configs)
      console.log('[getAvailableProviders] Settings:', settings)

      const providers = Object.values(configs)
        .filter(config => config.apiKey && config.apiKey.length > 0)
        .map(config => ({
          id: config.provider,
          name: AI_PROVIDERS[config.provider]?.name || config.provider,
          model: config.model,
          modelName: config.modelName
        }))

      console.log('[getAvailableProviders] Providers from configs:', providers)

      // Add old-style API keys
      if (result[STORAGE_KEYS.API_KEY_OPENAI] && !providers.some((p: any) => p.id === 'openai')) {
        console.log('[getAvailableProviders] Adding OpenAI from old-style key')
        providers.push({ id: 'openai', name: 'OpenAI', model: 'gpt-4o-mini', modelName: 'GPT-4o Mini' })
      }
      if (result[STORAGE_KEYS.API_KEY_GEMINI] && !providers.some((p: any) => p.id === 'gemini')) {
        console.log('[getAvailableProviders] Adding Gemini from old-style key')
        providers.push({ id: 'gemini', name: 'Gemini', model: 'gemini-2.5-flash', modelName: 'Gemini 2.5 Flash' })
      }
      if (result[STORAGE_KEYS.API_KEY_ZHIPU] && !providers.some((p: any) => p.id === 'zhipu')) {
        console.log('[getAvailableProviders] Adding Zhipu from old-style key')
        providers.push({ id: 'zhipu', name: 'Zhipu AI', model: 'glm-4-flash', modelName: 'GLM-4 Flash' })
      }
      if (result[STORAGE_KEYS.API_KEY_OPENROUTER] && !providers.some((p: any) => p.id === 'openrouter')) {
        console.log('[getAvailableProviders] Adding OpenRouter from old-style key')
        providers.push({ id: 'openrouter', name: 'OpenRouter', model: 'arcee-ai/trinity-large-preview:free', modelName: 'Arcee Trinity Large (Free)' })
      }

      console.log('[getAvailableProviders] Final providers:', providers)

      sendResponse({
        success: true,
        providers,
        activeProvider: settings.activeProvider || settings.aiProvider || null
      })
    })
    return true
  }

  // Save active provider
  if (request.action === 'saveActiveProvider') {
    chrome.storage.local.get(STORAGE_KEYS.SETTINGS).then(result => {
      const settings = result[STORAGE_KEYS.SETTINGS] || {}
      settings.activeProvider = request.provider
      settings.aiProvider = request.provider
      chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings }).then(() => {
        sendResponse({ success: true })
      })
    })
    return true
  }

  // Fetch models
  if (request.action === 'fetchModels') {
    fetchAvailableModels(request.provider, request.apiKey)
      .then(models => sendResponse({ success: true, models }))
      .catch(error => sendResponse({ success: false, error: String(error) }))
    return true
  }

  // Test API
  if (request.action === 'testAPI') {
    testAPIConnection(request.provider, request.apiKey, request.model)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, message: String(error) }))
    return true
  }

  // Parse CV
  if (request.action === 'parseCV') {
    const { cvText, provider, apiKey, model } = request
    parseCVWithAI(cvText, provider, apiKey, model)
      .then(parsedCV => {
        if (parsedCV) {
          chrome.storage.local.set({ [STORAGE_KEYS.PARSED_CV]: parsedCV }).then(() => {
            sendResponse({ success: true, data: parsedCV })
          })
        } else {
          sendResponse({ success: false, error: 'Failed to parse CV' })
        }
      })
      .catch(error => sendResponse({ success: false, error: error.message }))
    return true
  }

  // Get parsed CV
  if (request.action === 'getParsedCV') {
    chrome.storage.local.get([STORAGE_KEYS.PARSED_CV, STORAGE_KEYS.SELECTED_ROLE]).then(result => {
      const parsedCV = result[STORAGE_KEYS.PARSED_CV]
      const selectedRole = result[STORAGE_KEYS.SELECTED_ROLE] || 'fullstack'

      if (parsedCV) {
        const roleCV = generateRoleBasedCV(parsedCV, selectedRole)
        sendResponse({
          success: true,
          data: roleCV,
          original: parsedCV,
          selectedRole,
          availableRoles: Object.keys(DEFAULT_ROLE_TEMPLATES)
        })
      } else {
        sendResponse({ success: false, error: 'No parsed CV found' })
      }
    })
    return true
  }

  // Select role
  if (request.action === 'selectRole') {
    chrome.storage.local.set({ [STORAGE_KEYS.SELECTED_ROLE]: request.roleId }).then(() => {
      sendResponse({ success: true })
    })
    return true
  }

  // Get role templates
  if (request.action === 'getRoleTemplates') {
    sendResponse({ success: true, templates: DEFAULT_ROLE_TEMPLATES })
    return true
  }

  // Scan job description
  if (request.action === 'scanJobDescription') {
    scanJobDescription().then(sendResponse).catch(() => sendResponse({ success: false }))
    return true
  }

  // Detect fields
  if (request.action === 'detectFields') {
    detectFormFields().then(sendResponse).catch(() => sendResponse({ success: false }))
    return true
  }

  // AI requests for smart form handling
  if (request.action === 'askAI') {
    getActiveProvider()
      .then((provider: ProviderConfig | null) => {
        if (!provider) throw new Error('No AI provider configured')
        return callAI(provider, request.prompt)
      })
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }))
    return true
  }

  // 🎯 Form fill progress updates from content script
  if (request.action === 'formFillProgress') {
    // Forward to popup if it's open
    chrome.runtime.sendMessage({
      action: 'formFillProgressUpdate',
      field: request.field
    }).catch(() => {
      // Popup might not be open, that's okay
      console.log('[Background] Popup not open, progress not delivered')
    })
    return true
  }
})

// ============================================
// FORM FILLING
// ============================================

async function handleFillForm(tabId?: number): Promise<any> {
  try {
    const targetTabId = tabId || (await getActiveTabId())
    if (!targetTabId) return { success: false, error: 'No active tab found' }

    console.log("[handleFillForm] Target tab ID:", targetTabId)

    // Get tab info to debug
    const tab = await chrome.tabs.get(targetTabId)
    console.log("[handleFillForm] Tab URL:", tab.url)
    console.log("[handleFillForm] Tab status:", tab.status)

    // Check if content script is loaded by sending a ping
    let contentScriptLoaded = false
    try {
      await chrome.tabs.sendMessage(targetTabId, { action: 'ping' })
      contentScriptLoaded = true
      console.log("[handleFillForm] Content script is loaded")
    } catch (pingError) {
      console.log("[handleFillForm] Content script NOT loaded, attempting to inject...")
      contentScriptLoaded = false
    }

    // Try to inject content script if not loaded
    if (!contentScriptLoaded) {
      try {
        // Check if we can inject (not a special page)
        if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
          console.log("[handleFillForm] Injecting content script...")
          // Use the built JavaScript file (Chrome can only inject .js files, not .ts)
          await chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            files: ['src/contentScript/index.ts.js']
          })
          // Wait a bit for the script to initialize
          await new Promise(resolve => setTimeout(resolve, 500))
          console.log("[handleFillForm] Content script injected successfully")
        } else {
          return {
            success: false,
            error: `Cannot fill forms on this page type. URL: ${tab.url}. Content scripts only work on http/https pages.`
          }
        }
      } catch (injectError) {
        console.error("[handleFillForm] Failed to inject content script:", injectError)
        return {
          success: false,
          error: `Cannot inject content script. This might be a restricted page. URL: ${tab.url || 'unknown'}`
        }
      }
    }
    const result = await chrome.storage.local.get([STORAGE_KEYS.CV_DATA, STORAGE_KEYS.PARSED_CV])
    const parsedCV: ParsedCV | undefined = result[STORAGE_KEYS.PARSED_CV]
    const legacyCV: CVData | undefined = result[STORAGE_KEYS.CV_DATA]
    const cvData = parsedCV || legacyCV

    if (!cvData) return { success: false, error: 'No CV data found' }

    let dataForContentScript: any
    if (parsedCV) {
      // 🎯 Intelligent Data Preparation - Enhance with phone parsing
      const enhancedCV = enhanceCVDataWithPhoneInfo(parsedCV)

      dataForContentScript = {
        personal: {
          ...enhancedCV.personal,
          // ✨ Smart name splitting - if firstName is empty but lastName has full name, split it
          firstName: enhancedCV.personal.firstName || (() => {
            const fullName = enhancedCV.personal.lastName || ''
            const parts = fullName.trim().split(' ')
            return parts.length > 1 ? parts[0] : fullName
          })(),
          lastName: enhancedCV.personal.lastName || (() => {
            const fullName = enhancedCV.personal.lastName || ''
            const parts = fullName.trim().split(' ')
            return parts.length > 1 ? parts.slice(1).join(' ') : ''
          })(),
          // ✨ Add gender field (not in original CV, but commonly needed in forms)
          gender: enhancedCV.personal.gender || 'prefer_not_to_say', // Options: 'male', 'female', 'other', 'prefer_not_to_say'
        },
        professional: {
          currentTitle: enhancedCV.professional.currentTitle,
          summary: enhancedCV.professional.summary,
          skills: enhancedCV.skills.technical,
          experience: `${enhancedCV.professional.yearsOfExperience} years`
        },
        education: enhancedCV.education[0] || {},
        coverLetter: await generateProfessionalCoverLetter(enhancedCV)
      }
    } else {
      dataForContentScript = legacyCV
    }

    const fillResult = await chrome.tabs.sendMessage(targetTabId, {
      action: 'fillForm',
      data: dataForContentScript,
    })

    console.log("Fillform", fillResult)

    return fillResult
  } catch (error) {
    console.error('[handleFillForm] Error:', error)
    return { success: false, error: String(error) }
  }
}

// ============================================
// AI FUNCTIONS
// ============================================

async function getActiveProvider(): Promise<ProviderConfig | null> {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.PROVIDER_CONFIGS,
    STORAGE_KEYS.SETTINGS,
    STORAGE_KEYS.API_KEY_OPENAI,
    STORAGE_KEYS.API_KEY_GEMINI,
    STORAGE_KEYS.API_KEY_ZHIPU
  ])

  const configs: Record<string, ProviderConfig> = result[STORAGE_KEYS.PROVIDER_CONFIGS] || {}
  const settings = result[STORAGE_KEYS.SETTINGS] || {}

  console.log('[getActiveProvider] Available configs:', Object.keys(configs))
  console.log('[getActiveProvider] Active provider from settings:', settings.activeProvider)

  // 🎯 Try new-style provider configs first
  let activeProviderId = settings.activeProvider || Object.keys(configs)[0]

  if (activeProviderId && configs[activeProviderId]) {
    console.log('[getActiveProvider] Using new-style config:', activeProviderId)
    return configs[activeProviderId]
  }

  // 🎯 Fallback to old-style API keys
  console.log('[getActiveProvider] No new-style config found, checking old-style API keys...')

  const oldStyleKeys: Record<string, { key: string; provider: string; model: string; modelName: string }> = {
    gemini: {
      key: result[STORAGE_KEYS.API_KEY_GEMINI] || '',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      modelName: 'Gemini 2.5 Flash'
    },
    openai: {
      key: result[STORAGE_KEYS.API_KEY_OPENAI] || '',
      provider: 'openai',
      model: 'gpt-4o-mini',
      modelName: 'GPT-4o Mini'
    },
    zhipu: {
      key: result[STORAGE_KEYS.API_KEY_ZHIPU] || '',
      provider: 'zhipu',
      model: 'glm-4-flash',
      modelName: 'GLM-4 Flash'
    },
    openrouter: {
      key: result[STORAGE_KEYS.API_KEY_OPENROUTER] || '',
      provider: 'openrouter',
      model: 'nvidia/nemotron-3-nano-30b-a3b:free',
      modelName: 'NVIDIA Nemotron 30B (Free)'
    },
  }

  // Find first available old-style key (prioritize Gemini as user prefers it)
  for (const [name, config] of Object.entries(oldStyleKeys)) {
    if (config.key) {
      console.log(`[getActiveProvider] ✓ Using old-style key for ${name}`)
      return {
        provider: config.provider as any,
        apiKey: config.key,
        model: config.model,
        modelName: config.modelName,
        savedAt: Date.now()
      }
    }
  }

  console.warn('[getActiveProvider] ❌ No AI provider found')
  return null
}

async function callAI(provider: ProviderConfig, prompt: string, tools?: any[]): Promise<any> {
  let response: string | null

  switch (provider.provider) {
    case 'openai':
      response = await callOpenAI(provider.apiKey, prompt, provider.model, tools)
      break
    case 'gemini':
      response = await callGemini(provider.apiKey, prompt, provider.model, tools)
      break
    case 'zhipu':
      response = await callZhipu(provider.apiKey, prompt, provider.model, tools)
      break
    case 'openrouter':
      {
        const result = await callOpenRouterWithFallback(provider.apiKey, prompt, provider.model, tools)
        response = result.content
        console.log(`[CV Parser] Using model: ${result.modelUsed}`)
      }
      break
    default:
      throw new Error(`Unknown provider: ${provider.provider}`)
  }

  if (!response) throw new Error('AI returned empty response')

  try {
    return JSON.parse(response)
  } catch (error) {
    console.error('[callAI] Failed to parse AI response:', error)
    throw new Error('Invalid JSON response from AI')
  }
}

// Function to handle tool calling with multi-turn conversation
async function callAIWithTools(
  provider: ProviderConfig,
  prompt: string,
  tools: any[],
  toolHandler: (toolName: string, args: any) => string,
  maxTurns: number = 5
): Promise<any> {
  console.log('[callAIWithTools] Starting AI call with tools...')
  console.log('[callAIWithTools] Provider:', provider.provider)
  console.log('[callAIWithTools] Tools provided:', tools?.length || 0)

  let messages: any[] = [
    { role: 'system', content: 'You are a helpful assistant that returns valid JSON or calls tools when needed.' },
    { role: 'user', content: prompt }
  ]

  for (let turn = 0; turn < maxTurns; turn++) {
    console.log(`[callAIWithTools] Turn ${turn + 1}/${maxTurns} - Calling ${provider.provider} API...`)
    const startTime = Date.now()

    let response: any

    try {
      // Make API call based on provider
      if (provider.provider === 'openai') {
        response = await callOpenAIWithTools(provider.apiKey, messages, provider.model, tools)
      } else if (provider.provider === 'gemini') {
        response = await callGeminiWithTools(provider.apiKey, messages, provider.model, tools)
      } else if (provider.provider === 'zhipu') {
        response = await callZhipuWithTools(provider.apiKey, messages, provider.model, tools)
      } else if (provider.provider === 'openrouter') {
        response = await callOpenAIWithTools(provider.apiKey, messages, provider.model, tools)
      } else {
        throw new Error(`Unknown provider: ${provider.provider}`)
      }
    } catch (error: any) {
      console.error(`[callAIWithTools] API call failed:`, error.message)
      throw error
    }

    const elapsed = Date.now() - startTime
    console.log(`[callAIWithTools] API response received in ${elapsed}ms`)

    // Check if AI wants to call tools
    if (response.toolCalls && response.toolCalls.length > 0) {
      console.log(`[callAIWithTools] AI requested ${response.toolCalls.length} tool(s):`, response.toolCalls.map((tc: any) => tc.name))

      // Execute tools and add results
      for (const toolCall of response.toolCalls) {
        console.log(`[callAIWithTools] Executing tool: ${toolCall.name} with args:`, toolCall.arguments)
        const result = toolHandler(toolCall.name, toolCall.arguments)
        console.log(`[callAIWithTools] Tool result:`, result.substring(0, 100))

        messages.push({
          role: 'tool',
          content: result,
          toolCallId: toolCall.id,
          name: toolCall.name
        })
      }
      // Continue conversation
      console.log('[callAIWithTools] Continuing conversation with tool results...')
    } else {
      console.log('[callAIWithTools] No tool calls - returning final response')
      // Final response - return content
      return response.content
    }
  }

  throw new Error('Max turns exceeded in tool calling')
}

// OpenAI with tools
async function callOpenAIWithTools(apiKey: string, messages: any[], model: string, tools?: any[]): Promise<any> {
  const response = await fetch(`${AI_PROVIDERS.openai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: 0.1,
      max_tokens: 2000,
      ...(tools && tools.length > 0 ? { tools: tools, tool_choice: "auto" } : {})
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  const msg = data.choices[0]?.message

  if (msg?.tool_calls) {
    return {
      toolCalls: msg.tool_calls.map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments)
      }))
    }
  }

  return { content: msg?.content }
}

// Gemini with tools (simplified)
async function callGeminiWithTools(apiKey: string, messages: any[], model: string, tools?: any[]): Promise<any> {
  // Gemini tool calling is complex, using simplified version
  const prompt = messages.map((m: any) => m.content).join('\n')
  return await callGemini(apiKey, prompt, model, tools).then(content => ({ content }))
}

// Zhipu with tools (simplified)
async function callZhipuWithTools(apiKey: string, messages: any[], model: string, tools?: any[]): Promise<any> {
  // Zhipu tool calling is complex, using simplified version
  const prompt = messages.map((m: any) => m.content).join('\n')
  return await callZhipu(apiKey, prompt, model, tools).then(content => ({ content }))
}

async function callOpenAI(apiKey: string, prompt: string, model: string, tools?: any[]): Promise<string | null> {
  const response = await fetch(`${AI_PROVIDERS.openai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant that returns only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: CV_PARSING.MAX_TOKENS.openai,
      response_format: { type: "json_object" },
      ...(tools && tools.length > 0 ? { tools: tools, tool_choice: "auto" } : {})
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    if (response.status === 429) throw new Error('OpenAI rate limit exceeded')
    throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices[0]?.message?.content
}

async function callGemini(apiKey: string, prompt: string, model: string, tools?: any[]): Promise<string | null> {
  const body: any = {
    contents: [{ parts: [{ text: `You are a helpful assistant that returns only valid JSON.\n\n${prompt}` }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: CV_PARSING.MAX_TOKENS.gemini,
    },
  }

  // Add tools if provided (Gemini uses functionDeclarations format)
  if (tools && tools.length > 0) {
    // When using tools, don't force JSON response format (incompatible)
    body.tools = [{
      functionDeclarations: tools.map((t: any) => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters
      }))
    }]
  } else {
    // Only use JSON response format when no tools
    body.generationConfig.responseMimeType = "application/json"
  }

  const response = await fetch(
    `${AI_PROVIDERS.gemini.baseUrl}/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    if (response.status === 429) {
      console.error('[callGemini] Rate limit exceeded! Waiting 5 seconds...')
      await new Promise(resolve => setTimeout(resolve, 5000))
      throw new Error('Gemini rate limit exceeded - please try again')
    }
    console.error('[callGemini] API Error:', errorData)
    throw new Error(errorData.error?.message || `Gemini API error: ${response.status}`)
  }

  const data = await response.json()
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text

  // Log actual response length for debugging
  console.log(`[callGemini] Response length: ${responseText?.length || 0} chars`)
  console.log('[callGemini] Response preview:', responseText?.substring(0, 200))

  // Check for truncation
  if (responseText && !responseText.trim().endsWith('}')) {
    console.warn('[callGemini] ⚠️ Response appears truncated (does not end with })')
  }

  return responseText
}

async function callZhipu(apiKey: string, prompt: string, model: string, tools?: any[]): Promise<string | null> {
  const response = await fetch(`${AI_PROVIDERS.zhipu.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant that returns only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: CV_PARSING.MAX_TOKENS.zhipu,
      ...(tools && tools.length > 0 ? { tools: tools, tool_choice: "auto" } : {})
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    if (response.status === 429) throw new Error('Zhipu rate limit exceeded')
    throw new Error(errorData.error?.message || `Zhipu API error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices[0]?.message?.content
}

async function callOpenRouter(apiKey: string, prompt: string, model: string, tools?: any[]): Promise<string | null> {
  const response = await fetch(`${AI_PROVIDERS.openrouter.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': chrome.runtime.getURL(''),
      'X-OpenRouter-Title': 'Applied AI Assistant',
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant that returns only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: CV_PARSING.MAX_TOKENS.openrouter,
      max_completion_tokens: CV_PARSING.MAX_TOKENS.openrouter, // Ensure completion tokens for reasoning models
      ...(tools && tools.length > 0 ? { tools: tools, tool_choice: "auto" } : {})
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('[OpenRouter] API Error:', { status: response.status, errorData })
    if (response.status === 429) throw new Error('OpenRouter rate limit exceeded')
    const errorMessage = errorData.error?.message || errorData.message || `OpenRouter API error: ${response.status}`
    throw new Error(errorMessage)
  }

  const data = await response.json()
  return data.choices[0]?.message?.content
}

/**
 * Smart fallback function for OpenRouter API calls
 * Tries multiple models in priority order when rate limiting occurs
 *
 * TEST RESULTS (2026-03-11 - Agent Research):
 * ✅ Working: nvidia/nemotron-3-nano-30b-a3b:free (620ms) 🚀 FASTEST
 * ✅ Working: arcee-ai/trinity-large-preview:free (1135ms)
 * ✅ Working: openrouter/free (1971ms)
 * ✅ Working: z-ai/glm-4.5-air:free (9838ms) - Slow but quality
 * ✅ Working: liquid/lfm-2.5-1.2b-instruct:free (1161ms) - Good quality
 * 🔴 Rate Limited: google/gemma-3-4b-it:free
 * ❌ Error 400: google/gemma-3-12b-it:free
 * ⚪ Not Found: microsoft/phi-3, qwen, llama, mistral, gryphe (free tiers discontinued)
 *
 * Fallback strategy: Prioritize by speed, then quality
 *
 * @returns { content, modelUsed, fallbackUsed } - Parsed content, which model succeeded, and if fallback was used
 */
async function callOpenRouterWithFallback(
  apiKey: string,
  prompt: string,
  model?: string,
  tools?: any[]
): Promise<{ content: string | null; modelUsed: string; fallbackUsed: boolean }> {
  // Build fallback models list - prioritize the requested model or known working model
  // Avoid duplicates by filtering out the primary model from backup list
  const primaryModel = model || 'nvidia/nemotron-3-nano-30b-a3b:free' // Fastest working model
  const backupModels = [
    'nvidia/nemotron-3-nano-30b-a3b:free',  // 🚀 FASTEST (620ms) - EXCELLENT quality
    'arcee-ai/trinity-large-preview:free',  // ✅ Good (1135ms) - EXCELLENT quality
    'liquid/lfm-2.5-1.2b-instruct:free',    // ✅ Good (1161ms) - GOOD quality
    'openrouter/free',                      // ✅ Working (1971ms) - EXCELLENT quality
    'z-ai/glm-4.5-air:free',                // ✅ Working (9838ms) - EXCELLENT quality (slow!)
    'google/gemma-3-4b-it:free',            // 🔴 Rate limited currently
    // Removed: google/gemma-3-12b-it:free (returns 400 error)
  ].filter(m => m !== primaryModel) // Remove primary to avoid duplicates

  const fallbackModels = [primaryModel, ...backupModels]
  let fallbackUsed = false

  console.log(`[OpenRouter] 🎯 Starting model rotation with ${fallbackModels.length} models available`)
  console.log(`[OpenRouter] 📋 Model order: ${fallbackModels.map((m, i) => `${i + 1}. ${m}`).join(', ')}`)

  for (let i = 0; i < fallbackModels.length; i++) {
    const attemptModel = fallbackModels[i]
    const isPrimary = i === 0

    try {
      // Show clear progress messages
      if (isPrimary) {
        console.log(`[OpenRouter] 🚀 Attempting PRIMARY model: ${attemptModel}`)
      } else {
        console.log(`[OpenRouter] 🔄 Trying BACKUP model ${i}/${fallbackModels.length - 1}: ${attemptModel}`)
        if (!fallbackUsed) {
          console.warn('[OpenRouter] ⚠️ Using backup model due to rate limit on primary model')
          fallbackUsed = true
        }
      }

      const response = await fetch(`${AI_PROVIDERS.openrouter.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': chrome.runtime.getURL(''),
          'X-OpenRouter-Title': 'Applied AI Assistant',
        },
        body: JSON.stringify({
          model: attemptModel,
          messages: [
            { role: 'system', content: 'You are a helpful assistant that returns only valid JSON.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
          max_tokens: CV_PARSING.MAX_TOKENS.openrouter,
          max_completion_tokens: CV_PARSING.MAX_TOKENS.openrouter,
          ...(tools && tools.length > 0 ? { tools: tools, tool_choice: 'auto' } : {})
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        // Handle 429 rate limit errors specifically
        if (response.status === 429) {
          const remainingModels = fallbackModels.length - i - 1
          if (remainingModels > 0) {
            console.warn(`[OpenRouter] 🔴 Rate limited (429) on "${attemptModel}". ${remainingModels} backup(s) remaining...`)
          } else {
            console.error(`[OpenRouter] 🔴 Rate limited (429) on "${attemptModel}". No more backups available!`)
          }
          continue // Try next model
        }

        // Handle 401 Unauthorized errors
        if (response.status === 401) {
          console.error('[OpenRouter] 🔑 Invalid API key. Please check your OpenRouter API key.')
          throw new Error('Invalid OpenRouter API key. Please check your credentials.')
        }

        // Handle other API errors
        const errorMessage = errorData.error?.message || errorData.message || `OpenRouter API error: ${response.status}`
        console.error(`[OpenRouter] ❌ API Error on "${attemptModel}":`, { status: response.status, error: errorMessage })
        throw new Error(errorMessage)
      }

      const data = await response.json()
      const content = data.choices[0]?.message?.content

      // Success message - distinguish between primary and fallback
      if (fallbackUsed) {
        console.log(`[OpenRouter] ✅ Success with BACKUP model: "${attemptModel}"`)
      } else {
        console.log(`[OpenRouter] ✅ Success with primary model: "${attemptModel}"`)
      }

      return { content, modelUsed: attemptModel, fallbackUsed }
    } catch (error) {
      // Handle network errors or other exceptions
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error(`[OpenRouter] 🌐 Network error trying "${attemptModel}":`, error)
        const remainingModels = fallbackModels.length - i - 1
        if (remainingModels > 0) {
          console.warn(`[OpenRouter] 🔁 Retrying with next model (${remainingModels} remaining)...`)
          continue
        }
      }

      // If it's a 429 error from an Error throw, continue to next model
      if (error instanceof Error && error.message.includes('rate limit')) {
        const remainingModels = fallbackModels.length - i - 1
        if (remainingModels > 0) {
          console.warn(`[OpenRouter] 🔴 Rate limit on "${attemptModel}". ${remainingModels} backup(s) remaining...`)
          continue
        }
      }

      // For other errors, rethrow
      throw error
    }
  }

  // If we exhaust all models, provide clear guidance
  console.error('[OpenRouter] ❌ All models unavailable or rate limited.')
  console.error('[OpenRouter] 💡 Suggestions:')
  console.error('   1. Wait a few minutes and try again')
  console.error('   2. Add credits to your OpenRouter account for better performance')
  console.error('   3. Try using a different AI provider (OpenAI, Gemini, etc.)')

  throw new Error('All OpenRouter models are rate limited. Please try again later or add credits to your account.')
}

// ============================================
// MODELS & TESTING
// ============================================

async function fetchAvailableModels(provider: string, apiKey: string): Promise<any[]> {
  try {
    if (provider === 'openai') {
      const response = await fetch(`${AI_PROVIDERS.openai.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      })
      if (!response.ok) throw new Error(`Failed to fetch models: ${response.status}`)
      const data = await response.json()
      return data.data
        .filter((m: any) => m.id.startsWith('gpt-') && !m.id.includes('vision') && !m.id.includes('image'))
        .map((m: any) => ({ id: m.id, name: m.id }))
        .sort((a: any, b: any) => a.id.localeCompare(b.id))
    } else if (provider === 'openrouter') {
      // 🎯 Use DEFAULT_MODELS for OpenRouter to ensure correct priority order
      // The list is ordered by reliability (arcee-ai/trinity-large-preview:free is the only working model as of 2026-03-11)
      // Fetching from API would return models in random order, causing wrong model selection
      return DEFAULT_MODELS.openrouter
    }
    // For other providers, use default lists
    return DEFAULT_MODELS[provider as keyof typeof DEFAULT_MODELS] || []
  } catch (error) {
    console.error(`Failed to fetch models for ${provider}:`, error)
    return DEFAULT_MODELS[provider as keyof typeof DEFAULT_MODELS] || []
  }
}

async function testAPIConnection(provider: string, apiKey: string, model?: string): Promise<{ success: boolean; message: string }> {
  const testPrompt = 'Say "API test successful" in JSON format like {"status":"ok"}'

  try {
    let content: string | null = null

    if (provider === 'openai') {
      const response = await fetch(`${AI_PROVIDERS.openai.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: testPrompt }],
          max_tokens: 50,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        return { success: false, message: `OpenAI API Error: ${error.error?.message || response.statusText}` }
      }

      const data = await response.json()
      content = data.choices?.[0]?.message?.content
    } else if (provider === 'gemini') {
      const modelId = model || 'gemini-2.5-flash'
      const response = await fetch(
        `${AI_PROVIDERS.gemini.baseUrl}/models/${modelId}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: testPrompt }] }],
            generationConfig: { maxOutputTokens: 50 },
          }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        return { success: false, message: `Gemini API Error: ${error.error?.message || response.statusText}` }
      }

      const data = await response.json()
      content = data.candidates?.[0]?.content?.parts?.[0]?.text
    } else if (provider === 'zhipu') {
      const response = await fetch(`${AI_PROVIDERS.zhipu.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || 'glm-4-flash',
          messages: [{ role: 'user', content: testPrompt }],
          max_tokens: 50,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        return { success: false, message: `Zhipu AI Error: ${error.error?.message || response.statusText}` }
      }

      const data = await response.json()
      content = data.choices?.[0]?.message?.content
    } else if (provider === 'openrouter') {
      const response = await fetch(`${AI_PROVIDERS.openrouter.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': chrome.runtime.getURL(''),
          'X-OpenRouter-Title': 'Applied AI Assistant',
        },
        body: JSON.stringify({
          model: model || 'nvidia/nemotron-3-nano-30b-a3b:free', // 🚀 Fastest working model
          messages: [{ role: 'user', content: testPrompt }],
          max_tokens: 50,
        }),
      })

      if (!response.ok) {
        let errorMessage = `OpenRouter API Error (${response.status})`
        try {
          const errorData = await response.json()
          const errorDetail = errorData.error?.message || errorData.message || errorData.error || response.statusText
          errorMessage += `: ${errorDetail}`
          console.error('[OpenRouter] API Error Details:', errorData)
        } catch (e) {
          errorMessage += `: ${response.statusText}`
          const errorText = await response.text()
          console.error('[OpenRouter] Non-JSON Error Response:', errorText)
        }
        return { success: false, message: errorMessage }
      }

      const data = await response.json()
      content = data.choices?.[0]?.message?.content
    }

    if (content) {
      return { success: true, message: `✓ API test successful! Model responded: "${content.substring(0, 50)}..."` }
    }
    return { success: false, message: 'API returned empty response' }
  } catch (error) {
    return { success: false, message: `Connection failed: ${error instanceof Error ? error.message : String(error)}` }
  }
}

// ============================================
// CV PARSING
// ============================================

/**
 * Clean and fix malformed JSON from AI responses
 * Handles common issues like trailing commas, comments, unquoted keys, etc.
 */
function cleanMalformedJson(jsonString: string): string {
  let cleaned = jsonString

  // Remove single-line comments (// ...)
  cleaned = cleaned.replace(/\/\/.*$/gm, '')

  // Remove multi-line comments (/* ... */)
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '')

  // Remove trailing commas (before } or ])
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1')

  // Fix unquoted property names by wrapping them in quotes
  // This regex finds word characters followed by colon that aren't already quoted
  cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3')

  // Fix single-quoted strings to double-quoted
  cleaned = cleaned.replace(/'([^']*)'/g, '"$1"')

  // Fix undefined or null values in objects
  cleaned = cleaned.replace(/:\s*undefined/g, ': null')
  cleaned = cleaned.replace(/:\s*None/g, ': null')

  // ⚠️ DISABLED: Control character removal - was breaking JSON!
  // cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '')

  // ⚠️ DISABLED: Aggressive comma fixing - was breaking JSON!
  // cleaned = cleaned.replace(/"(\s+)"(?=[^"]+":)/g, '", "$1')
  // cleaned = cleaned.replace(/\}\s+"(?=[{"])/g, '}, "')
  // cleaned = cleaned.replace(/"(\s+)\{/g, '", $1{')

  return cleaned
}

/**
 * Clean and validate URLs from AI response
 * Converts invalid URLs to empty strings
 */
function cleanUrl(url: any): string {
  if (!url || typeof url !== 'string') return ''

  const trimmed = url.trim()

  // Empty string
  if (trimmed === '') return ''

  // Already a valid URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      new URL(trimmed)
      return trimmed
    } catch {
      return ''
    }
  }

  // Try to fix common URL patterns
  // If it looks like a domain, add https://
  if (trimmed.includes('.') && !trimmed.includes(' ')) {
    try {
      const fixedUrl = trimmed.startsWith('www.') ? `https://${trimmed}` : `https://${trimmed}`
      new URL(fixedUrl)
      return fixedUrl
    } catch {
      return ''
    }
  }

  // Invalid URL (e.g., "GitHub", "Available on request", etc.)
  return ''
}

export async function parseCVWithAI(cvText: string, provider: string, apiKey: string, model?: string): Promise<ParsedCV | null> {
  const parseId = `parse_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  console.log(`[CV Parsing][${parseId}] Starting...`, { provider, model, cvTextLength: cvText.length })

  // 🎯 Throttle requests to prevent rate limiting
  const timeSinceLastRequest = Date.now() - lastParseRequestTime
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
    const waitTime = MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest
    console.log(`[CV Parsing][${parseId}] ⏳ Rate limit protection: waiting ${waitTime}ms...`)
    await new Promise(resolve => setTimeout(resolve, waitTime))
  }
  lastParseRequestTime = Date.now()

  const prompt = `Extract to JSON.

CV:
${cvText}

{
  "personal": {"f":"","l":"","e":"","p":"","city":"","c":""},
  "pro": {"title":"","sum":"","yoe":0},
  "skills": {"tech":[],"soft":[],"tools":[]},
  "exp": [{"id":"","r":"","c":"","s":"","e":"","current":false,"high":[],"sk":[]}],
  "proj": [{"id":"","n":"","d":"","tech":[],"url":"","high":[]}],
  "edu": [{"id":"","deg":"","sch":"","f":"","y":""}]
}

Dates: "Jan 2020". YOE: number. JSON only.`

  let content: string | null = null
  let jsonString: string = ''

  try {
    switch (provider) {
      case 'openai':
        content = await callOpenAI(apiKey, prompt, model || 'gpt-4o-mini')
        break
      case 'gemini':
        content = await callGemini(apiKey, prompt, model || 'gemini-2.5-flash')
        break
      case 'zhipu':
        content = await callZhipu(apiKey, prompt, model || 'glm-4')
        break
      case 'openrouter':
        {
          // 🎯 Auto-replace broken models with working ones (as of 2026-03-11)
          const modelMapping: Record<string, string> = {
            'google/gemma-3-12b-it:free': 'nvidia/nemotron-3-nano-30b-a3b:free', // Returns 400 error
            // Note: liquid/lfm-2.5, z-ai/glm-4.5-air, and openrouter/free are all working
          }
          const safeModel = (model && modelMapping[model]) || model || 'nvidia/nemotron-3-nano-30b-a3b:free' // 🚀 Fastest

          if (model && model !== safeModel) {
            console.warn(`[CV Parser] 🔄 Auto-replaced broken model "${model}" with "${safeModel}"`)
          }

          const result = await callOpenRouterWithFallback(apiKey, prompt, safeModel)
          content = result.content

          // Show which model was used and if fallback occurred
          if (result.fallbackUsed) {
            console.warn(`[CV Parser] ⚠️ Using backup model: ${result.modelUsed}`)
            console.warn(`[CV Parser] 💡 Tip: Primary model is rate-limited. Consider adding credits to your OpenRouter account for better performance.`)
          } else {
            console.log(`[CV Parser] ✅ Using primary model: ${result.modelUsed}`)
          }
        }
        break
      default:
        throw new Error('Unknown provider')
    }

    if (!content) {
      console.error('[CV Parsing] No content received from model')
      console.error('[CV Parsing] Provider:', provider, '| Model:', model || 'default')
      console.error('[CV Parsing] This usually indicates rate limiting or API error. Try a different model.')
      return null
    }

    // 🎯 Try multiple JSON extraction patterns (from constants)
    let jsonMatch: RegExpMatchArray | null = null
    for (const pattern of CV_PARSING.JSON_PATTERNS) {
      jsonMatch = content.match(pattern)
      if (jsonMatch) {
        const patternIndex = CV_PARSING.JSON_PATTERNS.indexOf(pattern) + 1
        console.log(`[CV Parsing][${parseId}] ✓ JSON matched with pattern ${patternIndex}`)
        console.log(`[CV Parsing][${parseId}] jsonMatch[0] length:`, jsonMatch[0]?.length)
        console.log(`[CV Parsing][${parseId}] jsonMatch[1] exists:`, !!jsonMatch[1])
        break
      }
    }

    if (!jsonMatch) {
      console.error(`[CV Parsing][${parseId}] No JSON found in response`)
      console.error(`[CV Parsing][${parseId}] AI Response length:`, content.length)
      console.error(`[CV Parsing][${parseId}] AI Response (first 500 chars):`, content.substring(0, 500))
      return null
    }

    // 🎯 Assign to outer scope variable (no 'let' keyword!)
    jsonString = jsonMatch[1] || jsonMatch[0]

    console.log(`[CV Parsing][${parseId}] jsonString length BEFORE clean:`, jsonString?.length)
    console.log(`[CV Parsing][${parseId}] jsonString preview (first 200 chars):`, jsonString?.substring(0, 200))

    // 🎯 Clean malformed JSON from AI (trailing commas, comments, unquoted keys, etc.)
    try {
      jsonString = cleanMalformedJson(jsonString)
      console.log(`[CV Parsing][${parseId}] jsonString length AFTER clean:`, jsonString?.length)
    } catch (e) {
      console.warn(`[CV Parsing][${parseId}] Failed to clean JSON, using original`)
    }

    // 🎯 Validate JSON length
    if (jsonString.length < CV_PARSING.MIN_JSON_LENGTH) {
      console.error(`[CV Parsing][${parseId}] Extracted JSON too short: ${jsonString.length} chars`)
      return null
    }

    // 🎯 Check for truncation (unbalanced braces/brackets)
    const openBraces = (jsonString.match(/\{/g) || []).length
    const closeBraces = (jsonString.match(/\}/g) || []).length
    const openBrackets = (jsonString.match(/\[/g) || []).length
    const closeBrackets = (jsonString.match(/\]/g) || []).length

    if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
      console.warn(`[CV Parsing][${parseId}] ⚠️ JSON appears truncated:`)
      console.warn(`  - Braces: ${openBraces} open, ${closeBraces} close`)
      console.warn(`  - Brackets: ${openBrackets} open, ${closeBrackets} close`)

      // Try to fix by adding missing closing braces/brackets
      const trimmedJson = jsonString.trim()
      if (!trimmedJson.endsWith('}')) {
        console.warn(`[CV Parsing][${parseId}] Attempting to fix truncated JSON...`)
        if (openBrackets > closeBrackets) jsonString += ']'.repeat(openBrackets - closeBrackets)
        if (openBraces > closeBraces) jsonString += '}'.repeat(openBraces - closeBraces)
        console.log(`[CV Parsing][${parseId}] Fixed JSON length: ${jsonString.length}`)
      }
    }

    const parsed = JSON.parse(jsonString)
    console.log('[CV Parsing] Parsed CV:', parsed)

    // 🎯 Map abbreviated field names to full field names (for token-optimized prompts)
    const mappedData: any = {
      personal: {
        firstName: parsed.personal?.f || '',
        lastName: parsed.personal?.l || '',
        email: parsed.personal?.e || '',
        phone: parsed.personal?.p || '',
        city: parsed.personal?.city || '',
        country: parsed.personal?.c || '',
        linkedIn: parsed.personal?.linkedIn || '',
        portfolio: parsed.personal?.portfolio || '',
        github: parsed.personal?.github || '',
      },
      professional: {
        title: parsed.pro?.title || '',
        summary: parsed.pro?.sum || '',
        yearsOfExperience: parsed.pro?.yoe || 0,
      },
      skills: {
        technical: parsed.skills?.tech || [],
        soft: parsed.skills?.soft || [],
        tools: parsed.skills?.tools || [],
        languages: parsed.skills?.languages || [],
      },
      experience: parsed.exp || [],
      projects: parsed.proj || [],
      education: parsed.edu || [],
    }

    // 🎯 Clean URLs in projects before validation
    if (mappedData.projects && Array.isArray(mappedData.projects)) {
      mappedData.projects = mappedData.projects.map((project: any) => ({
        ...project,
        url: cleanUrl(project.url)
      }))
    }

    // 🎯 Clean LinkedIn and portfolio URLs in personal info
    if (mappedData.personal) {
      if (mappedData.personal.linkedIn) {
        mappedData.personal.linkedIn = cleanUrl(mappedData.personal.linkedIn)
      }
      if (mappedData.personal.portfolio) {
        mappedData.personal.portfolio = cleanUrl(mappedData.personal.portfolio)
      }
    }

    const validatedData = ParsedCVSchema.parse({
      ...mappedData,
      rawText: cvText,
      parsedAt: Date.now()
    })

    console.log('[CV Parsing] Success!')
    return validatedData
  } catch (error) {
    console.error(`[CV Parsing][${parseId}] Failed:`, error)
    if (error instanceof z.ZodError) {
      error.issues.forEach((err: any) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`)
      })
    } else if (error instanceof SyntaxError) {
      // Log the JSON that failed to parse for debugging
      console.error(`[CV Parsing][${parseId}] Raw AI Response length:`, content?.length)
      console.error(`[CV Parsing][${parseId}] Raw AI Response (first 1000 chars):`, content?.substring(0, 1000))
      console.error(`[CV Parsing][${parseId}] Extracted JSON length:`, jsonString?.length)
      console.error(`[CV Parsing][${parseId}] Extracted JSON (first 500 chars):`, jsonString?.substring(0, 500))
    }
    return null
  }
}

// ============================================
// ROLE-BASED CV
// ============================================

export function generateRoleBasedCV(parsedCV: ParsedCV, roleId: string): ParsedCV {
  const template = DEFAULT_ROLE_TEMPLATES[roleId] || DEFAULT_ROLE_TEMPLATES.fullstack
  const roleCV: ParsedCV = JSON.parse(JSON.stringify(parsedCV))

  const allSkills = [...roleCV.skills.technical, ...roleCV.skills.tools]
  roleCV.skills.technical = allSkills
    .sort((a, b) => {
      const aEmphasis = template.emphasize.some(e => a.toLowerCase().includes(e.toLowerCase())) ? 1 : 0
      const bEmphasis = template.emphasize.some(e => b.toLowerCase().includes(e.toLowerCase())) ? 1 : 0
      return bEmphasis - aEmphasis
    })
    .filter(s => !template.deEmphasize.some(d => s.toLowerCase().includes(d.toLowerCase())))

  roleCV.experience = roleCV.experience.sort((a, b) => {
    const aRelevance = a.skills.some(s => template.emphasize.some(e => s.toLowerCase().includes(e.toLowerCase()))) ? 1 : 0
    const bRelevance = b.skills.some(s => template.emphasize.some(e => s.toLowerCase().includes(e.toLowerCase()))) ? 1 : 0
    return bRelevance - aRelevance
  })

  roleCV.projects = roleCV.projects.sort((a, b) => {
    const aRelevance = a.technologies.some(t => template.emphasize.some(e => t.toLowerCase().includes(e.toLowerCase()))) ? 1 : 0
    const bRelevance = b.technologies.some(t => template.emphasize.some(e => t.toLowerCase().includes(e.toLowerCase()))) ? 1 : 0
    return bRelevance - aRelevance
  })

  return roleCV
}

// ============================================
// COVER LETTER GENERATION
// ============================================
// AI FIELD MAPPING
// ============================================

/**
 * 🧠 AI-Powered Field Mapping
 *
 * Analyzes extracted fields and maps CV data to them intelligently
 * No hardcoded patterns - AI figures everything out!
 *
 * @param rawFields - Raw field data from DOM (minimal format)
 * @param cvData - Parsed CV data
 * @returns Field mappings with values to fill
 */
export interface FieldMapping {
  fieldId: string
  fieldName: string
  detectedAs: string
  valueToFill: string
  confidence: 'high' | 'medium' | 'low'
  reasoning?: string
}

export async function mapFieldsWithAI(
  rawFields: Array<{ i: string; n: string; t: string; l: string; p: string; o?: string[] }>,
  cvData: any
): Promise<FieldMapping[]> {
  try {
    console.log('[Field Mapping] Starting AI field mapping...')
    console.log('[Field Mapping] Raw fields:', rawFields.length)
    console.log('[Field Mapping] CV data keys:', Object.keys(cvData))

    const provider = await getActiveProvider()
    if (!provider) {
      console.warn('[Field Mapping] No AI provider available')
      return []
    }

    console.log('[Field Mapping] Using provider:', provider.provider, 'model:', provider.model)

    // Enhance CV data with parsed phone information
    const enhancedCV = enhanceCVDataWithPhoneInfo(cvData)

    // Build comprehensive but token-efficient data object
    const latestExp = enhancedCV.experience?.[0] || {}
    const latestEdu = enhancedCV.education?.[0] || {}
    const allSkills = enhancedCV.skills?.technical || []  // All skills for intelligent matching
    const topProjects = (enhancedCV.projects || []).slice(0, 3).map((p: any) => p.name)

    // Tool definition for dynamic data fetching
    const getCVFieldTool = {
      type: "function",
      function: {
        name: "get_cv_field",
        description: "Get additional CV data not in static dataset. Returns field value or empty string if not found.",
        parameters: {
          type: "object",
          properties: {
            field: {
              type: "string",
              description: "Field name to fetch",
              enum: [
                "linkedin", "github", "portfolio", "website",
                "education", "degree", "school", "graduationYear", "fieldOfStudy",
                "experience", "company", "role", "startDate", "endDate",
                "projects", "projectNames", "technologies",
                "availability", "startDate", "noticePeriod",
                "salary", "expectedSalary", "currentSalary",
                "languages", "certifications", "achievements"
              ]
            }
          },
          required: ["field"]
        }
      }
    }

    // Tool handler function
    const handleToolCall = (toolName: string, args: any): string => {
      console.log('[handleToolCall] Tool called:', toolName, 'with args:', args)

      if (toolName === 'get_cv_field') {
        const field = args.field
        let result: string = ''

        switch (field) {
          case 'linkedin': result = enhancedCV.personal?.linkedIn || ''; break
          case 'github': result = enhancedCV.personal?.github || ''; break
          case 'portfolio': result = enhancedCV.personal?.portfolio || ''; break
          case 'website': result = enhancedCV.personal?.website || ''; break
          case 'education': result = JSON.stringify(enhancedCV.education || []); break
          case 'degree': result = latestEdu.degree || ''; break
          case 'school': result = latestEdu.school || ''; break
          case 'graduationYear': result = latestEdu.graduationYear || ''; break
          case 'fieldOfStudy': result = latestEdu.field || ''; break
          case 'experience': result = JSON.stringify(enhancedCV.experience || []); break
          case 'company': result = latestExp.company || ''; break
          case 'role': result = latestExp.role || ''; break
          case 'startDate': result = latestExp.startDate || ''; break
          case 'endDate': result = latestExp.endDate || ''; break
          case 'projects': result = JSON.stringify(enhancedCV.projects || []); break
          case 'projectNames': result = topProjects.join(', '); break
          case 'technologies': result = allSkills.join(', '); break
          default: result = ''; break
        }

        console.log('[handleToolCall] Field:', field, '→ Result:', result ? result.substring(0, 50) : '(empty)')
        return result
      }

      console.warn('[handleToolCall] Unknown tool:', toolName)
      return ''
    }

    // Stage 1: Prompt with comprehensive static data + tools (token-optimized)
    const prompt = `Match fields to CV.

F:${JSON.stringify(rawFields)}
D:{
  "n":"${enhancedCV.personal?.firstName||''} ${enhancedCV.personal?.lastName||''}",
  "fn":"${enhancedCV.personal?.firstName||''}",
  "ln":"${enhancedCV.personal?.lastName||''}",
  "e":"${enhancedCV.personal?.email||''}",
  "p":"${enhancedCV.personal?.phone||''}",
  "g":"${enhancedCV.personal?.gender||'prefer_not_to_say'}",
  "city":"${enhancedCV.personal?.city||''}",
  "state":"${enhancedCV.personal?.state||''}",
  "country":"${enhancedCV.personal?.country||''}",
  "t":"${enhancedCV.professional?.currentTitle||''}",
  "sum":"${enhancedCV.professional?.summary?.substring(0,120)||''}",
  "yoe":"${enhancedCV.professional?.yearsOfExperience||0}",
  "sk":"${allSkills.join(', ')}",
  "role":"${latestExp.role||''}",
  "comp":"${latestExp.company||''}",
  "deg":"${latestEdu.degree||''}",
  "sch":"${latestEdu.school||''}",
  "proj":"${topProjects.join(', ')}"
}

R:[{"i":"fieldId","d":"detectedAs","v":"val"}]
Map:Use data above. Use get_cv_field tool for missing(li,github,portfolio,etc).
Pat:*name*→fn/ln,*email*→e,*phone*→p,*title*→t,*skill*→sk,*addr*→city,*msg*→sum. Empty if unknown.`

    console.log('[Field Mapping] Prepared hybrid approach with tools')
    console.log('[Field Mapping] Tool available: get_cv_field')
    console.log('[Field Mapping] Starting AI call with tool support...')

    // Call AI with tools (hybrid approach)
    const startTime = Date.now()
    let response = await callAIWithTools(provider, prompt, [getCVFieldTool], handleToolCall)
    const elapsed = Date.now() - startTime

    console.log('[Field Mapping] Total AI call completed in', elapsed, 'ms')
    console.log('[Field Mapping] AI response received, type:', typeof response)
    console.log('[Field Mapping] AI response preview:', response?.substring?.(0, 200) || response)

    // Parse response
    let mappings: FieldMapping[] = []

    try {
      // Try to parse as JSON
      if (typeof response === 'string') {
        // Remove markdown code blocks if present
        const jsonMatch = response.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/) || response.match(/(\[[\s\S]*\])/)
        if (jsonMatch) {
          mappings = JSON.parse(jsonMatch[1] || jsonMatch[0])
        } else {
          mappings = JSON.parse(response)
        }
      } else if (response.mappings) {
        mappings = response.mappings
      }
    } catch (error) {
      console.error('[Field Mapping] Failed to parse AI response:', error)
    }

    console.log('[Field Mapping] AI returned', mappings.length, 'field mappings')
    console.log('[Field Mapping] Mappings:', mappings)
    return mappings
  } catch (error) {
    console.error('[Field Mapping] Failed:', error)
    console.error('[Field Mapping] Error details:', error instanceof Error ? error.message : String(error))
    return []
  }
}

// ============================================

async function generateProfessionalCoverLetter(parsedCV: ParsedCV): Promise<string> {
  try {
    const provider = await getActiveProvider()
    if (!provider) {
      // Fallback to professional summary if no AI available
      return parsedCV.professional.summary
    }

    const prompt = `Write 250-350 word cover letter.

Name: ${parsedCV.personal.firstName} ${parsedCV.personal.lastName}
Title: ${parsedCV.professional.currentTitle} (${parsedCV.professional.yearsOfExperience}y)
Skills: ${parsedCV.skills.technical.slice(0, 8).join(', ')}

Recent: ${parsedCV.experience.slice(0, 2).map(e => `${e.role}@${e.company}`).join(' | ')}

Start: "Dear Hiring Manager," - End: "Sincerely,". No markdown.`

    const response = await callAI(provider, prompt)
    return response.coverLetter || response.letter || response.text || parsedCV.professional.summary
  } catch (error) {
    console.error('[Cover Letter Generation] Failed:', error)
    return parsedCV.professional.summary
  }
}

// ============================================
// UTILITIES
// ============================================

async function getActiveTabId(): Promise<number | undefined> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  return tabs[0]?.id
}

async function scanJobDescription(): Promise<any> {
  try {
    const tabId = await getActiveTabId()
    if (!tabId) return { success: false, error: 'No active tab' }
    return await chrome.tabs.sendMessage(tabId, { action: 'scanJobDescription' })
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

async function detectFormFields(): Promise<any> {
  try {
    const tabId = await getActiveTabId()
    if (!tabId) return { success: false, error: 'No active tab' }
    return await chrome.tabs.sendMessage(tabId, { action: 'detectFields' })
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

// ============================================
// INSTALLATION
// ============================================

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Background] Extension installed/updated')
  chrome.storage.local.set({
    [STORAGE_KEYS.SETTINGS]: {
      autoFill: false,
      aiEnhancement: true,
      confirmBeforeFill: true,
    },
  })
})

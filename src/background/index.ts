import { z } from 'zod'

// CV Workflow Setup
import { setupCVWorkflowListener } from '../utils/cvWorkflow'

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
  skills: z.record(z.string(), z.array(z.string())), // Dynamic categories: { "Frontend": [...], "Backend": [...] }
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
  skills: Record<string, string[]> // Dynamic categories: { "Frontend": [...], "Backend": [...] }
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

// 🎯 Browser parsing confidence threshold
// ⚠️ INCREASED to 90% to ensure high-quality data before using browser parsing
// Browser parsing is free but can be inaccurate - only use it when VERY confident
const BROWSER_PARSING_CONFIDENCE_THRESHOLD = 90

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
    openrouter: 32768,  // Increased for CV parsing and reasoning models
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
    name: 'Zhipu AI (BigModel)',
    key: STORAGE_KEYS.API_KEY_ZHIPU,
    baseUrl: 'https://api.z.ai/api/anthropic/v1',
    defaultModel: 'glm-4.7',
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
    { id: 'glm-4.7', name: 'GLM-4.7' },
    { id: 'glm-4.6', name: 'GLM-4.6' },
    { id: 'glm-4.5', name: 'GLM-4.5' },
    { id: 'glm-4.5-air', name: 'GLM-4.5 Air' },
  ],
  openrouter: [
    { id: 'nvidia/nemotron-3-nano-30b-a3b:free', name: 'NVIDIA Nemotron 30B (Free)' }, // 🚀 FASTEST (620ms)
    { id: 'arcee-ai/trinity-large-preview:free', name: 'Arcee Trinity Large (Free)' }, // ✅ Excellent (1135ms)
    { id: 'liquid/lfm-2.5-1.2b-instruct:free', name: 'LFM 2.5 Instruct (Free)' }, // ✅ Good quality (1161ms)
    // REMOVED: 'openrouter/free' - NOT a valid model ID for API calls
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
    chrome.storage.local.get([STORAGE_KEYS.SETTINGS, STORAGE_KEYS.API_KEY_OPENAI, STORAGE_KEYS.API_KEY_GEMINI, STORAGE_KEYS.API_KEY_ZHIPU, STORAGE_KEYS.API_KEY_OPENROUTER]).then(result => {
      const settings = result[STORAGE_KEYS.SETTINGS] || {}
      sendResponse({
        settings: {
          ...settings,
          apiKeyOpenAI: result[STORAGE_KEYS.API_KEY_OPENAI] || '',
          apiKeyGemini: result[STORAGE_KEYS.API_KEY_GEMINI] || '',
          apiKeyZhipu: result[STORAGE_KEYS.API_KEY_ZHIPU] || '',
          apiKeyOpenRouter: result[STORAGE_KEYS.API_KEY_OPENROUTER] || '',
        },
        hasApiKey: !!(result[STORAGE_KEYS.API_KEY_OPENAI] || result[STORAGE_KEYS.API_KEY_GEMINI] || result[STORAGE_KEYS.API_KEY_ZHIPU] || result[STORAGE_KEYS.API_KEY_OPENROUTER]),
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
        providers.push({ id: 'zhipu', name: 'Zhipu AI', model: 'glm-4.7', modelName: 'GLM-4.7' })
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

  // Parse CV - Smart: Browser first, AI fallback (or force AI)
  if (request.action === 'parseCV') {
    const { cvText, provider, apiKey, model, forceAI = false } = request
    const parseId = `smart_parse_${Date.now()}`

    console.log(`[Smart CV Parser][${parseId}] Starting...`, {
      cvLength: cvText.length,
      forceAI,
      provider
    })

    // 🎯 If user wants to force AI, skip browser parsing
    if (forceAI) {
      console.log(`[Smart CV Parser][${parseId}] 🤖 Forced AI mode - skipping browser parsing`)
      parseCVWithAI(cvText, provider, apiKey, model)
        .then(parsedCV => {
          if (parsedCV) {
            console.log(`[Smart CV Parser][${parseId}] ✅ AI parsing successful!`)
            chrome.storage.local.set({ [STORAGE_KEYS.PARSED_CV]: parsedCV }).then(() => {
              sendResponse({
                success: true,
                data: parsedCV,
                meta: {
                  method: 'ai',
                  confidence: 95,
                  cost: 0.0004,
                  forced: true
                }
              })
            })
          } else {
            sendResponse({
              success: false,
              error: 'AI parsing failed'
            })
          }
        })
        .catch(error => sendResponse({ success: false, error: error.message }))
      return true
    }

    // 🎯 Step 1: Try browser parsing (FREE!)
    console.log(`[Smart CV Parser][${parseId}] Step 1: Browser parsing (FREE!)`)
    const browserResult = parseCVWithBrowser(cvText)

    console.log(`[Smart CV Parser][${parseId}] Browser result:`, {
      confidence: browserResult.confidence,
      threshold: BROWSER_PARSING_CONFIDENCE_THRESHOLD,
      fields: {
        name: `${browserResult.personal.firstName || ''} ${browserResult.personal.lastName || ''}`.trim() || 'MISSING',
        email: browserResult.personal.email || 'MISSING',
        phone: browserResult.personal.phone || 'MISSING',
        experience: browserResult.experience.length,
        education: browserResult.education.length,
        skills: browserResult.skills._raw?.length || 0
      }
    })

    // 🎯 Step 2: Check if confidence is good enough
    console.log(`🔍 [DEBUG] Smart Parser - Browser result skills:`, JSON.stringify(browserResult.skills, null, 2))

    if (browserResult.confidence >= BROWSER_PARSING_CONFIDENCE_THRESHOLD) {
      console.log(`[Smart CV Parser][${parseId}] ✅ Browser parsing successful! (${browserResult.confidence}% >= ${BROWSER_PARSING_CONFIDENCE_THRESHOLD}%)`)
      console.log(`[Smart CV Parser][${parseId}] 💰 Cost: $0.00 (FREE!)`)

      // Convert browser result to ParsedCV format
      const parsedCV: ParsedCV = {
        personal: {
          firstName: browserResult.personal.firstName || '',
          lastName: browserResult.personal.lastName || '',
          email: browserResult.personal.email || '',
          phone: browserResult.personal.phone || '',
          gender: 'prefer_not_to_say',
          linkedIn: browserResult.personal.linkedIn,
          portfolio: browserResult.personal.portfolio
        },
        professional: {
          currentTitle: 'Software Developer', // Default if not found
          summary: `Extracted with ${browserResult.confidence}% confidence using browser-based parsing.`,
          yearsOfExperience: browserResult.experience.length > 0 ? browserResult.experience.length : 0
        },
        skills: browserResult.skills || {}, // Dynamic categories from browser parser
        experience: browserResult.experience,
        projects: browserResult.projects,
        education: browserResult.education,
        rawText: cvText,
        parsedAt: Date.now()
      }

      console.log(`✅ [DEBUG] Browser Parser - Final ParsedCV skills:`, JSON.stringify(parsedCV.skills, null, 2))

      // Save and return
      chrome.storage.local.set({ [STORAGE_KEYS.PARSED_CV]: parsedCV }).then(() => {
        sendResponse({
          success: true,
          data: parsedCV,
          meta: {
            method: 'browser',
            confidence: browserResult.confidence,
            cost: 0
          }
        })
      }).catch(error => sendResponse({ success: false, error: error.message }))

      return true
    }

    // 🎯 Step 3: Browser confidence too low - Try Hybrid Parser first!
    console.log(`[Smart CV Parser][${parseId}] ⚠️ Browser confidence too low (${browserResult.confidence}% < ${BROWSER_PARSING_CONFIDENCE_THRESHOLD}%)`)
    console.log(`[Smart CV Parser][${parseId}] 🤖 Step 3: Trying Hybrid Parser (Regex + Chunked AI)...`)

    parseCVWithHybrid(cvText, provider, apiKey, model)
      .then(hybridResult => {
        if (hybridResult.data) {
          console.log(`[Smart CV Parser][${parseId}] ✅ Hybrid parsing successful!`)
          console.log(`[Smart CV Parser][${parseId}] 💰 Cost: $${hybridResult.totalCost.toFixed(6)} (${hybridResult.totalTokens} tokens)`)

          // Preserve languages from browser parser if hybrid didn't find any
          if (browserResult.skills.languages && browserResult.skills.languages.length > 0) {
            if (!hybridResult.data.skills.languages || hybridResult.data.skills.languages.length === 0) {
              hybridResult.data.skills.languages = browserResult.skills.languages
              console.log(`[Smart CV Parser][${parseId}] 📝 Preserved languages from browser parser:`, browserResult.skills.languages)
            }
          }

          chrome.storage.local.set({ [STORAGE_KEYS.PARSED_CV]: hybridResult.data }).then(() => {
            sendResponse({
              success: true,
              data: hybridResult.data,
              meta: {
                method: 'hybrid',
                confidence: 90,
                cost: hybridResult.totalCost,
                tokens: hybridResult.totalTokens,
                breakdown: hybridResult.tokenUsage
              }
            })
          })
        } else {
          // Hybrid failed - Fall back to full AI
          console.log(`[Smart CV Parser][${parseId}] ⚠️ Hybrid parsing failed, falling back to Full AI...`)

          return parseCVWithAI(cvText, provider, apiKey, model)
        }
      })
      .then(parsedCV => {
        // This handles the full AI fallback
        if (parsedCV) {
          console.log(`[Smart CV Parser][${parseId}] ✅ Full AI parsing successful!`)
          console.log(`[Smart CV Parser][${parseId}] 💰 Cost: ~$0.0004`)

          // Preserve languages from browser parser if AI didn't find any
          if (browserResult.skills.languages && browserResult.skills.languages.length > 0) {
            if (!parsedCV.skills.languages || parsedCV.skills.languages.length === 0) {
              parsedCV.skills.languages = browserResult.skills.languages
              console.log(`[Smart CV Parser][${parseId}] 📝 Preserved languages from browser parser:`, browserResult.skills.languages)
            }
          }

          chrome.storage.local.set({ [STORAGE_KEYS.PARSED_CV]: parsedCV }).then(() => {
            sendResponse({
              success: true,
              data: parsedCV,
              meta: {
                method: 'ai-full',
                confidence: 95,
                cost: 0.0004
              }
            })
          })
        }
        // If parsedCV is null, hybrid succeeded and we already sent response
      })
      .catch(error => {
        console.error(`[Smart CV Parser][${parseId}] ❌ All parsing methods failed!`)
        console.error(`[Smart CV Parser][${parseId}] Error:`, error.message)
        sendResponse({
          success: false,
          error: 'Browser, Hybrid, and AI parsing all failed'
        })
      })

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

  // AI requests for smart form handling
  if (request.action === 'getSettings') {
    chrome.storage.local.get(STORAGE_KEYS.SETTINGS, (result) => {
      sendResponse(result[STORAGE_KEYS.SETTINGS] || {
        autoFill: false,
        aiEnhancement: true,
        confirmBeforeFill: true,
      })
    })
    return true
  }

  if (request.action === 'askAI') {
    handleAskAI(request, sendResponse)
    return true
  }
})

async function handleAskAI(request: any, sendResponse: (response: any) => void) {
  try {
    const configResult = await chrome.storage.local.get(['settings', STORAGE_KEYS.PROVIDER_CONFIGS])
    const settings = configResult.settings || {}
    const activeProvider = settings.activeProvider || 'gemini'

    // Fallback to directly checking keys if provider_configs isn't set up yet
    const rawKeys = await chrome.storage.local.get([
      STORAGE_KEYS.API_KEY_OPENAI,
      STORAGE_KEYS.API_KEY_GEMINI,
      STORAGE_KEYS.API_KEY_ZHIPU,
      STORAGE_KEYS.API_KEY_OPENROUTER
    ])

    const configs = configResult[STORAGE_KEYS.PROVIDER_CONFIGS] || {}
    let apiKey = ''
    let modelName = ''

    if (configs[activeProvider]) {
      apiKey = configs[activeProvider].apiKey
      modelName = configs[activeProvider].model  // Use model ID, not display name
    } else {
      // Legacy fallback
      const providerKeyStr = AI_PROVIDERS[activeProvider]?.key || `${activeProvider}_api_key`
      apiKey = rawKeys[providerKeyStr]
      modelName = AI_PROVIDERS[activeProvider]?.defaultModel
    }

    if (!apiKey) {
      sendResponse({ success: false, error: 'No API key configured for ' + activeProvider })
      return
    }

    let result: string | null = null
    switch (activeProvider) {
      case 'openai':
        result = await callOpenAI(apiKey, request.prompt, modelName || 'gpt-4o-mini')
        break
      case 'gemini':
        result = await callGemini(apiKey, request.prompt, modelName || 'gemini-2.5-flash')
        break
      case 'openrouter':
        const orResult = await callOpenRouterWithFallback(apiKey, request.prompt, modelName)
        result = orResult.content
        break
      case 'zhipu':
        result = await callZhipu(apiKey, request.prompt, modelName || 'glm-4.5-air')
        break
    }

    if (!result) {
      sendResponse({ success: false, error: 'AI returned an empty response' })
      return
    }

    sendResponse({ success: true, data: result })
  } catch (error: any) {
    console.error('[askAI handler failed]', error)
    sendResponse({ success: false, error: error.message })
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
    STORAGE_KEYS.API_KEY_ZHIPU,
    STORAGE_KEYS.API_KEY_OPENROUTER
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
      model: 'glm-4.7',
      modelName: 'GLM-4.7'
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
  const response = await fetch(`${AI_PROVIDERS.zhipu.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model,
      max_tokens: CV_PARSING.MAX_TOKENS.zhipu,
      system: 'You are a helpful assistant that returns only valid JSON.',
      messages: [
        { role: 'user', content: prompt },
      ],
      ...(tools && tools.length > 0 ? { tools: tools, tool_choice: "auto" } : {})
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    if (response.status === 429) throw new Error('Zhipu rate limit exceeded')
    throw new Error(errorData.error?.message || `Zhipu API error: ${response.status}`)
  }

  const data = await response.json()
  return data.content?.[0]?.text || null
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
    'arcee-ai/trinity-large-preview:free',  // ✅ Good (1135ms) - EXCELLENT quality
    'liquid/lfm-2.5-1.2b-instruct:free',    // ✅ Good (1161ms) - GOOD quality
    'z-ai/glm-4.5-air:free',                // ✅ Working (9838ms) - EXCELLENT quality (slow!)
    // REMOVED: 'openrouter/free' - NOT a valid model ID, causes API error
    // REMOVED: 'google/gemma-3-4b-it:free' - Rate limited
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
      const response = await fetch(`${AI_PROVIDERS.zhipu.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: model || 'glm-4.7',
          max_tokens: 50,
          messages: [{ role: 'user', content: testPrompt }],
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        return { success: false, message: `Zhipu AI Error: ${error.error?.message || response.statusText}` }
      }

      const data = await response.json()
      content = data.content?.[0]?.text
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
      const messageObj = data.choices?.[0]?.message

      // Some formatting for OpenRouter specifically, handling reasoning models
      if (messageObj) {
        content = messageObj.content || messageObj.reasoning || (data.choices?.[0]?.finish_reason ? 'Model responded (checking max_tokens)' : null)
      }
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
 * Clean and fix malformed JSON from AI responses.
 * Uses a character-by-character approach to correctly sanitize control characters
 * only INSIDE string values (not in JSON structure).
 */
function cleanMalformedJson(jsonString: string): string {
  let cleaned = jsonString

  // Step 1: Remove trailing commas outside strings (before } or ])
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1')

  // Step 2: Fix undefined or null keyword values
  cleaned = cleaned.replace(/:\s*undefined/g, ': null')
  cleaned = cleaned.replace(/:\s*None/g, ': null')

  // Step 3: Sanitize literal control characters (newlines, tabs, etc.) INSIDE string values only.
  // We walk char-by-char to track when we're inside a JSON string.
  const result: string[] = []
  let inString = false
  let i = 0

  while (i < cleaned.length) {
    const ch = cleaned[i]

    if (inString) {
      if (ch === '\\') {
        // Escaped character - keep both chars as-is
        result.push(ch)
        i++
        if (i < cleaned.length) {
          result.push(cleaned[i])
          i++
        }
        continue
      } else if (ch === '"') {
        // End of string
        inString = false
        result.push(ch)
        i++
        continue
      } else {
        // Inside string: replace control chars with a space
        const code = ch.charCodeAt(0)
        if (code < 0x20 || (code >= 0x7F && code <= 0x9F)) {
          // Literal newline/tab/carriage return inside a string - replace with space
          result.push(' ')
          i++
          continue
        }
        result.push(ch)
        i++
        continue
      }
    } else {
      if (ch === '"') {
        inString = true
        result.push(ch)
        i++
        continue
      }
      result.push(ch)
      i++
    }
  }

  cleaned = result.join('')

  // Step 4: Remove backslash-single-quote (not valid JSON escape)
  cleaned = cleaned.replace(/\\'/g, "'")

  // Step 5: Remove trailing commas again in case the above steps revealed more
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1')

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

// ============================================
// BROWSER-BASED CV PARSING (FREE!)
// ============================================

interface BrowserParsedResult {
  personal: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    linkedIn?: string
    portfolio?: string
  }
  experience: Array<{
    id: string
    role: string
    company: string
    startDate: string
    endDate?: string
    current: boolean
    highlights: string[]
    skills: string[]
  }>
  education: Array<{
    id: string
    degree: string
    school: string
    field?: string
    graduationYear?: string
  }>
  skills: Record<string, string[]> // Dynamic categories
  projects: Array<{
    id: string
    name: string
    description: string
    technologies: string[]
    url?: string
    highlights: string[]
  }>
  confidence: number  // 0-100
  method: 'browser' | 'ai'
}

/**
 * Parse CV using browser-based regex patterns (FREE!)
 * Returns confidence score - if < 80%, use AI fallback
 */
export function parseCVWithBrowser(cvText: string): BrowserParsedResult {
  const result: BrowserParsedResult = {
    personal: {},
    experience: [],
    education: [],
    skills: {}, // Dynamic categories
    projects: [],
    confidence: 0,
    method: 'browser'
  }

  let score = 0
  const fieldsFound: string[] = []

  // ========== 1. Extract Name (VERY STRICT to avoid false positives) ==========
  const namePatterns = [
    /^([A-Z][A-Z\s]{3,})$/m,  // ALL CAPS name at start
    /^([A-Z][a-z]+\s+[A-Z][a-z]+)$/m,  // Title case name
    /Name:\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
  ]

  for (const pattern of namePatterns) {
    const match = cvText.match(pattern)
    if (match && match[1].length >= 3 && match[1].length <= 50) {
      // ⚠️ VALIDATION: Make sure it looks like a name (no numbers, special chars except spaces/hyphens)
      const nameStr = match[1].trim()
      if (!/[0-9@#$%^&*()_+=\[\]{}|\\:;<>,.?/~`]/.test(nameStr)) {
        const nameParts = nameStr.split(/\s+/)
        if (nameParts.length >= 2 && nameParts.length <= 4) {
          result.personal.firstName = nameParts[0]
          result.personal.lastName = nameParts.slice(1).join(' ')
          score += 20
          fieldsFound.push('name')
          break
        }
      }
    }
  }

  // ========== 2. Extract Email (STRICT validation) ==========
  const emailMatch = cvText.match(/[\w.+-]+@[\w-]+\.[\w.-]{2,}/)
  if (emailMatch) {
    // ⚠️ VALIDATION: Must be a reasonable email format
    const email = emailMatch[0]
    if (email.length > 5 && email.length < 100 && email.includes('@') && email.includes('.')) {
      // Exclude common false positives
      if (!email.includes('example') && !email.includes('test') && !email.includes('noreply')) {
        result.personal.email = email
        score += 20
        fieldsFound.push('email')
      }
    }
  }

  // ========== 3. Extract Phone ==========
  const phonePatterns = [
    /\+?[\d\s\-\(\)]{10,}/,
    /Phone:\s*([\d\s\-\+]+)/i,
    /Mobile:\s*([\d\s\-\+]+)/i,
    /Tel:\s*([\d\s\-\+]+)/i
  ]

  for (const pattern of phonePatterns) {
    const match = cvText.match(pattern)
    if (match) {
      result.personal.phone = (match[1] || match[0]).replace(/[\s\(\)]/g, '')
      score += 10
      fieldsFound.push('phone')
      break
    }
  }

  // ========== 4. Extract LinkedIn/Portfolio ==========
  const linkedinMatch = cvText.match(/linkedin\.com\/in\/[\w\-]+/i)
  if (linkedinMatch) {
    result.personal.linkedIn = linkedinMatch[0]
    score += 5
    fieldsFound.push('linkedin')
  }

  const portfolioMatch = cvText.match(/(?:portfolio|github|gitlab)\.?\s*[:\-]?\s*([^\s\n]+)/i)
  if (portfolioMatch) {
    result.personal.portfolio = portfolioMatch[1]
    score += 5
    fieldsFound.push('portfolio')
  }

  // ========== 5. Extract Experience (Multiple section names) ==========
  const expPatterns = [
    /Experience\s*:?\s*(.+?)(?=Education|Skills|Technical|Certifications|Projects|$)/is,
    /Work\s+History\s*:?\s*(.+?)(?=Education|Skills|Technical|Certifications|Projects|$)/is,
    /Employment\s*:?\s*(.+?)(?=Education|Skills|Technical|Certifications|Projects|$)/is,
    /Professional\s+Experience\s*:?\s*(.+?)(?=Education|Skills|Technical|Certifications|Projects|$)/is,
    /Experience\s*\n(.+?)\n(?=\n*[A-Z][a-z]+.*?\n|Education|Skills|$)/is
  ]

  for (const pattern of expPatterns) {
    const match = cvText.match(pattern)
    if (match && match[1].trim().length > 20) {
      const expText = match[1]
      let expCount = 0

      // Try multiple job patterns
      const jobPatterns = [
        // Company : Role (date - date)
        /(.+?)\s*:\s*(.+?)\s*[\(\[]?(\d{2}\/\d{4}|\w+ \d{4}|Present|Current)/gi,
        // Company | Role | date - date
        /(.+?)\s*\|\s*(.+?)\s*\|\s*(\d{2}\/\d{4}|\w+ \d{4}|Present)/gi,
        // Company - Role (date - date)
        /(.+?)\s*-\s*(.+?)\s*[\(\[]?(\d{2}\/\d{4}|\w+ \d{4}|Present)/gi
      ]

      for (const jobPattern of jobPatterns) {
        let jobMatch
        while ((jobMatch = jobPattern.exec(expText)) !== null && expCount < 10) {
          const company = jobMatch[1]?.trim() || ''
          const role = jobMatch[2]?.trim() || ''

          if (company.length > 2 && role.length > 2) {
            result.experience.push({
              id: `exp_${Date.now()}_${expCount}`,
              company,
              role,
              startDate: jobMatch[3] || '',
              endDate: '',
              current: jobMatch[3]?.toLowerCase() === 'present' || jobMatch[3]?.toLowerCase() === 'current',
              highlights: [],
              skills: []
            })
            expCount++
          }
        }
        if (expCount > 0) break
      }

      if (result.experience.length > 0) {
        score += 25
        fieldsFound.push('experience')
      }
      break
    }
  }

  // ========== 6. Extract Education ==========
  const eduPatterns = [
    /Education\s*:?\s*(.+?)(?=Skills|Technical|Certifications|Experience|Projects|$)/is,
    /Academic\s+Background\s*:?\s*(.+?)(?=Skills|Technical|Certifications|Experience|Projects|$)/is,
    /Education\s*\n(.+?)\n(?=\n*[A-Z][a-z]+.*?\n|Skills|Experience|$)/is
  ]

  for (const pattern of eduPatterns) {
    const match = cvText.match(pattern)
    if (match && match[1].trim().length > 20) {
      const eduText = match[1]
      let eduCount = 0

      // Try to split by common separators
      const eduItems = eduText.split(/\n\n|\n(?=[A-Z])/).filter(e => e.trim().length > 10)

      for (const edu of eduItems.slice(0, 5)) {
        const cleanEdu = edu.replace(/^[\s\•\-\*]+/, '').trim()

        // Try to extract: Degree - School (year) or School | Degree
        const eduMatch = cleanEdu.match(/(.+?)\s*[,\-|]\s*(.+?)(?:\s*\(|\s*\[|\s*(\d{4}))?/)

        if (eduMatch) {
          result.education.push({
            id: `edu_${Date.now()}_${eduCount}`,
            degree: eduMatch[1]?.trim() || cleanEdu.substring(0, 50),
            school: eduMatch[2]?.trim() || '',
            graduationYear: eduMatch[3] || ''
          })
          eduCount++
        }
      }

      if (result.education.length > 0) {
        score += 10
        fieldsFound.push('education')
      }
      break
    }
  }

  // ========== 7. Extract Skills ==========
  const skillsPatterns = [
    /Skills\s*:?\s*(.+?)(?=\n\n|Experience|Education|Certifications|Projects|Languages|$)/is,
    /\s+Skills?\s*:?\s*(.+?)(?=\n\n|Experience|Education|Certifications|Projects|Languages|$)/is,
    /\s+Expertise\s*:?\s*(.+?)(?=\n\n|Experience|Education|Certifications|Projects|Languages|Cloud|$)/is,
    /Skills\s*\n(.+?)\n(?=\n\n|Experience|Education|Projects|$)/is
  ]

  for (const pattern of skillsPatterns) {
    const match = cvText.match(pattern)
    if (match && match[1].trim().length > 5) {
      const skillsText = match[1]

      // Split by comma, colon, newline, or bullet
      const skills = skillsText
        .split(/[,:\n•\-\*]+/)
        .map(s => s.trim())
        .filter(s => s.length > 2 && s.length < 50 && !s.includes('http'))

      if (skills.length > 0 && skills.length < 100) {
        // Store skills uncategorized - AI will categorize them later
        result.skills._raw = skills
        score += 10
        fieldsFound.push('skills')
      }
      break
    }
  }

  // ========== 8. Extract Languages ==========
  console.log('[Browser CV Parser] 🔍 Looking for Languages section...')
  console.log('[Browser CV Parser] Full CV text length:', cvText.length)

  // First, try to find the Languages section and extract it
  const languagesPatterns = [
    // Match Languages section, stop at next section header (with colon) or double newline
    /Languages?\s*:?\s*(.+?)(?=\n\s*[A-Z][a-z]+\s*:|Projects\s*:|$)/is,
    /Language\s+Proficiency\s*:?\s*(.+?)(?=\n\s*[A-Z][a-z]+\s*:|Projects\s*:|$)/is
  ]

  let languagesText = ''
  for (const pattern of languagesPatterns) {
    const match = cvText.match(pattern)
    if (match && match[1].trim().length > 3) {
      languagesText = match[1].trim()
      console.log('[Browser CV Parser] ✅ Languages section found:', languagesText.substring(0, 200))
      break
    }
  }

  // If no pattern match, try to find "Languages" keyword and extract everything after it
  if (!languagesText) {
    const languagesIndex = cvText.toLowerCase().indexOf('languages')
    if (languagesIndex !== -1) {
      console.log('[Browser CV Parser] Found "Languages" at index:', languagesIndex)
      // Extract 500 characters after "Languages"
      const afterLanguages = cvText.substring(languagesIndex + 9, languagesIndex + 500)
      console.log('[Browser CV Parser] Text after "Languages":', afterLanguages.substring(0, 200))

      // Try to extract until next section
      const nextSectionMatch = afterLanguages.match(/^([\s\S]+?)(?=\n\s*(Experience|Education|Certifications|Projects|Skills|$))/im)
      if (nextSectionMatch) {
        languagesText = nextSectionMatch[1].trim()
        console.log('[Browser CV Parser] Extracted using next section match:', languagesText.substring(0, 200))
      } else {
        // Fallback: just use the first 300 characters
        languagesText = afterLanguages.substring(0, 300).trim()
        console.log('[Browser CV Parser] Using fallback extraction:', languagesText.substring(0, 200))
      }
    }
  }

  if (languagesText) {
    const languageEntries: string[] = []

    // Clean up the text - remove extra dots and spaces
    const cleanText = languagesText.replace(/[.\s]+/g, ' ').trim()
    console.log('[Browser CV Parser] Cleaned text:', cleanText.substring(0, 200))

    // Try pattern: "Language - Level" or "Language – Level"
    const dashMatches = cleanText.match(/([A-Za-z]+)\s*[\-–]\s*(Fluent|Native|Intermediate|Basic|Advanced)/gi)
    if (dashMatches) {
      dashMatches.forEach(entry => {
        const parts = entry.split(/[\-–]/)
        if (parts.length === 2) {
          const lang = parts[0].trim()
          const level = parts[1].trim()
          languageEntries.push(`${lang} (${level})`)
        }
      })
    }

    // Try pattern: "Language Level" (adjacent words)
    if (languageEntries.length === 0) {
      const words = cleanText.split(/\s+/)
      for (let i = 0; i < words.length - 1; i++) {
        const word = words[i].trim()
        const nextWord = words[i + 1].trim()

        // Check if next word is a proficiency level
        if (/^(Fluent|Native|Intermediate|Basic|Advanced)$/i.test(nextWord)) {
          if (/^[A-Za-z]+$/.test(word) && word.length > 2) {
            languageEntries.push(`${word} (${nextWord})`)
          }
        }
      }
    }

    // Try pattern with dots: "Language . . . Level"
    if (languageEntries.length === 0) {
      const dotMatches = languagesText.match(/([A-Za-z]+)\s*[.\s]+\s*(Fluent|Native|Intermediate|Basic|Advanced)/gi)
      if (dotMatches) {
        dotMatches.forEach(entry => {
          const parts = entry.split(/[.\s]+/)
          const lang = parts[0].trim()
          const level = parts[parts.length - 1].trim()
          if (/^[A-Za-z]+$/.test(lang) && /^(Fluent|Native|Intermediate|Basic|Advanced)$/i.test(level)) {
            languageEntries.push(`${lang} (${level})`)
          }
        })
      }
    }

    if (languageEntries.length > 0) {
      result.skills.languages = languageEntries
      score += 5
      fieldsFound.push('languages')
      console.log('[Browser CV Parser] ✅ Languages parsed:', languageEntries)
    } else {
      console.log('[Browser CV Parser] ⚠️ Languages section found but could not parse entries')
    }
  } else {
    console.log('[Browser CV Parser] ⚠️ No Languages section found in CV')
  }

  // ========== FINAL QUALITY CHECK ==========
  // ⚠️ CRITICAL: Reduce confidence if essential fields are missing or look wrong
  let qualityPenalty = 0

  // Must have name AND email for high confidence
  if (!result.personal.firstName || !result.personal.lastName) {
    qualityPenalty += 30  // Heavy penalty for missing name
  }
  if (!result.personal.email) {
    qualityPenalty += 30  // Heavy penalty for missing email
  }

  // Must have at least some experience or education
  if (result.experience.length === 0 && result.education.length === 0) {
    qualityPenalty += 20
  }

  // Apply quality penalty
  result.confidence = Math.max(0, Math.min(score - qualityPenalty, 100))

  // ⚠️ EXTRA VALIDATION: If confidence is high, data must be complete
  if (result.confidence >= BROWSER_PARSING_CONFIDENCE_THRESHOLD) {
    // Must have these minimum requirements
    if (!result.personal.firstName || !result.personal.lastName) {
      console.warn('[Browser CV Parser] ❌ Missing name data - rejecting high confidence')
      result.confidence = Math.max(0, result.confidence - 50)
    }
    if (!result.personal.email) {
      console.warn('[Browser CV Parser] ❌ Missing email data - rejecting high confidence')
      result.confidence = Math.max(0, result.confidence - 50)
    }
  }

  console.log('[Browser CV Parser]', {
    confidence: result.confidence,
    fieldsFound,
    qualityPenalty,
    threshold: BROWSER_PARSING_CONFIDENCE_THRESHOLD,
    willUseAI: result.confidence < BROWSER_PARSING_CONFIDENCE_THRESHOLD,
    method: 'browser'
  })

  return result
}

// ============================================
// HYBRID CV PARSER - Field-Specific Strategy
// ============================================

interface TokenUsage {
  method: 'regex' | 'ai-chunk' | 'ai-full' | 'ai-cleanup'
  field: string
  tokens: number
  cost: number
}

interface ParseResult {
  data: ParsedCV | null
  tokenUsage: TokenUsage[]
  totalTokens: number
  totalCost: number
  method: 'browser' | 'hybrid' | 'ai-full'
}

/**
 * 🎯 HYBRID PARSER: Regex (FREE) + Single AI Call (optimized prompt)
 *
 * Strategy:
 * - Email, Phone: Regex (FREE!)
 * - Everything else: Single AI call with optimized prompt
 * - Save tokens by excluding email/phone from AI prompt
 *
 * Expected savings: 20-30% vs Full AI
 */
export async function parseCVWithHybrid(
  cvText: string,
  provider: string,
  apiKey: string,
  model?: string
): Promise<ParseResult> {
  const parseId = `hybrid_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  console.log(`[Hybrid Parser][${parseId}] 🎯 Starting hybrid parsing...`)

  const tokenUsage: TokenUsage[] = []

  // ============== STEP 1: REGEX EXTRACTION (FREE!) ==============
  console.log(`[Hybrid Parser][${parseId}] ⚡ Step 1: Regex extraction (FREE!)`)

  const extractedData: any = {
    personal: {
      email: null as string | null,
      phone: null as string | null,
      firstName: '',
      lastName: ''
    },
    professional: {
      currentTitle: '',
      summary: '',
      yearsOfExperience: 0
    },
    skills: {}, // Dynamic categories
    experience: [],
    projects: [],
    education: []
  }

  // Email
  const emailMatch = cvText.match(/[\w.+-]+@[\w-]+\.[\w.-]{2,}/)
  if (emailMatch) {
    extractedData.personal.email = emailMatch[0]
    console.log(`[Hybrid Parser][${parseId}] ✓ Email: ${emailMatch[0]}`)
  }

  // Phone
  const phoneMatch = cvText.match(/\+?[\d\s\-()]{10,}/)
  if (phoneMatch) {
    extractedData.personal.phone = phoneMatch[0].replace(/[\s\(\)]/g, '')
    console.log(`[Hybrid Parser][${parseId}] ✓ Phone: ${extractedData.personal.phone}`)
  }

  tokenUsage.push({
    method: 'regex',
    field: 'email,phone',
    tokens: 0,
    cost: 0
  })

  // ============== STEP 2: SINGLE AI CALL (Optimized prompt) ==============
  console.log(`[Hybrid Parser][${parseId}] 🤖 Step 2: Single AI call (excluding email/phone)...`)

  // Remove email and phone from CV text to save tokens
  let cleanedCVText = cvText
  if (extractedData.personal.email) {
    cleanedCVText = cleanedCVText.replace(extractedData.personal.email, '[EMAIL]')
  }
  if (extractedData.personal.phone) {
    cleanedCVText = cleanedCVText.replace(new RegExp(extractedData.personal.phone.replace(/[+\-\(\)\s]/g, '\\$&'), 'g'), '[PHONE]')
  }

  const prompt = `Extract to JSON (email & phone already extracted):

CV:
${cleanedCVText}

{
  "personal": {"f":"","l":""},
  "pro": {"title":"","sum":"","yoe":0},
  "skills": {
    "Frontend Development": ["React", "JavaScript"],
    "Backend Development": ["Node.js", "Python"]
  },
  "exp": [{"id":"","r":"","c":"COMPANY_NAME","s":"","e":"","current":false,"high":[],"sk":[]}],
  "proj": [{"id":"","n":"","d":"","tech":[],"url":"","high":[]}],
  "edu": [{"id":"","deg":"","sch":"SCHOOL_NAME","f":"","y":""}]
}

CRITICAL RULES:
1. Create DYNAMIC categories for skills (4-8 logical categories based on CV)
2. NO DUPLICATES: Each skill appears in EXACTLY ONE category
3. Use descriptive names: "Frontend Development", "Backend Development", "Databases", etc.
4. Group related skills: React+TypeScript+Next.js → "Frontend Development"
5. "c" = company name (extract actual company, never leave empty)
6. "sch" = school name (extract actual school, never leave empty)
7. Dates: "Jan 2020". YOE: number. JSON only.
8. Create YOUR OWN category names based on CV content (NOT the examples above)
9. Ensure all string values are properly escaped (especially double quotes inside strings).
10. Never include markdown.`

  try {
    let content: string | null = null

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
        const result = await callOpenRouterWithFallback(apiKey, prompt, model || 'nvidia/nemotron-3-nano-30b-a3b:free')
        content = result.content
        break
      default:
        throw new Error('Unknown provider')
    }

    if (!content) {
      throw new Error('No content received from AI')
    }

    // Extract JSON
    let jsonMatch: RegExpMatchArray | null = null
    for (const pattern of CV_PARSING.JSON_PATTERNS) {
      jsonMatch = content.match(pattern)
      if (jsonMatch) break
    }

    if (!jsonMatch) {
      throw new Error('No JSON found in AI response')
    }

    let jsonString = jsonMatch[1] || jsonMatch[0]
    jsonString = cleanMalformedJson(jsonString)
    const parsed = JSON.parse(jsonString)

    // Map abbreviated fields and merge with regex-extracted data
    const mappedData: any = {
      personal: {
        firstName: parsed.personal?.f || '',
        lastName: parsed.personal?.l || '',
        email: extractedData.personal.email || '',
        phone: extractedData.personal.phone || '',
        gender: 'prefer_not_to_say',
        linkedIn: parsed.personal?.linkedIn || '',
        portfolio: parsed.personal?.portfolio || ''
      },
      professional: {
        currentTitle: parsed.pro?.title || '',
        summary: parsed.pro?.sum || '',
        yearsOfExperience: parsed.pro?.yoe || 0
      },
      skills: parsed.skills || {}, // Dynamic categories from AI
      experience: (Array.isArray(parsed.exp) ? parsed.exp : [])
        .filter((exp: any) => exp.c && exp.c.trim().length > 0) // Remove entries with empty company
        .map((exp: any) => ({
          id: exp.id || `exp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          role: exp.r || '',
          company: exp.c || '',
          startDate: exp.s || '',
          endDate: exp.e || undefined,
          current: exp.current || false,
          highlights: Array.isArray(exp.high) ? exp.high : [],
          skills: Array.isArray(exp.sk) ? exp.sk : []
        })),
      projects: (Array.isArray(parsed.proj) ? parsed.proj : []).map((proj: any) => ({
        id: proj.id || `proj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        name: proj.n || '',
        description: proj.d || '',
        technologies: Array.isArray(proj.tech) ? proj.tech : [],
        url: proj.url || undefined,
        highlights: Array.isArray(proj.high) ? proj.high : []
      })),
      education: (Array.isArray(parsed.edu) ? parsed.edu : [])
        .filter((edu: any) => edu.sch && edu.sch.trim().length > 0) // Remove entries with empty school
        .map((edu: any) => ({
          id: edu.id || `edu_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          degree: edu.deg || '',
          school: edu.sch || '',
          field: edu.f || undefined,
          graduationYear: edu.y || undefined
        }))
    }

    // Estimate tokens (conservative estimate)
    const inputTokens = Math.ceil(cleanedCVText.length / 4)
    const outputTokens = 800
    const totalTokens = inputTokens + outputTokens
    const totalCost = totalTokens * 0.15 / 1000000

    tokenUsage.push({
      method: 'ai-chunk',
      field: 'all-fields',
      tokens: totalTokens,
      cost: totalCost
    })

    // Validate and LOG skills structure
    console.log('🔍 [DEBUG] Hybrid Parser - Mapped skills from AI:', JSON.stringify(mappedData.skills, null, 2))

    const validatedData = ParsedCVSchema.parse({
      ...mappedData,
      rawText: cvText,
      parsedAt: Date.now()
    })

    console.log('✅ [DEBUG] Hybrid Parser - Validated skills:', JSON.stringify(validatedData.skills, null, 2))

    console.log(`[Hybrid Parser][${parseId}] ✅ Success! Tokens: ${totalTokens}, Cost: $${totalCost.toFixed(6)}`)

    // Save token usage
    saveTokenUsage(parseId, 'hybrid', tokenUsage, totalTokens, totalCost)

    return {
      data: validatedData,
      tokenUsage,
      totalTokens,
      totalCost,
      method: 'hybrid'
    }
  } catch (error) {
    console.error(`[Hybrid Parser][${parseId}] ❌ Failed:`, error)
    return {
      data: null,
      tokenUsage,
      totalTokens: tokenUsage.reduce((sum, u) => sum + u.tokens, 0),
      totalCost: tokenUsage.reduce((sum, u) => sum + u.cost, 0),
      method: 'hybrid'
    }
  }
}

/**
 * 🛡️ Validate and clean skills from AI response
 * - Removes duplicate skills across categories
 * - Trims whitespace
 * - Removes empty strings and empty categories
 * - Sorts skills alphabetically within each category
 */
function validateAndCleanSkills(skills: Record<string, string[]>, parseId: string): Record<string, string[]> {
  console.log(`[CV Parsing][${parseId}] 🛡️ Validating and cleaning skills...`)

  // Step 1: Collect all skills and track which category they first appear in
  const skillToCategory: Map<string, string> = new Map()
  const categoryToSkills: Record<string, Set<string>> = {}

  // Initialize sets for each category
  for (const [category, skillList] of Object.entries(skills)) {
    if (!Array.isArray(skillList)) {
      console.warn(`[CV Parsing][${parseId}] ⚠️ Category "${category}" is not an array, skipping`)
      continue
    }

    categoryToSkills[category] = new Set()

    for (const skill of skillList) {
      if (typeof skill !== 'string') continue

      const trimmedSkill = skill.trim()
      if (!trimmedSkill) continue // Skip empty strings

      // Check for duplicates
      if (skillToCategory.has(trimmedSkill)) {
        const existingCategory = skillToCategory.get(trimmedSkill)!
        console.warn(`[CV Parsing][${parseId}] ⚠️ Duplicate skill "${trimmedSkill}" found in "${category}" (already in "${existingCategory}")`)
        // Don't add to this category, keep first occurrence
      } else {
        skillToCategory.set(trimmedSkill, category)
        categoryToSkills[category]?.add(trimmedSkill)
      }
    }
  }

  // Step 2: Build cleaned skills object
  const cleanedSkills: Record<string, string[]> = {}

  for (const [category, skillSet] of Object.entries(categoryToSkills)) {
    const skillsArray = Array.from(skillSet).sort() // Sort alphabetically

    // Skip empty categories
    if (skillsArray.length === 0) {
      console.warn(`[CV Parsing][${parseId}] ⚠️ Removed empty category "${category}"`)
      continue
    }

    cleanedSkills[category] = skillsArray
  }

  // Step 3: Log summary
  const totalCategories = Object.keys(cleanedSkills).length
  const totalSkills = Object.values(cleanedSkills).reduce((sum, arr) => sum + arr.length, 0)

  console.log(`[CV Parsing][${parseId}] ✅ Skills cleaned:`)
  console.log(`  - Categories: ${totalCategories}`)
  console.log(`  - Total unique skills: ${totalSkills}`)
  console.log(`  - Categories:`, Object.keys(cleanedSkills).join(', '))

  // Warning if too few or too many categories
  if (totalCategories < 2) {
    console.warn(`[CV Parsing][${parseId}] ⚠️ Only ${totalCategories} category(s) created. AI should create 4-8 categories.`)
  } else if (totalCategories > 10) {
    console.warn(`[CV Parsing][${parseId}] ⚠️ Too many categories (${totalCategories}). Consider merging similar categories.`)
  }

  return cleanedSkills
}

/**
 * Save token usage to storage for tracking
 */
async function saveTokenUsage(
  parseId: string,
  method: 'browser' | 'hybrid' | 'ai-full',
  tokenUsage: TokenUsage[],
  totalTokens: number,
  totalCost: number
) {
  try {
    const result = await chrome.storage.local.get('tokenHistory')
    const history = result.tokenHistory || []

    history.push({
      parseId,
      method,
      timestamp: Date.now(),
      tokenUsage,
      totalTokens,
      totalCost
    })

    // Keep only last 100 entries
    if (history.length > 100) {
      history.splice(0, history.length - 100)
    }

    await chrome.storage.local.set({ tokenHistory: history })
  } catch (error) {
    console.error('[Token Tracking] Failed to save:', error)
  }
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

  const prompt = `Extract skills from CV and create DYNAMIC categories.

CRITICAL RULES:
1. NO DUPLICATES: Each skill MUST appear in EXACTLY ONE category. If "JavaScript" is in "Frontend", it CANNOT appear in "Backend" or any other category.
2. Create 4-8 logical categories based on skill patterns found in the CV
3. Use descriptive category names (e.g., "Frontend Development" not just "Frontend")
4. Group RELATED skills that are used together:
   - React, Vue, Angular, JavaScript, TypeScript, HTML/CSS → "Frontend Development"
   - Node.js, Python, Java, Express, Django, API Design → "Backend Development"
   - PostgreSQL, MongoDB, MySQL, Redis → "Databases"
   - AWS, Docker, Kubernetes, CI/CD → "Cloud & DevOps"
   - Excel, PowerBI, Tableau, SQL → "Data Analysis Tools"
   - React Native, Flutter, Swift, Kotlin → "Mobile Development"
5. If a skill doesn't fit any category → "Other Skills"
6. Language skills (English, Bangla, etc.) → "Languages" category
7. DO NOT create single-skill categories (minimum 2 skills per category unless it's "Languages")
8. DO NOT create too-specific categories (e.g., don't separate "React Hooks" from "React")

ANTI-PATTERNS (What NOT to do):
❌ Don't repeat tools across categories
❌ Don't create categories with just 1 skill (except Languages)
❌ Don't mix languages (English/Bangla) with  skills

CV TEXT:
${cvText}

Return ONLY this JSON structure (create YOUR OWN category names dynamically):
{
  "personal": {"f":"","l":"","e":"","p":"","city":"","c":"","linkedIn":"","portfolio":"","github":""},
  "pro": {"title":"","sum":"","yoe":0},
  "skills": {
    "YOUR_CATEGORY_NAME": ["skill1", "skill2", "skill3"],
    "ANOTHER_CATEGORY": ["skill4", "skill5"]
  },
  "exp": [{"id":"","r":"","c":"","s":"","e":"","current":false,"high":[],"sk":[]}],
  "proj": [{"id":"","n":"","d":"","tech":[],"url":"","high":[]}],
  "edu": [{"id":"","deg":"","sch":"","f":"","y":""}]
}

Dates: "Jan 2020". YOE: number. JSON only.
IMPORTANT:
- Ensure all string values are properly escaped (especially double quotes inside strings)
- Never include markdown formatting
- Create YOUR OWN category names based on the CV content
- DO NOT use the placeholder names "YOUR_CATEGORY_NAME" or "ANOTHER_CATEGORY"`

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

    // 🎯 Validate and clean skills (remove duplicates, empty strings, etc.)
    const cleanedSkills = validateAndCleanSkills(parsed.skills || {}, parseId)
    parsed.skills = cleanedSkills

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
        currentTitle: parsed.pro?.title || '',
        summary: parsed.pro?.sum || '',
        yearsOfExperience: parsed.pro?.yoe || 0,
      },
      skills: parsed.skills || {}, // Dynamic categories from AI
      // 🎯 Map experience array fields (r→role, c→company, s→startDate, e→endDate, high→highlights, sk→skills)
      experience: (Array.isArray(parsed.exp) ? parsed.exp : []).map((exp: any) => ({
        id: exp.id || '',
        role: exp.r || '',
        company: exp.c || '',
        startDate: exp.s || '',
        endDate: exp.e || undefined,
        current: exp.current || false,
        highlights: Array.isArray(exp.high) ? exp.high : [],
        skills: Array.isArray(exp.sk) ? exp.sk : [],
      })),
      // 🎯 Map projects array fields (n→name, d→description, tech→technologies, high→highlights)
      projects: (Array.isArray(parsed.proj) ? parsed.proj : []).map((proj: any) => ({
        id: proj.id || '',
        name: proj.n || '',
        description: proj.d || '',
        technologies: Array.isArray(proj.tech) ? proj.tech : [],
        url: proj.url || undefined,
        highlights: Array.isArray(proj.high) ? proj.high : [],
      })),
      // 🎯 Map education array fields (deg→degree, sch→school, f→field, y→graduationYear)
      education: (Array.isArray(parsed.edu) ? parsed.edu : []).map((edu: any) => ({
        id: edu.id || '',
        degree: edu.deg || '',
        school: edu.sch || '',
        field: edu.f || undefined,
        graduationYear: edu.y || undefined,
      })),
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

  // 🎯 Flatten all skills from dynamic categories
  const allSkills: string[] = []
  Object.values(roleCV.skills).forEach(skillArray => {
    if (Array.isArray(skillArray)) {
      allSkills.push(...skillArray)
    }
  })

  // Remove duplicates
  const uniqueSkills = [...new Set(allSkills)]

  // Sort by emphasis and filter out de-emphasized skills
  const sortedSkills = uniqueSkills
    .sort((a, b) => {
      const aEmphasis = template.emphasize.some(e => a.toLowerCase().includes(e.toLowerCase())) ? 1 : 0
      const bEmphasis = template.emphasize.some(e => b.toLowerCase().includes(e.toLowerCase())) ? 1 : 0
      return bEmphasis - aEmphasis
    })
    .filter(s => !template.deEmphasize.some(d => s.toLowerCase().includes(d.toLowerCase())))

  // Put all sorted skills into a single "All Skills" category for role-based CV
  roleCV.skills = {
    "Skills": sortedSkills
  }

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

// ============================================
// CV WORKFLOW LISTENER
// ============================================

// Initialize CV workflow message listener
setupCVWorkflowListener()

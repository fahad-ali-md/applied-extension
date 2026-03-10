/**
 * Storage Helper Utilities
 * Easy access to Chrome extension storage
 */

export const STORAGE_KEYS = {
  CV_DATA: 'cv_data',
  PARSED_CV: 'parsedCV',
  API_KEY_OPENAI: 'openai_api_key',
  API_KEY_GEMINI: 'gemini_api_key',
  API_KEY_ZHIPU: 'zhipu_api_key',
  PROVIDER_CONFIGS: 'provider_configs',
  SETTINGS: 'settings',
  ROLE_TEMPLATES: 'role_templates',
  SELECTED_ROLE: 'selectedRole',
}

/**
 * Get all stored data
 */
export async function getAllStorageData(): Promise<Record<string, any>> {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (data) => {
      resolve(data || {})
    })
  })
}

/**
 * Get CV data (checks both old and new format)
 */
export async function getCVData(): Promise<any> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.PARSED_CV, STORAGE_KEYS.CV_DATA], (data) => {
      resolve(data[STORAGE_KEYS.PARSED_CV] || data[STORAGE_KEYS.CV_DATA] || null)
    })
  })
}

/**
 * Check if CV exists
 */
export async function hasCVData(): Promise<boolean> {
  const cv = await getCVData()
  return !!cv
}

/**
 * Get all API keys (old and new format)
 */
export async function getAllApiKeys(): Promise<{
  openai?: string
  gemini?: string
  zhipu?: string
  providerConfigs?: Record<string, any>
}> {
  return new Promise((resolve) => {
    chrome.storage.local.get([
      STORAGE_KEYS.API_KEY_OPENAI,
      STORAGE_KEYS.API_KEY_GEMINI,
      STORAGE_KEYS.API_KEY_ZHIPU,
      STORAGE_KEYS.PROVIDER_CONFIGS,
    ], (data) => {
      resolve({
        openai: data[STORAGE_KEYS.API_KEY_OPENAI],
        gemini: data[STORAGE_KEYS.API_KEY_GEMINI],
        zhipu: data[STORAGE_KEYS.API_KEY_ZHIPU],
        providerConfigs: data[STORAGE_KEYS.PROVIDER_CONFIGS],
      })
    })
  })
}

/**
 * Check if any API key exists
 */
export async function hasAnyApiKey(): Promise<boolean> {
  const keys = await getAllApiKeys()
  return !!(
    keys.openai ||
    keys.gemini ||
    keys.zhipu ||
    (keys.providerConfigs && Object.keys(keys.providerConfigs).length > 0)
  )
}

/**
 * Save CV data
 */
export async function saveCVData(cvData: any): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.PARSED_CV]: cvData }, () => {
      resolve()
    })
  })
}

/**
 * Save API key for a provider
 */
export async function saveApiKey(provider: 'openai' | 'gemini' | 'zhipu', apiKey: string): Promise<void> {
  return new Promise((resolve) => {
    const key = provider === 'openai' ? STORAGE_KEYS.API_KEY_OPENAI :
      provider === 'gemini' ? STORAGE_KEYS.API_KEY_GEMINI :
        STORAGE_KEYS.API_KEY_ZHIPU
    chrome.storage.local.set({ [key]: apiKey }, () => {
      resolve()
    })
  })
}

/**
 * Get settings
 */
export async function getSettings(): Promise<any> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.SETTINGS, (data) => {
      resolve(data[STORAGE_KEYS.SETTINGS] || {})
    })
  })
}

/**
 * Save settings
 */
export async function saveSettings(settings: any): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings }, () => {
      resolve()
    })
  })
}

/**
 * Clear all data (useful for testing)
 */
export async function clearAllData(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.clear(() => {
      resolve()
    })
  })
}

/**
 * Log all storage data (for debugging)
 */
export async function logAllStorageData(): Promise<void> {
  const data = await getAllStorageData()
  console.log('=== Extension Storage Data ===')
  console.log('Keys:', Object.keys(data))
  console.log('Data:', data)
  console.log('Has CV:', await hasCVData())
  console.log('Has API Key:', await hasAnyApiKey())
}

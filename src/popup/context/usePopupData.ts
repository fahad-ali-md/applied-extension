import { useState } from 'react'
import { AvailableProvider } from '../components/types'

export const usePopupData = () => {
  const [hasCV, setHasCV] = useState(false)
  const [cvData, setCvData] = useState<any>(null)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [activeProvider, setActiveProvider] = useState<string>('')
  const [availableProviders, setAvailableProviders] = useState<AvailableProvider[]>([])
  const [detectedFields, setDetectedFields] = useState<any[]>([])

  const loadData = () => {
    console.log('[Popup] Loading data...')

    // Load CV
    chrome.runtime.sendMessage({ action: 'getCV' }, (response) => {
      console.log('[Popup] getCV response:', response)
      const hasCVData = !!response?.data
      setHasCV(hasCVData)
      if (hasCVData) {
        setCvData(response.data)
        console.log('[Popup] CV Data loaded:', response.data)
      }
    })

    // Load Providers
    chrome.runtime.sendMessage({ action: 'getAvailableProviders' }, (response) => {
      console.log('[Popup] getAvailableProviders response:', response)
      if (response?.success && response.providers) {
        setAvailableProviders(response.providers)
        console.log('[Popup] Providers loaded:', response.providers)
        setHasApiKey(response.providers.length > 0)
        console.log('[Popup] Has API key:', response.providers.length > 0)
        if (response.activeProvider &&
          response.providers.some((p: AvailableProvider) => p.id === response.activeProvider)) {
          setActiveProvider(response.activeProvider)
          console.log('[Popup] Active provider set:', response.activeProvider)
        } else if (response.providers.length > 0) {
          setActiveProvider(response.providers[0].id)
          console.log('[Popup] Active provider set:', response.providers[0].id)
        }
      } else {
        setAvailableProviders([])
        setHasApiKey(false)
      }
    })

    detectFields()
  }

  const detectFields = async () => {
    try {
      // Get the active tab FIRST before sending to background
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

      if (!tab || !tab.id) {
        console.warn('[usePopupData] No active tab found')
        return
      }

      console.log('[usePopupData] Detecting fields in tab:', tab.url)

      chrome.runtime.sendMessage({ action: 'detectFields', tabId: tab.id }, (response) => {
        if (response?.fields) {
          setDetectedFields(response.fields)
        }
      })
    } catch (error) {
      console.error('[usePopupData] Error detecting fields:', error)
    }
  }

  const handleProviderChange = async (providerId: string) => {
    console.log('[Popup] Changing provider to:', providerId)
    setActiveProvider(providerId)

    // Save the selected provider to storage
    await chrome.runtime.sendMessage({
      action: 'saveActiveProvider',
      provider: providerId
    })

    console.log('[Popup] Provider saved:', providerId)
  }

  const openOptions = () => {
    chrome.runtime.openOptionsPage()
  }

  const openDashboard = () => {
    ; (chrome.sidePanel as any).open({ windowId: chrome.windows.WINDOW_ID_CURRENT })
  }

  const activeProviderName = availableProviders.find(p => p.id === activeProvider)?.name || 'AI'

  return {
    // State
    hasCV,
    cvData,
    hasApiKey,
    activeProvider,
    availableProviders,
    detectedFields,
    activeProviderName,

    // Actions
    loadData,
    detectFields,
    handleProviderChange,
    openOptions,
    openDashboard,
  }
}

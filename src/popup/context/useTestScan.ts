import { useState } from 'react'
// DISABLED: Puppeteer causing build issues
// import {
//   connect,
//   ExtensionTransport,
// } from 'puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js'

export const useTestScan = () => {
  const [isScanning, setIsScanning] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [viewMode, setViewMode] = useState<'list' | 'toon'>('list')

  const handleTestScan = async () => {
    setIsScanning(true)
    setTestResult(null)

    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

      if (!tab || !tab.id) {
        throw new Error('No active tab found')
      }

      console.log('[TestScan] 🔍 Scanning tab:', tab.url)
      console.log('[TestScan] 🆔 Tab ID:', tab.id)

      // Use content script to extract fields (no Puppeteer needed)
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'detectFields'
      })

      console.log('[TestScan] ✅ Found fields:', response.fields?.length || 0)
      console.log('[TestScan] 📊 Fields:', response.fields)

      // Set result
      setTestResult({
        success: true,
        url: tab.url,
        pageTitle: tab.title || 'Unknown',
        fields: response.fields || [],
        fieldCount: response.fields?.length || 0,
        timestamp: new Date().toISOString(),
      })

    } catch (error) {
      console.error('[TestScan] ❌ Error:', error)
      setTestResult({ error: String(error) })
    } finally {
      setIsScanning(false)
    }
  }

  return {
    isScanning,
    testResult,
    viewMode,
    setViewMode,
    handleTestScan,
  }
}

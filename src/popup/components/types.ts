export interface AvailableProvider {
  id: 'openai' | 'gemini' | 'zhipu'
  name: string
  model: string
  modelName: string
}

export interface DetectedField {
  name: string
  id?: string
  placeholder?: string
  type?: string
  tagName?: string
}

export interface HeaderProps {
  hasCV: boolean
  hasApiKey: boolean
  activeProviderName: string
  activeProvider: string
  availableProviders: AvailableProvider[]
  onSettingsClick: () => void
  onProviderChange: (providerId: string) => void
}

export interface FillCardProps {
  hasCV: boolean
  hasApiKey: boolean
  isFilling: boolean
  status: string
  fieldProgress: Array<{ fieldName: string; label: string; status: 'filled' | 'failed' | 'pending' }>
  onFillForm: () => void
  onOpenOptions: () => void
}

export interface DetectedFieldsProps {
  detectedFields: DetectedField[]
  onRefresh: () => void
  fieldIcon: (field: DetectedField) => string
  fieldLabel: (field: DetectedField) => string
  isFilling?: boolean
  fieldProgress?: Array<{ fieldName: string; label: string; status: 'filled' | 'failed' | 'pending' }>
}

export interface NavigationProps {
  activeTab: string
  onTabChange: (tab: string) => void
  onFillClick: () => void
  onDashboardClick: () => void
  onTestScanClick: () => void
  onSettingsClick: () => void
  isScanning?: boolean
}

export interface TestScanProps {
  isScanning: boolean
  testResult: any
  viewMode: 'list' | 'toon'
  onViewModeChange: (mode: 'list' | 'toon') => void
  onScan: () => void
}

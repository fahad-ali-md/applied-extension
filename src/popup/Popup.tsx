import { useState, useEffect } from 'react'
import './Popup.css'
// Components
import {
  Header,
  FillCard,
  DetectedFields,
  Navigation,
  TestScan,
  fieldIcon,
  fieldLabel,
} from './components'
// Custom Hooks
import {
  usePopupData,
  useFormFiller,
  useTestScan,
} from './context'

export const Popup = () => {
  // 📦 All data from one hook
  const {
    hasCV,
    hasApiKey,
    activeProviderName,
    activeProvider,
    availableProviders,
    loadData,
    detectFields,
    handleProviderChange,
    openOptions,
    openDashboard,
    detectedFields: initialDetectedFields,
  } = usePopupData()

  // 📝 Form filling logic (now includes detectedFields from AI!)
  const { isFilling, status, fieldProgress, detectedFields: fillerDetectedFields, handleFillForm, handleDetectFields } = useFormFiller()

  // Use fields from filler if available, otherwise fallback to initially detected fields
  const detectedFields = fillerDetectedFields.length > 0 ? fillerDetectedFields : initialDetectedFields

  // 🔍 Test scan logic
  const { isScanning, testResult, viewMode, setViewMode, handleTestScan } = useTestScan()

  // 🎯 Tab state (only state left in main component!)
  const [activeTab, setActiveTab] = useState<string>('fill')

  useEffect(() => {
    loadData()
  }, [])

  return (
    <div className="popup-root">
      <Header
        hasCV={hasCV}
        hasApiKey={hasApiKey}
        activeProviderName={activeProviderName}
        activeProvider={activeProvider}
        availableProviders={availableProviders}
        onSettingsClick={openOptions}
        onProviderChange={handleProviderChange}
      />

      <main className="popup-main">
        {activeTab === 'fill' && (
          <>
            <FillCard
              hasCV={hasCV}
              hasApiKey={hasApiKey}
              isFilling={isFilling}
              status={status}
              fieldProgress={fieldProgress}
              onFillForm={handleFillForm}
              onOpenOptions={openOptions}
            />
            <DetectedFields
              detectedFields={detectedFields}
              onRefresh={handleDetectFields}
              fieldIcon={fieldIcon}
              fieldLabel={fieldLabel}
              isFilling={isFilling}
              fieldProgress={fieldProgress}
            />
          </>
        )}

        {activeTab === 'test' && (
          <TestScan
            isScanning={isScanning}
            testResult={testResult}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onScan={handleTestScan}
          />
        )}
      </main>

      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onFillClick={() => setActiveTab('fill')}
        onDashboardClick={openDashboard}
        onTestScanClick={() => setActiveTab('test')}
        onSettingsClick={openOptions}
        isScanning={isScanning}
      />

      <div className="popup-deco-top" />
      <div className="popup-deco-bottom" />
    </div>
  )
}

export default Popup

import React from 'react'
import { TestScanProps } from '../types'
import './TestScan.css'

export const TestScan: React.FC<TestScanProps> = ({
  isScanning,
  testResult,
  viewMode,
  onViewModeChange,
  onScan
}) => {
  return (
    <div className="popup-fields-section">
      <button onClick={onScan}>Test Scan</button>
    </div>
  )
}

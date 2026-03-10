import React from 'react'
import { NavigationProps } from '../types'
import './Navigation.css'

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  onFillClick,
  onDashboardClick,
  onTestScanClick,
  onSettingsClick,
  isScanning = false
}) => {
  return (
    <nav className="popup-nav">
      <button
        className={`popup-nav-item ${activeTab === 'fill' ? 'popup-nav-active' : ''}`}
        onClick={onFillClick}
      >
        <span className="material-symbols-outlined">auto_fix_high</span>
        <span>Fill</span>
      </button>
      <button
        className={`popup-nav-item ${activeTab === 'dashboard' ? 'popup-nav-active' : ''}`}
        onClick={onDashboardClick}
      >
        <span className="material-symbols-outlined">dashboard</span>
        <span>Dashboard</span>
      </button>

      <button
        className={`popup-nav-item ${activeTab === 'test' ? 'popup-nav-active' : ''}`}
        onClick={onTestScanClick}
      >
        <span className="material-symbols-outlined">{isScanning ? 'hourglass_empty' : 'science'}</span>
        <span>{isScanning ? 'Scanning...' : 'Test Scan'}</span>
      </button>

      <button
        className={`popup-nav-item ${activeTab === 'settings' ? 'popup-nav-active' : ''}`}
        onClick={onSettingsClick}
      >
        <span className="material-symbols-outlined">settings</span>
        <span>Settings</span>
      </button>
    </nav>
  )
}

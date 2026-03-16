import React from 'react'
import { NavigationProps } from '../types'
import './Navigation.css'

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  onFillClick,
  onDashboardClick,
  onSettingsClick,
  onCVClick
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

      {onCVClick && (
        <button
          className={`popup-nav-item ${activeTab === 'cv' ? 'popup-nav-active' : ''}`}
          onClick={onCVClick}
        >
          <span className="material-symbols-outlined">description</span>
          <span>CV</span>
        </button>
      )}

      <button
        className={`popup-nav-item ${activeTab === 'dashboard' ? 'popup-nav-active' : ''}`}
        onClick={onDashboardClick}
      >
        <span className="material-symbols-outlined">dashboard</span>
        <span>Dashboard</span>
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

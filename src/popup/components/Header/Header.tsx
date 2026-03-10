import React from 'react'
import { HeaderProps } from '../types'
import './Header.css'

export const Header: React.FC<HeaderProps> = ({
  hasCV,
  hasApiKey,
  activeProviderName,
  activeProvider,
  availableProviders,
  onSettingsClick,
  onProviderChange
}) => {
  return (
    <header className="popup-header">
      <div className="popup-header-top">
        <div className="popup-logo-row">
          <div className="popup-logo-icon">
            <span className="material-symbols-outlined">psychology</span>
          </div>
          <h1 className="popup-title">Applied</h1>
        </div>
        <button
          className="popup-info-btn"
          onClick={onSettingsClick}
          title="Open Settings"
        >
          <span className="material-symbols-outlined">settings</span>
        </button>
      </div>
      <p className="popup-subtitle">Premium AI Job Assistant</p>

      {/* Status Badges */}
      <div className="popup-badges">
        <div className={`popup-badge ${hasCV ? 'popup-badge-green' : 'popup-badge-warning'}`}>
          <span className="material-symbols-outlined">{hasCV ? 'check_circle' : 'warning'}</span>
          <span>{hasCV ? 'CV Loaded' : 'No CV'}</span>
        </div>
        <div className={`popup-badge ${hasApiKey ? 'popup-badge-indigo' : 'popup-badge-warning'}`}>
          <span className="material-symbols-outlined">{hasApiKey ? 'bolt' : 'key_off'}</span>
          <span>{hasApiKey ? 'AI Ready' : 'No API Key'}</span>
        </div>
      </div>

      {/* Provider Selector */}
      {hasApiKey && availableProviders.length > 0 && (
        <div className="popup-provider-selector">
          <label className="popup-provider-label">AI Provider:</label>
          <select
            className="popup-provider-dropdown"
            value={activeProvider}
            onChange={(e) => onProviderChange(e.target.value)}
          >
            {availableProviders.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </header>
  )
}

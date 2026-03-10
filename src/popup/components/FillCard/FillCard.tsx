import React from 'react'
import { FillCardProps } from '../types'
import './FillCard.css'

export const FillCard: React.FC<FillCardProps> = ({
  hasCV,
  hasApiKey,
  isFilling,
  status,
  fieldProgress,
  onFillForm,
  onOpenOptions
}) => {
  return (
    <div className="popup-fill-card">
      <div className="popup-fill-card-glow" />
      <div className="popup-fill-card-content">
        <div className="popup-fill-card-header">
          <span className="material-symbols-outlined popup-fill-icon">magic_button</span>
          <h3>Fill Application</h3>
        </div>
        <p className="popup-fill-desc">
          Automatically match your CV data to the job application fields found on this page.
        </p>

        {!hasCV && (
          <div className="popup-alert popup-alert-warning">
            <span className="material-symbols-outlined">upload_file</span>
            <div>
              <span>No CV uploaded. </span>
              <button onClick={onOpenOptions}>Upload →</button>
            </div>
          </div>
        )}
        {!hasApiKey && (
          <div className="popup-alert popup-alert-info">
            <span className="material-symbols-outlined">key</span>
            <div>
              <span>Add an API key for AI. </span>
              <button onClick={onOpenOptions}>Add Key →</button>
            </div>
          </div>
        )}

        <button
          className="popup-fill-btn"
          onClick={onFillForm}
          disabled={isFilling || !hasCV}
        >
          {isFilling ? (
            <>
              <span className="material-symbols-outlined popup-spin">refresh</span>
              Filling...
            </>
          ) : (
            <>
              Auto-Fill Now
              <span className="material-symbols-outlined">arrow_forward</span>
            </>
          )}
        </button>

        {status && <p className="popup-status-msg">{status}</p>}

        {/* 🎯 Dynamic Field Progress Display */}
        {isFilling && fieldProgress.length > 0 && (
          <div className="popup-field-progress">
            <div className="popup-progress-header">
              <span className="popup-progress-count">
                {fieldProgress.filter(f => f.status === 'filled').length} / {fieldProgress.length} fields
              </span>
            </div>
            <div className="popup-progress-list">
              {fieldProgress.slice(0, 8).map((field, i) => (
                <div key={i} className={`popup-progress-item popup-progress-${field.status}`}>
                  <span className="popup-progress-label">{field.label}</span>
                  <span className="material-symbols-outlined popup-progress-icon">
                    {field.status === 'filled' && 'check_circle'}
                    {field.status === 'failed' && 'cancel'}
                    {field.status === 'pending' && 'radio_button_unchecked'}
                  </span>
                </div>
              ))}
              {fieldProgress.length > 8 && (
                <div className="popup-progress-more">
                  +{fieldProgress.length - 8} more fields
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

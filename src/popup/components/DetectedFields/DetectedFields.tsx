import React from 'react'
import { DetectedFieldsProps } from '../types'
import './DetectedFields.css'

export const DetectedFields: React.FC<DetectedFieldsProps> = ({
  detectedFields,
  onRefresh,
  fieldIcon,
  fieldLabel,
  isFilling = false,
  fieldProgress = []
}) => {

  // 🎯 Show detected fields when available (after scanning)
  const hasDetectedFields = detectedFields && detectedFields.length > 0

  // 🎯 Always show detected fields if available, even when not filling
  // This ensures users can see what was detected on the page
  if (!hasDetectedFields && fieldProgress.length === 0) {
    return (
      <div className="popup-fields-section">
        <div className="popup-fields-header">
          <h4>No fields detected</h4>
        </div>
      </div>
    )
  }

  // 🎯 Create a map of field progress for quick lookup
  const progressMap = new Map(fieldProgress.map(f => [f.label, f.status]))

  // 🎯 Always use detected fields as the source of truth for display
  // This ensures we show all 12 detected fields even if AI mapping returns 0
  let displayFields: any[] = []

  if (hasDetectedFields) {
    // Show detected fields from the page
    displayFields = detectedFields.map((field: any) => ({
      label: field.label || field.placeholder || field.name || field.id || 'Unknown',
      name: field.name || field.id,
      placeholder: field.placeholder,
      type: field.type || 'text'
    }))
  } else if (fieldProgress.length > 0) {
    // Fallback to progress fields if no detected fields
    displayFields = fieldProgress.map(f => ({
      label: f.label,
      name: f.fieldName,
      placeholder: f.label,
      type: 'text'
    }))
  }

  return (
    <div className="popup-fields-section">
      <div className="popup-fields-header">
        <h4>Detected fields</h4>
        <span className="popup-fields-count">{displayFields.length} fields detected</span>
      </div>

      <div className="popup-fields-list">
        {displayFields.slice(0, 12).map((field, i) => {
          // Handle both DetectedField and progress field types
          const label = 'label' in field ? field.label : fieldLabel(field as any)
          const status = progressMap.get(label)

          return (
            <div key={i} className={`popup-field-item ${status ? `popup-field-${status}` : ''}`}>
              <div className="popup-field-left">
                <span className="material-symbols-outlined">
                  {status === 'filled' ? 'check_circle' : status === 'failed' ? 'cancel' : fieldIcon(field as any)}
                </span>
                <span className={status === 'filled' ? 'popup-field-label-filled' : ''}>{label}</span>
              </div>
              <span className="material-symbols-outlined popup-field-check">
                {status === 'filled' && 'check_box'}
                {status === 'failed' && 'error'}
                {!status && 'check_box_outline_blank'}
              </span>
            </div>
          )
        })}
      </div>

      {displayFields.length > 12 && (
        <p className="popup-fields-more">+{displayFields.length - 12} more fields detected</p>
      )}

      {!isFilling && (fieldProgress.length > 0 || hasDetectedFields) && (
        <button className="popup-refresh-btn" onClick={onRefresh}>
          <span className="material-symbols-outlined">refresh</span>
          Refresh
        </button>
      )}
    </div>
  )
}

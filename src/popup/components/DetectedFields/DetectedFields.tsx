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

  // 🎯 Create a map of field progress for quick lookup
  // Use both fieldName and label as keys for better matching
  const progressMap = new Map<string, 'filled' | 'failed' | 'pending' | undefined>()
  fieldProgress.forEach(f => {
    progressMap.set(f.label, f.status)
    progressMap.set(f.fieldName, f.status)
  })

  console.log(progressMap, fieldProgress)
  // 🎯 Calculate progress stats
  const filledCount = fieldProgress.filter(f => f.status === 'filled').length
  const failedCount = fieldProgress.filter(f => f.status === 'failed').length
  const totalCount = displayFields.length
  const progressPercent = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0

  console.log("fieldProgress", fieldProgress)

  return (
    <div className="popup-fields-section">
      <div className="popup-fields-header">
        <h4>Detected field</h4>
        {fieldProgress.length > 0 ? (
          <div className="popup-progress-badge">
            <span className="popup-progress-count">{filledCount}/{totalCount}</span>
            <span className="popup-progress-percent">{progressPercent}%</span>
          </div>
        ) : (
          <span className="popup-fields-count">{displayFields.length} fields detected</span>
        )}
      </div>

      {/* Progress bar when filling */}
      {isFilling && totalCount > 0 && (
        <div className="popup-progress-bar">
          <div
            className="popup-progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      <div className="popup-fields-list">
        {displayFields.slice(0, 12).map((field, i) => {
          // Handle both DetectedField and progress field types
          const label = 'label' in field ? field.label : fieldLabel(field as any)
          const fieldName = 'name' in field ? field.name : field.id || field.name

          // Try multiple ways to find the status
          let status = progressMap.get(label)
          if (!status) {
            status = progressMap.get(fieldName)
          }
          if (!status) {
            // Try matching by any field in fieldProgress
            const match = fieldProgress.find(f =>
              f.fieldName === fieldName ||
              f.label === label ||
              f.label === fieldName ||
              f.fieldName === label
            )
            status = match?.status
          }

          console.log("Field:", { label, fieldName, status })

          return (
            <div key={i} className={`popup-field-item ${status ? `popup-field-${status}` : ''}`}>
              <div className="popup-field-left">
                <span className="material-symbols-outlined">
                  {status === 'filled' ? 'check_circle' : status === 'failed' ? 'cancel' : fieldIcon(field as any)}
                </span>
                <span className={status === 'filled' ? 'popup-field-label-filled' : ''}>{label}</span>
              </div>
              {status && (
                <span className="material-symbols-outlined popup-field-check">
                  {status === 'filled' ? 'check_box' : 'error'}
                </span>
              )}
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

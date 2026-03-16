import { useState, useEffect, useRef, DragEvent } from 'react'
import { DashboardProvider, useNav, usePlan, useSync } from '../contexts/DashboardContext'
import { extractTextFromPDF, isPDFFile, isPDFContent } from '../utils/pdfExtractor'
import { CVGenerator } from '../popup/components/CVGenerator'
import './Options.css'

// Storage keys
const STORAGE_KEYS = {
  PARSED_CV: 'parsedCV',
  SELECTED_ROLE: 'selectedRole',
  CV_VISIBILITY: 'cvVisibility'
}

// ============================================
// INTERFACES
//============================================

interface PersonalInfo {
  firstName: string
  lastName: string
  email: string
  phone: string
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say'
  address?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  linkedIn?: string
  portfolio?: string
}

interface WorkExperience {
  id: string
  role: string
  company: string
  startDate: string
  endDate?: string
  current: boolean
  highlights: string[]
  skills: string[]
  visibleInCV: boolean
}

interface Project {
  id: string
  name: string
  description: string
  technologies: string[]
  url?: string
  highlights: string[]
  visibleInCV: boolean
}

interface Education {
  id: string
  degree: string
  school: string
  field?: string
  graduationYear?: string
  visibleInCV: boolean
}

interface ParsedCV {
  personal: PersonalInfo
  professional: {
    currentTitle: string
    summary: string
    yearsOfExperience: number
  }
  skills: Record<string, string[]> // Dynamic categories
  experience: WorkExperience[]
  projects: Project[]
  education: Education[]
  rawText: string
  parsedAt: number
}

// ============================================
// ICONS COMPONENT
//============================================

const Icon = ({ name, className = '' }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className.replace(/^!/, '')}`}>{name}</span>
)

// ============================================
// SIDEBAR COMPONENT
//============================================

const Sidebar = () => {
  const { activeNav, setActiveNav } = useNav()
  const { planUsage } = usePlan()

  const navItems = [
    { id: 'cv' as const, icon: 'person', label: 'CV Profile' },
    { id: 'generate-cv' as const, icon: 'description', label: 'Generate CV' },
    { id: 'api-keys' as const, icon: 'key', label: 'API Keys' },
  ]

  const usagePercentage = (planUsage.used / planUsage.total) * 100

  return (
    <aside className="sidebar-glass">
      <div className="sidebar-header">
        <div className="app-logo">
          <Icon name="auto_awesome" />
        </div>
        <div className="app-brand">
          <h1>Applied</h1>
          <p>AI Job Assistant</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${activeNav === item.id ? 'nav-item-active' : ''}`}
            onClick={() => setActiveNav(item.id)}
          >
            <Icon name={item.icon} />
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="plan-usage-card">
          <p className="plan-label">Plan Usage</p>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${usagePercentage}%` }} />
          </div>
          <p className="plan-text">
            {planUsage.used} / {planUsage.total} AI tokens used
          </p>
        </div>
      </div>
    </aside>
  )
}

// ============================================
// CV PROFILE VIEW
//============================================

const CVProfileView = ({ parsedCV, setParsedCV, personalInfo, setPersonalInfo, isEditing, setIsEditing, onReupload, uploadState, uploadProgress, statusMessage, setStatusMessage, handleFileUpload }: {
  parsedCV: ParsedCV | null
  setParsedCV: (cv: ParsedCV | null) => void
  personalInfo: PersonalInfo
  setPersonalInfo: (info: PersonalInfo) => void
  isEditing: boolean
  setIsEditing: (editing: boolean) => void
  onReupload: () => void
  uploadState: 'idle' | 'uploading' | 'uploaded' | 'parsing' | 'almost-done' | 'complete'
  uploadProgress: number
  statusMessage: string
  setStatusMessage: (msg: string) => void
  handleFileUpload: (file: File) => Promise<void>
}) => {
  const { lastSync } = useSync()

  // Local state for editable data
  const [editableCV, setEditableCV] = useState<ParsedCV | null>(null)
  const [editingSkills, setEditingSkills] = useState<Record<string, string[]> | null>(parsedCV?.skills || null)
  const [newSkillInputs, setNewSkillInputs] = useState<Record<string, string>>({})

  // Initialize newSkillInputs when editingSkills changes
  useEffect(() => {
    if (editingSkills && isEditing) {
      const inputs: Record<string, string> = {}
      Object.keys(editingSkills).forEach(category => {
        inputs[category] = ''
      })
      setNewSkillInputs(inputs)
    }
  }, [editingSkills, isEditing])

  // Update editableCV when parsedCV changes
  useEffect(() => {
    if (parsedCV && !isEditing) {
      setEditableCV(parsedCV)
      setEditingSkills(parsedCV.skills)
    }
  }, [parsedCV, isEditing])

  const formatSyncTime = () => {
    if (!lastSync) return 'Never'
    const now = new Date()
    const diff = Math.floor((now.getTime() - lastSync.getTime()) / 1000 / 60)
    if (diff < 1) return 'Just now'
    if (diff < 60) return `${diff} minute${diff > 1 ? 's' : ''} ago`
    return 'Earlier today'
  }

  const UploadDropzone = () => {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isDragging, setIsDragging] = useState(false)

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0 && isPDFFile(files[0])) {
        handleFileUpload(files[0])
      }
    }

    return (
      <div
        className={`upload-dropzone ${isDragging ? 'dragging' : ''}`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => fileInputRef.current?.click()}
      >
        <Icon name="upload_file" className="upload-icon" />
        <h3>Upload your CV</h3>
        <p>Drag and drop your PDF resume here, or click to browse</p>
        <p className="upload-hint">AI will automatically extract and fill your profile information</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = e.target.files
            if (files && files.length > 0) handleFileUpload(files[0])
          }}
        />
      </div>
    )
  }

  const ParsingStatus = ({ stage, progress }: { stage: typeof uploadState, progress: number }) => {
    const stages = [
      { id: 'uploading', label: 'Uploading', icon: 'cloud_upload' },
      { id: 'uploaded', label: 'Uploaded', icon: 'check_circle' },
      { id: 'parsing', label: 'Parsing', icon: 'description' },
      { id: 'almost-done', label: 'Processing', icon: 'psychology' },
      { id: 'complete', label: 'Complete', icon: 'done_all' },
    ]

    const currentIndex = stages.findIndex(s => s.id === stage)

    return (
      <div className="parsing-status">
        <div className="status-steps">
          {stages.map((s, index) => (
            <div
              key={s.id}
              className={`status-step ${index <= currentIndex ? 'active' : ''} ${index === currentIndex ? 'current' : ''}`}
            >
              <div className="step-icon">
                <Icon name={s.icon} />
              </div>
              <span className="step-label">{s.label}</span>
            </div>
          ))}
        </div>
        <div className="status-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    )
  }

  // Add skill
  const addSkill = (category: string) => {
    if (!editingSkills) return
    const inputValue = newSkillInputs[category]?.trim() || ''
    if (inputValue && !editingSkills[category]?.includes(inputValue)) {
      setEditingSkills({
        ...editingSkills,
        [category]: [...(editingSkills[category] || []), inputValue]
      })
      setNewSkillInputs({
        ...newSkillInputs,
        [category]: ''
      })
    }
  }

  // Remove skill
  const removeSkill = (category: string, skillToRemove: string) => {
    if (!editingSkills) return
    setEditingSkills({
      ...editingSkills,
      [category]: editingSkills[category]?.filter((s: string) => s !== skillToRemove) || []
    })
  }

  return (
    <>
      <header className="page-header">
        <div className="header-title">
          <h2>Resume Profile</h2>
          <div className="sync-status">
            <Icon name="sync" className="sync-icon" />
            <span>Last synced: {parsedCV ? formatSyncTime() : 'Never'}</span>
          </div>
          {statusMessage && (
            <div className="status-message">{statusMessage}</div>
          )}
        </div>
        <div className="header-actions">
          {parsedCV && (
            <>
              <button className="btn-outline" onClick={() => {
                if (isEditing) {
                  // Cancel - revert changes
                  setEditableCV(parsedCV)
                  setEditingSkills(parsedCV.skills)
                }
                setIsEditing(!isEditing)
              }}>
                <Icon name="edit" /> {isEditing ? 'Cancel' : 'Edit Profile'}
              </button>
              <button className="btn-outline" onClick={onReupload}>
                <Icon name="upload" /> Re-upload CV
              </button>
            </>
          )}
          <button className="btn-primary" onClick={() => {
            if (isEditing && editableCV && editingSkills) {
              // Save changes
              const updatedCV = {
                ...editableCV,
                skills: editingSkills
              }
              chrome.storage.local.set({
                [STORAGE_KEYS.PARSED_CV]: updatedCV
              })
              setParsedCV(updatedCV)
              setPersonalInfo(updatedCV.personal)
              setIsEditing(false)
              setStatusMessage('Profile saved successfully!')
              setTimeout(() => setStatusMessage(''), 3000)
            }
          }}>
            <Icon name="save" /> {isEditing ? 'Save Changes' : 'Save & Update'}
          </button>
        </div>
      </header>

      {!parsedCV ? (
        <div className="upload-section">
          {uploadState === 'idle' ? <UploadDropzone /> : <ParsingStatus stage={uploadState} progress={uploadProgress} />}
        </div>
      ) : (
        <div className="content-sections">
          {/* Personal Information */}
          <section className="glass-card section-card">
            <div className="section-header">
              <Icon name="badge" className="section-icon" />
              <h3>Personal Information</h3>
            </div>
            <div className="form-grid">
              <div className="input-group">
                <label>Full Name</label>
                <input
                  type="text"
                  value={`${editableCV?.personal?.firstName || ''} ${editableCV?.personal?.lastName || ''}`.trim()}
                  onChange={(e) => {
                    if (!isEditing || !editableCV) return
                    const [first, ...rest] = e.target.value.split(' ')
                    setEditableCV({
                      ...editableCV,
                      personal: {
                        ...editableCV.personal,
                        firstName: first || '',
                        lastName: rest.join(' ') || ''
                      }
                    })
                  }}
                  className="input-field"
                  readOnly={!isEditing}
                  style={{ backgroundColor: isEditing ? 'rgba(15, 23, 42, 0.8)' : '' }}
                />
              </div>
              <div className="input-group">
                <label>Email Address</label>
                <input
                  type="email"
                  value={editableCV?.personal?.email || ''}
                  onChange={(e) => {
                    if (!isEditing || !editableCV) return
                    setEditableCV({
                      ...editableCV,
                      personal: { ...editableCV.personal, email: e.target.value }
                    })
                  }}
                  className="input-field"
                  readOnly={!isEditing}
                  style={{ backgroundColor: isEditing ? 'rgba(15, 23, 42, 0.8)' : '' }}
                />
              </div>
              <div className="input-group">
                <label>Phone Number</label>
                <input
                  type="text"
                  value={editableCV?.personal?.phone || ''}
                  onChange={(e) => {
                    if (!isEditing || !editableCV) return
                    setEditableCV({
                      ...editableCV,
                      personal: { ...editableCV.personal, phone: e.target.value }
                    })
                  }}
                  className="input-field"
                  readOnly={!isEditing}
                  style={{ backgroundColor: isEditing ? 'rgba(15, 23, 42, 0.8)' : '' }}
                />
              </div>

              <div className="input-group">
                <label>Gender</label>
                <select
                  value={editableCV?.personal?.gender || 'prefer_not_to_say'}
                  onChange={(e) => {
                    if (!isEditing || !editableCV) return
                    setEditableCV({
                      ...editableCV,
                      personal: { ...editableCV.personal, gender: e.target.value as 'male' | 'female' | 'other' | 'prefer_not_to_say' }
                    })
                  }}
                  className="input-field"
                  disabled={!isEditing}
                  style={{ backgroundColor: isEditing ? 'rgba(15, 23, 42, 0.8)' : '', opacity: isEditing ? 1 : 0.6 }}
                >
                  <option value="prefer_not_to_say">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="input-group">
                <label>City</label>
                <input
                  type="text"
                  value={editableCV?.personal?.city || ''}
                  onChange={(e) => {
                    if (!isEditing || !editableCV) return
                    setEditableCV({
                      ...editableCV,
                      personal: { ...editableCV.personal, city: e.target.value }
                    })
                  }}
                  className="input-field"
                  readOnly={!isEditing}
                  style={{ backgroundColor: isEditing ? 'rgba(15, 23, 42, 0.8)' : '' }}
                />
              </div>
              <div className="input-group">
                <label>State</label>
                <input
                  type="text"
                  value={editableCV?.personal?.state || ''}
                  onChange={(e) => {
                    if (!isEditing || !editableCV) return
                    setEditableCV({
                      ...editableCV,
                      personal: { ...editableCV.personal, state: e.target.value }
                    })
                  }}
                  className="input-field"
                  readOnly={!isEditing}
                  style={{ backgroundColor: isEditing ? 'rgba(15, 23, 42, 0.8)' : '' }}
                />
              </div>
              <div className="input-group">
                <label>Country</label>
                <input
                  type="text"
                  value={editableCV?.personal?.country || ''}
                  onChange={(e) => {
                    if (!isEditing || !editableCV) return
                    setEditableCV({
                      ...editableCV,
                      personal: { ...editableCV.personal, country: e.target.value }
                    })
                  }}
                  className="input-field"
                  readOnly={!isEditing}
                  style={{ backgroundColor: isEditing ? 'rgba(15, 23, 42, 0.8)' : '' }}
                />
              </div>
              {isEditing && (
                <div className="input-group">
                  <label>LinkedIn</label>
                  <input
                    type="text"
                    value={editableCV?.personal?.linkedIn || ''}
                    onChange={(e) => {
                      if (!editableCV) return
                      setEditableCV({
                        ...editableCV,
                        personal: { ...editableCV.personal, linkedIn: e.target.value }
                      })
                    }}
                    className="input-field"
                    placeholder="https://linkedin.com/in/yourprofile"
                  />
                </div>
              )}
              {isEditing && (
                <div className="input-group">
                  <label>Portfolio/Website</label>
                  <input
                    type="text"
                    value={editableCV?.personal?.portfolio || ''}
                    onChange={(e) => {
                      if (!editableCV) return
                      setEditableCV({
                        ...editableCV,
                        personal: { ...editableCV.personal, portfolio: e.target.value }
                      })
                    }}
                    className="input-field"
                    placeholder="https://yourportfolio.com"
                  />
                </div>
              )}
            </div>
          </section>

          {/* Professional Summary */}
          {editableCV?.professional && (
            <section className="glass-card section-card">
              <div className="section-header">
                <Icon name="description" className="section-icon" />
                <h3>Professional Summary</h3>
              </div>
              <div className="input-group">
                <label>Current Title</label>
                <input
                  type="text"
                  value={editableCV.professional.currentTitle}
                  onChange={(e) => {
                    if (!isEditing || !editableCV) return
                    setEditableCV({
                      ...editableCV,
                      professional: {
                        ...editableCV.professional,
                        currentTitle: e.target.value
                      }
                    })
                  }}
                  className="input-field"
                  readOnly={!isEditing}
                  style={{ backgroundColor: isEditing ? 'rgba(15, 23, 42, 0.8)' : '' }}
                />
              </div>
              <div className="input-group">
                <label>Summary</label>
                <textarea
                  value={editableCV.professional.summary}
                  onChange={(e) => {
                    if (!isEditing || !editableCV) return
                    setEditableCV({
                      ...editableCV,
                      professional: {
                        ...editableCV.professional,
                        summary: e.target.value
                      }
                    })
                  }}
                  className="input-field"
                  rows={4}
                  readOnly={!isEditing}
                  style={{ minHeight: '100px', resize: 'vertical', backgroundColor: isEditing ? 'rgba(15, 23, 42, 0.8)' : '' }}
                />
              </div>
            </section>
          )}

          {/* Skills - All Categories */}
          <section className="glass-card section-card">
            <div className="section-header">
              <Icon name="bolt" className="section-icon" />
              <h3>Skills</h3>
            </div>

            {/* Dynamic Skills Categories */}
            {editingSkills && Object.keys(editingSkills).length > 0 && (
              <>
                {Object.entries(editingSkills).map(([category, skills]) => (
                  skills.length > 0 && (
                    <div key={category} style={{ marginBottom: '1.5rem' }}>
                      <label className="sub-header" style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--primary)', marginBottom: '0.75rem', display: 'block' }}>
                        {category} ({skills.length})
                      </label>
                      <div className="skills-container">
                        {skills.map((skill) => (
                          <span key={skill} className="skill-tag">
                            {skill}
                            {isEditing && (
                              <button
                                onClick={() => removeSkill(category, skill)}
                                style={{
                                  marginLeft: '6px',
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  fontSize: '16px',
                                  fontWeight: 'bold',
                                  padding: 0
                                }}
                                title="Remove skill"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                      {isEditing && (
                        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                          <input
                            type="text"
                            placeholder={`Add ${category.toLowerCase()} skill...`}
                            value={newSkillInputs[category] || ''}
                            onChange={(e) => setNewSkillInputs({ ...newSkillInputs, [category]: e.target.value })}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                addSkill(category)
                              }
                            }}
                            className="input-field"
                            style={{ flex: 1, padding: '0.5rem' }}
                          />
                          <button
                            onClick={() => addSkill(category)}
                            className="btn-outline"
                            style={{ padding: '0.5rem 1rem' }}
                          >
                            Add
                          </button>
                        </div>
                      )}
                    </div>
                  )
                ))}
              </>
            )}
          </section>

        {/* Projects */}
        {editableCV?.projects && editableCV.projects.length > 0 && (
            <section className="glass-card section-card">
              <div className="section-header">
                <Icon name="rocket_launch" className="section-icon" />
                <h3>Projects</h3>
              </div>
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {editableCV.projects.map((proj, projIndex) => (
                    <div key={proj.id} style={{
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '0.5rem',
                      padding: '1rem',
                      background: 'rgba(15, 23, 42, 0.5)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h4 style={{ margin: 0 }}>Project #{projIndex + 1}</h4>
                        <button
                          onClick={() => {
                            if (!editableCV) return
                            setEditableCV({
                              ...editableCV,
                              projects: editableCV.projects.filter(p => p.id !== proj.id)
                            })
                          }}
                          className="btn-outline"
                          style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#ef4444' }}
                        >
                          Delete
                        </button>
                      </div>
                      <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                        <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                          <label>Project Name</label>
                          <input
                            type="text"
                            value={proj.name}
                            onChange={(e) => {
                              if (!editableCV) return
                              const newProjects = [...editableCV.projects]
                              newProjects[projIndex] = { ...proj, name: e.target.value }
                              setEditableCV({ ...editableCV, projects: newProjects })
                            }}
                            className="input-field"
                          />
                        </div>
                        <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                          <label>Description</label>
                          <textarea
                            value={proj.description}
                            onChange={(e) => {
                              if (!editableCV) return
                              const newProjects = [...editableCV.projects]
                              newProjects[projIndex] = { ...proj, description: e.target.value }
                              setEditableCV({ ...editableCV, projects: newProjects })
                            }}
                            className="input-field"
                            rows={3}
                          />
                        </div>
                        <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                          <label>Project URL</label>
                          <input
                            type="text"
                            value={proj.url || ''}
                            onChange={(e) => {
                              if (!editableCV) return
                              const newProjects = [...editableCV.projects]
                              newProjects[projIndex] = { ...proj, url: e.target.value || undefined }
                              setEditableCV({ ...editableCV, projects: newProjects })
                            }}
                            className="input-field"
                            placeholder="https://..."
                          />
                        </div>
                        <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                          <label>Technologies (comma-separated)</label>
                          <input
                            type="text"
                            value={proj.technologies?.join(', ') || ''}
                            onChange={(e) => {
                              if (!editableCV) return
                              const newProjects = [...editableCV.projects]
                              newProjects[projIndex] = {
                                ...proj,
                                technologies: e.target.value.split(',').map(t => t.trim()).filter(t => t)
                              }
                              setEditableCV({ ...editableCV, projects: newProjects })
                            }}
                            className="input-field"
                            placeholder="React, TypeScript, Node.js"
                          />
                        </div>
                      </div>
                      <div className="input-group" style={{ marginTop: '1rem' }}>
                        <label>Highlights (one per line)</label>
                        <textarea
                          value={proj.highlights?.join('\n') || ''}
                          onChange={(e) => {
                            if (!editableCV) return
                            const newProjects = [...editableCV.projects]
                            newProjects[projIndex] = {
                              ...proj,
                              highlights: e.target.value.split('\n').filter(h => h.trim())
                            }
                            setEditableCV({ ...editableCV, projects: newProjects })
                          }}
                          className="input-field"
                          rows={3}
                          style={{ minHeight: '80px', resize: 'vertical' }}
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      if (!editableCV) return
                      const newProj: Project = {
                        id: `proj-${Date.now()}`,
                        name: '',
                        description: '',
                        technologies: [],
                        url: '',
                        highlights: [],
                        visibleInCV: true
                      }
                      setEditableCV({
                        ...editableCV,
                        projects: [...editableCV.projects, newProj]
                      })
                    }}
                    className="btn-outline"
                    style={{ borderStyle: 'dashed' }}
                  >
                    + Add Project
                  </button>
                </div>
              ) : (
                <div className="timeline">
                  {editableCV.projects.map((proj) => (
                    <div key={proj.id} className="timeline-item">
                      <div className="timeline-dot" style={{ background: '#10b981' }} />
                      <div className="timeline-content">
                        <div className="timeline-header-row">
                          <div>
                            <h4>{proj.name}</h4>
                            {proj.url && (
                              <a href={proj.url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '0.875rem' }}>
                                🔗 View Project
                              </a>
                            )}
                          </div>
                          {proj.technologies && proj.technologies.length > 0 && (
                            <span className="timeline-date" style={{ display: 'flex', gap: '0.5rem' }}>
                              {proj.technologies.map(tech => (
                                <span key={tech} className="skill-tag" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>{tech}</span>
                              ))}
                            </span>
                          )}
                        </div>
                        <p className="timeline-description">{proj.description}</p>
                        {proj.highlights && proj.highlights.length > 0 && (
                          <ul style={{ marginTop: '0.5rem', paddingLeft: '1rem' }}>
                            {proj.highlights.map((highlight, idx) => (
                              <li key={idx} style={{ color: 'var(--text-slate-300)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                                • {highlight}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Education */}
          {editableCV?.education && editableCV.education.length > 0 && (
            <section className="glass-card section-card">
              <div className="section-header">
                <Icon name="school" className="section-icon" />
                <h3>Education</h3>
              </div>
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {editableCV.education.map((edu, eduIndex) => (
                    <div key={edu.id} style={{
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '0.5rem',
                      padding: '1rem',
                      background: 'rgba(15, 23, 42, 0.5)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h4 style={{ margin: 0 }}>Education #{eduIndex + 1}</h4>
                        <button
                          onClick={() => {
                            if (!editableCV) return
                            setEditableCV({
                              ...editableCV,
                              education: editableCV.education.filter(e => e.id !== edu.id)
                            })
                          }}
                          className="btn-outline"
                          style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#ef4444' }}
                        >
                          Delete
                        </button>
                      </div>
                      <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                        <div className="input-group">
                          <label>Degree</label>
                          <input
                            type="text"
                            value={edu.degree}
                            onChange={(e) => {
                              if (!editableCV) return
                              const newEducation = [...editableCV.education]
                              newEducation[eduIndex] = { ...edu, degree: e.target.value }
                              setEditableCV({ ...editableCV, education: newEducation })
                            }}
                            className="input-field"
                            placeholder="e.g., Bachelor of Science"
                          />
                        </div>
                        <div className="input-group">
                          <label>School</label>
                          <input
                            type="text"
                            value={edu.school}
                            onChange={(e) => {
                              if (!editableCV) return
                              const newEducation = [...editableCV.education]
                              newEducation[eduIndex] = { ...edu, school: e.target.value }
                              setEditableCV({ ...editableCV, education: newEducation })
                            }}
                            className="input-field"
                            placeholder="e.g., MIT"
                          />
                        </div>
                        <div className="input-group">
                          <label>Field</label>
                          <input
                            type="text"
                            value={edu.field || ''}
                            onChange={(e) => {
                              if (!editableCV) return
                              const newEducation = [...editableCV.education]
                              newEducation[eduIndex] = { ...edu, field: e.target.value || undefined }
                              setEditableCV({ ...editableCV, education: newEducation })
                            }}
                            className="input-field"
                            placeholder="e.g., Computer Science"
                          />
                        </div>
                        <div className="input-group">
                          <label>Graduation Year</label>
                          <input
                            type="text"
                            value={edu.graduationYear || ''}
                            onChange={(e) => {
                              if (!editableCV) return
                              const newEducation = [...editableCV.education]
                              newEducation[eduIndex] = { ...edu, graduationYear: e.target.value || undefined }
                              setEditableCV({ ...editableCV, education: newEducation })
                            }}
                            className="input-field"
                            placeholder="e.g., 2020"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      if (!editableCV) return
                      const newEdu: Education = {
                        id: `edu-${Date.now()}`,
                        degree: '',
                        school: '',
                        field: '',
                        graduationYear: '',
                        visibleInCV: true
                      }
                      setEditableCV({
                        ...editableCV,
                        education: [...editableCV.education, newEdu]
                      })
                    }}
                    className="btn-outline"
                    style={{ borderStyle: 'dashed' }}
                  >
                    + Add Education
                  </button>
                </div>
              ) : (
                <div className="timeline">
                  {editableCV.education.map((edu) => (
                    <div key={edu.id} className="timeline-item">
                      <div className="timeline-dot" style={{ background: '#8b5cf6' }} />
                      <div className="timeline-content">
                        <div className="timeline-header-row">
                          <div>
                            <h4>{edu.degree}</h4>
                            <p style={{ color: 'var(--text-slate-300)', fontSize: '0.875rem' }}>
                              {edu.school}
                              {edu.field && ` • ${edu.field}`}
                            </p>
                          </div>
                          {edu.graduationYear && (
                            <span className="timeline-date">{edu.graduationYear}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </>
  )
}

// ============================================
// API KEYS VIEW
//============================================

const APIKeysView = ({ apiKeys, setApiKeys, settings, setSettings }: {
  apiKeys: { openai: string; gemini: string; zhipu: string; openrouter: string }
  setApiKeys: (keys: { openai: string; gemini: string; zhipu: string; openrouter: string }) => void
  settings: { aiProvider: 'openai' | 'gemini' | 'zhipu' | 'openrouter'; aiModel: string; aiModelName: string }
  setSettings: (settings: { aiProvider: 'openai' | 'gemini' | 'zhipu' | 'openrouter'; aiModel: string; aiModelName: string }) => void
}) => {
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'gemini' | 'zhipu' | 'openrouter'>(settings.aiProvider)
  const [availableModels, setAvailableModels] = useState<{ id: string; name: string }[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [testStatus, setTestStatus] = useState<{
    provider: string
    status: 'loading' | 'success' | 'error'
    message: string
  } | null>(null)
  const [saveStatus, setSaveStatus] = useState('')

  // 🎯 Token Tracking State
  const [tokenHistory, setTokenHistory] = useState<any[]>([])
  const [showTokenHistory, setShowTokenHistory] = useState(false)

  // Load token history on mount
  useEffect(() => {
    const loadTokenHistory = async () => {
      try {
        const result = await chrome.storage.local.get('tokenHistory')
        setTokenHistory(result.tokenHistory || [])
      } catch (error) {
        console.error('[Token History] Failed to load:', error)
      }
    }

    loadTokenHistory()
  }, [])

  // Fetch models when provider tab changes or API key changes
  useEffect(() => {
    const loadSavedModels = async () => {
      const apiKey = apiKeys[selectedProvider]
      if (!apiKey) {
        setAvailableModels([])
        return
      }

      setIsLoadingModels(true)

      try {
        const response = await chrome.runtime.sendMessage({
          action: 'fetchModels',
          provider: selectedProvider,
          apiKey
        })

        if (response.success && response.models) {
          setAvailableModels(response.models)
        } else {
          // Defaults
          const defaultModels = selectedProvider === 'openai' ? [
            { id: 'gpt-4o', name: 'GPT-4o' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
          ] : selectedProvider === 'gemini' ? [
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
            { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
          ] : selectedProvider === 'openrouter' ? [
            { id: 'nvidia/nemotron-3-nano-30b-a3b:free', name: 'NVIDIA Nemotron 30B (Free)' },
            { id: 'arcee-ai/trinity-large-preview:free', name: 'Arcee Trinity Large (Free)' },
            { id: 'liquid/lfm-2.5-1.2b-instruct:free', name: 'LFM 2.5 Instruct (Free)' },
          ] : [
            { id: 'glm-5', name: 'GLM-5' },
          ]
          setAvailableModels(defaultModels)
        }
      } catch (err) {
        console.error('Failed to load models for provider:', err)
      } finally {
        setIsLoadingModels(false)
      }
    }

    loadSavedModels()
  }, [selectedProvider, apiKeys[selectedProvider]])

  const handleSaveApiKey = async (provider: 'openai' | 'gemini' | 'zhipu' | 'openrouter') => {
    const apiKey = apiKeys[provider]
    if (!apiKey.trim()) {
      setSaveStatus('Please enter an API key')
      setTimeout(() => setSaveStatus(''), 3000)
      return
    }

    setSaveStatus(`Testing ${provider.toUpperCase()} API key...`)

    // 🔍 First test the API key
    try {
      const testResponse = await chrome.runtime.sendMessage({
        action: 'testAPI',
        provider,
        apiKey,
      })

      if (!testResponse.success) {
        setSaveStatus(`❌ API Key Test Failed: ${testResponse.message}`)
        setTimeout(() => setSaveStatus(''), 5000)
        return
      }

      setSaveStatus(`✅ API Key Valid! Saving ${provider.toUpperCase()} API key...`)

      // Save the API key
      await chrome.runtime.sendMessage({
        action: 'saveApiKey',
        provider,
        apiKey
      })

      // Fetch available models after saving API key
      setIsLoadingModels(true)
      setSaveStatus(`Fetching ${provider.toUpperCase()} models...`)

      const response = await chrome.runtime.sendMessage({
        action: 'fetchModels',
        provider,
        apiKey
      })

      if (response.success && response.models) {
        setAvailableModels(response.models)
        setSaveStatus(`✅ Found ${response.models.length} models!`)

        // Auto-select first model if none selected or always update to first model
        if (response.models.length > 0) {
          const firstModel = response.models[0]
          const newSettings = {
            ...settings,
            aiProvider: provider,
            aiModel: firstModel.id,
            aiModelName: firstModel.name
          }
          setSettings(newSettings)

          // Save to storage
          await chrome.runtime.sendMessage({
            action: 'saveModel',
            model: firstModel.id,
            modelName: firstModel.name
          })

          // Save provider config with the auto-selected model
          await chrome.runtime.sendMessage({
            action: 'saveProviderConfig',
            provider,
            apiKey,
            model: firstModel.id,
            modelName: firstModel.name
          })

          // 🎯 CRITICAL: Set this provider as active
          await chrome.runtime.sendMessage({
            action: 'saveActiveProvider',
            provider
          })
        }
      } else {
        console.warn('[handleSaveApiKey] Failed to fetch models, using defaults:', response)
        setSaveStatus('Using default models.')
        // Set default models
        const defaultModels = provider === 'openai' ? [
          { id: 'gpt-4o', name: 'GPT-4o' },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
          { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
        ] : provider === 'gemini' ? [
          { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
          { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
        ] : [
          { id: 'glm-5', name: 'GLM-5' },
          { id: 'glm-4', name: 'GLM-4' },
        ]
        setAvailableModels(defaultModels)

        // Also save default model
        const firstModel = defaultModels[0]
        const newSettings = {
          ...settings,
          aiProvider: provider,
          aiModel: firstModel.id,
          aiModelName: firstModel.name
        }
        setSettings(newSettings)

        await chrome.runtime.sendMessage({
          action: 'saveModel',
          model: firstModel.id,
          modelName: firstModel.name
        })

        await chrome.runtime.sendMessage({
          action: 'saveProviderConfig',
          provider,
          apiKey,
          model: firstModel.id,
          modelName: firstModel.name
        })

        // 🎯 CRITICAL: Set this provider as active
        await chrome.runtime.sendMessage({
          action: 'saveActiveProvider',
          provider
        })
      }
    } catch (error) {
      setSaveStatus('Error fetching models: ' + String(error))
    } finally {
      setIsLoadingModels(false)
      setTimeout(() => setSaveStatus(''), 5000)
    }
  }

  const handleModelChange = async (modelId: string) => {
    const modelName = availableModels.find(m => m.id === modelId)?.name || modelId

    const newSettings = {
      ...settings,
      aiProvider: selectedProvider,
      aiModel: modelId,
      aiModelName: modelName
    }
    setSettings(newSettings)

    await chrome.runtime.sendMessage({
      action: 'saveModel',
      model: modelId,
      modelName
    })

    // Also update the provider config with the new model
    if (apiKeys[selectedProvider]) {
      await chrome.runtime.sendMessage({
        action: 'saveProviderConfig',
        provider: selectedProvider,
        apiKey: apiKeys[selectedProvider],
        model: modelId,
        modelName
      })
    }

    setSaveStatus('Model selected: ' + modelName)
    setTimeout(() => setSaveStatus(''), 3000)
  }

  const handleTestAPI = async (provider: 'openai' | 'gemini' | 'zhipu' | 'openrouter') => {
    const apiKey = apiKeys[provider]
    if (!apiKey) {
      setTestStatus({
        provider,
        status: 'error',
        message: 'Please enter an API key first'
      })
      return
    }

    setTestStatus({
      provider,
      status: 'loading',
      message: 'Testing API connection...'
    })

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'testAPI',
        provider,
        apiKey,
        model: settings.aiModel
      })

      if (response.success) {
        setTestStatus({
          provider,
          status: 'success',
          message: response.message
        })
      } else {
        setTestStatus({
          provider,
          status: 'error',
          message: response.message
        })
      }
    } catch (error) {
      setTestStatus({
        provider,
        status: 'error',
        message: 'Test failed: ' + String(error)
      })
    }

    setTimeout(() => setTestStatus(null), 5000)
  }

  return (
    <>
      <header className="page-header">
        <div className="header-title">
          <h2>API Configuration</h2>
          <p style={{ color: 'var(--text-slate-400)', margin: 0 }}>
            Add API keys for AI-powered CV parsing and enhancement
          </p>
        </div>
      </header>

      <div className="content-sections">
        <section className="glass-card section-card">
          <div className="section-header">
            <Icon name="key" className="section-icon" />
            <h3>AI Provider Setup</h3>
          </div>

          {/* Provider Tabs */}
          <div className="provider-tabs">
            {(['openai', 'gemini', 'zhipu', 'openrouter'] as const).map(provider => (
              <button
                key={provider}
                className={`provider-tab ${selectedProvider === provider ? 'provider-tab-active' : ''}`}
                onClick={() => setSelectedProvider(provider)}
              >
                {provider === 'openai' && 'OpenAI (ChatGPT)'}
                {provider === 'gemini' && 'Google Gemini'}
                {provider === 'zhipu' && 'Zhipu AI'}
                {provider === 'openrouter' && 'OpenRouter (Free)'}
              </button>
            ))}
          </div>

          {/* API Key Input */}
          <div className="api-key-section">
            {selectedProvider === 'openai' && (
              <>
                <div className="input-group">
                  <label>OpenAI API Key</label>
                  <input
                    type="password"
                    placeholder="sk-..."
                    value={apiKeys.openai}
                    onChange={(e) => setApiKeys({ ...apiKeys, openai: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div className="api-actions">
                  <button
                    className="btn-outline"
                    onClick={() => handleTestAPI('openai')}
                    disabled={testStatus?.provider === 'openai' && testStatus.status === 'loading'}
                  >
                    {testStatus?.provider === 'openai' && testStatus.status === 'loading' ? 'Testing...' : 'Test Connection'}
                  </button>
                  <button className="btn-primary" onClick={() => handleSaveApiKey('openai')}>
                    Save & Fetch Models
                  </button>
                </div>
                {testStatus?.provider === 'openai' && (
                  <div className={`test-status test-status-${testStatus.status}`}>
                    {testStatus.message}
                  </div>
                )}
                {saveStatus && selectedProvider === 'openai' && (
                  <div className="test-status test-status-loading">{saveStatus}</div>
                )}
                {availableModels.length > 0 && selectedProvider === 'openai' && (
                  <div className="input-group">
                    <label>Select Model</label>
                    <select
                      value={settings.aiModel}
                      onChange={(e) => handleModelChange(e.target.value)}
                      disabled={isLoadingModels}
                      className="input-field"
                    >
                      {availableModels.map(model => (
                        <option key={model.id} value={model.id} style={{ background: 'var(--bg-dark)' }}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                    {isLoadingModels && <span style={{ fontSize: '0.75rem', color: 'var(--text-slate-400)' }}>Loading models...</span>}
                  </div>
                )}
                <div className="api-help">
                  <h4>How to get an OpenAI API key:</h4>
                  <ol>
                    <li>Go to <a href="https://platform.openai.com" target="_blank" rel="noopener noreferrer">platform.openai.com</a></li>
                    <li>Sign up or log in to your account</li>
                    <li>Navigate to API Keys section</li>
                    <li>Create a new secret key</li>
                    <li>Copy and paste it here</li>
                  </ol>
                </div>
              </>
            )}

            {selectedProvider === 'gemini' && (
              <>
                <div className="input-group">
                  <label>Gemini API Key</label>
                  <input
                    type="password"
                    placeholder="AIza..."
                    value={apiKeys.gemini}
                    onChange={(e) => setApiKeys({ ...apiKeys, gemini: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div className="api-actions">
                  <button
                    className="btn-outline"
                    onClick={() => handleTestAPI('gemini')}
                    disabled={testStatus?.provider === 'gemini' && testStatus.status === 'loading'}
                  >
                    {testStatus?.provider === 'gemini' && testStatus.status === 'loading' ? 'Testing...' : 'Test Connection'}
                  </button>
                  <button className="btn-primary" onClick={() => handleSaveApiKey('gemini')}>
                    Save & Fetch Models
                  </button>
                </div>
                {testStatus?.provider === 'gemini' && (
                  <div className={`test-status test-status-${testStatus.status}`}>
                    {testStatus.message}
                  </div>
                )}
                {saveStatus && selectedProvider === 'gemini' && (
                  <div className="test-status test-status-loading">{saveStatus}</div>
                )}
                {availableModels.length > 0 && selectedProvider === 'gemini' && (
                  <div className="input-group">
                    <label>Select Model</label>
                    <select
                      value={settings.aiModel}
                      onChange={(e) => handleModelChange(e.target.value)}
                      disabled={isLoadingModels}
                      className="input-field"
                    >
                      {availableModels.map(model => (
                        <option key={model.id} value={model.id} style={{ background: 'var(--bg-dark)' }}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                    {isLoadingModels && <span style={{ fontSize: '0.75rem', color: 'var(--text-slate-400)' }}>Loading models...</span>}
                  </div>
                )}
                <div className="api-help">
                  <h4>How to get a Gemini API key:</h4>
                  <ol>
                    <li>Go to <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a></li>
                    <li>Sign in with your Google account</li>
                    <li>Create a new API key</li>
                    <li>Copy and paste it here</li>
                  </ol>
                </div>
              </>
            )}

            {selectedProvider === 'zhipu' && (
              <>
                <div className="input-group">
                  <label>Zhipu AI API Key</label>
                  <input
                    type="password"
                    placeholder="Your Zhipu API key"
                    value={apiKeys.zhipu}
                    onChange={(e) => setApiKeys({ ...apiKeys, zhipu: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div className="api-actions">
                  <button
                    className="btn-outline"
                    onClick={() => handleTestAPI('zhipu')}
                    disabled={testStatus?.provider === 'zhipu' && testStatus.status === 'loading'}
                  >
                    {testStatus?.provider === 'zhipu' && testStatus.status === 'loading' ? 'Testing...' : 'Test Connection'}
                  </button>
                  <button className="btn-primary" onClick={() => handleSaveApiKey('zhipu')}>
                    Save & Fetch Models
                  </button>
                </div>
                {testStatus?.provider === 'zhipu' && (
                  <div className={`test-status test-status-${testStatus.status}`}>
                    {testStatus.message}
                  </div>
                )}
                {saveStatus && selectedProvider === 'zhipu' && (
                  <div className="test-status test-status-loading">{saveStatus}</div>
                )}
                {availableModels.length > 0 && selectedProvider === 'zhipu' && (
                  <div className="input-group">
                    <label>Select Model</label>
                    <select
                      value={settings.aiModel}
                      onChange={(e) => handleModelChange(e.target.value)}
                      disabled={isLoadingModels}
                      className="input-field"
                    >
                      {availableModels.map(model => (
                        <option key={model.id} value={model.id} style={{ background: 'var(--bg-dark)' }}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                    {isLoadingModels && <span style={{ fontSize: '0.75rem', color: 'var(--text-slate-400)' }}>Loading models...</span>}
                  </div>
                )}
              </>
            )}

            {selectedProvider === 'openrouter' && (
              <>
                <div className="input-group">
                  <label>OpenRouter API Key</label>
                  <input
                    type="password"
                    placeholder="Your OpenRouter API key (free)"
                    value={apiKeys.openrouter}
                    onChange={(e) => setApiKeys({ ...apiKeys, openrouter: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div className="api-actions">
                  <button
                    className="btn-outline"
                    onClick={() => handleTestAPI('openrouter')}
                    disabled={testStatus?.provider === 'openrouter' && testStatus.status === 'loading'}
                  >
                    {testStatus?.provider === 'openrouter' && testStatus.status === 'loading' ? 'Testing...' : 'Test Connection'}
                  </button>
                  <button className="btn-primary" onClick={() => handleSaveApiKey('openrouter')}>
                    Save & Fetch Models
                  </button>
                </div>
                {testStatus?.provider === 'openrouter' && (
                  <div className={`test-status test-status-${testStatus.status}`}>
                    {testStatus.message}
                  </div>
                )}
                {saveStatus && selectedProvider === 'openrouter' && (
                  <div className="test-status test-status-loading">{saveStatus}</div>
                )}
                {availableModels.length > 0 && selectedProvider === 'openrouter' && (
                  <div className="input-group">
                    <label>Select Free Model</label>
                    <select
                      value={settings.aiModel}
                      onChange={(e) => handleModelChange(e.target.value)}
                      disabled={isLoadingModels}
                      className="input-field"
                    >
                      {availableModels.map(model => (
                        <option key={model.id} value={model.id} style={{ background: 'var(--bg-dark)' }}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                    {isLoadingModels && <span style={{ fontSize: '0.75rem', color: 'var(--text-slate-400)' }}>Loading models...</span>}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* 🎯 Token Tracking Section */}
        <section className="glass-card section-card" style={{ marginTop: '20px' }}>
          <div className="section-header" onClick={() => setShowTokenHistory(!showTokenHistory)} style={{ cursor: 'pointer' }}>
            <Icon name="chart" className="section-icon" />
            <h3>🎯 Token Usage Tracking</h3>
            <span style={{ marginLeft: 'auto', fontSize: '0.875rem', color: 'var(--text-slate-400)' }}>
              {showTokenHistory ? '▼' : '▶'}
            </span>
          </div>

          {showTokenHistory && (
            <div style={{ marginTop: '20px' }}>
              {tokenHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-slate-400)' }}>
                  No CV parsing history yet. Upload a CV to see token usage!
                </div>
              ) : (
                <>
                  {/* Summary Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                    <div className="stat-card" style={{ background: 'var(--bg-dark-slate)', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-slate-400)', marginBottom: '5px' }}>Total Parses</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{tokenHistory.length}</div>
                    </div>
                    <div className="stat-card" style={{ background: 'var(--bg-dark-slate)', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-slate-400)', marginBottom: '5px' }}>Total Tokens</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-blue)' }}>
                        {tokenHistory.reduce((sum, h) => sum + (h.totalTokens || 0), 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="stat-card" style={{ background: 'var(--bg-dark-slate)', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-slate-400)', marginBottom: '5px' }}>Total Cost</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-green)' }}>
                        ${(tokenHistory.reduce((sum, h) => sum + (h.totalCost || 0), 0)).toFixed(6)}
                      </div>
                    </div>
                    <div className="stat-card" style={{ background: 'var(--bg-dark-slate)', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-slate-400)', marginBottom: '5px' }}>Avg Cost/CV</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-yellow)' }}>
                        ${(tokenHistory.length > 0 ? (tokenHistory.reduce((sum, h) => sum + (h.totalCost || 0), 0) / tokenHistory.length) : 0).toFixed(6)}
                      </div>
                    </div>
                  </div>

                  {/* Method Breakdown */}
                  <div style={{ background: 'var(--bg-dark-slate)', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '0.875rem', color: 'var(--text-slate-300)' }}>Method Distribution</h4>
                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                      {['browser', 'hybrid', 'ai-full'].map(method => {
                        const count = tokenHistory.filter(h => h.method === method).length
                        const percent = tokenHistory.length > 0 ? (count / tokenHistory.length * 100).toFixed(0) : 0
                        const colors = {
                          browser: 'var(--accent-green)',
                          hybrid: 'var(--accent-blue)',
                          'ai-full': 'var(--accent-yellow)'
                        }
                        return (
                          <div key={method} style={{ flex: '1', minWidth: '120px', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-slate-400)', marginBottom: '3px' }}>
                              {method === 'browser' ? 'Browser (FREE)' : method === 'hybrid' ? 'Hybrid (⚡)' : 'Full AI'}
                            </div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: colors[method as keyof typeof colors] }}>
                              {count} <span style={{ fontSize: '0.875rem', fontWeight: 'normal' }}>({percent}%)</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* History List */}
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '0.875rem', color: 'var(--text-slate-300)' }}>Recent Activity</h4>
                    {tokenHistory.slice().reverse().slice(0, 20).map((entry) => {
                      const date = new Date(entry.timestamp)
                      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' })

                      const methodColors = {
                        browser: { bg: 'rgba(34, 197, 94, 0.1)', text: '#22c55e' },
                        hybrid: { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6' },
                        'ai-full': { bg: 'rgba(234, 179, 8, 0.1)', text: '#eab308' }
                      }
                      const mc = methodColors[entry.method as keyof typeof methodColors]

                      return (
                        <div
                          key={entry.parseId}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            marginBottom: '8px',
                            background: 'var(--bg-dark-slate)',
                            borderRadius: '6px',
                            borderLeft: `3px solid ${mc.text}`
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: mc.bg,
                                color: mc.text,
                                fontSize: '0.7rem',
                                fontWeight: '600',
                                textTransform: 'uppercase'
                              }}>
                                {entry.method === 'browser' ? 'FREE' : entry.method}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-slate-400)' }}>
                                {dateStr} at {timeStr}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-slate-500)' }}>
                              {entry.totalTokens?.toLocaleString() || 0} tokens
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 'bold', color: 'var(--accent-green)' }}>
                              ${entry.totalCost?.toFixed(6) || '0.000000'}
                            </div>
                            {entry.tokenUsage && entry.tokenUsage.length > 0 && (
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-slate-500)' }}>
                                {entry.tokenUsage.map((u: any) => u.method).join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Clear History Button */}
                  <button
                    className="btn-outline"
                    onClick={async () => {
                      if (confirm('Clear all token history?')) {
                        await chrome.storage.local.remove('tokenHistory')
                        setTokenHistory([])
                      }
                    }}
                    style={{ marginTop: '15px', width: '100%' }}
                  >
                    Clear History
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  )
}

// ============================================
// MAIN OPTIONS COMPONENT
//============================================

const OptionsContent = () => {
  const { activeNav } = useNav()
  const { updatePlanUsage } = usePlan()
  const { updateSyncStatus } = useSync()

  // State
  const [parsedCV, setParsedCV] = useState<ParsedCV | null>(null)
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  })
  const [isEditing, setIsEditing] = useState(false)

  // Upload and parsing flow states
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'uploaded' | 'parsing' | 'almost-done' | 'complete'>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')

  // Settings and API keys
  const [apiKeys, setApiKeys] = useState({
    openai: '',
    gemini: '',
    zhipu: '',
    openrouter: '',
  })
  const [settings, setSettings] = useState({
    aiProvider: 'gemini' as 'openai' | 'gemini' | 'zhipu' | 'openrouter',
    aiModel: 'gemini-2.5-flash',
    aiModelName: 'Gemini 2.5 Flash',
  })

  // Load saved data on mount
  useEffect(() => {
    const loadSavedData = () => {
      // Load parsed CV
      chrome.runtime.sendMessage({ action: 'getParsedCV' }, (response: { success: boolean; data: ParsedCV; original: ParsedCV }) => {
        if (response?.success && response.original) {
          console.log('[Options] Loaded parsed CV:', response.original)
          setParsedCV(response.original)
          setPersonalInfo(response.original.personal)
          setUploadState('complete')
          updateSyncStatus()
        }
      })

      // Load settings and API keys
      chrome.runtime.sendMessage({ action: 'getSettings' }, (response: {
        settings: {
          aiProvider?: 'openai' | 'gemini' | 'zhipu'
          apiKeyOpenAI?: string
          apiKeyGemini?: string
          apiKeyZhipu?: string
          aiModel?: string
        }
      }) => {
        if (response?.settings) {
          setSettings({
            aiProvider: response.settings.aiProvider || 'gemini',
            aiModel: response.settings.aiModel || 'gemini-2.5-flash',
            aiModelName: (response.settings as any).aiModelName || response.settings.aiModel || 'Gemini 2.5 Flash',
          })
          setApiKeys({
            openai: response.settings.apiKeyOpenAI || '',
            gemini: response.settings.apiKeyGemini || '',
            zhipu: response.settings.apiKeyZhipu || '',
            openrouter: (response.settings as any).apiKeyOpenRouter || '',
          })
        }
      })
    }

    loadSavedData()
  }, []) // Empty array = run only once on mount

  // Remove unused variable
  // const fullSettings = {
  //   ...settings,
  //   aiModelName: settings.aiModelName || settings.aiModel
  // }

  // Handle file upload - REAL AI PARSING
  const handleFileUpload = async (file: File) => {
    console.log('[CV Upload] Starting upload:', file.name)

    // Check API key
    const provider = settings.aiProvider
    const apiKey = apiKeys[provider]

    if (!apiKey) {
      setStatusMessage(`Please add ${provider.toUpperCase()} API key first (go to API Keys tab)`)
      setTimeout(() => setStatusMessage(''), 5000)
      return
    }

    // Stage 1: Uploading
    setUploadState('uploading')
    setUploadProgress(10)
    setStatusMessage('Reading CV file...')

    try {
      let text = ''

      // Check if it's a PDF file
      const isPdfByExtension = isPDFFile(file)
      const isPdfByContent = await isPDFContent(file)
      const isPdf = isPdfByExtension || isPdfByContent

      if (isPdf) {
        setStatusMessage('Extracting text from PDF...')
        const result = await extractTextFromPDF(file)

        if (result.success && result.text) {
          text = result.text
        } else {
          setStatusMessage('Failed to extract text from PDF: ' + (result.error || 'Unknown error'))
          setUploadState('idle')
          setTimeout(() => setStatusMessage(''), 5000)
          return
        }
      } else {
        text = await file.text()
      }

      if (!text || text.length < 50) {
        setStatusMessage('Could not extract enough text from the file.')
        setUploadState('idle')
        setTimeout(() => setStatusMessage(''), 5000)
        return
      }

      // Stage 2: Uploaded
      setUploadState('uploaded')
      setUploadProgress(30)
      await new Promise(resolve => setTimeout(resolve, 500))

      // Stage 3: Parsing with AI
      setUploadState('parsing')
      setUploadProgress(50)
      setStatusMessage(`Parsing CV with ${provider.toUpperCase()} AI...`)

      const response = await chrome.runtime.sendMessage({
        action: 'parseCV',
        cvText: text,
        provider,
        apiKey,
        model: settings.aiModel
      })

      if (response.success && response.data) {
        // Stage 4: Almost done
        setUploadState('almost-done')
        setUploadProgress(80)
        await new Promise(resolve => setTimeout(resolve, 800))

        // Stage 5: Complete
        const parsedData: ParsedCV = response.data
        setParsedCV(parsedData)
        setPersonalInfo(parsedData.personal)
        setUploadProgress(100)
        setUploadState('complete')
        setStatusMessage(`CV parsed successfully!`)
        updateSyncStatus()
        updatePlanUsage(Math.floor(text.length / 10))

        setTimeout(() => setStatusMessage(''), 5000)
      } else {
        throw new Error(response.error || 'Failed to parse CV with AI')
      }

    } catch (error) {
      console.error('[CV Upload] Error:', error)
      setStatusMessage('Error: ' + (error instanceof Error ? error.message : String(error)))
      setUploadState('idle')
      setTimeout(() => setStatusMessage(''), 8000)
    }
  }

  const handleReupload = () => {
    if (confirm('This will replace your current profile data. Continue?')) {
      setParsedCV(null)
      setUploadState('idle')
      setUploadProgress(0)
      setStatusMessage('')
      chrome.storage.local.remove(STORAGE_KEYS.PARSED_CV)
    }
  }

  // Render based on active navigation
  const renderContent = () => {
    switch (activeNav) {
      case 'cv':
        return (
          <CVProfileView
            parsedCV={parsedCV}
            setParsedCV={setParsedCV}
            personalInfo={personalInfo}
            setPersonalInfo={setPersonalInfo}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            onReupload={handleReupload}
            uploadState={uploadState}
            uploadProgress={uploadProgress}
            statusMessage={statusMessage}
            setStatusMessage={setStatusMessage}
            handleFileUpload={handleFileUpload}
          />
        )

      case 'api-keys':
        return (
          <APIKeysView
            apiKeys={apiKeys}
            setApiKeys={setApiKeys}
            settings={settings}
            setSettings={setSettings}
          />
        )

      case 'generate-cv':
        return (
          <div className="generate-cv-view">
            <CVGenerator
              filename="cv.pdf"
              showDownloadButton={true}
              showUploadButton={false}
              onGenerateComplete={(result) => {
                console.log('CV Generation completed:', result)
              }}
            />
          </div>
        )

      default:
        return <CVProfileView
          parsedCV={parsedCV}
          setParsedCV={setParsedCV}
          personalInfo={personalInfo}
          setPersonalInfo={setPersonalInfo}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          onReupload={handleReupload}
          uploadState={uploadState}
          uploadProgress={uploadProgress}
          statusMessage={statusMessage}
          setStatusMessage={setStatusMessage}
          handleFileUpload={handleFileUpload}
        />
    }
  }

  return (
    <div className="options-page">
      <Sidebar />
      <main className="main-content">
        <div className="content-wrapper">
          {renderContent()}
        </div>
      </main>
      <div className="bg-decoration bg-decoration-top" />
      <div className="bg-decoration bg-decoration-bottom" />
    </div>
  )
}

// Wrapper with Dashboard Provider
export const Options = () => {
  return (
    <DashboardProvider>
      <OptionsContent />
    </DashboardProvider>
  )
}

export default Options

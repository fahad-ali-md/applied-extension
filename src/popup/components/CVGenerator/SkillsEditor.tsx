/**
 * Skills Editor Component
 *
 * Allows users to edit skill categories: rename, add/remove skills, create new categories
 */

import React, { useState, useEffect } from 'react'
import './SkillsEditor.css'

export interface Skills {
  [categoryName: string]: string[]
}

export interface SkillsEditorProps {
  skills: Skills
  onSave: (updatedSkills: Skills) => void
  onCancel: () => void
}

export const SkillsEditor: React.FC<SkillsEditorProps> = ({
  skills,
  onSave,
  onCancel
}) => {
  const [editedSkills, setEditedSkills] = useState<Skills>({})
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showNewCategory, setShowNewCategory] = useState(false)

  // Initialize edited skills when props change
  useEffect(() => {
    setEditedSkills({ ...skills })
  }, [skills])

  const handleRenameCategory = (oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) return

    const updated = { ...editedSkills }
    const skills = updated[oldName]
    delete updated[oldName]
    updated[newName] = skills
    setEditedSkills(updated)
    setEditingCategory(null)
  }

  const handleAddSkill = (category: string, skill: string) => {
    if (!skill.trim()) return

    const trimmed = skill.trim()
    const updated = { ...editedSkills }

    // Check for duplicates across all categories
    for (const [cat, skills] of Object.entries(updated)) {
      if (cat !== category && skills.includes(trimmed)) {
        alert(`Skill "${trimmed}" already exists in category "${cat}"`)
        return
      }
    }

    if (!updated[category].includes(trimmed)) {
      updated[category] = [...updated[category], trimmed].sort()
      setEditedSkills(updated)
    }
  }

  const handleRemoveSkill = (category: string, skill: string) => {
    const updated = { ...editedSkills }
    updated[category] = updated[category].filter(s => s !== skill)
    setEditedSkills(updated)
  }

  const handleDeleteCategory = (category: string) => {
    if (!confirm(`Delete category "${category}"?`)) return

    const updated = { ...editedSkills }
    delete updated[category]
    setEditedSkills(updated)
  }

  const handleCreateNewCategory = () => {
    if (!newCategoryName.trim()) return

    const name = newCategoryName.trim()
    if (editedSkills[name]) {
      alert('Category already exists')
      return
    }

    const updated = { ...editedSkills }
    updated[name] = []
    setEditedSkills(updated)
    setNewCategoryName('')
    setShowNewCategory(false)
  }

  const handleSave = () => {
    // Validate: at least one category with skills
    const categories = Object.keys(editedSkills).filter(cat => editedSkills[cat].length > 0)
    if (categories.length === 0) {
      alert('Please add at least one skill')
      return
    }

    onSave(editedSkills)
  }

  return (
    <div className="skills-editor">
      <div className="skills-editor__header">
        <h3>Edit Skills Categories</h3>
        <p className="skills-editor__subtitle">
          Rename categories, add/remove skills, or create new categories
        </p>
      </div>

      <div className="skills-editor__content">
        {Object.entries(editedSkills).map(([category, skills]) => (
          <div key={category} className="skills-editor__category">
            {editingCategory === category ? (
              <div className="skills-editor__rename-form">
                <input
                  type="text"
                  defaultValue={category}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleRenameCategory(category, (e.target as HTMLInputElement).value)
                    } else if (e.key === 'Escape') {
                      setEditingCategory(null)
                    }
                  }}
                  onBlur={(e) => {
                    handleRenameCategory(category, e.target.value)
                  }}
                  className="skills-editor__rename-input"
                />
              </div>
            ) : (
              <div className="skills-editor__category-header">
                <h4>{category}</h4>
                <div className="skills-editor__category-actions">
                  <button
                    onClick={() => setEditingCategory(category)}
                    className="skills-editor__btn skills-editor__btn--rename"
                    title="Rename category"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category)}
                    className="skills-editor__btn skills-editor__btn--delete"
                    title="Delete category"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            )}

            <div className="skills-editor__skills-list">
              {skills.map((skill) => (
                <div key={skill} className="skills-editor__skill-item">
                  <span className="skills-editor__skill-name">{skill}</span>
                  <button
                    onClick={() => handleRemoveSkill(category, skill)}
                    className="skills-editor__btn skills-editor__btn--remove-skill"
                    title="Remove skill"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="skills-editor__add-skill">
              <input
                type="text"
                placeholder="Add new skill..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddSkill(category, (e.target as HTMLInputElement).value)
                    ;(e.target as HTMLInputElement).value = ''
                  }
                }}
                className="skills-editor__add-skill-input"
              />
            </div>
          </div>
        ))}

        {showNewCategory ? (
          <div className="skills-editor__new-category">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="New category name..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateNewCategory()
                } else if (e.key === 'Escape') {
                  setShowNewCategory(false)
                  setNewCategoryName('')
                }
              }}
              className="skills-editor__new-category-input"
              autoFocus
            />
            <div className="skills-editor__new-category-actions">
              <button
                onClick={handleCreateNewCategory}
                className="skills-editor__btn skills-editor__btn--create"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowNewCategory(false)
                  setNewCategoryName('')
                }}
                className="skills-editor__btn skills-editor__btn--cancel"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowNewCategory(true)}
            className="skills-editor__add-category-btn"
          >
            + Add New Category
          </button>
        )}
      </div>

      <div className="skills-editor__footer">
        <button
          onClick={onCancel}
          className="skills-editor__btn skills-editor__btn--cancel"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="skills-editor__btn skills-editor__btn--save"
        >
          Save Changes
        </button>
      </div>
    </div>
  )
}

export default SkillsEditor

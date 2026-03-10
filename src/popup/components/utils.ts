import { DetectedField } from './types'

export const fieldIcon = (field: DetectedField): string => {
  const name = (field.name || field.id || field.placeholder || field.type || '').toLowerCase()
  if (name.includes('email')) return 'alternate_email'
  if (name.includes('phone') || name.includes('tel')) return 'call'
  if (name.includes('name')) return 'person'
  if (name.includes('cover') || name.includes('letter') || name.includes('message')) return 'description'
  if (name.includes('linkedin')) return 'link'
  if (name.includes('github')) return 'code'
  return 'edit_note'
}

export const fieldLabel = (field: DetectedField): string => {
  const name = (field.name || field.id || field.placeholder || field.type || '').toLowerCase()
  if (name.includes('email')) return 'Email Address'
  if (name.includes('phone') || name.includes('tel')) return 'Phone Number'
  if (name.includes('firstname') || name.includes('first_name')) return 'First Name'
  if (name.includes('lastname') || name.includes('last_name')) return 'Last Name'
  if (name.includes('name')) return 'Full Name'
  if (name.includes('cover') || name.includes('letter')) return 'Cover Letter'
  if (name.includes('linkedin')) return 'LinkedIn URL'
  if (name.includes('github')) return 'GitHub URL'
  return field.name || field.placeholder || field.type || 'Text Field'
}

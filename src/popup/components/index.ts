// Components
export { Header } from './Header/Header'
export { FillCard } from './FillCard/FillCard'
export { DetectedFields } from './DetectedFields/DetectedFields'
export { Navigation } from './Navigation/Navigation'
export { CVGenerator } from './CVGenerator/CVGenerator'


// Custom Hooks (from context folder)
export { usePopupData } from '../context/usePopupData'
export { useFormFiller } from '../context/useFormFiller'


// Types
export type {
  AvailableProvider,
  DetectedField,
  HeaderProps,
  FillCardProps,
  DetectedFieldsProps,
} from './types'

// Utilities
export { fieldIcon, fieldLabel } from './utils'

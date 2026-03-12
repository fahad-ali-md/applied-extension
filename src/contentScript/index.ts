/**
 * Content Script - Main Entry Point
 *
 * Form filling engine for browser extension
 */

console.info('contentScript is running')

// Import message handlers (lazy-loaded)
import { setupMessageHandlers } from './handlers/messageHandlers'

// Setup Chrome runtime message listeners
setupMessageHandlers()

// Auto-detect forms on page load
import('./core/FormFiller').then(({ FormFiller }) => {
  const formFiller = new FormFiller()
  formFiller.observeFormChanges(() => {
    console.log('Form fields changed - new fields available')
  })
})

console.info('Form filling engine loaded')

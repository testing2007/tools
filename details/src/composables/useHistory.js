/**
 * useHistory - Undo/Redo History Management Composable
 * 
 * This composable manages a circular buffer of HTML/CSS snapshots,
 * enabling undo and redo operations for the visual editor.
 */

import { ref, computed } from 'vue'

const MAX_HISTORY = 50

// Singleton state to be shared across components
const history = ref([])
const historyIndex = ref(-1)

export function useHistory() {
  /**
   * Push a new snapshot to history
   * @param {Object} snapshot - { html: string, css: string }
   */
  function pushSnapshot(snapshot) {
    // Skip if this snapshot is identical to the current one (prevents duplicates)
    const current = history.value[historyIndex.value]
    if (current && current.html === snapshot.html && current.css === snapshot.css) {
      console.log('[History] Skipping duplicate snapshot')
      return
    }

    // If we're not at the end, truncate future history (redo stack)
    if (historyIndex.value < history.value.length - 1) {
      history.value = history.value.slice(0, historyIndex.value + 1)
    }

    // Add new snapshot
    history.value.push({
      ...snapshot,
      timestamp: Date.now()
    })

    // Trim if exceeds max
    if (history.value.length > MAX_HISTORY) {
      history.value.shift()
    }

    // Update pointer to latest
    historyIndex.value = history.value.length - 1
    console.log('[History] Pushed snapshot, index:', historyIndex.value, 'total:', history.value.length)
  }

  /**
   * Undo to previous state
   * @returns {Object|null} Previous snapshot or null if at beginning
   */
  function undo() {
    if (historyIndex.value > 0) {
      historyIndex.value--
      return history.value[historyIndex.value]
    }
    return null
  }

  /**
   * Redo to next state
   * @returns {Object|null} Next snapshot or null if at end
   */
  function redo() {
    if (historyIndex.value < history.value.length - 1) {
      historyIndex.value++
      return history.value[historyIndex.value]
    }
    return null
  }

  /**
   * Clear all history
   */
  function clearHistory() {
    history.value = []
    historyIndex.value = -1
  }

  // Computed properties for UI state
  const canUndo = computed(() => historyIndex.value > 0)
  const canRedo = computed(() => historyIndex.value < history.value.length - 1)
  const currentSnapshot = computed(() => history.value[historyIndex.value] || null)

  return {
    // State
    history,
    historyIndex,
    
    // Actions
    pushSnapshot,
    undo,
    redo,
    clearHistory,
    
    // Computed
    canUndo,
    canRedo,
    currentSnapshot
  }
}

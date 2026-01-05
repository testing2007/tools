/**
 * useTransformer - Element Transformation State Management
 * 
 * Manages the state for the currently selected element's
 * position, rotation, and scale transformations.
 */

import { ref, computed, watch } from 'vue'

// Singleton state
const selectedElement = ref(null)
const parentSection = ref(null)

const transformState = ref({
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  rotate: 0,
  scale: 1,
  isAbsolute: false
})

export function useTransformer() {
  /**
   * Select an element for transformation
   * @param {HTMLElement} element - The element to select
   */
  function selectElement(element) {
    if (!element) {
      clearSelection()
      return
    }

    selectedElement.value = element
    parentSection.value = element.closest('.section')

    // Read current state from element
    const computed = window.getComputedStyle(element)
    const section = parentSection.value
    
    if (section) {
      const sectionRect = section.getBoundingClientRect()
      const elementRect = element.getBoundingClientRect()

      transformState.value = {
        x: elementRect.left - sectionRect.left,
        y: elementRect.top - sectionRect.top,
        width: element.offsetWidth,
        height: element.offsetHeight,
        rotate: parseRotation(computed.transform),
        scale: parseScale(computed.transform),
        isAbsolute: computed.position === 'absolute'
      }
    }
  }

  /**
   * Clear the current selection
   */
  function clearSelection() {
    selectedElement.value = null
    parentSection.value = null
    transformState.value = {
      x: 0, y: 0, width: 0, height: 0, rotate: 0, scale: 1, isAbsolute: false
    }
  }

  /**
   * Apply current transform state to the selected element
   */
  function applyTransform() {
    const el = selectedElement.value
    if (!el) return

    const state = transformState.value

    if (state.isAbsolute) {
      el.style.position = 'absolute'
      el.style.left = `${state.x}px`
      el.style.top = `${state.y}px`
      el.style.margin = '0'
    }

    el.style.transform = `rotate(${state.rotate}deg) scale(${state.scale})`
  }

  /**
   * Convert element to absolute positioning at its current visual position
   * This prevents layout jumping
   */
  function convertToAbsolute() {
    const el = selectedElement.value
    const section = parentSection.value
    if (!el || !section) return

    const sectionRect = section.getBoundingClientRect()
    const elementRect = el.getBoundingClientRect()

    transformState.value.x = elementRect.left - sectionRect.left
    transformState.value.y = elementRect.top - sectionRect.top
    transformState.value.isAbsolute = true

    applyTransform()
  }

  // Helper: Parse rotation from matrix transform
  function parseRotation(matrix) {
    if (!matrix || matrix === 'none') return 0
    try {
      const values = matrix.split('(')[1].split(')')[0].split(',')
      const a = parseFloat(values[0])
      const b = parseFloat(values[1])
      return Math.round(Math.atan2(b, a) * (180 / Math.PI))
    } catch {
      return 0
    }
  }

  // Helper: Parse scale from matrix transform
  function parseScale(matrix) {
    if (!matrix || matrix === 'none') return 1
    try {
      const values = matrix.split('(')[1].split(')')[0].split(',')
      const a = parseFloat(values[0])
      const b = parseFloat(values[1])
      return parseFloat(Math.sqrt(a * a + b * b).toFixed(2))
    } catch {
      return 1
    }
  }

  // Computed: Is an element currently selected?
  const hasSelection = computed(() => selectedElement.value !== null)

  return {
    // State
    selectedElement,
    parentSection,
    transformState,

    // Actions
    selectElement,
    clearSelection,
    applyTransform,
    convertToAbsolute,

    // Computed
    hasSelection
  }
}

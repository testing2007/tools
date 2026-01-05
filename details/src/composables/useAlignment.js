/**
 * useAlignment - Quick Alignment Utility Functions
 * 
 * Provides alignment calculations for positioning elements
 * within a fixed-width section (1000px).
 */

const SECTION_WIDTH = 1000

/**
 * Calculate left position for left alignment
 * @param {number} margin - Optional margin from edge
 * @returns {number} Left position in pixels
 */
export function alignLeft(margin = 0) {
  return margin
}

/**
 * Calculate left position for center alignment
 * @param {number} elementWidth - Width of the element
 * @returns {number} Left position in pixels
 */
export function alignCenter(elementWidth) {
  return Math.round((SECTION_WIDTH - elementWidth) / 2)
}

/**
 * Calculate left position for right alignment
 * @param {number} elementWidth - Width of the element
 * @param {number} margin - Optional margin from edge
 * @returns {number} Left position in pixels
 */
export function alignRight(elementWidth, margin = 0) {
  return SECTION_WIDTH - elementWidth - margin
}

/**
 * Apply alignment to an element
 * @param {HTMLElement} element - The element to align
 * @param {'left'|'center'|'right'} alignment - Alignment type
 * @param {number} margin - Optional margin
 */
export function applyAlignment(element, alignment, margin = 0) {
  if (!element) return

  const elementWidth = element.offsetWidth

  let leftPosition
  switch (alignment) {
    case 'left':
      leftPosition = alignLeft(margin)
      break
    case 'center':
      leftPosition = alignCenter(elementWidth)
      break
    case 'right':
      leftPosition = alignRight(elementWidth, margin)
      break
    default:
      return
  }

  // Ensure element is absolutely positioned
  element.style.position = 'absolute'
  element.style.left = `${leftPosition}px`
}

export function useAlignment() {
  return {
    alignLeft,
    alignCenter,
    alignRight,
    applyAlignment,
    SECTION_WIDTH
  }
}

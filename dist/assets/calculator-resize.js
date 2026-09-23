const STORAGE_KEY = 'admin-basic-calculator-size-v1'
const root = document.documentElement

let savedSize = readSavedSize()

function readSavedSize() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (Number.isFinite(value?.width) && Number.isFinite(value?.height)) return value
  } catch {
    // Ignore inaccessible or invalid persisted preferences.
  }
  return null
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum)
}

function getBounds(surface) {
  const isRail = Boolean(surface.closest('.basic-calculator-rail')) && matchMedia('(min-width: 1280px)').matches
  const widthMaximum = isRail ? Math.min(520, Math.max(220, innerWidth - 700)) : Math.max(280, innerWidth - 24)
  const widthMinimum = Math.min(isRail ? 220 : 300, widthMaximum)
  const heightMaximum = Math.max(320, innerHeight - (isRail ? 116 : 24))
  const heightMinimum = Math.min(420, heightMaximum)
  return { isRail, widthMinimum, widthMaximum, heightMinimum, heightMaximum }
}

function constrainedSize(surface, size) {
  const bounds = getBounds(surface)
  return {
    width: Math.round(clamp(size.width, bounds.widthMinimum, bounds.widthMaximum)),
    height: Math.round(clamp(size.height, bounds.heightMinimum, bounds.heightMaximum)),
  }
}

function applySize(surface, size) {
  const next = constrainedSize(surface, size)
  root.style.setProperty('--basic-calculator-width', `${next.width}px`)
  root.style.setProperty('--basic-calculator-height', `${next.height}px`)
  return next
}

function persistSize(size) {
  savedSize = size
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(size))
  } catch {
    // Resizing still works when local storage is unavailable.
  }
}

function updateAccessibleName(handle, size) {
  handle.setAttribute(
    'aria-label',
    `Resize calculator. Current size ${size.width} by ${size.height} pixels. Arrow keys resize; hold Shift for larger steps.`,
  )
}

function attachResizeHandle(surface) {
  if (surface.dataset.resizeHandleAttached === 'true') return
  surface.dataset.resizeHandleAttached = 'true'

  const handle = document.createElement('button')
  handle.type = 'button'
  handle.className = 'calculator-resize-handle'
  handle.title = 'Drag to resize calculator'
  surface.append(handle)

  const initialRect = surface.getBoundingClientRect()
  const initialSize = savedSize
    ? applySize(surface, savedSize)
    : { width: Math.round(initialRect.width), height: Math.round(initialRect.height) }
  updateAccessibleName(handle, initialSize)

  let drag = null

  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    const rect = surface.getBoundingClientRect()
    const { isRail } = getBounds(surface)
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      width: rect.width,
      height: rect.height,
      horizontalDirection: isRail ? -1 : 1,
    }
    handle.setPointerCapture(event.pointerId)
    handle.classList.add('is-resizing')
    event.preventDefault()
    event.stopPropagation()
  })

  handle.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return
    const next = applySize(surface, {
      width: drag.width + (event.clientX - drag.startX) * drag.horizontalDirection,
      height: drag.height + event.clientY - drag.startY,
    })
    updateAccessibleName(handle, next)
    event.preventDefault()
    event.stopPropagation()
  })

  const finishDrag = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return
    const size = constrainedSize(surface, surface.getBoundingClientRect())
    persistSize(size)
    updateAccessibleName(handle, size)
    handle.classList.remove('is-resizing')
    drag = null
    event.stopPropagation()
  }
  handle.addEventListener('pointerup', finishDrag)
  handle.addEventListener('pointercancel', finishDrag)

  handle.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    const rect = surface.getBoundingClientRect()
    const step = event.shiftKey ? 32 : 16
    const next = applySize(surface, {
      width: rect.width + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0),
      height: rect.height + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0),
    })
    persistSize(next)
    updateAccessibleName(handle, next)
    event.preventDefault()
    event.stopPropagation()
  })
}

function attachHandles() {
  document.querySelectorAll('.basic-calculator-surface').forEach(attachResizeHandle)
}

new MutationObserver(attachHandles).observe(document.documentElement, { childList: true, subtree: true })
attachHandles()

addEventListener('resize', () => {
  const surface = document.querySelector('.basic-calculator-surface')
  if (surface && savedSize) applySize(surface, savedSize)
})

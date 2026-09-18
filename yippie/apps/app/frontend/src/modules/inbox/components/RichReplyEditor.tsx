import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import DOMPurify from 'dompurify'

/**
 * WYSIWYG reply/compose editor that renders inline signature images instead of
 * dumping their raw <img src="data:…base64…"> markup as text (the old textarea
 * behaviour).
 *
 * The value stays in the SAME wire format the rest of the app already uses:
 * plain text plus allowlisted inline data-URI <img> tags. That is exactly what
 * the backend `_paragraphs()` renderer expects, so nothing in the send path,
 * signature swapping, AI improve or copy has to change — this component only
 * changes how that string is displayed and edited.
 */

// Mirror of backend `_SIG_IMG_RE` (email_html.py): only data-URI images for
// svg/png/jpeg, no remote URLs or script vectors.
const SIG_IMG_RE =
  /<img\s+src="(data:image\/(?:svg\+xml|png|jpeg|jpg);base64,[A-Za-z0-9+/=\s]+)"(?:\s+[a-z-]+="[^"<>]*")*\s*\/?>/gi

const BLOCK_TAGS = new Set(['div', 'p'])

// Plain-text sentinel wrapped around stashed images while we escape + sanitise
// the surrounding text. Alphanumeric on purpose: DOMPurify strips NUL/control
// characters, and it survives html.escape untouched.
const SENTINEL = '@@YIPPIE_IMG_'
const NBSP = '\u00a0'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Wire format (plain text + inline data-img tags) → sanitised editor HTML. */
export function wireToHtml(wire: string): string {
  const imgs: string[] = []
  const stashed = wire.replace(SIG_IMG_RE, (_m, src) => {
    imgs.push(`<img src="${src}" style="max-width:100%;height:auto;display:inline-block;" />`)
    return `${SENTINEL}${imgs.length - 1}@@`
  })
  let html = escapeHtml(stashed).replace(/\n/g, '<br>')
  // Sanitise the text FIRST (no images present), then splice the pre-validated
  // images back in — DOMPurify would otherwise strip data:image/svg+xml logos.
  html = DOMPurify.sanitize(html, { ADD_ATTR: ['style'] })
  imgs.forEach((img, i) => {
    html = html.replace(`${SENTINEL}${i}@@`, img)
  })
  return html
}

/** Editor DOM → wire format. Blocks/<br> become newlines, images become tags. */
export function htmlToWire(root: HTMLElement): string {
  const parts: string[] = []
  const endsWithNewline = () => parts.length > 0 && parts[parts.length - 1].endsWith('\n')

  const walk = (node: Node) => {
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        parts.push((child.textContent ?? '').split(NBSP).join(' '))
        return
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return
      const el = child as HTMLElement
      const tag = el.tagName.toLowerCase()
      if (tag === 'br') {
        parts.push('\n')
      } else if (tag === 'img') {
        const src = el.getAttribute('src') ?? ''
        if (/^data:image\//i.test(src)) parts.push(`<img src="${src}">`)
      } else if (BLOCK_TAGS.has(tag)) {
        if (parts.length && !endsWithNewline()) parts.push('\n')
        walk(el)
        if (!endsWithNewline()) parts.push('\n')
      } else {
        walk(el) // inline spans etc. — keep their text, drop formatting
      }
    })
  }

  walk(root)
  // A single trailing newline from block wrapping is a contentEditable artifact.
  return parts.join('').replace(/\n$/, '')
}

function placeCaretAtEnd(el: HTMLElement) {
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

interface RichReplyEditorProps {
  value: string
  onChange: (wire: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void
  placeholder?: string
  className?: string
}

export const RichReplyEditor = forwardRef<HTMLDivElement, RichReplyEditorProps>(
  function RichReplyEditor({ value, onChange, onKeyDown, placeholder, className }, ref) {
    const innerRef = useRef<HTMLDivElement>(null)
    // Tracks the last value we serialised out, so echoes of our own onChange
    // don't rewrite innerHTML and blow away the caret. null forces a first paint.
    const lastWire = useRef<string | null>(null)

    useImperativeHandle(ref, () => innerRef.current as HTMLDivElement, [])

    // Sync external value changes (signature swap, AI generate, draft reset) in.
    useEffect(() => {
      const el = innerRef.current
      if (!el) return
      if (lastWire.current === value) return
      el.innerHTML = wireToHtml(value)
      lastWire.current = value
      if (document.activeElement === el) placeCaretAtEnd(el)
    }, [value])

    function handleInput() {
      const el = innerRef.current
      if (!el) return
      const wire = htmlToWire(el)
      // Fully empty → clear so the :empty placeholder shows.
      if (wire === '' && el.innerHTML !== '') el.innerHTML = ''
      lastWire.current = wire
      onChange(wire)
    }

    return (
      <div
        ref={innerRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={handleInput}
        onKeyDown={onKeyDown}
        className={`rich-reply-editor ${className ?? ''}`}
      />
    )
  },
)

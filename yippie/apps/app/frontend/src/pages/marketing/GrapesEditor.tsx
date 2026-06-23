import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react'
import grapesjs, { Editor } from 'grapesjs'
import presetNewsletter from 'grapesjs-preset-newsletter'
import 'grapesjs/dist/css/grapes.min.css'

export interface GrapesEditorHandle {
  getHtml: () => string
  getCss: () => string
  setContent: (html: string, css?: string) => void
}

interface Props {
  initialHtml?: string
  initialCss?: string
  onReady?: () => void
}

export const GrapesEditor = forwardRef<GrapesEditorHandle, Props>(function GrapesEditor(
  { initialHtml = '', initialCss = '', onReady },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  useImperativeHandle(ref, () => ({
    getHtml: () => editorRef.current?.getHtml() ?? '',
    getCss: () => editorRef.current?.getCss() ?? '',
    setContent: (html: string, css = '') => {
      const ed = editorRef.current
      if (!ed) return
      ed.setComponents(html)
      ed.setStyle(css)
    },
  }))

  useEffect(() => {
    if (!containerRef.current || editorRef.current) return
    const editor = grapesjs.init({
      container: containerRef.current,
      height: '100%',
      width: '100%',
      storageManager: false,
      plugins: [presetNewsletter],
      pluginsOpts: {
        [presetNewsletter as unknown as string]: {
          modalLabelImport: 'Paste your HTML here',
        },
      },
    })
    editor.setComponents(initialHtml || '<p style="padding:24px;">Start designing your email…</p>')
    if (initialCss) editor.setStyle(initialCss)
    editorRef.current = editor
    onReadyRef.current?.()

    return () => {
      try {
        editor.destroy()
      } catch {
        /* noop */
      }
      editorRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div className="h-full w-full overflow-hidden" ref={containerRef} />
})

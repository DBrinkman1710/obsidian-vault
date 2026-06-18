import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import grapesjs, { Editor } from 'grapesjs'
import 'grapesjs/dist/css/grapes.min.css'
// @ts-ignore — no types package
import grapesjsNewsletterPlugin from 'grapesjs-preset-newsletter'

export interface GrapesEditorHandle {
  loadDesign(json: string | null): void
  exportHtml(cb: (data: { html: string; design: object }) => void): void
  on(event: string, cb: () => void): void
}

interface GrapesEditorProps {
  onReady?: () => void
}

const GrapesEditor = forwardRef<GrapesEditorHandle, GrapesEditorProps>(({ onReady }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  useEffect(() => {
    if (!containerRef.current || editorRef.current) return

    const editor = grapesjs.init({
      container: containerRef.current,
      height: '100%',
      width: 'auto',
      storageManager: false,
      plugins: [grapesjsNewsletterPlugin],
    })

    editor.BlockManager.add('yippie-button', {
      label: 'Button',
      category: 'Basic',
      content: `<a data-yippie-button="1" href="#" style="display:inline-block;padding:10px 20px;background:#5BA4F5;color:#ffffff;text-decoration:none;border-radius:4px;font-family:Arial,sans-serif;font-size:14px;">Button</a>`,
    })

    editorRef.current = editor
    onReadyRef.current?.()

    return () => {
      editor.destroy()
      editorRef.current = null
    }
  }, [])

  useImperativeHandle(ref, () => ({
    loadDesign(json) {
      const editor = editorRef.current
      if (!editor) return
      if (json) {
        try {
          editor.loadProjectData(JSON.parse(json))
          return
        } catch {
          // fall through to blank canvas on corrupt design JSON
        }
      }
      editor.loadProjectData({ pages: [{ component: '' }] })
    },
    exportHtml(cb) {
      const editor = editorRef.current
      if (!editor) return
      const inlined = editor.runCommand('gjs-get-inlined-html') as string | undefined
      const html = inlined ?? editor.getHtml()
      cb({ html, design: editor.getProjectData() })
    },
    on(event, cb) {
      const editor = editorRef.current
      if (!editor) return
      if (event === 'change') {
        editor.on('component:add', cb)
        editor.on('component:update', cb)
        editor.on('component:remove', cb)
        return
      }
      editor.on(event, cb)
    },
  }))

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
})
GrapesEditor.displayName = 'GrapesEditor'
export default GrapesEditor

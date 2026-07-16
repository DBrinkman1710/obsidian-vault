// Server rendered PDF preview ([TMPL2]) — posts the current (possibly unsaved)
// blocks to the preview endpoint and shows the returned PDF in an iframe.
import { useEffect, useState } from 'react'
import { CloseButton } from '../../shell/CloseButton'
import { api } from '../../api/client'
import type { BlockDoc, DocType } from './blocks'

export function PdfPreviewModal({
  docType, blocks, defaultNotes, onClose,
}: {
  docType: DocType
  blocks: BlockDoc
  defaultNotes?: string | null
  onClose: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let objectUrl: string | null = null
    const base = docType === 'invoice' ? '/billing' : '/contracts'
    const payload: Record<string, any> = { blocks }
    if (docType === 'invoice' && defaultNotes) payload.default_notes = defaultNotes
    api.post(`${base}/templates/preview`, payload, { responseType: 'blob' })
      .then((r: any) => {
        objectUrl = URL.createObjectURL(r.data)
        setUrl(objectUrl)
      })
      .catch(async (err: any) => {
        // Error details arrive as a JSON blob when responseType is blob.
        try {
          const text = await err.response?.data?.text?.()
          setError(text ? JSON.parse(text).detail : 'Preview failed')
        } catch {
          setError('Preview failed')
        }
      })
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [docType, blocks, defaultNotes])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="heading-md">Preview with sample data</h2>
          <CloseButton onClick={onClose} />
        </div>
        <div className="flex-1 min-h-0 p-4">
          {error && <p className="error-banner">{error}</p>}
          {!error && !url && <p className="text-sm text-slate-400 text-center py-16">Rendering preview…</p>}
          {url && <iframe title="Template preview" src={url} className="w-full h-full rounded-lg border border-slate-200" />}
        </div>
      </div>
    </div>
  )
}

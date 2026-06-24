import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

export interface Signature {
  id: string
  name: string
  body: string
  is_default: boolean
  display_order: number
}

// S2: inline base64 image cap. 500 KB of decoded image data.
export const MAX_SIGNATURE_IMAGE_BYTES = 500 * 1024
export const ALLOWED_SIGNATURE_IMAGE_TYPES = ['image/svg+xml', 'image/png', 'image/jpeg']

/** Read a file as a data-URI, validating type + size. Resolves to the data URI. */
export function readSignatureImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!ALLOWED_SIGNATURE_IMAGE_TYPES.includes(file.type)) {
      reject(new Error('Only SVG, PNG or JPEG images are allowed.'))
      return
    }
    if (file.size > MAX_SIGNATURE_IMAGE_BYTES) {
      reject(new Error('Image is too large — must be 500 KB or smaller.'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the image file.'))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })
}

/** Build the <img> tag inserted into a signature body for an inline image. */
export function signatureImageTag(dataUri: string): string {
  return `<img src="${dataUri}" alt="signature image">`
}

export function useSignatures() {
  return useQuery({
    queryKey: ['signatures'],
    queryFn: () => api.get<Signature[]>('/auth/me/signatures').then((r: any) => r.data),
  })
}

/** The signature a compose/reply box should pre-fill with (default, else first). */
export function pickDefaultSignature(signatures: Signature[] | undefined): Signature | undefined {
  if (!signatures || signatures.length === 0) return undefined
  return signatures.find(s => s.is_default) ?? signatures[0]
}

/**
 * Swap the trailing signature in a body. If the body currently ends with
 * `previousBody` (optionally separated by blank lines), that block is removed
 * before the new signature is appended — so switching signatures in the picker
 * never stacks them. Returns the new body text.
 */
export function swapSignature(body: string, previousBody: string | null, nextBody: string): string {
  let base = body
  if (previousBody) {
    const withSep = `\n\n${previousBody}`
    if (base.endsWith(withSep)) base = base.slice(0, -withSep.length)
    else if (base.endsWith(previousBody)) base = base.slice(0, -previousBody.length)
  }
  base = base.replace(/\s+$/, '')
  return nextBody ? `${base}\n\n${nextBody}` : base
}

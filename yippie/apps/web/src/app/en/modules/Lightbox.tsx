'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import styles from './modules.module.css'

export default function Lightbox({
  src,
  alt,
  imageClassName,
}: {
  src: string
  alt: string
  imageClassName?: string
}) {
  const [open, setOpen] = useState(false)
  // Avoid SSR mismatch — only portal once mounted on the client.
  const [mounted, setMounted] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const overlay = (
    <div
      className={styles.lightboxOverlay}
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <div className={styles.lightboxInner} onClick={e => e.stopPropagation()}>
        <button
          ref={closeRef}
          type="button"
          onClick={() => setOpen(false)}
          className={styles.lightboxClose}
        >
          Close ✕
        </button>
        <Image
          src={src}
          alt={alt}
          width={1440}
          height={900}
          unoptimized
          className={styles.lightboxImage}
        />
      </div>
    </div>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={styles.lightboxTrigger}
        aria-label={`Zoom in: ${alt}`}
      >
        <Image
          src={src}
          alt={alt}
          width={800}
          height={500}
          unoptimized
          className={imageClassName}
        />
      </button>

      {/* Portal to document.body — escapes any transform/stacking-context ancestor (e.g. Reveal) */}
      {mounted && open && createPortal(overlay, document.body)}
    </>
  )
}

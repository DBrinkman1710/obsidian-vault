'use client'

import { useEffect, useState } from 'react'
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={styles.lightboxTrigger}
        aria-label={`View ${alt} fullscreen`}
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

      {open && (
        <div className={styles.lightboxOverlay} onClick={() => setOpen(false)}>
          <div className={styles.lightboxInner} onClick={(e) => e.stopPropagation()}>
            <button
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
      )}
    </>
  )
}

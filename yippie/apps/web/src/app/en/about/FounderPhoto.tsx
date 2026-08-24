"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./about.module.css";

export default function FounderPhoto() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={styles.founderAvatar}
        onClick={() => setOpen(true)}
        aria-label="Enlarge photo of Diederik Brinkman"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/founder.jpg" alt="Diederik Brinkman, founder of Yippie" />
      </button>

      {open && mounted &&
        createPortal(
          <div
            className={styles.lightbox}
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Photo of Diederik Brinkman"
          >
            <button type="button" className={styles.lightboxClose} aria-label="Close">
              &times;
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/founder.jpg"
              alt="Diederik Brinkman, founder of Yippie"
              className={styles.lightboxImg}
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body,
        )}
    </>
  );
}

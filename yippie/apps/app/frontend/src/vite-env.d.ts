/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_YIPPIE_PLATFORM_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

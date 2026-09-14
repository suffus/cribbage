/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TUTORIAL_PATH?: "on" | "off"
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

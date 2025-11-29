/// <reference types="vite/client" />

interface ImportMetaEnv {
  VITE_API_URL: string;
  VITE_FRONTEND_PORT: string;
  VITE_GOOGLE_MAPS_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

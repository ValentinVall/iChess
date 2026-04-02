/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APPLE_TEAM_ID: string;
  readonly VITE_APPLE_KEY_ID: string;
  readonly VITE_APPLE_BUNDLE_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

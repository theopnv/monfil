/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly MONFIL_APTABASE_KEY: string | undefined;
  readonly MONFIL_APTABASE_HOST: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

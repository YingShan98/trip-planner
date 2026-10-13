/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_KEY: string;
  readonly VITE_HCAPTCHA_SITE_KEY: string;
  /** 高德 JS API 2.0 key (服务平台「Web端(JS API)」); optional — without it maps fall back to Google. */
  readonly VITE_AMAP_KEY?: string;
  /** The key's 安全密钥 (securityJsCode), required for keys created after 2021-12-02. */
  readonly VITE_AMAP_SECURITY_CODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

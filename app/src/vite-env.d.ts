/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Supabase project address, e.g. https://abcd.supabase.co (optional). */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon (publishable) key (optional). */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

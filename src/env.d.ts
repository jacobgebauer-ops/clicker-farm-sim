/// <reference types="vite/client" />
declare const __APP_VERSION__: string;
declare const __BUILD_KIND__: 'gift' | 'public';
declare module 'virtual:asset-index' {
  const ids: string[];
  export default ids;
}
declare module '@personal' {
  const data: unknown;
  export default data;
}
declare module 'zzfx' {
  export const ZZFX: { sampleRate: number; buildSamples(...params: (number | undefined)[]): number[] };
}

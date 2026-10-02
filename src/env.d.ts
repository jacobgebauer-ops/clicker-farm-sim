/// <reference types="vite/client" />
declare const __APP_VERSION__: string;
declare const __BUILD_KIND__: 'gift' | 'public';
declare module 'virtual:asset-index' {
  const index: { ids: string[]; frames: Record<string, number[]>; sizes: Record<string, [number, number]> };
  export default index;
}
declare module '@personal' {
  const data: unknown;
  export default data;
}
declare module 'zzfx' {
  export const ZZFX: { sampleRate: number; buildSamples(...params: (number | undefined)[]): number[] };
}

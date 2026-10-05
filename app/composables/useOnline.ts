// Browser connectivity. Always true during SSR and hydration; the online plugin
// updates it once mounted, so server and client markup agree.
export function useOnline() {
  return useState<boolean>('online', () => true)
}

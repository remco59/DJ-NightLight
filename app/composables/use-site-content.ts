import type { PublicSiteContent } from '~/types/site-content'

export async function useSiteContent() {
  return await useFetch<{ content: PublicSiteContent }>('/api/public/content', {
    key: 'nightlight-site-content',
  })
}

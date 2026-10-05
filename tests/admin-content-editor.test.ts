import { flushPromises, mount } from '@vue/test-utils'
import * as vue from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { siteContentInputSchema } from '../shared/schemas/site-content'
import { defaultSiteContent } from '../server/utils/site-content-defaults'

// The page relies on Nuxt auto-imports; provide the ones it (and useUnsavedChanges) use.
const fetchMock = vi.fn()
const refreshMock = vi.fn()
vi.stubGlobal('ref', vue.ref)
vi.stubGlobal('reactive', vue.reactive)
vi.stubGlobal('computed', vue.computed)
vi.stubGlobal('watch', vue.watch)
vi.stubGlobal('unref', vue.unref)
vi.stubGlobal('onMounted', vue.onMounted)
vi.stubGlobal('onBeforeUnmount', vue.onBeforeUnmount)
vi.stubGlobal('onBeforeRouteLeave', vi.fn())
vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('useSeoMeta', vi.fn())
vi.stubGlobal('createError', (input: { statusMessage: string }) => new Error(input.statusMessage))
vi.stubGlobal('$fetch', fetchMock)
vi.stubGlobal('refreshNuxtData', refreshMock)
vi.stubGlobal('useFetch', async () => ({ data: vue.shallowRef({ content: structuredClone(serverContent()) }) }))
const { useUnsavedChanges } = await import('../app/composables/useUnsavedChanges')
vi.stubGlobal('useUnsavedChanges', useUnsavedChanges)
window.scrollTo = vi.fn() as never

function serverContent() {
  // Same shape as GET /api/admin/content for a stored row: extra DB columns, nulls for optional fields.
  return {
    ...defaultSiteContent,
    id: 'default-row',
    heroImageUrl: null,
    showreelUrl: null,
    contactEmail: null,
    contactPhone: null,
    instagramUrl: null,
    spotifyUrl: null,
    seoImageUrl: null,
  }
}

async function mountPage() {
  const { default: ContentPage } = await import('../app/pages/admin/content.vue')
  const Host = { components: { ContentPage }, template: '<Suspense><ContentPage /></Suspense>' }
  const wrapper = mount(Host, {
    global: {
      stubs: {
        AdminMediaPicker: true,
        NuxtLink: { template: '<a><slot /></a>' },
        Icon: true,
      },
    },
  })
  await flushPromises()
  return wrapper
}

describe('admin website editor', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    refreshMock.mockReset()
  })

  it('starts without unsaved changes and shows the save button', async () => {
    const wrapper = await mountPage()
    expect(wrapper.find('.save-status').classes()).toContain('is-idle')
    const button = wrapper.find('button[type="submit"]')
    expect(button.text()).toBe('Website opslaan')
    expect(button.attributes('disabled')).toBeUndefined()
  })

  it('sends the whole form (with null optional fields) and the API schema accepts it', async () => {
    fetchMock.mockResolvedValue({ content: {} })
    const wrapper = await mountPage()

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0] as [string, { method: string, body: unknown }]
    expect(url).toBe('/api/admin/content')
    expect(options.method).toBe('PUT')
    expect(siteContentInputSchema.safeParse(JSON.parse(JSON.stringify(options.body))).success).toBe(true)
  })

  it('shows saving state while the request runs, then the success message', async () => {
    let resolve!: () => void
    fetchMock.mockReturnValue(new Promise<void>((done) => { resolve = done }))
    const wrapper = await mountPage()

    await wrapper.find('form').trigger('submit')
    expect(wrapper.find('.save-status').classes()).toContain('is-saving')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()

    resolve()
    await flushPromises()
    expect(wrapper.find('.save-status').classes()).toContain('is-success')
    expect(wrapper.find('.save-status').text()).toContain('Website opgeslagen')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined()
    expect(refreshMock).toHaveBeenCalledWith('nightlight-site-content')
  })

  it('shows the API error and re-enables saving when the request fails', async () => {
    fetchMock.mockRejectedValue({ data: { statusMessage: 'heroTitle: Vul een titel in' } })
    const wrapper = await mountPage()

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('.save-status').classes()).toContain('is-error')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined()
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('marks the form dirty after an edit and saves the edited value', async () => {
    fetchMock.mockResolvedValue({ content: {} })
    const wrapper = await mountPage()

    await wrapper.find('input[type="text"], textarea').setValue('Nieuwe waarde')
    expect(wrapper.find('.save-status').classes()).toContain('is-dirty')

    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(JSON.stringify(fetchMock.mock.calls[0]![1])).toContain('Nieuwe waarde')
  })
})

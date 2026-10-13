import { mount } from '@vue/test-utils'
import * as vue from 'vue'
import { describe, expect, it, vi } from 'vitest'

const online = vue.ref(true)
vi.stubGlobal('computed', vue.computed)
vi.stubGlobal('useOnline', () => online)
const AdminNavLink = (await import('../app/components/admin/AdminNavLink.vue')).default
const NuxtLink = { props: ['to'], template: '<a :href="to"><slot /></a>' }
const render = (to: string) => mount(AdminNavLink, { props: { to }, slots: { default: 'Label' }, global: { stubs: { NuxtLink } } })

describe('AdminNavLink', () => {
  it('is a normal link while online', () => {
    online.value = true
    expect(render('/admin/invoices').find('a').exists()).toBe(true)
  })

  it('stays a link offline when the page works offline', () => {
    online.value = false
    for (const to of ['/admin', '/admin/gigs', '/admin/calendar']) expect(render(to).find('a').exists(), to).toBe(true)
  })

  it('is greyed out, not a link and marked disabled offline when the page needs a connection', () => {
    online.value = false
    for (const to of ['/admin/invoices', '/admin/clients', '/admin/venues', '/admin/media', '/admin/account']) {
      const wrapper = render(to)
      expect(wrapper.find('a').exists(), to).toBe(false)
      expect(wrapper.find('span.unavailable').attributes('aria-disabled'), to).toBe('true')
      expect(wrapper.text()).toBe('Label')
    }
  })
})

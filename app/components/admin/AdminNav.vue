<script setup lang="ts">
import type { StaffRole } from '~~/shared/auth'

// Back-office navigation (brand, role-filtered links, account). Rendered inside
// the admin layout's sidebar and inside the drawer of full-screen pages that
// opt out of the layout, such as the video editor.

const route = useRoute()
const { user, clear } = useUserSession()

type NavItem = { label:string;to:string;icon:string;roles:readonly StaffRole[] }
type NavGroup = { label:string;items:NavItem[] }

const allRoles: readonly StaffRole[] = ['owner','manager','dj','content_editor']
const groups: NavGroup[] = [
  { label:'', items:[
    {label:'Dashboard',to:'/admin',icon:'lucide:layout-dashboard',roles:allRoles},
  ]},
  { label:'Werk', items:[
    {label:'Gigs',to:'/admin/gigs',icon:'lucide:disc-3',roles:['owner','manager','dj']},
    {label:'Agenda',to:'/admin/calendar',icon:'lucide:calendar-days',roles:['owner','manager']},
    {label:'Klanten',to:'/admin/clients',icon:'lucide:users',roles:['owner','manager']},
    {label:'Locaties',to:'/admin/venues',icon:'lucide:map-pin',roles:['owner','manager']},
    {label:'Email',to:'/admin/email',icon:'lucide:mail',roles:['owner','manager']},
  ]},
  { label:'Content', items:[
    {label:'Website',to:'/admin/content',icon:'lucide:globe',roles:['owner','content_editor']},
    {label:'Media',to:'/admin/media',icon:'lucide:images',roles:['owner','content_editor']},
    {label:'Post generator',to:'/admin/post-generator',icon:'lucide:sparkles',roles:['owner','content_editor']},
    {label:'Landing pages',to:'/admin/landing-pages',icon:'lucide:panels-top-left',roles:['owner','content_editor']},
  ]},
  { label:'Meer', items:[
    {label:'Klantportaal',to:'/admin/questionnaire',icon:'lucide:clipboard-list',roles:['owner','manager']},
    {label:'Systeemstatus',to:'/admin/system',icon:'lucide:activity',roles:['owner']},
  ]},
]

const footerItems: NavItem[] = [
  {label:'Instellingen',to:'/admin/settings',icon:'lucide:settings',roles:['owner']},
  {label:'Gebruikers',to:'/admin/users',icon:'lucide:user-cog',roles:['owner']},
]

const visibleGroups = computed(() => {
  const role = user.value?.role as StaffRole | undefined
  if (!role) return []
  return groups
    .map(group => ({...group,items:group.items.filter(item=>item.roles.includes(role))}))
    .filter(group=>group.items.length)
})

const visibleFooterItems = computed(() => {
  const role = user.value?.role as StaffRole | undefined
  if (!role) return []
  return footerItems.filter(item=>item.roles.includes(role))
})

function isActive(to:string){return to==='/admin'?route.path===to:route.path.startsWith(to)}
async function logout(){await $fetch('/api/auth/logout',{method:'POST'});await clear();await navigateTo('/admin/login')}
</script>

<template>
  <div class="sidebar-top">
    <NuxtLink to="/admin" class="brand">
      <span class="brand-mark">NL</span>
      <span>
        <strong>NightLight</strong>
        <small>Back office</small>
      </span>
    </NuxtLink>
  </div>

  <nav class="nav" aria-label="Admin navigatie">
    <section v-for="group in visibleGroups" :key="group.label || 'dashboard'" class="nav-group">
      <p v-if="group.label">{{ group.label }}</p>
      <NuxtLink
        v-for="item in group.items"
        :key="item.to"
        :to="item.to"
        class="nav-link"
        :class="{ active: isActive(item.to) }"
      >
        <Icon :name="item.icon" aria-hidden="true" />
        {{ item.label }}
      </NuxtLink>
    </section>
  </nav>

  <footer class="sidebar-footer">
    <nav v-if="visibleFooterItems.length" class="footer-nav" aria-label="Beheer">
      <NuxtLink
        v-for="item in visibleFooterItems"
        :key="item.to"
        :to="item.to"
        class="nav-link footer-link"
        :class="{ active: isActive(item.to) }"
      >
        <Icon :name="item.icon" aria-hidden="true" />
        {{ item.label }}
      </NuxtLink>
    </nav>

    <div class="account">
      <NuxtLink
        to="/admin/account"
        class="account-profile"
        :class="{ active: isActive('/admin/account') }"
        aria-label="Mijn account"
      >
        <span class="account-avatar">{{ (user?.name || 'DJ NightLight').slice(0, 1).toUpperCase() }}</span>
        <span class="account-copy">
          <strong>{{ user?.name || 'DJ NightLight' }}</strong>
          <small>{{ user?.email }}</small>
        </span>
        <Icon name="lucide:chevron-right" aria-hidden="true" />
      </NuxtLink>

      <button type="button" class="logout" @click="logout">
        <Icon name="lucide:log-out" aria-hidden="true" />
        Uitloggen
      </button>
    </div>
  </footer>
</template>

<style scoped>
.sidebar-top { padding: 1.1rem 1rem .7rem; }
.brand {
  display: flex;
  align-items: center;
  gap: .75rem;
  text-decoration: none;
}
.brand-mark {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  place-items: center;
  border-radius: .7rem;
  background: #fff;
  color: #0b0910;
  font-size: .75rem;
  font-weight: 900;
}
.brand strong, .brand small { display: block; }
.brand small { margin-top: .1rem; color: #817b8b; font-size: .72rem; }

.nav {
  flex: 1;
  overflow: auto;
  padding: .2rem .7rem .65rem;
}
.nav-group { margin-top: .7rem; }
.nav-group:first-child { margin-top: .2rem; }
.nav-group p {
  margin: 0 .6rem .25rem;
  color: #6f6978;
  font-size: .65rem;
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
}
.nav-link {
  display: flex;
  align-items: center;
  gap: .6rem;
  margin: .08rem 0;
  padding: .52rem .62rem;
  border-radius: .6rem;
  color: #b8b2c1;
  text-decoration: none;
  font-size: .86rem;
}
.nav-link svg { width: 1rem; height: 1rem; flex: 0 0 auto; color: #7f7889; }
.nav-link:hover { background: #17141c; color: #fff; }
.nav-link.active { background: #201b29; color: #fff; }
.nav-link:hover svg, .nav-link.active svg { color: #c7b5de; }

.sidebar-footer {
  flex: 0 0 auto;
  border-top: 1px solid #26222c;
}
.footer-nav {
  padding: .55rem .7rem .15rem;
}
.footer-link {
  padding-block: .48rem;
}

.account {
  display: grid;
  gap: .45rem;
  padding: .55rem .7rem .85rem;
}
.account-profile {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr) auto;
  align-items: center;
  gap: .6rem;
  padding: .55rem .6rem;
  border-radius: .65rem;
  color: #fff;
  text-decoration: none;
}
.account-profile:hover,
.account-profile.active { background: #17141c; }
.account-profile > svg {
  width: .9rem;
  height: .9rem;
  color: #6f6978;
}
.account-avatar {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: .6rem;
  background: #201b29;
  color: #c7b5de;
  font-size: .78rem;
  font-weight: 800;
}
.account-copy { min-width: 0; }
.account strong,
.account small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.account strong { font-size: .84rem; }
.account small { margin-top: .08rem; color: #817b8b; font-size: .68rem; }

.logout {
  display: flex;
  align-items: center;
  gap: .55rem;
  justify-self: start;
  border: 0;
  padding: .35rem .6rem;
  background: transparent;
  color: #a9a2b3;
  font: inherit;
  font-size: .8rem;
  cursor: pointer;
}
.logout:hover { color: #fff; }
.logout svg { width: .95rem; height: .95rem; }
</style>

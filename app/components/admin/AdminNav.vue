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
  { label:'Overview', items:[{label:'Dashboard',to:'/admin',icon:'lucide:layout-dashboard',roles:allRoles}] },
  { label:'Operations', items:[
    {label:'Gigs',to:'/admin/gigs',icon:'lucide:disc-3',roles:['owner','manager','dj']},
    {label:'Clients',to:'/admin/clients',icon:'lucide:users',roles:['owner','manager']},
    {label:'Venues',to:'/admin/venues',icon:'lucide:map-pin',roles:['owner','manager']},
    {label:'Calendar',to:'/admin/calendar',icon:'lucide:calendar-days',roles:['owner','manager']},
    {label:'Email',to:'/admin/email',icon:'lucide:mail',roles:['owner','manager']},
    {label:'Client portal',to:'/admin/questionnaire',icon:'lucide:clipboard-list',roles:['owner','manager']},
  ]},
  { label:'Content', items:[
    {label:'Media',to:'/admin/media',icon:'lucide:images',roles:['owner','content_editor']},
    {label:'Website',to:'/admin/content',icon:'lucide:globe',roles:['owner','content_editor']},
    {label:'Landing pages',to:'/admin/landing-pages',icon:'lucide:panels-top-left',roles:['owner','content_editor']},
    {label:'Post generator',to:'/admin/post-generator',icon:'lucide:sparkles',roles:['owner','content_editor']},
  ]},
  { label:'System', items:[
    {label:'Production status',to:'/admin/system',icon:'lucide:activity',roles:['owner']},
    {label:'Users',to:'/admin/users',icon:'lucide:user-cog',roles:['owner']},
    {label:'Settings',to:'/admin/settings',icon:'lucide:settings',roles:['owner']},
    {label:'My account',to:'/admin/account',icon:'lucide:circle-user',roles:allRoles},
  ]},
]

const visibleGroups = computed(() => {
  const role = user.value?.role as StaffRole | undefined
  if (!role) return []
  return groups
    .map(group => ({...group,items:group.items.filter(item=>item.roles.includes(role))}))
    .filter(group=>group.items.length)
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
    <section v-for="group in visibleGroups" :key="group.label" class="nav-group">
      <p>{{ group.label }}</p>
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

  <div class="account">
    <div>
      <strong>{{ user?.name || 'DJ NightLight' }}</strong>
      <small>{{ user?.email }}</small>
    </div>
    <button type="button" @click="logout"><Icon name="lucide:log-out" aria-hidden="true" /> Uitloggen</button>
  </div>
</template>

<style scoped>
.sidebar-top { padding: 1.35rem 1.25rem 1rem; }
.brand {
  display: flex;
  align-items: center;
  gap: .8rem;
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
  padding: .4rem .75rem 1rem;
}
.nav-group { margin-top: 1rem; }
.nav-group p {
  margin: 0 .65rem .35rem;
  color: #6f6978;
  font-size: .68rem;
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
}
.nav-link {
  display: flex;
  align-items: center;
  gap: .65rem;
  margin: .12rem 0;
  padding: .62rem .7rem;
  border-radius: .65rem;
  color: #b8b2c1;
  text-decoration: none;
  font-size: .9rem;
}
.nav-link svg { width: 1.05rem; height: 1.05rem; color: #7f7889; }
.nav-link:hover { background: #17141c; color: #fff; }
.nav-link.active { background: #201b29; color: #fff; }
.nav-link:hover svg, .nav-link.active svg { color: #c7b5de; }
.account {
  display: grid;
  gap: .7rem;
  padding: 1rem 1.25rem 1.2rem;
  border-top: 1px solid #26222c;
}
.account strong, .account small { display: block; overflow: hidden; text-overflow: ellipsis; }
.account small { margin-top: .2rem; color: #817b8b; font-size: .72rem; }
.account button {
  justify-self: start;
  border: 0;
  padding: 0;
  background: transparent;
  color: #a9a2b3;
  cursor: pointer;
}
</style>

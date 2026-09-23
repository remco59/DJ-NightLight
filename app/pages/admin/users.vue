<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
definePageMeta({ layout: 'admin' })

type Role = 'owner'|'dj'|'manager'|'content_editor'
type UserRow = { id:string;email:string;name:string;role:Role;active:boolean;createdAt:string;updatedAt:string }

const { data, refresh } = await useFetch<{users:UserRow[]}>('/api/admin/users')
const showCreate = ref(false)
const saving = ref(false)
const message = ref('')
const createForm = reactive({ name:'', email:'', role:'dj' as Exclude<Role,'owner'>, password:'' })
const resetPasswords = reactive<Record<string,string>>({})

async function createUser(){
  saving.value=true;message.value=''
  try{
    await $fetch('/api/admin/users',{method:'POST',body:createForm})
    Object.assign(createForm,{name:'',email:'',role:'dj',password:''})
    showCreate.value=false
    message.value='Account created.'
    await refresh()
  }catch(error:unknown){message.value=apiErrorMessage(error,'Could not create account.')}
  finally{saving.value=false}
}

async function saveUser(item:UserRow){
  saving.value=true;message.value=''
  try{
    const body:Record<string,unknown>={name:item.name,email:item.email,active:item.active}
    if(item.role!=='owner')body.role=item.role
    await $fetch(`/api/admin/users/${item.id}`,{method:'PUT',body})
    message.value='Account updated. Role or active-state changes revoke existing sessions.'
    await refresh()
  }catch(error:unknown){message.value=apiErrorMessage(error,'Could not update account.');await refresh()}
  finally{saving.value=false}
}

async function resetPassword(item:UserRow){
  const password=resetPasswords[item.id]||''
  if(password.length<12){message.value='A reset password must be at least 12 characters.';return}
  saving.value=true;message.value=''
  try{
    await $fetch(`/api/admin/users/${item.id}/password`,{method:'POST',body:{password}})
    resetPasswords[item.id]=''
    message.value=`Password reset for ${item.name}; their existing sessions were revoked.`
  }catch(error:unknown){message.value=apiErrorMessage(error,'Could not reset password.')}
  finally{saving.value=false}
}

function roleLabel(role:Role){return role==='content_editor'?'Content Editor':role.charAt(0).toUpperCase()+role.slice(1)}
useSeoMeta({title:'Users — DJ NightLight',robots:'noindex, nofollow'})
</script>

<template>
<div class="users-page">
<header class="page-header"><div><p class="eyebrow">System</p><h1>Users</h1><p>Create staff accounts, assign roles and revoke access without deleting history.</p></div><button class="with-icon primary" @click="showCreate=!showCreate"><Icon :name="showCreate?'lucide:x':'lucide:plus'" aria-hidden="true" />{{showCreate?'Close':'New user'}}</button></header>

<form v-if="showCreate" class="card create" @submit.prevent="createUser">
<h2>New staff account</h2>
<div class="grid"><label>Name<input v-model="createForm.name" required></label><label>Email<input v-model="createForm.email" type="email" required></label><label>Role<select v-model="createForm.role"><option value="dj">DJ</option><option value="manager">Manager</option><option value="content_editor">Content Editor</option></select></label><label>Initial password<input v-model="createForm.password" type="password" minlength="12" required><small>The user can change this from My account.</small></label></div>
<button class="primary" :disabled="saving">Create account</button>
</form>

<p v-if="message" class="message">{{message}}</p>
<section class="list">
<article v-for="item in data?.users||[]" :key="item.id" class="card user-card">
<div class="user-heading"><div><strong>{{item.name}}</strong><span>{{item.email}}</span></div><span class="badge" :data-active="item.active">{{item.active?'Active':'Disabled'}}</span></div>
<div class="grid">
<label>Name<input v-model="item.name"></label>
<label>Email<input v-model="item.email" type="email"></label>
<label>Role
<select v-if="item.role!=='owner'" v-model="item.role"><option value="dj">DJ</option><option value="manager">Manager</option><option value="content_editor">Content Editor</option></select>
<input v-else :value="roleLabel(item.role)" disabled>
</label>
<label class="toggle"><input v-model="item.active" type="checkbox" :disabled="item.role==='owner'"> Active account</label>
</div>
<div class="row-actions"><button class="secondary" :disabled="saving" @click="saveUser(item)">Save changes</button><span>Created {{new Date(item.createdAt).toLocaleDateString('nl-NL')}}</span></div>
<div v-if="item.role!=='owner'" class="password-reset"><label>Set new password<input v-model="resetPasswords[item.id]" type="password" minlength="12" placeholder="At least 12 characters"></label><button class="secondary" :disabled="saving" @click="resetPassword(item)">Reset password</button></div>
</article>
</section>
</div>
</template>

<style scoped>
.users-page{max-width:980px;margin-inline:auto}.page-header{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin-bottom:1.5rem}h1{margin:.2rem 0;font-size:clamp(2.5rem,6vw,4rem);letter-spacing:-.05em}.page-header p:last-child{margin:0;color:#8e8797}.card{padding:1.2rem;border:1px solid #2b2631;border-radius:1rem;background:#100e14}.create{margin-bottom:1rem}.create h2{margin-top:0}.list{display:grid;gap:.8rem}.user-heading,.row-actions,.password-reset{display:flex;align-items:center;justify-content:space-between;gap:1rem}.user-heading{margin-bottom:1rem}.user-heading strong,.user-heading span{display:block}.user-heading>div span,.row-actions span{color:#817a8b;font-size:.78rem}.badge{padding:.22rem .5rem;border-radius:999px;background:#2a181c;color:#e7a2ad;font-size:.68rem}.badge[data-active=true]{background:#14251d;color:#9be6ba}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.8rem}label{display:grid;gap:.35rem;color:#aaa4b1;font-size:.8rem}input,select{width:100%;border:1px solid #332e39;border-radius:.65rem;padding:.7rem;background:#0b0a0d;color:#f6f3fa}.toggle{display:flex;align-items:center;gap:.6rem}.toggle input{width:auto}.row-actions{margin-top:1rem}.password-reset{margin-top:1rem;padding-top:1rem;border-top:1px solid #29242f}.password-reset label{flex:1}.primary,.secondary{border:0;border-radius:.7rem;padding:.75rem 1rem;font-weight:800;cursor:pointer}.primary{background:#fff;color:#09080b}.secondary{background:#211c27;color:#eee9f2}.message{padding:.8rem 1rem;border:1px solid #2c2733;border-radius:.8rem;color:#aaa4b1}.primary:disabled,.secondary:disabled{opacity:.6}@media(max-width:650px){.page-header,.user-heading,.row-actions,.password-reset{align-items:stretch;flex-direction:column}.page-header .primary{width:100%}.grid{grid-template-columns:1fr}}
</style>

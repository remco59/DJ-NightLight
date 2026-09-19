<script setup lang="ts">
const route = useRoute()
const { loggedIn, fetch: refreshSession } = useUserSession()

const form = reactive({
  email: '',
  password: '',
})
const pending = ref(false)
const errorMessage = ref('')

if (loggedIn.value) {
  await navigateTo('/admin')
}

async function submit() {
  pending.value = true
  errorMessage.value = ''

  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: form,
    })
    await refreshSession()

    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/admin')
      ? route.query.redirect
      : '/admin'

    await navigateTo(redirect)
  } catch {
    errorMessage.value = 'Inloggen is niet gelukt. Controleer je gegevens.'
  } finally {
    pending.value = false
  }
}

useSeoMeta({
  title: 'Inloggen — DJ NightLight',
  robots: 'noindex, nofollow',
})
</script>

<template>
  <main class="login-page">
    <form class="login-card" @submit.prevent="submit">
      <div>
        <p class="eyebrow">DJ NightLight</p>
        <h1>Back office</h1>
        <p>Log in om boekingen en website-inhoud te beheren.</p>
      </div>

      <label>
        E-mailadres
        <input v-model="form.email" type="email" autocomplete="username" required>
      </label>

      <label>
        Wachtwoord
        <input v-model="form.password" type="password" autocomplete="current-password" minlength="8" required>
      </label>

      <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
      <button type="submit" :disabled="pending">
        {{ pending ? 'Inloggen…' : 'Inloggen' }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 1.5rem;
}
.login-card {
  width: min(100%, 28rem);
  display: grid;
  gap: 1.25rem;
  padding: clamp(1.5rem, 4vw, 2.5rem);
  border: 1px solid #28252f;
  border-radius: 1.5rem;
  background: rgba(16, 15, 20, .9);
}
h1 { margin: .35rem 0; font-size: 2.5rem; }
p { color: #aaa5b6; }
label { display: grid; gap: .5rem; font-size: .9rem; }
input {
  width: 100%;
  border: 1px solid #34303d;
  border-radius: .75rem;
  padding: .9rem 1rem;
  background: #0d0c10;
  color: inherit;
}
button {
  border: 0;
  border-radius: .75rem;
  padding: .95rem 1rem;
  font-weight: 700;
  cursor: pointer;
}
button:disabled { opacity: .6; cursor: wait; }
.error { color: #ff9c9c; margin: 0; }
</style>

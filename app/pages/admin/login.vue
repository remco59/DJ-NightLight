<script setup lang="ts">
const route = useRoute()
const { loggedIn, fetch: refreshSession } = useUserSession()

const form = reactive({
  email: '',
  password: '',
})
const pending = ref(false)
const errorMessage = ref('')
const showPassword = ref(false)

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
    <div class="login-backdrop" aria-hidden="true" />

    <form class="login-card" @submit.prevent="submit">
      <header class="login-header">
        <img class="brand-logo" src="/brand/logo/wordmark-thumb.webp" alt="DJ NightLight">
        <span class="accent-line" aria-hidden="true" />
        <h1>Welkom terug</h1>
        <p>Log in bij de NightLight back office om boekingen en website-inhoud te beheren.</p>
      </header>

      <div class="field">
        <label for="login-email">E-mailadres</label>
        <div class="input-wrap">
          <Icon name="lucide:mail" aria-hidden="true" />
          <input
            id="login-email"
            v-model="form.email"
            type="email"
            autocomplete="username"
            inputmode="email"
            required
            autofocus
          >
        </div>
      </div>

      <div class="field">
        <label for="login-password">Wachtwoord</label>
        <div class="input-wrap">
          <Icon name="lucide:lock-keyhole" aria-hidden="true" />
          <input
            id="login-password"
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            minlength="8"
            required
          >
          <button
            class="password-toggle"
            type="button"
            :aria-label="showPassword ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'"
            :aria-pressed="showPassword"
            @click="showPassword = !showPassword"
          >
            <Icon :name="showPassword ? 'lucide:eye-off' : 'lucide:eye'" aria-hidden="true" />
          </button>
        </div>
      </div>

      <p v-if="errorMessage" class="error" role="alert">
        <Icon name="lucide:circle-alert" aria-hidden="true" />
        {{ errorMessage }}
      </p>

      <button class="login-button" type="submit" :disabled="pending">
        <span>{{ pending ? 'Inloggen…' : 'Inloggen' }}</span>
        <Icon v-if="pending" name="lucide:loader-circle" class="spinner" aria-hidden="true" />
        <Icon v-else name="lucide:arrow-right" aria-hidden="true" />
      </button>

      <footer class="login-footer">
        <span><Icon name="lucide:lock" aria-hidden="true" /> Beveiligde beheeromgeving</span>
        <small>© {{ new Date().getFullYear() }} DJ NightLight</small>
      </footer>
    </form>
  </main>
</template>

<style scoped>
.login-page {
  position: relative;
  min-height: 100svh;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: clamp(1rem, 4vw, 2rem);
  isolation: isolate;
  background: #06050a;
}

.login-backdrop {
  position: absolute;
  z-index: -2;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(5, 4, 9, .76), rgba(9, 5, 18, .42) 50%, rgba(5, 4, 9, .74)),
    linear-gradient(0deg, rgba(4, 3, 8, .82), transparent 48%, rgba(4, 3, 8, .35)),
    url('/images/login-background.webp') center / cover no-repeat;
  filter: saturate(1.08) contrast(1.04);
  transform: scale(1.015);
}

.login-page::before,
.login-page::after {
  content: "";
  position: absolute;
  z-index: -1;
  pointer-events: none;
}

.login-page::before {
  inset: 0;
  background:
    radial-gradient(circle at 50% 48%, rgba(126, 66, 255, .22), transparent 31%),
    radial-gradient(circle at 76% 28%, rgba(168, 85, 247, .09), transparent 26%);
}

.login-page::after {
  inset: -20%;
  opacity: .12;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.22'/%3E%3C/svg%3E");
}

.login-card {
  width: min(100%, 36rem);
  display: grid;
  gap: 1.35rem;
  padding: clamp(1.5rem, 5vw, 3rem);
  border: 1px solid rgba(156, 112, 255, .32);
  border-radius: 1.6rem;
  background: linear-gradient(145deg, rgba(16, 14, 23, .94), rgba(10, 9, 15, .9));
  box-shadow:
    0 2.5rem 7rem rgba(0, 0, 0, .52),
    0 0 4rem rgba(112, 56, 255, .12),
    inset 0 1px rgba(255, 255, 255, .025);
  backdrop-filter: blur(18px);
}

.login-header {
  display: grid;
  justify-items: center;
  text-align: center;
  margin-bottom: .25rem;
}

.brand-logo {
  width: min(15rem, 68%);
  height: auto;
  object-fit: contain;
  filter: drop-shadow(0 0 1.6rem rgba(137, 79, 255, .26));
}

.accent-line {
  width: 2.7rem;
  height: 2px;
  margin: 1.15rem 0 1.35rem;
  border-radius: 999px;
  background: linear-gradient(90deg, #7138ff, #c173ff);
  box-shadow: 0 0 1rem rgba(162, 86, 255, .55);
}

h1 {
  margin: 0;
  font-size: clamp(2.15rem, 5vw, 3rem);
  line-height: .98;
  letter-spacing: -.035em;
}

.login-header p {
  max-width: 29rem;
  margin: .8rem 0 0;
  color: #a9a2b5;
  line-height: 1.55;
}

.field {
  display: grid;
  gap: .48rem;
}

.field label {
  font-size: .9rem;
  font-weight: 700;
  color: #f3eff8;
}

.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.input-wrap > :deep(svg) {
  position: absolute;
  left: 1rem;
  z-index: 1;
  width: 1.05rem;
  height: 1.05rem;
  color: #9a6cff;
  pointer-events: none;
}

input {
  width: 100%;
  min-height: 3.55rem;
  border: 1px solid #363040;
  border-radius: .8rem;
  padding: .85rem 3.25rem .85rem 2.85rem;
  outline: none;
  background: rgba(8, 7, 12, .82);
  color: #fff;
  font: inherit;
  transition: border-color .16s ease, box-shadow .16s ease, background .16s ease;
}

input:hover {
  border-color: #4c435d;
}

input:focus {
  border-color: #8c56ff;
  background: rgba(10, 8, 15, .96);
  box-shadow: 0 0 0 3px rgba(129, 72, 255, .14), 0 0 1.5rem rgba(115, 55, 255, .1);
}

input:-webkit-autofill {
  -webkit-text-fill-color: #fff;
  box-shadow: 0 0 0 1000px #0b0910 inset;
  caret-color: #fff;
}

.password-toggle {
  position: absolute;
  right: .55rem;
  display: grid;
  place-items: center;
  width: 2.55rem;
  height: 2.55rem;
  padding: 0;
  border: 0;
  border-radius: .65rem;
  background: transparent;
  color: #aaa2b5;
  cursor: pointer;
}

.password-toggle:hover {
  color: #fff;
  background: rgba(255, 255, 255, .05);
}

.password-toggle :deep(svg) {
  width: 1.1rem;
  height: 1.1rem;
}

.error {
  display: flex;
  align-items: center;
  gap: .55rem;
  margin: -.15rem 0 0;
  padding: .75rem .85rem;
  border: 1px solid rgba(255, 110, 110, .28);
  border-radius: .75rem;
  background: rgba(113, 26, 37, .2);
  color: #ffb0b0;
  font-size: .9rem;
}

.error :deep(svg) {
  flex: 0 0 auto;
}

.login-button {
  min-height: 3.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: .65rem;
  border: 1px solid rgba(255, 255, 255, .13);
  border-radius: .82rem;
  padding: .9rem 1rem;
  background: linear-gradient(100deg, #6527ff 0%, #873cff 52%, #bd6dff 100%);
  color: #fff;
  font: inherit;
  font-weight: 800;
  box-shadow: 0 .9rem 2.5rem rgba(109, 40, 217, .28), inset 0 1px rgba(255, 255, 255, .17);
  cursor: pointer;
  transition: transform .16s ease, filter .16s ease, box-shadow .16s ease;
}

.login-button:hover:not(:disabled) {
  transform: translateY(-1px);
  filter: brightness(1.08);
  box-shadow: 0 1rem 3rem rgba(109, 40, 217, .36), inset 0 1px rgba(255, 255, 255, .2);
}

.login-button:active:not(:disabled) {
  transform: translateY(0);
}

.login-button:disabled {
  opacity: .65;
  cursor: wait;
}

.login-button :deep(svg) {
  width: 1.15rem;
  height: 1.15rem;
}

.spinner {
  animation: spin .8s linear infinite;
}

.login-footer {
  display: grid;
  justify-items: center;
  gap: .5rem;
  margin-top: .35rem;
  padding-top: 1.25rem;
  border-top: 1px solid rgba(255, 255, 255, .08);
  color: #81798b;
  text-align: center;
}

.login-footer span {
  display: inline-flex;
  align-items: center;
  gap: .45rem;
  font-size: .78rem;
}

.login-footer :deep(svg) {
  width: .85rem;
  height: .85rem;
  color: #8d5cff;
}

.login-footer small {
  font-size: .72rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 600px) {
  .login-page {
    align-items: center;
    padding: 1rem;
  }

  .login-card {
    border-radius: 1.25rem;
    padding: 1.5rem;
    gap: 1.15rem;
  }

  .brand-logo {
    width: min(13rem, 72%);
  }

  .accent-line {
    margin: .9rem 0 1.1rem;
  }

  .login-header p {
    font-size: .92rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .login-button,
  input {
    transition: none;
  }

  .spinner {
    animation-duration: 1.6s;
  }
}
</style>

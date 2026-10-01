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
    url("data:image/webp;base64,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") center / cover no-repeat;
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

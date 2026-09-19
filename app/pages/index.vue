<script setup lang="ts">
useSeoMeta({
  title: 'DJ NightLight',
  description: 'DJ NightLight — custom DJ experiences for clubs, weddings, student parties and events.',
})
</script>

<template>
  <main class="container placeholder-home">
    <p class="eyebrow">DJ NightLight</p>
    <h1>Night starts here.</h1>
    <p>The new DJ NightLight website is being built.</p>
  </main>
</template>

<style scoped>
.placeholder-home {
  display: grid;
  min-height: 100vh;
  align-content: center;
  gap: 1rem;
}
h1 {
  margin: 0;
  font-size: clamp(3.5rem, 10vw, 8rem);
  line-height: .88;
  letter-spacing: -.06em;
}
p { max-width: 42rem; color: #c7c4d1; }
</style>

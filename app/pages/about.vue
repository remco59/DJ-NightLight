<script setup lang="ts">
definePageMeta({ layout: 'public' })

const { data } = await useSiteContent()
const content = computed(() => data.value?.content)

const aboutFallback = {
  url: 'https://images.unsplash.com/photo-1774301810239-99502e33180e?auto=format&fit=crop&w=1800&q=85',
  alt: 'DJ voor een volle dansvloer',
}
const roomFallback = {
  url: 'https://images.unsplash.com/photo-1768054485751-bab2eda850b8?auto=format&fit=crop&w=2200&q=85',
  alt: 'Publiek onder blauwe en paarse podiumlichten',
}

const gallery = computed(() => (content.value?.gallery ?? [])
  .filter(image => Boolean(image.url))
  .map(image => ({ url: image.url, alt: image.alt || 'NightLight sfeerbeeld' })))

const leadVisual = computed(() => {
  if (content.value?.heroImageUrl) {
    return { url: content.value.heroImageUrl, alt: 'NightLight tijdens een avond achter de booth' }
  }

  return gallery.value[0] || aboutFallback
})

const roomVisual = computed(() => gallery.value[1] || gallery.value[0] || roomFallback)

useSeoMeta({
  title: () => `Over — ${content.value?.brandName || 'DJ NightLight'}`,
  description: () => content.value?.aboutBody,
})
</script>

<template>
  <main v-if="content" class="public-page about-page">
    <div class="public-container">
      <header class="about-intro">
        <div class="intro-copy">
          <p class="eyebrow">{{ content.aboutEyebrow }}</p>
          <h1 class="display-title">{{ content.aboutTitle }}</h1>
          <p class="intro-lead">{{ content.aboutBody }}</p>
        </div>

        <figure class="intro-visual">
          <img :src="leadVisual.url" :alt="leadVisual.alt">
          <figcaption>
            <span>NightLight</span>
            <strong>Allround, maar nooit willekeurig.</strong>
          </figcaption>
        </figure>
      </header>

      <section class="story">
        <p class="story-kicker">De muziek volgt niet de playlist.<br>De muziek volgt de avond.</p>
        <div class="story-copy">
          <p>De set volgt de avond: achtergrond waar het moet, herkenning wanneer de groep samenkomt en energie zodra de dansvloer er klaar voor is.</p>
          <p>Dat betekent soms langer wachten met die ene grote plaat. Soms juist eerder schakelen dan gepland. De zaal geeft het tempo aan.</p>
        </div>
      </section>

      <figure class="room-visual">
        <img :src="roomVisual.url" :alt="roomVisual.alt" loading="lazy">
        <div class="room-overlay" />
        <figcaption>
          <p class="eyebrow">Het moment</p>
          <blockquote>“Een goede overgang hoor je. Een goede avond voel je.”</blockquote>
          <span>Van achtergrondmuziek naar een volle vloer — zonder dat de avond geforceerd voelt.</span>
        </figcaption>
      </figure>

      <section class="principles-wrap">
        <div class="principles-intro">
          <p class="eyebrow">Hoe NightLight draait</p>
          <h2>Lezen. Opbouwen. Schakelen.</h2>
        </div>

        <div class="principles">
          <article>
            <span>01</span>
            <h3>Lezen</h3>
            <p>Geen vooraf dichtgetimmerde playlist. Eerst kijken wat de zaal nodig heeft.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Opbouwen</h3>
            <p>Een feest hoeft niet om 20:00 al op 100%. De energie mag groeien.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Schakelen</h3>
            <p>Van klassieker naar house, van pop naar guilty pleasure — zolang de overgang klopt.</p>
          </article>
        </div>
      </section>

      <section class="about-cta">
        <p class="eyebrow">Jouw avond</p>
        <div>
          <h2>Genoeg over de DJ.<br>Wat ga jij vieren?</h2>
          <NuxtLink class="public-button" to="/boeken">Vertel over je feest</NuxtLink>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.about-page{padding-bottom:0}.about-intro{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(22rem,.72fr);gap:clamp(3rem,7vw,7rem);align-items:end}.intro-copy{padding-bottom:clamp(1rem,5vw,4rem)}.intro-copy .display-title{max-width:12ch}.intro-lead{max-width:46rem;margin:2rem 0 0;color:#b0aab5;font-size:clamp(1.12rem,1.8vw,1.48rem);line-height:1.72}.intro-visual{position:relative;min-height:min(66vh,44rem);margin:0;overflow:hidden;border-radius:1.1rem;background:#111014}.intro-visual::after{content:"";position:absolute;inset:0;background:linear-gradient(0deg,rgba(7,7,9,.88),transparent 48%)}.intro-visual img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(.92) contrast(1.04)}.intro-visual figcaption{position:absolute;z-index:1;left:1.3rem;right:1.3rem;bottom:1.35rem}.intro-visual figcaption span{display:block;margin-bottom:.55rem;color:#9e97a4;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase}.intro-visual figcaption strong{display:block;max-width:15ch;font-size:clamp(1.45rem,2.4vw,2.25rem);line-height:1.05;letter-spacing:-.045em}

.story{display:grid;grid-template-columns:1fr 1fr;gap:clamp(3rem,10vw,10rem);align-items:start;padding:clamp(7rem,11vw,11rem) 0}.story-kicker{margin:0;max-width:16ch;font-size:clamp(2.5rem,4.8vw,4.7rem);font-weight:800;line-height:.98;letter-spacing:-.06em}.story-copy{max-width:42rem}.story-copy p{margin:0;color:#aaa4af;font-size:clamp(1.04rem,1.55vw,1.28rem);line-height:1.78}.story-copy p+p{margin-top:1.4rem;color:#827c88}

.room-visual{position:relative;height:min(76vh,52rem);margin:0;overflow:hidden;border-radius:1.2rem;background:#111014}.room-visual img{width:100%;height:100%;object-fit:cover}.room-overlay{position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,7,9,.88) 0%,rgba(7,7,9,.38) 50%,rgba(7,7,9,.12) 100%),linear-gradient(0deg,rgba(7,7,9,.75),transparent 50%)}.room-visual figcaption{position:absolute;z-index:1;left:clamp(1.5rem,4vw,4rem);right:clamp(1.5rem,4vw,4rem);bottom:clamp(1.5rem,5vw,4rem);max-width:48rem}.room-visual blockquote{margin:.8rem 0 1rem;max-width:14ch;font-size:clamp(2.7rem,5.5vw,5.5rem);font-weight:800;line-height:.94;letter-spacing:-.065em}.room-visual figcaption>span{display:block;max-width:34rem;color:#b6b0bc;line-height:1.65}

.principles-wrap{padding:clamp(7rem,12vw,12rem) 0}.principles-intro{display:grid;grid-template-columns:.55fr 1fr;gap:3rem;align-items:end;margin-bottom:4rem}.principles-intro h2{max-width:12ch;margin:0;font-size:clamp(3rem,6vw,6rem);line-height:.92;letter-spacing:-.065em}.principles{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid #2a2630}.principles article{padding:1.5rem 2rem 1rem 0;border-right:1px solid #2a2630}.principles article+article{padding-left:2rem}.principles article:last-child{border-right:0}.principles span{color:#6f6874;font-size:.68rem;letter-spacing:.1em}.principles h3{margin:5rem 0 .8rem;font-size:clamp(1.8rem,2.8vw,2.6rem);letter-spacing:-.045em}.principles p{max-width:24rem;margin:0;color:#938d99;line-height:1.68}

.about-cta{display:grid;grid-template-columns:.55fr 1fr;gap:3rem;align-items:start;padding:clamp(6rem,10vw,10rem) 0;border-top:1px solid #27232c}.about-cta h2{max-width:15ch;margin:0 0 2rem;font-size:clamp(3rem,6vw,6rem);line-height:.93;letter-spacing:-.065em}

@media(max-width:900px){.about-intro{grid-template-columns:1fr}.intro-copy{padding-bottom:0}.intro-visual{min-height:32rem}.story{grid-template-columns:1fr;gap:2.5rem}.principles-intro,.about-cta{grid-template-columns:1fr;gap:1.5rem}}
@media(max-width:700px){.about-intro{gap:2.4rem}.intro-visual{min-height:28rem}.story{padding:6rem 0}.room-visual{height:66vh}.room-overlay{background:linear-gradient(0deg,rgba(7,7,9,.9),rgba(7,7,9,.14) 80%)}.principles-wrap{padding:6rem 0}.principles{grid-template-columns:1fr}.principles article,.principles article+article{padding:1.4rem 0 2.5rem;border-right:0;border-bottom:1px solid #2a2630}.principles article:last-child{border-bottom:0}.principles h3{margin:2.5rem 0 .6rem}.about-cta{padding:5.5rem 0 6.5rem}}
</style>

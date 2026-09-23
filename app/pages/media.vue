<script setup lang="ts">
definePageMeta({ layout: 'public' })

const { data } = await useSiteContent()
const content = computed(() => data.value?.content)

type MediaImage = {
  url: string
  alt: string
}

const gallery = computed<MediaImage[]>(() => (content.value?.gallery ?? [])
  .filter(image => Boolean(image.url))
  .map(image => ({
    url: image.url,
    alt: image.alt || 'NightLight sfeerbeeld',
  })))

const selectedImage = ref<MediaImage | null>(null)

const showreelVisual = computed(() => content.value?.publicCopy.visuals.mediaShowreelImageUrl
  ? { url: content.value.publicCopy.visuals.mediaShowreelImageUrl, alt: content.value.publicCopy.visuals.mediaShowreelAlt }
  : gallery.value[0] || null)

const showreelStyle = computed(() => showreelVisual.value
  ? {
      backgroundImage: `linear-gradient(90deg, rgba(7,7,9,.84), rgba(7,7,9,.26)), linear-gradient(0deg, rgba(7,7,9,.82), transparent 55%), url("${showreelVisual.value.url}")`,
    }
  : undefined)

function openImage(image: MediaImage) {
  selectedImage.value = image
}

function closeImage() {
  selectedImage.value = null
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeImage()
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))

useSeoMeta({
  title: () => `Media — ${content.value?.brandName || 'DJ NightLight'}`,
  description: () => content.value?.mediaBody,
})
</script>

<template>
  <main v-if="content" class="public-page media-page">
    <div class="public-container">
      <header class="media-intro">
        <div>
          <p class="eyebrow">{{ content.mediaEyebrow }}</p>
          <h1 class="display-title">{{ content.mediaTitle }}</h1>
          <p class="lead-copy">{{ content.mediaBody }}</p>
        </div>

        <aside class="media-types" aria-label="Mediaformaten">
          <span v-for="label in content.publicCopy.media.typeLabels" :key="label">{{ label }}</span>
        </aside>
      </header>

      <a
        v-if="content.showreelUrl"
        class="featured-showreel"
        :class="{ 'has-image': gallery.length }"
        :href="content.showreelUrl"
        :style="showreelStyle"
        target="_blank"
        rel="noreferrer"
      >
        <div class="showreel-top">
          <span>{{ content.publicCopy.media.showreelEyebrow }}</span>
          <span>{{ content.publicCopy.media.showreelExternalLabel }} <Icon name="lucide:arrow-up-right" aria-hidden="true" /></span>
        </div>
        <div class="showreel-bottom">
          <span class="play" aria-hidden="true"><Icon name="lucide:play" /></span>
          <div>
            <strong>{{ content.publicCopy.media.showreelTitle }}</strong>
            <p>{{ content.publicCopy.media.showreelBody }}</p>
          </div>
        </div>
      </a>

      <section v-if="gallery.length" class="gallery-section">
        <div class="section-heading">
          <p class="eyebrow">{{ content.publicCopy.media.galleryEyebrow }}</p>
          <p>{{ gallery.length }} {{ gallery.length === 1 ? content.publicCopy.media.imageSingular : content.publicCopy.media.imagePlural }}</p>
        </div>

        <div class="gallery">
          <button
            v-for="(image,index) in gallery"
            :key="`${image.url}-${index}`"
            class="gallery-item"
            type="button"
            :aria-label="`Open beeld ${index + 1}: ${image.alt}`"
            @click="openImage(image)"
          >
            <img :src="image.url" :alt="image.alt" loading="lazy">
            <span class="image-index">0{{ index + 1 }}</span>
            <span class="image-caption">{{ image.alt }}</span>
          </button>
        </div>
      </section>

      <section v-else class="empty-media">
        <div class="empty-glow" aria-hidden="true" />
        <div class="visualizer" aria-hidden="true">
          <i v-for="bar in 18" :key="bar" :style="{ '--bar': bar }" />
        </div>

        <div class="empty-copy">
          <p class="eyebrow">{{ content.publicCopy.media.emptyEyebrow }}</p>
          <h2>{{ content.publicCopy.media.emptyTitle }}</h2>
          <p>{{ content.publicCopy.media.emptyBody }}</p>
        </div>

        <div class="empty-meta">
          <span v-for="label in content.publicCopy.media.emptyMeta" :key="label">{{ label }}</span>
        </div>
      </section>
    </div>

    <div v-if="selectedImage" class="lightbox" role="dialog" aria-modal="true" aria-label="Afbeelding bekijken" @click.self="closeImage">
      <button type="button" class="lightbox-close" :aria-label="content.publicCopy.media.closeLabel" @click="closeImage">{{ content.publicCopy.media.closeLabel }} <Icon name="lucide:x" aria-hidden="true" /></button>
      <figure>
        <img :src="selectedImage.url" :alt="selectedImage.alt">
        <figcaption>{{ selectedImage.alt }}</figcaption>
      </figure>
    </div>
  </main>
</template>

<style scoped>
.media-intro{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4rem;align-items:end}.media-intro .display-title{max-width:13ch}.media-types{display:flex;gap:.6rem;flex-wrap:wrap;justify-content:flex-end;padding-bottom:.35rem}.media-types span{padding:.58rem .78rem;border:1px solid #302c34;border-radius:999px;color:#9993a0;font-size:.75rem}

.featured-showreel{position:relative;display:grid;min-height:min(62vh,43rem);align-content:space-between;margin-top:clamp(4rem,7vw,7rem);padding:clamp(1.2rem,3vw,2.2rem);overflow:hidden;border:1px solid #2b2630;border-radius:1.2rem;background:radial-gradient(circle at 70% 25%,rgba(108,63,221,.28),transparent 28%),linear-gradient(135deg,#121016,#0a090c 58%);background-size:cover;background-position:center;text-decoration:none}.featured-showreel::before{content:"";position:absolute;inset:0;opacity:.28;background:linear-gradient(115deg,transparent 25%,rgba(255,255,255,.05) 50%,transparent 68%);transform:translateX(-60%);transition:transform .7s ease}.featured-showreel:hover::before{transform:translateX(60%)}.featured-showreel::after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 1px rgba(255,255,255,.025);pointer-events:none}.showreel-top,.showreel-bottom{position:relative;z-index:1}.showreel-top{display:flex;justify-content:space-between;gap:1rem;color:#aca6b2;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase}.showreel-bottom{display:flex;align-items:end;gap:1.2rem}.play{display:grid;width:4.4rem;height:4.4rem;place-items:center;flex:0 0 auto;border-radius:50%;background:#fff;color:#08080a;font-size:1.35rem;padding-left:.18rem}.showreel-bottom strong{display:block;max-width:13ch;font-size:clamp(2.5rem,5vw,5rem);line-height:.92;letter-spacing:-.06em}.showreel-bottom p{margin:.7rem 0 0;color:#aaa4af}

.gallery-section{margin-top:clamp(6rem,10vw,10rem)}.section-heading{display:flex;justify-content:space-between;align-items:end;gap:2rem;margin-bottom:1.2rem}.section-heading>p:last-child{margin:0;color:#716b77;font-size:.78rem}.gallery{display:grid;grid-template-columns:repeat(12,1fr);grid-auto-flow:dense;gap:.85rem}.gallery-item{position:relative;grid-column:span 5;min-height:29rem;padding:0;overflow:hidden;border:0;border-radius:1rem;background:#111014;color:#fff;text-align:left;cursor:zoom-in}.gallery-item:nth-child(4n+1){grid-column:span 7;min-height:39rem}.gallery-item:nth-child(4n+4){grid-column:span 7;min-height:33rem}.gallery-item img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .65s cubic-bezier(.2,.7,.2,1),filter .4s ease}.gallery-item::after{content:"";position:absolute;inset:0;background:linear-gradient(0deg,rgba(7,7,9,.78),transparent 48%);opacity:.75;transition:opacity .3s ease}.gallery-item:hover img{transform:scale(1.025);filter:saturate(1.08)}.gallery-item:hover::after{opacity:1}.image-index,.image-caption{position:absolute;z-index:1;bottom:1rem}.image-index{left:1rem;color:#aaa4b0;font-size:.68rem}.image-caption{right:1rem;left:4rem;color:#e2dde6;font-size:.8rem;text-align:right;opacity:0;transform:translateY(.35rem);transition:opacity .25s ease,transform .25s ease}.gallery-item:hover .image-caption,.gallery-item:focus-visible .image-caption{opacity:1;transform:none}

.empty-media{position:relative;display:grid;min-height:min(67vh,47rem);align-content:end;margin-top:clamp(4rem,7vw,7rem);padding:clamp(1.5rem,4vw,3.5rem);overflow:hidden;border-top:1px solid #29242e;border-bottom:1px solid #29242e;background:linear-gradient(180deg,rgba(13,11,16,.2),rgba(13,11,16,.78))}.empty-glow{position:absolute;width:38rem;height:38rem;right:8%;top:-10rem;border-radius:50%;background:radial-gradient(circle,rgba(111,67,220,.26),transparent 65%);filter:blur(10px)}.visualizer{position:absolute;inset:16% 5% auto;display:flex;height:36%;align-items:center;justify-content:center;gap:clamp(.18rem,.7vw,.7rem);opacity:.22}.visualizer i{width:min(1.4vw,.8rem);height:calc(8% + (var(--bar) * 4%));max-height:100%;border-radius:999px;background:linear-gradient(180deg,#e4dafe,#6d46be);transform:scaleY(calc(.35 + (var(--bar) / 24)));transform-origin:center}.visualizer i:nth-child(2n){transform:scaleY(.48)}.visualizer i:nth-child(3n){transform:scaleY(.86)}.empty-copy,.empty-meta{position:relative;z-index:1}.empty-copy h2{margin:.7rem 0 1.2rem;white-space:pre-line;font-size:clamp(3.4rem,7vw,7rem);line-height:.88;letter-spacing:-.07em}.empty-copy>p:last-child{max-width:37rem;margin:0;color:#9a94a0;line-height:1.7}.empty-meta{display:flex;gap:1.4rem;flex-wrap:wrap;margin-top:2.5rem;color:#6f6975;font-size:.7rem;text-transform:uppercase;letter-spacing:.08em}

.lightbox{position:fixed;z-index:100;inset:0;display:grid;place-items:center;padding:clamp(1rem,4vw,4rem);background:rgba(5,4,7,.94);backdrop-filter:blur(18px)}.lightbox-close{position:absolute;z-index:2;top:1.2rem;right:1.2rem;display:inline-flex;align-items:center;gap:.4rem;border:1px solid #3b3540;border-radius:999px;padding:.65rem .9rem;background:#111014;color:#fff;cursor:pointer}.lightbox figure{display:grid;max-width:min(90vw,90rem);max-height:88vh;margin:0;place-items:center}.lightbox img{display:block;max-width:100%;max-height:80vh;border-radius:.7rem;object-fit:contain}.lightbox figcaption{margin-top:.8rem;color:#9c96a2;font-size:.78rem;text-align:center}

@media(max-width:800px){.media-intro{grid-template-columns:1fr;gap:1.5rem}.media-types{justify-content:flex-start}.featured-showreel{min-height:56vh}.gallery-item,.gallery-item:nth-child(4n+1),.gallery-item:nth-child(4n+4){grid-column:span 12;min-height:28rem}.image-caption{opacity:1;transform:none}.empty-media{min-height:60vh}}
@media(max-width:520px){.showreel-bottom{display:block}.play{width:3.7rem;height:3.7rem;margin-bottom:1rem}.showreel-top span:first-child{display:none}.gallery-item,.gallery-item:nth-child(4n+1),.gallery-item:nth-child(4n+4){min-height:23rem}}
@media(prefers-reduced-motion:reduce){.featured-showreel::before,.gallery-item img,.image-caption{transition:none}.featured-showreel:hover::before{transform:translateX(-60%)}.gallery-item:hover img{transform:none}}
</style>

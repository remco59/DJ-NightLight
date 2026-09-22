<script setup lang="ts">
definePageMeta({ layout: 'public' })

const { data: site } = await useSiteContent()
const content = computed(() => site.value?.content)

type PublicGig = {
  title: string
  description: string | null
  startsAt: string
  endsAt: string | null
}

const { data, status } = await useFetch<{ gigs: PublicGig[] }>('/api/public/agenda', { key: 'public-agenda' })

const publicCount = computed(() => data.value?.gigs.length ?? 0)

function day(value: string) {
  return new Date(value).getDate()
}

function month(value: string) {
  return new Date(value).toLocaleDateString('nl-NL', { month: 'short' }).replace('.', '')
}

function year(value: string) {
  return new Date(value).getFullYear()
}

function fullDate(value: string) {
  return new Intl.DateTimeFormat('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}

function timeRange(start: string, end: string | null) {
  const formatter = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' })
  return end
    ? `${formatter.format(new Date(start))} – ${formatter.format(new Date(end))}`
    : formatter.format(new Date(start))
}

useSeoMeta({
  title: () => `Agenda — ${content.value?.brandName || 'DJ NightLight'}`,
  description: () => content.value?.agendaBody,
})
</script>

<template>
  <main v-if="content" class="public-page agenda-page">
    <div class="public-container">
      <header class="agenda-intro">
        <div>
          <p class="eyebrow">{{ content.agendaEyebrow }}</p>
          <h1 class="display-title">{{ content.agendaTitle }}</h1>
          <p class="lead-copy">{{ content.agendaBody }}</p>
        </div>

        <aside class="agenda-status">
          <div class="signal" aria-hidden="true">
            <i />
            <span />
          </div>
          <div>
            <span>{{ content.publicCopy.agenda.statusEyebrow }}</span>
            <strong v-if="status === 'pending'">{{ content.publicCopy.agenda.loadingLabel }}</strong>
            <strong v-else>{{ publicCount }} {{ publicCount === 1 ? content.publicCopy.agenda.dateSingular : content.publicCopy.agenda.datePlural }}</strong>
            <p>{{ content.publicCopy.agenda.statusBody }}</p>
          </div>
        </aside>
      </header>

      <section class="agenda-list">
        <div v-if="status === 'pending'" class="loading-state">
          <span class="loading-line" />
          <span class="loading-line short" />
        </div>

        <div v-else-if="!data?.gigs.length" class="empty">
          <div class="empty-date" aria-hidden="true">
            <span>—</span>
            <strong>00</strong>
            <small>{{ content.publicCopy.agenda.emptyMarkerLabel }}</small>
          </div>

          <div class="empty-copy">
            <p class="eyebrow">{{ content.publicCopy.agenda.emptyEyebrow }}</p>
            <h2>{{ content.publicCopy.agenda.emptyTitle }}</h2>
            <p>{{ content.publicCopy.agenda.emptyBody }}</p>
            <NuxtLink class="public-button secondary" to="/boeken">{{ content.publicCopy.agenda.emptyCta }}</NuxtLink>
          </div>

          <div class="empty-orbit" aria-hidden="true">
            <span />
            <i />
          </div>
        </div>

        <template v-else>
          <div class="list-heading">
            <p class="eyebrow">{{ content.publicCopy.agenda.listEyebrow }}</p>
            <span>{{ publicCount }} {{ publicCount === 1 ? content.publicCopy.agenda.momentSingular : content.publicCopy.agenda.momentPlural }}</span>
          </div>

          <article v-for="(gig,index) in data?.gigs || []" :key="`${gig.startsAt}-${gig.title}`" class="gig">
            <div class="gig-index">0{{ index + 1 }}</div>

            <div class="date">
              <strong>{{ day(gig.startsAt) }}</strong>
              <div>
                <span>{{ month(gig.startsAt) }}</span>
                <small>{{ year(gig.startsAt) }}</small>
              </div>
            </div>

            <div class="copy">
              <p>{{ fullDate(gig.startsAt) }} · {{ timeRange(gig.startsAt, gig.endsAt) }}</p>
              <h2>{{ gig.title }}</h2>
              <p v-if="gig.description">{{ gig.description }}</p>
            </div>

            <div class="gig-mark" aria-hidden="true">↗</div>
          </article>
        </template>
      </section>

      <section class="agenda-footer">
        <p class="eyebrow">{{ content.publicCopy.agenda.footerEyebrow }}</p>
        <div>
          <h2>{{ content.publicCopy.agenda.footerTitle }}</h2>
          <p>{{ content.publicCopy.agenda.footerBody }}</p>
          <NuxtLink class="public-button" to="/boeken">{{ content.publicCopy.agenda.footerCta }}</NuxtLink>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.agenda-intro{display:grid;grid-template-columns:minmax(0,1fr) minmax(18rem,.42fr);gap:clamp(3rem,8vw,8rem);align-items:end}.agenda-intro .display-title{max-width:10ch}.agenda-status{display:grid;grid-template-columns:auto 1fr;gap:1rem;align-items:start;padding:1.3rem 0 1.3rem 1.3rem;border-left:1px solid #302b34}.agenda-status>div:last-child>span{display:block;color:#716b77;font-size:.68rem;letter-spacing:.1em;text-transform:uppercase}.agenda-status strong{display:block;margin:.4rem 0 .5rem;font-size:1.45rem;letter-spacing:-.035em}.agenda-status p{max-width:22rem;margin:0;color:#8f8995;font-size:.85rem;line-height:1.55}.signal{position:relative;width:1.15rem;height:1.15rem;margin-top:.08rem;border:1px solid #5c5169;border-radius:50%}.signal i{position:absolute;inset:.28rem;border-radius:50%;background:#cfc1ff;box-shadow:0 0 1rem rgba(174,145,255,.7)}.signal span{position:absolute;inset:-.35rem;border:1px solid rgba(174,145,255,.14);border-radius:50%}

.agenda-list{margin-top:clamp(5rem,9vw,9rem);border-top:1px solid #2a2630}.list-heading{display:flex;justify-content:space-between;gap:2rem;align-items:center;padding:1.1rem 0;border-bottom:1px solid #2a2630}.list-heading>span{color:#706a76;font-size:.72rem}.gig{position:relative;display:grid;grid-template-columns:3rem minmax(10rem,.32fr) minmax(0,1fr) auto;gap:clamp(1rem,3vw,2.5rem);align-items:center;padding:clamp(2rem,4vw,3.2rem) 0;border-bottom:1px solid #2a2630;transition:padding .28s ease,background-color .28s ease}.gig::before{content:"";position:absolute;left:-1rem;top:0;bottom:0;width:2px;background:#bca8ff;opacity:0;transform:scaleY(.35);transition:opacity .28s ease,transform .28s ease}.gig:hover{padding-left:1rem;background:linear-gradient(90deg,rgba(119,73,224,.075),transparent 38%)}.gig:hover::before{opacity:1;transform:scaleY(1)}.gig-index{align-self:start;padding-top:.55rem;color:#5f5965;font-size:.66rem}.date{display:flex;align-items:end;gap:.85rem}.date>strong{font-size:clamp(4.3rem,7vw,7rem);line-height:.75;letter-spacing:-.075em}.date>div{display:grid;gap:.2rem;padding-bottom:.08rem;text-transform:uppercase}.date span{font-size:.78rem;font-weight:750}.date small{color:#6f6975;font-size:.68rem}.copy>p:first-child{margin:0 0 .55rem;color:#78717e;font-size:.76rem;text-transform:capitalize}.copy h2{margin:0;font-size:clamp(1.8rem,3.4vw,3.5rem);line-height:1;letter-spacing:-.05em}.copy>p:last-child{max-width:48rem;margin:.75rem 0 0;color:#9b95a1;line-height:1.65}.gig-mark{display:grid;width:2.8rem;height:2.8rem;place-items:center;border:1px solid #312c35;border-radius:50%;color:#817a87;transition:border-color .25s ease,color .25s ease,transform .25s ease}.gig:hover .gig-mark{border-color:#655b6d;color:#fff;transform:rotate(8deg)}

.loading-state{display:grid;gap:1rem;padding:4rem 0}.loading-line{display:block;width:70%;height:.8rem;border-radius:999px;background:linear-gradient(90deg,#151219,#211a2a,#151219);background-size:200% 100%;animation:pulse 1.6s linear infinite}.loading-line.short{width:38%}@keyframes pulse{to{background-position:-200% 0}}

.empty{position:relative;display:grid;grid-template-columns:minmax(12rem,.38fr) minmax(0,1fr);gap:clamp(2rem,7vw,7rem);min-height:min(58vh,39rem);align-items:center;padding:clamp(3rem,7vw,6rem) 0;border-bottom:1px solid #2a2630;overflow:hidden}.empty-date{position:relative;z-index:1;display:grid;grid-template-columns:auto 1fr;align-items:end;max-width:20rem}.empty-date>span{grid-column:1/-1;color:#554f5b;font-size:3rem;line-height:.7}.empty-date strong{font-size:clamp(7rem,15vw,13rem);line-height:.75;letter-spacing:-.09em;color:#242029}.empty-date small{padding:0 0 .3rem .6rem;color:#655e6b;font-size:.62rem;writing-mode:vertical-rl}.empty-copy{position:relative;z-index:1;max-width:42rem}.empty-copy h2{margin:.7rem 0 1rem;font-size:clamp(3rem,6vw,6rem);line-height:.92;letter-spacing:-.065em}.empty-copy>p:not(.eyebrow){max-width:37rem;margin:0;color:#96909c;line-height:1.72}.empty-copy .public-button{margin-top:1.5rem}.empty-orbit{position:absolute;width:min(42rem,60vw);height:min(42rem,60vw);right:-8rem;top:50%;border:1px solid rgba(141,107,215,.1);border-radius:50%;transform:translateY(-50%)}.empty-orbit::before,.empty-orbit::after{content:"";position:absolute;border:1px solid rgba(141,107,215,.08);border-radius:50%}.empty-orbit::before{inset:14%}.empty-orbit::after{inset:30%}.empty-orbit span{position:absolute;width:45%;height:45%;left:27%;top:27%;border-radius:50%;background:radial-gradient(circle,rgba(106,61,205,.2),transparent 66%);filter:blur(4px)}.empty-orbit i{position:absolute;width:.55rem;height:.55rem;right:14%;top:48%;border-radius:50%;background:#bda9ff;box-shadow:0 0 1.4rem rgba(189,169,255,.75)}

.agenda-footer{display:grid;grid-template-columns:.4fr 1fr;gap:clamp(2rem,8vw,8rem);padding:clamp(7rem,12vw,12rem) 0}.agenda-footer h2{margin:0 0 1rem;white-space:pre-line;font-size:clamp(3.2rem,7vw,7rem);line-height:.88;letter-spacing:-.07em}.agenda-footer>div>p{max-width:34rem;color:#9a94a0;line-height:1.7}.agenda-footer .public-button{margin-top:1rem}

@media(max-width:850px){.agenda-intro{grid-template-columns:1fr}.agenda-status{max-width:32rem}.gig{grid-template-columns:2.5rem 10rem 1fr}.gig-mark{display:none}.date>strong{font-size:4.8rem}.empty{grid-template-columns:1fr}.empty-date{opacity:.6}.agenda-footer{grid-template-columns:1fr;gap:1.5rem}}
@media(max-width:600px){.agenda-status{padding-left:1rem}.list-heading{align-items:flex-start;flex-direction:column;gap:.35rem}.gig{grid-template-columns:2rem 1fr;gap:1rem;padding:2rem 0}.gig:hover{padding-left:.5rem}.date{grid-column:2}.copy{grid-column:2}.gig-index{grid-row:1/3}.empty{padding:4rem 0}.empty-date strong{font-size:8rem}.empty-orbit{right:-15rem;width:32rem;height:32rem}.agenda-footer{padding:6rem 0}}
@media(prefers-reduced-motion:reduce){.gig,.gig::before,.gig-mark{transition:none}.loading-line{animation:none}.gig:hover{padding-left:0}.gig:hover .gig-mark{transform:none}}
</style>

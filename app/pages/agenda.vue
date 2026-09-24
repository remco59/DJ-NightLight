<script setup lang="ts">
definePageMeta({ layout: 'public' })

const { data: site } = await useSiteContent()
const content = computed(() => site.value?.content)

type PublicGig = {
  title: string
  description: string | null
  startsAt: string
  endsAt: string | null
  location: string | null
}

const { data, status } = await useFetch<{ gigs: PublicGig[] }>('/api/public/agenda', { key: 'public-agenda' })

const nextGig = computed(() => data.value?.gigs?.[0] ?? null)
const upcomingGigs = computed(() => data.value?.gigs?.slice(1) ?? [])

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
        <p class="eyebrow">{{ content.agendaEyebrow }}</p>
        <h1 class="display-title">{{ content.agendaTitle }}</h1>
        <p class="lead-copy">{{ content.agendaBody }}</p>
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
          <div class="list-heading next-heading">
            <p class="eyebrow">Volgende show</p>
          </div>

          <article v-if="nextGig" class="gig gig-featured">
            <div class="gig-index">01</div>

            <div class="date">
              <strong>{{ day(nextGig.startsAt) }}</strong>
              <div>
                <span>{{ month(nextGig.startsAt) }}</span>
                <small>{{ year(nextGig.startsAt) }}</small>
              </div>
            </div>

            <div class="copy">
              <p class="gig-date">{{ fullDate(nextGig.startsAt) }}</p>
              <h2>{{ nextGig.title }}</h2>
              <ul class="gig-meta">
                <li>
                  <Icon name="lucide:clock" aria-hidden="true" />
                  <span>{{ timeRange(nextGig.startsAt, nextGig.endsAt) }}</span>
                </li>
                <li v-if="nextGig.location">
                  <Icon name="lucide:map-pin" aria-hidden="true" />
                  <span>{{ nextGig.location }}</span>
                </li>
              </ul>
              <p v-if="nextGig.description" class="gig-description">{{ nextGig.description }}</p>
            </div>
          </article>

          <template v-if="upcomingGigs.length">
            <div class="list-heading upcoming-heading">
              <p class="eyebrow">Aankomende shows</p>
            </div>

            <article
              v-for="(gig,index) in upcomingGigs"
              :key="`${gig.startsAt}-${gig.title}`"
              class="gig"
            >
              <div class="gig-index">{{ String(index + 2).padStart(2, '0') }}</div>

              <div class="date">
                <strong>{{ day(gig.startsAt) }}</strong>
                <div>
                  <span>{{ month(gig.startsAt) }}</span>
                  <small>{{ year(gig.startsAt) }}</small>
                </div>
              </div>

              <div class="copy">
                <p class="gig-date">{{ fullDate(gig.startsAt) }}</p>
                <h2>{{ gig.title }}</h2>
                <ul class="gig-meta">
                  <li>
                    <Icon name="lucide:clock" aria-hidden="true" />
                    <span>{{ timeRange(gig.startsAt, gig.endsAt) }}</span>
                  </li>
                  <li v-if="gig.location">
                    <Icon name="lucide:map-pin" aria-hidden="true" />
                    <span>{{ gig.location }}</span>
                  </li>
                </ul>
                <p v-if="gig.description" class="gig-description">{{ gig.description }}</p>
              </div>
            </article>
          </template>
        </template>
      </section>

      <section class="agenda-footer">
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
.agenda-page{position:relative;overflow:hidden}
.agenda-page::before,.agenda-page::after{content:"";position:absolute;pointer-events:none;border-radius:50%;filter:blur(2px);opacity:.7}
.agenda-page::before{width:52rem;height:52rem;right:-24rem;top:-10rem;background:radial-gradient(circle,rgba(116,62,214,.15),transparent 65%)}
.agenda-page::after{width:58rem;height:58rem;left:-34rem;bottom:7rem;background:radial-gradient(circle,rgba(105,52,196,.13),transparent 67%)}

.agenda-intro{position:relative;z-index:1;max-width:56rem;padding-top:clamp(1rem,2.5vw,2.5rem)}
.agenda-intro .display-title{max-width:10ch;margin-bottom:1.4rem}
.agenda-intro .lead-copy{max-width:45rem}

.agenda-list{position:relative;z-index:1;margin-top:clamp(4rem,7vw,6.5rem);border-top:1px solid #2a2630}
.list-heading{padding:1.1rem 0;border-bottom:1px solid #2a2630}
.list-heading .eyebrow{margin:0}
.next-heading .eyebrow,.upcoming-heading .eyebrow{display:flex;align-items:center;gap:.7rem}
.next-heading .eyebrow::after,.upcoming-heading .eyebrow::after{content:"";display:inline-block;width:2.4rem;height:1px;background:linear-gradient(90deg,#9d72ff,transparent)}

.gig{position:relative;display:grid;grid-template-columns:3rem minmax(10rem,.32fr) minmax(0,1fr);gap:clamp(1rem,3vw,2.5rem);align-items:center;padding:clamp(2rem,4vw,3.2rem) 0;border-bottom:1px solid #2a2630}
.gig-featured{isolation:isolate}
.gig-featured::before{content:"";position:absolute;z-index:-1;left:-2rem;right:-2rem;top:0;bottom:0;background:linear-gradient(90deg,rgba(112,60,219,.13),rgba(112,60,219,.035) 42%,transparent 78%);opacity:.95}
.gig-featured::after{content:"";position:absolute;left:-1rem;right:-1rem;bottom:-1px;height:1px;background:linear-gradient(90deg,transparent,#8d56ff 18%,#8d56ff 58%,transparent);box-shadow:0 0 1.15rem rgba(133,79,255,.48)}
.gig-index{align-self:start;padding-top:.55rem;color:#5f5965;font-size:.66rem}.gig-featured .gig-index{color:#8f70d7}
.date{display:flex;align-items:end;gap:.85rem}.date>strong{font-size:clamp(4.3rem,7vw,7rem);line-height:.75;letter-spacing:-.075em}.date>div{display:grid;gap:.2rem;padding-bottom:.08rem;text-transform:uppercase}.date span{font-size:.88rem;font-weight:800}.date small{color:#6f6975;font-size:.68rem}.gig-date{margin:0 0 .55rem;color:#78717e;font-size:.76rem;text-transform:capitalize}.copy h2{margin:0;font-size:clamp(1.8rem,3.4vw,3.5rem);line-height:1;letter-spacing:-.05em}.gig-meta{display:flex;flex-wrap:wrap;gap:.5rem 1.6rem;margin:1rem 0 0;padding:0;list-style:none;color:#a39dab;font-size:.9rem}.gig-meta li{display:flex;align-items:center;gap:.5rem;min-width:0}.gig-meta svg{flex:none;width:1rem;height:1rem;color:#bca8ff}.gig-description{max-width:48rem;margin:.9rem 0 0;color:#9b95a1;line-height:1.65}
.upcoming-heading{margin-top:clamp(1.8rem,3vw,2.8rem)}

.loading-state{display:grid;gap:1rem;padding:4rem 0}.loading-line{display:block;width:70%;height:.8rem;border-radius:999px;background:linear-gradient(90deg,#151219,#211a2a,#151219);background-size:200% 100%;animation:pulse 1.6s linear infinite}.loading-line.short{width:38%}@keyframes pulse{to{background-position:-200% 0}}

.empty{position:relative;display:grid;grid-template-columns:minmax(12rem,.38fr) minmax(0,1fr);gap:clamp(2rem,7vw,7rem);min-height:min(58vh,39rem);align-items:center;padding:clamp(3rem,7vw,6rem) 0;border-bottom:1px solid #2a2630;overflow:hidden}.empty-date{position:relative;z-index:1;display:grid;grid-template-columns:auto 1fr;align-items:end;max-width:20rem}.empty-date>span{grid-column:1/-1;color:#554f5b;font-size:3rem;line-height:.7}.empty-date strong{font-size:clamp(7rem,15vw,13rem);line-height:.75;letter-spacing:-.09em;color:#242029}.empty-date small{padding:0 0 .3rem .6rem;color:#655e6b;font-size:.62rem;writing-mode:vertical-rl}.empty-copy{position:relative;z-index:1;max-width:42rem}.empty-copy h2{margin:.7rem 0 1rem;font-size:clamp(3rem,6vw,6rem);line-height:.92;letter-spacing:-.065em}.empty-copy>p:not(.eyebrow){max-width:37rem;margin:0;color:#96909c;line-height:1.72}.empty-copy .public-button{margin-top:1.5rem}.empty-orbit{position:absolute;width:min(42rem,60vw);height:min(42rem,60vw);right:-8rem;top:50%;border:1px solid rgba(141,107,215,.1);border-radius:50%;transform:translateY(-50%)}.empty-orbit::before,.empty-orbit::after{content:"";position:absolute;border:1px solid rgba(141,107,215,.08);border-radius:50%}.empty-orbit::before{inset:14%}.empty-orbit::after{inset:30%}.empty-orbit span{position:absolute;width:45%;height:45%;left:27%;top:27%;border-radius:50%;background:radial-gradient(circle,rgba(106,61,205,.2),transparent 66%);filter:blur(4px)}.empty-orbit i{position:absolute;width:.55rem;height:.55rem;right:14%;top:48%;border-radius:50%;background:#bda9ff;box-shadow:0 0 1.4rem rgba(189,169,255,.75)}

.agenda-footer{position:relative;z-index:1;display:flex;justify-content:center;padding:clamp(6rem,10vw,9rem) 0 clamp(6rem,9vw,8rem);text-align:center}
.agenda-footer>div{max-width:44rem}
.agenda-footer h2{margin:0 0 1rem;white-space:pre-line;font-size:clamp(3.2rem,7vw,7rem);line-height:.88;letter-spacing:-.07em}.agenda-footer>div>p{max-width:34rem;margin-left:auto;margin-right:auto;color:#9a94a0;line-height:1.7}.agenda-footer .public-button{margin-top:1rem}

@media(max-width:850px){.agenda-intro{max-width:44rem}.gig{grid-template-columns:2.5rem 10rem 1fr}.date>strong{font-size:4.8rem}.empty{grid-template-columns:1fr}.empty-date{opacity:.6}}
@media(max-width:600px){.agenda-list{margin-top:3.75rem}.gig{grid-template-columns:2rem 1fr;gap:1rem;padding:2rem 0}.date{grid-column:2}.copy{grid-column:2}.gig-index{grid-row:1/3}.gig-featured::before{left:-1rem;right:-1rem}.empty{padding:4rem 0}.empty-date strong{font-size:8rem}.empty-orbit{right:-15rem;width:32rem;height:32rem}.agenda-footer{padding:5rem 0 5.5rem}.agenda-footer h2{font-size:clamp(3.2rem,15vw,5rem)}}
@media(prefers-reduced-motion:reduce){.loading-line{animation:none}}
</style>

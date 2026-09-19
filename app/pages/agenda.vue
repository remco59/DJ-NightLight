<script setup lang="ts">
definePageMeta({layout:'public'})
const {data:site}=await useSiteContent()
const content=computed(()=>site.value?.content)

type PublicGig = {
  title: string
  description: string | null
  startsAt: string
  endsAt: string | null
}

const {data,status}=await useFetch<{gigs:PublicGig[]}>('/api/public/agenda',{key:'public-agenda'})

function day(value:string){return new Date(value).getDate()}
function month(value:string){return new Date(value).toLocaleDateString('nl-NL',{month:'short'}).replace('.','')}
function fullDate(value:string){return new Intl.DateTimeFormat('nl-NL',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(value))}
function timeRange(start:string,end:string|null){
  const formatter=new Intl.DateTimeFormat('nl-NL',{hour:'2-digit',minute:'2-digit'})
  return end?`${formatter.format(new Date(start))} – ${formatter.format(new Date(end))}`:formatter.format(new Date(start))
}

useSeoMeta({title:()=>`Agenda — ${content.value?.brandName||'DJ NightLight'}`,description:()=>content.value?.agendaBody})
</script>

<template>
  <main v-if="content" class="public-page">
    <div class="public-container">
      <p class="eyebrow">{{content.agendaEyebrow}}</p>
      <h1 class="display-title">{{content.agendaTitle}}</h1>
      <p class="lead-copy">{{content.agendaBody}}</p>

      <section class="agenda-list">
        <div v-if="status==='pending'" class="empty">Agenda laden…</div>
        <div v-else-if="!data?.gigs.length" class="empty">
          <span>Agenda</span>
          <strong>Er staan op dit moment geen openbare gigs gepland.</strong>
          <p>Besloten boekingen worden hier nooit weergegeven.</p>
        </div>

        <article v-for="gig in data?.gigs||[]" v-else :key="`${gig.startsAt}-${gig.title}`" class="gig">
          <div class="date">
            <strong>{{day(gig.startsAt)}}</strong>
            <span>{{month(gig.startsAt)}}</span>
          </div>
          <div class="copy">
            <p>{{fullDate(gig.startsAt)}} · {{timeRange(gig.startsAt,gig.endsAt)}}</p>
            <h2>{{gig.title}}</h2>
            <p v-if="gig.description">{{gig.description}}</p>
          </div>
        </article>
      </section>
    </div>
  </main>
</template>

<style scoped>
.agenda-list{margin-top:4rem;border-top:1px solid #29252e}.gig{display:grid;grid-template-columns:5rem minmax(0,1fr);gap:1.5rem;padding:1.5rem 0;border-bottom:1px solid #29252e}.date{display:grid;width:4.4rem;height:4.4rem;place-items:center;align-content:center;border-radius:.9rem;background:#121015}.date strong{font-size:1.6rem;line-height:1}.date span{margin-top:.2rem;color:#817a88;font-size:.7rem;text-transform:uppercase}.copy>p:first-child{margin:0 0 .4rem;color:#6f6975;font-size:.75rem;text-transform:capitalize}.copy h2{margin:0;font-size:clamp(1.4rem,3vw,2.3rem);letter-spacing:-.04em}.copy>p:last-child{max-width:42rem;margin:.55rem 0 0;color:#918b97;line-height:1.6}.empty{display:grid;gap:.45rem;padding:3rem 0;border-bottom:1px solid #29252e}.empty span{color:#69636e;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase}.empty strong{font-size:1.35rem}.empty p{margin:0;color:#837d89}@media(max-width:600px){.gig{grid-template-columns:4rem minmax(0,1fr)}.date{width:3.6rem;height:3.6rem}}
</style>

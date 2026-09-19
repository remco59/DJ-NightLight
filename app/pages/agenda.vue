<script setup lang="ts">
definePageMeta({layout:'public'})
const {data}=await useSiteContent();const content=computed(()=>data.value?.content)
useSeoMeta({title:()=>`Agenda — ${content.value?.brandName||'DJ NightLight'}`,description:()=>content.value?.agendaBody})
</script>
<template><main v-if="content" class="public-page"><div class="public-container"><p class="eyebrow">{{content.agendaEyebrow}}</p><h1 class="display-title">{{content.agendaTitle}}</h1><p class="lead-copy">{{content.agendaBody}}</p><section class="agenda-shell"><span>Public agenda</span><strong>Openbare gigs worden in de volgende bouwstap gekoppeld.</strong><p>Privéboekingen worden nooit vanuit deze pagina zichtbaar gemaakt.</p></section></div></main></template>
<style scoped>.agenda-shell{display:grid;gap:.5rem;margin-top:4rem;padding:2rem 0;border-top:1px solid #29252e;border-bottom:1px solid #29252e}.agenda-shell span{color:#69636e;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase}.agenda-shell strong{font-size:1.3rem}.agenda-shell p{margin:0;color:#837d89}</style>

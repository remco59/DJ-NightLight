<script setup lang="ts">
import {
  VIDEO_BRAND_PRESETS,
  VIDEO_MOTION_PRESETS,
  VIDEO_OUTPUT,
  VIDEO_TEMPLATES,
  type VideoBrandPreset,
  type VideoDesign,
  type VideoMotionPreset,
  type VideoTemplateKey,
} from '~~/shared/video-generator'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'admin' })

type MediaAsset = {
  id: string
  title: string
  altText: string
  originalFilename: string
  width: number
  height: number
  createdAt: string
  url: string
  thumbnailUrl: string
}

type VideoJob = {
  id: string
  sourceMediaAssetId: string
  templateKey: VideoTemplateKey
  motionPreset: VideoMotionPreset
  brandPreset: VideoBrandPreset
  design: VideoDesign
  width: number
  height: number
  fps: number
  durationSeconds: number
  status: 'queued'|'rendering'|'completed'|'failed'
  progress: number
  error: string|null
  videoUrl: string|null
  sourceTitle: string|null
  sourceFilename: string|null
  createdAt: string
  updatedAt: string
}

const { data: generatorData } = await useFetch<{assets:MediaAsset[]}>('/api/admin/post-generator')
const { data: queueData, refresh: refreshQueue } = await useFetch<{jobs:VideoJob[]}>('/api/admin/post-generator/video')

const sourceMediaAssetId = ref(generatorData.value?.assets[0]?.id || '')
const audioFile = ref<File|null>(null)
const audioInput = ref<HTMLInputElement|null>(null)
const busy = ref(false)
const message = ref('')
let pollTimer: ReturnType<typeof setInterval>|null = null

const design = reactive<VideoDesign>({
  templateKey: 'spotlight',
  motionPreset: 'smooth',
  brandPreset: 'night',
  headline: 'YOUR NIGHT. YOUR SOUND.',
  subline: 'DJ NightLight · allround DJ',
  dateText: '',
  locationText: '',
  logoText: 'NIGHTLIGHT',
  overlayOpacity: .68,
})

const selectedAsset = computed(() => generatorData.value?.assets.find(asset=>asset.id===sourceMediaAssetId.value)||null)
const activeJobs = computed(() => queueData.value?.jobs.some(job=>job.status==='queued'||job.status==='rendering') ?? false)

const templateLabels:Record<VideoTemplateKey,string> = {
  spotlight:'Spotlight',
  pulse:'Pulse',
  slide:'Slide',
}
const motionLabels:Record<VideoMotionPreset,string> = {
  smooth:'Smooth',
  energy:'Energy',
  minimal:'Minimal',
}
const brandLabels:Record<VideoBrandPreset,string> = {
  night:'NightLight',
  mono:'Mono',
  warm:'Warm',
}

function chooseAudio(event:Event){
  audioFile.value=(event.target as HTMLInputElement).files?.[0]||null
}

async function enqueue(){
  if(!sourceMediaAssetId.value){message.value='Select a source photo first.';return}
  busy.value=true;message.value=''
  try{
    const form=new FormData()
    form.append('sourceMediaAssetId',sourceMediaAssetId.value)
    form.append('design',JSON.stringify(design))
    if(audioFile.value)form.append('audio',audioFile.value,audioFile.value.name)
    await $fetch('/api/admin/post-generator/video',{method:'POST',body:form})
    audioFile.value=null
    if(audioInput.value)audioInput.value.value=''
    message.value='Video queued. The render worker will process it automatically.'
    await refreshQueue()
  }catch(error:unknown){
    message.value=apiErrorMessage(error,'Could not queue video render.')
  }finally{busy.value=false}
}

async function retry(job:VideoJob){
  try{await $fetch(`/api/admin/post-generator/video/${job.id}/retry`,{method:'POST'});await refreshQueue()}
  catch(error:unknown){message.value=apiErrorMessage(error,'Could not retry render.')}
}

async function remove(job:VideoJob){
  if(!confirm('Delete this video render and its stored files?'))return
  try{await $fetch(`/api/admin/post-generator/video/${job.id}`,{method:'DELETE'});await refreshQueue()}
  catch(error:unknown){message.value=apiErrorMessage(error,'Could not delete render.')}
}

function formatDate(value:string){
  return new Intl.DateTimeFormat('nl-NL',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))
}

function startPolling(){
  if(pollTimer)return
  pollTimer=setInterval(()=>{if(activeJobs.value)void refreshQueue()},2000)
}
onMounted(startPolling)
onBeforeUnmount(()=>{if(pollTimer)clearInterval(pollTimer)})

useSeoMeta({title:'Video generator — DJ NightLight',robots:'noindex, nofollow'})
</script>

<template>
<div class="video-page">
<header class="page-header">
  <div><p class="eyebrow">Content</p><h1>Video generator</h1><p>Create a 10-second 9:16 Reel/Story with the Remotion render worker.</p></div>
  <NuxtLink class="secondary" to="/admin/post-generator">Photo generator</NuxtLink>
</header>

<div class="workspace">
<section class="controls">
  <div class="card">
    <p class="eyebrow">1 · Source</p><h2>Choose a photo</h2>
    <div class="asset-grid">
      <button v-for="asset in generatorData?.assets||[]" :key="asset.id" type="button" class="asset" :class="{selected:asset.id===sourceMediaAssetId}" @click="sourceMediaAssetId=asset.id">
        <img :src="asset.thumbnailUrl" :alt="asset.altText||asset.title||asset.originalFilename">
        <span>{{asset.title||asset.originalFilename}}</span>
      </button>
    </div>
  </div>

  <div class="card">
    <p class="eyebrow">2 · Motion design</p><h2>Template</h2>
    <div class="choices">
      <button v-for="key in VIDEO_TEMPLATES" :key="key" type="button" :class="{active:design.templateKey===key}" @click="design.templateKey=key">{{templateLabels[key]}}</button>
    </div>
    <h3>Motion</h3>
    <div class="choices">
      <button v-for="key in VIDEO_MOTION_PRESETS" :key="key" type="button" :class="{active:design.motionPreset===key}" @click="design.motionPreset=key">{{motionLabels[key]}}</button>
    </div>
    <h3>Brand</h3>
    <div class="choices">
      <button v-for="key in VIDEO_BRAND_PRESETS" :key="key" type="button" :class="{active:design.brandPreset===key}" @click="design.brandPreset=key">{{brandLabels[key]}}</button>
    </div>
  </div>

  <div class="card">
    <p class="eyebrow">3 · Copy</p>
    <label>Headline<input v-model="design.headline" maxlength="180"></label>
    <label>Subline<input v-model="design.subline" maxlength="260"></label>
    <div class="two"><label>Date<input v-model="design.dateText" maxlength="160"></label><label>Location<input v-model="design.locationText" maxlength="160"></label></div>
    <label>Brand text<input v-model="design.logoText" maxlength="80"></label>
    <label>Overlay {{Math.round(design.overlayOpacity*100)}}%<input v-model.number="design.overlayOpacity" type="range" min="0" max=".9" step=".01"></label>
  </div>

  <div class="card">
    <p class="eyebrow">4 · Audio & render</p>
    <label>Optional audio<input ref="audioInput" type="file" accept="audio/mpeg,audio/mp4,audio/wav,audio/ogg" @change="chooseAudio"><small>MP3, M4A, WAV or OGG · max 12 MB</small></label>
    <p v-if="audioFile" class="file">{{audioFile.name}}</p>
    <button class="primary full" :disabled="busy||!sourceMediaAssetId" @click="enqueue">{{busy?'Queueing…':'Render 9:16 video'}}</button>
    <p v-if="message" class="message">{{message}}</p>
  </div>
</section>

<section class="preview-column">
  <div class="phone-preview" :data-template="design.templateKey" :data-motion="design.motionPreset" :data-brand="design.brandPreset">
    <img v-if="selectedAsset" :src="selectedAsset.url" :alt="selectedAsset.altText||selectedAsset.title">
    <div class="wash"/>
    <div class="preview-copy">
      <strong class="logo">{{design.logoText}}</strong>
      <div class="headline-block"><h2>{{design.headline}}</h2><p>{{design.subline}}</p><div class="chips"><span v-if="design.dateText">{{design.dateText}}</span><span v-if="design.locationText">{{design.locationText}}</span></div></div>
    </div>
  </div>
  <p class="preview-note">{{VIDEO_OUTPUT.width}}×{{VIDEO_OUTPUT.height}} · {{VIDEO_OUTPUT.fps}} fps · {{VIDEO_OUTPUT.durationSeconds}} sec</p>
</section>
</div>

<section class="history">
<div class="section-heading"><div><p class="eyebrow">Render queue</p><h2>Generated videos</h2></div><button class="secondary" @click="refreshQueue()">Refresh</button></div>
<div v-if="!queueData?.jobs.length" class="empty">No video renders yet.</div>
<article v-for="job in queueData?.jobs||[]" :key="job.id" class="job">
  <div class="job-main">
    <div class="thumb"><video v-if="job.videoUrl" :src="job.videoUrl" muted playsinline preload="metadata"/><img v-else-if="generatorData?.assets.find(a=>a.id===job.sourceMediaAssetId)" :src="generatorData.assets.find(a=>a.id===job.sourceMediaAssetId)?.thumbnailUrl" alt=""></div>
    <div><div class="job-title"><strong>{{job.sourceTitle||job.sourceFilename||'Video render'}}</strong><span :data-status="job.status">{{job.status}}</span></div><p>{{templateLabels[job.templateKey]}} · {{motionLabels[job.motionPreset]}} · {{formatDate(job.createdAt)}}</p><p v-if="job.error" class="error">{{job.error}}</p></div>
  </div>
  <div v-if="job.status==='queued'||job.status==='rendering'" class="progress"><div :style="{width:`${job.progress}%`}"/><span>{{job.progress}}%</span></div>
  <div class="job-actions">
    <a v-if="job.videoUrl" class="primary" :href="job.videoUrl" target="_blank" rel="noreferrer">Open MP4</a>
    <button v-if="job.status==='failed'" class="secondary" @click="retry(job)">Retry</button>
    <button v-if="job.status!=='rendering'" class="secondary danger" @click="remove(job)">Delete</button>
  </div>
</article>
</section>
</div>
</template>

<style scoped>
.video-page{max-width:1240px;margin-inline:auto}.page-header,.section-heading{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin-bottom:1.4rem}.page-header h1{margin:.2rem 0;font-size:clamp(2.5rem,6vw,4rem);letter-spacing:-.05em}.page-header p:last-child{margin:0;color:#8e8797}.workspace{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(300px,.75fr);gap:1rem;align-items:start}.controls{display:grid;gap:1rem}.card,.history{padding:1.2rem;border:1px solid #2b2631;border-radius:1rem;background:#100e14}.card h2,.card h3{margin:.2rem 0 .75rem}.card h3{margin-top:1rem;font-size:1rem}.asset-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.55rem;max-height:310px;overflow:auto}.asset{overflow:hidden;border:1px solid #29242f;border-radius:.7rem;padding:0;background:#0a090c;color:#aaa4b1;text-align:left}.asset.selected{outline:2px solid #b07cff}.asset img{display:block;width:100%;aspect-ratio:1;object-fit:cover}.asset span{display:block;padding:.45rem;font-size:.7rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.choices{display:flex;gap:.5rem;flex-wrap:wrap}.choices button,.secondary{border:1px solid #332e39;border-radius:.65rem;padding:.65rem .8rem;background:#17141c;color:#bdb6c6;cursor:pointer;text-decoration:none}.choices button.active{border-color:#8f5bc0;background:#261a31;color:#fff}.two{display:grid;grid-template-columns:1fr 1fr;gap:.7rem}label{display:grid;gap:.35rem;margin-top:.75rem;color:#aaa4b1;font-size:.8rem}label small{color:#716a78}input{width:100%;border:1px solid #332e39;border-radius:.65rem;padding:.7rem;background:#0b0a0d;color:#f6f3fa}.primary{display:inline-block;border:0;border-radius:.7rem;padding:.75rem 1rem;background:#fff;color:#09080b;font-weight:800;text-decoration:none}.full{width:100%;margin-top:1rem}.message,.file{color:#aaa4b1;font-size:.8rem}.preview-column{position:sticky;top:1.5rem}.phone-preview{position:relative;overflow:hidden;width:min(100%,390px);aspect-ratio:9/16;margin-inline:auto;border:1px solid #302a38;border-radius:1.6rem;background:#09080b}.phone-preview>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;animation:slowZoom 10s linear infinite}.phone-preview[data-motion=energy]>img{animation-duration:5s}.phone-preview[data-motion=minimal]>img{animation-duration:20s}.wash{position:absolute;inset:0;background:linear-gradient(180deg,rgba(71,34,105,.5),transparent 40%,rgba(5,4,7,.75))}.phone-preview[data-brand=mono] .wash{background:linear-gradient(180deg,rgba(0,0,0,.35),transparent 40%,rgba(0,0,0,.8))}.phone-preview[data-brand=warm] .wash{background:linear-gradient(180deg,rgba(112,45,16,.45),transparent 40%,rgba(15,6,3,.78))}.preview-copy{position:absolute;inset:8% 8% 9%;display:flex;flex-direction:column;justify-content:space-between}.logo{font-size:.75rem;letter-spacing:.2em;color:#c69bff}.phone-preview[data-brand=mono] .logo{color:#fff}.phone-preview[data-brand=warm] .logo{color:#ff9a58}.headline-block{padding:.75rem}.phone-preview[data-template=pulse] .headline-block{border:1px solid #8f5bc0;border-radius:1rem;background:rgba(10,8,15,.62)}.phone-preview[data-template=slide] .headline-block{transform:translateX(2%)}.headline-block h2{margin:0;color:#fff;font-size:clamp(1.65rem,4vw,2.5rem);line-height:.95;letter-spacing:-.05em;text-transform:uppercase}.headline-block p{color:#d0cad6;font-size:.75rem}.chips{display:flex;gap:.35rem;flex-wrap:wrap}.chips span{padding:.32rem .48rem;border-radius:999px;background:rgba(10,8,15,.7);color:#fff;font-size:.6rem}.preview-note{text-align:center;color:#716a78;font-size:.72rem}.history{margin-top:1rem}.section-heading{margin-bottom:.8rem}.section-heading h2{margin:.2rem 0}.job{display:grid;grid-template-columns:minmax(0,1fr) minmax(140px,240px) auto;gap:1rem;align-items:center;padding:.8rem 0;border-top:1px solid #29242f}.job-main{display:flex;gap:.8rem;align-items:center;min-width:0}.thumb{overflow:hidden;flex:0 0 54px;width:54px;aspect-ratio:9/16;border-radius:.45rem;background:#18141d}.thumb img,.thumb video{width:100%;height:100%;object-fit:cover}.job-title{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}.job-title span{padding:.18rem .42rem;border-radius:999px;background:#27222e;color:#b8afc2;font-size:.62rem;text-transform:uppercase}.job-title span[data-status=completed]{background:#14251d;color:#9be6ba}.job-title span[data-status=failed]{background:#2a181c;color:#e7a2ad}.job-main p{margin:.25rem 0 0;color:#817a8b;font-size:.72rem}.job-main .error{color:#e7a2ad}.progress{position:relative;height:10px;border-radius:999px;background:#242029}.progress div{height:100%;border-radius:inherit;background:#fff}.progress span{position:absolute;right:0;top:-1.3rem;color:#817a8b;font-size:.65rem}.job-actions{display:flex;gap:.4rem}.danger{color:#e7a2ad}.empty{padding:1.5rem;color:#817a8b}@keyframes slowZoom{from{transform:scale(1.04) translateX(-1%)}to{transform:scale(1.14) translateX(1%)}}@media(max-width:900px){.workspace{grid-template-columns:1fr}.preview-column{position:static;order:-1}.asset-grid{grid-template-columns:repeat(3,1fr)}.job{grid-template-columns:1fr}.job-actions{justify-content:flex-start}}@media(max-width:600px){.page-header,.section-heading{align-items:stretch;flex-direction:column}.two{grid-template-columns:1fr}.asset-grid{grid-template-columns:repeat(2,1fr)}}
</style>

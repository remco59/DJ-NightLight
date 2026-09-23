import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { mediaAssets, videoRenderJobs } from '../../../../../db/schema'
import {
  VIDEO_BRAND_PRESETS,
  VIDEO_MOTION_PRESETS,
  VIDEO_OUTPUT,
  VIDEO_TEMPLATES,
} from '../../../../../shared/video-generator'
import { db } from '../../../../utils/db'
import { getGeneratedStorage } from '../../../../utils/media-storage'
import { requireStaff } from '../../../../utils/require-staff'

const visibilitySchema = z.object({
  logo: z.boolean(),
  headline: z.boolean(),
  subline: z.boolean(),
  date: z.boolean(),
  time: z.boolean(),
  location: z.boolean(),
  cta: z.boolean(),
  gigList: z.boolean(),
})

const gigItemSchema = z.object({
  enabled: z.boolean(),
  dateText: z.string().trim().max(40),
  title: z.string().trim().max(120),
  locationText: z.string().trim().max(120),
})

const designSchema = z.object({
  templateKey: z.enum(VIDEO_TEMPLATES),
  motionPreset: z.enum(VIDEO_MOTION_PRESETS),
  brandPreset: z.enum(VIDEO_BRAND_PRESETS),
  headline: z.string().trim().max(180),
  subline: z.string().trim().max(260),
  dateText: z.string().trim().max(160),
  timeText: z.string().trim().max(80),
  locationText: z.string().trim().max(160),
  ctaText: z.string().trim().max(180),
  logoText: z.string().trim().max(80),
  visibility: visibilitySchema,
  gigItems: z.array(gigItemSchema).min(1).max(6),
  imageX: z.number().min(-1).max(1),
  imageY: z.number().min(-1).max(1),
  zoom: z.number().min(1).max(3),
  overlayOpacity: z.number().min(0).max(0.9),
  textAlign: z.enum(['left', 'center', 'right']),
  textPosition: z.enum(['top', 'middle', 'bottom']),
}).superRefine((design, context) => {
  if (design.visibility.headline && !design.headline) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['headline'],
      message: 'Headline is required while it is shown',
    })
  }
})

const sourceIdSchema = z.string().uuid()
const audioTypes: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
}
const MAX_AUDIO_BYTES = 12 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'content_editor'])
  const parts = await readMultipartFormData(event)
  if (!parts) throw createError({ statusCode: 400, statusMessage: 'Multipart form data is required' })

  const part = (name: string) => parts.find(item => item.name === name)
  const sourceMediaAssetId = sourceIdSchema.parse(part('sourceMediaAssetId')?.data?.toString('utf8') || '')

  let designJson: unknown
  try {
    designJson = JSON.parse(part('design')?.data?.toString('utf8') || '')
  } catch {
    throw createError({ statusCode: 422, statusMessage: 'Video design metadata is invalid JSON' })
  }
  const design = designSchema.parse(designJson)

  const [asset] = await db.select({
    id: mediaAssets.id,
    mimeType: mediaAssets.mimeType,
  }).from(mediaAssets).where(eq(mediaAssets.id, sourceMediaAssetId)).limit(1)

  if (!asset) throw createError({ statusCode: 404, statusMessage: 'Source media asset not found' })
  if (!asset.mimeType.startsWith('image/')) {
    throw createError({ statusCode: 422, statusMessage: 'Video source must be an image from the media library' })
  }

  const audio = part('audio')
  let audioKey: string | null = null
  let audioMimeType: string | null = null
  const storage = getGeneratedStorage()

  if (audio?.data?.length) {
    if (audio.data.length > MAX_AUDIO_BYTES) {
      throw createError({ statusCode: 413, statusMessage: 'Audio file exceeds 12 MB' })
    }
    const mimeType = audio.type || ''
    const extension = audioTypes[mimeType]
    if (!extension) {
      throw createError({ statusCode: 422, statusMessage: 'Audio must be MP3, M4A, WAV or OGG' })
    }
    audioKey = await storage.put(audio.data, extension, 'video-audio')
    audioMimeType = mimeType
  }

  try {
    const [job] = await db.insert(videoRenderJobs).values({
      sourceMediaAssetId,
      createdByUserId: user.id,
      templateKey: design.templateKey,
      motionPreset: design.motionPreset,
      brandPreset: design.brandPreset,
      design,
      width: VIDEO_OUTPUT.width,
      height: VIDEO_OUTPUT.height,
      fps: VIDEO_OUTPUT.fps,
      durationSeconds: VIDEO_OUTPUT.durationSeconds,
      audioKey,
      audioMimeType,
      status: 'queued',
      progress: 0,
    }).returning()

    if (!job) throw new Error('Video render job could not be queued')
    event.node.res.statusCode = 202
    return { job: { ...job, videoUrl: null } }
  } catch (error) {
    await storage.delete(audioKey)
    throw error
  }
})

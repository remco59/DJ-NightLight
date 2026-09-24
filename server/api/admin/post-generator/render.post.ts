import { z } from 'zod'
import { generatedPosts } from '../../../../db/schema'
import { inspectImage } from '../../../../shared/media'
import { POST_PRESETS, POST_TEMPLATE_KEYS } from '../../../../shared/post-generator'
import { db } from '../../../utils/db'
import { getGeneratedStorage } from '../../../utils/media-storage'
import { requireStaff } from '../../../utils/require-staff'

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
  dateText: z.string().max(40),
  title: z.string().max(120),
  locationText: z.string().max(120),
})

const designSchema = z.object({
  preset: z.enum(['square', 'portrait', 'story']),
  templateKey: z.enum(POST_TEMPLATE_KEYS),
  brandPreset: z.enum(['night', 'mono', 'warm']),
  headline: z.string().max(180),
  subline: z.string().max(260),
  dateText: z.string().max(160),
  timeText: z.string().max(80).default(''),
  locationText: z.string().max(160),
  ctaText: z.string().max(180).default(''),
  logoText: z.string().max(80),
  visibility: visibilitySchema.default({
    logo: true,
    headline: true,
    subline: true,
    date: true,
    time: true,
    location: true,
    cta: true,
    gigList: true,
  }),
  gigItems: z.array(gigItemSchema).max(6).default([]),
  imageX: z.number().min(-1).max(1),
  imageY: z.number().min(-1).max(1),
  zoom: z.number().min(1).max(3),
  overlayOpacity: z.number().min(0).max(0.9),
  textAlign: z.enum(['left', 'center', 'right']),
  textPosition: z.enum(['top', 'middle', 'bottom']),
  showSafeArea: z.boolean(),
})

const optionalUuid = z.string().uuid().or(z.literal('')).transform(value => value || null)

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager', 'content_editor'])
  const parts = await readMultipartFormData(event)
  if (!parts) throw createError({ statusCode: 400, statusMessage: 'Een multipart-upload van de render is verplicht' })

  const part = (name: string) => parts.find(item => item.name === name)
  const file = part('file')
  if (!file?.data?.length) throw createError({ statusCode: 422, statusMessage: 'Een gerenderde PNG is verplicht' })
  if (file.data.length > 20 * 1024 * 1024) throw createError({ statusCode: 413, statusMessage: 'De gerenderde PNG is groter dan 20 MB' })

  const designPart = part('design')?.data?.toString('utf8')
  if (!designPart) throw createError({ statusCode: 422, statusMessage: 'Ontwerpgegevens zijn verplicht' })

  let designJson: unknown
  try {
    designJson = JSON.parse(designPart)
  } catch {
    throw createError({ statusCode: 422, statusMessage: 'De ontwerpgegevens zijn geen geldige JSON' })
  }
  const design = designSchema.parse(designJson)
  const sourceMediaAssetId = optionalUuid.parse(part('sourceMediaAssetId')?.data?.toString('utf8') || '')
  const expected = POST_PRESETS[design.preset]

  let info
  try {
    info = inspectImage(file.data)
  } catch (error) {
    throw createError({ statusCode: 422, statusMessage: error instanceof Error ? error.message : 'Ongeldige gerenderde afbeelding' })
  }
  if (info.mimeType !== 'image/png') throw createError({ statusCode: 422, statusMessage: 'Gegenereerde posts moeten PNG zijn' })
  if (info.width !== expected.width || info.height !== expected.height) {
    throw createError({
      statusCode: 422,
      statusMessage: `De gerenderde afbeelding moet ${expected.width}×${expected.height} zijn voor ${expected.label}`,
    })
  }

  const storage = getGeneratedStorage()
  const outputKey = await storage.put(file.data, 'png', 'posts')
  try {
    const [post] = await db.insert(generatedPosts).values({
      sourceMediaAssetId,
      templateKey: design.templateKey,
      preset: design.preset,
      width: info.width,
      height: info.height,
      design,
      outputKey,
      outputMimeType: info.mimeType,
    }).returning()
    if (!post) throw new Error('Gegenereerde post opslaan is niet gelukt')
    event.node.res.statusCode = 201
    return { post: { ...post, imageUrl: `/api/generated-posts/${post.id}` } }
  } catch (error) {
    await storage.delete(outputKey)
    throw error
  }
})

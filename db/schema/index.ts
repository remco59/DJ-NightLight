import {
  type AnyPgColumn,
  boolean,
  date,
  integer,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import type { InvoiceSnapshot, VatMode } from '../../shared/invoice'
import type { QuestionnaireField } from '../../shared/questionnaire'
import type { SitePublicCopy } from '../../shared/schemas/site-content'
import type { MediaAssetMetadata } from '../../shared/media'
import type { VideoProject } from '../../shared/video-project'
import type { RenderEngineCapability } from '../../shared/render-engine'
import type { EmailAttachment } from '../../shared/email-automation'

export const userRole = pgEnum('user_role', ['owner', 'dj', 'manager', 'content_editor'])
export const clientType = pgEnum('client_type', ['person', 'company'])
export const gigStatus = pgEnum('gig_status', ['lead', 'booked', 'declined', 'cancelled'])
export const submissionStatus = pgEnum('submission_status', ['draft', 'submitted'])
export const musicWishCategory = pgEnum('music_wish_category', ['must_play', 'nice_to_have', 'do_not_play', 'special_moment'])
export const invoiceStatus = pgEnum('invoice_status', ['draft', 'finalized', 'void'])
export const invoicePaymentStatus = pgEnum('invoice_payment_status', ['unpaid', 'pending', 'paid', 'failed'])
export const invoiceVatMode = pgEnum('invoice_vat_mode', ['exclusive', 'inclusive', 'exempt'])
export const paymentRecordStatus = pgEnum('payment_record_status', ['pending', 'succeeded', 'failed', 'cancelled', 'expired'])
export const calendarSyncStatus = pgEnum('calendar_sync_status', ['pending', 'syncing', 'synced', 'failed', 'skipped'])
export const calendarCancellationBehavior = pgEnum('calendar_cancellation_behavior', ['delete', 'mark_cancelled', 'keep'])
export const emailJobStatus = pgEnum('email_job_status', ['pending', 'processing', 'sent', 'failed', 'cancelled', 'suppressed'])
export const emailDeliveryStatus = pgEnum('email_delivery_status', ['sent', 'failed'])

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  passwordHash: text('password_hash'),
  role: userRole('role').default('owner').notNull(),
  active: boolean('active').default(true).notNull(),
  sessionVersion: integer('session_version').default(1).notNull(),
  ...timestamps,
})

export const clients = pgTable('clients', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: clientType('type').default('person').notNull(),
  firstName: varchar('first_name', { length: 120 }),
  lastName: varchar('last_name', { length: 120 }),
  companyName: varchar('company_name', { length: 200 }),
  email: varchar('email', { length: 320 }),
  phone: varchar('phone', { length: 64 }),
  billingAddress: text('billing_address'),
  notes: text('notes'),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }).unique(),
  emailAutomationDisabled: jsonb('email_automation_disabled').$type<string[]>().default([]).notNull(),
  ...timestamps,
})

export const venues = pgTable('venues', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 240 }).notNull(),
  address: text('address'),
  city: varchar('city', { length: 160 }),
  contactName: varchar('contact_name', { length: 200 }),
  contactEmail: varchar('contact_email', { length: 320 }),
  contactPhone: varchar('contact_phone', { length: 64 }),
  website: text('website'),
  parkingNotes: text('parking_notes'),
  technicalNotes: text('technical_notes'),
  notes: text('notes'),
  ...timestamps,
})

export const gigs = pgTable('gigs', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 240 }),
  eventType: varchar('event_type', { length: 120 }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'restrict' }),
  venueId: uuid('venue_id').references(() => venues.id, { onDelete: 'set null' }),
  assignedUserId: uuid('assigned_user_id').references(() => users.id, { onDelete: 'set null' }),
  status: gigStatus('status').default('lead').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  loadInAt: timestamp('load_in_at', { withTimezone: true }),
  fee: numeric('fee', { precision: 12, scale: 2 }),
  currency: varchar('currency', { length: 3 }).default('EUR').notNull(),
  publicVisibility: boolean('public_visibility').default(false).notNull(),
  publicTitle: varchar('public_title', { length: 240 }),
  publicDescription: text('public_description'),
  internalNotes: text('internal_notes'),
  source: varchar('source', { length: 160 }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  ...timestamps,
}, table => [index('gigs_assigned_user_id_idx').on(table.assignedUserId)])

export const gigContacts = pgTable('gig_contacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  gigId: uuid('gig_id').notNull().references(() => gigs.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  role: varchar('role', { length: 160 }),
  email: varchar('email', { length: 320 }),
  phone: varchar('phone', { length: 64 }),
  notes: text('notes'),
  ...timestamps,
})

export const gigTimelineItems = pgTable('gig_timeline_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  gigId: uuid('gig_id').notNull().references(() => gigs.id, { onDelete: 'cascade' }),
  time: varchar('time', { length: 16 }),
  title: varchar('title', { length: 240 }).notNull(),
  description: text('description'),
  ordering: integer('ordering').default(0).notNull(),
  ...timestamps,
})

export const portalLinks = pgTable('portal_links', {
  id: uuid('id').defaultRandom().primaryKey(),
  gigId: uuid('gig_id').notNull().references(() => gigs.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  lastInvitedAt: timestamp('last_invited_at', { withTimezone: true }).defaultNow().notNull(),
  invitationCount: integer('invitation_count').default(1).notNull(),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const questionnaireTemplates = pgTable('questionnaire_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  active: boolean('active').default(true).notNull(),
  ...timestamps,
})

export const questionnaireTemplateVersions = pgTable('questionnaire_template_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  templateId: uuid('template_id').notNull().references(() => questionnaireTemplates.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  fields: jsonb('fields').$type<QuestionnaireField[]>().default([]).notNull(),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex('questionnaire_template_version_unique').on(table.templateId, table.version)])

export const contractSubmissions = pgTable('contract_submissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  gigId: uuid('gig_id').notNull().unique().references(() => gigs.id, { onDelete: 'cascade' }),
  templateVersionId: uuid('template_version_id').notNull().references(() => questionnaireTemplateVersions.id, { onDelete: 'restrict' }),
  portalLinkId: uuid('portal_link_id').references(() => portalLinks.id, { onDelete: 'set null' }),
  status: submissionStatus('status').default('draft').notNull(),
  answers: jsonb('answers').$type<Record<string, unknown>>().default({}).notNull(),
  acceptedName: varchar('accepted_name', { length: 200 }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  ...timestamps,
})

export const musicWishes = pgTable('music_wishes', {
  id: uuid('id').defaultRandom().primaryKey(),
  gigId: uuid('gig_id').notNull().references(() => gigs.id, { onDelete: 'cascade' }),
  category: musicWishCategory('category').notNull(),
  artist: varchar('artist', { length: 240 }),
  title: varchar('title', { length: 240 }),
  spotifyUrl: text('spotify_url'),
  note: text('note'),
  ordering: integer('ordering').default(0).notNull(),
  ...timestamps,
})

export const businessSettings = pgTable('business_settings', {
  key: varchar('key', { length: 40 }).primaryKey().default('default'),
  companyName: varchar('company_name', { length: 240 }).notNull(),
  address: text('address').default('').notNull(),
  postalCode: varchar('postal_code', { length: 32 }).default('').notNull(),
  city: varchar('city', { length: 160 }).default('').notNull(),
  country: varchar('country', { length: 120 }).default('Nederland').notNull(),
  email: varchar('email', { length: 320 }).default('').notNull(),
  phone: varchar('phone', { length: 64 }).default('').notNull(),
  registrationNumber: varchar('registration_number', { length: 80 }).default('').notNull(),
  vatNumber: varchar('vat_number', { length: 80 }).default('').notNull(),
  iban: varchar('iban', { length: 64 }).default('').notNull(),
  invoicePrefix: varchar('invoice_prefix', { length: 16 }).default('NL').notNull(),
  nextInvoiceNumber: integer('next_invoice_number').default(1).notNull(),
  defaultVatMode: invoiceVatMode('default_vat_mode').default('exclusive').notNull(),
  defaultVatRateBasisPoints: integer('default_vat_rate_basis_points').default(2100).notNull(),
  defaultPaymentTermDays: integer('default_payment_term_days').default(30).notNull(),
  paymentTerms: text('payment_terms').default('Please pay the full amount before the due date.').notNull(),
  legalText: text('legal_text').default('').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  gigId: uuid('gig_id').notNull().references(() => gigs.id, { onDelete: 'restrict' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'restrict' }),
  invoiceNumber: varchar('invoice_number', { length: 80 }).unique(),
  status: invoiceStatus('status').default('draft').notNull(),
  paymentStatus: invoicePaymentStatus('payment_status').default('unpaid').notNull(),
  issueDate: date('issue_date').notNull(),
  dueDate: date('due_date').notNull(),
  currency: varchar('currency', { length: 3 }).default('EUR').notNull(),
  vatMode: invoiceVatMode('vat_mode').$type<VatMode>().default('exclusive').notNull(),
  vatRateBasisPoints: integer('vat_rate_basis_points').default(2100).notNull(),
  subtotalCents: integer('subtotal_cents').default(0).notNull(),
  vatAmountCents: integer('vat_amount_cents').default(0).notNull(),
  totalCents: integer('total_cents').default(0).notNull(),
  paymentTerms: text('payment_terms').default('').notNull(),
  legalText: text('legal_text').default('').notNull(),
  notes: text('notes').default('').notNull(),
  documentSnapshot: jsonb('document_snapshot').$type<InvoiceSnapshot>(),
  documentHash: varchar('document_hash', { length: 64 }),
  finalizedAt: timestamp('finalized_at', { withTimezone: true }),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  replacementForInvoiceId: uuid('replacement_for_invoice_id').references((): AnyPgColumn => invoices.id, { onDelete: 'set null' }),
  ...timestamps,
})

export const invoiceLineItems = pgTable('invoice_line_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  description: varchar('description', { length: 500 }).notNull(),
  quantity: numeric('quantity', { precision: 12, scale: 3 }).notNull(),
  unitPriceCents: integer('unit_price_cents').notNull(),
  ordering: integer('ordering').default(0).notNull(),
  ...timestamps,
})

export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceId: uuid('invoice_id').notNull().unique().references(() => invoices.id, { onDelete: 'restrict' }),
  provider: varchar('provider', { length: 40 }).default('stripe').notNull(),
  providerSessionId: varchar('provider_session_id', { length: 255 }).unique(),
  providerPaymentIntentId: varchar('provider_payment_intent_id', { length: 255 }).unique(),
  amountCents: integer('amount_cents').notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  status: paymentRecordStatus('status').default('pending').notNull(),
  attemptCount: integer('attempt_count').default(0).notNull(),
  checkoutExpiresAt: timestamp('checkout_expires_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  failureCode: varchar('failure_code', { length: 160 }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  ...timestamps,
})

export const stripeSettings = pgTable('stripe_settings', {
  key: varchar('key', { length: 40 }).primaryKey().default('default'),
  secretKeyEncrypted: text('secret_key_encrypted'),
  webhookSecretEncrypted: text('webhook_secret_encrypted'),
  webhookEndpointId: varchar('webhook_endpoint_id', { length: 255 }),
  livemode: boolean('livemode'),
  accountId: varchar('account_id', { length: 255 }),
  accountName: varchar('account_name', { length: 255 }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  ...timestamps,
})

export const stripeWebhookEvents =pgTable('stripe_webhook_events', {
  eventId: varchar('event_id', { length: 255 }).primaryKey(),
  eventType: varchar('event_type', { length: 160 }).notNull(),
  livemode: boolean('livemode').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow().notNull(),
})

export const calendarSyncSettings = pgTable('calendar_sync_settings', {
  key: varchar('key', { length: 40 }).primaryKey().default('default'),
  enabled: boolean('enabled').default(false).notNull(),
  calendarId: varchar('calendar_id', { length: 255 }).default('primary').notNull(),
  cancellationBehavior: calendarCancellationBehavior('cancellation_behavior').default('delete').notNull(),
  clientId: varchar('client_id', { length: 500 }),
  clientSecretEncrypted: text('client_secret_encrypted'),
  refreshTokenEncrypted: text('refresh_token_encrypted'),
  icsTokenEncrypted: text('ics_token_encrypted'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const gigCalendarSync = pgTable('gig_calendar_sync', {
  id: uuid('id').defaultRandom().primaryKey(),
  gigId: uuid('gig_id').notNull().unique().references(() => gigs.id, { onDelete: 'cascade' }),
  providerEventId: varchar('provider_event_id', { length: 255 }).unique(),
  status: calendarSyncStatus('status').default('pending').notNull(),
  retryCount: integer('retry_count').default(0).notNull(),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }).defaultNow().notNull(),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  lastError: text('last_error'),
  ...timestamps,
})

export const emailProviderSettings = pgTable('email_provider_settings', {
  key: varchar('key', { length: 40 }).primaryKey().default('default'),
  apiKeyEncrypted: text('api_key_encrypted'),
  fromAddress: varchar('from_address', { length: 500 }),
  reviewUrl: text('review_url'),
  ...timestamps,
})

export const emailTemplates = pgTable('email_templates', {
  key: varchar('key', { length: 80 }).primaryKey(),
  name: varchar('name', { length: 160 }).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  subject: varchar('subject', { length: 300 }).notNull(),
  body: text('body').notNull(),
  scheduleAnchor: varchar('schedule_anchor', { length: 40 }).default('event').notNull(),
  offsetMinutes: integer('offset_minutes').default(0).notNull(),
  ...timestamps,
})

export const emailJobs = pgTable('email_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  templateKey: varchar('template_key', { length: 80 }).notNull().references(() => emailTemplates.key, { onDelete: 'restrict' }),
  gigId: uuid('gig_id').references(() => gigs.id, { onDelete: 'set null' }),
  invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
  recipient: varchar('recipient', { length: 320 }).notNull(),
  variables: jsonb('variables').$type<Record<string, string | number | null>>().default({}).notNull(),
  runAt: timestamp('run_at', { withTimezone: true }).notNull(),
  status: emailJobStatus('status').default('pending').notNull(),
  attemptCount: integer('attempt_count').default(0).notNull(),
  dedupeKey: varchar('dedupe_key', { length: 255 }).notNull().unique(),
  lastError: text('last_error'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  manual: boolean('manual').default(false).notNull(),
  subjectOverride: varchar('subject_override', { length: 300 }),
  bodyOverride: text('body_override'),
  attachments: jsonb('attachments').$type<EmailAttachment[]>().default([]).notNull(),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  ...timestamps,
})

export const emailDeliveryAttempts = pgTable('email_delivery_attempts', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: uuid('job_id').notNull().references(() => emailJobs.id, { onDelete: 'cascade' }),
  status: emailDeliveryStatus('status').notNull(),
  providerMessageId: varchar('provider_message_id', { length: 255 }),
  error: text('error'),
  attemptedAt: timestamp('attempted_at', { withTimezone: true }).defaultNow().notNull(),
})

export const gigEmailSuppressions = pgTable('gig_email_suppressions', {
  id: uuid('id').defaultRandom().primaryKey(),
  gigId: uuid('gig_id').notNull().references(() => gigs.id, { onDelete: 'cascade' }),
  templateKey: varchar('template_key', { length: 80 }).notNull().references(() => emailTemplates.key, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex('gig_email_suppression_unique').on(table.gigId, table.templateKey)])

export const mediaAssets = pgTable('media_assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  storageKey: varchar('storage_key', { length: 500 }).notNull().unique(),
  thumbnailKey: varchar('thumbnail_key', { length: 500 }),
  originalFilename: varchar('original_filename', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  byteSize: integer('byte_size').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  durationMs: integer('duration_ms'),
  metadata: jsonb('metadata').$type<MediaAssetMetadata>().default({}).notNull(),
  title: varchar('title', { length: 240 }).default('').notNull(),
  altText: varchar('alt_text', { length: 500 }).default('').notNull(),
  tags: jsonb('tags').$type<string[]>().default([]).notNull(),
  gigId: uuid('gig_id').references(() => gigs.id, { onDelete: 'set null' }),
  venueId: uuid('venue_id').references(() => venues.id, { onDelete: 'set null' }),
  ...timestamps,
})

export const generatedPosts = pgTable('generated_posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceMediaAssetId: uuid('source_media_asset_id').references(() => mediaAssets.id, { onDelete: 'set null' }),
  templateKey: varchar('template_key', { length: 80 }).notNull(),
  preset: varchar('preset', { length: 20 }).notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  design: jsonb('design').$type<Record<string, unknown>>().default({}).notNull(),
  outputKey: varchar('output_key', { length: 500 }).notNull().unique(),
  outputMimeType: varchar('output_mime_type', { length: 100 }).default('image/png').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const videoProjects = pgTable('video_projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 160 }).notNull(),
  project: jsonb('project').$type<VideoProject>().notNull(),
  revision: integer('revision').default(1).notNull(),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  ...timestamps,
}, table => [
  index('video_projects_updated_idx').on(table.updatedAt),
])

export const videoRenderJobs = pgTable('video_render_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceMediaAssetId: uuid('source_media_asset_id').references(() => mediaAssets.id, { onDelete: 'restrict' }),
  projectId: uuid('project_id').references(() => videoProjects.id, { onDelete: 'set null' }),
  projectSnapshot: jsonb('project_snapshot').$type<VideoProject>(),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  templateKey: varchar('template_key', { length: 80 }).notNull(),
  motionPreset: varchar('motion_preset', { length: 40 }).notNull(),
  brandPreset: varchar('brand_preset', { length: 40 }).notNull(),
  design: jsonb('design').$type<Record<string, unknown>>().default({}).notNull(),
  width: integer('width').default(1080).notNull(),
  height: integer('height').default(1920).notNull(),
  fps: integer('fps').default(30).notNull(),
  durationSeconds: integer('duration_seconds').default(10).notNull(),
  audioKey: varchar('audio_key', { length: 500 }),
  audioMimeType: varchar('audio_mime_type', { length: 100 }),
  outputKey: varchar('output_key', { length: 500 }).unique(),
  outputMimeType: varchar('output_mime_type', { length: 100 }).default('video/mp4').notNull(),
  status: varchar('status', { length: 30 }).default('queued').notNull(),
  progress: integer('progress').default(0).notNull(),
  error: text('error'),
  renderEngine: varchar('render_engine', { length: 20 }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  ...timestamps,
}, table => [
  index('video_render_jobs_queue_idx').on(table.status, table.createdAt),
  index('video_render_jobs_source_idx').on(table.sourceMediaAssetId),
  index('video_render_jobs_project_idx').on(table.projectId, table.createdAt),
])

export const renderSettings = pgTable('render_settings', {
  key: varchar('key', { length: 40 }).primaryKey().default('default'),
  engine: varchar('engine', { length: 20 }).default('auto').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const renderWorkerStatus = pgTable('render_worker_status', {
  key: varchar('key', { length: 40 }).primaryKey().default('default'),
  capabilities: jsonb('capabilities').$type<RenderEngineCapability[]>().default([]).notNull(),
  detectedAt: timestamp('detected_at', { withTimezone: true }).defaultNow().notNull(),
  heartbeatAt: timestamp('heartbeat_at', { withTimezone: true }).defaultNow().notNull(),
})

export const outboxEvents = pgTable('outbox_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: varchar('type', { length: 120 }).notNull(),
  aggregateType: varchar('aggregate_type', { length: 80 }).notNull(),
  aggregateId: uuid('aggregate_id').notNull(),
  dedupeKey: varchar('dedupe_key', { length: 255 }).notNull().unique(),
  payload: jsonb('payload').$type<Record<string, unknown>>().default({}).notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
})

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  entityType: varchar('entity_type', { length: 80 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  action: varchar('action', { length: 80 }).notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type SiteService = { title: string, body: string, imageUrl: string | null, imageAlt: string }
export type SiteGalleryItem = { url: string, alt: string }

export const siteContent = pgTable('site_content', {
  key: varchar('key', { length: 40 }).primaryKey(),
  brandName: varchar('brand_name', { length: 120 }).notNull(),
  heroEyebrow: varchar('hero_eyebrow', { length: 160 }).notNull(),
  heroTitle: varchar('hero_title', { length: 300 }).notNull(),
  heroBody: text('hero_body').notNull(),
  heroImageUrl: text('hero_image_url'),
  heroCtaLabel: varchar('hero_cta_label', { length: 120 }).notNull(),
  aboutEyebrow: varchar('about_eyebrow', { length: 160 }).notNull(),
  aboutTitle: varchar('about_title', { length: 300 }).notNull(),
  aboutBody: text('about_body').notNull(),
  mediaEyebrow: varchar('media_eyebrow', { length: 160 }).notNull(),
  mediaTitle: varchar('media_title', { length: 300 }).notNull(),
  mediaBody: text('media_body').notNull(),
  showreelUrl: text('showreel_url'),
  agendaEyebrow: varchar('agenda_eyebrow', { length: 160 }).notNull(),
  agendaTitle: varchar('agenda_title', { length: 300 }).notNull(),
  agendaBody: text('agenda_body').notNull(),
  bookingEyebrow: varchar('booking_eyebrow', { length: 160 }).notNull(),
  bookingTitle: varchar('booking_title', { length: 300 }).notNull(),
  bookingBody: text('booking_body').notNull(),
  contactEmail: varchar('contact_email', { length: 320 }),
  contactPhone: varchar('contact_phone', { length: 64 }),
  instagramUrl: text('instagram_url'),
  spotifyUrl: text('spotify_url'),
  seoTitle: varchar('seo_title', { length: 180 }).notNull(),
  seoDescription: varchar('seo_description', { length: 320 }).notNull(),
  seoImageUrl: text('seo_image_url'),
  services: jsonb('services').$type<SiteService[]>().default([]).notNull(),
  gallery: jsonb('gallery').$type<SiteGalleryItem[]>().default([]).notNull(),
  publicCopy: jsonb('public_copy').$type<SitePublicCopy>().default({} as SitePublicCopy).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const landingPages = pgTable('landing_pages', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 160 }).notNull().unique(),
  navLabel: varchar('nav_label', { length: 120 }).notNull(),
  eyebrow: varchar('eyebrow', { length: 160 }).notNull(),
  title: varchar('title', { length: 300 }).notNull(),
  intro: text('intro').notNull(),
  body: text('body').notNull(),
  heroImageUrl: text('hero_image_url'),
  ctaLabel: varchar('cta_label', { length: 120 }).notNull(),
  ctaHref: varchar('cta_href', { length: 500 }).default('/boeken').notNull(),
  published: boolean('published').default(false).notNull(),
  showInNavigation: boolean('show_in_navigation').default(false).notNull(),
  indexable: boolean('indexable').default(true).notNull(),
  seoTitle: varchar('seo_title', { length: 180 }).notNull(),
  seoDescription: varchar('seo_description', { length: 320 }).notNull(),
  seoImageUrl: text('seo_image_url'),
  ordering: integer('ordering').default(0).notNull(),
  ...timestamps,
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Client = typeof clients.$inferSelect
export type NewClient = typeof clients.$inferInsert
export type Venue = typeof venues.$inferSelect
export type NewVenue = typeof venues.$inferInsert
export type Gig = typeof gigs.$inferSelect
export type NewGig = typeof gigs.$inferInsert
export type GigContact = typeof gigContacts.$inferSelect
export type GigTimelineItem = typeof gigTimelineItems.$inferSelect
export type PortalLink = typeof portalLinks.$inferSelect
export type QuestionnaireTemplate = typeof questionnaireTemplates.$inferSelect
export type QuestionnaireTemplateVersion = typeof questionnaireTemplateVersions.$inferSelect
export type ContractSubmission = typeof contractSubmissions.$inferSelect
export type MusicWish = typeof musicWishes.$inferSelect
export type BusinessSettings = typeof businessSettings.$inferSelect
export type Invoice = typeof invoices.$inferSelect
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect
export type Payment = typeof payments.$inferSelect
export type CalendarSyncSettings = typeof calendarSyncSettings.$inferSelect
export type GigCalendarSync = typeof gigCalendarSync.$inferSelect
export type EmailTemplate = typeof emailTemplates.$inferSelect
export type EmailJob = typeof emailJobs.$inferSelect
export type EmailDeliveryAttempt = typeof emailDeliveryAttempts.$inferSelect
export type GigEmailSuppression = typeof gigEmailSuppressions.$inferSelect
export type MediaAsset = typeof mediaAssets.$inferSelect
export type GeneratedPost = typeof generatedPosts.$inferSelect
export type VideoRenderJob = typeof videoRenderJobs.$inferSelect
export type VideoProjectRow = typeof videoProjects.$inferSelect
export type OutboxEvent = typeof outboxEvents.$inferSelect
export type SiteContent = typeof siteContent.$inferSelect
export type LandingPage = typeof landingPages.$inferSelect

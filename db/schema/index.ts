import {
  type AnyPgColumn,
  boolean,
  date,
  integer,
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

export const userRole = pgEnum('user_role', ['owner', 'dj', 'manager', 'content_editor'])
export const clientType = pgEnum('client_type', ['person', 'company'])
export const gigStatus = pgEnum('gig_status', ['lead', 'booked', 'declined', 'cancelled'])
export const submissionStatus = pgEnum('submission_status', ['draft', 'submitted'])
export const musicWishCategory = pgEnum('music_wish_category', ['must_play', 'nice_to_have', 'do_not_play', 'special_moment'])
export const invoiceStatus = pgEnum('invoice_status', ['draft', 'finalized', 'void'])
export const invoicePaymentStatus = pgEnum('invoice_payment_status', ['unpaid', 'pending', 'paid', 'failed'])
export const invoiceVatMode = pgEnum('invoice_vat_mode', ['exclusive', 'inclusive', 'exempt'])

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
  title: varchar('title', { length: 240 }).notNull(),
  eventType: varchar('event_type', { length: 120 }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'restrict' }),
  venueId: uuid('venue_id').references(() => venues.id, { onDelete: 'set null' }),
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
})

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

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  entityType: varchar('entity_type', { length: 80 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  action: varchar('action', { length: 80 }).notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type SiteService = { title: string, body: string }
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
export type SiteContent = typeof siteContent.$inferSelect
export type LandingPage = typeof landingPages.$inferSelect

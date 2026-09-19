import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const userRole = pgEnum('user_role', ['owner', 'dj', 'manager', 'content_editor'])
export const clientType = pgEnum('client_type', ['person', 'company'])
export const gigStatus = pgEnum('gig_status', ['lead', 'booked', 'declined', 'cancelled'])

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
export type SiteContent = typeof siteContent.$inferSelect
export type LandingPage = typeof landingPages.$inferSelect

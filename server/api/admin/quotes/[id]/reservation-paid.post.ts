import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { quotes } from '../../../../../db/schema'
import { confirmBooking } from '../../../../utils/booking-confirmation'
import { db } from '../../../../utils/db'
import { recordReservationPaid } from '../../../../utils/reservation-payment'
import { requireStaff } from '../../../../utils/require-staff'
import { requireUuidParam } from '../../../../utils/route-params'

const bodySchema = z.object({ paidOn: z.iso.date(), method: z.string().trim().max(60).optional().default('bankoverschrijving') })

/** Records a reservation paid outside Stripe (bank transfer, cash) and confirms the booking. */
export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const id = requireUuidParam(event, 'id')
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Geef de datum waarop de reservering is betaald' })
  const paidAt = new Date(`${parsed.data.paidOn}T12:00:00.000Z`)
  if (paidAt.getTime() > Date.now() + 36 * 3600_000) throw createError({ statusCode: 422, statusMessage: 'De betaaldatum kan niet in de toekomst liggen.' })

  const [quote] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1)
  if (!quote) throw createError({ statusCode: 404, statusMessage: 'Offerte niet gevonden' })
  if (quote.status !== 'accepted' || quote.reservationCents <= 0) throw createError({ statusCode: 409, statusMessage: 'Deze offerte heeft geen reserveringskosten die nog betaald moeten worden' })
  if (quote.reservationPaidAt) throw createError({ statusCode: 409, statusMessage: 'De reservering is al als betaald gemarkeerd' })

  await db.transaction(tx => recordReservationPaid(tx, quote, { provider: 'manual', paidAt, userId: user.id, metadata: { manual: true, method: parsed.data.method, recordedByUserId: user.id } }))
  const confirmed = await confirmBooking(id, 'reservation_paid')
  return { ok: true, bookingConfirmed: confirmed }
})

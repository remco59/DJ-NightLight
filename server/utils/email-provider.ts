import { emailHtmlFromText } from '../../shared/email-automation'
import { loadEmailIntegration } from './integration-settings'

type SendInput = {
  to: string
  subject: string
  text: string
  idempotencyKey: string
}

export async function emailProviderConfigured() {
  const { status } = await loadEmailIntegration()
  return status.configured
}

export async function sendEmail(input: SendInput) {
  const { config: email } = await loadEmailIntegration()
  if (!email.apiKey || !email.from) throw new Error('Email provider is not configured')

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${email.apiKey}`,
      'content-type': 'application/json',
      'Idempotency-Key': input.idempotencyKey,
    },
    body: JSON.stringify({
      from: email.from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: emailHtmlFromText(input.text),
    }),
  })

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1000)
    throw new Error(`Email provider failed (${response.status}): ${detail}`)
  }

  const payload = await response.json() as { id?: string }
  return { id: payload.id || null }
}

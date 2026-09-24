import { loadEmailIntegration } from './integration-settings'

type SendInput = {
  to: string
  subject: string
  text: string
  html: string
  idempotencyKey: string
  attachments?: Array<{ filename: string, content: Uint8Array }>
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
      html: input.html,
      ...(input.attachments?.length
        ? {
            attachments: input.attachments.map(attachment => ({
              filename: attachment.filename,
              content: Buffer.from(attachment.content).toString('base64'),
            })),
          }
        : {}),
    }),
  })

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1000)
    throw new Error(`Email provider failed (${response.status}): ${detail}`)
  }

  const payload = await response.json() as { id?: string }
  return { id: payload.id || null }
}

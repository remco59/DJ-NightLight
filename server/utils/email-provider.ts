import { emailHtmlFromText } from '../../shared/email-automation'

type SendInput = {
  to: string
  subject: string
  text: string
}

export function emailProviderConfigured() {
  const config = useRuntimeConfig()
  const email = config.email as { apiKey?: string, from?: string }
  return Boolean(email.apiKey && email.from)
}

export async function sendEmail(input: SendInput) {
  const config = useRuntimeConfig()
  const email = config.email as { apiKey?: string, from?: string }
  if (!email.apiKey || !email.from) throw new Error('Email provider is not configured')

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${email.apiKey}`,
      'content-type': 'application/json',
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

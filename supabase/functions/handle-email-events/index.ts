import { createEmailWebhookHandler } from 'npm:@lovable.dev/email-js@0.1.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

// Terminal delivery outcomes reported by Lovable's managed email delivery.
// These writes are notification-only: Lovable enforces suppression at send
// time, so nothing here gates a future send.

function client() {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) {
    throw new Error('Missing Supabase service credentials')
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } })
}

const REASON_MESSAGE: Record<string, string> = {
  bounce: 'Permanent bounce — email address is invalid or rejected',
  complaint: 'Spam complaint — recipient marked email as spam',
  unsubscribe: 'Recipient unsubscribed',
}

const REASON_STATUS: Record<string, 'bounced' | 'complained' | 'suppressed'> = {
  bounce: 'bounced',
  complaint: 'complained',
  unsubscribe: 'suppressed',
}

async function recordOutcome(
  reason: 'bounce' | 'complaint' | 'unsubscribe',
  recipient: string,
  messageId: string | null,
  eventId: string,
): Promise<void> {
  const db = client()
  const email = recipient.toLowerCase()

  // Idempotent — safe for webhook redeliveries.
  const { error: suppressError } = await db
    .from('suppressed_emails')
    .upsert({ email, reason, metadata: null }, { onConflict: 'email' })
  if (suppressError) {
    console.error('Failed to upsert suppressed email', {
      event_id: eventId,
      code: suppressError.code,
      message: suppressError.message,
    })
    throw new Error('Failed to write suppression')
  }

  const { error: logError } = await db.from('email_send_log').insert({
    message_id: messageId,
    template_name: 'system',
    recipient_email: email,
    status: REASON_STATUS[reason],
    error_message: REASON_MESSAGE[reason],
    metadata: null,
  })
  if (logError) {
    console.error('Failed to insert email_send_log', {
      event_id: eventId,
      code: logError.code,
      message: logError.message,
    })
    throw new Error('Failed to write send log')
  }
}

/**
 * Landing list: mark the subscriber unsubscribed and cancel any follow-up still
 * queued for them, so one unsubscribe ends every future landing email.
 */
async function endLandingSequence(recipient: string, eventId: string): Promise<void> {
  const db = client()
  const email = recipient.toLowerCase()

  const { data: subscriber, error: subscriberError } = await db
    .from('newsletter_subscribers')
    .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
    .eq('email', email)
    .neq('status', 'unsubscribed')
    .select('id')
    .maybeSingle()

  if (subscriberError) {
    console.error('Failed to update newsletter subscriber', {
      event_id: eventId,
      code: subscriberError.code,
      message: subscriberError.message,
    })
    throw new Error('Failed to update subscriber')
  }

  if (subscriber?.id) {
    const { error: cancelError } = await db
      .from('newsletter_followups')
      .update({ status: 'canceled', last_error: 'Recipient unsubscribed' })
      .eq('subscriber_id', subscriber.id)
      .eq('status', 'scheduled')
    if (cancelError) {
      console.error('Failed to cancel scheduled follow-ups', {
        event_id: eventId,
        code: cancelError.code,
        message: cancelError.message,
      })
      throw new Error('Failed to cancel follow-ups')
    }
  }
}

const handler = createEmailWebhookHandler({
  apiKey: Deno.env.get('LOVABLE_API_KEY')!,
  on: {
    'email.bounced': async (event) => {
      await recordOutcome('bounce', event.data.recipient, event.data.message_id ?? null, event.event_id)
      console.log('Email bounced', { event_id: event.event_id })
    },
    'email.complaint': async (event) => {
      await recordOutcome('complaint', event.data.recipient, event.data.message_id ?? null, event.event_id)
      console.log('Email complaint', { event_id: event.event_id })
    },
    'email.unsubscribed': async (event) => {
      await recordOutcome('unsubscribe', event.data.recipient, event.data.message_id ?? null, event.event_id)
      await endLandingSequence(event.data.recipient, event.event_id)
      console.log('Email unsubscribed', { event_id: event.event_id })
    },
  },
})

Deno.serve((req) => handler(req))

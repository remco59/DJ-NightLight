# Stripe Integration TODO

An existing Checkout Session call was found, so only its parameters were updated.

## Values to Replace

The `sample_only` parameters (`mode`, `line_items`, `success_url`, `cancel_url`) already hold real values in your code and were left untouched. No placeholders remain.

## Configured Parameters

These parameters were configured in Checkout Studio and are already set.

**Files containing these parameters:**
- [server/api/client/portal/[token]/checkout.post.ts](server/api/client/portal/[token]/checkout.post.ts)

| Parameter | Value |
|-----------|-------|
| ui_mode | hosted_page (stripe SDK 22.4.0 ≥ 21.0.0; use `hosted` if you downgrade below 21) |
| billing_address_collection | auto |
| phone_number_collection | `{ enabled: false }` |
| automatic_tax | `{ enabled: false }` |
| allow_promotion_codes | false |
| submit_type | auto |
| origin_context | web |

`payment_method_collection` is omitted because `mode` is `payment` (it applies only to `subscription`).

Existing functional parameters (`customer`, `client_reference_id`, `metadata`, `payment_intent_data`, `payment_method_types`, `payment_method_options`) were kept because the invoice/webhook flow depends on them.

## Setup and next steps

- Secret key is managed in the admin Stripe settings (`server/utils/stripe.ts`); no new env vars needed.
- Flow: the client portal calls `POST /api/client/portal/[token]/checkout`, is redirected to the Stripe-hosted page, and `server/api/webhooks/stripe.post.ts` marks invoices paid.
- Testing: use card `4242 4242 4242 4242` (any future expiry/CVC) in test mode; `4000 0000 0000 9995` simulates a decline.
- Next steps: verify the webhook secret, and test an end-to-end payment in test mode.
- Resources: https://support.stripe.com and https://docs.stripe.com/mcp

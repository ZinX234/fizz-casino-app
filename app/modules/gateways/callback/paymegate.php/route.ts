import { POST as handlePayMeGateWebhook } from '@/app/api/webhooks/paymegate/route'

export const runtime = 'nodejs'
export const POST = handlePayMeGateWebhook

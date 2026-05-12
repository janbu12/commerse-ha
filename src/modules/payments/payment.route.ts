import type { FastifyInstance } from 'fastify';
import type { PaymentWebhookHandler } from './webhook.handler.js';

export function registerPaymentRoute(app: FastifyInstance, webhookHandler: PaymentWebhookHandler) {
  app.post(
    '/webhook/payment',
    {
      schema: {
        body: {
          type: 'object',
          required: ['paymentReference', 'transactionStatus', 'signature'],
          properties: {
            paymentReference: { type: 'string', minLength: 1 },
            transactionStatus: { type: 'string', minLength: 1 },
            signature: { type: 'string', minLength: 1 }
          }
        }
      }
    },
    async (request) => {
      return webhookHandler.handle(request.body as any);
    }
  );
}

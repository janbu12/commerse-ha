import type { FastifyInstance } from 'fastify';
import { CheckoutService } from './checkout.service.js';

export function registerCheckoutRoute(app: FastifyInstance, service: CheckoutService) {
  app.post(
    '/checkout',
    {
      schema: {
        body: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string', minLength: 1 }
          }
        }
      }
    },
    async (request, reply) => {
      const body = request.body as { userId: string };
      const result = await service.checkout(body.userId);
      return reply.status(201).send(result);
    }
  );
}

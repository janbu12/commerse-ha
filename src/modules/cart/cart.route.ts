import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { CartService } from './cart.service.js';

export function registerCartRoute(app: FastifyInstance, cartService: CartService) {
  app.get(
    '/cart',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string', minLength: 1 }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Querystring: { userId: string } }>) => {
      return cartService.getCart(request.query.userId);
    }
  );

  app.post(
    '/cart/items',
    {
      schema: {
        body: {
          type: 'object',
          required: ['userId', 'productVariantId', 'quantity'],
          properties: {
            userId: { type: 'string', minLength: 1 },
            productVariantId: { type: 'string', minLength: 1 },
            quantity: { type: 'integer', minimum: 1 }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{
        Body: { userId: string; productVariantId: string; quantity: number };
      }>,
      reply
    ) => {
      const item = await cartService.addItem(request.body);
      return reply.status(201).send(item);
    }
  );

  app.patch(
    '/cart/items/:itemId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['itemId'],
          properties: {
            itemId: { type: 'string', minLength: 1 }
          }
        },
        body: {
          type: 'object',
          required: ['quantity'],
          properties: {
            quantity: { type: 'integer', minimum: 1 }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{
        Params: { itemId: string };
        Body: { quantity: number };
      }>
    ) => {
      return cartService.updateItemQuantity(request.params.itemId, request.body.quantity);
    }
  );

  app.delete(
    '/cart/items/:itemId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['itemId'],
          properties: {
            itemId: { type: 'string', minLength: 1 }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Params: { itemId: string } }>, reply) => {
      await cartService.deleteItem(request.params.itemId);
      return reply.status(204).send();
    }
  );
}

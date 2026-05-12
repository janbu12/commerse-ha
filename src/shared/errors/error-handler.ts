import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from './app-error.js';

export function errorHandler(error: FastifyError | AppError, request: FastifyRequest, reply: FastifyReply) {
  request.log.error({ err: error }, 'request_failed');

  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: error.message,
      code: error.code
    });
  }

  return reply.status(500).send({
    error: 'internal server error',
    code: 'internal_error'
  });
}

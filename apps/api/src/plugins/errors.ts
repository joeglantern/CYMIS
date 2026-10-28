import type { ErrorResponse } from '@cymis/schemas';
import type { FastifyError, FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { hasZodFastifySchemaValidationErrors, isResponseSerializationError } from 'fastify-type-provider-zod';
import { Prisma } from '../infra/db.js';
import { AppError } from '../lib/errors.js';

function body(code: string, message: string, details?: unknown): ErrorResponse {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}

/** Every error carries the request id, so a person can quote it and we can find the log line. */
function withRef(b: ErrorResponse, requestId: string): ErrorResponse {
  return { error: { ...b.error, requestId } };
}

/**
 * One error shape for every response. Clients only ever see a code, a short
 * message and, for validation, which fields are wrong. Never a stack trace.
 */
export const errorsPlugin = fp(
  async (app: FastifyInstance) => {
    app.addHook('onSend', async (request, reply) => {
      reply.header('x-request-id', request.id);
    });
    app.setErrorHandler((error: FastifyError, request, reply) => {
      const send = reply.send.bind(reply);
      reply.send = ((payload: ErrorResponse) => send(withRef(payload, request.id))) as typeof reply.send;
      if (hasZodFastifySchemaValidationErrors(error)) {
        const details = error.validation.map((v) => ({
          field: v.instancePath.replace(/^\//, '').replace(/\//g, '.') || error.validationContext || 'body',
          message: v.message ?? 'Invalid value',
        }));
        return reply.status(400).send(body('validation_failed', 'Some fields are not right', details));
      }

      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(body(error.code, error.message, error.details));
      }

      if (isResponseSerializationError(error)) {
        request.log.error({ err: error, issues: error.cause.issues }, 'response did not match schema');
        return reply.status(500).send(body('internal_error', 'Something went wrong on our side'));
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') return reply.status(409).send(body('conflict', 'That already exists'));
        if (error.code === 'P2025') return reply.status(404).send(body('not_found', 'Item not found'));
        if (error.code === 'P2003') return reply.status(409).send(body('conflict', 'A linked item is missing'));
      }

      // Errors thrown by Fastify and its plugins carry a status code.
      const status = error.statusCode ?? 500;
      if (status === 429) {
        return reply.status(429).send(body('rate_limited', 'Too many requests. Wait a moment and try again'));
      }
      if (status === 413) {
        return reply.status(413).send(body('too_large', 'That file or request is too large'));
      }
      if (status === 415) {
        return reply.status(415).send(body('unsupported_media_type', 'That content type is not accepted'));
      }
      if (status >= 400 && status < 500) {
        return reply.status(status).send(body(error.code?.toLowerCase() ?? 'bad_request', error.message));
      }

      request.log.error({ err: error }, 'unhandled error');
      return reply.status(500).send(body('internal_error', 'Something went wrong on our side'));
    });

    app.setNotFoundHandler((request, reply) => {
      reply.status(404).send(withRef(body('not_found', `No route for ${request.method} ${request.url.split('?')[0]}`), request.id));
    });
  },
  { name: 'errors' },
);

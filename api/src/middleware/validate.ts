import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { badRequest } from '../lib/http';

type Source = 'body' | 'query' | 'params';

export const validate =
  (source: Source, schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message }));
      return next(badRequest(details[0]?.message ?? 'Invalid request.', details));
    }
    Object.defineProperty(req, source, { value: result.data, writable: true, configurable: true });
    next();
  };

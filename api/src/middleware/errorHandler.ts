import type { ErrorRequestHandler, RequestHandler } from 'express';
import { MulterError } from 'multer';
import { env } from '../config/env';
import { AppError, notFound } from '../lib/http';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(notFound(`Route ${req.method} ${req.originalUrl} not found.`));
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    return res.status(error.status).json({ error: { message: error.message, details: error.details } });
  }
  if (error instanceof MulterError) {
    return res.status(400).json({ error: { message: error.message } });
  }
  if (env.NODE_ENV !== 'test') console.error(error);
  res.status(500).json({ error: { message: 'Something went wrong. Please try again.' } });
};

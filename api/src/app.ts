import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { corsOrigins, env } from './config/env';
import { UPLOAD_DIR } from './lib/upload';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { adminRouter } from './modules/admin/admin.routes';
import { authRouter } from './modules/auth/auth.routes';
import { categoryRouter } from './modules/categories/category.routes';
import { contactRouter } from './modules/contact/contact.routes';
import { itemRouter } from './modules/items/item.routes';
import { meRouter } from './modules/me/me.routes';
import { sellerRouter } from './modules/seller/seller.routes';
import { statsRouter } from './modules/stats/stats.routes';
import { userRouter } from './modules/users/user.routes';

export const createApp = () => {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  if (env.NODE_ENV !== 'test') app.use(morgan('dev'));

  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/categories', categoryRouter);
  app.use('/api/items', itemRouter);
  app.use('/api/seller', sellerRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/me', meRouter);
  app.use('/api/users', userRouter);
  app.use('/api/contact', contactRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

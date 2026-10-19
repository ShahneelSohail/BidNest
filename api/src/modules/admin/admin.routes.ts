import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth';
import { categoriesRouter } from './admin.categories';
import { dashboardRouter } from './admin.dashboard';
import { itemsRouter } from './admin.items';
import { messagesRouter } from './admin.messages';
import { usersRouter } from './admin.users';

export const adminRouter = Router();

adminRouter.use(...requireAdmin);
adminRouter.use(dashboardRouter, usersRouter, categoriesRouter, itemsRouter, messagesRouter);

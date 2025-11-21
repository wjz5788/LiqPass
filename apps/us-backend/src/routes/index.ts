import type express from 'express';
import healthRoutes from './health.js';
import okxVerifyRoutes from './okx-verify.js';
import authRoutes from './auth.js';
import ordersRoutes from './orders.js';
import adminClaimsRoutes from './adminClaims.js';
import apiKeysRoutes from './apiKeys.js';
import pricingRoutes from './pricing.js';
import { createAuthMiddleware } from '../middleware/authMiddleware.js';
import AuthService from '../services/authService.js';
import OrderService from '../services/orderService.js';
import ClaimsService from '../services/claimsService.js';
import claimsRoutes from './claims.js';
import claimsVerifySimpleRoutes from './claimsVerifySimple.js';
import mockRoutes from './mock.js';

export interface RouteDependencies {
  authService: AuthService;
  orderService: OrderService;
}

export default function registerRoutes(app: express.Application, deps: RouteDependencies) {
  const { authService, orderService } = deps;
  const requireAuth = createAuthMiddleware(authService);
  const claimsService = new ClaimsService(orderService);

  app.use('/api/v1/health', healthRoutes());
  app.use('/api/v1/verify', okxVerifyRoutes);
  app.use('/api/v1/auth', authRoutes(authService, requireAuth));
  app.use('/api/v1', claimsRoutes(claimsService, authService));
  app.use('/api/v1/claims', claimsVerifySimpleRoutes(authService));
  app.use('/api/v1', ordersRoutes(orderService));
  app.use('/api/v1/admin', adminClaimsRoutes);
  app.use('/api/v1/api-keys', apiKeysRoutes);
  app.use('/api/v1/pricing', pricingRoutes);
  app.use('/mock', mockRoutes());
}

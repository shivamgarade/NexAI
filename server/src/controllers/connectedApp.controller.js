import { asyncHandler } from '../utils/asyncHandler.js';
import * as connectedAppService from '../services/connectedApp.service.js';

export const getConnectedApps = asyncHandler(async (req, res) => {
  const apps = await connectedAppService.getConnectedApps(req.user._id);
  res.status(200).json({ data: apps });
});

export const updateConnectedApp = asyncHandler(async (req, res) => {
  const app = await connectedAppService.updateConnectedApp(
    req.user._id,
    req.params.slug,
    req.body,
  );
  res.status(200).json({ data: app });
});

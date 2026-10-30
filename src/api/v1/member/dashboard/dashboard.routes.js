import { Router } from 'express';
import { get } from './dashboard.controller.js';
const r = Router();
r.get('/', get);
export default r;

// Picks the active challan provider based on configuration. Adding a new
// data source is just another case here.
import { config } from '../config.js';
import * as mock from './mock.js';
import * as http from './http.js';
import * as mastersindia from './mastersindia.js';
import * as instantpay from './instantpay.js';

export function getProvider() {
  switch (config.provider) {
    case 'http':
      return http;
    case 'mastersindia':
      return mastersindia;
    case 'instantpay':
      return instantpay;
    case 'mock':
    default:
      return mock;
  }
}

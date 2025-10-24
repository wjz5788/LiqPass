import assert from 'node:assert';
import { describe, it, before, after } from 'node:test';

const BASE_URL = 'http://localhost:8787';

describe('JP Verify Server API', () => {
  let server;

  before(async () => {
    const serverModule = await import('./src/server.js');
    server = serverModule.default;
  });

  after(() => {
    server.close();
  });

  it('should return health status from /healthz', async () => {
    const response = await fetch(`${BASE_URL}/healthz`);
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.verifyMode, 'real');
  });

  it('should return a stubbed verification from /verify/order', async () => {
    const orderData = {
      exchange: 'okx',
      pair: 'BTC-USDT',
      orderRef: 'test-order-123',
      wallet: 'test-wallet-456',
    };

    const response = await fetch(`${BASE_URL}/verify/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });

    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.status, 'ok');
    assert.deepStrictEqual(data.exchange, orderData.exchange);
  });

  it('should return 400 for missing parameters in /verify/order', async () => {
    const orderData = {
      exchange: 'okx',
      pair: 'BTC-USDT',
    };

    const response = await fetch(`${BASE_URL}/verify/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });

    const data = await response.json();

    assert.strictEqual(response.status, 400);
    assert.strictEqual(data.status, 'fail');
  });

  it('should return 404 for unknown routes', async () => {
    const response = await fetch(`${BASE_URL}/unknown-route`);
    const data = await response.json();

    assert.strictEqual(response.status, 404);
    assert.strictEqual(data.status, 'not_found');
  });
});
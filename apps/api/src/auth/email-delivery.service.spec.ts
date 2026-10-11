import { ServiceUnavailableException } from '@nestjs/common';
import { EmailDeliveryService } from './email-delivery.service';

describe('EmailDeliveryService', () => {
  const original = { provider: process.env.EMAIL_VERIFICATION_PROVIDER, url: process.env.EMAIL_PROVIDER_URL, key: process.env.EMAIL_PROVIDER_API_KEY, from: process.env.EMAIL_FROM, nodeEnv: process.env.NODE_ENV };
  const service = new EmailDeliveryService();

  afterEach(() => {
    process.env.EMAIL_VERIFICATION_PROVIDER = original.provider;
    process.env.EMAIL_PROVIDER_URL = original.url;
    process.env.EMAIL_PROVIDER_API_KEY = original.key;
    process.env.EMAIL_FROM = original.from;
    process.env.NODE_ENV = original.nodeEnv;
    jest.restoreAllMocks();
  });

  it('keeps the development adapter token-silent', async () => {
    process.env.NODE_ENV = 'development';
    process.env.EMAIL_VERIFICATION_PROVIDER = 'console';
    await expect(service.sendVerification('student@example.test', 'a'.repeat(64))).resolves.toBeUndefined();
  });

  it('rejects incomplete production configuration', async () => {
    process.env.NODE_ENV = 'production';
    process.env.EMAIL_VERIFICATION_PROVIDER = 'webhook';
    await expect(service.sendVerification('student@example.test', 'a'.repeat(64))).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('delivers through an HTTPS webhook without logging or exposing credentials', async () => {
    process.env.NODE_ENV = 'production';
    process.env.EMAIL_VERIFICATION_PROVIDER = 'webhook';
    process.env.EMAIL_PROVIDER_URL = 'https://mailer.example.test/send';
    process.env.EMAIL_PROVIDER_API_KEY = 'secret-test-key';
    process.env.EMAIL_FROM = 'no-reply@example.test';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 202 }));
    await service.sendPasswordReset('student@example.test', 'b'.repeat(64));
    expect(fetchMock).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer secret-test-key' }) }));
    expect(String(fetchMock.mock.calls[0][1]?.body)).toContain('b'.repeat(64));
  });

  it('fails closed when the provider rejects delivery', async () => {
    process.env.NODE_ENV = 'production';
    process.env.EMAIL_VERIFICATION_PROVIDER = 'webhook';
    process.env.EMAIL_PROVIDER_URL = 'https://mailer.example.test/send';
    process.env.EMAIL_PROVIDER_API_KEY = 'secret-test-key';
    process.env.EMAIL_FROM = 'no-reply@example.test';
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 503 }));
    await expect(service.sendVerification('student@example.test', 'c'.repeat(64))).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

import { Injectable, ServiceUnavailableException } from '@nestjs/common';

/**
 * `webhook` is a provider-neutral HTTPS adapter. The receiving service is
 * responsible for verified sender domains and delivery reputation. The
 * console adapter is deliberately token-silent for local development.
 */
@Injectable()
export class EmailDeliveryService {
  async sendVerification(email: string, token: string): Promise<void> {
    await this.send(email, 'Verify your NET/SLET account', `Use this one-time verification token: ${token}`);
  }

  async sendPasswordReset(email: string, token: string): Promise<void> {
    await this.send(email, 'Reset your NET/SLET password', `Use this one-time password reset token: ${token}`);
  }

  private async send(to: string, subject: string, text: string): Promise<void> {
    const provider = process.env.EMAIL_VERIFICATION_PROVIDER?.trim().toLowerCase();
    if (!provider) throw new ServiceUnavailableException('Email delivery is not configured');
    if (provider === 'console' && process.env.NODE_ENV !== 'production') return;
    if (provider !== 'webhook') throw new ServiceUnavailableException('Configured email provider is not supported');

    const url = process.env.EMAIL_PROVIDER_URL?.trim();
    const apiKey = process.env.EMAIL_PROVIDER_API_KEY?.trim();
    const from = process.env.EMAIL_FROM?.trim();
    if (!url || !apiKey || !from) throw new ServiceUnavailableException('Email delivery configuration is incomplete');
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new ServiceUnavailableException('Email provider URL is invalid'); }
    if (parsed.protocol !== 'https:') throw new ServiceUnavailableException('Email provider URL must use HTTPS');

    let response: Response;
    try {
      response = await fetch(parsed, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ from, to, subject, text }),
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      throw new ServiceUnavailableException('Email delivery provider is unavailable');
    }
    if (!response.ok) throw new ServiceUnavailableException('Email delivery provider rejected the message');
  }
}

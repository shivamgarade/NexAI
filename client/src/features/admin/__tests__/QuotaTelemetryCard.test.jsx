import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QuotaTelemetryCard } from '../QuotaTelemetryCard';

describe('QuotaTelemetryCard Component', () => {
  const mockTelemetry = {
    dailyLimit: 1500,
    requestsToday: 42,
    requestsRemaining: 1458,
    quotaUsedPercentage: 2.8,
    rpm: 3,
    rpmLimit: 15,
    tpm: 4500,
    tpmLimit: 1000000,
    tokensToday: {
      total: 12500,
      inputTokens: 5000,
      outputTokens: 7500,
      flashTokens: 10000,
      proTokens: 2500,
    },
    resetTimeUTC: '00:00 UTC',
  };

  const mockConfigQuotaFree = {
    billingEnforcementMode: 'quota_free',
    dailyGeminiQuotaLimit: 1500,
  };

  it('renders 1,500 RPD daily quota gauge and percentage', () => {
    render(
      <QuotaTelemetryCard
        telemetry={mockTelemetry}
        config={mockConfigQuotaFree}
      />,
    );

    expect(screen.getByText(/Daily Quota Progress/i)).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('/ 1,500 requests')).toBeInTheDocument();
    expect(screen.getByText(/1,458/)).toBeInTheDocument();
    expect(screen.getByText(/2.8% consumed/i)).toBeInTheDocument();
  });

  it('renders 15 RPM and TPM rate limit safety indicators', () => {
    render(
      <QuotaTelemetryCard
        telemetry={mockTelemetry}
        config={mockConfigQuotaFree}
      />,
    );

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('/ 15 RPM')).toBeInTheDocument();
    expect(screen.getByText('4,500')).toBeInTheDocument();
    expect(screen.getByText('/ 1M TPM')).toBeInTheDocument();
  });

  it('renders daily token consumption and single AI engine telemetry', () => {
    render(
      <QuotaTelemetryCard
        telemetry={mockTelemetry}
        config={mockConfigQuotaFree}
      />,
    );

    expect(screen.getByText('12,500')).toBeInTheDocument();
    expect(screen.getByText(/42 calls/i)).toBeInTheDocument();
    expect(screen.getByText(/Engine: gemini-3.5-flash-lite/i)).toBeInTheDocument();
    expect(screen.getByText(/Single AI Active/i)).toBeInTheDocument();
  });

  it('renders 1,500 RPD active badge and engine information', () => {
    render(
      <QuotaTelemetryCard
        telemetry={mockTelemetry}
        config={mockConfigQuotaFree}
      />,
    );

    expect(screen.getByText(/1,500 RPD Active/i)).toBeInTheDocument();
    expect(screen.getByText(/Google Gemini Free Tier \(1,500 RPD\)/i)).toBeInTheDocument();
  });
});

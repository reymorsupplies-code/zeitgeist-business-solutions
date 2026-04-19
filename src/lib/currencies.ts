export interface CurrencyConfig {
  code: string;
  name: string;
  symbol: string;
  locale: string;
  taxRate: number;
  country: string;
  countryName: string;
}

export const CARIBBEAN_CURRENCIES: CurrencyConfig[] = [
  { code: 'TTD', name: 'Trinidad & Tobago Dollar', symbol: 'TT$', locale: 'en-TT', taxRate: 0.125, country: 'TT', countryName: 'Trinidad & Tobago' },
  { code: 'JMD', name: 'Jamaican Dollar', symbol: 'J$', locale: 'en-JM', taxRate: 0.15, country: 'JM', countryName: 'Jamaica' },
  { code: 'BBD', name: 'Barbadian Dollar', symbol: 'Bds$', locale: 'en-BB', taxRate: 0.175, country: 'BB', countryName: 'Barbados' },
  { code: 'BZD', name: 'Belize Dollar', symbol: 'BZ$', locale: 'en-BZ', taxRate: 0.125, country: 'BZ', countryName: 'Belize' },
  { code: 'GYD', name: 'Guyanese Dollar', symbol: 'G$', locale: 'en-GY', taxRate: 0.14, country: 'GY', countryName: 'Guyana' },
  { code: 'USD', name: 'US Dollar', symbol: '$', locale: 'en-US', taxRate: 0.0, country: 'US', countryName: 'United States' },
  { code: 'EUR', name: 'Euro', symbol: '€', locale: 'en-EU', taxRate: 0.21, country: 'EU', countryName: 'Europe' },
  { code: 'GBP', name: 'British Pound', symbol: '£', locale: 'en-GB', taxRate: 0.20, country: 'GB', countryName: 'United Kingdom' },
];

export function getCurrencyConfig(code: string): CurrencyConfig {
  return CARIBBEAN_CURRENCIES.find(c => c.code === code) || CARIBBEAN_CURRENCIES[0];
}

export function formatCurrency(amount: number, currencyCode: string = 'TTD'): string {
  const config = getCurrencyConfig(currencyCode);
  return `${config.symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getTaxRateForCountry(countryCode: string): number {
  const config = CARIBBEAN_CURRENCIES.find(c => c.country === countryCode);
  return config?.taxRate || 0.125;
}

export function getCurrencyForCountry(countryCode: string): string {
  const config = CARIBBEAN_CURRENCIES.find(c => c.country === countryCode);
  return config?.code || 'TTD';
}

// Exchange rates (approximate, would be updated via API in production)
export const EXCHANGE_RATES: Record<string, number> = {
  TTD: 1,
  USD: 0.147,
  JMD: 23.1,
  BBD: 0.294,
  BZD: 0.294,
  GYD: 30.8,
  EUR: 0.136,
  GBP: 0.117,
};

export function convertCurrency(amount: number, from: string, to: string): number {
  if (from === to) return amount;
  const fromRate = EXCHANGE_RATES[from] || 1;
  const toRate = EXCHANGE_RATES[to] || 1;
  return (amount / fromRate) * toRate;
}

import { apiClient } from '../../lib/api-client';

export type PublicMerchant = {
  merchantId: string;
  merchantName: string;
  merchantTypes: string[];
  description: string | null;
  address: string | null;
};

export function getPublicMerchants(search = ''): Promise<PublicMerchant[]> {
  const params = new URLSearchParams({ limit: '10' });
  const normalizedSearch = search.trim();
  if (normalizedSearch) params.set('search', normalizedSearch);

  return apiClient.get<PublicMerchant[]>(
    `/api/v1/public/merchants?${params.toString()}`,
  );
}

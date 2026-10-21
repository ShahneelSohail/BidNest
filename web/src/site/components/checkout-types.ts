import type { ListItem } from '../lib/types';

export interface AddressFields {
  label: string;
  name: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postal: string;
  country: string;
}

export interface Address extends AddressFields {
  id: number;
}

export interface DeliveryOption {
  key: 'standard' | 'express';
  label: string;
  detail: string;
  cost: number;
}

export interface WonLot extends ListItem {
  seller: { id: number; username: string };
  paid: boolean;
}

export const formatAddress = (address: AddressFields) => [address.name, address.line1, address.line2, `${address.city}, ${address.region} ${address.postal}`, address.country].filter(Boolean).join(', ');

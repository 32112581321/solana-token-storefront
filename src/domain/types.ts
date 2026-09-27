export type ProductStatus = 'active' | 'draft';

export interface StorefrontConfig {
  schemaVersion: 1;
  storefront: {
    name: string;
    shortName: string;
    tagline: string;
    description: string;
    disclaimer: string;
    theme: {
      accent: string;
      background: string;
    };
  };
  payment: {
    enabled: boolean;
    network: 'devnet';
    recipient: string;
    token: {
      symbol: string;
      mint: string;
      decimals: number;
    };
    label: string;
    memoPrefix: string;
    blockedMints: string[];
  };
}

export interface CatalogImage {
  src: string;
  alt: string;
}

export interface OptionGroup {
  id: string;
  label: string;
  values: string[];
}

export interface ProductVariant {
  sku: string;
  options: Record<string, string>;
  tokenAmount: string;
  displayPrice?: string;
  available: boolean;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: ProductStatus;
  images: CatalogImage[];
  optionGroups: OptionGroup[];
  variants: ProductVariant[];
}

export interface Catalog {
  schemaVersion: 1;
  products: Product[];
}

export interface CartLine {
  sku: string;
  quantity: number;
}

export interface PersistedCart {
  version: 1;
  lines: CartLine[];
}

export interface ResolvedCartLine extends CartLine {
  product: Product;
  variant: ProductVariant;
  unitsEach: bigint;
  unitsTotal: bigint;
}

export interface PaymentIntent {
  cartFingerprint: string;
  reference: string;
  memo: string;
}

export interface ValidationResult<T> {
  data: T | null;
  errors: string[];
}

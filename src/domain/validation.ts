import { parseTokenAmount } from './amount';
import { isSolanaAddress } from './solana';
import type {
  Catalog,
  CatalogImage,
  OptionGroup,
  Product,
  ProductVariant,
  StorefrontConfig,
  ValidationResult,
} from './types';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const IDENTIFIER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SKU = /^[A-Z0-9][A-Z0-9._-]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonEmptyString);
}

export function validateStorefrontConfig(value: unknown): ValidationResult<StorefrontConfig> {
  const errors: string[] = [];
  if (!isRecord(value)) return { data: null, errors: ['Configuration must be a JSON object.'] };

  if (value.schemaVersion !== 1) errors.push('schemaVersion must be 1.');
  const storefront = value.storefront;
  if (!isRecord(storefront)) errors.push('storefront must be an object.');
  else {
    for (const field of ['name', 'shortName', 'tagline', 'description', 'disclaimer']) {
      if (!nonEmptyString(storefront[field])) errors.push(`storefront.${field} must be a non-empty string.`);
    }
    if (!isRecord(storefront.theme)) errors.push('storefront.theme must be an object.');
    else {
      if (!nonEmptyString(storefront.theme.accent) || !HEX_COLOR.test(storefront.theme.accent)) errors.push('storefront.theme.accent must be a six-digit hex color.');
      if (!nonEmptyString(storefront.theme.background) || !HEX_COLOR.test(storefront.theme.background)) errors.push('storefront.theme.background must be a six-digit hex color.');
    }
  }

  const payment = value.payment;
  if (!isRecord(payment)) errors.push('payment must be an object.');
  else {
    if (typeof payment.enabled !== 'boolean') errors.push('payment.enabled must be true or false.');
    if (payment.network !== 'devnet') errors.push('payment.network must be "devnet".');
    if (typeof payment.recipient !== 'string') errors.push('payment.recipient must be a string.');
    if (!nonEmptyString(payment.label)) errors.push('payment.label must be a non-empty string.');
    if (!nonEmptyString(payment.memoPrefix) || !/^[A-Z0-9-]{2,24}$/.test(payment.memoPrefix)) {
      errors.push('payment.memoPrefix must contain 2–24 uppercase letters, numbers, or hyphens.');
    }
    if (!Array.isArray(payment.blockedMints) || !payment.blockedMints.every((mint) => typeof mint === 'string' && isSolanaAddress(mint))) {
      errors.push('payment.blockedMints must contain only valid Solana addresses.');
    }
    if (!isRecord(payment.token)) errors.push('payment.token must be an object.');
    else {
      if (!nonEmptyString(payment.token.symbol) || payment.token.symbol.length > 12) errors.push('payment.token.symbol must contain 1–12 characters.');
      if (typeof payment.token.mint !== 'string') errors.push('payment.token.mint must be a string.');
      if (!Number.isInteger(payment.token.decimals) || Number(payment.token.decimals) < 0 || Number(payment.token.decimals) > 9) {
        errors.push('payment.token.decimals must be an integer from 0 through 9.');
      }
      if (typeof payment.token.mint === 'string' && payment.token.mint && !isSolanaAddress(payment.token.mint)) {
        errors.push('payment.token.mint must be a valid Solana address when provided.');
      }
      if (typeof payment.token.mint === 'string' && Array.isArray(payment.blockedMints) && payment.blockedMints.includes(payment.token.mint)) {
        errors.push('payment.token.mint is blocked for this devnet storefront.');
      }
    }
    if (typeof payment.recipient === 'string' && payment.recipient && !isSolanaAddress(payment.recipient)) {
      errors.push('payment.recipient must be a valid Solana address when provided.');
    }
    if (payment.enabled === true) {
      if (typeof payment.recipient !== 'string' || !isSolanaAddress(payment.recipient)) errors.push('Enabled payments require a valid payment.recipient.');
      const tokenMint = isRecord(payment.token) ? payment.token.mint : null;
      if (typeof tokenMint !== 'string' || !isSolanaAddress(tokenMint)) errors.push('Enabled payments require a valid payment.token.mint.');
    }
  }

  const inventory = value.inventory;
  if (inventory !== undefined) {
    if (!isRecord(inventory)) errors.push('inventory must be an object when provided.');
    else {
      if (inventory.mode !== 'static' && inventory.mode !== 'service') {
        errors.push('inventory.mode must be "static" or "service".');
      }
      if (inventory.reservationMinutes !== undefined
        && (!Number.isInteger(inventory.reservationMinutes)
          || Number(inventory.reservationMinutes) < 1
          || Number(inventory.reservationMinutes) > 120)) {
        errors.push('inventory.reservationMinutes must be an integer from 1 through 120.');
      }
      if (inventory.mode === 'service') {
        if (!nonEmptyString(inventory.serviceUrl)) errors.push('inventory.serviceUrl is required in service mode.');
        else {
          try {
            const url = new URL(inventory.serviceUrl);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocol');
            if (url.username || url.password || url.search || url.hash) throw new Error('components');
          } catch {
            errors.push('inventory.serviceUrl must be an absolute HTTP(S) URL without credentials, query, or fragment.');
          }
        }
      }
    }
  }

  return errors.length ? { data: null, errors } : { data: value as unknown as StorefrontConfig, errors: [] };
}

function validateImage(value: unknown, path: string, errors: string[]): value is CatalogImage {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return false;
  }
  if (!nonEmptyString(value.src) || !value.src.startsWith('./images/') || /^(?:https?:)?\/\//i.test(value.src)) {
    errors.push(`${path}.src must be a local path beginning with ./images/.`);
  }
  if (!nonEmptyString(value.alt)) errors.push(`${path}.alt must be a non-empty string.`);
  return true;
}

function validateOptionGroup(value: unknown, path: string, errors: string[]): value is OptionGroup {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return false;
  }
  if (!nonEmptyString(value.id) || !IDENTIFIER.test(value.id)) errors.push(`${path}.id must be a lowercase identifier.`);
  if (!nonEmptyString(value.label)) errors.push(`${path}.label must be a non-empty string.`);
  if (!stringArray(value.values) || value.values.length === 0) errors.push(`${path}.values must contain at least one string.`);
  else if (new Set(value.values).size !== value.values.length) errors.push(`${path}.values cannot contain duplicates.`);
  return true;
}

function validateVariant(
  value: unknown,
  path: string,
  groups: OptionGroup[],
  decimals: number,
  errors: string[],
): value is ProductVariant {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return false;
  }
  if (!nonEmptyString(value.sku) || !SKU.test(value.sku)) errors.push(`${path}.sku must use uppercase letters, numbers, dots, underscores, or hyphens.`);
  if (typeof value.available !== 'boolean') errors.push(`${path}.available must be true or false.`);
  if (!nonEmptyString(value.tokenAmount)) errors.push(`${path}.tokenAmount must be a decimal string.`);
  else {
    try {
      if (parseTokenAmount(value.tokenAmount, decimals) <= 0n) errors.push(`${path}.tokenAmount must be greater than zero.`);
    } catch (error) {
      errors.push(`${path}.tokenAmount: ${error instanceof Error ? error.message : 'invalid amount'}`);
    }
  }
  if (value.displayPrice !== undefined && !nonEmptyString(value.displayPrice)) errors.push(`${path}.displayPrice must be a non-empty string when provided.`);
  if (!isRecord(value.options)) errors.push(`${path}.options must be an object.`);
  else {
    const expectedIds = new Set(groups.map((group) => group.id));
    for (const group of groups) {
      const selected = value.options[group.id];
      if (typeof selected !== 'string' || !group.values.includes(selected)) errors.push(`${path}.options.${group.id} must select a declared value.`);
    }
    for (const optionId of Object.keys(value.options)) {
      if (!expectedIds.has(optionId)) errors.push(`${path}.options contains undeclared option ${optionId}.`);
    }
  }
  return true;
}

function validateProduct(value: unknown, index: number, decimals: number, errors: string[]): value is Product {
  const path = `products[${index}]`;
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return false;
  }
  for (const forbidden of ['source', 'url', 'href']) {
    if (forbidden in value) errors.push(`${path}.${forbidden} is not allowed; the storefront must not link to another shop.`);
  }
  if (!nonEmptyString(value.id) || !IDENTIFIER.test(value.id)) errors.push(`${path}.id must be a lowercase identifier.`);
  if (!nonEmptyString(value.slug) || !IDENTIFIER.test(value.slug)) errors.push(`${path}.slug must be a lowercase identifier.`);
  if (!nonEmptyString(value.name)) errors.push(`${path}.name must be a non-empty string.`);
  if (!nonEmptyString(value.description)) errors.push(`${path}.description must be a non-empty string.`);
  if (value.status !== 'active' && value.status !== 'draft') errors.push(`${path}.status must be active or draft.`);

  if (!Array.isArray(value.images) || value.images.length === 0) errors.push(`${path}.images must contain at least one local image.`);
  else value.images.forEach((image, imageIndex) => validateImage(image, `${path}.images[${imageIndex}]`, errors));

  const groups: OptionGroup[] = [];
  if (!Array.isArray(value.optionGroups)) errors.push(`${path}.optionGroups must be an array.`);
  else {
    value.optionGroups.forEach((group, groupIndex) => {
      if (validateOptionGroup(group, `${path}.optionGroups[${groupIndex}]`, errors)) groups.push(group);
    });
    const ids = groups.map((group) => group.id);
    if (new Set(ids).size !== ids.length) errors.push(`${path}.optionGroups cannot contain duplicate IDs.`);
  }

  if (!Array.isArray(value.variants)) errors.push(`${path}.variants must be an array.`);
  else {
    if (value.status === 'active' && value.variants.length === 0) errors.push(`${path} is active and requires at least one variant.`);
    value.variants.forEach((variant, variantIndex) => validateVariant(variant, `${path}.variants[${variantIndex}]`, groups, decimals, errors));
  }
  return true;
}

export function validateCatalog(value: unknown, decimals: number): ValidationResult<Catalog> {
  const errors: string[] = [];
  if (!isRecord(value)) return { data: null, errors: ['Catalog must be a JSON object.'] };
  if (value.schemaVersion !== 1) errors.push('schemaVersion must be 1.');
  if (!Array.isArray(value.products) || value.products.length === 0) {
    errors.push('products must contain at least one product.');
  } else {
    value.products.forEach((product, index) => validateProduct(product, index, decimals, errors));
    const records = value.products.filter(isRecord);
    const ids = records.map((product) => product.id).filter((id): id is string => typeof id === 'string');
    const slugs = records.map((product) => product.slug).filter((slug): slug is string => typeof slug === 'string');
    const skus = records.flatMap((product) => Array.isArray(product.variants)
      ? product.variants.filter(isRecord).map((variant) => variant.sku).filter((sku): sku is string => typeof sku === 'string')
      : []);
    if (new Set(ids).size !== ids.length) errors.push('Product IDs must be unique.');
    if (new Set(slugs).size !== slugs.length) errors.push('Product slugs must be unique.');
    if (new Set(skus).size !== skus.length) errors.push('Variant SKUs must be unique across the catalog.');
  }
  return errors.length ? { data: null, errors } : { data: value as unknown as Catalog, errors: [] };
}

import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateCatalog, validateStorefrontConfig } from '../src/domain/validation';

const repositoryRoot = resolve(import.meta.dirname, '..');
const publicRoot = resolve(repositoryRoot, 'public');

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'));
}

describe('checked-in public configuration', () => {
  it('contains a valid storefront, catalog, and local image for every product', async () => {
    const configResult = validateStorefrontConfig(await readJson(resolve(publicRoot, 'storefront.config.json')));
    expect(configResult.errors, configResult.errors.join('\n')).toEqual([]);
    expect(configResult.data).not.toBeNull();

    const catalogResult = validateCatalog(
      await readJson(resolve(publicRoot, 'catalog.json')),
      configResult.data!.payment.token.decimals,
    );
    expect(catalogResult.errors, catalogResult.errors.join('\n')).toEqual([]);
    expect(catalogResult.data).not.toBeNull();
    expect(catalogResult.data!.products.filter((product) => product.status === 'active')).toHaveLength(8);
    expect(catalogResult.data!.products.filter((product) => product.status === 'draft')).toHaveLength(3);

    for (const product of catalogResult.data!.products) {
      for (const image of product.images) {
        const imagePath = resolve(publicRoot, image.src.replace(/^\.\//, ''));
        expect(imagePath.startsWith(`${publicRoot}/`)).toBe(true);
        await expect(access(imagePath)).resolves.toBeUndefined();
      }
    }
  });
});

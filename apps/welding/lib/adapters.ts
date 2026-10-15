import type { CatalogBillOfMaterial, CatalogProduct } from './types';

export type DbProductLike = {
  id: string;
  name: string;
  shortDesc?: string | null;
  description?: string | null;
  specifications?: unknown;
  billOfMaterials?: unknown;
  images?: unknown;
  priceRange?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  priceCents?: number;
  unit?: string | null;
  category?: { name?: string | null } | null;
};

export function imagePathFromJson(images: unknown): string | undefined {
  if (!Array.isArray(images) || !images.length) return undefined;
  const first = images[0];
  if (typeof first === 'string') return first;
  if (first && typeof first === 'object') {
    const record = first as Record<string, unknown>;
    const value = record.url ?? record.src ?? record.imageUrl ?? record.path;
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
}

export function billOfMaterialsFromJson(product: DbProductLike): CatalogBillOfMaterial[] | undefined {
  const specifications = isRecord(product.specifications) ? product.specifications : undefined;
  const source = product.billOfMaterials ?? specifications?.billOfMaterials;
  if (!Array.isArray(source)) return undefined;
  return source.flatMap((item) => {
    if (typeof item === 'string') return [{ item }];
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const name = record.item ?? record.name ?? record.material;
    if (typeof name !== 'string') return [];
    return [{
      item: name,
      specification: typeof record.specification === 'string' ? record.specification : typeof record.spec === 'string' ? record.spec : undefined,
      quantity: typeof record.quantity === 'string' || typeof record.quantity === 'number' ? record.quantity : undefined,
      unit: typeof record.unit === 'string' ? record.unit : undefined,
    }];
  });
}

function visibleSpecifications(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  const { billOfMaterials: _billOfMaterials, ...specifications } = value;
  return Object.keys(specifications).length ? specifications : undefined;
}

export function mapWeldingProduct(product: DbProductLike): CatalogProduct {
  return {
    id: product.id,
    name: product.name,
    category: product.category?.name ?? 'Products',
    shortDescription: product.shortDesc ?? undefined,
    description: product.description ?? undefined,
    specifications: visibleSpecifications(product.specifications),
    billOfMaterials: billOfMaterialsFromJson(product),
    imagePath: imagePathFromJson(product.images),
    priceLabel: product.priceRange ?? undefined,
    minPrice: product.minPrice,
    maxPrice: product.maxPrice,
  };
}

export function mapDiyProduct(product: DbProductLike): CatalogProduct {
  return {
    id: product.id,
    name: product.name,
    category: product.category?.name ?? 'Products',
    shortDescription: product.shortDesc ?? undefined,
    description: product.description ?? undefined,
    specifications: visibleSpecifications(product.specifications),
    imagePath: imagePathFromJson(product.images),
    unit: product.unit,
    minPrice: product.priceCents == null ? undefined : product.priceCents / 100,
    maxPrice: product.priceCents == null ? undefined : product.priceCents / 100,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

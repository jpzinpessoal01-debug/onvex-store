export type Role = "CUSTOMER" | "ADMIN" | "SUPER_ADMIN";

export type ProductListItem = {
  id: number;
  name: string;
  slug: string;
  categoryId: number;
  categoryName: string;
  categorySlug: string;
  shortDescription: string;
  priceCents: number;
  salePriceCents: number | null;
  featured: boolean;
  isNew: boolean;
  salesCount: number;
  imageUrl: string | null;
  stock: number;
  minimumStock: number;
};

export type ProductVariantView = {
  id: number;
  sku: string;
  color: string;
  size: string;
  stock: number;
  minimumStock: number;
  priceAdjustmentCents: number;
  active: boolean;
};

export type ProductDetail = ProductListItem & {
  description: string;
  baseSku: string;
  brand: string;
  weightGrams: number;
  metaTitle: string | null;
  metaDescription: string | null;
  images: Array<{ id: number; url: string; alt: string; isPrimary: boolean }>;
  variants: ProductVariantView[];
  reviews: Array<{
    id: number;
    rating: number;
    comment: string;
    customerName: string;
    verifiedPurchase: boolean;
    createdAt: string;
  }>;
};

export type CartLine = {
  id: number;
  variantId: number;
  productId: number;
  productName: string;
  productSlug: string;
  categoryId: number;
  sku: string;
  color: string;
  size: string;
  quantity: number;
  stock: number;
  unitPriceCents: number;
  imageUrl: string | null;
  availableVariants: Array<{ id: number; color: string; size: string; stock: number }>;
};

export type CartView = {
  id: number;
  items: CartLine[];
  coupon: null | { code: string; type: "PERCENTAGE" | "FIXED"; value: number };
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  itemCount: number;
};

export type AppUser = {
  id: number;
  email: string;
  name: string;
  role: Role;
  phone: string | null;
  cpf: string | null;
};

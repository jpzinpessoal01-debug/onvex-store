import { AppError } from "./errors";

export type PricedLine = {
  productId: number;
  categoryId: number;
  unitPriceCents: number;
  quantity: number;
};

export type CouponRule = {
  type: "PERCENTAGE" | "FIXED";
  value: number;
  minimumCents: number;
  startsAt: string | null;
  endsAt: string | null;
  maximumUses: number | null;
  currentUses: number;
  active: boolean;
  productIds?: number[];
  categoryIds?: number[];
};

export type Totals = {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
};

export function effectivePrice(priceCents: number, salePriceCents: number | null): number {
  return salePriceCents != null && salePriceCents > 0 && salePriceCents < priceCents
    ? salePriceCents
    : priceCents;
}

export function validateCoupon(rule: CouponRule, subtotalCents: number, now = new Date()): void {
  if (!rule.active) throw new AppError(400, "Este cupom está inativo.", "COUPON_INACTIVE");
  if (rule.startsAt && now < new Date(rule.startsAt)) {
    throw new AppError(400, "Este cupom ainda não está disponível.", "COUPON_NOT_STARTED");
  }
  if (rule.endsAt && now > new Date(rule.endsAt)) {
    throw new AppError(400, "Este cupom expirou.", "COUPON_EXPIRED");
  }
  if (rule.maximumUses != null && rule.currentUses >= rule.maximumUses) {
    throw new AppError(400, "O limite de usos deste cupom foi atingido.", "COUPON_LIMIT");
  }
  if (subtotalCents < rule.minimumCents) {
    throw new AppError(
      400,
      `Este cupom exige um subtotal mínimo de R$ ${(rule.minimumCents / 100).toFixed(2).replace(".", ",")}.`,
      "COUPON_MINIMUM",
    );
  }
}

export function calculateDiscount(lines: PricedLine[], rule: CouponRule | null): number {
  if (!rule) return 0;
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
  validateCoupon(rule, subtotalCents);

  const eligibleSubtotal = lines.reduce((sum, line) => {
    const productAllowed = !rule.productIds?.length || rule.productIds.includes(line.productId);
    const categoryAllowed = !rule.categoryIds?.length || rule.categoryIds.includes(line.categoryId);
    return productAllowed && categoryAllowed
      ? sum + line.unitPriceCents * line.quantity
      : sum;
  }, 0);

  if (eligibleSubtotal <= 0) {
    throw new AppError(400, "Este cupom não se aplica aos itens do carrinho.", "COUPON_NOT_APPLICABLE");
  }

  const raw = rule.type === "PERCENTAGE"
    ? Math.floor((eligibleSubtotal * Math.min(rule.value, 100)) / 100)
    : rule.value;
  return Math.min(Math.max(raw, 0), eligibleSubtotal);
}

export function calculateTotals(
  lines: PricedLine[],
  coupon: CouponRule | null,
  shippingFlatCents: number,
  freeShippingFromCents: number,
): Totals {
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
  const discountCents = calculateDiscount(lines, coupon);
  const discountedSubtotal = subtotalCents - discountCents;
  const shippingCents = subtotalCents === 0 || discountedSubtotal >= freeShippingFromCents
    ? 0
    : Math.max(0, shippingFlatCents);
  return {
    subtotalCents,
    discountCents,
    shippingCents,
    totalCents: Math.max(0, discountedSubtotal + shippingCents),
  };
}

export function assertStock(stock: number, quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError(400, "Quantidade inválida.", "INVALID_QUANTITY");
  }
  if (quantity > stock) {
    throw new AppError(409, "A quantidade solicitada não está disponível em estoque.", "INSUFFICIENT_STOCK");
  }
}


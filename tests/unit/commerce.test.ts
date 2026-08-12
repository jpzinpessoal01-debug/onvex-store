import assert from "node:assert/strict";
import test from "node:test";
import { assertStock, calculateDiscount, calculateTotals, effectivePrice } from "../../lib/commerce";
import { canAccessAdmin } from "../../lib/permissions";

const lines = [
  { productId: 1, categoryId: 10, unitPriceCents: 58990, quantity: 1 },
  { productId: 2, categoryId: 11, unitPriceCents: 21990, quantity: 2 },
];

test("usa preço promocional apenas quando ele reduz o valor", () => {
  assert.equal(effectivePrice(64990, 58990), 58990);
  assert.equal(effectivePrice(64990, 69990), 64990);
  assert.equal(effectivePrice(64990, null), 64990);
});

test("recalcula subtotal, desconto, frete e total no servidor", () => {
  const totals = calculateTotals(lines, {
    type: "PERCENTAGE", value: 10, minimumCents: 30000, startsAt: null, endsAt: null,
    maximumUses: 100, currentUses: 2, active: true,
  }, 2490, 69900);
  assert.deepEqual(totals, { subtotalCents: 102970, discountCents: 10297, shippingCents: 0, totalCents: 92673 });
});

test("ignora qualquer total adulterado porque só usa linhas precificadas", () => {
  const clientSuppliedTotal = 1;
  const totals = calculateTotals(lines, null, 2490, 69900);
  assert.notEqual(totals.totalCents, clientSuppliedTotal);
  assert.equal(totals.totalCents, 102970);
});

test("rejeita cupom vencido", () => {
  assert.throws(() => calculateDiscount(lines, {
    type: "PERCENTAGE", value: 15, minimumCents: 0, startsAt: null, endsAt: "2020-01-01T00:00:00.000Z",
    maximumUses: null, currentUses: 0, active: true,
  }), /expirou/i);
});

test("limita cupom fixo ao subtotal elegível", () => {
  assert.equal(calculateDiscount(lines, {
    type: "FIXED", value: 999999, minimumCents: 0, startsAt: null, endsAt: null,
    maximumUses: null, currentUses: 0, active: true, productIds: [2],
  }), 43980);
});

test("impede quantidade maior que o estoque", () => {
  assert.doesNotThrow(() => assertStock(5, 5));
  assert.throws(() => assertStock(5, 6), /não está disponível/i);
});

test("RBAC separa cliente, admin e super admin", () => {
  assert.equal(canAccessAdmin("CUSTOMER"), false);
  assert.equal(canAccessAdmin("ADMIN"), true);
  assert.equal(canAccessAdmin("SUPER_ADMIN"), true);
  assert.equal(canAccessAdmin("ADMIN", true), false);
  assert.equal(canAccessAdmin("SUPER_ADMIN", true), true);
});


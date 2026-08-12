import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

function createDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  for (const name of ["0000_modern_mephistopheles.sql", "0001_low_guardsmen.sql", "0002_orange_shiva.sql", "0003_sour_psynapse.sql"]) {
    database.exec(readFileSync(new URL(`../../drizzle/${name}`, import.meta.url), "utf8"));
  }
  return database;
}

test("dois compradores não conseguem levar a última unidade", () => {
  const db = createDatabase();
  const productId = Number((db.prepare("SELECT id FROM products LIMIT 1").get() as { id: number }).id);
  db.prepare("INSERT INTO product_variants (product_id,sku,color,size,stock,minimum_stock,active) VALUES (?,?,?,?,?,?,1)")
    .run(productId, "TEST-LAST-UNIT", "Preto", "TEST", 1, 0);
  const variantId = Number((db.prepare("SELECT id FROM product_variants WHERE sku='TEST-LAST-UNIT'").get() as { id: number }).id);

  db.prepare("UPDATE product_variants SET stock=stock-1 WHERE id=?").run(variantId);
  assert.throws(() => db.prepare("UPDATE product_variants SET stock=stock-1 WHERE id=?").run(variantId), /CHECK constraint failed/i);
  assert.equal((db.prepare("SELECT stock FROM product_variants WHERE id=?").get(variantId) as { stock: number }).stock, 0);
});

test("reposição atualiza a variante e mantém histórico imutável", () => {
  const db = createDatabase();
  const variant = db.prepare("SELECT id,product_id,stock FROM product_variants LIMIT 1").get() as { id:number; product_id:number; stock:number };
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("INSERT INTO inventory_movements (product_id,variant_id,quantity_before,quantity_changed,quantity_after,type,note) VALUES (?,?,?,?,?,'RESTOCK','Reposição fornecedor')").run(variant.product_id, variant.id, variant.stock, 20, variant.stock + 20);
    db.prepare("UPDATE product_variants SET stock=stock+20 WHERE id=?").run(variant.id);
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
  assert.equal((db.prepare("SELECT stock FROM product_variants WHERE id=?").get(variant.id) as { stock:number }).stock, variant.stock + 20);
  const movement = db.prepare("SELECT quantity_before,quantity_changed,quantity_after,type FROM inventory_movements WHERE variant_id=? ORDER BY id DESC LIMIT 1").get(variant.id) as { quantity_before:number; quantity_changed:number; quantity_after:number; type:string };
  assert.equal(movement.quantity_before, variant.stock);
  assert.equal(movement.quantity_changed, 20);
  assert.equal(movement.quantity_after, variant.stock + 20);
  assert.equal(movement.type, "RESTOCK");
});

test("idempotência impede pagamento e webhook duplicados", () => {
  const db = createDatabase();
  const userId = Number(db.prepare("INSERT INTO users (email,name) VALUES ('test@onvex.local','Teste') RETURNING id").get()!.id);
  const orderId = Number(db.prepare("INSERT INTO orders (order_number,user_id,customer_name,customer_email,customer_phone,subtotal_cents,discount_cents,shipping_cents,total_cents,payment_method,address_snapshot) VALUES ('ONV-TEST-1',?,?,?,?,0,0,0,0,'PIX','{}') RETURNING id").get(userId, "Teste", "test@onvex.local", "00000000000")!.id);
  db.prepare("INSERT INTO payments (order_id,gateway,method,amount_cents,idempotency_key) VALUES (?,?,?,?,?)").run(orderId, "TEST", "PIX", 100, "idem-1");
  assert.throws(() => db.prepare("INSERT INTO payments (order_id,gateway,method,amount_cents,idempotency_key) VALUES (?,?,?,?,?)").run(orderId, "TEST", "PIX", 100, "idem-1"), /UNIQUE constraint failed/i);
  db.prepare("INSERT INTO webhook_events (event_id,provider,payload_hash) VALUES ('evt-1','TEST','hash')").run();
  assert.throws(() => db.prepare("INSERT INTO webhook_events (event_id,provider,payload_hash) VALUES ('evt-1','TEST','hash')").run(), /UNIQUE constraint failed/i);
});

test("reserva transacional impede ultrapassar o limite de cupom", () => {
  const db = createDatabase();
  const firstUserId = Number(db.prepare("INSERT INTO users (email,name) VALUES ('cupom1@onvex.local','Cupom 1') RETURNING id").get()!.id);
  const secondUserId = Number(db.prepare("INSERT INTO users (email,name) VALUES ('cupom2@onvex.local','Cupom 2') RETURNING id").get()!.id);
  const couponId = Number(db.prepare("INSERT INTO coupons (code,type,value,maximum_uses,uses_per_customer) VALUES ('LIMITADO','PERCENTAGE',10,1,1) RETURNING id").get()!.id);
  const firstOrderId = Number(db.prepare("INSERT INTO orders (order_number,user_id,customer_name,customer_email,customer_phone,subtotal_cents,discount_cents,shipping_cents,total_cents,payment_method,address_snapshot) VALUES ('ONV-COUPON-1',?,?,?,?,1000,100,0,900,'PIX','{}') RETURNING id").get(firstUserId, "Cupom 1", "cupom1@onvex.local", "00000000000")!.id);
  const secondOrderId = Number(db.prepare("INSERT INTO orders (order_number,user_id,customer_name,customer_email,customer_phone,subtotal_cents,discount_cents,shipping_cents,total_cents,payment_method,address_snapshot) VALUES ('ONV-COUPON-2',?,?,?,?,1000,100,0,900,'PIX','{}') RETURNING id").get(secondUserId, "Cupom 2", "cupom2@onvex.local", "00000000000")!.id);

  const reserve = db.prepare(`INSERT INTO coupon_usages (coupon_id,user_id,order_id)
    VALUES (
      (SELECT c.id FROM coupons AS c
       WHERE c.id=? AND c.active=1
         AND (c.maximum_uses IS NULL OR c.current_uses<c.maximum_uses)
         AND (SELECT count(*) FROM coupon_usages AS u WHERE u.coupon_id=c.id AND u.user_id=?)<c.uses_per_customer),
      ?,?
    )`);
  db.exec("BEGIN IMMEDIATE");
  reserve.run(couponId, firstUserId, firstUserId, firstOrderId);
  db.prepare("UPDATE coupons SET current_uses=current_uses+1 WHERE id=?").run(couponId);
  db.exec("COMMIT");
  assert.equal((db.prepare("SELECT current_uses FROM coupons WHERE id=?").get(couponId) as { current_uses: number }).current_uses, 1);
  assert.throws(
    () => reserve.run(couponId, secondUserId, secondUserId, secondOrderId),
    /NOT NULL constraint failed/i,
  );
  db.prepare("DELETE FROM coupon_usages WHERE order_id=?").run(firstOrderId);
  db.prepare("UPDATE coupons SET current_uses=max(current_uses-1,0) WHERE id=?").run(couponId);
  assert.equal((db.prepare("SELECT current_uses FROM coupons WHERE id=?").get(couponId) as { current_uses: number }).current_uses, 0);
});

test("snapshot do pedido não muda quando o produto é editado", () => {
  const db = createDatabase();
  const product = db.prepare("SELECT id,name,slug FROM products LIMIT 1").get() as { id:number; name:string; slug:string };
  const variant = db.prepare("SELECT id,sku,color,size FROM product_variants WHERE product_id=? LIMIT 1").get(product.id) as { id:number; sku:string; color:string; size:string };
  const userId = Number(db.prepare("INSERT INTO users (email,name) VALUES ('snapshot@onvex.local','Snapshot') RETURNING id").get()!.id);
  const orderId = Number(db.prepare("INSERT INTO orders (order_number,user_id,customer_name,customer_email,customer_phone,subtotal_cents,discount_cents,shipping_cents,total_cents,payment_method,address_snapshot) VALUES ('ONV-SNAPSHOT',?,?,?,?,100,0,0,100,'PIX','{}') RETURNING id").get(userId, "Snapshot", "snapshot@onvex.local", "00000000000")!.id);
  db.prepare("INSERT INTO order_items (order_id,product_id,variant_id,product_name,product_slug,sku,color,size,unit_price_cents,quantity,total_cents) VALUES (?,?,?,?,?,?,?,?,100,1,100)").run(orderId, product.id, variant.id, product.name, product.slug, variant.sku, variant.color, variant.size);
  db.prepare("UPDATE products SET name='Nome novo',price_cents=999999 WHERE id=?").run(product.id);
  const snapshot = db.prepare("SELECT product_name,unit_price_cents FROM order_items WHERE order_id=?").get(orderId) as { product_name:string; unit_price_cents:number };
  assert.equal(snapshot.product_name, product.name);
  assert.equal(snapshot.unit_price_cents, 100);
});

-- Ajuste comercial solicitado para a coleção principal ONVEX.
-- Os três itens principais ficam em aproximadamente R$ 240 no total promocional.
UPDATE products
SET price_cents = 12500, sale_price_cents = 11990, updated_at = CURRENT_TIMESTAMP::text
WHERE slug = 'rash-guard-onvex-performance';

UPDATE products
SET price_cents = 8500, sale_price_cents = 7990, updated_at = CURRENT_TIMESTAMP::text
WHERE slug = 'fight-shorts-onvex';

UPDATE products
SET price_cents = 4000, sale_price_cents = 3990, updated_at = CURRENT_TIMESTAMP::text
WHERE slug = 'garrafa-onvex-thermal';

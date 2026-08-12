-- Small ONVEX launch catalog. Products are intentionally data-driven so the
-- admin panel can edit them after the first deploy.

INSERT INTO categories (name, slug, description, sort_order, active)
VALUES
  ('Rash Guards', 'rash-guards', 'Compressão, mobilidade e secagem rápida para cada rola.', 1, 1),
  ('Shorts de luta', 'shorts', 'Liberdade de movimento para treino e competição.', 2, 1),
  ('Acessórios', 'acessorios', 'Detalhes ONVEX para a rotina dentro e fora do tatame.', 3, 1)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  active = 1,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP::text;

INSERT INTO products (category_id, name, slug, short_description, description, brand, base_sku, price_cents, sale_price_cents, weight_grams, active, featured, is_new, sales_count, meta_title, meta_description)
SELECT c.id, 'Rash Guard ONVEX Performance', 'rash-guard-onvex-performance', 'Compressão estratégica para rolar sem distrações.', 'Malha elástica de secagem rápida, costuras planas e barra com aderência sutil para manter a peça no lugar durante o treino.', 'ONVEX', 'RG-PERF', 24990, 21990, 250, 1, 1, 1, 154, 'Rash Guard ONVEX Performance', 'Rash guard premium ONVEX para Jiu-Jitsu.'
FROM categories c WHERE c.slug = 'rash-guards'
ON CONFLICT (slug) DO UPDATE SET category_id = EXCLUDED.category_id, active = 1, featured = 1, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP::text;

INSERT INTO products (category_id, name, slug, short_description, description, brand, base_sku, price_cents, sale_price_cents, weight_grams, active, featured, is_new, sales_count, meta_title, meta_description)
SELECT c.id, 'Fight Shorts ONVEX', 'fight-shorts-onvex', 'Liberdade total em quedas, passagens e raspagens.', 'Tecido leve com elasticidade multidirecional, cós firme e acabamento sem bolsos ou peças metálicas.', 'ONVEX', 'SHORT-FIGHT', 27990, NULL, 300, 1, 1, 0, 88, 'Fight Shorts ONVEX', 'Shorts técnico ONVEX para grappling e Jiu-Jitsu.'
FROM categories c WHERE c.slug = 'shorts'
ON CONFLICT (slug) DO UPDATE SET category_id = EXCLUDED.category_id, active = 1, featured = 1, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP::text;

INSERT INTO products (category_id, name, slug, short_description, description, brand, base_sku, price_cents, sale_price_cents, weight_grams, active, featured, is_new, sales_count, meta_title, meta_description)
SELECT c.id, 'Garrafa ONVEX Thermal', 'garrafa-onvex-thermal', 'Hidratação premium para acompanhar cada treino.', 'Garrafa térmica ONVEX com acabamento preto fosco, tampa metálica e construção pensada para a rotina dentro e fora do tatame.', 'ONVEX', 'BOT-THERMAL', 8990, 7490, 380, 1, 1, 1, 37, 'Garrafa ONVEX Thermal', 'Garrafa térmica preta ONVEX para treino e rotina.'
FROM categories c WHERE c.slug = 'acessorios'
ON CONFLICT (slug) DO UPDATE SET category_id = EXCLUDED.category_id, active = 1, featured = 1, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP::text;

INSERT INTO products (category_id, name, slug, short_description, description, brand, base_sku, price_cents, sale_price_cents, weight_grams, active, featured, is_new, sales_count, meta_title, meta_description)
SELECT c.id, 'Chaveiro ONVEX Metal', 'chaveiro-onvex-metal', 'Um detalhe ONVEX para levar com você.', 'Chaveiro metálico com acabamento preto e prata, formato compacto e argola reforçada para mochila, bolsa ou chaveiro do carro.', 'ONVEX', 'KEY-METAL', 3990, NULL, 80, 1, 1, 1, 24, 'Chaveiro ONVEX Metal', 'Chaveiro metálico ONVEX em preto e prata.'
FROM categories c WHERE c.slug = 'acessorios'
ON CONFLICT (slug) DO UPDATE SET category_id = EXCLUDED.category_id, active = 1, featured = 1, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP::text;

INSERT INTO products (category_id, name, slug, short_description, description, brand, base_sku, price_cents, sale_price_cents, weight_grams, active, featured, is_new, sales_count, meta_title, meta_description)
SELECT c.id, 'Mochila ONVEX Training', 'mochila-onvex-training', 'Organização e presença para a rotina de treino.', 'Mochila técnica ONVEX em tecido preto resistente, compartimentos funcionais, zíperes metálicos e espaço para kimono, rash guard e acessórios.', 'ONVEX', 'BAG-TRAIN', 19990, 16990, 900, 1, 1, 1, 19, 'Mochila ONVEX Training', 'Mochila técnica preta ONVEX para Jiu-Jitsu e treino.'
FROM categories c WHERE c.slug = 'acessorios'
ON CONFLICT (slug) DO UPDATE SET category_id = EXCLUDED.category_id, active = 1, featured = 1, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP::text;

INSERT INTO product_images (product_id, url, alt, sort_order, is_primary)
SELECT p.id, v.url, v.alt, 0, 1
FROM (VALUES
  ('rash-guard-onvex-performance', '/onvex-rash-guard.png', 'Rash Guard ONVEX Performance em estúdio'),
  ('fight-shorts-onvex', '/onvex-fight-shorts.png', 'Fight Shorts ONVEX em estúdio'),
  ('garrafa-onvex-thermal', '/onvex-bottle.png', 'Garrafa ONVEX Thermal em estúdio'),
  ('chaveiro-onvex-metal', '/onvex-keychain.png', 'Chaveiro ONVEX Metal em estúdio'),
  ('mochila-onvex-training', '/onvex-backpack.png', 'Mochila ONVEX Training em estúdio')
) AS v(slug, url, alt)
JOIN products p ON p.slug = v.slug
WHERE NOT EXISTS (SELECT 1 FROM product_images i WHERE i.product_id = p.id AND i.is_primary = 1);

INSERT INTO product_variants (product_id, sku, color, size, stock, minimum_stock, active)
SELECT p.id, v.sku, v.color, v.size, v.stock, v.minimum_stock, 1
FROM (VALUES
  ('rash-guard-onvex-performance', 'RG-PERF-BLK-P', 'Preto', 'P', 11, 4),
  ('rash-guard-onvex-performance', 'RG-PERF-BLK-M', 'Preto', 'M', 18, 5),
  ('rash-guard-onvex-performance', 'RG-PERF-BLK-G', 'Preto', 'G', 7, 5),
  ('rash-guard-onvex-performance', 'RG-PERF-BLK-GG', 'Preto', 'GG', 3, 4),
  ('rash-guard-onvex-performance', 'RG-PERF-GRF-P', 'Grafite', 'P', 6, 4),
  ('rash-guard-onvex-performance', 'RG-PERF-GRF-M', 'Grafite', 'M', 9, 5),
  ('rash-guard-onvex-performance', 'RG-PERF-GRF-G', 'Grafite', 'G', 4, 5),
  ('rash-guard-onvex-performance', 'RG-PERF-GRF-GG', 'Grafite', 'GG', 2, 4),
  ('fight-shorts-onvex', 'SHORT-FIGHT-BLK-P', 'Preto', 'P', 8, 4),
  ('fight-shorts-onvex', 'SHORT-FIGHT-BLK-M', 'Preto', 'M', 14, 5),
  ('fight-shorts-onvex', 'SHORT-FIGHT-BLK-G', 'Preto', 'G', 6, 5),
  ('fight-shorts-onvex', 'SHORT-FIGHT-BLK-GG', 'Preto', 'GG', 3, 4),
  ('garrafa-onvex-thermal', 'BOT-THERMAL-BLK-UN', 'Preto', 'Único', 20, 4),
  ('chaveiro-onvex-metal', 'KEY-METAL-SLV-UN', 'Preto / Prata', 'Único', 30, 6),
  ('mochila-onvex-training', 'BAG-TRAIN-BLK-UN', 'Preto', 'Único', 12, 3)
) AS v(slug, sku, color, size, stock, minimum_stock)
JOIN products p ON p.slug = v.slug
ON CONFLICT (sku) DO NOTHING;

INSERT INTO banners (title, description, image_url, link, sort_order, active)
SELECT 'DOMINE CADA ROLAMENTO.', 'Produtos desenvolvidos para quem vive o Jiu-Jitsu.', '/onvex-hero.png', '/loja', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM banners WHERE active = 1);

INSERT INTO store_settings (key, value)
VALUES
  ('store_name', 'ONVEX'),
  ('hero_title', 'DOMINE CADA ROLAMENTO.'),
  ('hero_subtitle', 'Produtos desenvolvidos para quem vive o Jiu-Jitsu.'),
  ('footer_text', 'Equipamentos para quem leva cada rola a sério. Performance, resistência e identidade no tatame.'),
  ('support_email', 'contato@onvex.com.br'),
  ('support_phone', '(00) 00000-0000'),
  ('shipping_flat_cents', '2490'),
  ('express_shipping_cents', '4990'),
  ('free_shipping_from_cents', '69900'),
  ('cpf_required', 'false'),
  ('size_guide', '[{"size":"P","height":"155–170 cm","weight":"50–70 kg"},{"size":"M","height":"165–180 cm","weight":"65–85 kg"},{"size":"G","height":"175–190 cm","weight":"80–100 kg"},{"size":"GG","height":"185–200 cm","weight":"95–120 kg"}]')
ON CONFLICT (key) DO NOTHING;

INSERT INTO coupons (code, type, value, minimum_cents, starts_at, ends_at, maximum_uses, uses_per_customer, current_uses, active)
VALUES ('ONVEX10', 'PERCENTAGE', 10, 30000, '2026-01-01T00:00:00.000Z', '2028-12-31T23:59:59.000Z', 500, 1, 0, 1)
ON CONFLICT (code) DO NOTHING;

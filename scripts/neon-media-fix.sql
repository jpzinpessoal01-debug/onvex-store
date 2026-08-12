-- Repair media URLs and keep production product imagery aligned with public assets.
UPDATE product_images SET url = '/onvex-rash-guard.webp' WHERE url = '/onvex-rash-guard.png';
UPDATE product_images SET url = '/onvex-fight-shorts.webp' WHERE url = '/onvex-fight-shorts.png';
UPDATE product_images SET url = '/onvex-bottle.webp' WHERE url = '/onvex-bottle.png';
UPDATE product_images SET url = '/onvex-keychain-new.webp' WHERE url IN ('/onvex-keychain.png', '/onvex-keychain.webp');
UPDATE product_images SET url = '/onvex-backpack.webp' WHERE url = '/onvex-backpack.png';
UPDATE banners SET image_url = '/onvex-hero.webp' WHERE image_url = '/onvex-hero.png';

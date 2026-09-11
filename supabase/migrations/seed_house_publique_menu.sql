-- ==============================================================================
-- 🏛️ HOUSE PUBLIQUE — SCRIPT D'IMPORTATION DU MENU COMPLET (10 Catégories & 148 Produits)
-- Monnaie: Dirham Marocain (DH / MAD)
-- Exécutable directement dans l'éditeur SQL de Supabase (Idempotent: ne crée pas de doublons)
-- ==============================================================================

DO $$
DECLARE
  v_cat_id uuid;
BEGIN

  -- --------------------------------------------------------------------------
  -- Catégorie: Petit Déjeuner
  -- --------------------------------------------------------------------------
  SELECT id INTO v_cat_id FROM categories WHERE name = 'Petit Déjeuner' LIMIT 1;
  IF v_cat_id IS NULL THEN
    INSERT INTO categories (name, description) VALUES ('Petit Déjeuner', 'Le réveil gourmand & brunch - فطور الصباح والبرانش') RETURNING id INTO v_cat_id;
  ELSE
    UPDATE categories SET description = 'Le réveil gourmand & brunch - فطور الصباح والبرانش' WHERE id = v_cat_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Formule Français' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Formule Français', 'Assortiments de 3 mini viennoiseries, Nutella, confiture, boisson chaude au choix, jus fait maison, eau minérale.', 35, true);
  ELSE
    UPDATE products SET base_price = 35, description = 'Assortiments de 3 mini viennoiseries, Nutella, confiture, boisson chaude au choix, jus fait maison, eau minérale.' WHERE name = 'Formule Français' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Formule Traditionnel' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Formule Traditionnel', 'Harcha, baghrir, rghayef, miel, amlou, beurre, fromage traditionnel, huile d''olive, olive, boisson chaude, eau minérale, jus fait maison.', 40, true);
  ELSE
    UPDATE products SET base_price = 40, description = 'Harcha, baghrir, rghayef, miel, amlou, beurre, fromage traditionnel, huile d''olive, olive, boisson chaude, eau minérale, jus fait maison.' WHERE name = 'Formule Traditionnel' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Formule Tétouani' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Formule Tétouani', 'Deux oeufs au choix, assortiment de charcuterie, mortadelle, la Vache qui rit, fromage traditionnel, huile d''olive, olive, boisson chaude, eau minérale, jus fait maison.', 42, true);
  ELSE
    UPDATE products SET base_price = 42, description = 'Deux oeufs au choix, assortiment de charcuterie, mortadelle, la Vache qui rit, fromage traditionnel, huile d''olive, olive, boisson chaude, eau minérale, jus fait maison.' WHERE name = 'Formule Tétouani' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Formule Fassi' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Formule Fassi', 'Deux oeufs au choix, khlie artisanal, olive, huile d''olive, boisson chaude, eau minérale, jus fait maison.', 45, true);
  ELSE
    UPDATE products SET base_price = 45, description = 'Deux oeufs au choix, khlie artisanal, olive, huile d''olive, boisson chaude, eau minérale, jus fait maison.' WHERE name = 'Formule Fassi' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Formule Espagnol' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Formule Espagnol', 'Toast aux céréales grillé, tomate, épices, fromage manchego, tapenade, thon, avocat, huile d''olive, olive, jus fait maison, eau minérale.', 45, true);
  ELSE
    UPDATE products SET base_price = 45, description = 'Toast aux céréales grillé, tomate, épices, fromage manchego, tapenade, thon, avocat, huile d''olive, olive, jus fait maison, eau minérale.' WHERE name = 'Formule Espagnol' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Formule Fitness' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Formule Fitness', 'Bol de yaourt fait maison, fruits de saison, pain grillé, tapenade, fromage traditionnel, mini detox.', 50, true);
  ELSE
    UPDATE products SET base_price = 50, description = 'Bol de yaourt fait maison, fruits de saison, pain grillé, tapenade, fromage traditionnel, mini detox.' WHERE name = 'Formule Fitness' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Formule British' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Formule British', 'Deux oeufs au choix, saucisse grillée, haricots rouges, tomate, champignons, dinde fumée, fromage edam, eau minérale, jus fait maison, huile d''olive, olive.', 55, true);
  ELSE
    UPDATE products SET base_price = 55, description = 'Deux oeufs au choix, saucisse grillée, haricots rouges, tomate, champignons, dinde fumée, fromage edam, eau minérale, jus fait maison, huile d''olive, olive.' WHERE name = 'Formule British' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Formule La Casa' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Formule La Casa', 'Pain céréales grillé, assortiments de charcuterie, oeufs à la coque, fromage traditionnel, Kiri, beurre, confiture, bol de yaourt, fruits de saison, huile d''olive, olive, eau minérale, jus fait maison.', 50, true);
  ELSE
    UPDATE products SET base_price = 50, description = 'Pain céréales grillé, assortiments de charcuterie, oeufs à la coque, fromage traditionnel, Kiri, beurre, confiture, bol de yaourt, fruits de saison, huile d''olive, olive, eau minérale, jus fait maison.' WHERE name = 'Formule La Casa' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Formule Brunch' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Formule Brunch', 'Toast céréales au fromage, assortiments de 2 viennoiseries, pancakes, assortiments de pain, omelette nature, pain perdu nature, bol de yaourt, fruits de saison, huile d''olive, olive, eau minérale, jus fait maison ou mini detox.', 60, true);
  ELSE
    UPDATE products SET base_price = 60, description = 'Toast céréales au fromage, assortiments de 2 viennoiseries, pancakes, assortiments de pain, omelette nature, pain perdu nature, bol de yaourt, fruits de saison, huile d''olive, olive, eau minérale, jus fait maison ou mini detox.' WHERE name = 'Formule Brunch' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Mqila Chakchouka' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Mqila Chakchouka', '2 Oeufs et tomates chakchouka aux épices.', 22, true);
  ELSE
    UPDATE products SET base_price = 22, description = '2 Oeufs et tomates chakchouka aux épices.' WHERE name = 'Mqila Chakchouka' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Mqila Légumes Sautés' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Mqila Légumes Sautés', '2 Oeufs aux légumes de saison sautés.', 25, true);
  ELSE
    UPDATE products SET base_price = 25, description = '2 Oeufs aux légumes de saison sautés.' WHERE name = 'Mqila Légumes Sautés' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Mqila Charcuterie' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Mqila Charcuterie', '2 Oeufs poêlés à la charcuterie fine.', 28, true);
  ELSE
    UPDATE products SET base_price = 28, description = '2 Oeufs poêlés à la charcuterie fine.' WHERE name = 'Mqila Charcuterie' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Mqila Saucisse' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Mqila Saucisse', '2 Oeufs à la saucisse grillée.', 30, true);
  ELSE
    UPDATE products SET base_price = 30, description = '2 Oeufs à la saucisse grillée.' WHERE name = 'Mqila Saucisse' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Mqila Crevettes' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Mqila Crevettes', '2 Oeufs aux crevettes fraîches persillées.', 32, true);
  ELSE
    UPDATE products SET base_price = 32, description = '2 Oeufs aux crevettes fraîches persillées.' WHERE name = 'Mqila Crevettes' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Omelette Nature / Herbes' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Omelette Nature / Herbes', 'Oeufs frais battus, herbes aromatiques.', 18, true);
  ELSE
    UPDATE products SET base_price = 18, description = 'Oeufs frais battus, herbes aromatiques.' WHERE name = 'Omelette Nature / Herbes' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Omelette Fromage Edam' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Omelette Fromage Edam', 'Oeufs fondants au fromage Edam.', 22, true);
  ELSE
    UPDATE products SET base_price = 22, description = 'Oeufs fondants au fromage Edam.' WHERE name = 'Omelette Fromage Edam' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Omelette Dinde & Fromage' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Omelette Dinde & Fromage', 'Dinde fumée savoureuse et fromage fondu.', 24, true);
  ELSE
    UPDATE products SET base_price = 24, description = 'Dinde fumée savoureuse et fromage fondu.' WHERE name = 'Omelette Dinde & Fromage' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Omelette Végétarienne' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Omelette Végétarienne', 'Légumes frais sautés et herbes.', 24, true);
  ELSE
    UPDATE products SET base_price = 24, description = 'Légumes frais sautés et herbes.' WHERE name = 'Omelette Végétarienne' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Omelette aux Champignons' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Omelette aux Champignons', 'Champignons frais dorés au beurre.', 24, true);
  ELSE
    UPDATE products SET base_price = 24, description = 'Champignons frais dorés au beurre.' WHERE name = 'Omelette aux Champignons' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Omelette au Thon' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Omelette au Thon', 'Thon de qualité et herbes fraîches.', 28, true);
  ELSE
    UPDATE products SET base_price = 28, description = 'Thon de qualité et herbes fraîches.' WHERE name = 'Omelette au Thon' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Omelette au Khlie' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Omelette au Khlie', 'Khlie artisanal traditionnel marocain.', 30, true);
  ELSE
    UPDATE products SET base_price = 30, description = 'Khlie artisanal traditionnel marocain.' WHERE name = 'Omelette au Khlie' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Omelette aux Crevettes' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Omelette aux Crevettes', 'Crevettes sautées à l''ail et persil.', 30, true);
  ELSE
    UPDATE products SET base_price = 30, description = 'Crevettes sautées à l''ail et persil.' WHERE name = 'Omelette aux Crevettes' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Smashed Avocado' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Smashed Avocado', 'Toast aux céréales, crème de fromage, guacamole frais maison (avocat écrasé, tomate, citron, Tabasco).', 30, true);
  ELSE
    UPDATE products SET base_price = 30, description = 'Toast aux céréales, crème de fromage, guacamole frais maison (avocat écrasé, tomate, citron, Tabasco).' WHERE name = 'Smashed Avocado' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Scramble Avocado' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Scramble Avocado', 'Toast aux céréales, crème de fromage, guacamole maison et oeufs brouillés crémeux.', 35, true);
  ELSE
    UPDATE products SET base_price = 35, description = 'Toast aux céréales, crème de fromage, guacamole maison et oeufs brouillés crémeux.' WHERE name = 'Scramble Avocado' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Scramble Avocado Saumon' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Scramble Avocado Saumon', 'Toast aux céréales, crème de fromage, guacamole, oeufs brouillés crémeux et tranches de saumon fumé.', 45, true);
  ELSE
    UPDATE products SET base_price = 45, description = 'Toast aux céréales, crème de fromage, guacamole, oeufs brouillés crémeux et tranches de saumon fumé.' WHERE name = 'Scramble Avocado Saumon' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Uitsmijter Amsterdam' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Uitsmijter Amsterdam', 'Pain burger, 2 oeufs au plat, dinde fumée, crème de fromage, fromage Edam.', 26, true);
  ELSE
    UPDATE products SET base_price = 26, description = 'Pain burger, 2 oeufs au plat, dinde fumée, crème de fromage, fromage Edam.' WHERE name = 'Uitsmijter Amsterdam' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Uitsmijter Rotterdam' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Uitsmijter Rotterdam', 'Pain burger, 2 oeufs au plat, crème de fromage, suprême de dinde, salami, Edam.', 28, true);
  ELSE
    UPDATE products SET base_price = 28, description = 'Pain burger, 2 oeufs au plat, crème de fromage, suprême de dinde, salami, Edam.' WHERE name = 'Uitsmijter Rotterdam' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Uitsmijter Salmon' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Uitsmijter Salmon', 'Pain burger, 2 oeufs au plat, crème de fromage, fromage Edam, saumon fumé.', 45, true);
  ELSE
    UPDATE products SET base_price = 45, description = 'Pain burger, 2 oeufs au plat, crème de fromage, fromage Edam, saumon fumé.' WHERE name = 'Uitsmijter Salmon' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Petit Déjeuner Chamali 1' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Petit Déjeuner Chamali 1', 'Pain complet, œuf frais, fromage traditionnel du Nord, huile d''olive vierge.', 14, true);
  ELSE
    UPDATE products SET base_price = 14, description = 'Pain complet, œuf frais, fromage traditionnel du Nord, huile d''olive vierge.' WHERE name = 'Petit Déjeuner Chamali 1' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Petit Déjeuner Chamali 2' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Petit Déjeuner Chamali 2', 'Pain complet, œuf, fromage traditionnel, fromage edam, huile d''olive.', 16, true);
  ELSE
    UPDATE products SET base_price = 16, description = 'Pain complet, œuf, fromage traditionnel, fromage edam, huile d''olive.' WHERE name = 'Petit Déjeuner Chamali 2' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Petit Déjeuner Chamali 3' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Petit Déjeuner Chamali 3', 'Pain complet, œuf, fromage traditionnel, edam, dinde fumée, huile d''olive.', 18, true);
  ELSE
    UPDATE products SET base_price = 18, description = 'Pain complet, œuf, fromage traditionnel, edam, dinde fumée, huile d''olive.' WHERE name = 'Petit Déjeuner Chamali 3' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Croque Fromage Edam' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Croque Fromage Edam', 'Pain toasté doré au four, fromage Edam fondant.', 22, true);
  ELSE
    UPDATE products SET base_price = 22, description = 'Pain toasté doré au four, fromage Edam fondant.' WHERE name = 'Croque Fromage Edam' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Croque Dinde & Fromage' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Croque Dinde & Fromage', 'Pain toasté, fromage Edam et dinde fumée.', 25, true);
  ELSE
    UPDATE products SET base_price = 25, description = 'Pain toasté, fromage Edam et dinde fumée.' WHERE name = 'Croque Dinde & Fromage' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Croque La Casa' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Croque La Casa', 'Suprême de dinde, salami de dinde, fromage Edam.', 30, true);
  ELSE
    UPDATE products SET base_price = 30, description = 'Suprême de dinde, salami de dinde, fromage Edam.' WHERE name = 'Croque La Casa' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Toast Fromage' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Toast Fromage', 'Toast croustillant au fromage chaud.', 16, true);
  ELSE
    UPDATE products SET base_price = 16, description = 'Toast croustillant au fromage chaud.' WHERE name = 'Toast Fromage' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Toast Dinde & Fromage' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Toast Dinde & Fromage', 'Toast croustillant, fromage et dinde fumée.', 20, true);
  ELSE
    UPDATE products SET base_price = 20, description = 'Toast croustillant, fromage et dinde fumée.' WHERE name = 'Toast Dinde & Fromage' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Toast La Casa' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Toast La Casa', 'Crème de fromage, suprême de dinde, salami, oeuf au plat.', 25, true);
  ELSE
    UPDATE products SET base_price = 25, description = 'Crème de fromage, suprême de dinde, salami, oeuf au plat.' WHERE name = 'Toast La Casa' AND category_id = v_cat_id;
  END IF;

  -- --------------------------------------------------------------------------
  -- Catégorie: Cuisine Marocaine
  -- --------------------------------------------------------------------------
  SELECT id INTO v_cat_id FROM categories WHERE name = 'Cuisine Marocaine' LIMIT 1;
  IF v_cat_id IS NULL THEN
    INSERT INTO categories (name, description) VALUES ('Cuisine Marocaine', 'La tradition dans toute sa splendeur - المطبخ المغربي') RETURNING id INTO v_cat_id;
  ELSE
    UPDATE categories SET description = 'La tradition dans toute sa splendeur - المطبخ المغربي' WHERE id = v_cat_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Harira Marocaine Traditionnelle' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Harira Marocaine Traditionnelle', 'Soupe marocaine veloutée aux pois chiches, lentilles, tomates fraîches, céleri et herbes aromatiques.', 18, true);
  ELSE
    UPDATE products SET base_price = 18, description = 'Soupe marocaine veloutée aux pois chiches, lentilles, tomates fraîches, céleri et herbes aromatiques.' WHERE name = 'Harira Marocaine Traditionnelle' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Loubia à la Marocaine' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Loubia à la Marocaine', 'Haricots blancs mijotés dans une sauce tomate onctueuse au cumin et paprika doux.', 18, true);
  ELSE
    UPDATE products SET base_price = 18, description = 'Haricots blancs mijotés dans une sauce tomate onctueuse au cumin et paprika doux.' WHERE name = 'Loubia à la Marocaine' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Lentilles à la Marocaine' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Lentilles à la Marocaine', 'Lentilles mijotées à l''ail, coriandre fraîche et huile d''olive vierge extra.', 18, true);
  ELSE
    UPDATE products SET base_price = 18, description = 'Lentilles mijotées à l''ail, coriandre fraîche et huile d''olive vierge extra.' WHERE name = 'Lentilles à la Marocaine' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Tajine d''Anchois' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Tajine d''Anchois', 'Petits anchois frais marinés au chermoula maison, mijotés avec tomates et poivrons.', 18, true);
  ELSE
    UPDATE products SET base_price = 18, description = 'Petits anchois frais marinés au chermoula maison, mijotés avec tomates et poivrons.' WHERE name = 'Tajine d''Anchois' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Tajine de Crevettes' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Tajine de Crevettes', 'Crevettes sautées dans une chermoula parfumée à la tomate fraîche, ail et coriandre.', 30, true);
  ELSE
    UPDATE products SET base_price = 30, description = 'Crevettes sautées dans une chermoula parfumée à la tomate fraîche, ail et coriandre.' WHERE name = 'Tajine de Crevettes' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Tajine de Kefta & Oeuf' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Tajine de Kefta & Oeuf', 'Boulettes de kefta d''agneau et bœuf épicées, sauce tomate parfumée et oeuf poché.', 35, true);
  ELSE
    UPDATE products SET base_price = 35, description = 'Boulettes de kefta d''agneau et bœuf épicées, sauce tomate parfumée et oeuf poché.' WHERE name = 'Tajine de Kefta & Oeuf' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Poulet Rôti à la Marocaine' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Poulet Rôti à la Marocaine', 'Cuisse et suprême de poulet doré au four avec sa sauce onctueuse aux oignons daghmira.', 35, true);
  ELSE
    UPDATE products SET base_price = 35, description = 'Cuisse et suprême de poulet doré au four avec sa sauce onctueuse aux oignons daghmira.' WHERE name = 'Poulet Rôti à la Marocaine' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Tajine Poulet aux Légumes' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Tajine Poulet aux Légumes', 'Poulet fermier mijoté à l''étouffée avec carottes, courgettes, pommes de terre et olives.', 40, true);
  ELSE
    UPDATE products SET base_price = 40, description = 'Poulet fermier mijoté à l''étouffée avec carottes, courgettes, pommes de terre et olives.' WHERE name = 'Tajine Poulet aux Légumes' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Tajine Poulet Oignons & Raisins' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Tajine Poulet Oignons & Raisins', 'Mijoté doux-salé de poulet tendre, oignons caramélisés à la cannelle et raisins secs dorés.', 40, true);
  ELSE
    UPDATE products SET base_price = 40, description = 'Mijoté doux-salé de poulet tendre, oignons caramélisés à la cannelle et raisins secs dorés.' WHERE name = 'Tajine Poulet Oignons & Raisins' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Tajine Viande aux Légumes' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Tajine Viande aux Légumes', 'Morceaux de viande tendre mijotés avec une sélection de légumes frais du marché.', 50, true);
  ELSE
    UPDATE products SET base_price = 50, description = 'Morceaux de viande tendre mijotés avec une sélection de légumes frais du marché.' WHERE name = 'Tajine Viande aux Légumes' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Tajine Viande aux Pruneaux' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Tajine Viande aux Pruneaux', 'Viande fondante parfumée au safran et cannelle, couronnée de pruneaux caramélisés et amandes grillées.', 55, true);
  ELSE
    UPDATE products SET base_price = 55, description = 'Viande fondante parfumée au safran et cannelle, couronnée de pruneaux caramélisés et amandes grillées.' WHERE name = 'Tajine Viande aux Pruneaux' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Douara Traditionnelle' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Douara Traditionnelle', 'Tripes d''agneau traditionnelles cuisinées lentement aux épices chaudes et chermoula.', 55, true);
  ELSE
    UPDATE products SET base_price = 55, description = 'Tripes d''agneau traditionnelles cuisinées lentement aux épices chaudes et chermoula.' WHERE name = 'Douara Traditionnelle' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Frakech Beldi' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Frakech Beldi', 'Pieds de veau fondants mijotés aux pois chiches et blé, riches en saveurs authentiques.', 55, true);
  ELSE
    UPDATE products SET base_price = 55, description = 'Pieds de veau fondants mijotés aux pois chiches et blé, riches en saveurs authentiques.' WHERE name = 'Frakech Beldi' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Rfissa au Poulet' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Rfissa au Poulet', 'Feuilles de msemmen arrosées d''un bouillon parfumé au fenugrec, lentilles, oignons et poulet savoureux.', 60, true);
  ELSE
    UPDATE products SET base_price = 60, description = 'Feuilles de msemmen arrosées d''un bouillon parfumé au fenugrec, lentilles, oignons et poulet savoureux.' WHERE name = 'Rfissa au Poulet' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Couscous au Poulet' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Couscous au Poulet', 'Semoule fine cuite à la vapeur, servie avec sept légumes de saison et poulet fermier tendre.', 60, true);
  ELSE
    UPDATE products SET base_price = 60, description = 'Semoule fine cuite à la vapeur, servie avec sept légumes de saison et poulet fermier tendre.' WHERE name = 'Couscous au Poulet' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Couscous à la Viande' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Couscous à la Viande', 'Grand couscous traditionnel aux sept légumes et viande mijotée au beurre rance (smen).', 60, true);
  ELSE
    UPDATE products SET base_price = 60, description = 'Grand couscous traditionnel aux sept légumes et viande mijotée au beurre rance (smen).' WHERE name = 'Couscous à la Viande' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Seffa Prestige du Maroc' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Seffa Prestige du Maroc', 'Cheveux d''ange cuits à la vapeur, amandes dorées concassées, sucre glace et cannelle fine.', 60, true);
  ELSE
    UPDATE products SET base_price = 60, description = 'Cheveux d''ange cuits à la vapeur, amandes dorées concassées, sucre glace et cannelle fine.' WHERE name = 'Seffa Prestige du Maroc' AND category_id = v_cat_id;
  END IF;

  -- --------------------------------------------------------------------------
  -- Catégorie: Plats & Grillades
  -- --------------------------------------------------------------------------
  SELECT id INTO v_cat_id FROM categories WHERE name = 'Plats & Grillades' LIMIT 1;
  IF v_cat_id IS NULL THEN
    INSERT INTO categories (name, description) VALUES ('Plats & Grillades', 'La perfection du feu et des saveurs - أطباق الشيف والمشويات') RETURNING id INTO v_cat_id;
  ELSE
    UPDATE categories SET description = 'La perfection du feu et des saveurs - أطباق الشيف والمشويات' WHERE id = v_cat_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Cuisse de Poulet Rôtie' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Cuisse de Poulet Rôtie', 'Cuisse de poulet dorée et croustillante, garniture du chef et sauce crémeuse aux champignons frais.', 55, true);
  ELSE
    UPDATE products SET base_price = 55, description = 'Cuisse de poulet dorée et croustillante, garniture du chef et sauce crémeuse aux champignons frais.' WHERE name = 'Cuisse de Poulet Rôtie' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Grillades de Poulet' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Grillades de Poulet', 'Filets de poulet marinés aux herbes et grillés à la flamme, servis avec garniture du chef.', 65, true);
  ELSE
    UPDATE products SET base_price = 65, description = 'Filets de poulet marinés aux herbes et grillés à la flamme, servis avec garniture du chef.' WHERE name = 'Grillades de Poulet' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Grillades de Kefta' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Grillades de Kefta', 'Kefta d''agneau et bœuf assaisonnée à la marocaine et grillée, accompagnée de riz et légumes.', 70, true);
  ELSE
    UPDATE products SET base_price = 70, description = 'Kefta d''agneau et bœuf assaisonnée à la marocaine et grillée, accompagnée de riz et légumes.' WHERE name = 'Grillades de Kefta' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Brochettes Poulet Sauce Cacahuètes' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Brochettes Poulet Sauce Cacahuètes', 'Brochettes de poulet tendres nappées d''une onctueuse sauce cacahuètes façon satay, riz et légumes.', 75, true);
  ELSE
    UPDATE products SET base_price = 75, description = 'Brochettes de poulet tendres nappées d''une onctueuse sauce cacahuètes façon satay, riz et légumes.' WHERE name = 'Brochettes Poulet Sauce Cacahuètes' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Brochettes de Viande Hachée VIP' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Brochettes de Viande Hachée VIP', 'Brochettes de kefta fine sélection premium, marinées aux épices nobles du chef.', 75, true);
  ELSE
    UPDATE products SET base_price = 75, description = 'Brochettes de kefta fine sélection premium, marinées aux épices nobles du chef.' WHERE name = 'Brochettes de Viande Hachée VIP' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Souris d''Agneau Confite' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Souris d''Agneau Confite', 'Souris d''agneau braisée de longues heures, ultra-fondante, jus corsé et garniture raffinée.', 85, true);
  ELSE
    UPDATE products SET base_price = 85, description = 'Souris d''agneau braisée de longues heures, ultra-fondante, jus corsé et garniture raffinée.' WHERE name = 'Souris d''Agneau Confite' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Filet de Bœuf (Solomillo)' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Filet de Bœuf (Solomillo)', 'Pièce maîtresse de bœuf d''une tendreté absolue, saisie selon cuisson désirée, sauce au choix et garniture.', 95, true);
  ELSE
    UPDATE products SET base_price = 95, description = 'Pièce maîtresse de bœuf d''une tendreté absolue, saisie selon cuisson désirée, sauce au choix et garniture.' WHERE name = 'Filet de Bœuf (Solomillo)' AND category_id = v_cat_id;
  END IF;

  -- --------------------------------------------------------------------------
  -- Catégorie: Pâtes & Lasagnes
  -- --------------------------------------------------------------------------
  SELECT id INTO v_cat_id FROM categories WHERE name = 'Pâtes & Lasagnes' LIMIT 1;
  IF v_cat_id IS NULL THEN
    INSERT INTO categories (name, description) VALUES ('Pâtes & Lasagnes', 'Al dente, généreuses & crémeuses - المعكرونة واللازانيا') RETURNING id INTO v_cat_id;
  ELSE
    UPDATE categories SET description = 'Al dente, généreuses & crémeuses - المعكرونة واللازانيا' WHERE id = v_cat_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pâtes Végétariennes' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Pâtes Végétariennes', 'Légumes de saison frais sautés, ail confit, huile d''olive vierge extra et herbes fraîches.', 45, true);
  ELSE
    UPDATE products SET base_price = 45, description = 'Légumes de saison frais sautés, ail confit, huile d''olive vierge extra et herbes fraîches.' WHERE name = 'Pâtes Végétariennes' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pâtes Bolognaise' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Pâtes Bolognaise', 'Sauce tomate maison mijotée lentement avec viande hachée pur bœuf et herbes italiennes.', 55, true);
  ELSE
    UPDATE products SET base_price = 55, description = 'Sauce tomate maison mijotée lentement avec viande hachée pur bœuf et herbes italiennes.' WHERE name = 'Pâtes Bolognaise' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pâtes au Poulet et Champignons' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Pâtes au Poulet et Champignons', 'Émincé de blanc de poulet, champignons de Paris frais et sauce crème veloutée (roomsaus).', 55, true);
  ELSE
    UPDATE products SET base_price = 55, description = 'Émincé de blanc de poulet, champignons de Paris frais et sauce crème veloutée (roomsaus).' WHERE name = 'Pâtes au Poulet et Champignons' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Lasagne Bolognaise Gratinée' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Lasagne Bolognaise Gratinée', 'Feuilles de pâtes fraîches, bolognaise savoureuse, sauce béchamel onctueuse et fromage gratiné.', 55, true);
  ELSE
    UPDATE products SET base_price = 55, description = 'Feuilles de pâtes fraîches, bolognaise savoureuse, sauce béchamel onctueuse et fromage gratiné.' WHERE name = 'Lasagne Bolognaise Gratinée' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pâtes Quatre Fromages' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Pâtes Quatre Fromages', 'Mélange fondant de 4 fromages affinés italiens liés à la crème délicate.', 65, true);
  ELSE
    UPDATE products SET base_price = 65, description = 'Mélange fondant de 4 fromages affinés italiens liés à la crème délicate.' WHERE name = 'Pâtes Quatre Fromages' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pâtes Fruits de Mer' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Pâtes Fruits de Mer', 'Crevettes roses, calamars tendres et moules, liés d''une sauce crème à l''ail et persil frais.', 65, true);
  ELSE
    UPDATE products SET base_price = 65, description = 'Crevettes roses, calamars tendres et moules, liés d''une sauce crème à l''ail et persil frais.' WHERE name = 'Pâtes Fruits de Mer' AND category_id = v_cat_id;
  END IF;

  -- --------------------------------------------------------------------------
  -- Catégorie: Burgers & Tacos
  -- --------------------------------------------------------------------------
  SELECT id INTO v_cat_id FROM categories WHERE name = 'Burgers & Tacos' LIMIT 1;
  IF v_cat_id IS NULL THEN
    INSERT INTO categories (name, description) VALUES ('Burgers & Tacos', 'Saveurs urbaines avec frites - برجر وتاكوس') RETURNING id INTO v_cat_id;
  ELSE
    UPDATE categories SET description = 'Saveurs urbaines avec frites - برجر وتاكوس' WHERE id = v_cat_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Georgia Crispy Chicken' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Georgia Crispy Chicken', 'Steak de poulet pané extra croustillant, laitue fraîche, fromage cheddar, sauce burger maison, sauce fromagère.', 37, true);
  ELSE
    UPDATE products SET base_price = 37, description = 'Steak de poulet pané extra croustillant, laitue fraîche, fromage cheddar, sauce burger maison, sauce fromagère.' WHERE name = 'Georgia Crispy Chicken' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Wisconsin Cheeseburger' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Wisconsin Cheeseburger', 'Steak haché de bœuf 90g, laitue, tomate, oignons caramélisés, cheddar fondu, sauces burger et fromagère.', 42, true);
  ELSE
    UPDATE products SET base_price = 42, description = 'Steak haché de bœuf 90g, laitue, tomate, oignons caramélisés, cheddar fondu, sauces burger et fromagère.' WHERE name = 'Wisconsin Cheeseburger' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'California Chili Thaï Chicken' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'California Chili Thaï Chicken', 'Steak poulet pané, laitue, cheddar, sauce chili thaï douce et relevée, sauce fromagère crémeuse.', 42, true);
  ELSE
    UPDATE products SET base_price = 42, description = 'Steak poulet pané, laitue, cheddar, sauce chili thaï douce et relevée, sauce fromagère crémeuse.' WHERE name = 'California Chili Thaï Chicken' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Florida Chicken BBQ' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Florida Chicken BBQ', 'Steak poulet pané, dinde fumée, oignons caramélisés, ananas caramélisé, cheddar, sauce barbecue.', 45, true);
  ELSE
    UPDATE products SET base_price = 45, description = 'Steak poulet pané, dinde fumée, oignons caramélisés, ananas caramélisé, cheddar, sauce barbecue.' WHERE name = 'Florida Chicken BBQ' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Texas Quality Burger' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Texas Quality Burger', 'Steak bœuf 90g, oeuf au plat coulant, laitue, tomate, oignon caramélisé, cheddar et sauces signatures.', 47, true);
  ELSE
    UPDATE products SET base_price = 47, description = 'Steak bœuf 90g, oeuf au plat coulant, laitue, tomate, oignon caramélisé, cheddar et sauces signatures.' WHERE name = 'Texas Quality Burger' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Tennessee BBQ Burger' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Tennessee BBQ Burger', 'Steak bœuf 90g, dinde fumée croustillante, oignons caramélisés, ananas rôti, cheddar et sauce barbecue.', 47, true);
  ELSE
    UPDATE products SET base_price = 47, description = 'Steak bœuf 90g, dinde fumée croustillante, oignons caramélisés, ananas rôti, cheddar et sauce barbecue.' WHERE name = 'Tennessee BBQ Burger' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'New York Double Cheeseburger' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'New York Double Cheeseburger', '2 Steaks de bœuf 90g, oeuf au plat, double cheddar fondu, oignons caramélisés et duo de sauces.', 62, true);
  ELSE
    UPDATE products SET base_price = 62, description = '2 Steaks de bœuf 90g, oeuf au plat, double cheddar fondu, oignons caramélisés et duo de sauces.' WHERE name = 'New York Double Cheeseburger' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Tacos Poulet' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Tacos Poulet', 'Galette de blé garnie d''émincé de poulet sauté, frites à l''intérieur et sauce cheddar crémeuse.', 37, true);
  ELSE
    UPDATE products SET base_price = 37, description = 'Galette de blé garnie d''émincé de poulet sauté, frites à l''intérieur et sauce cheddar crémeuse.' WHERE name = 'Tacos Poulet' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Tacos Poulet Crispy' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Tacos Poulet Crispy', 'Tacos garni de poulet croustillant pané, frites dorées et sauce fromagère cheddar.', 37, true);
  ELSE
    UPDATE products SET base_price = 37, description = 'Tacos garni de poulet croustillant pané, frites dorées et sauce fromagère cheddar.' WHERE name = 'Tacos Poulet Crispy' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Tacos Viande Hachée' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Tacos Viande Hachée', 'Kefta épicée de bœuf, frites et sauce onctueuse au fromage cheddar.', 40, true);
  ELSE
    UPDATE products SET base_price = 40, description = 'Kefta épicée de bœuf, frites et sauce onctueuse au fromage cheddar.' WHERE name = 'Tacos Viande Hachée' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Tacos Mixte (Poulet & Kefta)' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Tacos Mixte (Poulet & Kefta)', 'Le meilleur des deux mondes : émincé de poulet et kefta, frites et fromage fondu.', 40, true);
  ELSE
    UPDATE products SET base_price = 40, description = 'Le meilleur des deux mondes : émincé de poulet et kefta, frites et fromage fondu.' WHERE name = 'Tacos Mixte (Poulet & Kefta)' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Kapsalon Poulet' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Kapsalon Poulet', 'Lit de frites croustillantes, émincé de poulet, tomates, laitue, concombre, parmesan et sauce yaourt fraîche.', 45, true);
  ELSE
    UPDATE products SET base_price = 45, description = 'Lit de frites croustillantes, émincé de poulet, tomates, laitue, concombre, parmesan et sauce yaourt fraîche.' WHERE name = 'Kapsalon Poulet' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Kapsalon Poulet Crispy' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Kapsalon Poulet Crispy', 'Frites garnies de tenders de poulet croustillants, salade croquante, parmesan râpé et sauce yaourt.', 45, true);
  ELSE
    UPDATE products SET base_price = 45, description = 'Frites garnies de tenders de poulet croustillants, salade croquante, parmesan râpé et sauce yaourt.' WHERE name = 'Kapsalon Poulet Crispy' AND category_id = v_cat_id;
  END IF;

  -- --------------------------------------------------------------------------
  -- Catégorie: Pizzas Artisanales
  -- --------------------------------------------------------------------------
  SELECT id INTO v_cat_id FROM categories WHERE name = 'Pizzas Artisanales' LIMIT 1;
  IF v_cat_id IS NULL THEN
    INSERT INTO categories (name, description) VALUES ('Pizzas Artisanales', 'Pâte croustillante & mozzarella - البيتزا الإيطالية') RETURNING id INTO v_cat_id;
  ELSE
    UPDATE categories SET description = 'Pâte croustillante & mozzarella - البيتزا الإيطالية' WHERE id = v_cat_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pizza Margarita' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Pizza Margarita', 'Sauce tomate italienne maison, mozzarella fondante et origan sauvage.', 35, true);
  ELSE
    UPDATE products SET base_price = 35, description = 'Sauce tomate italienne maison, mozzarella fondante et origan sauvage.' WHERE name = 'Pizza Margarita' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pizza Végétarienne' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Pizza Végétarienne', 'Sauce tomate, brocoli, aubergine, courgette, poivrons, champignons frais, mozzarella.', 40, true);
  ELSE
    UPDATE products SET base_price = 40, description = 'Sauce tomate, brocoli, aubergine, courgette, poivrons, champignons frais, mozzarella.' WHERE name = 'Pizza Végétarienne' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pizza Tonno' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Pizza Tonno', 'Sauce tomate, thon de premier choix, mozzarella et origan.', 40, true);
  ELSE
    UPDATE products SET base_price = 40, description = 'Sauce tomate, thon de premier choix, mozzarella et origan.' WHERE name = 'Pizza Tonno' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pizza Poulet & Champignons' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Pizza Poulet & Champignons', 'Sauce tomate, blanc de poulet émincé, champignons de Paris, mozzarella.', 45, true);
  ELSE
    UPDATE products SET base_price = 45, description = 'Sauce tomate, blanc de poulet émincé, champignons de Paris, mozzarella.' WHERE name = 'Pizza Poulet & Champignons' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pizza Bolognaise' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Pizza Bolognaise', 'Sauce tomate, viande hachée de bœuf assaisonnée, mozzarella fondante.', 45, true);
  ELSE
    UPDATE products SET base_price = 45, description = 'Sauce tomate, viande hachée de bœuf assaisonnée, mozzarella fondante.' WHERE name = 'Pizza Bolognaise' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pizza Quatre Fromages' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Pizza Quatre Fromages', 'Sauce tomate, harmonie de 4 fromages fondants et origan.', 45, true);
  ELSE
    UPDATE products SET base_price = 45, description = 'Sauce tomate, harmonie de 4 fromages fondants et origan.' WHERE name = 'Pizza Quatre Fromages' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pizza Quatre Saisons' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Pizza Quatre Saisons', 'Sauce tomate, bolognaise, fruits de mer, poulet, légumes grillés, mozzarella.', 45, true);
  ELSE
    UPDATE products SET base_price = 45, description = 'Sauce tomate, bolognaise, fruits de mer, poulet, légumes grillés, mozzarella.' WHERE name = 'Pizza Quatre Saisons' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pizza Fruits de Mer' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Pizza Fruits de Mer', 'Sauce tomate, crevettes, calamars, moules fraîches, mozzarella et origan.', 60, true);
  ELSE
    UPDATE products SET base_price = 60, description = 'Sauce tomate, crevettes, calamars, moules fraîches, mozzarella et origan.' WHERE name = 'Pizza Fruits de Mer' AND category_id = v_cat_id;
  END IF;

  -- --------------------------------------------------------------------------
  -- Catégorie: Salades Fraîches
  -- --------------------------------------------------------------------------
  SELECT id INTO v_cat_id FROM categories WHERE name = 'Salades Fraîches' LIMIT 1;
  IF v_cat_id IS NULL THEN
    INSERT INTO categories (name, description) VALUES ('Salades Fraîches', 'Légèreté, fraîcheur & vitamines - السلطات الطازجة') RETURNING id INTO v_cat_id;
  ELSE
    UPDATE categories SET description = 'Légèreté, fraîcheur & vitamines - السلطات الطازجة' WHERE id = v_cat_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Salade Marocaine' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Salade Marocaine', 'Dés de tomates fraîches, oignons doux, poivron vert croquant, concombre, persil, coriandre et vinaigrette à l''huile d''olive.', 25, true);
  ELSE
    UPDATE products SET base_price = 25, description = 'Dés de tomates fraîches, oignons doux, poivron vert croquant, concombre, persil, coriandre et vinaigrette à l''huile d''olive.' WHERE name = 'Salade Marocaine' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Salade Russe' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Salade Russe', 'Pommes de terre fondantes, carottes, petits pois, maïs doux, mayonnaise crémeuse, thon et œuf dur.', 30, true);
  ELSE
    UPDATE products SET base_price = 30, description = 'Pommes de terre fondantes, carottes, petits pois, maïs doux, mayonnaise crémeuse, thon et œuf dur.' WHERE name = 'Salade Russe' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Salade Spéciale Maison' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Salade Spéciale Maison', 'Laitue croquante, tomate, concombre, maïs, thon ou poulet au choix, dés de fromage et sauce spéciale.', 35, true);
  ELSE
    UPDATE products SET base_price = 35, description = 'Laitue croquante, tomate, concombre, maïs, thon ou poulet au choix, dés de fromage et sauce spéciale.' WHERE name = 'Salade Spéciale Maison' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Salade César' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Salade César', 'Cœur de laitue, poulet grillé ou pané au choix, croûtons dorés à l''ail, copeaux de parmesan, tomates cerises et sauce césar.', 40, true);
  ELSE
    UPDATE products SET base_price = 40, description = 'Cœur de laitue, poulet grillé ou pané au choix, croûtons dorés à l''ail, copeaux de parmesan, tomates cerises et sauce césar.' WHERE name = 'Salade César' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Salade Tropicale' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Salade Tropicale', 'Laitue, ananas frais, avocat crémeux, crevettes roses, maïs doux, tomates cerises et sauce cocktail rosée.', 45, true);
  ELSE
    UPDATE products SET base_price = 45, description = 'Laitue, ananas frais, avocat crémeux, crevettes roses, maïs doux, tomates cerises et sauce cocktail rosée.' WHERE name = 'Salade Tropicale' AND category_id = v_cat_id;
  END IF;

  -- --------------------------------------------------------------------------
  -- Catégorie: Jus & Cocktails
  -- --------------------------------------------------------------------------
  SELECT id INTO v_cat_id FROM categories WHERE name = 'Jus & Cocktails' LIMIT 1;
  IF v_cat_id IS NULL THEN
    INSERT INTO categories (name, description) VALUES ('Jus & Cocktails', 'Fruits frais pressés minute - العصائر والكوكتيل') RETURNING id INTO v_cat_id;
  ELSE
    UPDATE categories SET description = 'Fruits frais pressés minute - العصائر والكوكتيل' WHERE id = v_cat_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Jus de Citron' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Jus de Citron', 'Citron frais pressé minute.', 22, true);
  ELSE
    UPDATE products SET base_price = 22, description = 'Citron frais pressé minute.' WHERE name = 'Jus de Citron' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Jus d''Orange Pressé' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Jus d''Orange Pressé', 'Orange fraîche pressée minute.', 22, true);
  ELSE
    UPDATE products SET base_price = 22, description = 'Orange fraîche pressée minute.' WHERE name = 'Jus d''Orange Pressé' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Jus de Carotte Pressée' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Jus de Carotte Pressée', 'Carotte fraîche pressée minute.', 22, true);
  ELSE
    UPDATE products SET base_price = 22, description = 'Carotte fraîche pressée minute.' WHERE name = 'Jus de Carotte Pressée' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Jus d''Amande au Lait' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Jus d''Amande au Lait', 'Amandes fraîches mixées au lait velouté.', 25, true);
  ELSE
    UPDATE products SET base_price = 25, description = 'Amandes fraîches mixées au lait velouté.' WHERE name = 'Jus d''Amande au Lait' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Jus de Fraise' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Jus de Fraise', 'Fraises fraîches de saison.', 25, true);
  ELSE
    UPDATE products SET base_price = 25, description = 'Fraises fraîches de saison.' WHERE name = 'Jus de Fraise' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Jus de Pêche' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Jus de Pêche', 'Pêche juteuse pressée minute.', 25, true);
  ELSE
    UPDATE products SET base_price = 25, description = 'Pêche juteuse pressée minute.' WHERE name = 'Jus de Pêche' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Jus de Banane' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Jus de Banane', 'Banane fraîche mixée au lait.', 25, true);
  ELSE
    UPDATE products SET base_price = 25, description = 'Banane fraîche mixée au lait.' WHERE name = 'Jus de Banane' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Jus d''Avocat' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Jus d''Avocat', 'Avocat crémeux pressé minute.', 25, true);
  ELSE
    UPDATE products SET base_price = 25, description = 'Avocat crémeux pressé minute.' WHERE name = 'Jus d''Avocat' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Jus de Papaye' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Jus de Papaye', 'Papaye fraîche parfumée.', 25, true);
  ELSE
    UPDATE products SET base_price = 25, description = 'Papaye fraîche parfumée.' WHERE name = 'Jus de Papaye' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Jus de Kiwi' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Jus de Kiwi', 'Kiwi frais riche en vitamines.', 25, true);
  ELSE
    UPDATE products SET base_price = 25, description = 'Kiwi frais riche en vitamines.' WHERE name = 'Jus de Kiwi' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pomme Pressée' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Pomme Pressée', 'Pommes fraîches pressées minute.', 25, true);
  ELSE
    UPDATE products SET base_price = 25, description = 'Pommes fraîches pressées minute.' WHERE name = 'Pomme Pressée' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Poire Pressée' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Poire Pressée', 'Poires fraîches juteuses.', 25, true);
  ELSE
    UPDATE products SET base_price = 25, description = 'Poires fraîches juteuses.' WHERE name = 'Poire Pressée' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Raisin Pressé' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Raisin Pressé', 'Raisin frais pressé minute.', 25, true);
  ELSE
    UPDATE products SET base_price = 25, description = 'Raisin frais pressé minute.' WHERE name = 'Raisin Pressé' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Grenade Pressée' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Grenade Pressée', 'Grenade fraîche naturelle.', 25, true);
  ELSE
    UPDATE products SET base_price = 25, description = 'Grenade fraîche naturelle.' WHERE name = 'Grenade Pressée' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pastèque Pressée' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Pastèque Pressée', 'Pastèque fraîche et désaltérante.', 25, true);
  ELSE
    UPDATE products SET base_price = 25, description = 'Pastèque fraîche et désaltérante.' WHERE name = 'Pastèque Pressée' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Ananas Pressé' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Ananas Pressé', 'Ananas frais pressé minute.', 30, true);
  ELSE
    UPDATE products SET base_price = 30, description = 'Ananas frais pressé minute.' WHERE name = 'Ananas Pressé' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Avocat aux Amandes' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Avocat aux Amandes', 'Avocat onctueux garni d''amandes concassées.', 27, true);
  ELSE
    UPDATE products SET base_price = 27, description = 'Avocat onctueux garni d''amandes concassées.' WHERE name = 'Avocat aux Amandes' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Jus Panaché' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Jus Panaché', 'Cocktail de fruits frais de saison mixés.', 28, true);
  ELSE
    UPDATE products SET base_price = 28, description = 'Cocktail de fruits frais de saison mixés.' WHERE name = 'Jus Panaché' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Avocat aux Fruits Secs' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Avocat aux Fruits Secs', 'Avocat crémeux aux assortiments de fruits secs nobles.', 29, true);
  ELSE
    UPDATE products SET base_price = 29, description = 'Avocat crémeux aux assortiments de fruits secs nobles.' WHERE name = 'Avocat aux Fruits Secs' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Jus de Mangue' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Jus de Mangue', 'Mangue mûre et parfumée.', 30, true);
  ELSE
    UPDATE products SET base_price = 30, description = 'Mangue mûre et parfumée.' WHERE name = 'Jus de Mangue' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Jus de Fruit du Dragon' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Jus de Fruit du Dragon', 'Pitaya (fruit du dragon) frais exotique.', 30, true);
  ELSE
    UPDATE products SET base_price = 30, description = 'Pitaya (fruit du dragon) frais exotique.' WHERE name = 'Jus de Fruit du Dragon' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Smoothie Fraise' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Smoothie Fraise', 'Fraise, lait, yaourt onctueux et boule de glace vanille.', 30, true);
  ELSE
    UPDATE products SET base_price = 30, description = 'Fraise, lait, yaourt onctueux et boule de glace vanille.' WHERE name = 'Smoothie Fraise' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Smoothie Pêche' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Smoothie Pêche', 'Pêche juteuse, lait, yaourt et glace.', 30, true);
  ELSE
    UPDATE products SET base_price = 30, description = 'Pêche juteuse, lait, yaourt et glace.' WHERE name = 'Smoothie Pêche' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Smoothie Banane' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Smoothie Banane', 'Banane, lait, yaourt et boule de glace.', 30, true);
  ELSE
    UPDATE products SET base_price = 30, description = 'Banane, lait, yaourt et boule de glace.' WHERE name = 'Smoothie Banane' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Smoothie Mangue' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Smoothie Mangue', 'Mangue mûre, lait, yaourt et boule de glace.', 35, true);
  ELSE
    UPDATE products SET base_price = 35, description = 'Mangue mûre, lait, yaourt et boule de glace.' WHERE name = 'Smoothie Mangue' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Classic Detox' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Classic Detox', 'Carotte, pomme croquante, gingembre frais, citron et orange.', 28, true);
  ELSE
    UPDATE products SET base_price = 28, description = 'Carotte, pomme croquante, gingembre frais, citron et orange.' WHERE name = 'Classic Detox' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Green Detox' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Green Detox', 'Concombre, citron vert, pomme verte, gingembre et céleri.', 28, true);
  ELSE
    UPDATE products SET base_price = 28, description = 'Concombre, citron vert, pomme verte, gingembre et céleri.' WHERE name = 'Green Detox' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Yellow Detox' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Yellow Detox', 'Citron pressé, ananas doux et gingembre dynamisant.', 30, true);
  ELSE
    UPDATE products SET base_price = 30, description = 'Citron pressé, ananas doux et gingembre dynamisant.' WHERE name = 'Yellow Detox' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Mojito Virgin' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Mojito Virgin', 'Menthe fraîche pilée, citron vert, sucre de canne et eau gazeuse.', 28, true);
  ELSE
    UPDATE products SET base_price = 28, description = 'Menthe fraîche pilée, citron vert, sucre de canne et eau gazeuse.' WHERE name = 'Mojito Virgin' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Mojito Tropical / Fruits' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Mojito Tropical / Fruits', 'Au choix : Tropical, Fraise, Blue Curaçao, Pastèque ou Piña Colada.', 30, true);
  ELSE
    UPDATE products SET base_price = 30, description = 'Au choix : Tropical, Fraise, Blue Curaçao, Pastèque ou Piña Colada.' WHERE name = 'Mojito Tropical / Fruits' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Mojito Red Bull' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Mojito Red Bull', 'Mojito énergisant au Red Bull et citron vert.', 50, true);
  ELSE
    UPDATE products SET base_price = 50, description = 'Mojito énergisant au Red Bull et citron vert.' WHERE name = 'Mojito Red Bull' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Bleu / Green Mocktail' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Bleu / Green Mocktail', 'Cocktail sans alcool aux agrumes et sirops artisanaux bleus ou verts.', 35, true);
  ELSE
    UPDATE products SET base_price = 35, description = 'Cocktail sans alcool aux agrumes et sirops artisanaux bleus ou verts.' WHERE name = 'Bleu / Green Mocktail' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'House Mocktail Prestige' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'House Mocktail Prestige', 'Création secrète du barman aux saveurs florales et fruits exotiques.', 40, true);
  ELSE
    UPDATE products SET base_price = 40, description = 'Création secrète du barman aux saveurs florales et fruits exotiques.' WHERE name = 'House Mocktail Prestige' AND category_id = v_cat_id;
  END IF;

  -- --------------------------------------------------------------------------
  -- Catégorie: Cafés & Thés
  -- --------------------------------------------------------------------------
  SELECT id INTO v_cat_id FROM categories WHERE name = 'Cafés & Thés' LIMIT 1;
  IF v_cat_id IS NULL THEN
    INSERT INTO categories (name, description) VALUES ('Cafés & Thés', 'Torréfaction d''exception & infusions - القهوة والشاي') RETURNING id INTO v_cat_id;
  ELSE
    UPDATE categories SET description = 'Torréfaction d''exception & infusions - القهوة والشاي' WHERE id = v_cat_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Café Espresso' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Café Espresso', 'Espresso intense 100% arabica.', 14, true);
  ELSE
    UPDATE products SET base_price = 14, description = 'Espresso intense 100% arabica.' WHERE name = 'Café Espresso' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Café Américain' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Café Américain', 'Café long doux et équilibré.', 14, true);
  ELSE
    UPDATE products SET base_price = 14, description = 'Café long doux et équilibré.' WHERE name = 'Café Américain' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Café au Lait' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Café au Lait', 'Café espresso avec mousse de lait onctueuse.', 15, true);
  ELSE
    UPDATE products SET base_price = 15, description = 'Café espresso avec mousse de lait onctueuse.' WHERE name = 'Café au Lait' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Double Espresso' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Double Espresso', 'Double shot d''espresso corsé.', 16, true);
  ELSE
    UPDATE products SET base_price = 16, description = 'Double shot d''espresso corsé.' WHERE name = 'Double Espresso' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Cappuccino Italien' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Cappuccino Italien', 'Espresso, lait chaud et mousse de lait crémeuse saupoudrée de cacao.', 20, true);
  ELSE
    UPDATE products SET base_price = 20, description = 'Espresso, lait chaud et mousse de lait crémeuse saupoudrée de cacao.' WHERE name = 'Cappuccino Italien' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Cappuccino Viennois' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Cappuccino Viennois', 'Espresso coiffé d''un dôme de crème Chantilly maison.', 20, true);
  ELSE
    UPDATE products SET base_price = 20, description = 'Espresso coiffé d''un dôme de crème Chantilly maison.' WHERE name = 'Cappuccino Viennois' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Latte Macchiato' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Latte Macchiato', 'Lait chaud marbré d''un shot d''espresso et mousse délicate.', 20, true);
  ELSE
    UPDATE products SET base_price = 20, description = 'Lait chaud marbré d''un shot d''espresso et mousse délicate.' WHERE name = 'Latte Macchiato' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Nespresso / au Lait' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Nespresso / au Lait', 'Sélection grands crus Nespresso avec ou sans lait.', 20, true);
  ELSE
    UPDATE products SET base_price = 20, description = 'Sélection grands crus Nespresso avec ou sans lait.' WHERE name = 'Nespresso / au Lait' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Chocolat Chaud' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Chocolat Chaud', 'Chocolat au lait crémeux et velouté.', 14, true);
  ELSE
    UPDATE products SET base_price = 14, description = 'Chocolat au lait crémeux et velouté.' WHERE name = 'Chocolat Chaud' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Chocolat Chantilly' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Chocolat Chantilly', 'Chocolat chaud gourmand surmonté de crème Chantilly.', 18, true);
  ELSE
    UPDATE products SET base_price = 18, description = 'Chocolat chaud gourmand surmonté de crème Chantilly.' WHERE name = 'Chocolat Chantilly' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Thé Vert à la Menthe' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Thé Vert à la Menthe', 'Thé vert traditionnel marocain à la menthe fraîche.', 14, true);
  ELSE
    UPDATE products SET base_price = 14, description = 'Thé vert traditionnel marocain à la menthe fraîche.' WHERE name = 'Thé Vert à la Menthe' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Thé Noir / Anglais' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Thé Noir / Anglais', 'Thé noir sélection fine façon English Breakfast.', 14, true);
  ELSE
    UPDATE products SET base_price = 14, description = 'Thé noir sélection fine façon English Breakfast.' WHERE name = 'Thé Noir / Anglais' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Infusion / Verveine' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Infusion / Verveine', 'Infusion apaisante de verveine ou camomille.', 14, true);
  ELSE
    UPDATE products SET base_price = 14, description = 'Infusion apaisante de verveine ou camomille.' WHERE name = 'Infusion / Verveine' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Sidi Ali 33cl' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Sidi Ali 33cl', 'Eau minérale naturelle pure 33cl.', 4, true);
  ELSE
    UPDATE products SET base_price = 4, description = 'Eau minérale naturelle pure 33cl.' WHERE name = 'Sidi Ali 33cl' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Sidi Ali 50cl' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Sidi Ali 50cl', 'Eau minérale naturelle pure 50cl.', 7, true);
  ELSE
    UPDATE products SET base_price = 7, description = 'Eau minérale naturelle pure 50cl.' WHERE name = 'Sidi Ali 50cl' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Sidi Ali Familial 1.5L' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Sidi Ali Familial 1.5L', 'Bouteille familiale d''eau minérale 1.5L.', 12, true);
  ELSE
    UPDATE products SET base_price = 12, description = 'Bouteille familiale d''eau minérale 1.5L.' WHERE name = 'Sidi Ali Familial 1.5L' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Sodas (Coca, Sprite, Hawai)' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Sodas (Coca, Sprite, Hawai)', 'Boissons gazeuses fraîches au choix.', 15, true);
  ELSE
    UPDATE products SET base_price = 15, description = 'Boissons gazeuses fraîches au choix.' WHERE name = 'Sodas (Coca, Sprite, Hawai)' AND category_id = v_cat_id;
  END IF;

  -- --------------------------------------------------------------------------
  -- Catégorie: Desserts Maison
  -- --------------------------------------------------------------------------
  SELECT id INTO v_cat_id FROM categories WHERE name = 'Desserts Maison' LIMIT 1;
  IF v_cat_id IS NULL THEN
    INSERT INTO categories (name, description) VALUES ('Desserts Maison', 'La note sucrée pour terminer - الحلويات المنزلية') RETURNING id INTO v_cat_id;
  ELSE
    UPDATE categories SET description = 'La note sucrée pour terminer - الحلويات المنزلية' WHERE id = v_cat_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Flan Caramel Maison' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Flan Caramel Maison', 'Flan traditionnel nappé d''un caramel doré velouté.', 15, true);
  ELSE
    UPDATE products SET base_price = 15, description = 'Flan traditionnel nappé d''un caramel doré velouté.' WHERE name = 'Flan Caramel Maison' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Mhalabiya aux Épices' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Mhalabiya aux Épices', 'Crème de lait orientale parfumée à l''eau de fleur d''oranger et pistaches.', 15, true);
  ELSE
    UPDATE products SET base_price = 15, description = 'Crème de lait orientale parfumée à l''eau de fleur d''oranger et pistaches.' WHERE name = 'Mhalabiya aux Épices' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Tarte au Citron Meringuée' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Tarte au Citron Meringuée', 'Pâte sablée pur beurre, crème de citron acidulée et meringue dorée.', 20, true);
  ELSE
    UPDATE products SET base_price = 20, description = 'Pâte sablée pur beurre, crème de citron acidulée et meringue dorée.' WHERE name = 'Tarte au Citron Meringuée' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Cheesecake New Yorkais' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Cheesecake New Yorkais', 'Biscuit croustillant, crème onctueuse au fromage frais et coulis de fruits rouges.', 20, true);
  ELSE
    UPDATE products SET base_price = 20, description = 'Biscuit croustillant, crème onctueuse au fromage frais et coulis de fruits rouges.' WHERE name = 'Cheesecake New Yorkais' AND category_id = v_cat_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Tiramisu Tradizionale' AND category_id = v_cat_id) THEN
    INSERT INTO products (category_id, name, description, base_price, available)
    VALUES (v_cat_id, 'Tiramisu Tradizionale', 'Biscuits cuillères imbibés de café espresso, mascarpone fouetté et cacao noir amer.', 20, true);
  ELSE
    UPDATE products SET base_price = 20, description = 'Biscuits cuillères imbibés de café espresso, mascarpone fouetté et cacao noir amer.' WHERE name = 'Tiramisu Tradizionale' AND category_id = v_cat_id;
  END IF;

  RAISE NOTICE '✅ Menu House Publique importé avec succès (10 catégories, 148 produits) !';
END $$;

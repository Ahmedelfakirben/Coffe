import fs from 'fs';
import path from 'path';

const menuData = [
  // 1. Petit Déjeuner
  { category: "Petit Déjeuner", name: "Formule Français", price: 35, desc: "Assortiments de 3 mini viennoiseries, Nutella, confiture, boisson chaude au choix, jus fait maison, eau minérale." },
  { category: "Petit Déjeuner", name: "Formule Traditionnel", price: 40, desc: "Harcha, baghrir, rghayef, miel, amlou, beurre, fromage traditionnel, huile d'olive, olive, boisson chaude, eau minérale, jus fait maison." },
  { category: "Petit Déjeuner", name: "Formule Tétouani", price: 42, desc: "Deux oeufs au choix, assortiment de charcuterie, mortadelle, la Vache qui rit, fromage traditionnel, huile d'olive, olive, boisson chaude, eau minérale, jus fait maison." },
  { category: "Petit Déjeuner", name: "Formule Fassi", price: 45, desc: "Deux oeufs au choix, khlie artisanal, olive, huile d'olive, boisson chaude, eau minérale, jus fait maison." },
  { category: "Petit Déjeuner", name: "Formule Espagnol", price: 45, desc: "Toast aux céréales grillé, tomate, épices, fromage manchego, tapenade, thon, avocat, huile d'olive, olive, jus fait maison, eau minérale." },
  { category: "Petit Déjeuner", name: "Formule Fitness", price: 50, desc: "Bol de yaourt fait maison, fruits de saison, pain grillé, tapenade, fromage traditionnel, mini detox." },
  { category: "Petit Déjeuner", name: "Formule British", price: 55, desc: "Deux oeufs au choix, saucisse grillée, haricots rouges, tomate, champignons, dinde fumée, fromage edam, eau minérale, jus fait maison, huile d'olive, olive." },
  { category: "Petit Déjeuner", name: "Formule La Casa", price: 50, desc: "Pain céréales grillé, assortiments de charcuterie, oeufs à la coque, fromage traditionnel, Kiri, beurre, confiture, bol de yaourt, fruits de saison, huile d'olive, olive, eau minérale, jus fait maison." },
  { category: "Petit Déjeuner", name: "Formule Brunch", price: 60, desc: "Toast céréales au fromage, assortiments de 2 viennoiseries, pancakes, assortiments de pain, omelette nature, pain perdu nature, bol de yaourt, fruits de saison, huile d'olive, olive, eau minérale, jus fait maison ou mini detox." },
  { category: "Petit Déjeuner", name: "Mqila Chakchouka", price: 22, desc: "2 Oeufs et tomates chakchouka aux épices." },
  { category: "Petit Déjeuner", name: "Mqila Légumes Sautés", price: 25, desc: "2 Oeufs aux légumes de saison sautés." },
  { category: "Petit Déjeuner", name: "Mqila Charcuterie", price: 28, desc: "2 Oeufs poêlés à la charcuterie fine." },
  { category: "Petit Déjeuner", name: "Mqila Saucisse", price: 30, desc: "2 Oeufs à la saucisse grillée." },
  { category: "Petit Déjeuner", name: "Mqila Crevettes", price: 32, desc: "2 Oeufs aux crevettes fraîches persillées." },
  { category: "Petit Déjeuner", name: "Omelette Nature / Herbes", price: 18, desc: "Oeufs frais battus, herbes aromatiques." },
  { category: "Petit Déjeuner", name: "Omelette Fromage Edam", price: 22, desc: "Oeufs fondants au fromage Edam." },
  { category: "Petit Déjeuner", name: "Omelette Dinde & Fromage", price: 24, desc: "Dinde fumée savoureuse et fromage fondu." },
  { category: "Petit Déjeuner", name: "Omelette Végétarienne", price: 24, desc: "Légumes frais sautés et herbes." },
  { category: "Petit Déjeuner", name: "Omelette aux Champignons", price: 24, desc: "Champignons frais dorés au beurre." },
  { category: "Petit Déjeuner", name: "Omelette au Thon", price: 28, desc: "Thon de qualité et herbes fraîches." },
  { category: "Petit Déjeuner", name: "Omelette au Khlie", price: 30, desc: "Khlie artisanal traditionnel marocain." },
  { category: "Petit Déjeuner", name: "Omelette aux Crevettes", price: 30, desc: "Crevettes sautées à l'ail et persil." },
  { category: "Petit Déjeuner", name: "Smashed Avocado", price: 30, desc: "Toast aux céréales, crème de fromage, guacamole frais maison (avocat écrasé, tomate, citron, Tabasco)." },
  { category: "Petit Déjeuner", name: "Scramble Avocado", price: 35, desc: "Toast aux céréales, crème de fromage, guacamole maison et oeufs brouillés crémeux." },
  { category: "Petit Déjeuner", name: "Scramble Avocado Saumon", price: 45, desc: "Toast aux céréales, crème de fromage, guacamole, oeufs brouillés crémeux et tranches de saumon fumé." },
  { category: "Petit Déjeuner", name: "Uitsmijter Amsterdam", price: 26, desc: "Pain burger, 2 oeufs au plat, dinde fumée, crème de fromage, fromage Edam." },
  { category: "Petit Déjeuner", name: "Uitsmijter Rotterdam", price: 28, desc: "Pain burger, 2 oeufs au plat, crème de fromage, suprême de dinde, salami, Edam." },
  { category: "Petit Déjeuner", name: "Uitsmijter Salmon", price: 45, desc: "Pain burger, 2 oeufs au plat, crème de fromage, fromage Edam, saumon fumé." },
  { category: "Petit Déjeuner", name: "Petit Déjeuner Chamali 1", price: 14, desc: "Pain complet, œuf frais, fromage traditionnel du Nord, huile d'olive vierge." },
  { category: "Petit Déjeuner", name: "Petit Déjeuner Chamali 2", price: 16, desc: "Pain complet, œuf, fromage traditionnel, fromage edam, huile d'olive." },
  { category: "Petit Déjeuner", name: "Petit Déjeuner Chamali 3", price: 18, desc: "Pain complet, œuf, fromage traditionnel, edam, dinde fumée, huile d'olive." },
  { category: "Petit Déjeuner", name: "Croque Fromage Edam", price: 22, desc: "Pain toasté doré au four, fromage Edam fondant." },
  { category: "Petit Déjeuner", name: "Croque Dinde & Fromage", price: 25, desc: "Pain toasté, fromage Edam et dinde fumée." },
  { category: "Petit Déjeuner", name: "Croque La Casa", price: 30, desc: "Suprême de dinde, salami de dinde, fromage Edam." },
  { category: "Petit Déjeuner", name: "Toast Fromage", price: 16, desc: "Toast croustillant au fromage chaud." },
  { category: "Petit Déjeuner", name: "Toast Dinde & Fromage", price: 20, desc: "Toast croustillant, fromage et dinde fumée." },
  { category: "Petit Déjeuner", name: "Toast La Casa", price: 25, desc: "Crème de fromage, suprême de dinde, salami, oeuf au plat." },

  // 2. Cuisine Marocaine
  { category: "Cuisine Marocaine", name: "Harira Marocaine Traditionnelle", price: 18, desc: "Soupe marocaine veloutée aux pois chiches, lentilles, tomates fraîches, céleri et herbes aromatiques." },
  { category: "Cuisine Marocaine", name: "Loubia à la Marocaine", price: 18, desc: "Haricots blancs mijotés dans une sauce tomate onctueuse au cumin et paprika doux." },
  { category: "Cuisine Marocaine", name: "Lentilles à la Marocaine", price: 18, desc: "Lentilles mijotées à l'ail, coriandre fraîche et huile d'olive vierge extra." },
  { category: "Cuisine Marocaine", name: "Tajine d'Anchois", price: 18, desc: "Petits anchois frais marinés au chermoula maison, mijotés avec tomates et poivrons." },
  { category: "Cuisine Marocaine", name: "Tajine de Crevettes", price: 30, desc: "Crevettes sautées dans une chermoula parfumée à la tomate fraîche, ail et coriandre." },
  { category: "Cuisine Marocaine", name: "Tajine de Kefta & Oeuf", price: 35, desc: "Boulettes de kefta d'agneau et bœuf épicées, sauce tomate parfumée et oeuf poché." },
  { category: "Cuisine Marocaine", name: "Poulet Rôti à la Marocaine", price: 35, desc: "Cuisse et suprême de poulet doré au four avec sa sauce onctueuse aux oignons daghmira." },
  { category: "Cuisine Marocaine", name: "Tajine Poulet aux Légumes", price: 40, desc: "Poulet fermier mijoté à l'étouffée avec carottes, courgettes, pommes de terre et olives." },
  { category: "Cuisine Marocaine", name: "Tajine Poulet Oignons & Raisins", price: 40, desc: "Mijoté doux-salé de poulet tendre, oignons caramélisés à la cannelle et raisins secs dorés." },
  { category: "Cuisine Marocaine", name: "Tajine Viande aux Légumes", price: 50, desc: "Morceaux de viande tendre mijotés avec une sélection de légumes frais du marché." },
  { category: "Cuisine Marocaine", name: "Tajine Viande aux Pruneaux", price: 55, desc: "Viande fondante parfumée au safran et cannelle, couronnée de pruneaux caramélisés et amandes grillées." },
  { category: "Cuisine Marocaine", name: "Douara Traditionnelle", price: 55, desc: "Tripes d'agneau traditionnelles cuisinées lentement aux épices chaudes et chermoula." },
  { category: "Cuisine Marocaine", name: "Frakech Beldi", price: 55, desc: "Pieds de veau fondants mijotés aux pois chiches et blé, riches en saveurs authentiques." },
  { category: "Cuisine Marocaine", name: "Rfissa au Poulet", price: 60, desc: "Feuilles de msemmen arrosées d'un bouillon parfumé au fenugrec, lentilles, oignons et poulet savoureux." },
  { category: "Cuisine Marocaine", name: "Couscous au Poulet", price: 60, desc: "Semoule fine cuite à la vapeur, servie avec sept légumes de saison et poulet fermier tendre." },
  { category: "Cuisine Marocaine", name: "Couscous à la Viande", price: 60, desc: "Grand couscous traditionnel aux sept légumes et viande mijotée au beurre rance (smen)." },
  { category: "Cuisine Marocaine", name: "Seffa Prestige du Maroc", price: 60, desc: "Cheveux d'ange cuits à la vapeur, amandes dorées concassées, sucre glace et cannelle fine." },

  // 3. Plats & Grillades
  { category: "Plats & Grillades", name: "Cuisse de Poulet Rôtie", price: 55, desc: "Cuisse de poulet dorée et croustillante, garniture du chef et sauce crémeuse aux champignons frais." },
  { category: "Plats & Grillades", name: "Grillades de Poulet", price: 65, desc: "Filets de poulet marinés aux herbes et grillés à la flamme, servis avec garniture du chef." },
  { category: "Plats & Grillades", name: "Grillades de Kefta", price: 70, desc: "Kefta d'agneau et bœuf assaisonnée à la marocaine et grillée, accompagnée de riz et légumes." },
  { category: "Plats & Grillades", name: "Brochettes Poulet Sauce Cacahuètes", price: 75, desc: "Brochettes de poulet tendres nappées d'une onctueuse sauce cacahuètes façon satay, riz et légumes." },
  { category: "Plats & Grillades", name: "Brochettes de Viande Hachée VIP", price: 75, desc: "Brochettes de kefta fine sélection premium, marinées aux épices nobles du chef." },
  { category: "Plats & Grillades", name: "Souris d'Agneau Confite", price: 85, desc: "Souris d'agneau braisée de longues heures, ultra-fondante, jus corsé et garniture raffinée." },
  { category: "Plats & Grillades", name: "Filet de Bœuf (Solomillo)", price: 95, desc: "Pièce maîtresse de bœuf d'une tendreté absolue, saisie selon cuisson désirée, sauce au choix et garniture." },

  // 4. Pâtes & Lasagnes
  { category: "Pâtes & Lasagnes", name: "Pâtes Végétariennes", price: 45, desc: "Légumes de saison frais sautés, ail confit, huile d'olive vierge extra et herbes fraîches." },
  { category: "Pâtes & Lasagnes", name: "Pâtes Bolognaise", price: 55, desc: "Sauce tomate maison mijotée lentement avec viande hachée pur bœuf et herbes italiennes." },
  { category: "Pâtes & Lasagnes", name: "Pâtes au Poulet et Champignons", price: 55, desc: "Émincé de blanc de poulet, champignons de Paris frais et sauce crème veloutée (roomsaus)." },
  { category: "Pâtes & Lasagnes", name: "Lasagne Bolognaise Gratinée", price: 55, desc: "Feuilles de pâtes fraîches, bolognaise savoureuse, sauce béchamel onctueuse et fromage gratiné." },
  { category: "Pâtes & Lasagnes", name: "Pâtes Quatre Fromages", price: 65, desc: "Mélange fondant de 4 fromages affinés italiens liés à la crème délicate." },
  { category: "Pâtes & Lasagnes", name: "Pâtes Fruits de Mer", price: 65, desc: "Crevettes roses, calamars tendres et moules, liés d'une sauce crème à l'ail et persil frais." },

  // 5. Burgers & Tacos
  { category: "Burgers & Tacos", name: "Georgia Crispy Chicken", price: 37, desc: "Steak de poulet pané extra croustillant, laitue fraîche, fromage cheddar, sauce burger maison, sauce fromagère." },
  { category: "Burgers & Tacos", name: "Wisconsin Cheeseburger", price: 42, desc: "Steak haché de bœuf 90g, laitue, tomate, oignons caramélisés, cheddar fondu, sauces burger et fromagère." },
  { category: "Burgers & Tacos", name: "California Chili Thaï Chicken", price: 42, desc: "Steak poulet pané, laitue, cheddar, sauce chili thaï douce et relevée, sauce fromagère crémeuse." },
  { category: "Burgers & Tacos", name: "Florida Chicken BBQ", price: 45, desc: "Steak poulet pané, dinde fumée, oignons caramélisés, ananas caramélisé, cheddar, sauce barbecue." },
  { category: "Burgers & Tacos", name: "Texas Quality Burger", price: 47, desc: "Steak bœuf 90g, oeuf au plat coulant, laitue, tomate, oignon caramélisé, cheddar et sauces signatures." },
  { category: "Burgers & Tacos", name: "Tennessee BBQ Burger", price: 47, desc: "Steak bœuf 90g, dinde fumée croustillante, oignons caramélisés, ananas rôti, cheddar et sauce barbecue." },
  { category: "Burgers & Tacos", name: "New York Double Cheeseburger", price: 62, desc: "2 Steaks de bœuf 90g, oeuf au plat, double cheddar fondu, oignons caramélisés et duo de sauces." },
  { category: "Burgers & Tacos", name: "Tacos Poulet", price: 37, desc: "Galette de blé garnie d'émincé de poulet sauté, frites à l'intérieur et sauce cheddar crémeuse." },
  { category: "Burgers & Tacos", name: "Tacos Poulet Crispy", price: 37, desc: "Tacos garni de poulet croustillant pané, frites dorées et sauce fromagère cheddar." },
  { category: "Burgers & Tacos", name: "Tacos Viande Hachée", price: 40, desc: "Kefta épicée de bœuf, frites et sauce onctueuse au fromage cheddar." },
  { category: "Burgers & Tacos", name: "Tacos Mixte (Poulet & Kefta)", price: 40, desc: "Le meilleur des deux mondes : émincé de poulet et kefta, frites et fromage fondu." },
  { category: "Burgers & Tacos", name: "Kapsalon Poulet", price: 45, desc: "Lit de frites croustillantes, émincé de poulet, tomates, laitue, concombre, parmesan et sauce yaourt fraîche." },
  { category: "Burgers & Tacos", name: "Kapsalon Poulet Crispy", price: 45, desc: "Frites garnies de tenders de poulet croustillants, salade croquante, parmesan râpé et sauce yaourt." },

  // 6. Pizzas Artisanales
  { category: "Pizzas Artisanales", name: "Pizza Margarita", price: 35, desc: "Sauce tomate italienne maison, mozzarella fondante et origan sauvage." },
  { category: "Pizzas Artisanales", name: "Pizza Végétarienne", price: 40, desc: "Sauce tomate, brocoli, aubergine, courgette, poivrons, champignons frais, mozzarella." },
  { category: "Pizzas Artisanales", name: "Pizza Tonno", price: 40, desc: "Sauce tomate, thon de premier choix, mozzarella et origan." },
  { category: "Pizzas Artisanales", name: "Pizza Poulet & Champignons", price: 45, desc: "Sauce tomate, blanc de poulet émincé, champignons de Paris, mozzarella." },
  { category: "Pizzas Artisanales", name: "Pizza Bolognaise", price: 45, desc: "Sauce tomate, viande hachée de bœuf assaisonnée, mozzarella fondante." },
  { category: "Pizzas Artisanales", name: "Pizza Quatre Fromages", price: 45, desc: "Sauce tomate, harmonie de 4 fromages fondants et origan." },
  { category: "Pizzas Artisanales", name: "Pizza Quatre Saisons", price: 45, desc: "Sauce tomate, bolognaise, fruits de mer, poulet, légumes grillés, mozzarella." },
  { category: "Pizzas Artisanales", name: "Pizza Fruits de Mer", price: 60, desc: "Sauce tomate, crevettes, calamars, moules fraîches, mozzarella et origan." },

  // 7. Salades Fraîches
  { category: "Salades Fraîches", name: "Salade Marocaine", price: 25, desc: "Dés de tomates fraîches, oignons doux, poivron vert croquant, concombre, persil, coriandre et vinaigrette à l'huile d'olive." },
  { category: "Salades Fraîches", name: "Salade Russe", price: 30, desc: "Pommes de terre fondantes, carottes, petits pois, maïs doux, mayonnaise crémeuse, thon et œuf dur." },
  { category: "Salades Fraîches", name: "Salade Spéciale Maison", price: 35, desc: "Laitue croquante, tomate, concombre, maïs, thon ou poulet au choix, dés de fromage et sauce spéciale." },
  { category: "Salades Fraîches", name: "Salade César", price: 40, desc: "Cœur de laitue, poulet grillé ou pané au choix, croûtons dorés à l'ail, copeaux de parmesan, tomates cerises et sauce césar." },
  { category: "Salades Fraîches", name: "Salade Tropicale", price: 45, desc: "Laitue, ananas frais, avocat crémeux, crevettes roses, maïs doux, tomates cerises et sauce cocktail rosée." },

  // 8. Jus & Cocktails
  { category: "Jus & Cocktails", name: "Jus de Citron", price: 22, desc: "Citron frais pressé minute." },
  { category: "Jus & Cocktails", name: "Jus d'Orange Pressé", price: 22, desc: "Orange fraîche pressée minute." },
  { category: "Jus & Cocktails", name: "Jus de Carotte Pressée", price: 22, desc: "Carotte fraîche pressée minute." },
  { category: "Jus & Cocktails", name: "Jus d'Amande au Lait", price: 25, desc: "Amandes fraîches mixées au lait velouté." },
  { category: "Jus & Cocktails", name: "Jus de Fraise", price: 25, desc: "Fraises fraîches de saison." },
  { category: "Jus & Cocktails", name: "Jus de Pêche", price: 25, desc: "Pêche juteuse pressée minute." },
  { category: "Jus & Cocktails", name: "Jus de Banane", price: 25, desc: "Banane fraîche mixée au lait." },
  { category: "Jus & Cocktails", name: "Jus d'Avocat", price: 25, desc: "Avocat crémeux pressé minute." },
  { category: "Jus & Cocktails", name: "Jus de Papaye", price: 25, desc: "Papaye fraîche parfumée." },
  { category: "Jus & Cocktails", name: "Jus de Kiwi", price: 25, desc: "Kiwi frais riche en vitamines." },
  { category: "Jus & Cocktails", name: "Pomme Pressée", price: 25, desc: "Pommes fraîches pressées minute." },
  { category: "Jus & Cocktails", name: "Poire Pressée", price: 25, desc: "Poires fraîches juteuses." },
  { category: "Jus & Cocktails", name: "Raisin Pressé", price: 25, desc: "Raisin frais pressé minute." },
  { category: "Jus & Cocktails", name: "Grenade Pressée", price: 25, desc: "Grenade fraîche naturelle." },
  { category: "Jus & Cocktails", name: "Pastèque Pressée", price: 25, desc: "Pastèque fraîche et désaltérante." },
  { category: "Jus & Cocktails", name: "Ananas Pressé", price: 30, desc: "Ananas frais pressé minute." },
  { category: "Jus & Cocktails", name: "Avocat aux Amandes", price: 27, desc: "Avocat onctueux garni d'amandes concassées." },
  { category: "Jus & Cocktails", name: "Jus Panaché", price: 28, desc: "Cocktail de fruits frais de saison mixés." },
  { category: "Jus & Cocktails", name: "Avocat aux Fruits Secs", price: 29, desc: "Avocat crémeux aux assortiments de fruits secs nobles." },
  { category: "Jus & Cocktails", name: "Jus de Mangue", price: 30, desc: "Mangue mûre et parfumée." },
  { category: "Jus & Cocktails", name: "Jus de Fruit du Dragon", price: 30, desc: "Pitaya (fruit du dragon) frais exotique." },
  { category: "Jus & Cocktails", name: "Smoothie Fraise", price: 30, desc: "Fraise, lait, yaourt onctueux et boule de glace vanille." },
  { category: "Jus & Cocktails", name: "Smoothie Pêche", price: 30, desc: "Pêche juteuse, lait, yaourt et glace." },
  { category: "Jus & Cocktails", name: "Smoothie Banane", price: 30, desc: "Banane, lait, yaourt et boule de glace." },
  { category: "Jus & Cocktails", name: "Smoothie Mangue", price: 35, desc: "Mangue mûre, lait, yaourt et boule de glace." },
  { category: "Jus & Cocktails", name: "Classic Detox", price: 28, desc: "Carotte, pomme croquante, gingembre frais, citron et orange." },
  { category: "Jus & Cocktails", name: "Green Detox", price: 28, desc: "Concombre, citron vert, pomme verte, gingembre et céleri." },
  { category: "Jus & Cocktails", name: "Yellow Detox", price: 30, desc: "Citron pressé, ananas doux et gingembre dynamisant." },
  { category: "Jus & Cocktails", name: "Mojito Virgin", price: 28, desc: "Menthe fraîche pilée, citron vert, sucre de canne et eau gazeuse." },
  { category: "Jus & Cocktails", name: "Mojito Tropical / Fruits", price: 30, desc: "Au choix : Tropical, Fraise, Blue Curaçao, Pastèque ou Piña Colada." },
  { category: "Jus & Cocktails", name: "Mojito Red Bull", price: 50, desc: "Mojito énergisant au Red Bull et citron vert." },
  { category: "Jus & Cocktails", name: "Bleu / Green Mocktail", price: 35, desc: "Cocktail sans alcool aux agrumes et sirops artisanaux bleus ou verts." },
  { category: "Jus & Cocktails", name: "House Mocktail Prestige", price: 40, desc: "Création secrète du barman aux saveurs florales et fruits exotiques." },

  // 9. Cafés & Thés
  { category: "Cafés & Thés", name: "Café Espresso", price: 14, desc: "Espresso intense 100% arabica." },
  { category: "Cafés & Thés", name: "Café Américain", price: 14, desc: "Café long doux et équilibré." },
  { category: "Cafés & Thés", name: "Café au Lait", price: 15, desc: "Café espresso avec mousse de lait onctueuse." },
  { category: "Cafés & Thés", name: "Double Espresso", price: 16, desc: "Double shot d'espresso corsé." },
  { category: "Cafés & Thés", name: "Cappuccino Italien", price: 20, desc: "Espresso, lait chaud et mousse de lait crémeuse saupoudrée de cacao." },
  { category: "Cafés & Thés", name: "Cappuccino Viennois", price: 20, desc: "Espresso coiffé d'un dôme de crème Chantilly maison." },
  { category: "Cafés & Thés", name: "Latte Macchiato", price: 20, desc: "Lait chaud marbré d'un shot d'espresso et mousse délicate." },
  { category: "Cafés & Thés", name: "Nespresso / au Lait", price: 20, desc: "Sélection grands crus Nespresso avec ou sans lait." },
  { category: "Cafés & Thés", name: "Chocolat Chaud", price: 14, desc: "Chocolat au lait crémeux et velouté." },
  { category: "Cafés & Thés", name: "Chocolat Chantilly", price: 18, desc: "Chocolat chaud gourmand surmonté de crème Chantilly." },
  { category: "Cafés & Thés", name: "Thé Vert à la Menthe", price: 14, desc: "Thé vert traditionnel marocain à la menthe fraîche." },
  { category: "Cafés & Thés", name: "Thé Noir / Anglais", price: 14, desc: "Thé noir sélection fine façon English Breakfast." },
  { category: "Cafés & Thés", name: "Infusion / Verveine", price: 14, desc: "Infusion apaisante de verveine ou camomille." },
  { category: "Cafés & Thés", name: "Sidi Ali 33cl", price: 4, desc: "Eau minérale naturelle pure 33cl." },
  { category: "Cafés & Thés", name: "Sidi Ali 50cl", price: 7, desc: "Eau minérale naturelle pure 50cl." },
  { category: "Cafés & Thés", name: "Sidi Ali Familial 1.5L", price: 12, desc: "Bouteille familiale d'eau minérale 1.5L." },
  { category: "Cafés & Thés", name: "Sodas (Coca, Sprite, Hawai)", price: 15, desc: "Boissons gazeuses fraîches au choix." },

  // 10. Desserts Maison
  { category: "Desserts Maison", name: "Flan Caramel Maison", price: 15, desc: "Flan traditionnel nappé d'un caramel doré velouté." },
  { category: "Desserts Maison", name: "Mhalabiya aux Épices", price: 15, desc: "Crème de lait orientale parfumée à l'eau de fleur d'oranger et pistaches." },
  { category: "Desserts Maison", name: "Tarte au Citron Meringuée", price: 20, desc: "Pâte sablée pur beurre, crème de citron acidulée et meringue dorée." },
  { category: "Desserts Maison", name: "Cheesecake New Yorkais", price: 20, desc: "Biscuit croustillant, crème onctueuse au fromage frais et coulis de fruits rouges." },
  { category: "Desserts Maison", name: "Tiramisu Tradizionale", price: 20, desc: "Biscuits cuillères imbibés de café espresso, mascarpone fouetté et cacao noir amer." },
];

const categoryDescriptions = {
  "Petit Déjeuner": "Le réveil gourmand & brunch - فطور الصباح والبرانش",
  "Cuisine Marocaine": "La tradition dans toute sa splendeur - المطبخ المغربي",
  "Plats & Grillades": "La perfection du feu et des saveurs - أطباق الشيف والمشويات",
  "Pâtes & Lasagnes": "Al dente, généreuses & crémeuses - المعكرونة واللازانيا",
  "Burgers & Tacos": "Saveurs urbaines avec frites - برجر وتاكوس",
  "Pizzas Artisanales": "Pâte croustillante & mozzarella - البيتزا الإيطالية",
  "Salades Fraîches": "Légèreté, fraîcheur & vitamines - السلطات الطازجة",
  "Jus & Cocktails": "Fruits frais pressés minute - العصائر والكوكتيل",
  "Cafés & Thés": "Torréfaction d'exception & infusions - القهوة والشاي",
  "Desserts Maison": "La note sucrée pour terminer - الحلويات المنزلية"
};

function generateSql() {
  const categories = Object.keys(categoryDescriptions);
  let sql = `-- ==============================================================================
-- 🏛️ HOUSE PUBLIQUE — SCRIPT D'IMPORTATION DU MENU COMPLET (10 Catégories & 148 Produits)
-- Monnaie: Dirham Marocain (DH / MAD)
-- Exécutable directement dans l'éditeur SQL de Supabase (Idempotent: ne crée pas de doublons)
-- ==============================================================================

DO $$
DECLARE
  v_cat_id uuid;
BEGIN

`;

  for (const cat of categories) {
    const desc = categoryDescriptions[cat].replace(/'/g, "''");
    const safeCat = cat.replace(/'/g, "''");

    sql += `  -- --------------------------------------------------------------------------\n`;
    sql += `  -- Catégorie: ${cat}\n`;
    sql += `  -- --------------------------------------------------------------------------\n`;
    sql += `  SELECT id INTO v_cat_id FROM categories WHERE name = '${safeCat}' LIMIT 1;\n`;
    sql += `  IF v_cat_id IS NULL THEN\n`;
    sql += `    INSERT INTO categories (name, description) VALUES ('${safeCat}', '${desc}') RETURNING id INTO v_cat_id;\n`;
    sql += `  ELSE\n`;
    sql += `    UPDATE categories SET description = '${desc}' WHERE id = v_cat_id;\n`;
    sql += `  END IF;\n\n`;

    const prods = menuData.filter(p => p.category === cat);
    for (const p of prods) {
      const safeName = p.name.replace(/'/g, "''");
      const safeDesc = p.desc.replace(/'/g, "''");
      sql += `  IF NOT EXISTS (SELECT 1 FROM products WHERE name = '${safeName}' AND category_id = v_cat_id) THEN\n`;
      sql += `    INSERT INTO products (category_id, name, description, base_price, available)\n`;
      sql += `    VALUES (v_cat_id, '${safeName}', '${safeDesc}', ${p.price}, true);\n`;
      sql += `  ELSE\n`;
      sql += `    UPDATE products SET base_price = ${p.price}, description = '${safeDesc}' WHERE name = '${safeName}' AND category_id = v_cat_id;\n`;
      sql += `  END IF;\n`;
    }
    sql += `\n`;
  }

  sql += `  RAISE NOTICE '✅ Menu House Publique importé avec succès (10 catégories, ${menuData.length} produits) !';\n`;
  sql += `END $$;\n`;

  return sql;
}

const sql = generateSql();
const outPath = path.resolve('supabase/migrations/seed_house_publique_menu.sql');
fs.writeFileSync(outPath, sql, 'utf-8');
console.log(`Generated SQL script at: ${outPath}`);
console.log(`Total products: ${menuData.length}`);

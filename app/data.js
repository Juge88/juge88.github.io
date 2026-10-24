// Starting data. Everything can be edited or added to inside the app.

/* ---------- Wood library ---------- */
// [id, name, color, grain color, origin, story]
const WOOD_LIBRARY = [
  ['walnut', 'Walnut', '#4a3226', '#5e4030', 'Eastern United States', 'Black walnut grows across the eastern United States. Its deep chocolate color has made it a favorite of furniture makers for generations, and it mellows to a warm, honeyed brown over the years.'],
  ['cherry', 'Cherry', '#a8623d', '#b8714a', 'Eastern United States', 'American cherry starts out a soft pinkish tan and slowly deepens to a rich reddish brown with light and time, so it keeps getting richer as you use it.'],
  ['maple', 'Maple', '#e6d3b0', '#efdfc0', 'Northern United States and Canada', 'Hard maple is the classic kitchen wood. It is dense, tight-grained and tough, which is why butcher blocks have been made from it for over a century.'],
  ['sapele', 'Sapele', '#7a3e27', '#8c4a30', 'West and Central Africa', 'Sapele is a relative of mahogany from the forests of West and Central Africa. Its interlocking grain gives it a shimmering ribbon figure that seems to move as the light changes.'],
  ['purpleheart', 'Purpleheart', '#6b2f5b', '#7d3a6b', 'Central and South America', 'Purpleheart comes from Central and South America. Freshly cut it is a dull brown, and it turns this vivid purple once it meets air and light. It is one of the hardest, strongest woods in the shop.'],
  ['mulberry', 'Mulberry', '#b5893a', '#c49a48', 'Grown locally', 'Mulberry is rarely sold commercially, so it usually comes from a single tree. It starts a bright golden yellow and ages to a deep russet gold.'],
  ['padauk', 'Padauk', '#b4442a', '#c4512f', 'West Africa', 'African padauk is famous for its glowing orange-red color, one of the few woods this vivid with no stain at all. It mellows to a warm reddish brown over time.'],
  ['hickory', 'Hickory', '#c9a27a', '#b38b62', 'Eastern United States', 'Hickory is one of the toughest woods in North America, the wood of axe handles and wagon wheels. Its creamy sapwood and brown heartwood often mix in the same board.'],
  ['oak-white', 'White oak', '#c6a77d', '#b39066', 'Eastern United States', 'White oak has been used for whiskey barrels and ship hulls for centuries because its pores are naturally sealed. Quartersawn boards show bright ray fleck across the grain.'],
  ['oak-red', 'Red oak', '#c89a77', '#b5845f', 'Eastern United States', 'Red oak is one of the most familiar hardwoods in America, with a warm pinkish tone and a bold, open grain pattern.'],
  ['ash', 'Ash', '#dcc9a3', '#c9b48a', 'Eastern United States', 'White ash is strong and springy, the traditional wood of baseball bats and tool handles. It has a bright, pale color and a bold grain.'],
  ['birch', 'Birch', '#e7d4b0', '#d8c29a', 'Northern United States and Canada', 'Yellow birch is a pale, even hardwood from the northern forests, close in hardness to maple with a soft golden glow.'],
  ['beech', 'Beech', '#d9b48f', '#c99f78', 'Eastern United States and Europe', 'Beech is a classic European kitchen wood, used for spoons and rolling pins for generations. It is hard, smooth and has a fine, flecked grain.'],
  ['poplar', 'Poplar', '#c9c79a', '#a9a77a', 'Eastern United States', 'Tulip poplar is a light, easy-working hardwood. Its heartwood can carry surprising streaks of green and even purple.'],
  ['alder', 'Alder', '#c98f62', '#b87e52', 'Pacific Northwest', 'Red alder grows along the Pacific coast. It is soft-toned and even, with a warm honey color.'],
  ['pecan', 'Pecan', '#b88a5e', '#a37650', 'Southern United States', 'Pecan is a member of the hickory family, just as tough, with a warm brown color and an open grain.'],
  ['sycamore', 'Sycamore', '#dcc3a4', '#c4a581', 'Eastern United States', 'Quartersawn American sycamore shows a striking lacewood-like fleck across a pale, creamy surface.'],
  ['elm', 'Elm', '#b8865c', '#a3714a', 'Eastern United States', 'Elm has wild, interlocked grain that made it the wood of choice for wagon hubs. Its warm brown boards often show beautiful figure.'],
  ['honey-locust', 'Honey locust', '#c08856', '#a8703f', 'Central United States', 'Honey locust has a glowing reddish-gold heartwood and is almost as hard as hickory.'],
  ['black-locust', 'Black locust', '#b79a45', '#9e8236', 'Eastern United States', 'Black locust is one of the most rot-resistant woods in North America, once used for fence posts that lasted generations. Its heartwood is a golden olive color.'],
  ['osage', 'Osage orange', '#d59a1e', '#bf8414', 'South-central United States', 'Osage orange is the wood of the traditional longbow. Fresh cut it is a bright golden yellow, and it slowly darkens to a rich amber brown.'],
  ['mesquite', 'Mesquite', '#8e5a3a', '#7a4a2e', 'Southwestern United States', 'Mesquite grows in the desert Southwest. It is hard, stable and full of character, with a deep reddish-brown color.'],
  ['myrtle', 'Oregon myrtle', '#b9a074', '#9c8459', 'Oregon and Northern California', 'Myrtlewood grows only along a short stretch of the Oregon and California coast, and its boards often swirl with gold, gray and brown figure.'],
  ['madrone', 'Madrone', '#b9714e', '#a65f3f', 'Pacific Coast', 'Madrone is a West Coast tree with peeling red bark. Its wood is dense and a soft salmon-pink color.'],
  ['oak-live', 'Live oak', '#a98463', '#8f6c4f', 'Southern United States', 'Live oak is so dense it was used to frame the USS Constitution, nicknamed Old Ironsides.'],
  ['butternut', 'Butternut', '#c8a274', '#b08a5c', 'Eastern United States', 'Butternut is a lighter cousin of black walnut, sometimes called white walnut, with the same grain in a soft tan color.'],
  ['mahogany', 'Mahogany', '#8d4a30', '#9e5a3c', 'Central and South America', 'Genuine mahogany has been treasured for fine furniture for centuries, with a warm reddish-brown color and a soft shimmer.'],
  ['bubinga', 'Bubinga', '#8f3d2d', '#a24b38', 'Central Africa', 'Bubinga comes from equatorial Africa. Its pinkish-red wood is often streaked with darker purple lines.'],
  ['wenge', 'Wenge', '#3b2a22', '#5a4334', 'Central Africa', 'Wenge is a dark, dramatic African hardwood, nearly black, with fine lighter streaks running through it.'],
  ['zebrawood', 'Zebrawood', '#c9a46a', '#4c3626', 'West Africa', 'Zebrawood earns its name from bold dark stripes across a light golden background.'],
  ['bloodwood', 'Bloodwood', '#7e1f1c', '#922a24', 'Central and South America', 'Bloodwood is a deep, vivid red hardwood from Central and South America, one of the richest reds in nature.'],
  ['canarywood', 'Canarywood', '#d9a24e', '#b98238', 'South America', 'Canarywood is golden yellow to orange, often streaked with pink, purple and brown.'],
  ['yellowheart', 'Yellowheart', '#e3c044', '#c9a632', 'Brazil', 'Yellowheart is a bright lemon-yellow hardwood from Brazil, one of the few truly yellow woods.'],
  ['leopardwood', 'Leopardwood', '#b5704a', '#7a4428', 'South America', 'Leopardwood is covered in a spotted fleck pattern that looks just like its namesake.'],
  ['goncalo', 'Goncalo alves', '#a8703e', '#4d3221', 'Central and South America', 'Goncalo alves is sometimes called tigerwood for its dark streaks across a warm golden-brown background.'],
  ['cocobolo', 'Cocobolo', '#9a4a24', '#4a2414', 'Central America', 'Cocobolo is a prized rosewood from Central America, full of oranges, reds and dark streaks.'],
  ['ebony', 'Ebony', '#1e1a18', '#2e2824', 'Africa and Asia', 'Ebony is the classic black wood of piano keys and fine instruments, dense enough to sink in water.'],
  ['rosewood', 'Rosewood', '#5e3428', '#3e2219', 'Tropical regions', 'Rosewood has long been prized for fine instruments, with a rich dark color and a faint sweet scent when cut.'],
  ['teak', 'Teak', '#a97a45', '#946638', 'Southeast Asia', 'Teak is naturally oily and nearly waterproof, the traditional wood of ship decks.'],
  ['jatoba', 'Jatoba', '#8c3f28', '#a14d31', 'Central and South America', 'Jatoba, sometimes called Brazilian cherry, is a hard, reddish-brown wood that darkens beautifully with age.'],
  ['lacewood', 'Lacewood', '#b77e55', '#8c5735', 'Brazil and Australia', 'Lacewood is covered in a lace-like pattern of flecks that catches the light.'],
  ['peruvian-walnut', 'Peruvian walnut', '#3e2b22', '#4f382c', 'South America', 'Peruvian walnut is a darker, chocolate-toned cousin of black walnut from the Andes.'],
  ['spalted-maple', 'Spalted maple', '#d8c5a0', '#4a3c30', 'North America', 'Spalted maple carries dark lines drawn by natural fungi before the wood was dried, so no two boards are alike.'],
  ['curly-maple', 'Curly maple', '#e3cc9c', '#c7a873', 'North America', 'Curly maple has a rippling tiger-stripe figure that seems to shift as you turn it in the light.'],
  ['birdseye', 'Birdseye maple', '#e6d0a4', '#c9ad7e', 'North America', 'Birdseye maple is dotted with tiny swirling eyes, a rare figure that is still not fully understood.'],
  ['cedar', 'Aromatic cedar', '#b5674e', '#d9b38c', 'Eastern United States', 'Aromatic red cedar is known for its fresh scent and bright mix of purple-red heartwood and cream sapwood.'],
  ['olive', 'Olive', '#c9ab7a', '#6e5536', 'Mediterranean', 'Olive wood comes from old orchard trees around the Mediterranean, with wild dark swirls through a creamy gold background.'],
  ['acacia', 'Acacia', '#a8743f', '#8a5c2f', 'Asia and Australia', 'Acacia is a hard, water-resistant wood with warm golden-brown tones and lively grain.'],
  ['bamboo', 'Bamboo', '#d7bd8a', '#c2a672', 'Asia', 'Bamboo is technically a grass, pressed and laminated into a hard, fast-renewing material.'],
  ['ipe', 'Ipe', '#6e4a2e', '#5a3c25', 'South America', 'Ipe is one of the hardest and densest woods in the world, so tough it is used for boardwalks.'],
  ['tigerwood', 'Tigerwood', '#b86f35', '#5a3418', 'South America', 'Tigerwood shows bold dark stripes over a bright orange-brown background.'],
  ['amendoim', 'Amendoim', '#b27e56', '#9c6b46', 'South America', 'Amendoim is a warm, even, honey-brown hardwood from South America.'],
  ['chakte-viga', 'Chakte viga', '#c8562b', '#b14a24', 'Central America', 'Chakte viga is a bright orange hardwood from Central America that mellows to a warm red-brown.'],
  ['katalox', 'Katalox', '#3a2433', '#4c2f43', 'Central America', 'Katalox is sometimes called Mexican royal ebony, a nearly black wood with a hint of deep purple.'],
  ['granadillo', 'Granadillo', '#7a3b26', '#5a2a1a', 'Central America', 'Granadillo is a dense, reddish-brown relative of rosewood from Mexico and Central America.'],
  ['redheart', 'Redheart', '#c2403a', '#a83430', 'Central America', 'Redheart is a bright, almost cherry-red wood from Central America.'],
  ['satinwood', 'Satinwood', '#e0b75c', '#c99d45', 'Tropical regions', 'Satinwood has a golden color and a shimmering, satin-like luster.'],
  ['holly', 'Holly', '#efe9dc', '#e2d9c6', 'Eastern United States', 'Holly is the whitest wood in North America, prized for inlay and contrast.'],
  ['basswood', 'Basswood', '#e5d6b8', '#d6c4a0', 'Eastern United States', 'Basswood is soft and pale, the traditional wood of carvers.'],
  ['apple', 'Apple', '#c69a78', '#a97d5d', 'Orchards', 'Apple wood usually comes from old orchard trees, with a soft pinkish-tan color and tight grain.'],
  ['pear', 'Pear', '#c99a7c', '#b5876a', 'Orchards and Europe', 'Pear wood is smooth, even and pinkish, long used for carving and instrument parts.'],
  ['plum', 'Plum', '#9c5a46', '#7d4636', 'Orchards', 'Plum wood is rare in large pieces, with warm purple-brown heartwood and bright sapwood.'],
  ['eucalyptus', 'Eucalyptus', '#c0835d', '#a96d4a', 'Australia and California', 'Eucalyptus grows fast and hard, with a reddish color and interlocked grain.'],
  ['purpleheart-aged', 'Aged purpleheart', '#5a2f45', '#6a3a52', 'Central and South America', 'This purpleheart has aged to a deep plum brown, the way it does after years in the light.'],
  ['bocote', 'Bocote', '#a97c47', '#3b2a1a', 'Central America', 'Bocote is full of dark, wavy figure over a golden-brown background, often with tiny eye patterns.'],
  ['marblewood', 'Marblewood', '#c9a77c', '#3a2a20', 'South America', 'Marblewood has dark, marble-like streaks across a light golden background.'],
  ['sipo', 'Sipo', '#8e4a33', '#a25a40', 'West Africa', 'Sipo, also called utile, is an African mahogany with a warm reddish-brown color and a ribbon figure.'],
  ['afzelia', 'Afzelia', '#a5653a', '#8e542e', 'Africa', 'Afzelia is a durable, reddish-brown African hardwood that ages to a deep bronze.'],
  ['tamarind', 'Spalted tamarind', '#d2b48a', '#5a4630', 'Southeast Asia', 'Spalted tamarind combines a creamy sapwood with dark spalting lines and a reddish heart.']  ,
  ['soft-maple', 'Soft maple', '#dcc6a0', '#c9ae86', 'Eastern United States', 'Soft maple, from red and silver maple trees, is a little lighter and softer than hard maple, with a warm, creamy color and gentle grain.'],
  ['ambrosia-maple', 'Ambrosia maple', '#d8c3a0', '#7b6a5a', 'Eastern United States', 'Ambrosia maple gets its gray and brown streaks from tiny ambrosia beetles, which carry a fungus that stains the wood as they tunnel. No two boards are alike.'],
  ['quilted-maple', 'Quilted maple', '#e2c999', '#c4a571', 'Pacific Northwest', 'Quilted maple shows a rippling, three-dimensional figure that looks like a quilt or rolling water, a rare figure found mostly in bigleaf maple.'],
  ['box-elder', 'Box elder', '#e3d6c0', '#c0444a', 'North America', 'Box elder is a humble maple that sometimes carries bright streaks of red and pink through its creamy white wood.'],
  ['claro-walnut', 'Claro walnut', '#5a3e2c', '#3a2619', 'California', 'Claro walnut comes from California orchards, where English walnut was grafted onto native rootstock. It is famous for wild figure and swirling dark streaks.'],
  ['english-walnut', 'English walnut', '#6b4c35', '#4a3222', 'Europe and Asia', 'English walnut, also called European walnut, is a little lighter and softer in tone than black walnut, often with beautiful dark streaking.'],
  ['chestnut', 'Chestnut', '#b48a5c', '#9a7448', 'Eastern United States', 'American chestnut once filled the eastern forests before a blight wiped it out in the early 1900s. Nearly all chestnut lumber today is reclaimed from old barns and buildings.'],
  ['hackberry', 'Hackberry', '#ddcfb3', '#c6b593', 'Central and Eastern United States', 'Hackberry is a pale, creamy relative of elm with a soft, wavy grain.'],
  ['catalpa', 'Catalpa', '#b7976b', '#9e7f55', 'Central and Southern United States', 'Catalpa is a light, golden-brown wood with a bold grain and a faint spicy scent when cut.'],
  ['sassafras', 'Sassafras', '#b98c5f', '#a3774c', 'Eastern United States', 'Sassafras is known for the root beer scent its wood gives off when cut. It has a warm, light brown color and an open grain much like ash.'],
  ['persimmon', 'Persimmon', '#d0bfa3', '#3a2e27', 'Southern United States', 'American persimmon is a close relative of ebony. Its pale sapwood is very hard and was once used for golf club heads.'],
  ['dogwood', 'Dogwood', '#d8c2a2', '#b99d78', 'Eastern United States', 'Dogwood is one of the hardest, smoothest North American woods, once used for weaving shuttles and tool handles.'],
  ['hornbeam', 'Hornbeam', '#e2d7c4', '#cbbda6', 'Eastern North America and Europe', 'Hornbeam, sometimes called ironwood, is one of the toughest pale woods there is, traditionally used for mallets and chopping blocks.'],
  ['sweetgum', 'Sweetgum', '#c09a7e', '#a07a5c', 'Southeastern United States', 'Sweetgum heartwood has a soft reddish-brown color, sometimes with darker streaks, and a smooth, even texture.'],
  ['tupelo', 'Tupelo', '#d9cdb3', '#c4b495', 'Southeastern United States', 'Tupelo grows in southern swamps. It is light, smooth and famous among carvers, and its blossoms give tupelo honey.'],
  ['magnolia', 'Magnolia', '#c9bf98', '#9f9a6e', 'Southeastern United States', 'Southern magnolia has a soft, creamy wood that often carries a greenish tint.'],
  ['aspen', 'Aspen', '#e6dcc6', '#d3c6aa', 'North America', 'Aspen is a soft, pale, featherlight wood that stays cool to the touch, which is why it is used for sauna benches.'],
  ['cottonwood', 'Cottonwood', '#d8ccb0', '#bfb08e', 'North America', 'Cottonwood grows along rivers across North America, with a pale, even wood and a soft texture.'],
  ['pine', 'Pine', '#e3c690', '#c89f62', 'North America', 'Pine is the classic soft, golden wood of farmhouse tables, with bold grain lines and knots full of character.'],
  ['douglas-fir', 'Douglas fir', '#d9a877', '#bd8a59', 'Pacific Northwest', 'Douglas fir is one of the strongest softwoods, with straight, high-contrast grain and a warm reddish-orange glow.'],
  ['redwood', 'Redwood', '#a85a3e', '#8f4930', 'Northern California', 'Redwood comes from the tallest trees on Earth, along the Northern California coast. Its soft red wood resists rot and insects.'],
  ['cypress', 'Cypress', '#d6b98b', '#bc9b6b', 'Southeastern United States', 'Bald cypress grows in southern swamps and is naturally rot resistant, prized for boats and outdoor work.'],
  ['western-cedar', 'Western red cedar', '#b47a55', '#985f40', 'Pacific Northwest', 'Western red cedar is light, aromatic and naturally weather resistant, with a warm reddish-brown color.'],
  ['spanish-cedar', 'Spanish cedar', '#b4704e', '#9c5c3e', 'Central and South America', 'Spanish cedar is actually a relative of mahogany. It has a spicy scent and is the traditional wood for cigar boxes.'],
  ['oak-english', 'English oak', '#b98e60', '#9e754a', 'Europe', 'European oak built cathedrals, ships and barrels for centuries. It is strong and handsome, with a warm golden-brown color.'],
  ['oak-bog', 'Bog oak', '#2f2a26', '#46403a', 'Europe', 'Bog oak has been buried in peat bogs for centuries or even thousands of years, turning it a deep, near-black color.'],
  ['khaya', 'African mahogany', '#a65a3c', '#8c4a30', 'West Africa', 'African mahogany, or khaya, is a warm reddish-brown wood with an interlocked grain that shimmers in the light.'],
  ['anigre', 'Anigre', '#e1c49a', '#cba97c', 'Central and East Africa', 'Anigre is a pale, pinkish-tan African wood, often with a lovely shimmering figure.'],
  ['avodire', 'Avodire', '#e8d39b', '#d4bc7e', 'West Africa', 'Avodire is a pale golden African wood with a bright, satiny luster.'],
  ['african-blackwood', 'African blackwood', '#231c1c', '#3a2c2d', 'East Africa', 'African blackwood is one of the densest woods on Earth, nearly black and the classic material for clarinets and bagpipes.'],
  ['macassar-ebony', 'Macassar ebony', '#4a3424', '#1f1712', 'Indonesia', 'Macassar ebony has bold stripes of black and chocolate brown, one of the most dramatic woods in the world.'],
  ['gaboon-ebony', 'Gaboon ebony', '#141110', '#272220', 'West Africa', 'Gaboon ebony is the deepest jet-black of all the ebonies.'],
  ['iroko', 'Iroko', '#a6773e', '#8c6230', 'West Africa', 'Iroko is a durable golden-brown African hardwood, sometimes called African teak.'],
  ['afrormosia', 'Afrormosia', '#a17a4a', '#86623a', 'West Africa', 'Afrormosia is a fine-grained, golden-brown African hardwood, often used in place of teak.'],
  ['limba', 'Limba', '#d8c497', '#5d4a34', 'West Africa', 'Limba comes in a pale form and a dark, streaked form called black limba, prized for guitar bodies.'],
  ['makore', 'Makore', '#9e4c38', '#85402e', 'West Africa', 'Makore is a reddish-brown African hardwood with a fine, often shimmering figure.'],
  ['mopane', 'Mopane', '#5e3b2b', '#3c2519', 'Southern Africa', 'Mopane is an extremely dense, dark reddish-brown wood from southern Africa, popular for turning and instruments.'],
  ['muninga', 'Muninga', '#9a5a32', '#7e4826', 'Southern Africa', 'Muninga, a relative of padauk, is a golden-brown to reddish wood with gentle stripes.'],
  ['pink-ivory', 'Pink ivory', '#d4677a', '#bf5468', 'Southern Africa', 'Pink ivory is one of the rarest woods in the world, a brilliant natural pink once reserved for Zulu royalty.'],
  ['ovangkol', 'Ovangkol', '#a77b47', '#5a4028', 'West Africa', 'Ovangkol is a golden-brown African wood with dark stripes, closely related to bubinga.'],
  ['cumaru', 'Cumaru', '#9a6b3e', '#7f5530', 'South America', 'Cumaru, sometimes called Brazilian teak, is a very hard, golden-to-reddish-brown wood with a faint vanilla scent.'],
  ['greenheart', 'Greenheart', '#5f6440', '#4b5032', 'Guyana', 'Greenheart is a tough, olive-green South American wood used for docks and canal locks because it lasts in water.'],
  ['imbuia', 'Imbuia', '#5c4330', '#3e2c1f', 'Brazil', 'Imbuia, sometimes called Brazilian walnut, is a rich brown wood with a spicy scent and lovely figure.'],
  ['kingwood', 'Kingwood', '#5b2e2b', '#2f1715', 'Brazil', 'Kingwood is a rare violet-brown rosewood with fine black stripes, once favored by French royal cabinetmakers.'],
  ['tulipwood-br', 'Brazilian tulipwood', '#d79a84', '#b5534a', 'Brazil', 'Brazilian tulipwood is a rare rosewood with candy-like stripes of pink, salmon and red.'],
  ['pau-ferro', 'Pau ferro', '#7a5034', '#4e301e', 'Bolivia and Brazil', 'Pau ferro, or Bolivian rosewood, is a dense, dark brown wood with purple and black streaks, popular for guitar fretboards.'],
  ['santos-mahogany', 'Santos mahogany', '#8c3e2a', '#73321f', 'Central and South America', 'Santos mahogany is a hard, deep red wood with a shimmering ribbon figure.'],
  ['peroba', 'Peroba rosa', '#c08a6a', '#a87256', 'Brazil', 'Peroba rosa is a pinkish-tan Brazilian hardwood that darkens to a warm brown.'],
  ['curupay', 'Curupay', '#7d4a33', '#62382a', 'South America', 'Curupay is a very dense, reddish-brown South American hardwood with dark streaks.'],
  ['ziricote', 'Ziricote', '#4b3a2e', '#211813', 'Central America', 'Ziricote is famous for its spider-web figure, dark lines that swirl through a smoky brown background.'],
  ['honduran-rosewood', 'Honduran rosewood', '#8a5a44', '#4f3022', 'Central America', 'Honduran rosewood is dense and ringing, used for marimba bars, with a warm pinkish-brown color.'],
  ['honduran-mahogany', 'Honduran mahogany', '#a05a3d', '#87482f', 'Central and South America', 'Honduran mahogany, the classic big-leaf mahogany, is a stable, reddish-brown wood treasured by furniture makers for centuries.'],
  ['lignum-vitae', 'Lignum vitae', '#4f5a3a', '#384029', 'Caribbean', 'Lignum vitae is one of the hardest and heaviest woods in the world, so naturally oily it was used for ship propeller bearings.'],
  ['verawood', 'Verawood', '#6f7a3e', '#56602e', 'South America', 'Verawood, sometimes called Argentine lignum vitae, is a dense, olive-green wood that darkens with time.'],
  ['snakewood', 'Snakewood', '#8a4a2a', '#2e1a10', 'South America', 'Snakewood is covered in dark markings that look like snakeskin, one of the rarest and most expensive woods in the world.'],
  ['bloodwood-af', 'Brazilian satinwood', '#c98a3a', '#ad722c', 'South America', 'Brazilian satinwood, or muirapiranga, is a golden-orange wood with a satin sheen.'],
  ['coffee', 'Coffeewood', '#5a4232', '#3e2c20', 'Tropical regions', 'Coffeewood is a dense, dark brown wood with a fine, even grain.'],
  ['jarrah', 'Jarrah', '#7a2e24', '#62251c', 'Western Australia', 'Jarrah is a deep red Australian eucalyptus, dense and durable, once used for railway sleepers around the world.'],
  ['koa', 'Koa', '#a46a3c', '#7d4e2b', 'Hawaii', 'Koa grows only in Hawaii. Its golden-brown wood often carries a deep, shimmering curl, and it is treasured for ukuleles.'],
  ['narra', 'Narra', '#b45e3c', '#994d2f', 'Southeast Asia', 'Narra is the national tree of the Philippines, a golden-to-red relative of padauk.'],
  ['mango', 'Mango', '#c8a77c', '#8a7055', 'Tropical regions', 'Mango wood comes from fruit trees that have finished producing, often with spalted streaks of gray and gold.'],
  ['monkeypod', 'Monkeypod', '#8a6440', '#5c3f26', 'Tropical regions', 'Monkeypod, or suar, has rich golden-brown wood with darker streaks and a pale edge.'],
  ['camphor', 'Camphor', '#c09a6c', '#9a7a55', 'Asia', 'Camphor wood has a strong, fresh scent that keeps moths away, which is why it was used for storage chests.'],
  ['sapele-quartered', 'Ribbon sapele', '#7e4028', '#9a5235', 'West and Central Africa', 'Quartersawn sapele shows a bold ribbon stripe that flashes light and dark as you turn it.'],
  ['walnut-burl', 'Walnut burl', '#5a3e2c', '#2f2017', 'North America', 'Burl wood grows from a knotty swelling on the tree, so its grain swirls in every direction. Walnut burl is one of the most prized.'],
  ['maple-burl', 'Maple burl', '#d7bb8c', '#a68456', 'North America', 'Maple burl is full of tiny swirling eyes and curls from a knotty growth on the trunk.'],
  ['buckeye-burl', 'Buckeye burl', '#d9cdb7', '#6d6255', 'California and Ohio Valley', 'Buckeye burl is a creamy wood swirled with gray and blue streaks, often turned into bowls.'],
  ['hickory-pecan', 'Pecan hickory', '#c49a6c', '#a77f53', 'Southern United States', 'Pecan hickory mixes creamy sapwood with warm brown heartwood, often in the same board.'],
  ['red-elm', 'Red elm', '#a8704c', '#8e5a3b', 'Eastern United States', 'Red elm, or slippery elm, has a warm reddish-brown heartwood and a tough, interlocked grain.'],
  ['white-ash-olive', 'Olive ash', '#d7c19a', '#6e5a3e', 'Europe and North America', 'Olive ash is ash with dark heartwood streaks that look like olive wood.'],
  ['bocote-black', 'Black palm', '#3a2c26', '#1d1512', 'Tropical regions', 'Black palm is not a true wood but the fibrous trunk of a palm, with black and tan specks running through it.'],
  ['cherry-spalted', 'Spalted cherry', '#b98060', '#4a3a30', 'North America', 'Spalted cherry carries dark lines drawn by natural fungi through its warm reddish wood.'],
  ['oak-quartersawn', 'Quartersawn white oak', '#c4a274', '#e2cca6', 'Eastern United States', 'Quartersawn white oak shows bright ray fleck across the grain, the signature look of Arts and Crafts furniture.']
];

// Fixed story sentences and fragments, so QR codes can reference them instead of spelling them out.
const STORY_EXTRA = [
  'The lamination is mirrored, so it reads the same from either side.',
  'It is the first piece from the shop with this combination of woods.',
  'The two woods alternate strip by strip, like piano keys.',
  'A single strip of ', ' runs right down the center.', 'It is mostly ', ' for contrast.', ' gives it bold contrast.',
  'It is only the ', ' piece from the shop with this mix of woods.', 'Its handle is the ', 'Its arm is the ', 'Its head is the ',
  'Its shape is the ', 'It is built from blocks of ', 'It is a segmented bowl: ', ' pieces of ', ' cut and glued into ', ' rings on a solid base, then turned on the lathe.',
  'It was turned from a single blank of ', ' epoxy filling its cracks and voids.', 'Its shape is a', ' across and ', ' tall.', 'With a Janka hardness of about ', ' pounds-force, the ', 'about twice as hard as hard maple', 'far harder than hard maple', ', one of the toughest woods there is.', 'A little about the ', 'Thank you for supporting a small shop.',
  'A juice groove runs around the top to catch drips.', 'Finger grips are routed into the ends so it is easy to pick up.',
  'Rubber feet keep it from sliding on the counter and let air reach the bottom.', 'Its edges are rounded over, so it is comfortable to handle.',
  'Its edges are chamfered for a crisp, clean look.', ' end-grain blocks are laid out in a', ' pattern, about ', ' pieces of wood in all, about ',
  'It was built in two glue-ups: strips glued into panels, then sliced, turned end grain up and reassembled into a', ' are set in a running bond with ', ' mortar lines, ',
  'Its bricks of ', 'It is made from '
];

// Janka hardness in pounds-force (typical published figures; blank where there's no reliable number).
const WOOD_JANKA = {"walnut": 1010, "cherry": 950, "maple": 1450, "sapele": 1410, "purpleheart": 2520, "mulberry": 1680, "padauk": 1970, "hickory": 1820, "oak-white": 1350, "oak-red": 1220, "ash": 1320, "birch": 1260, "beech": 1300, "poplar": 540, "alder": 590, "pecan": 1820, "sycamore": 770, "elm": 830, "honey-locust": 1580, "black-locust": 1700, "osage": 2040, "mesquite": 2345, "myrtle": 1270, "madrone": 1460, "oak-live": 2680, "butternut": 490, "mahogany": 800, "bubinga": 2410, "wenge": 1630, "zebrawood": 1575, "bloodwood": 2900, "canarywood": 1520, "yellowheart": 1790, "leopardwood": 2150, "goncalo": 2160, "cocobolo": 2960, "ebony": 3080, "rosewood": 2440, "teak": 1070, "jatoba": 2690, "lacewood": 840, "peruvian-walnut": 960, "curly-maple": 1450, "birdseye": 1450, "cedar": 900, "olive": 2700, "bamboo": 1380, "ipe": 3510, "tigerwood": 2160, "amendoim": 1910, "katalox": 3650, "redheart": 1210, "holly": 1020, "basswood": 410, "apple": 1730, "pear": 1660, "purpleheart-aged": 2520, "bocote": 2010, "sipo": 1310, "afzelia": 1810, "soft-maple": 950, "ambrosia-maple": 950, "quilted-maple": 850, "box-elder": 720, "claro-walnut": 1130, "english-walnut": 1220, "chestnut": 540, "hackberry": 880, "catalpa": 550, "sassafras": 630, "persimmon": 2300, "dogwood": 2150, "hornbeam": 1780, "sweetgum": 850, "tupelo": 880, "magnolia": 1020, "aspen": 350, "cottonwood": 430, "douglas-fir": 620, "redwood": 450, "cypress": 510, "western-cedar": 350, "spanish-cedar": 600, "oak-english": 1120, "khaya": 830, "avodire": 1080, "african-blackwood": 3670, "macassar-ebony": 3220, "gaboon-ebony": 3080, "iroko": 1260, "afrormosia": 1560, "limba": 670, "pink-ivory": 3230, "ovangkol": 1150, "cumaru": 3330, "greenheart": 2350, "tulipwood-br": 2520, "pau-ferro": 1960, "santos-mahogany": 2200, "curupay": 3840, "honduran-rosewood": 2200, "honduran-mahogany": 800, "lignum-vitae": 4390, "verawood": 3710, "snakewood": 3800, "jarrah": 1910, "monkeypod": 900, "sapele-quartered": 1410, "hickory-pecan": 1820, "red-elm": 860, "white-ash-olive": 1320, "oak-quartersawn": 1350};

// Other names people use, so search finds the right wood.
const WOOD_ALIASES = {
  walnut: ['black walnut', 'american walnut'], cherry: ['black cherry', 'american cherry'], maple: ['hard maple', 'sugar maple', 'rock maple'],
  'soft-maple': ['red maple', 'silver maple'], padauk: ['padouk', 'african padauk', 'vermilion'], purpleheart: ['amaranth', 'purple heart'],
  jatoba: ['brazilian cherry'], ipe: ['brazilian walnut', 'ironwood', 'lapacho'], katalox: ['mexican royal ebony'], sipo: ['utile'],
  zebrawood: ['zebrano'], cedar: ['eastern red cedar', 'red cedar', 'aromatic red cedar'], basswood: ['linden', 'lime', 'lime wood'],
  beech: ['european beech'], olive: ['olivewood', 'olive wood'], 'curly-maple': ['tiger maple', 'flame maple', 'fiddleback maple'],
  'black-locust': ['locust'], hickory: ['shagbark'], ash: ['white ash'], poplar: ['tulip poplar', 'yellow poplar'], alder: ['red alder'],
  myrtle: ['myrtlewood', 'california bay laurel', 'pepperwood'], madrone: ['madrona', 'arbutus'], bubinga: ['kevazingo'],
  ebony: ['african ebony'], rosewood: ['east indian rosewood', 'indian rosewood', 'sonokeling'], 'oak-red': ['red oak'], 'oak-white': ['white oak'],
  goncalo: ['goncalo alves', 'gonçalo alves'], tigerwood: ['tiger wood'], bloodwood: ['satine', 'cardinal wood'], sycamore: ['american sycamore', 'lacewood sycamore'],
  'honey-locust': ['honeylocust'], osage: ['bois d arc', 'hedge', 'hedge apple'], mesquite: ['honey mesquite'], teak: ['burmese teak'],
  acacia: ['koa acacia', 'acacia wood'], 'pau-ferro': ['bolivian rosewood', 'morado', 'santos rosewood'], 'santos-mahogany': ['cabreuva'],
  khaya: ['khaya'], 'honduran-mahogany': ['genuine mahogany', 'bigleaf mahogany', 'big leaf mahogany'], mahogany: ['american mahogany'],
  'lignum-vitae': ['guayacan'], verawood: ['argentine lignum vitae', 'bulnesia'], 'tulipwood-br': ['tulipwood', 'pinkwood'], hornbeam: ['ironwood', 'musclewood'],
  'oak-bog': ['bog wood', 'morta'], limba: ['black limba', 'korina'], 'bloodwood-af': ['muirapiranga', 'brazilian satinwood'], monkeypod: ['suar', 'rain tree'],
  'oak-english': ['european oak'], 'african-blackwood': ['mpingo', 'grenadilla'], pine: ['white pine', 'yellow pine', 'southern yellow pine', 'eastern white pine'],
  'western-cedar': ['western red cedar'], 'walnut-burl': ['burl walnut'], 'maple-burl': ['burl maple'], 'box-elder': ['boxelder'],
  tupelo: ['black gum', 'water tupelo'], cottonwood: ['eastern cottonwood'], 'red-elm': ['slippery elm'], cypress: ['bald cypress'],
  'spalted-maple': ['spalted'], chestnut: ['wormy chestnut', 'american chestnut'], 'english-walnut': ['european walnut', 'persian walnut'],
  amendoim: ['brazilian walnut amendoim'], granadillo: ['mexican rosewood'], redheart: ['chakte kok'], 'chakte-viga': ['chakte'], holly: ['american holly'],
  satinwood: ['ceylon satinwood'], camphor: ['camphor laurel'], koa: ['hawaiian koa'], jarrah: ['eucalyptus marginata']
};

const DEFAULT_SHOP = ['walnut', 'cherry', 'maple', 'sapele', 'purpleheart', 'mulberry', 'padauk'];

/* ---------- Template groups, item types, head kinds ---------- */
const DEFAULT_GROUPS = [
  { id: 'knife-handle', name: 'Knife handles', prefix: 'H' },
  { id: 'knife-arm', name: 'Knife arms', prefix: 'A' },
  { id: 'kitchen-handle', name: 'Kitchen handles', prefix: 'KH' },
  { id: 'kitchen-head', name: 'Kitchen heads', prefix: 'K' },
  { id: 'side-view', name: 'Side-view cuts', prefix: 'KV' },
  { id: 'push-pull', name: 'Push-pulls', prefix: 'PP' },
  { id: 'shop-extras', name: 'Shop extras', prefix: 'X' }
];

// Older default texts, so saved copies can be updated to the new wording.
const OLD_DEFAULTS = { kitchenBuild: 'Its handle and head were cut from the same laminated blank and joined with a dovetail, then shaped and sanded by hand.', knifeCare: 'Hand wash with warm soapy water and dry it right away. Never put it in the dishwasher or leave it soaking. Wipe the blade and screws dry so the steel stays rust-free. When the wood looks pale or dry, rub in a little board butter or food-safe oil.', knifeBuild: 'Its strips were ripped, flattened and glued into one blank, then the handle and arm were cut from it so the lamination runs straight through the whole bow. It is fitted with a fresh bread blade, set just a hair long so the bow holds it tight.' };

const CARE = {
  knife: 'Hand wash with warm soapy water and dry it right away. Never put it in the dishwasher or leave it soaking. The blade is stainless steel, but towel it and the screws dry anyway so water never sits against the wood. When the wood looks pale or dry, rub in a little board butter or food-safe oil.',
  spoon: 'Hand wash and dry it right away; never the dishwasher or a long soak. Stirring hot food is fine, just don’t leave it resting in a hot pan. Re-oil whenever the wood looks thirsty.',
  spatula: 'Hand wash and dry it right away; never the dishwasher or a long soak. It is safe on nonstick pans. Don’t leave it resting in a hot pan, and re-oil whenever the wood looks thirsty.',
  'jar scraper': 'Hand wash and dry it right away; never the dishwasher or a long soak. The tip is thin, so use it to scrape, not to pry lids. Re-oil whenever the wood looks thirsty.',
  'butter spreader': 'Hand wash and dry it right away; never the dishwasher or a long soak. Re-oil whenever the wood looks thirsty, and it will keep a soft, smooth edge for years.',
  'dough paddle': 'Scrape off dough before it dries, then hand wash and dry it right away. Never the dishwasher or a long soak. Re-oil whenever the wood looks thirsty.',
  board: 'Hand wash with warm soapy water, then dry it standing on edge so both faces can breathe. Never soak it or put it in the dishwasher. Oil it about once a month, or whenever it looks dry, to keep it from cracking. A rub with lemon and coarse salt freshens it up.',
  'board-end': 'End grain drinks oil faster than other boards, so oil it every week for the first month, then monthly. Hand wash with warm soapy water and dry it standing on edge. Never soak it or put it in the dishwasher. Its fibers close back up after cutting, so it stays kind to your knives.',
  pushpull: 'Wipe it clean or hand wash and dry it. Keep it away from open flame and direct contact with heating elements, and use it to slide the rack, not to lift hot pans. Re-oil when the wood looks dry.',
  bowl: 'Hand wash with warm soapy water and dry it right away. Never put it in the dishwasher or microwave, and never leave it soaking. It is happiest with dry, room-temperature and warm foods. When the wood looks pale or dry, rub in a little food-safe oil or board butter.',
  'bowl-epoxy': 'Hand wash with warm soapy water and dry it right away. Never put it in the dishwasher or microwave, and never leave it soaking. Keep very hot food and liquids out of it, since heat can soften the epoxy. When the wood looks dry, rub in a little food-safe oil or board butter.',
  lame: 'Remove the blade before washing. Hand wash the wood and dry it right away. Handle the blade carefully and swap it out when it starts to drag through the dough. Re-oil the wood when it looks dry.'
};

const DEFAULT_KINDS = [
  { id: 'spoon', name: 'Spoon', noun: 'spoon', care: CARE.spoon },
  { id: 'spatula', name: 'Spatula', noun: 'spatula', care: CARE.spatula },
  { id: 'jar scraper', name: 'Jar scraper', noun: 'jar scraper', care: CARE['jar scraper'] },
  { id: 'butter spreader', name: 'Butter spreader', noun: 'butter spreader', care: CARE['butter spreader'] },
  { id: 'dough paddle', name: 'Dough paddle', noun: 'dough paddle', care: CARE['dough paddle'] }
];

const BOARD_STYLES = [
  { id: 'edge', name: 'Edge grain', story: 'It is an edge-grain board: the strips stand on edge, so the long grain runs the length of the board, tough and stable for everyday chopping.' },
  { id: 'end', name: 'End grain', story: 'It is an end-grain board: the wood was cut into blocks and flipped so you cut into the ends of the fibers, like a butcher block. Your knife slips between the fibers instead of across them, which keeps edges sharp longer.' },
  { id: 'face', name: 'Face grain', story: 'It is a face-grain board, cut to show off the wide face of the wood and its full grain pattern.' },
  { id: 'chaos', name: 'End-grain chaos', story: 'It is an end-grain chaos board: offcuts of different woods cut into blocks and glued up at random, so no two of these will ever come out alike.' }
];

const DEFAULT_TYPES = [
  { id: 'knife', name: 'Sourdough knife', noun: 'knife',
    slots: [{ name: 'Handle', group: 'knife-handle' }, { name: 'Arm', group: 'knife-arm' }], join: 'dovetail',
    build: 'Its strips were ripped, flattened and glued into one blank, then the handle and arm were cut from it so the lamination runs straight through the whole bow. It is fitted with a stainless steel bread blade, set just a hair long so the bow holds it tight.',
    care: CARE.knife },
  { id: 'kitchen', name: 'Kitchen tool', noun: 'tool', byKind: true,
    slots: [{ name: 'Handle', group: 'kitchen-handle' }, { name: 'Head', group: 'kitchen-head' }], join: 'dovetail',
    build: 'Its handle and head were cut from the same laminated blank, then shaped and sanded by hand.',
    care: CARE.spoon },
  { id: 'board', name: 'Cutting board', noun: 'board', slots: [], join: 'none', board: true,
    build: 'Every strip and block was cut, arranged and glued by hand, then flattened and sanded smooth.',
    care: CARE.board },
  { id: 'serving', name: 'Serving board', noun: 'serving board', slots: [], join: 'none', board: true,
    build: 'It was cut, shaped and sanded by hand, made for setting out bread, cheese and everything that goes with them.',
    care: CARE.board },
  { id: 'bowl', name: 'Bowl', noun: 'bowl', slots: [], join: 'none', bowl: true,
    build: 'It was turned by hand on the lathe, then sanded smooth through fine grits.',
    care: CARE.bowl },
  { id: 'pushpull', name: 'Oven push-pull', noun: 'push-pull', slots: [{ name: 'Shape', group: 'push-pull' }], join: 'none',
    build: 'It was cut and shaped by hand, with a hook that catches the oven rack so you can slide it out without reaching into the heat.',
    care: CARE.pushpull },
  { id: 'lame', name: 'Bread lame', noun: 'lame', slots: [], join: 'none',
    build: 'It was shaped by hand and slotted to hold a razor blade for scoring loaves.',
    care: CARE.lame }
];

const DEFAULT_FINISHES = [
  { name: 'Rubio Monocoat', story: 'It is finished with Rubio Monocoat, a plant-based oil that bonds to the wood fibers in a single coat and is food safe once cured.' },
  { name: 'Mineral oil & wax', story: 'It is finished with food-grade mineral oil and a beeswax blend.' },
  { name: 'Board butter', story: 'It is finished with board butter, a blend of food-grade oil and beeswax.' },
  { name: 'Unfinished', story: '' }
];

const DEFAULT_SETTINGS = {
  maker: 'Kevin',
  shop: '',
  pageUrl: '',
  defaultFinish: 'Rubio Monocoat',
  listingEnd: 'Message me with any questions. Pickup or local delivery.',
  nextNumber: 1,
  logo: 'logo.png',   // shop logo: a file in the app, a picture you picked, or '' for none
  email: 'kevingwaltney3@gmail.com',   // printed on cards
  cardStyle: 'side'
};

/* ---------- Story phrasing ---------- */
// Several ways to say each part, so stories don't read the same piece to piece.
const PHRASES = {
  open: [
    'This {noun} is No. {no}, made {by}{when}. It is one of a kind; there will never be another with this exact grain.',
    'No. {no} came off the bench {by}{when}. Like every piece here, it is numbered and one of a kind.',
    'Meet No. {no}, a {noun} made {by}{when}. No other piece will ever have this exact grain.',
    'This is No. {no}. It was made {by}{when}, start to finish, and it is the only one like it.',
    'No. {no} is a {noun} made {by}{when}, numbered and logged so its story stays with it.',
    'Say hello to No. {no}, a {noun} made {by}{when}. Wood never repeats itself, so neither do these.',
    'Fresh off the bench {by}{when}: No. {no}, a {noun}. This grain will never show up again.',
    'No. {no} started as a pile of boards and ended up as this {noun}, made {by}{when}.',
    'This {noun} is No. {no}, made {by}{when}. Nobody else has one quite like it.'
  ],
  strips: [
    'It is laminated from {n} strips of {woods}.',
    'Its blank was glued up from {n} strips: {woods}.',
    '{n} strips went into this one, {woods}.',
    'It is built from {n} laminated strips of {woods}.',
    'The pattern comes from {n} strips: {woods}.',
    'It starts with {n} strips of {woods}, glued up side by side.'
  ],
  solid: [
    'It is made from solid {wood}.',
    'It is cut from a single piece of {wood}.',
    'It is solid {wood}, all the way through.',
    'It is one solid piece of {wood}, nothing added.'
  ],
  woodIntro: ['', '', '', 'About the {wood}: '],
  closing: [
    'Thank you for supporting a small shop.',
    'Thank you for bringing it home.',
    'Thanks for giving it a place in your kitchen.',
    'Thank you for choosing something made by hand.',
    'Use it often. It only looks better with age.',
    'Thanks for giving it a good home.'
  ]
};
// Wording from earlier versions. QR tags already printed point at these, so they stay known to the story page.
const PHRASES_LEGACY = {
  woodIntro: ['About the {wood}: ', 'A little about the {wood}: ']
};

/* ---------- QR text packing ---------- */
// Known text shared by the app and the story page, so QR codes only carry what is unique to each piece.
// Each known text is referenced by a short hash of itself, so adding or reordering entries never breaks older tags.
function buildStoryDict() {
  const frag = s => String(s).split(/\{[^}]+\}/).map(x => x.trim()).filter(x => x.length >= 8);
  const list = [
    ...WOOD_LIBRARY.map(w => w[5]),
    ...Object.values(CARE),
    ...DEFAULT_TYPES.map(t => t.build),
    ...BOARD_STYLES.map(b => b.story),
    ...DEFAULT_FINISHES.map(f => f.story),
    ...(typeof BUILTIN_TEMPLATES !== 'undefined' ? BUILTIN_TEMPLATES.map(t => t.inspiration) : []),
    ...Object.values(PHRASES).flat().flatMap(frag),
    ...Object.values(PHRASES_LEGACY).flat().flatMap(frag),
    ...(typeof STORY_EXTRA !== 'undefined' ? STORY_EXTRA : [])
  ].filter(Boolean);
  const map = new Map();
  for (const t of list) map.set(storyKey(t), t);
  return map;
}
function storyKey(t) { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36).slice(-5); }
let STORY_DICT = null;
function packStory(s) {
  STORY_DICT ||= buildStoryDict();
  const order = [...STORY_DICT.entries()].sort((a, b) => b[1].length - a[1].length);
  s = String(s).replace(/\u00a7/g, '');
  for (const [k, t] of order) if (s.includes(t)) s = s.split(t).join('\u00a7' + k + ';');
  return s;
}
function unpackStory(s) { STORY_DICT ||= buildStoryDict(); return String(s).replace(/\u00a7([0-9a-z]+);/g, (m, k) => STORY_DICT.get(k) ?? ''); }

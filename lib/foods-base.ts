import type { Macros } from "./types";

/**
 * Mitgelieferte Basisliste gängiger Grundzutaten.
 * Werte pro 100 g, gerundet nach USDA FoodData Central (SR Legacy / Foundation).
 *
 * Format pro Zeile:
 * id ; Name ; Synonyme (|) ; kcal ; Protein ; KH ; Fett ; Ballaststoffe ; Bereich ; g/Stück ; g/EL ; Zustand
 * Bereich: O=Obst & Gemüse, F=Fleisch & Fisch, K=Kühlregal, T=Trockenware, G=Gewürze, S=Sonstiges
 * Zustand: r=roh/ungekocht, c=gekocht (Varianten teilen sich die id ohne Suffix)
 */
const RAW = `
haehnchenbrust-r;Hähnchenbrust, roh;boneless skinless chicken breast|chicken breasts|hähnchenbrust|hühnerbrust|hähnchenbrustfilet|chicken breast|hähnchenfilet|huhn|hähnchen|chicken;120;22.5;0;2.6;0;F;;;r
haehnchenbrust-c;Hähnchenbrust, gebraten;gebratene hähnchenbrust|cooked chicken breast|grilled chicken;165;31;0;3.6;0;F;;;c
haehnchenschenkel-r;Hähnchenschenkel ohne Haut, roh;boneless skinless chicken thighs|chicken thigh fillets|hähnchenschenkel|hähnchenoberschenkel|chicken thigh|chicken thighs;121;19.7;0;4.1;0;F;;;r
haehnchenschenkel-c;Hähnchenschenkel ohne Haut, gebraten;cooked chicken thigh;179;24.8;0;8.2;0;F;;;c
putenbrust-r;Putenbrust, roh;putenbrust|pute|truthahn|turkey breast|putenfilet;114;23.7;0;1.5;0;F;;;r
putenbrust-c;Putenbrust, gebraten;cooked turkey breast;147;30;0;2.1;0;F;;;c
hackfleisch-rind-r;Rinderhackfleisch, roh;80/20 ground beef|85/15 ground beef|rinderhack|rinderhackfleisch|hackfleisch|hack|ground beef|minced beef|beef mince;254;17.2;0;20;0;F;;;r
hackfleisch-rind-c;Rinderhackfleisch, gebraten;cooked ground beef;288;24;0;20.7;0;F;;;c
hackfleisch-mager-r;Rinderhack mager (5 %), roh;lean ground beef|extra lean ground beef|93/7 ground beef|96/4 ground beef|mageres rinderhack|tatar|lean ground beef|beefsteakhack;137;21.4;0;5;0;F;;;r
hackfleisch-gemischt-r;Hackfleisch gemischt, roh;gemischtes hack|hackfleisch gemischt|halb und halb;262;17;0;21.5;0;F;;;r
putenhack-r;Putenhackfleisch, roh;lean ground turkey|99% lean ground turkey|93/7 ground turkey|putenhack|ground turkey;148;17.5;0;8.3;0;F;;;r
rindersteak-r;Rindersteak, roh;steak|rumpsteak|rinderhüfte|beef steak|sirloin|rindfleisch|beef;158;21;0;8;0;F;;;r
rindersteak-c;Rindersteak, gebraten;cooked steak;217;29;0;10.5;0;F;;;c
schweinefilet-r;Schweinefilet, roh;schweinefilet|schweinelende|pork tenderloin|schweinefleisch|pork;120;21;0;3.5;0;F;;;r
schweinefilet-c;Schweinefilet, gebraten;cooked pork tenderloin;143;26;0;3.5;0;F;;;c
schinken;Kochschinken;schinken|kochschinken|ham;113;19;1;3.5;0;K;;;
bacon;Bacon / Frühstücksspeck;bacon|speck|frühstücksspeck|schinkenspeck;458;12.6;1.4;45;0;K;;;
salami;Salami;salami|pepperoni;407;22;1.2;34;0;K;;;
lachs-r;Lachs, roh;lachs|lachsfilet|salmon;208;20.4;0;13.4;0;F;;;r
lachs-c;Lachs, gegart;cooked salmon|gebratener lachs;206;22.1;0;12.4;0;F;;;c
raeucherlachs;Räucherlachs;räucherlachs|smoked salmon;117;18.3;0;4.3;0;K;;;
thunfisch-dose;Thunfisch im eigenen Saft (Dose);thunfisch|tuna|thunfisch dose|canned tuna;116;25.5;0;0.8;0;T;;;
kabeljau-r;Kabeljau, roh;kabeljau|dorsch|seelachs|weißfisch|cod|fisch;82;17.8;0;0.7;0;F;;;r
kabeljau-c;Kabeljau, gegart;cooked cod;105;22.8;0;0.9;0;F;;;c
garnelen-r;Garnelen, roh;garnelen|shrimps|shrimp|prawns|krabben|gambas;85;20;0;0.5;0;F;;;r
garnelen-c;Garnelen, gegart;cooked shrimp;99;24;0.2;0.3;0;F;;;c
ei;Ei;ei|eier|egg|eggs|hühnerei;143;12.6;0.7;9.5;0;K;55;;
eiklar;Eiklar;liquid egg whites|eiweiß|eiklar|egg white|egg whites;52;10.9;0.7;0.2;0;K;33;15;
eigelb;Eigelb;eigelb|egg yolk;322;15.9;3.6;26.5;0;K;17;;
magerquark;Magerquark;magerquark|quark|low fat quark;67;12;4;0.3;0;K;;;
skyr;Skyr;skyr;63;11;4;0.2;0;K;;;
griechischer-joghurt;Griechischer Joghurt 10 %;plain greek yogurt|full fat greek yogurt|griechischer joghurt|greek yogurt|griechischer jogurt;133;5;4;10;0;K;;;
griechischer-joghurt-0;Griechischer Joghurt 0 %;nonfat greek yogurt|non fat greek yogurt|fat free greek yogurt|0% greek yogurt|plain nonfat greek yogurt|greek yogurt 0%|nonfat greek yogurt|griechischer joghurt 0;59;10.2;3.6;0.4;0;K;;;
joghurt;Naturjoghurt 3,5 %;joghurt|naturjoghurt|jogurt|yogurt|yoghurt|plain yogurt;61;3.5;4.7;3.3;0;K;;;
joghurt-mager;Joghurt 0,1 %;magerjoghurt|fettarmer joghurt|low fat yogurt;38;4.3;4.2;0.1;0;K;;;
huettenkaese;Hüttenkäse;low fat cottage cheese|fat free cottage cheese|hüttenkäse|körniger frischkäse|cottage cheese;98;11.1;3.4;4.3;0;K;;;
frischkaese;Frischkäse;frischkäse|cream cheese|philadelphia;342;6;4.1;34;0;K;;;
frischkaese-light;Frischkäse light;light cream cheese|reduced fat cream cheese|neufchatel|frischkäse light|light cream cheese;160;8;6;12;0;K;;;
mozzarella;Mozzarella;mozzarella;254;18;2.5;19;0;K;125;;
mozzarella-light;Mozzarella light;part skim mozzarella|low moisture mozzarella|fat free mozzarella|light mozzarella|mozzarella light;165;19;1.5;9;0;K;125;;
parmesan;Parmesan;parmesan|parmigiano|grana padano|parmesan cheese;392;35.8;3.2;25.8;0;K;;6;
gouda;Gouda;shredded cheese|mexican cheese|cheddar cheese|monterey jack|gouda|käse|cheese|reibekäse|geriebener käse|bergkäse|emmentaler|cheddar;356;24.9;2.2;27.4;0;K;;7;
feta;Feta;feta|schafskäse|hirtenkäse|feta cheese;264;14.2;4.1;21.3;0;K;;;
halloumi;Halloumi;halloumi;321;21;2;25;0;K;;;
milch;Milch 3,5 %;milch|vollmilch|milk|whole milk;64;3.3;4.8;3.6;0;K;;15;
milch-fettarm;Milch 1,5 %;fettarme milch|milch 1,5|low fat milk|skim milk|magermilch;47;3.4;4.9;1.5;0;K;;15;
mandelmilch;Mandeldrink ungesüßt;unsweetened almond milk|mandelmilch|mandeldrink|almond milk;15;0.6;0.3;1.1;0.2;K;;15;
haferdrink;Haferdrink;hafermilch|haferdrink|oat milk;45;0.8;6.6;1.5;0.8;K;;15;
sojadrink;Sojadrink ungesüßt;sojamilch|sojadrink|soy milk;33;3;0.3;1.8;0.5;K;;15;
sahne;Schlagsahne 30 %;heavy whipping cream|double cream|sahne|schlagsahne|heavy cream|cream|whipping cream;292;2.4;3.2;30;0;K;;15;
kochsahne;Kochsahne 15 %;light cream|half and half|half & half|kochsahne|cooking cream;167;3;4;15;0;K;;15;
saure-sahne;Saure Sahne / Schmand;saure sahne|schmand|sour cream|crème fraîche|creme fraiche;198;2.4;4.6;19;0;K;;15;
butter;Butter;butter;717;0.9;0.1;81;0;K;;12;
proteinpulver;Proteinpulver (Whey);vanilla protein powder|chocolate protein powder|protein|scoop of protein|casein|proteinpulver|whey|eiweißpulver|protein powder|whey protein|scoop protein;380;78;8;5;0;T;30;10;
tofu;Tofu natur;tofu|firm tofu;144;17.3;2.8;8.7;2.3;K;;;
tempeh;Tempeh;tempeh;192;20.3;7.6;10.8;0;K;;;
haferflocken;Haferflocken;haferflocken|haferflocke|oats|rolled oats|oatmeal|porridge oats;379;13.2;60;6.5;10.1;T;;8;
reis-r;Reis, ungekocht;reis|basmatireis|jasminreis|langkornreis|rice|basmati|jasmine rice|white rice;360;6.6;79;0.6;1;T;;12;r
reis-c;Reis, gekocht;gekochter reis|cooked rice;130;2.7;28.2;0.3;0.4;T;;15;c
vollkornreis-r;Vollkornreis, ungekocht;vollkornreis|naturreis|brown rice;367;7.5;76;2.7;3.4;T;;12;r
vollkornreis-c;Vollkornreis, gekocht;cooked brown rice;123;2.7;25.6;1;1.6;T;;15;c
nudeln-r;Nudeln, ungekocht;nudeln|pasta|spaghetti|penne|fusilli|spirelli|tagliatelle|makkaroni|rigatoni|farfalle|linguine|noodles;371;13;75;1.5;3.2;T;;;r
nudeln-c;Nudeln, gekocht;gekochte nudeln|cooked pasta;158;5.8;31;0.9;1.8;T;;;c
vollkornnudeln-r;Vollkornnudeln, ungekocht;vollkornnudeln|vollkornspaghetti|whole wheat pasta;352;14.6;65;2.5;9;T;;;r
vollkornnudeln-c;Vollkornnudeln, gekocht;cooked whole wheat pasta;149;6;30;1.7;3.9;T;;;c
proteinnudeln-r;Proteinnudeln (Linsen/Kichererbsen), ungekocht;linsennudeln|kichererbsennudeln|protein pasta|lentil pasta;340;23;50;2;8;T;;;r
reisnudeln-r;Reisnudeln, ungekocht;reisnudeln|glasnudeln|rice noodles;364;6;80;0.6;1.6;T;;;r
gnocchi;Gnocchi;gnocchi;150;3.5;32;0.4;1.5;K;;;
couscous-r;Couscous, ungekocht;couscous;376;12.8;77;0.6;5;T;;12;r
couscous-c;Couscous, gekocht;cooked couscous;112;3.8;23.2;0.2;1.4;T;;15;c
bulgur-r;Bulgur, ungekocht;bulgur;342;12.3;76;1.3;12.5;T;;12;r
bulgur-c;Bulgur, gekocht;cooked bulgur;83;3.1;18.6;0.2;4.5;T;;15;c
quinoa-r;Quinoa, ungekocht;quinoa;368;14.1;64;6.1;7;T;;12;r
quinoa-c;Quinoa, gekocht;cooked quinoa;120;4.4;21.3;1.9;2.8;T;;15;c
kartoffeln-r;Kartoffeln, roh;russet potatoes|yukon gold potatoes|baby potatoes|kartoffel|kartoffeln|potato|potatoes|drillinge;77;2;17.5;0.1;2.2;O;150;;r
kartoffeln-c;Kartoffeln, gekocht;gekochte kartoffeln|pellkartoffeln|salzkartoffeln|boiled potatoes;87;1.9;20;0.1;1.8;O;150;;c
suesskartoffel-r;Süßkartoffel, roh;süßkartoffel|süßkartoffeln|sweet potato|sweet potatoes;86;1.6;20.1;0.1;3;O;250;;r
suesskartoffel-c;Süßkartoffel, gegart;cooked sweet potato;90;2;20.7;0.2;3.3;O;250;;c
mehl;Weizenmehl Type 405;all purpose flour|mehl|weizenmehl|flour|all-purpose flour;364;10.3;76;1;2.7;T;;10;
vollkornmehl;Vollkornmehl;vollkornmehl|dinkelvollkornmehl|whole wheat flour;340;13.2;72;2.5;10.7;T;;10;
dinkelmehl;Dinkelmehl Type 630;dinkelmehl|spelt flour;350;13;70;2;4;T;;10;
speisestaerke;Speisestärke;speisestärke|maisstärke|stärke|cornstarch|corn starch;381;0.3;91;0.1;0.9;T;;10;
paniermehl;Paniermehl;paniermehl|semmelbrösel|breadcrumbs|panko;395;13;72;5;4.5;T;;8;
mandelmehl;Mandelmehl;mandelmehl|almond flour;571;21;21;50;10;T;;8;
toastbrot;Toastbrot;toast|toastbrot|white bread|weißbrot;265;9;49;3.2;2.7;T;25;;
vollkornbrot;Vollkornbrot;vollkornbrot|brot|bread|whole wheat bread|schwarzbrot|roggenbrot;247;13;41;3.4;7;T;45;;
broetchen;Brötchen;brötchen|semmel|roll|bun|burger bun|burgerbrötchen;275;9;52;2.5;2.5;T;55;;
wrap;Weizen-Tortilla / Wrap;wrap|wraps|tortilla|tortillas|weizentortilla;306;8.2;50;7.7;3.5;T;60;;
pita;Pita / Fladenbrot;pita|fladenbrot|pitabrot|naan;275;9.1;55.7;1.2;2.2;T;70;;
reiswaffel;Reiswaffeln;reiswaffel|reiswaffeln|rice cake|rice cakes;387;8;81.5;2.8;4.2;T;8;;
cornflakes;Cornflakes;cornflakes|corn flakes;357;7.5;84;0.4;3.3;T;;;
granola;Granola / Knuspermüsli;granola|knuspermüsli|müsli|muesli;471;10;64;20;7;T;;;
zucker;Zucker;zucker|sugar|brauner zucker|brown sugar;387;0;100;0;0;T;;12;
honig;Honig;honig|honey;304;0.3;82;0;0.2;T;;21;
ahornsirup;Ahornsirup;ahornsirup|maple syrup|agavendicksaft|agave;260;0;67;0.1;0;T;;20;
erythrit;Erythrit / Süßstoff;monk fruit|monk fruit sweetener|swerve|allulose|erythrit|xylit|süßstoff|sweetener|stevia;0;0;0;0;0;T;;12;
schokolade-dunkel;Zartbitterschokolade 70 %;zartbitterschokolade|schokolade|dark chocolate|chocolate|schokodrops|chocolate chips;598;7.8;46;43;10.9;T;;;
kakao;Kakaopulver ungesüßt;kakao|kakaopulver|backkakao|cocoa|cocoa powder;228;19.6;58;13.7;37;T;;6;
backpulver;Backpulver;backpulver|baking powder|natron|baking soda;53;0;28;0;0.2;T;;10;
hefe;Hefe;hefe|trockenhefe|yeast;325;40;41;7.6;27;K;;;
olivenoel;Olivenöl;olivenöl|olive oil|öl|oil|olivenoel|evoo;884;0;0;100;0;T;;13;
rapsoel;Rapsöl;avocado oil|avocadoöl|avocado öl|cooking spray|olive oil spray|rapsöl|pflanzenöl|sonnenblumenöl|vegetable oil|canola oil|sunflower oil;884;0;0;100;0;T;;13;
kokosoel;Kokosöl;kokosöl|coconut oil;892;0;0;99;0;T;;13;
sesamoel;Sesamöl;sesamöl|sesame oil;884;0;0;100;0;T;;13;
kokosmilch;Kokosmilch;kokosmilch|coconut milk;197;2;2.8;21;0;T;;15;
kokosmilch-light;Kokosmilch light;kokosmilch light|light coconut milk;73;0.7;1.6;7;0;T;;15;
erdnussbutter;Erdnussbutter;erdnussbutter|erdnussmus|peanut butter|pb;588;25;20;50;6;T;;16;
mandelmus;Mandelmus;mandelmus|almond butter;614;21;19;56;10;T;;16;
tahini;Tahin / Sesampaste;tahin|tahini|sesampaste;595;17;21;54;9.3;T;;15;
mandeln;Mandeln;mandeln|almonds|mandelblättchen;579;21.2;21.6;49.9;12.5;T;;9;
walnuesse;Walnüsse;walnüsse|walnuss|walnuts;654;15.2;13.7;65.2;6.7;T;;8;
cashews;Cashewkerne;cashew|cashews|cashewkerne;553;18.2;30;43.9;3.3;T;;9;
erdnuesse;Erdnüsse;erdnüsse|erdnuss|peanuts;567;25.8;16;49;8.5;T;;9;
chiasamen;Chiasamen;chia|chiasamen|chia seeds;486;16.5;42;30.7;34.4;T;;12;
leinsamen;Leinsamen;leinsamen|flaxseed|flax seeds;534;18.3;28.9;42.2;27.3;T;;10;
sesam;Sesam;sesam|sesamsamen|sesame|sesame seeds;573;17.7;23.5;49.7;11.8;T;;9;
kuerbiskerne;Kürbiskerne;kürbiskerne|pumpkin seeds;559;30.2;10.7;49;6;T;;9;
sonnenblumenkerne;Sonnenblumenkerne;sonnenblumenkerne|sunflower seeds;584;20.8;20;51.5;8.6;T;;9;
kichererbsen-dose;Kichererbsen (Dose, abgetropft);kichererbsen|chickpeas|garbanzo;139;7;19;2.6;6;T;;;c
kichererbsen-r;Kichererbsen, getrocknet;getrocknete kichererbsen|dried chickpeas;378;20.5;63;6;12.2;T;;;r
linsen-r;Linsen, getrocknet;linsen|rote linsen|berglinsen|lentils|red lentils;352;24.6;63;1.1;10.7;T;;12;r
linsen-c;Linsen, gekocht;gekochte linsen|cooked lentils|linsen dose;116;9;20;0.4;7.9;T;;15;c
kidneybohnen;Kidneybohnen (Dose, abgetropft);kidneybohnen|kidney beans|rote bohnen;127;8.7;22.8;0.5;6.4;T;;;c
schwarze-bohnen;Schwarze Bohnen (Dose, abgetropft);schwarze bohnen|black beans|bohnen|beans|weiße bohnen|white beans;132;8.9;23.7;0.5;8.7;T;;;c
edamame;Edamame;edamame|sojabohnen;121;11.9;8.9;5.2;5.2;K;;;
erbsen;Erbsen (TK);erbsen|peas|green peas|tk erbsen;81;5.4;14.5;0.4;5.1;K;;;
mais;Mais (Dose);mais|corn|sweet corn|zuckermais;86;3.3;19;1.4;2;T;;;
tomate;Tomate;tomate|tomaten|tomato|tomatoes|strauchtomaten;18;0.9;3.9;0.2;1.2;O;120;;
cherrytomaten;Cherrytomaten;cherrytomaten|cocktailtomaten|cherry tomatoes|datteltomaten;18;0.9;3.9;0.2;1.2;O;15;;
tomaten-dose;Gehackte Tomaten (Dose);crushed tomatoes|marinara|marinara sauce|pasta sauce|gehackte tomaten|stückige tomaten|tomaten dose|canned tomatoes|diced tomatoes|passierte tomaten|passata|tomatensauce|tomato sauce|pizzatomaten;32;1.6;5.8;0.3;1.9;T;;15;
tomatenmark;Tomatenmark;tomatenmark|tomato paste;82;4.3;18.9;0.5;4.1;T;;16;
gurke;Gurke;gurke|salatgurke|cucumber;15;0.7;3.6;0.1;0.5;O;400;;
paprika;Paprika;paprika|paprikaschote|bell pepper|bell peppers|peppers|rote paprika|gelbe paprika;31;1;6;0.3;2.1;O;160;;
zucchini;Zucchini;zucchini|courgette;17;1.2;3.1;0.3;1;O;250;;
aubergine;Aubergine;aubergine|eggplant;25;1;5.9;0.2;3;O;300;;
brokkoli;Brokkoli;brokkoli|broccoli;34;2.8;6.6;0.4;2.6;O;400;;
blumenkohl;Blumenkohl;cauliflower rice|blumenkohlreis|riced cauliflower|blumenkohl|cauliflower;25;1.9;5;0.3;2;O;600;;
spinat;Spinat;spinat|blattspinat|babyspinat|spinach|baby spinach;23;2.9;3.6;0.4;2.2;O;;;
salat;Blattsalat;salat|rucola|feldsalat|eisbergsalat|römersalat|lettuce|arugula|rocket|salad;15;1.4;2.9;0.2;1.3;O;;;
gruenkohl;Grünkohl;grünkohl|kale;49;4.3;8.8;0.9;3.6;O;;;
zwiebel;Zwiebel;zwiebel|zwiebeln|onion|onions|rote zwiebel|red onion;40;1.1;9.3;0.1;1.7;O;110;;
fruehlingszwiebel;Frühlingszwiebel;frühlingszwiebel|frühlingszwiebeln|lauchzwiebel|spring onion|green onion|scallion|scallions;32;1.8;7.3;0.2;2.6;O;15;;
knoblauch;Knoblauch;knoblauch|knoblauchzehe|knoblauchzehen|garlic|garlic clove|cloves garlic|zehe|zehen;149;6.4;33;0.5;2.1;O;4;;
ingwer;Ingwer;ingwer|ginger;80;1.8;17.8;0.8;2;O;;6;
karotte;Karotte;karotte|karotten|möhre|möhren|carrot|carrots;41;0.9;9.6;0.2;2.8;O;80;;
sellerie;Staudensellerie;sellerie|staudensellerie|celery;16;0.7;3;0.2;1.6;O;40;;
lauch;Lauch;lauch|porree|leek;61;1.5;14.2;0.3;1.8;O;200;;
pilze;Champignons;champignons|pilze|mushrooms|mushroom|braune champignons;22;3.1;3.3;0.3;1;O;20;;
avocado;Avocado;avocado|avocados;160;2;8.5;14.7;6.7;O;150;;
kuerbis;Kürbis (Hokkaido);kürbis|hokkaido|butternut|pumpkin|squash;34;1;8.3;0.1;1.5;O;;;
gruene-bohnen;Grüne Bohnen;grüne bohnen|prinzessbohnen|green beans;31;1.8;7;0.2;2.7;O;;;
spargel;Spargel;spargel|asparagus;20;2.2;3.9;0.1;2.1;O;20;;
rotkohl;Rotkohl / Weißkohl;rotkohl|weißkohl|kohl|cabbage|red cabbage|spitzkohl;29;1.4;7;0.2;2.5;O;;;
rosenkohl;Rosenkohl;rosenkohl|brussels sprouts;43;3.4;9;0.3;3.8;O;15;;
pak-choi;Pak Choi;pak choi|bok choy;13;1.5;2.2;0.2;1;O;;;
radieschen;Radieschen;radieschen|radish|radishes;16;0.7;3.4;0.1;1.6;O;10;;
rote-bete;Rote Bete (gegart);rote bete|rote beete|beetroot|beets;44;1.7;10;0.2;2;O;;;
oliven;Oliven;oliven|olives|kalamata;145;1;3.8;15.3;3.3;T;4;;
kapern;Kapern;kapern|capers;23;2.4;4.9;0.9;3.2;T;;9;
getrocknete-tomaten;Getrocknete Tomaten in Öl;getrocknete tomaten|sun dried tomatoes;213;5;23;14;5.8;T;;;
gewuerzgurke;Gewürzgurken;gewürzgurke|gewürzgurken|essiggurke|pickles|gherkins;12;0.5;2.3;0.2;1;T;30;;
apfel;Apfel;apfel|äpfel|apple|apples;52;0.3;13.8;0.2;2.4;O;180;;
banane;Banane;banane|bananen|banana|bananas;89;1.1;22.8;0.3;2.6;O;120;;
beeren;Beeren (gemischt);beeren|beerenmix|tk beeren|mixed berries|berries|frozen berries;45;0.8;10.5;0.3;3;O;;;
heidelbeeren;Heidelbeeren;heidelbeeren|blaubeeren|blueberries;57;0.7;14.5;0.3;2.4;O;;;
himbeeren;Himbeeren;himbeeren|raspberries;52;1.2;11.9;0.7;6.5;O;;;
erdbeeren;Erdbeeren;erdbeeren|strawberries|strawberry;32;0.7;7.7;0.3;2;O;15;;
mango;Mango;mango;60;0.8;15;0.4;1.6;O;300;;
ananas;Ananas;ananas|pineapple;50;0.5;13.1;0.1;1.4;O;;;
orange;Orange;orange|orangen|apfelsine|oranges;47;0.9;11.8;0.1;2.4;O;150;;
zitrone;Zitrone;zitrone|zitronen|lemon|lemons;29;1.1;9.3;0.3;2.8;O;80;;
zitronensaft;Zitronensaft;limettensaft|zitronensaft|lemon juice|lime juice|saft einer zitrone|orangensaft frisch;22;0.4;6.9;0.2;0.3;O;30;15;
limette;Limette;limette|limetten|lime|limes;30;0.7;10.5;0.2;2.8;O;60;;
kiwi;Kiwi;kiwi|kiwis;61;1.1;14.7;0.5;3;O;75;;
weintrauben;Weintrauben;trauben|weintrauben|grapes;69;0.7;18.1;0.2;0.9;O;;;
datteln;Datteln;datteln|dates|medjool;282;2.5;75;0.4;8;T;8;;
rosinen;Rosinen;rosinen|raisins|cranberries getrocknet;299;3.1;79;0.5;3.7;T;;10;
apfelmark;Apfelmus ungesüßt;apfelmus|apfelmark|applesauce;42;0.2;11.3;0.1;1.1;T;;15;
marmelade;Marmelade;marmelade|konfitüre|jam;250;0.4;60;0.1;1;T;;20;
sojasauce;Sojasauce;sojasauce|sojasoße|soy sauce|tamari|shoyu;53;8.1;4.9;0.6;0.8;G;;16;
teriyaki;Teriyakisauce;teriyaki|teriyakisauce;89;5.9;15.6;0;0.1;G;;18;
sriracha;Sriracha / Chilisauce;sriracha|chilisauce|hot sauce|chili sauce;93;1.9;19;0.9;2.2;G;;16;
ketchup;Ketchup;sugar free ketchup|zuckerfreier ketchup|ketchup;101;1;27;0.1;0.3;G;;17;
senf;Senf;senf|mustard|dijon|dijonsenf;66;4.4;5.8;4;3.3;G;;15;
mayonnaise;Mayonnaise;mayonnaise|mayo;680;1;0.6;75;0;K;;14;
mayo-light;Salatcreme / Mayo light;light mayo|light mayonnaise|mayo light|light mayo|salatcreme;250;0.9;10;23;0;K;;15;
pesto;Pesto;pesto|basilikumpesto|pesto genovese;458;5;6;47;1.5;K;;15;
essig;Essig;essig|balsamico|balsamessig|apfelessig|vinegar|balsamic|weißweinessig|reisessig;88;0.5;17;0;0;G;;15;
bruehe;Gemüsebrühe (zubereitet);chicken broth|vegetable broth|beef broth|chicken stock|brühe|gemüsebrühe|hühnerbrühe|fond|broth|stock|bouillon;5;0.3;0.6;0.2;0;G;;15;
bruehpulver;Brühpulver;brühpulver|gemüsebrühe pulver|bouillon powder|instant brühe;250;10;30;10;0;G;;10;
currypaste;Currypaste;currypaste|rote currypaste|curry paste|red curry paste;140;3;14;8;4;G;;16;
salz;Salz;salz|salt|meersalz|sea salt;0;0;0;0;0;G;;18;
pfeffer;Pfeffer;pfeffer|pepper|black pepper|schwarzer pfeffer;251;10.4;64;3.3;25.3;G;;6;
paprikapulver;Paprikapulver;paprikapulver|paprika edelsüß|geräuchertes paprikapulver|smoked paprika|paprika powder;282;14.1;54;12.9;34.9;G;;7;
curry;Currypulver;curry|currypulver|curry powder;325;14.3;56;14;53;G;;6;
kreuzkuemmel;Kreuzkümmel;kreuzkümmel|cumin;375;17.8;44;22.3;10.5;G;;6;
zimt;Zimt;zimt|cinnamon;247;4;81;1.2;53;G;;8;
oregano;Oregano / Kräuter getrocknet;oregano|kräuter der provence|italienische kräuter|thymian|rosmarin|getrocknete kräuter|italian seasoning|dried herbs;265;9;69;4.3;42.5;G;;3;
knoblauchpulver;Knoblauchpulver;knoblauchpulver|garlic powder|zwiebelpulver|onion powder;331;16.6;73;0.7;9;G;;9;
chiliflocken;Chiliflocken;chiliflocken|chili|chilipulver|cayenne|chili flakes|chili powder|red pepper flakes;282;13.5;50;14.3;34.8;G;;5;
kurkuma;Kurkuma;kurkuma|turmeric;312;9.7;67;3.3;22.7;G;;7;
vanille;Vanilleextrakt;vanille|vanilleextrakt|vanillezucker|vanilla|vanilla extract;288;0.1;12.7;0.1;0;G;;13;
kraeuter-frisch;Frische Kräuter;fresh herbs|petersilie|basilikum|koriander|schnittlauch|dill|minze|parsley|basil|cilantro|coriander|chives|mint|kräuter;36;3;6.3;0.8;3.3;O;;3;
gyros-gewuerz;Gewürzmischung;cajun seasoning|fajita seasoning|everything bagel seasoning|bbq rub|gewürzmischung|taco gewürz|gyrosgewürz|taco seasoning|seasoning|gewürz;300;10;55;5;20;G;;7;
wasser;Wasser;wasser|water|eiswürfel|ice;0;0;0;0;0;S;;15;
kaffee;Kaffee / Espresso;kaffee|espresso|coffee;2;0.1;0;0;0;S;;15;
wein;Weißwein / Rotwein;wein|weißwein|rotwein|white wine|red wine;83;0.1;2.6;0;0;S;;15;
orangensaft;Orangensaft;orangensaft|orange juice|saft;45;0.7;10.4;0.2;0.2;S;;15;
`;

export type BaseFood = {
  id: string;
  name: string;
  syn: string[];
  per100: Macros;
  aisle: string;
  pieceG?: number;
  elG?: number;
  state?: "raw" | "cooked";
  /** id without -r/-c suffix, shared by raw & cooked variants */
  group: string;
};

const AISLE_MAP: Record<string, string> = {
  O: "Obst & Gemüse",
  F: "Fleisch & Fisch",
  K: "Kühlregal",
  T: "Trockenware",
  G: "Gewürze",
  S: "Sonstiges",
};

export const BASE_FOODS: BaseFood[] = RAW.trim()
  .split("\n")
  .map((line) => {
    const [id, name, syn, kcal, p, c, f, fi, aisle, piece, el, st] = line.split(";");
    const state = st === "r" ? "raw" : st === "c" ? "cooked" : undefined;
    return {
      id,
      name,
      syn: syn.split("|").map((s) => s.trim().toLowerCase()),
      per100: { kcal: +kcal, protein: +p, carbs: +c, fat: +f, fiber: +fi },
      aisle: AISLE_MAP[aisle] ?? "Sonstiges",
      pieceG: piece ? +piece : undefined,
      elG: el ? +el : undefined,
      state,
      group: state ? id.replace(/-(r|c)$/, "") : id,
    } satisfies BaseFood;
  });

/**
 * Gramm pro US-Cup (240 ml), wo die Dichte stark von 240 g abweicht.
 * Quelle: USDA-Portionsangaben, gerundet. Schlüssel = id oder Gruppe (ohne -r/-c).
 */
export const CUP_G: Record<string, number> = {
  "reis-r": 185, "reis-c": 160, "vollkornreis-r": 190, "vollkornreis-c": 195, "quinoa-r": 170, "quinoa-c": 185,
  "couscous-r": 175, "couscous-c": 157, "bulgur-r": 140, "bulgur-c": 182, "linsen-r": 190, "linsen-c": 198,
  "nudeln-r": 100, "nudeln-c": 140, "vollkornnudeln-r": 100, "vollkornnudeln-c": 140, "proteinnudeln-r": 100,
  haferflocken: 80, granola: 110, cornflakes: 28, mehl: 125, vollkornmehl: 120, dinkelmehl: 120, mandelmehl: 96,
  speisestaerke: 128, paniermehl: 110, zucker: 200, kakao: 86, proteinpulver: 120,
  spinat: 30, salat: 40, gruenkohl: 67, kraeuter: 16, "kraeuter-frisch": 16, brokkoli: 91, blumenkohl: 107,
  paprika: 150, zwiebel: 160, tomate: 180, cherrytomaten: 150, gurke: 120, karotte: 128, pilze: 70, zucchini: 124,
  erbsen: 145, mais: 165, gewuerzgurke: 143, oliven: 135, "gruene-bohnen": 110, rotkohl: 89, edamame: 155,
  "kartoffeln-r": 150, "kartoffeln-c": 156, "suesskartoffel-r": 133, "suesskartoffel-c": 200, kuerbis: 116,
  heidelbeeren: 148, himbeeren: 123, erdbeeren: 152, beeren: 140, mango: 165, ananas: 165, weintrauben: 151, banane: 150, apfel: 125,
  gouda: 113, mozzarella: 112, "mozzarella-light": 112, feta: 150, parmesan: 100, huettenkaese: 226, frischkaese: 232, "frischkaese-light": 232,
  "griechischer-joghurt": 245, "griechischer-joghurt-0": 245, joghurt: 245, "joghurt-mager": 245, magerquark: 250, skyr: 245,
  "kichererbsen-dose": 164, kidneybohnen: 177, "schwarze-bohnen": 172, "tomaten-dose": 245, kokosmilch: 226, eiklar: 243,
  mandeln: 143, walnuesse: 117, cashews: 137, erdnuesse: 146, chiasamen: 160, rosinen: 145, datteln: 147,
  "haehnchenbrust-c": 140, "putenbrust-c": 140, "hackfleisch-rind-c": 140,
};

export const BASE_BY_ID = new Map(BASE_FOODS.map((f) => [f.id, f]));

/** variant (raw/cooked) of the same food, if any */
export function variantOf(id: string, state: "raw" | "cooked"): BaseFood | undefined {
  const f = BASE_BY_ID.get(id);
  if (!f) return undefined;
  return BASE_BY_ID.get(`${f.group}-${state === "raw" ? "r" : "c"}`);
}

export function hasVariants(id: string): boolean {
  const f = BASE_BY_ID.get(id);
  if (!f || !f.state) return false;
  return !!variantOf(id, f.state === "raw" ? "cooked" : "raw");
}

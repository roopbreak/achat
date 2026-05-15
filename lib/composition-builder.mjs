/**
 * 스토리 메타데이터 기반 composition.json 템플릿 생성
 * 카테고리별 고정 장면 + base_prompt는 외부에서 주입
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStoryBySlug, getStoryById } from './db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR ?? path.join(PROJECT_ROOT, 'data');

// ── 카테고리별 프레이밍/비율 ────────────────────────────────
const CATEGORY_FRAMING = {
  expression: 'close-up, face focus, head shot, from front,',
  daily: 'cowboy shot, from front,',
  outfit: 'cowboy shot, from front,',
  interaction: 'upper body, from front,',
  location: 'full body, wide shot,',
  special: 'cowboy shot,',
  adult: 'cowboy shot,',
};

const CATEGORY_ASPECT_RATIOS = {
  expression: '3:2',
  daily: '3:4',
  outfit: '3:4',
  interaction: '3:4',
  location: '16:9',
  special: '3:4',
  adult: '4:3',
};

// ── 카테고리 분류: 코어(고정) vs 커스텀(스토리 맞춤) ─────────
// 코어: 어떤 스토리든 동일한 표정/체위/오럴 — composition-builder가 자동 생성
const CORE_CATEGORIES = ['expression', 'adult'];
// 커스텀: 스토리 컨셉 기반으로 composition-designer가 작성. customScenes로 주입
const CUSTOM_CATEGORIES = ['daily', 'outfit', 'location', 'special'];
// interaction은 분할: 코어 5장(보편) + 맞춤 N장(스토리 고유)
const CORE_INTERACTION_IDS = new Set([
  'interaction-hug-01',
  'interaction-handhold-01',
  'interaction-headpat-01',
  'interaction-kiss-cheek-01',
  'interaction-lean-01',
]);

// ── 스토리 카테고리 → 템플릿 타입 매핑 ─────────────────────
const SAGEUK_CATEGORIES = ['사극'];         // 한국 사극 전용
const MUHYUP_CATEGORIES = ['무협', '사극/무협']; // 중국풍 무협
const FANTASY_CATEGORIES = ['판타지'];

function getTemplateType(category) {
  if (!category) return 'modern';
  const norm = category.trim();
  if (SAGEUK_CATEGORIES.includes(norm)) return 'sageuk';
  if (MUHYUP_CATEGORIES.includes(norm)) return 'muhyup';
  if (FANTASY_CATEGORIES.includes(norm)) return 'fantasy';
  return 'modern';
}

// 사극 네거티브 (기모노+중국풍 혼동 방지)
const SAGEUK_NEGATIVE = 'kimono, japanese clothes, yukata, obi, japanese architecture, shoji, tatami, chinese clothes, hanfu, western clothes, modern clothes, school uniform';
// 무협 네거티브 (기모노 혼동 방지, 중국풍은 허용)
const MUHYUP_NEGATIVE = 'kimono, japanese clothes, yukata, obi, japanese architecture, shoji, tatami, western clothes, modern clothes, school uniform';

// ── 카테고리별 장면 템플릿 (현대 = 기본) ───────────────────
const SCENE_TEMPLATES = {
  expression: [
    { id: 'expression-smile-01', name: '미소', expression: 'smile, happy, bright eyes,' },
    { id: 'expression-laugh-01', name: '웃음', expression: 'laughing, open mouth, teeth, happy,' },
    { id: 'expression-shy-01', name: '부끄러움', expression: 'shy, blush, looking away, embarrassed,' },
    { id: 'expression-pout-01', name: '삐침', expression: 'pout, puffed cheeks, annoyed,' },
    { id: 'expression-surprise-01', name: '놀람', expression: 'surprised, wide eyes, open mouth,' },
    { id: 'expression-sad-01', name: '슬픔', expression: 'sad, teary eyes, downcast eyes,' },
    { id: 'expression-angry-01', name: '화남', expression: 'angry, furrowed brows, sharp eyes,' },
    { id: 'expression-sleepy-01', name: '졸림', expression: 'sleepy, half-closed eyes, yawning,' },
    { id: 'expression-wink-01', name: '윙크', expression: 'wink, one eye closed, playful,' },
    { id: 'expression-seductive-01', name: '유혹', expression: 'seductive, half-lidded eyes, parted lips, bedroom eyes,' },
    { id: 'expression-crying-01', name: '울음', expression: 'crying, tears, sad expression,' },
    { id: 'expression-smirk-01', name: '능글', expression: 'smirk, confident, sly smile,' },
    { id: 'expression-blush-01', name: '홍조', expression: 'heavy blush, flustered, steam from head,' },
    { id: 'expression-cold-01', name: '냉담', expression: 'cold expression, emotionless, piercing gaze,' },
    { id: 'expression-loving-01', name: '다정', expression: 'gentle smile, warm eyes, loving expression,' },
  ],
  daily: [
    { id: 'daily-casual-01', name: '캐주얼', outfit: 'casual clothes, t-shirt, jeans,' },
    { id: 'daily-home-01', name: '홈웨어', outfit: 'oversized t-shirt, shorts, loungewear,' },
    { id: 'daily-morning-01', name: '아침', outfit: 'pajamas, bedhead, stretching,' },
    { id: 'daily-cooking-01', name: '요리', outfit: 'apron, casual clothes,', pose: 'cooking, holding spatula,' },
    { id: 'daily-reading-01', name: '독서', outfit: 'glasses, casual clothes,', pose: 'reading book, sitting,' },
    { id: 'daily-phone-01', name: '폰', outfit: 'casual clothes,', pose: 'looking at phone, sitting,' },
    { id: 'daily-coffee-01', name: '커피', outfit: 'casual clothes,', pose: 'holding coffee cup, cafe,' },
    { id: 'daily-walking-01', name: '산책', outfit: 'light jacket, casual,', pose: 'walking, outdoor,' },
    { id: 'daily-eating-01', name: '식사', outfit: 'casual clothes,', pose: 'eating, restaurant,' },
    { id: 'daily-selfie-01', name: '셀카', outfit: 'casual clothes,', pose: 'selfie pose, peace sign, pov,' },
    { id: 'daily-stretching-01', name: '스트레칭', outfit: 'sportswear, tank top,', pose: 'stretching, arms up,' },
    { id: 'daily-shopping-01', name: '쇼핑', outfit: 'fashionable outfit, handbag,', pose: 'shopping bags,' },
    { id: 'daily-nap-01', name: '낮잠', outfit: 'casual clothes,', pose: 'sleeping, lying down, peaceful,' },
    { id: 'daily-studying-01', name: '공부', outfit: 'casual clothes, glasses,', pose: 'studying, desk, books,' },
    { id: 'daily-gaming-01', name: '게임', outfit: 'hoodie, headphones,', pose: 'gaming, controller,' },
  ],
  outfit: [
    { id: 'outfit-uniform-01', name: '교복', outfit: 'school uniform, sailor uniform, pleated skirt,' },
    { id: 'outfit-suit-01', name: '정장', outfit: 'business suit, pencil skirt, office lady,' },
    { id: 'outfit-dress-01', name: '원피스', outfit: 'sundress, floral dress, summer,' },
    { id: 'outfit-swimsuit-white-01', name: '흰색 비키니', outfit: 'white bikini, swimsuit, beach, white fabric,', custom_negative: '+nipples, areolae, visible nipples' },
    { id: 'outfit-swimsuit-black-01', name: '블랙 비키니', outfit: 'black bikini, swimsuit, beach, black fabric,', custom_negative: '+nipples, areolae, visible nipples' },
    { id: 'outfit-swimsuit-school-01', name: '스쿨 수영복', outfit: 'school swimsuit, one-piece swimsuit, navy blue,', custom_negative: '+nipples, areolae, visible nipples' },
    { id: 'outfit-hanbok-01', name: '한복', outfit: 'hanbok, korean traditional dress, jeogori, chima,' },
    { id: 'outfit-maid-01', name: '메이드', outfit: 'maid outfit, maid headdress, frills,' },
    { id: 'outfit-nurse-01', name: '간호사', outfit: 'nurse outfit, nurse cap, white stockings,' },
    { id: 'outfit-gym-01', name: '운동복', outfit: 'sports bra, yoga pants, sportswear,', custom_negative: '+nipples, areolae, visible nipples' },
    { id: 'outfit-bunny-01', name: '바니걸', outfit: 'bunny girl, bunny suit, fishnet pantyhose, fake animal ears,' },
    { id: 'outfit-china-01', name: '차이나', outfit: 'china dress, cheongsam, side slit,' },
    { id: 'outfit-sweater-01', name: '스웨터', outfit: 'virgin killer sweater, backless outfit,', custom_negative: '+nipples, areolae, visible nipples' },
    { id: 'outfit-lingerie-white-01', name: '흰색 레이스', outfit: 'white lace lingerie, white lace bra, white lace panties, see-through, sheer,', custom_negative: '+nipples, areolae' },
    { id: 'outfit-lingerie-black-01', name: '검은색 레이스', outfit: 'black lace lingerie, black lace bra, black lace panties, see-through, sheer,', custom_negative: '+nipples, areolae' },
    { id: 'outfit-lingerie-garter-01', name: '가터벨트', outfit: 'garter belt, garter straps, thigh-highs, stockings, lingerie,', custom_negative: '+nipples, areolae' },
    { id: 'outfit-lingerie-cotton-01', name: '흰색 면', outfit: 'white cotton panties, simple bra, plain underwear, innocent,', custom_negative: '+nipples, areolae' },
    { id: 'outfit-lingerie-strawberry-01', name: '딸기 무늬', outfit: 'strawberry print panties, strawberry print bra, cute underwear, fruit pattern,', custom_negative: '+nipples, areolae' },
    { id: 'outfit-lingerie-pink-01', name: '핑크 레이스', outfit: 'pink lace lingerie, pink lace bra, pink lace panties, ribbon, cute,', custom_negative: '+nipples, areolae' },
    { id: 'outfit-wedding-01', name: '웨딩', outfit: 'wedding dress, white dress, veil, bridal, strapless,' },
  ],
  interaction: [
    { id: 'interaction-hug-01', name: '포옹', pose: 'hugging, arms around, pov,' },
    { id: 'interaction-lap-01', name: '무릎베개', pose: 'lap pillow, looking down, pov,' },
    { id: 'interaction-feed-01', name: '먹여주기', pose: 'feeding, holding chopsticks, pov,' },
    { id: 'interaction-handhold-01', name: '손잡기', pose: 'holding hands, interlocked fingers, pov,' },
    { id: 'interaction-backhug-01', name: '백허그', pose: 'back hug, from behind, pov,' },
    { id: 'interaction-headpat-01', name: '쓰다듬기', pose: 'head pat, hand on head, pov, happy,' },
    { id: 'interaction-kiss-cheek-01', name: '볼뽀뽀', pose: 'kiss on cheek, leaning in, pov,' },
    { id: 'interaction-lean-01', name: '기대기', pose: 'leaning on shoulder, sitting together, pov,' },
    { id: 'interaction-wave-01', name: '손흔들기', pose: 'waving, greeting, looking at viewer,' },
    { id: 'interaction-pull-01', name: '끌어당기기', pose: 'pulling by hand, walking, looking back,' },
    { id: 'interaction-piggyback-01', name: '업기', pose: 'piggyback ride, carrying, from behind,' },
    { id: 'interaction-ear-whisper-01', name: '귓속말', pose: 'whispering in ear, close, pov,' },
    { id: 'interaction-tie-01', name: '넥타이매기', pose: 'adjusting tie, close up, pov,' },
    { id: 'interaction-finger-heart-01', name: '손하트', pose: 'finger heart, looking at viewer, cute pose,' },
    { id: 'interaction-poke-cheek-01', name: '볼찌르기', pose: 'poking cheek, playful, pov,' },
  ],
  location: [
    { id: 'location-bedroom-01', name: '침실', custom_tags: 'bedroom, bed, indoor, warm lighting,' },
    { id: 'location-school-01', name: '학교', custom_tags: 'school, classroom, desk, window,' },
    { id: 'location-cafe-01', name: '카페', custom_tags: 'cafe, coffee shop, window seat,' },
    { id: 'location-park-01', name: '공원', custom_tags: 'park, trees, bench, outdoor, sunlight,' },
    { id: 'location-beach-01', name: '해변', custom_tags: 'beach, ocean, sand, sunset,' },
    { id: 'location-rain-01', name: '비', custom_tags: 'rain, umbrella, wet, street,' },
    { id: 'location-night-01', name: '야경', custom_tags: 'night city, city lights, rooftop,' },
    { id: 'location-kitchen-01', name: '주방', custom_tags: 'kitchen, cooking, apron, indoor,' },
    { id: 'location-bath-01', name: '욕실', custom_tags: 'bathroom, bathtub, steam, towel,' },
    { id: 'location-library-01', name: '도서관', custom_tags: 'library, bookshelves, quiet, reading,' },
  ],
  special: [
    { id: 'special-rain-window-01', name: '비오는 창가', custom_tags: 'rain, window, melancholy, looking outside,' },
    { id: 'special-cherry-01', name: '벚꽃', custom_tags: 'cherry blossoms, petals, spring, wind,' },
    { id: 'special-christmas-01', name: '크리스마스', outfit: 'santa costume, red dress, christmas,', custom_tags: 'christmas tree, lights, festive,' },
    { id: 'special-summer-01', name: '여름', custom_tags: 'summer, sunlight, sweat, ice cream,' },
    { id: 'special-snow-01', name: '눈', custom_tags: 'snow, winter, scarf, cold breath,' },
    { id: 'special-sunset-01', name: '석양', custom_tags: 'sunset, golden hour, silhouette, warm colors,' },
    { id: 'special-starry-01', name: '별밤', custom_tags: 'starry sky, night, lying on grass, looking up,' },
    { id: 'special-halloween-01', name: '할로윈', outfit: 'witch hat, costume, halloween,' },
    { id: 'special-birthday-01', name: '생일', custom_tags: 'birthday cake, candles, party, happy,' },
    { id: 'special-after-rain-01', name: '비 갠 후', custom_tags: 'after rain, rainbow, puddles, fresh air,' },
  ],
  adult: [
    // 정상위 변형
    { id: 'adult-missionary-01', name: '정상위', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), missionary, lying on back, legs spread, sex, vaginal, penis,', framing: 'full body,', custom_negative: '+visible male face, ((rolling eyes)), ((white eyes)), ((empty eyes)), ((no pupils))' },
    { id: 'adult-missionary-pov-01', name: '정상위POV', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), missionary, pov, legs wrapped, sex, vaginal,', framing: 'cowboy shot, from above,', expression: 'ahegao, tongue out, drooling, blush,', custom_negative: '+visible male face' },
    { id: 'adult-mating-press-01', name: '메이팅프레스', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), mating press, legs up, folded, sex, vaginal, deep penetration,', framing: 'full body,', expression: 'ahegao, tears, overwhelmed,', custom_negative: '+visible male face' },
    { id: 'adult-missionary-choke-01', name: '목조르며정상위', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), missionary, choking, hand on throat, sex, vaginal,', framing: 'cowboy shot,', expression: 'tears, pleasure, submission,', custom_negative: '+visible male face' },
    // 후배위 변형
    { id: 'adult-doggy-01', name: '후배위', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), doggystyle, all fours, from behind, sex, vaginal, ass,', framing: 'full body, from behind,', custom_negative: '+visible male face' },
    { id: 'adult-doggy-hair-01', name: '머리잡고후배위', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), doggystyle, hair pull, from behind, sex, vaginal, ass,', framing: 'cowboy shot, from behind,', expression: 'moaning, head pulled back,', custom_negative: '+visible male face' },
    { id: 'adult-prone-01', name: '엎드려(프론본)', outfit: '((completely nude)), ((naked)), bare skin, no clothes, ass, back, nipples,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), prone bone, face down, from behind, sex, vaginal,', framing: 'full body, from behind,', custom_negative: '+visible male face' },
    { id: 'adult-desk-doggy-01', name: '책상후배위', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), bent over desk, from behind, sex, vaginal, office,', framing: 'cowboy shot, from side,', custom_negative: '+visible male face' },
    // 기승위 변형
    { id: 'adult-cowgirl-01', name: '기승위', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), cowgirl position, straddling, sitting on lap, sex, vaginal,', framing: 'cowboy shot,', custom_negative: '+visible male face' },
    { id: 'adult-cowgirl-climax-01', name: '기승위절정', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), cowgirl position, arched back, orgasm, sex, vaginal,', framing: 'cowboy shot,', expression: 'ahegao, tongue out, rolling eyes, drooling,', custom_negative: '+visible male face' },
    { id: 'adult-reverse-cowgirl-01', name: '역기승위', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel, ass,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), reverse cowgirl, facing away, sex, vaginal,', framing: 'full body,', custom_negative: '+visible male face' },
    // 특수 체위
    { id: 'adult-standing-01', name: '입위', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), standing sex, against wall, leg lift, sex, vaginal,', framing: 'full body,', custom_negative: '+visible male face' },
    { id: 'adult-against-wall-01', name: '벽치기', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), against wall, pressed against wall, from behind, sex, vaginal,', framing: 'full body,', custom_negative: '+visible male face' },
    { id: 'adult-lifted-wall-01', name: '들어올림벽', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), suspended congress, lifted, legs around waist, against wall, sex, vaginal,', framing: 'full body,', custom_negative: '+visible male face' },
    { id: 'adult-side-01', name: '측위', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), spooning, lying on side, sex, vaginal,', framing: 'full body,', custom_negative: '+visible male face' },
    { id: 'adult-chair-01', name: '의자', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), sitting on lap, chair, sex, vaginal,', framing: 'cowboy shot,', custom_negative: '+visible male face' },
    { id: 'adult-table-01', name: '테이블', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), on table, legs spread, sex, vaginal,', framing: 'cowboy shot,', custom_negative: '+visible male face' },
    // 오럴/파이즈리
    { id: 'adult-oral-01', name: '오럴', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), fellatio, on knees, looking up, oral, penis,', framing: 'cowboy shot,', custom_negative: '+visible male face' },
    { id: 'adult-deepthroat-01', name: '딥스로트', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), deepthroat, fellatio, tears, drooling,', framing: 'upper body,', expression: 'tears, gagging, drool,', custom_negative: '+visible male face' },
    { id: 'adult-paizuri-01', name: '파이즈리', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), paizuri, breast squeeze, penis between breasts,', framing: 'upper body,', custom_negative: '+visible male face' },
    // 사정
    { id: 'adult-facial-01', name: '얼굴사정', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae,', pose: 'cum on face, facial, cum dripping, kneeling,', framing: 'upper body,', expression: 'blush, open mouth, tongue out, cum on tongue,' },
    { id: 'adult-creampie-01', name: '질내사정', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: 'cum, creampie, cum overflow, lying on back, legs spread, after sex,', framing: 'full body,', expression: 'ahegao, exhausted, blush,' },
    { id: 'adult-cum-body-01', name: '몸사정', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: 'cum on body, cum on breasts, cum on stomach, lying down, after sex,', framing: 'full body,', expression: 'satisfied, blush, messy,' },
    // 키스/전희
    { id: 'adult-kiss-01', name: '키스', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), kissing, french kiss, tongue,', framing: 'upper body,', custom_negative: '+visible male face' },
    { id: 'adult-breast-sucking-01', name: '가슴빨기', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), breast sucking, licking nipple, nursing handjob,', framing: 'upper body,', expression: 'blush, pleasure, moaning,', custom_negative: '+visible male face' },
    { id: 'adult-fingering-01', name: '핑거링', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), fingering, hand between legs, on bed,', framing: 'cowboy shot,', expression: 'blush, moaning, squirming,', custom_negative: '+visible male face' },
    // 비삽입/유혹
    { id: 'adult-undressing-01', name: '탈의', outfit: 'undressing, pulling off shirt, partially clothed, bra, panties,', pose: 'standing, looking at viewer,', framing: 'cowboy shot,', expression: 'blush, shy, seductive,' },
    { id: 'adult-topless-01', name: '토플리스', outfit: 'topless, bare breasts, nipples, areolae, skirt, bottomwear,', pose: 'standing, hands behind head, looking at viewer,', framing: 'cowboy shot,', expression: 'confident, seductive, smirk,' },
    { id: 'adult-spread-01', name: '벌리기', outfit: '((completely nude)), ((naked)), bare skin, no clothes, ((nipples)), ((areolae)), navel, ((pussy)), ((spread pussy)),', pose: '((legs spread)), ((spread legs)), lying on back, inviting, on bed, ((legs apart)),', framing: 'full body, from front, between legs,', expression: 'blush, embarrassed, looking away,' },
    { id: 'adult-masturbation-01', name: '자위', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: 'masturbation, hand between legs, lying on bed, pussy,', framing: 'full body,', expression: 'blush, moaning, pleasure,' },
    // 후반/사후
    { id: 'adult-afterglow-01', name: '사후', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: 'lying down, afterglow, sweaty, satisfied, on bed, cum on body,', framing: 'full body,', expression: 'exhausted, blush, happy, closed eyes,' },
    { id: 'adult-bath-01', name: '목욕', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: 'bathing, in bathtub, steam, wet hair, wet skin,', framing: 'cowboy shot,' },
    { id: 'adult-shower-01', name: '샤워', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: 'shower, wet hair, water droplets, standing, steam,', framing: 'full body,' },
    { id: 'adult-morning-after-01', name: '다음날 아침', outfit: 'oversized shirt, no pants, bare legs, no bra, nipple outline,', pose: 'sitting on bed edge, morning light, stretching,', framing: 'cowboy shot,', expression: 'sleepy, satisfied, gentle smile,' },
    // 구속/특수
    { id: 'adult-tied-01', name: '구속', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: 'arms tied, ribbon bondage, on bed, spread legs,', framing: 'full body,', expression: 'blush, embarrassed, teary eyes,', custom_negative: '+visible male face' },
    // 임신
    { id: 'adult-pregnant-01', name: '임신', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: 'pregnant, swollen belly, holding belly, on bed,', framing: 'cowboy shot,', expression: 'gentle smile, maternal, blush,' },
    { id: 'adult-pregnant-sex-01', name: '임신 성교', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), pregnant, swollen belly, sex, vaginal, cowgirl position,', framing: 'cowboy shot,', custom_negative: '+visible male face' },
    // 콘돔
    { id: 'adult-condom-01', name: '콘돔', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), condom, used condom, after sex, on bed,', framing: 'cowboy shot,', expression: 'satisfied, blush, afterglow,', custom_negative: '+visible male face' },
    { id: 'adult-condom-oral-01', name: '콘돔 입으로', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), condom in mouth, putting on condom with mouth,', framing: 'upper body,', expression: 'looking up, seductive, blush,', custom_negative: '+visible male face' },
  ],
};

// ── 사극(한국) 오버라이드 ────────────────────────────────
const SAGEUK_OVERRIDES = {
  daily: [
    { id: 'daily-casual-01', name: '평상복', outfit: 'korean clothes, hanbok, simple, narrow sleeves,' },
    { id: 'daily-home-01', name: '편복', outfit: 'white robe, loose robe, thin fabric, bare shoulders, untied,' },
    { id: 'daily-morning-01', name: '아침', outfit: 'white robe, loose, bedhead, stretching,' },
    { id: 'daily-cooking-01', name: '요리', outfit: 'korean clothes, hanbok, simple, apron,', pose: 'cooking, holding ladle, indoor,' },
    { id: 'daily-reading-01', name: '독서', outfit: 'korean clothes, hanbok, wide sleeves,', pose: 'reading scroll, sitting, wooden floor,' },
    { id: 'daily-phone-01', name: '차', outfit: 'korean clothes, hanbok, elegant,', pose: 'holding teacup, sitting, tea set,' },
    { id: 'daily-coffee-01', name: '주막', outfit: 'korean clothes, hanbok, simple,', pose: 'holding cup, sitting, indoor, paper lanterns,' },
    { id: 'daily-walking-01', name: '산책', outfit: 'korean clothes, hanbok, wide sleeves,', pose: 'walking, outdoor, garden,' },
    { id: 'daily-eating-01', name: '식사', outfit: 'korean clothes, hanbok,', pose: 'eating, sitting, low table, indoor,' },
    { id: 'daily-selfie-01', name: '거울', outfit: 'korean clothes, hanbok,', pose: 'looking at mirror, bronze mirror, sitting, looking at viewer,' },
    { id: 'daily-stretching-01', name: '무예수련', outfit: 'korean clothes, hanbok, training, martial arts,', pose: 'fighting stance, outdoor, arms up,' },
    { id: 'daily-shopping-01', name: '저잣거리', outfit: 'korean clothes, hanbok, simple,', pose: 'walking, traditional market, wooden stalls, lanterns,' },
    { id: 'daily-nap-01', name: '낮잠', outfit: 'korean clothes, hanbok, loose,', pose: 'sleeping, lying down, wooden floor, peaceful,' },
    { id: 'daily-studying-01', name: '서당', outfit: 'korean clothes, hanbok, wide sleeves,', pose: 'studying, scroll, ink, brush, desk, candle,' },
    { id: 'daily-gaming-01', name: '바둑', outfit: 'korean clothes, hanbok, wide sleeves,', pose: 'playing go, sitting, board game, indoor,' },
  ],
  outfit: [
    { id: 'outfit-uniform-01', name: '한복', outfit: 'korean clothes, hanbok, wide sleeves, long skirt, hair bun, hair stick,' },
    { id: 'outfit-suit-01', name: '관복', outfit: 'korean clothes, hanbok, wide sleeves, formal, ornate, long robe,' },
    { id: 'outfit-dress-01', name: '화려한복', outfit: 'korean clothes, hanbok, ornate, colorful, wide sleeves, gold embroidery, silk fabric,' },
    { id: 'outfit-swimsuit-white-01', name: '흰색 비키니', outfit: 'white bikini, swimsuit, beach, white fabric,', custom_negative: '+nipples, areolae, visible nipples' },
    { id: 'outfit-swimsuit-black-01', name: '블랙 비키니', outfit: 'black bikini, swimsuit, beach, black fabric,', custom_negative: '+nipples, areolae, visible nipples' },
    { id: 'outfit-swimsuit-school-01', name: '원피스 수영복', outfit: 'one-piece swimsuit, navy blue,', custom_negative: '+nipples, areolae, visible nipples' },
    { id: 'outfit-hanbok-01', name: '무관복', outfit: 'korean clothes, hanbok, armor, sword, holding sword, wide sleeves, fighting stance,' },
    { id: 'outfit-maid-01', name: '궁녀', outfit: 'korean clothes, hanbok, simple, servant, white inner collar visible, narrow sleeves, hair bun,' },
    { id: 'outfit-nurse-01', name: '의녀', outfit: 'korean clothes, hanbok, white, simple, hair bun, medical, herbs,' },
    { id: 'outfit-gym-01', name: '수련복', outfit: 'korean clothes, hanbok, training, sarashi, bare arms,', custom_negative: '+nipples, areolae, visible nipples' },
    { id: 'outfit-bunny-01', name: '기생', outfit: 'korean clothes, hanbok, ornate, colorful, hair bun, hair stick, hair ornament, elegant, elaborate updo,' },
    { id: 'outfit-china-01', name: '무녀', outfit: 'korean clothes, hanbok, white, priestess, hair bun, hair stick, wide sleeves,' },
    { id: 'outfit-sweater-01', name: '속곳', outfit: 'sarashi, breast wrap, bare back, bare shoulders,', custom_negative: '+nipples, areolae, visible nipples' },
    { id: 'outfit-lingerie-white-01', name: '흰 속곳', outfit: 'sarashi, breast wrap, white cloth, bare shoulders, simple,', custom_negative: '+nipples, areolae' },
    { id: 'outfit-lingerie-black-01', name: '검정 속곳', outfit: 'sarashi, breast wrap, black cloth, bare shoulders,', custom_negative: '+nipples, areolae' },
    { id: 'outfit-lingerie-garter-01', name: '비단끈 속곳', outfit: 'sarashi, breast wrap, ribbon, silk fabric, thigh wrap,', custom_negative: '+nipples, areolae' },
    { id: 'outfit-lingerie-cotton-01', name: '속적삼', outfit: 'white robe, thin fabric, loose, simple, bare shoulders, innocent,', custom_negative: '+nipples, areolae' },
    { id: 'outfit-lingerie-strawberry-01', name: '꽃 속치마', outfit: 'white robe, thin fabric, floral pattern, embroidery, bare shoulders,', custom_negative: '+nipples, areolae' },
    { id: 'outfit-lingerie-pink-01', name: '분홍 속곳', outfit: 'sarashi, breast wrap, pink fabric, silk, ribbon, bare shoulders,', custom_negative: '+nipples, areolae' },
    { id: 'outfit-wedding-01', name: '혼례복', outfit: 'korean clothes, hanbok, ornate, red, gold embroidery, wide sleeves, hair ornament, bridal, elaborate updo,' },
  ],
  location: [
    { id: 'location-bedroom-01', name: '침실', custom_tags: 'traditional room, blanket, candlelight, wooden floor, warm lighting,' },
    { id: 'location-school-01', name: '서당', custom_tags: 'traditional room, wooden floor, scroll, ink, brush, bookshelves, candle,' },
    { id: 'location-cafe-01', name: '주막', custom_tags: 'paper lanterns, warm dim lighting, wooden floor, indoor,' },
    { id: 'location-park-01', name: '정원', custom_tags: 'traditional garden, lotus pond, willow tree, outdoor, sunlight,' },
    { id: 'location-beach-01', name: '해변', custom_tags: 'beach, ocean, sand, sunset,' },
    { id: 'location-rain-01', name: '비', custom_tags: 'rain, umbrella, wet, east asian architecture, wooden pillar,' },
    { id: 'location-night-01', name: '달밤', custom_tags: 'moonlight, east asian architecture, night, paper lanterns, tile roof,' },
    { id: 'location-kitchen-01', name: '부엌', custom_tags: 'traditional kitchen, wooden shelves, pottery, steam, indoor,' },
    { id: 'location-bath-01', name: '목욕', custom_tags: 'bathing, hot water, steam, towel, wooden tub, indoor,' },
    { id: 'location-library-01', name: '서재', custom_tags: 'traditional room, scroll, bookshelves, candle, ink, wooden floor,' },
  ],
  special: [
    { id: 'special-rain-window-01', name: '비오는 처마', custom_tags: 'rain, east asian architecture, eaves, melancholy, looking outside,' },
    { id: 'special-cherry-01', name: '벚꽃', custom_tags: 'cherry blossoms, petals, spring, wind,' },
    { id: 'special-christmas-01', name: '설날', outfit: 'korean clothes, hanbok, ornate, festive,', custom_tags: 'new year, traditional, lanterns, festive,' },
    { id: 'special-summer-01', name: '여름', custom_tags: 'summer, sunlight, fan, sweat, outdoor,' },
    { id: 'special-snow-01', name: '눈', custom_tags: 'snow, winter, fur trim, cold breath,' },
    { id: 'special-sunset-01', name: '석양', custom_tags: 'sunset, golden hour, silhouette, warm colors,' },
    { id: 'special-starry-01', name: '별밤', custom_tags: 'starry sky, night, lying on grass, looking up,' },
    { id: 'special-halloween-01', name: '가면', outfit: 'mask, ornate, mysterious, costume,', custom_tags: 'masquerade, night, paper lanterns,' },
    { id: 'special-birthday-01', name: '잔치', custom_tags: 'feast, celebration, table, food, traditional, lanterns,' },
    { id: 'special-after-rain-01', name: '비 갠 후', custom_tags: 'after rain, rainbow, puddles, fresh air,' },
  ],
  interaction: [
    { id: 'interaction-hug-01', name: '포옹', pose: 'hugging, arms around, pov,' },
    { id: 'interaction-lap-01', name: '무릎베개', pose: 'lap pillow, looking down, pov,' },
    { id: 'interaction-feed-01', name: '먹여주기', pose: 'feeding, holding chopsticks, pov,' },
    { id: 'interaction-handhold-01', name: '손잡기', pose: 'holding hands, interlocked fingers, pov,' },
    { id: 'interaction-backhug-01', name: '백허그', pose: 'back hug, from behind, pov,' },
    { id: 'interaction-headpat-01', name: '쓰다듬기', pose: 'head pat, hand on head, pov, happy,' },
    { id: 'interaction-kiss-cheek-01', name: '볼뽀뽀', pose: 'kiss on cheek, leaning in, pov,' },
    { id: 'interaction-lean-01', name: '기대기', pose: 'leaning on shoulder, sitting together, pov,' },
    { id: 'interaction-wave-01', name: '손흔들기', pose: 'waving, greeting, looking at viewer,' },
    { id: 'interaction-pull-01', name: '끌어당기기', pose: 'pulling by hand, walking, looking back,' },
    { id: 'interaction-piggyback-01', name: '업기', pose: 'piggyback ride, carrying, from behind,' },
    { id: 'interaction-ear-whisper-01', name: '귓속말', pose: 'whispering in ear, close, pov,' },
    { id: 'interaction-tie-01', name: '옷매무새', pose: 'adjusting clothes, close up, pov,' },
    { id: 'interaction-finger-heart-01', name: '꽃 건네기', pose: 'offering flower, looking at viewer, gentle smile,' },
    { id: 'interaction-poke-cheek-01', name: '볼찌르기', pose: 'poking cheek, playful, pov,' },
  ],
};

// ── 무협(중국풍) 오버라이드 — 사극과 동일 구조, 중국계 태그 사용 ──
const MUHYUP_OVERRIDES = {
  daily: [
    { id: 'daily-casual-01', name: '평상복', outfit: 'chinese clothes, hanfu, simple, narrow sleeves,' },
    { id: 'daily-home-01', name: '편복', outfit: 'white robe, loose robe, thin fabric, bare shoulders, untied,' },
    { id: 'daily-morning-01', name: '아침', outfit: 'white robe, loose, bedhead, stretching,' },
    { id: 'daily-cooking-01', name: '요리', outfit: 'chinese clothes, hanfu, simple, apron,', pose: 'cooking, holding ladle, indoor,' },
    { id: 'daily-reading-01', name: '독서', outfit: 'chinese clothes, hanfu, wide sleeves,', pose: 'reading scroll, sitting, wooden floor,' },
    { id: 'daily-phone-01', name: '차', outfit: 'chinese clothes, hanfu, elegant,', pose: 'holding teacup, sitting, tea set,' },
    { id: 'daily-coffee-01', name: '주막', outfit: 'chinese clothes, hanfu, simple,', pose: 'holding cup, sitting, indoor, paper lanterns,' },
    { id: 'daily-walking-01', name: '산책', outfit: 'chinese clothes, hanfu, wide sleeves,', pose: 'walking, outdoor, garden,' },
    { id: 'daily-eating-01', name: '식사', outfit: 'chinese clothes, hanfu,', pose: 'eating, sitting, low table, indoor,' },
    { id: 'daily-selfie-01', name: '거울', outfit: 'chinese clothes, hanfu,', pose: 'looking at mirror, bronze mirror, sitting, looking at viewer,' },
    { id: 'daily-stretching-01', name: '무예수련', outfit: 'chinese clothes, hanfu, martial arts, training,', pose: 'fighting stance, outdoor, arms up,' },
    { id: 'daily-shopping-01', name: '저잣거리', outfit: 'chinese clothes, hanfu, simple,', pose: 'walking, traditional market, wooden stalls, lanterns,' },
    { id: 'daily-nap-01', name: '낮잠', outfit: 'chinese clothes, hanfu, loose,', pose: 'sleeping, lying down, wooden floor, peaceful,' },
    { id: 'daily-studying-01', name: '서당', outfit: 'chinese clothes, hanfu, wide sleeves,', pose: 'studying, scroll, ink, brush, desk, candle,' },
    { id: 'daily-gaming-01', name: '바둑', outfit: 'chinese clothes, hanfu, wide sleeves,', pose: 'playing go, sitting, board game, indoor,' },
  ],
  outfit: [
    { id: 'outfit-uniform-01', name: '한푸', outfit: 'chinese clothes, hanfu, wide sleeves, long skirt, hair bun, hair stick,' },
    { id: 'outfit-suit-01', name: '관복', outfit: 'chinese clothes, changpao, wide sleeves, formal, ornate,' },
    { id: 'outfit-dress-01', name: '화려한푸', outfit: 'chinese clothes, hanfu, ornate, colorful, wide sleeves, gold embroidery, silk fabric,' },
    { id: 'outfit-swimsuit-white-01', name: '흰색 비키니', outfit: 'white bikini, swimsuit, beach, white fabric,', custom_negative: '+nipples, areolae, visible nipples' },
    { id: 'outfit-swimsuit-black-01', name: '블랙 비키니', outfit: 'black bikini, swimsuit, beach, black fabric,', custom_negative: '+nipples, areolae, visible nipples' },
    { id: 'outfit-swimsuit-school-01', name: '원피스 수영복', outfit: 'one-piece swimsuit, navy blue,', custom_negative: '+nipples, areolae, visible nipples' },
    { id: 'outfit-hanbok-01', name: '무사복', outfit: 'chinese clothes, hanfu, sword, holding sword, wide sleeves, fighting stance,' },
    { id: 'outfit-maid-01', name: '시녀', outfit: 'chinese clothes, hanfu, simple, servant, narrow sleeves, hair bun,' },
    { id: 'outfit-nurse-01', name: '의녀', outfit: 'chinese clothes, hanfu, white, simple, hair bun, medical, herbs,' },
    { id: 'outfit-gym-01', name: '수련복', outfit: 'chinese clothes, hanfu, martial arts, sarashi, bare arms,', custom_negative: '+nipples, areolae, visible nipples' },
    { id: 'outfit-bunny-01', name: '기녀', outfit: 'chinese clothes, hanfu, ornate, colorful, hair bun, hair stick, hair ornament, elegant, elaborate updo,' },
    { id: 'outfit-china-01', name: '무녀', outfit: 'chinese clothes, hanfu, white, priestess, hair bun, hair stick, wide sleeves,' },
    { id: 'outfit-sweater-01', name: '두두', outfit: 'dudou, chinese clothes, bare back, bare shoulders,', custom_negative: '+nipples, areolae, visible nipples' },
    { id: 'outfit-lingerie-white-01', name: '흰 속곳', outfit: 'sarashi, breast wrap, white cloth, bare shoulders, simple,', custom_negative: '+nipples, areolae' },
    { id: 'outfit-lingerie-black-01', name: '검정 속곳', outfit: 'sarashi, breast wrap, black cloth, bare shoulders,', custom_negative: '+nipples, areolae' },
    { id: 'outfit-lingerie-garter-01', name: '비단끈 속곳', outfit: 'sarashi, breast wrap, ribbon, silk fabric, thigh wrap,', custom_negative: '+nipples, areolae' },
    { id: 'outfit-lingerie-cotton-01', name: '속적삼', outfit: 'white robe, thin fabric, loose, simple, bare shoulders, innocent,', custom_negative: '+nipples, areolae' },
    { id: 'outfit-lingerie-strawberry-01', name: '꽃 속치마', outfit: 'white robe, thin fabric, floral pattern, embroidery, bare shoulders,', custom_negative: '+nipples, areolae' },
    { id: 'outfit-lingerie-pink-01', name: '분홍 속곳', outfit: 'sarashi, breast wrap, pink fabric, silk, ribbon, bare shoulders,', custom_negative: '+nipples, areolae' },
    { id: 'outfit-wedding-01', name: '혼례복', outfit: 'chinese clothes, hanfu, ornate, red, gold embroidery, wide sleeves, hair ornament, bridal, elaborate updo,' },
  ],
  location: SAGEUK_OVERRIDES.location,  // 장소는 사극과 동일
  special: SAGEUK_OVERRIDES.special,
  interaction: SAGEUK_OVERRIDES.interaction,
};

// ── 판타지 오버라이드 (daily, outfit, location, special) ────
const FANTASY_OVERRIDES = {
  daily: [
    { id: 'daily-casual-01', name: '평상복', outfit: 'tunic, belt, medieval, simple,' },
    { id: 'daily-home-01', name: '잠옷', outfit: 'nightgown, loose, white, thin fabric, bare feet,' },
    { id: 'daily-morning-01', name: '아침', outfit: 'nightgown, loose, bedhead, stretching,' },
    { id: 'daily-cooking-01', name: '요리', outfit: 'tunic, apron, medieval,', pose: 'cooking, holding ladle, stone kitchen,' },
    { id: 'daily-reading-01', name: '독서', outfit: 'robe, long sleeves,', pose: 'reading book, sitting, library,' },
    { id: 'daily-phone-01', name: '수정구', outfit: 'robe, mystical,', pose: 'crystal ball, looking, sitting, magical glow,' },
    { id: 'daily-coffee-01', name: '약초차', outfit: 'tunic, simple,', pose: 'holding cup, sitting, tavern, wooden interior,' },
    { id: 'daily-walking-01', name: '숲산책', outfit: 'cloak, tunic, belt,', pose: 'walking, outdoor, enchanted forest,' },
    { id: 'daily-eating-01', name: '식사', outfit: 'tunic, medieval,', pose: 'eating, tavern, wooden table, candle,' },
    { id: 'daily-selfie-01', name: '거울', outfit: 'robe, elegant,', pose: 'looking at mirror, ornate mirror, looking at viewer,' },
    { id: 'daily-stretching-01', name: '검술훈련', outfit: 'leather armor, training,', pose: 'sword, holding sword, fighting stance, outdoor,' },
    { id: 'daily-shopping-01', name: '마을시장', outfit: 'tunic, cloak, belt,', pose: 'walking, medieval market, stalls, outdoor,' },
    { id: 'daily-nap-01', name: '낮잠', outfit: 'tunic, simple,', pose: 'sleeping, lying down, under tree, peaceful,' },
    { id: 'daily-studying-01', name: '마법공부', outfit: 'robe, long sleeves,', pose: 'studying, magic circle, floating books, desk,' },
    { id: 'daily-gaming-01', name: '카드게임', outfit: 'tunic, medieval,', pose: 'playing cards, sitting, tavern, indoor,' },
  ],
  outfit: [
    { id: 'outfit-uniform-01', name: '마법사로브', outfit: 'robe, hooded robe, long sleeves, mystical, staff,' },
    { id: 'outfit-suit-01', name: '기사갑옷', outfit: 'armor, breastplate, pauldrons, gauntlets, cape,' },
    { id: 'outfit-dress-01', name: '귀족드레스', outfit: 'elegant dress, long dress, fur trim, ornate, jewelry, tiara,' },
    { id: 'outfit-swimsuit-white-01', name: '흰색 비키니', outfit: 'white bikini, swimsuit, beach, white fabric,', custom_negative: '+nipples, areolae, visible nipples' },
    { id: 'outfit-swimsuit-black-01', name: '블랙 비키니', outfit: 'black bikini, swimsuit, beach, black fabric,', custom_negative: '+nipples, areolae, visible nipples' },
    { id: 'outfit-swimsuit-school-01', name: '원피스 수영복', outfit: 'one-piece swimsuit, navy blue,', custom_negative: '+nipples, areolae, visible nipples' },
    { id: 'outfit-hanbok-01', name: '튜닉', outfit: 'tunic, belt, leather, adventurer, pouch,' },
    { id: 'outfit-maid-01', name: '중세하녀', outfit: 'victorian maid, long dress, apron, headdress, modest,' },
    { id: 'outfit-nurse-01', name: '사제', outfit: 'robe, white robe, tabard, circlet, holy, gentle,' },
    { id: 'outfit-gym-01', name: '훈련복', outfit: 'leather armor, light armor, belt, training,', custom_negative: '+nipples, areolae, visible nipples' },
    { id: 'outfit-bunny-01', name: '서큐버스', outfit: 'demon girl, revealing clothes, dark, seductive, wings,', custom_negative: '-horns, -tail, -demon, -pointy ears' },
    { id: 'outfit-china-01', name: '엘프', outfit: 'elf, circlet, long hair, robe, nature, elegant,', custom_negative: '-pointy ears' },
    { id: 'outfit-sweater-01', name: '코르셋', outfit: 'corset, lace, ribbons, bare shoulders,', custom_negative: '+nipples, areolae, visible nipples' },
    { id: 'outfit-lingerie-white-01', name: '흰 코르셋', outfit: 'white corset, lace, ribbons, garter belt, thigh-highs, white,', custom_negative: '+nipples, areolae' },
    { id: 'outfit-lingerie-black-01', name: '검정 코르셋', outfit: 'black corset, lace, ribbons, garter belt, thigh-highs, black,', custom_negative: '+nipples, areolae' },
    { id: 'outfit-lingerie-garter-01', name: '가터벨트', outfit: 'garter belt, garter straps, thigh-highs, stockings, corset,', custom_negative: '+nipples, areolae' },
    { id: 'outfit-lingerie-cotton-01', name: '흰 슬립', outfit: 'white nightgown, thin fabric, sheer, bare shoulders, innocent,', custom_negative: '+nipples, areolae' },
    { id: 'outfit-lingerie-strawberry-01', name: '꽃 란제리', outfit: 'nightgown, thin fabric, floral pattern, lace, bare shoulders,', custom_negative: '+nipples, areolae' },
    { id: 'outfit-lingerie-pink-01', name: '핑크 코르셋', outfit: 'pink corset, lace, ribbons, pink, cute, bare shoulders,', custom_negative: '+nipples, areolae' },
    { id: 'outfit-wedding-01', name: '판타지웨딩', outfit: 'wedding dress, white dress, veil, bridal, fantasy, flowers, tiara, ornate,' },
  ],
  location: [
    { id: 'location-bedroom-01', name: '침실', custom_tags: 'castle bedroom, stone walls, canopy bed, candlelight, tapestry,' },
    { id: 'location-school-01', name: '아카데미', custom_tags: 'library, grand hall, stone pillars, bookshelves, magic circle,' },
    { id: 'location-cafe-01', name: '주점', custom_tags: 'tavern, wooden interior, barrel, candlelight, medieval,' },
    { id: 'location-park-01', name: '숲', custom_tags: 'enchanted forest, trees, sunlight, mystical, nature,' },
    { id: 'location-beach-01', name: '해변', custom_tags: 'beach, ocean, sand, sunset,' },
    { id: 'location-rain-01', name: '비', custom_tags: 'rain, cloak, wet, cobblestone, medieval street,' },
    { id: 'location-night-01', name: '성야경', custom_tags: 'castle, night, moonlight, torch, stone walls,' },
    { id: 'location-kitchen-01', name: '주방', custom_tags: 'stone kitchen, fireplace, cauldron, medieval, indoor,' },
    { id: 'location-bath-01', name: '욕실', custom_tags: 'royal bath, stone bath, steam, candle, ornate,' },
    { id: 'location-library-01', name: '마법도서관', custom_tags: 'grand library, floating books, bookshelves, mystical lighting, candle,' },
  ],
  special: [
    { id: 'special-rain-window-01', name: '비오는 성창가', custom_tags: 'rain, castle window, stone walls, melancholy, looking outside,' },
    { id: 'special-cherry-01', name: '벚꽃', custom_tags: 'cherry blossoms, petals, spring, wind,' },
    { id: 'special-christmas-01', name: '축제', outfit: 'festive dress, ornate, cape, fur trim,', custom_tags: 'festival, decorations, lights, festive,' },
    { id: 'special-summer-01', name: '여름', custom_tags: 'summer, sunlight, sweat, nature,' },
    { id: 'special-snow-01', name: '눈', custom_tags: 'snow, winter, fur trim, cloak, cold breath,' },
    { id: 'special-sunset-01', name: '석양', custom_tags: 'sunset, golden hour, silhouette, warm colors,' },
    { id: 'special-starry-01', name: '별밤', custom_tags: 'starry sky, night, lying on grass, looking up,' },
    { id: 'special-halloween-01', name: '마녀', outfit: 'witch hat, cloak, staff, mystical,' },
    { id: 'special-birthday-01', name: '연회', custom_tags: 'banquet, feast, grand hall, candles, celebration,' },
    { id: 'special-after-rain-01', name: '비 갠 후', custom_tags: 'after rain, rainbow, puddles, fresh air,' },
  ],
};

// ── 템플릿 타입별 씬 선택 ──────────────────────────────────
function getSceneTemplates(templateType) {
  if (templateType === 'sageuk') {
    return {
      ...SCENE_TEMPLATES,
      daily: SAGEUK_OVERRIDES.daily,
      outfit: SAGEUK_OVERRIDES.outfit,
      location: SAGEUK_OVERRIDES.location,
      special: SAGEUK_OVERRIDES.special,
      interaction: SAGEUK_OVERRIDES.interaction,
    };
  }
  if (templateType === 'muhyup') {
    return {
      ...SCENE_TEMPLATES,
      daily: MUHYUP_OVERRIDES.daily,
      outfit: MUHYUP_OVERRIDES.outfit,
      location: MUHYUP_OVERRIDES.location,
      special: MUHYUP_OVERRIDES.special,
      interaction: MUHYUP_OVERRIDES.interaction,
    };
  }
  if (templateType === 'fantasy') {
    return {
      ...SCENE_TEMPLATES,
      daily: FANTASY_OVERRIDES.daily,
      outfit: FANTASY_OVERRIDES.outfit,
      location: FANTASY_OVERRIDES.location,
      special: FANTASY_OVERRIDES.special,
    };
  }
  return SCENE_TEMPLATES;
}

// ── 컴포지션 저장/로드 ───────────────────────────────────
function getCompositionPath(slug) {
  return path.join(DATA_DIR, 'stories', slug, 'composition.json');
}

export function loadComposition(slug) {
  const p = getCompositionPath(slug);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

export function saveComposition(slug, composition) {
  const dir = path.dirname(getCompositionPath(slug));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getCompositionPath(slug), JSON.stringify(composition, null, 2));
}

// ── 멀티 캐릭터용 축소 템플릿 (캐릭터당 30~50장) ────────────
// 캐릭터 수에 따라 슬라이스: 2명=50, 3명=40, 4명+=30
function getMultiSlice(charCount) {
  if (charCount <= 2) return { expression: 8, daily: 7, outfit: 7, interaction: 7, location: 5, special: 4, adult: 12 }; // 50
  if (charCount <= 3) return { expression: 7, daily: 5, outfit: 5, interaction: 5, location: 4, special: 3, adult: 11 }; // 40
  return { expression: 5, daily: 4, outfit: 4, interaction: 4, location: 3, special: 2, adult: 8 }; // 30
}

// ── 커스텀 씬 정규화 ────────────────────────────────────
// composition-designer가 작성한 customScenes 항목을 표준 형태로 변환
// multi=true면 캐릭터 간 id 충돌 방지를 위해 id에 `${charKey}-` 접두사 부여
function normalizeCustomScene(scene, category, index, charKey, multi = false) {
  const baseId = scene.id || `${category}-custom-${String(index + 1).padStart(2, '0')}`;
  const id = multi ? `${charKey}-${baseId}` : baseId;
  return {
    character: charKey,
    category,
    framing: CATEGORY_FRAMING[category],
    aspect_ratio: CATEGORY_ASPECT_RATIOS[category],
    ...scene,
    id,
  };
}

// ── 캐릭터 1명분 이미지 목록 생성 ───────────────────────────
// charKey: 캐릭터 키 (main/sub1/...)
// templates: getSceneTemplates 결과
// customScenesForChar: 해당 캐릭터의 { daily, outfit, location, special, interaction } 맵 (없으면 null)
//   - 싱글: opts.customScenes(평면)를 그대로 전달
//   - 멀티: opts.customScenes[charKey](중첩 블록)를 전달
// opts.multi: 멀티 캐릭터 composition 여부 — true면 id에 charKey 접두사, 코어는 slice 축소
// opts.slice: 멀티일 때 getMultiSlice 결과 (코어/fallback 카테고리 축소 카운트)
//
// 규칙:
//   - 코어(expression/adult): 자동 템플릿. 멀티는 slice로 축소
//   - interaction: customScenes 있으면 코어 5장(슬라이스 안 함, 항상 전체) + 맞춤 N장, 없으면 fallback
//   - daily/outfit/location/special: customScenes 있으면 완전 대체, 없으면 fallback
//   - fallback은 멀티면 slice 축소, 싱글이면 전체
function buildCharImages(charKey, templates, customScenesForChar, opts = {}) {
  const { multi = false, slice = null } = opts;
  const out = [];

  // 빈 객체 블록({})은 "커스텀 없음"으로 간주 — charKey 미제공과 동일하게 전 카테고리 fallback
  const customBlock =
    customScenesForChar && Object.keys(customScenesForChar).length > 0
      ? customScenesForChar
      : null;

  // 자동 템플릿 1장 push (멀티면 id에 charKey 접두사)
  const pushTemplate = (category, scene) => {
    const img = {
      character: charKey,
      category,
      framing: CATEGORY_FRAMING[category],
      aspect_ratio: CATEGORY_ASPECT_RATIOS[category],
      ...scene,
    };
    if (multi) img.id = `${charKey}-${scene.id}`;
    out.push(img);
  };

  // 멀티: getMultiSlice 카운트만큼 축소 / 싱글: 전체
  const sliced = (category, scenes) =>
    multi ? scenes.slice(0, (slice && slice[category]) || 0) : scenes;

  for (const [category, scenes] of Object.entries(templates)) {
    const isCore = CORE_CATEGORIES.includes(category);
    const isCustom = CUSTOM_CATEGORIES.includes(category);
    const isInteraction = category === 'interaction';

    // 1. 코어(expression/adult): 자동 템플릿. 멀티는 slice 축소
    if (isCore) {
      for (const scene of sliced(category, scenes)) pushTemplate(category, scene);
      continue;
    }

    // 2. interaction: customScenes 모드면 코어 5장(슬라이스 안 함) + 맞춤 N장, 아니면 fallback
    if (isInteraction) {
      if (customBlock) {
        for (const scene of scenes) {
          if (CORE_INTERACTION_IDS.has(scene.id)) pushTemplate(category, scene);
        }
        const customInter = customBlock.interaction;
        if (Array.isArray(customInter)) {
          customInter.forEach((scene, idx) =>
            out.push(normalizeCustomScene(scene, category, idx, charKey, multi)));
        }
      } else {
        for (const scene of sliced(category, scenes)) pushTemplate(category, scene);
      }
      continue;
    }

    // 3. 커스텀(daily/outfit/location/special): customScenes 있으면 대체, 없으면 fallback
    if (isCustom) {
      const custom = customBlock?.[category];
      if (Array.isArray(custom) && custom.length > 0) {
        custom.forEach((scene, idx) =>
          out.push(normalizeCustomScene(scene, category, idx, charKey, multi)));
      } else {
        for (const scene of sliced(category, scenes)) pushTemplate(category, scene);
      }
      continue;
    }

    // 4. 그 외(미분류): 자동 템플릿
    for (const scene of sliced(category, scenes)) pushTemplate(category, scene);
  }

  return out;
}

// ── 메인: 템플릿 기반 composition 생성 ──────────────────────
// characters: { main: { name, base_prompt, base_negative }, sub1: { ... }, ... }
// 단일 캐릭터: { basePrompt, baseNegative } (하위 호환)
// customScenes:
//   - 싱글: { daily: [...], outfit: [...], location: [...], special: [...], interaction: [...] } (평면)
//   - 멀티: { main: { daily: [...], ... }, sub1: { ... }, ... } (charKey로 중첩)
//   - 멀티에서 customScenes에 없는 캐릭터는 getMultiSlice 자동 슬라이스로 fallback
//   - interaction은 코어 5장에 추가로 머지됨 (대체가 아님)
//   - daily/outfit/location/special은 customScenes 있으면 완전 대체, 없으면 fallback
export function buildComposition(slug, opts = {}) {
  const story = getStoryBySlug(slug);
  if (!story) throw new Error(`스토리 없음: ${slug}`);

  // characters 객체 구성
  let characters;
  if (opts.characters && Object.keys(opts.characters).length > 0) {
    characters = opts.characters;
  } else {
    characters = {
      main: {
        name: story.char_name,
        base_prompt: opts.basePrompt || '',
        base_negative: opts.baseNegative || '',
      },
    };
  }

  const charKeys = Object.keys(characters);
  const isMulti = charKeys.length > 1;

  // 카테고리 기반 템플릿 분기
  const templateType = getTemplateType(story.category);
  const templates = getSceneTemplates(templateType);

  // 커스텀 씬: 싱글은 평면 맵, 멀티는 charKey로 중첩된 맵
  const customScenes = opts.customScenes || null;

  const images = [];
  if (isMulti) {
    // 멀티 캐릭터: customScenes 블록이 있는 캐릭터는 적용, 없으면 getMultiSlice 자동 축소
    const slice = getMultiSlice(charKeys.length);
    for (const charKey of charKeys) {
      const customForChar = (customScenes && customScenes[charKey]) ? customScenes[charKey] : null;
      images.push(...buildCharImages(charKey, templates, customForChar, { multi: true, slice }));
    }
  } else {
    // 싱글 캐릭터: customScenes(평면)를 그대로 적용
    images.push(...buildCharImages(charKeys[0], templates, customScenes, { multi: false }));
  }

  // 사극/무협은 기모노 혼동 방지 네거티브 자동 추가
  const categoryNegative =
    templateType === 'sageuk' ? SAGEUK_NEGATIVE :
    templateType === 'muhyup' ? MUHYUP_NEGATIVE : '';

  const composition = {
    characters,
    defaults: {
      model: 'nai-diffusion-4-5-full',
      aspect_ratio: '3:4',
      steps: 28,
      scale: 6.0,
      rescale: 0.6,
      sampler: 'k_dpmpp_2m',
      category_framing: CATEGORY_FRAMING,
      category_aspect_ratios: CATEGORY_ASPECT_RATIOS,
      ...(categoryNegative && { category_negative: categoryNegative }),
    },
    template_type: templateType,
    images,
  };

  saveComposition(slug, composition);
  // 커스텀 요약: 싱글은 카테고리별 장수, 멀티는 캐릭터별 총 커스텀 장수
  const summarizeBlock = (block) =>
    Object.entries(block)
      .filter(([, v]) => Array.isArray(v) && v.length > 0)
      .map(([k, v]) => `${k}=${v.length}`)
      .join(', ');
  let customInfo = '';
  if (customScenes && isMulti) {
    const parts = charKeys
      .filter((k) => customScenes[k])
      .map((k) => {
        const block = customScenes[k];
        const n = Object.values(block).reduce((a, v) => a + (Array.isArray(v) ? v.length : 0), 0);
        return `${k}:${n}`;
      });
    customInfo = parts.length ? ` (커스텀: ${parts.join(', ')})` : '';
  } else if (customScenes) {
    customInfo = ` (커스텀: ${summarizeBlock(customScenes) || '없음'})`;
  }
  console.log(`[Composition] ${slug}: 템플릿 생성 완료 (${charKeys.length}캐릭터, ${images.length}장, 타입=${templateType}${customInfo})`);
  return composition;
}

// 라우트/에이전트에서 카테고리 화이트리스트 검증용
export const COMPOSITION_CATEGORIES = {
  core: CORE_CATEGORIES,
  custom: CUSTOM_CATEGORIES,
  interaction: 'interaction',
  all: [...CORE_CATEGORIES, ...CUSTOM_CATEGORIES, 'interaction'],
  // customScenes 입력으로 받을 수 있는 카테고리 (custom + interaction 분할분)
  customAllowed: [...CUSTOM_CATEGORIES, 'interaction'],
};

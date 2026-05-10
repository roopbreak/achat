/**
 * 스토리 메타데이터 기반 composition.json 템플릿 생성
 * 카테고리별 고정 장면 + base_prompt는 외부에서 주입
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStory } from './db.mjs';

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

// ── 카테고리별 장면 템플릿 ──────────────────────────────────
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
    { id: 'outfit-swimsuit-01', name: '수영복', outfit: 'bikini, swimsuit, beach,', custom_negative: '+nipples, areolae, visible nipples' },
    { id: 'outfit-kimono-01', name: '기모노', outfit: 'kimono, traditional japanese clothing,' },
    { id: 'outfit-hanbok-01', name: '한복', outfit: 'hanbok, korean traditional dress,' },
    { id: 'outfit-maid-01', name: '메이드', outfit: 'maid outfit, maid headdress, frills,' },
    { id: 'outfit-nurse-01', name: '간호사', outfit: 'nurse outfit, nurse cap, white stockings,' },
    { id: 'outfit-gym-01', name: '운동복', outfit: 'sports bra, yoga pants, sportswear,', custom_negative: '+nipples, areolae, visible nipples' },
    { id: 'outfit-wedding-01', name: '웨딩', outfit: 'wedding dress, white dress, veil, bridal,' },
    { id: 'outfit-bunny-01', name: '바니걸', outfit: 'bunny girl, bunny suit, fishnet pantyhose, fake animal ears,' },
    { id: 'outfit-china-01', name: '차이나', outfit: 'china dress, cheongsam, side slit,' },
    { id: 'outfit-sweater-01', name: '스웨터', outfit: 'virgin killer sweater, backless outfit,', custom_negative: '+nipples, areolae, visible nipples' },
    { id: 'outfit-gothic-01', name: '고딕', outfit: 'gothic lolita, black dress, lace, ribbon,' },
    { id: 'outfit-lingerie-01', name: '란제리', outfit: 'lingerie, lace bra, garter belt, stockings,', custom_negative: '+nipples, areolae, visible nipples' },
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
    { id: 'adult-missionary-01', name: '정상위', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), missionary, lying on back, legs spread, sex, vaginal, penis,', framing: 'full body,', custom_negative: '+visible male face, ((rolling eyes)), ((white eyes)), ((empty eyes)), ((no pupils))' },
    { id: 'adult-doggy-01', name: '후배위', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), doggystyle, all fours, from behind, sex, vaginal, ass,', framing: 'full body, from behind,', custom_negative: '+visible male face, ((rolling eyes)), ((white eyes)), ((empty eyes)), ((no pupils))' },
    { id: 'adult-cowgirl-01', name: '기승위', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), cowgirl position, straddling, sitting on lap, sex, vaginal,', framing: 'cowboy shot,', custom_negative: '+visible male face, ((rolling eyes)), ((white eyes)), ((empty eyes)), ((no pupils))' },
    { id: 'adult-side-01', name: '측위', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), spooning, lying on side, sex, vaginal,', framing: 'full body,', custom_negative: '+visible male face, ((rolling eyes)), ((white eyes)), ((empty eyes)), ((no pupils))' },
    { id: 'adult-standing-01', name: '입위', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), standing sex, against wall, leg lift, sex, vaginal,', framing: 'full body,', custom_negative: '+visible male face, ((rolling eyes)), ((white eyes)), ((empty eyes)), ((no pupils))' },
    { id: 'adult-kiss-01', name: '키스', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), kissing, french kiss, tongue,', framing: 'upper body,', custom_negative: '+visible male face, ((rolling eyes)), ((white eyes)), ((empty eyes)), ((no pupils))' },
    { id: 'adult-oral-01', name: '오럴', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), fellatio, on knees, looking up, oral, penis,', framing: 'cowboy shot,', custom_negative: '+visible male face, ((rolling eyes)), ((white eyes)), ((empty eyes)), ((no pupils))' },
    { id: 'adult-paizuri-01', name: '파이즈리', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), paizuri, breast squeeze, penis between breasts,', framing: 'upper body,', custom_negative: '+visible male face, ((rolling eyes)), ((white eyes)), ((empty eyes)), ((no pupils))' },
    { id: 'adult-afterglow-01', name: '사후', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: 'lying down, afterglow, sweaty, satisfied, on bed, cum on body,', framing: 'full body,', expression: 'exhausted, blush, happy, closed eyes,' },
    { id: 'adult-bath-01', name: '목욕', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: 'bathing, in bathtub, steam, wet hair, wet skin,', framing: 'cowboy shot,' },
    { id: 'adult-prone-01', name: '엎드려', outfit: '((completely nude)), ((naked)), bare skin, no clothes, ass, back,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), prone bone, face down, from behind, sex, vaginal,', framing: 'full body, from behind,', custom_negative: '+visible male face, ((rolling eyes)), ((white eyes)), ((empty eyes)), ((no pupils))' },
    { id: 'adult-reverse-cowgirl-01', name: '역기승위', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel, ass,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), reverse cowgirl, facing away, sex, vaginal,', framing: 'full body,', custom_negative: '+visible male face, ((rolling eyes)), ((white eyes)), ((empty eyes)), ((no pupils))' },
    { id: 'adult-against-wall-01', name: '벽치기', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), against wall, pressed against wall, from behind, sex, vaginal,', framing: 'full body,', custom_negative: '+visible male face, ((rolling eyes)), ((white eyes)), ((empty eyes)), ((no pupils))' },
    { id: 'adult-shower-01', name: '샤워', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: 'shower, wet hair, water droplets, standing, steam,', framing: 'full body,' },
    { id: 'adult-spread-01', name: '벌리기', outfit: '((completely nude)), ((naked)), bare skin, no clothes, ((nipples)), ((areolae)), navel, ((pussy)), ((spread pussy)),', pose: '((legs spread)), ((spread legs)), lying on back, inviting, on bed, ((legs apart)),', framing: 'full body, from front, between legs,', expression: 'blush, embarrassed, looking away,' },
    { id: 'adult-ride-01', name: '올라타기', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)), girl on top, riding, bouncing, sex, vaginal,', framing: 'cowboy shot,', custom_negative: '+visible male face, ((rolling eyes)), ((white eyes)), ((empty eyes)), ((no pupils))' },
    { id: 'adult-masturbation-01', name: '자위', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: 'masturbation, hand between legs, lying on bed, pussy,', framing: 'full body,', expression: 'blush, moaning, pleasure,' },
    { id: 'adult-undressing-01', name: '탈의', outfit: 'undressing, pulling off shirt, partially clothed, bra, panties,', pose: 'standing, looking at viewer,', framing: 'cowboy shot,', expression: 'blush, shy, seductive,' },
    { id: 'adult-morning-after-01', name: '다음날 아침', outfit: 'oversized shirt, no pants, bare legs, no bra, nipple outline,', pose: 'sitting on bed edge, morning light, stretching,', framing: 'cowboy shot,', expression: 'sleepy, satisfied, gentle smile,' },
    { id: 'adult-tied-01', name: '구속', outfit: '((completely nude)), ((naked)), bare skin, no clothes, nipples, areolae, navel,', pose: 'arms tied, ribbon bondage, on bed, spread legs,', framing: 'full body,', expression: 'blush, embarrassed, teary eyes,', custom_negative: '+visible male face, ((rolling eyes)), ((white eyes)), ((empty eyes)), ((no pupils))' },
  ],
};

// ── 컴포지션 저장/로드 ───────────────────────────────────
function getCompositionPath(storyName) {
  return path.join(DATA_DIR, 'stories', storyName.normalize('NFC'), 'composition.json');
}

export function loadComposition(storyName) {
  const p = getCompositionPath(storyName);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

export function saveComposition(storyName, composition) {
  const dir = path.dirname(getCompositionPath(storyName));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getCompositionPath(storyName), JSON.stringify(composition, null, 2));
}

// ── 멀티 캐릭터용 축소 템플릿 (캐릭터당 30~50장) ────────────
// 캐릭터 수에 따라 슬라이스: 2명=50, 3명=40, 4명+=30
function getMultiSlice(charCount) {
  if (charCount <= 2) return { expression: 8, daily: 7, outfit: 7, interaction: 7, location: 5, special: 4, adult: 12 }; // 50
  if (charCount <= 3) return { expression: 7, daily: 5, outfit: 5, interaction: 5, location: 4, special: 3, adult: 11 }; // 40
  return { expression: 5, daily: 4, outfit: 4, interaction: 4, location: 3, special: 2, adult: 8 }; // 30
}

// ── 메인: 템플릿 기반 composition 생성 ──────────────────────
// characters: { main: { name, base_prompt, base_negative }, sub1: { ... }, ... }
// 단일 캐릭터: { basePrompt, baseNegative } (하위 호환)
export function buildComposition(storyName, opts = {}) {
  const story = getStory(storyName);
  if (!story) throw new Error(`스토리 없음: ${storyName}`);

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

  const images = [];
  if (isMulti) {
    // 멀티 캐릭터: 각 캐릭터별 축소 템플릿
    const slice = getMultiSlice(charKeys.length);
    for (const charKey of charKeys) {
      for (const [category, scenes] of Object.entries(SCENE_TEMPLATES)) {
        const count = slice[category] || 0;
        for (const scene of scenes.slice(0, count)) {
          images.push({
            id: `${charKey}-${scene.id}`,
            character: charKey,
            category,
            framing: CATEGORY_FRAMING[category],
            aspect_ratio: CATEGORY_ASPECT_RATIOS[category],
            ...scene,  // scene의 framing이 있으면 카테고리 기본값을 오버라이드
            id: `${charKey}-${scene.id}`,  // id는 반드시 charKey prefix 유지
          });
        }
      }
    }
  } else {
    // 싱글 캐릭터: 전체 100장
    for (const [category, scenes] of Object.entries(SCENE_TEMPLATES)) {
      for (const scene of scenes) {
        images.push({
          character: charKeys[0],
          category,
          framing: CATEGORY_FRAMING[category],
          aspect_ratio: CATEGORY_ASPECT_RATIOS[category],
          ...scene,  // scene의 framing이 있으면 카테고리 기본값을 오버라이드
        });
      }
    }
  }

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
    },
    images,
  };

  saveComposition(storyName, composition);
  console.log(`[Composition] ${storyName}: 템플릿 생성 완료 (${charKeys.length}캐릭터, ${images.length}장)`);
  return composition;
}

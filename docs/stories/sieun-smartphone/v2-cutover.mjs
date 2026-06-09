// sieun-smartphone(gf-phone) v2 actor cutover — P3b-3b 첫 샘플 실 전환 스크립트.
//
// 실행: node --env-file=.env docs/stories/sieun-smartphone/v2-cutover.mjs [--commit]
//   --commit 없으면 dry-run(트랜잭션 롤백). 있으면 실제 반영.
//
// 체인: P3a 단일 교정 승인(이시은 1 character — description 4분할은 캐릭터가 아니라 문서 섹션)
//   → 배우 4개(LEE/GU/YU/JEO ranged) 등록 → 이시은 배역에 다중 캐스팅 → materialize → publishActorRelease.
// 멱등: 이미 v2-actors(current release images=v2-actors)면 스킵. 배우는 이름 중복 체크.
// 안전: 신규 세션만 v2(기존 세션 핀 불변). 롤백 = current_release_id 를 직전 release 로.

import {
  initDB, getDB, getStoryBySlug, getStoryById, getStoryCharacters,
  getEtlReview, updateEtlReviewProposal, listActors, insertActor, insertActorAsset,
  insertActorNumberRange, getBindingsForStoryCharacter, insertStoryActorBinding, getStoryRelease,
} from '../../../lib/db.mjs';
import { enqueueStory } from '../../../lib/etl/queue.mjs';
import { approveStory } from '../../../lib/etl/approve.mjs';
import { materializeStoryCharacter } from '../../../lib/actors/materialize.mjs';
import { publishActorRelease } from '../../../lib/actors/publish.mjs';
import { buildActorCatalogText } from '../../../lib/actors/catalog.mjs';

const COMMIT = process.argv.includes('--commit');
const SLUG = 'gf-phone';
const HOST = 'https://risu.ddsmdy.com/images/gf-phone'; // SEG0 형식: /images/gf-phone/{코드}/{번호}
const SFW = 'sfw', NSFW = 'nsfw';
const HEADER = [
  '## 이미지 출력',
  '응답 시작 전 현재 장면에 맞는 이미지 1장 삽입. 캐릭터당 1장, 응답당 0~2장.',
  '상태창 안에는 넣지 않는다. 해당 캐릭터 묘사·대사 직후 삽입.',
  '잘못된 코드 의심 시 LEE/0(기본) 또는 LEE/15(의문) 폴백.',
];
const FULL_RANGES = [
  ['감정', SFW, 0, 16, '감정/표정'], ['일상', SFW, 17, 40, '일상/의상'],
  ['조교', NSFW, 51, 80, '조교'], ['성행위', NSFW, 81, 120, '성행위'],
  ['코스튬', SFW, 121, 139, '코스튬'], ['여행', SFW, 140, 153, '여행/비키니'],
];
const LEE_SCENES = [
  ['0', '감정', SFW, '기본'], ['5', '감정', SFW, '성적흥분'], ['8', '감정', SFW, '당황'],
  ['11', '감정', SFW, '초조'], ['15', '감정', SFW, '의문'], ['23', '일상', SFW, '카페 데이트'],
  ['55', '성행위', NSFW, '나체 목줄'], ['62', '성행위', NSFW, '수갑'], ['63', '성행위', NSFW, '안대'],
  ['68', '성행위', NSFW, '밧줄'], ['75', '성행위', NSFW, '구태양 통화 후배위'],
];

function ensureActor(name, spec) {
  const existing = listActors().find((a) => a.name === name);
  if (existing) { console.log(`  배우 '${name}' 이미 존재(id ${existing.id}) — 스킵`); return existing.id; }
  const id = insertActor(spec);
  console.log(`  배우 '${name}' 등록(id ${id})`);
  return id;
}

function run() {
  const story0 = getStoryBySlug(SLUG);
  if (!story0) throw new Error(`스토리 ${SLUG} 없음`);
  const storyId = story0.id;

  // ── 1. P3a 단일 교정 승인 ──
  let story = getStoryById(storyId);
  if (story.current_release_id == null) {
    enqueueStory(storyId); // fingerprint 적재(이미 있으면 보존)
    const review = getEtlReview(storyId);
    // 단일 payload(이시은 1 character) — description 전체 보존(무손실), 4분할 무시.
    const payload = {
      characters: [{
        character: {
          name: story.char_name || '이시은',
          description: story.description || '',
          personality: story.personality || '',
          system_prompt: '', first_mes: story.first_mes || '', creator_notes: '', extensions: null,
        },
        storyCharacter: { story_role: 'main', display_order: 0, story_specific_scenario: story.scenario || null, story_specific_first_mes: null },
        greetings: [], examples: [],
      }],
    };
    updateEtlReviewProposal(storyId, { proposed_payload: payload, irrecoverable_fields: [], unresolved_bindings: [], confidence: 'high' });
    const ap = approveStory(storyId);
    if (!ap.ok) throw new Error(`P3a 승인 실패: ${ap.action} ${ap.reason || ''}`);
    console.log(`  P3a 승인 완료 → release ${ap.releaseId} (characters v2-frozen, 이시은 1)`);
    story = getStoryById(storyId);
  } else {
    console.log(`  P3a 이미 승인됨(current_release_id ${story.current_release_id})`);
  }

  // 이미 images=v2-actors 면 스킵(멱등)
  const cur = getStoryRelease(story.current_release_id);
  if (cur && JSON.parse(cur.manifest)?.domains?.images?.source === 'v2-actors') {
    console.log('  이미 images=v2-actors — cutover 스킵'); return { skipped: true };
  }

  // ── 2. 배우 4개 등록 ──
  const LEE = ensureActor('이시은', { name: '이시은', source_type: 'external', base_url: `${HOST}/LEE/`, selection_mode: 'ranged',
    output_rules: { header: HEADER }, constraints: { allowed_ranges: [[0, 153]], disallowed_numbers: [], fallback_numbers: [0, 15] } });
  const GU = ensureActor('구태양', { name: '구태양', source_type: 'external', base_url: `${HOST}/GU/`, selection_mode: 'ranged',
    constraints: { allowed_ranges: [[0, 0]], disallowed_numbers: [], fallback_numbers: [0] } });
  const YU = ensureActor('유혜진', { name: '유혜진', source_type: 'external', base_url: `${HOST}/YU/`, selection_mode: 'ranged',
    constraints: { allowed_ranges: [[0, 153]], disallowed_numbers: [], fallback_numbers: [0] } });
  const JEO = ensureActor('정대현', { name: '정대현', source_type: 'external', base_url: `${HOST}/JEO/`, selection_mode: 'ranged',
    constraints: { allowed_ranges: [[0, 0]], disallowed_numbers: [], fallback_numbers: [0] } });

  // 자산/범위(이미 자산 있으면 스킵 — 멱등 단순화: 자산 0개일 때만 등록)
  const addAssets = (actorId, scenes, ranges) => {
    const has = getStoryCharacters; // noop ref
    // actor_assets 존재 체크
    const cnt = getDB().prepare('SELECT COUNT(*) c FROM actor_assets WHERE actor_id=?').get(actorId).c;
    if (cnt === 0) {
      scenes.forEach(([n, c, b, d]) => insertActorAsset({ actor_id: actorId, scene_key: n, number: n, category: c, block: b, description: d }));
    }
    const rcnt = getDB().prepare('SELECT COUNT(*) c FROM actor_number_ranges WHERE actor_id=?').get(actorId).c;
    if (rcnt === 0 && ranges.length) {
      ranges.forEach(([c, b, s, e, g], i) => insertActorNumberRange({ actor_id: actorId, category: c, block: b, start_number: s, end_number: e, guidance_text: g, sort_order: i }));
    }
  };
  addAssets(LEE, LEE_SCENES, FULL_RANGES);
  addAssets(GU, [['0', '감정', SFW, '구태양 기본']], []);
  addAssets(YU, [['0', '감정', SFW, '유혜진 기본']], FULL_RANGES);
  addAssets(JEO, [['0', '감정', SFW, '정대현 기본']], []);

  // ── 3. 캐스팅(이시은 배역에 4배우) ──
  const scMain = getStoryCharacters(storyId)[0];
  if (!scMain) throw new Error('story_character(이시은) 없음 — P3a 승인 확인');
  const bound = new Set(getBindingsForStoryCharacter(scMain.id).map((b) => b.role_dir));
  const cast = [[LEE, 'LEE'], [GU, 'GU'], [YU, 'YU'], [JEO, 'JEO']];
  for (const [aid, rd] of cast) {
    if (bound.has(rd)) { console.log(`  캐스팅 ${rd} 이미 존재 — 스킵`); continue; }
    insertStoryActorBinding({ story_character_id: scMain.id, actor_id: aid, role_dir: rd });
    console.log(`  캐스팅 ${rd} → 배우 ${aid}`);
  }

  // ── 4. materialize + publish ──
  const m = materializeStoryCharacter(scMain.id);
  console.log(`  materialize: scenes=${m.scenes} ranges=${m.ranges}`);
  const pub = publishActorRelease(storyId);
  if (!pub.ok) throw new Error(`publish 실패: ${pub.action} ${pub.reason || ''}`);
  console.log(`  publish: release ${pub.releaseId} roles=${pub.roles} scenes=${pub.scenes} ranges=${pub.ranges}`);

  // 카탈로그 미리보기
  const manifest = JSON.parse(getStoryRelease(pub.releaseId).manifest);
  console.log('\n────── 카탈로그 미리보기 ──────');
  console.log(buildActorCatalogText(pub.releaseId, manifest.domains.images.data));
  console.log('──────────────────────────────');
  return { releaseId: pub.releaseId };
}

// ── 엔트리 ──
initDB(process.env.DB_PATH);
const db = getDB();
if (COMMIT) {
  const res = run();
  console.log('\n✅ COMMIT 완료', JSON.stringify(res));
} else {
  // dry-run: 트랜잭션으로 감싸고 롤백
  let res;
  try {
    db.transaction(() => { res = run(); throw { __rollback: true }; })();
  } catch (e) {
    if (e && e.__rollback) console.log('\n🔄 DRY-RUN 롤백 완료(실제 반영 안 함). --commit 으로 실제 실행.');
    else throw e;
  }
}
db.close();

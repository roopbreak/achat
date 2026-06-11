// 마이그레이션 레지스트리 — 명시적 순서 배열.
//
// fs 글롭 자동탐색 대신 명시 import로 결정적 순서를 보장한다(번들/실행환경 무관).
// 새 마이그레이션 추가 절차:
//   1. lib/migrations/NNN_name.mjs 작성 (default export: { version, name, up(db) })
//   2. 아래 배열에 import 추가 (version 오름차순)
// version 은 1부터 연속 정수. 한번 배포된 마이그레이션 파일은 절대 수정하지 않는다.

import baseline from './001_baseline.mjs';
import wsJSchema from './002_ws_j_schema.mjs';
import wsLSessionRelease from './003_ws_l_session_release.mjs';
import wsKEtl from './004_ws_k_etl.mjs';
import wsIActors from './005_ws_i_actors.mjs';
import wsIRangedActors from './006_ws_i_ranged_actors.mjs';
import wsCPresetLinks from './007_ws_c_preset_links.mjs';
import wsGGenerationQueue from './008_ws_g_generation_queue.mjs';
import statusBlock from './009_status_block.mjs';

export const migrations = [
  baseline,
  wsJSchema,
  wsLSessionRelease,
  wsKEtl,
  wsIActors,
  wsIRangedActors,
  wsCPresetLinks,
  wsGGenerationQueue,
  statusBlock,
];

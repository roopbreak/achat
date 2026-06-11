/**
 * `!`-시스템 명령어 — 코드 내장 기본 세트 + 스토리 병합 resolve.
 * (three-part-separation §3-2 — D3: 명령어는 스토리 종속)
 *
 * 기존 stories.commands(가이드 커맨드 — LLM에게 텍스트로 전달되는 입력 안내)와 별개.
 * 시스템 명령어는 **앱이 인터셉트**해 기능 실행/모드 토글한다(생성 파이프라인 미진입).
 *
 * kind 별 action 의미:
 *  - client_toggle : 프론트 내장 토글 id (debugPanel) — 서버 미호출
 *  - server_action : 서버 액션 id (summarize) — POST /api/sessions/:id/actions/:action
 *  - mode_toggle   : 세션 mode_flags 키 — POST /api/sessions/:id/modes, 다음 턴 프롬프트 반영
 */

export const BUILTIN_COMMANDS = [
  { trigger: '!디버그',   label: '디버그',   kind: 'client_toggle', action: 'debugPanel',
    desc: '로어북 매칭·분량 정보 디버그 패널 on/off' },
  { trigger: '!요약',     label: '수동 요약', kind: 'server_action', action: 'summarize',
    desc: '지금까지의 미요약 메시지를 즉시 요약' },
  { trigger: '!음란모드', label: '음란모드', kind: 'mode_toggle',   action: 'nsfwOverride',
    desc: 'NPC 능동성 가중치 상승 모드 on/off (단계·합의 게이트는 유지)' },
];

/** 프론트 내장 토글 id — 등록 검증용 화이트리스트 */
export const CLIENT_TOGGLE_ACTIONS = ['debugPanel'];
/** 서버 액션 id — 등록 검증용 화이트리스트 */
export const SERVER_ACTION_IDS = ['summarize'];

/**
 * builtin + 스토리 정의(system_commands JSON 파싱본)를 trigger 키로 병합.
 * 같은 trigger 면 스토리 정의가 builtin 을 오버라이드(라벨 변경·enabled:false 숨김 등).
 * 반환: enabled !== false 인 명령어 배열(클라이언트 노출용).
 *
 * @param {Array<object>} storyCommands parseSystemCommands(stories.system_commands) 결과
 * @returns {Array<object>}
 */
export function resolveSystemCommands(storyCommands = []) {
  const byTrigger = new Map();
  for (const c of BUILTIN_COMMANDS) byTrigger.set(c.trigger, { ...c, builtin: true });
  for (const c of storyCommands) {
    const base = byTrigger.get(c.trigger);
    byTrigger.set(c.trigger, base ? { ...base, ...c } : { ...c });
  }
  return [...byTrigger.values()].filter(c => c.enabled !== false);
}

/**
 * 특정 trigger/action 의 mode_toggle 이 이 스토리에서 허용되는지(서버 측 게이트 —
 * 팔레트 숨김과 별개로 modes API 가 직접 검증).
 * @returns {object|null} 허용 시 resolve 된 명령어, 아니면 null
 */
export function findEnabledModeCommand(storyCommands, action) {
  return resolveSystemCommands(storyCommands)
    .find(c => c.kind === 'mode_toggle' && c.action === action) ?? null;
}

// pm2 프로세스 정의 (맥미니 self-host)
// 구동: pm2 start ecosystem.config.cjs
// type:module 프로젝트라 .cjs 확장자 사용 (pm2는 ecosystem을 CommonJS로 로드)
module.exports = {
  apps: [
    {
      name: 'achat',
      script: 'index.mjs',
      cwd: '/Users/jeong/Workspace/achat',
      interpreter: 'node',
      // --import local-cc-bridge: cc: 접두사 모델을 claude CLI(구독)로 라우팅. 접두사 없으면 실제 API 통과
      interpreter_args: '--env-file=.env --import ./local-cc-bridge.mjs',
      autorestart: true,
      max_restarts: 10,
      max_memory_restart: '1G',
    },
    {
      // Cloudflare Tunnel — achat.ddsmdy.com → localhost:8080 (ingress: ~/.cloudflared/config.yml)
      name: 'cloudflared',
      script: 'cloudflared',
      args: 'tunnel run achat-home',
      interpreter: 'none', // 바이너리 직접 실행
      autorestart: true,
      max_restarts: 10,
    },
    // 트랙 1-Y yetend는 이관 후 여기에 추가 (port 3000)
  ],
};

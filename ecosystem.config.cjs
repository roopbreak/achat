// pm2 프로세스 정의 (맥미니 self-host)
// 구동: pm2 start ecosystem.config.cjs
// type:module 프로젝트라 .cjs 확장자 사용 (pm2는 ecosystem을 CommonJS로 로드)
module.exports = {
  apps: [
    {
      // MariaDB — yetend DB (맥미니 로컬). my.cnf: buffer_pool 64M, bind 127.0.0.1(LAN 차단)
      name: 'mariadb',
      script: '/opt/homebrew/opt/mariadb/bin/mariadbd',
      args: '--datadir=/opt/homebrew/var/mysql',
      interpreter: 'none',
      autorestart: true,
      max_restarts: 10,
    },
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
    {
      // yetend (Next.js) — port 3000. DB는 맥미니 로컬 MariaDB(127.0.0.1:3306). .env/.env.local은 next가 자동 로드
      name: 'yetend',
      script: 'npm',
      args: 'start',
      cwd: '/Users/jeong/Workspace/yetend',
      interpreter: 'none',
      autorestart: true,
      max_restarts: 10,
      max_memory_restart: '1G',
    },
  ],
};

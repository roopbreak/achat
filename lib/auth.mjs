/**
 * 간단한 Bearer 토큰 인증 미들웨어
 * APP_SECRET 환경변수가 설정된 경우에만 활성화.
 * 미설정 시 인증 없이 통과 (개발 환경).
 */

const SECRET = process.env.APP_SECRET ?? '';

export function authMiddleware(req, res, next) {
  if (!SECRET) return next(); // 미설정 시 패스

  // Authorization: Bearer <token> 또는 쿠키 achat_token=<token>
  const authHeader = req.headers.authorization ?? '';
  const cookieToken = parseCookie(req.headers.cookie ?? '')['achat_token'] ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : cookieToken;

  if (token === SECRET) return next();

  // HTML 요청이면 로그인 페이지로
  if (req.headers.accept?.includes('text/html') && !req.path.startsWith('/api')) {
    return res.redirect('/login.html');
  }

  res.status(401).json({ error: '인증 필요' });
}

function parseCookie(str) {
  return str.split(';').reduce((acc, part) => {
    const [k, ...v] = part.trim().split('=');
    if (k) acc[k.trim()] = decodeURIComponent(v.join('=').trim());
    return acc;
  }, {});
}

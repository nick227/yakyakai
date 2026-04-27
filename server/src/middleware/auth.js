import jwt from 'jsonwebtoken'

const COOKIE_NAME = 'yakyakai_token'

export function signUserToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required')
  }

  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role || 'USER',
    },
    process.env.JWT_SECRET,
    { 
      expiresIn: '7d',
      algorithm: 'HS256'
    }
  )
}

export function setAuthCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production'
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  })
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' })
}

export function getBearerToken(req) {
  const auth = req.headers.authorization || ''
  if (auth.startsWith('Bearer ')) return auth.slice('Bearer '.length)
  return null
}

export function optionalAuth(req, _res, next) {
  const token = req.cookies?.[COOKIE_NAME] || getBearerToken(req)

  if (!token) {
    req.user = null
    return next()
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role || 'USER',
    }
  } catch {
    req.user = null
  }

  next()
}

export function requireAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.user?.id) {
      return res.status(401).json({
        error: 'AUTH_REQUIRED',
        message: 'Please log in to continue.',
      })
    }
    next()
  })
}

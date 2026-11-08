import { z } from 'zod'
import { ACCESS, AREAS, CATEGORIES, SLOTS, SOCIAL } from './taxonomy.js'
import { isValidTimeZone } from './time.js'

const text = (max, min = 0) => z.string().trim().min(min).max(max)
const list = (values, max = 20) => z.array(z.enum(values)).max(max).default([])
const freeList = (max = 25, len = 40) => z.array(text(len, 1)).max(max).default([])

const COMMON = new Set(['password', 'password1', 'password12', 'password123', '1234567890', '12345678910', 'qwertyuiop', 'iloveyou12', 'letmein123', 'welcome123', 'volunteer1', 'volunterrier', 'abcdefghij', 'passw0rd12', 'football12', 'baseball12', 'trustno1234', '0987654321', 'qwerty1234', 'admin12345'])

export const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_.]{3,24}$/, 'Usernames are 3–24 characters: letters, numbers, dots or underscores.')
  .refine((u) => !/^[._]|[._]$/.test(u), 'Usernames can’t start or end with a dot or underscore.')

export function passwordProblem(pw, uname = '') {
  if (typeof pw !== 'string') return 'Password is required.'
  if (pw.length < 10) return 'Use at least 10 characters.'
  if (Buffer.byteLength(pw, 'utf8') > 72) return 'Use at most 72 characters.'
  if (COMMON.has(pw.toLowerCase())) return 'That password is too common. Try a longer phrase.'
  if (uname && pw.toLowerCase().includes(uname.toLowerCase())) return 'Your password can’t contain your username.'
  if (/^(.)\1+$/.test(pw)) return 'Avoid repeating a single character.'
  return null
}

export const registerSchema = z.object({
  username,
  password: z.string().max(200),
  displayName: text(40, 1),
})
export const loginSchema = z.object({ username: z.string().trim().toLowerCase().max(40), password: z.string().max(200) })
export const resetSchema = z.object({ username: z.string().trim().toLowerCase().max(40), recoveryCode: z.string().trim().max(40), newPassword: z.string().max(200) })
export const changePasswordSchema = z.object({ currentPassword: z.string().max(200), newPassword: z.string().max(200) })
export const passwordOnlySchema = z.object({ password: z.string().max(200) })

const avatar = z.object({
  kind: z.enum(['initials', 'emoji', 'image']),
  value: z.string().max(90_000),
  color: z.number().int().min(0).max(7),
}).refine((a) => a.kind !== 'image' || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(a.value), 'Avatar must be a PNG, JPEG or WebP image.')
  .refine((a) => a.kind === 'image' || a.value.length <= 16, 'Invalid avatar.')

export const profileSchema = z.object({
  displayName: text(40, 1),
  avatar,
  bio: text(200).default(''),
  pronouns: text(30).default(''),
  school: text(60).default(''),
  interests: list(CATEGORIES),
  causes: freeList(),
  skills: freeList(),
  activities: freeList(),
  availability: list(SLOTS),
  area: z.enum(AREAS).default('bu'),
  maxDistance: z.number().min(1).max(50).default(5),
  access: list(ACCESS),
  social: list(SOCIAL),
})

export const settingsSchema = z.object({
  progressVisibility: z.enum(['private', 'public']).optional(),
  shareAttendanceWithFriends: z.boolean().optional(),
})

export const locationSchema = z.object({ label: text(80, 1), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM time.')
export const createOpportunitySchema = z.object({
  title: text(80, 5),
  description: text(2000, 20),
  category: z.enum(CATEGORIES),
  org: text(80, 1),
  area: z.enum(AREAS),
  address: text(160).default(''),
  city: text(80).default(''),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD date.'),
  startTime: hhmm,
  endTime: hhmm,
  timeZone: z.string().refine(isValidTimeZone, 'Unknown time zone.'),
  maxParticipants: z.number().int().min(1).max(500),
  skills: freeList(20),
  activities: freeList(20),
  access: list(ACCESS),
  social: list(SOCIAL),
  vibe: text(200).default(''),
  image: z.union([z.literal(''), z.string().max(600).regex(/^https:\/\/[^\s"'<>]+$/, 'Image URL must start with https://'), z.string().max(400_000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)]).default(''),
})

export const searchSchema = z.object({
  q: text(120).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().refine((r) => [5, 10, 25, 50].includes(r)).default(10),
  category: z.enum(CATEGORIES).optional(),
  from: z.coerce.number().int().optional(),
  to: z.coerce.number().int().optional(),
  includeRemote: z.enum(['true', 'false']).default('true'),
})

/** express helper: parse or respond 400 */
export function parse(schema, data, res) {
  const r = schema.safeParse(data)
  if (!r.success) {
    const issue = r.error.issues[0]
    res.status(400).json({ error: issue?.message || 'Invalid input.', field: issue?.path?.join('.') })
    return null
  }
  return r.data
}

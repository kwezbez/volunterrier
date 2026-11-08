export type CategoryId =
  | 'sports'
  | 'education'
  | 'environment'
  | 'animals'
  | 'community'
  | 'health'
  | 'arts'
  | 'food'
  | 'mental-health'
  | 'stem'

export type AccessId =
  | 'wheelchair'
  | 'step-free'
  | 'sensory'
  | 'remote'
  | 'flexible'
  | 'asl'
  | 'transit'

export type SocialId =
  | 'beginner'
  | 'solo'
  | 'group'
  | 'no-experience'
  | 'buddy'
  | 'quiet'

export type SlotId =
  | 'weekday-morning'
  | 'weekday-afternoon'
  | 'weekday-evening'
  | 'weekend-morning'
  | 'weekend-afternoon'
  | 'weekend-evening'

export type AreaId =
  | 'bu'
  | 'allston'
  | 'backbay'
  | 'cambridge'
  | 'roxbury'
  | 'downtown'
  | 'jp'
  | 'remote'
  | 'other'

export interface Avatar {
  kind: 'initials' | 'emoji' | 'image'
  value: string // initials text, emoji, or dataURL
  color: number // palette index
}

export interface PublicUser {
  username: string
  displayName: string
  avatar: Avatar | null
}

export interface UserProfile {
  id: string // username
  name: string // display name
  avatar: Avatar
  bio: string
  pronouns?: string
  school?: string
  interests: CategoryId[]
  causes: string[]
  skills: string[]
  activities: string[]
  availability: SlotId[]
  area: AreaId
  maxDistance: number // miles
  access: AccessId[]
  social: SocialId[]
}

export interface Me extends UserProfile {
  username: string
  onboarded: boolean
  settings: { progressVisibility: 'private' | 'public'; shareAttendanceWithFriends: boolean }
  home: { label: string; lat: number; lng: number } | null
  memberSince: number
}

export interface Attendee extends PublicUser {
  id: string
  verified: boolean
  verifiedVia: 'organizer' | 'checkin' | null
  buddy: boolean
}

export interface Opportunity {
  id: string
  title: string
  org: string
  groupId?: string | null
  image: string
  summary: string
  description: string
  expect: string[]
  vibe: string
  category: CategoryId
  activities: string[]
  causes: string[]
  skills: string[]
  access: AccessId[]
  social: SocialId[]
  area: AreaId
  address: string
  city: string
  lat: number | null
  lng: number | null
  transit?: string | null
  startAt: number // UTC ms
  endAt: number // UTC ms
  timeZone: string
  date: string // ISO start
  durationHours: number
  maxParticipants: number
  isSample: boolean
  organizerName: string | null
  isMine: boolean
  goingCount: number
  iAmGoing: boolean
  myBuddy: boolean
  myVerified: boolean
  completed: boolean
  started: boolean
  friendsGoing: PublicUser[]
  distance: number | null
  buddySeekers?: number
  manage?: { checkinCode: string; completedAt: number | null; attendees: Attendee[] }
  role?: 'organizer' | 'volunteer'
}

export interface Group {
  id: string
  name: string
  emoji: string
  cover: string
  tagline: string
  description: string
  categories: CategoryId[]
  members: number
  joined: boolean
  friends: PublicUser[]
  meets: string
  area: AreaId
  access: AccessId[]
  social: SocialId[]
  isSample: boolean
}

export interface Settings {
  textScale: 0 | 1 | 2 | 3
  reduceMotion: boolean
  highContrast: boolean
  dyslexiaFont: boolean
}

export interface Progress {
  totalHours: number
  eventsAttended: number
  milestones: { hours: number; reached: boolean }[]
  nextMilestone: number | null
  previousMilestone: number
  months: { month: string; hours: number }[]
  categories: Record<string, number>
  history: { id: string; title: string; org: string; category: CategoryId; startAt: number; endAt: number; timeZone: string; hours: number; verifiedVia: string }[]
  awaitingVerification?: number
}

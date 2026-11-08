import { useImperativeHandle, useRef, type Ref } from 'react'
import { animate, motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion'
import { CalendarDays, MapPin, Users } from 'lucide-react'
import type { Rec } from '../lib/recommend'
import { accessOf, areaLabel, catOf, socialOf } from '../data/taxonomy'
import { AvatarStack, Img, SampleBadge, Tag, fmtDate, hrs } from './ui'

export type Dir = 'left' | 'right'
export interface SwipeHandle {
  fly: (dir: Dir) => void
}

interface Props {
  rec: Rec
  depth: number // 0 = top card
  reduceMotion: boolean
  onDecide: (dir: Dir) => void
  onOpen: () => void
  ref?: Ref<SwipeHandle>
}

const THRESHOLD = 110

export function SwipeCard({ rec, depth, reduceMotion, onDecide, onOpen, ref }: Props) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-320, 320], [-16, 16])
  const likeOpacity = useTransform(x, [20, THRESHOLD], [0, 1])
  const nopeOpacity = useTransform(x, [-THRESHOLD, -20], [1, 0])
  const glow = useTransform(x, [-THRESHOLD, 0, THRESHOLD], ['0 0 0 4px rgb(100 100 130 / .5)', '0 0 0 0px rgb(0 0 0 / 0)', '0 0 0 4px rgb(113 119 68 / .8)'])
  const dragged = useRef(false)
  const { opp } = rec
  const top = depth === 0

  const fly = (dir: Dir) => {
    if (reduceMotion) return onDecide(dir)
    animate(x, dir === 'right' ? 640 : -640, { duration: 0.32, ease: [0.3, 0.6, 0.4, 1] }).then(() => onDecide(dir))
  }
  useImperativeHandle(ref, () => ({ fly }))

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const power = info.offset.x + info.velocity.x * 0.25
    if (power > THRESHOLD) fly('right')
    else if (power < -THRESHOLD) fly('left')
    else animate(x, 0, { type: 'spring', stiffness: 500, damping: 32 })
  }

  const cat = catOf(opp.category)
  const friends = opp.friendsGoing.map((f) => ({ name: f.displayName, avatar: f.avatar }))
  const accessShown = [...new Set(opp.area === 'remote' ? ['remote', ...opp.access] : opp.access)].slice(0, 3) as typeof opp.access

  return (
    <motion.article
      aria-hidden={!top}
      aria-label={top ? `${opp.title}, ${rec.percent}% match` : undefined}
      className="absolute inset-0 select-none overflow-hidden rounded-2xl bg-brand-50 shadow-lift will-change-transform"
      style={{
        x: top ? x : 0,
        rotate: top ? rotate : 0,
        boxShadow: top ? glow : undefined,
        zIndex: 10 - depth,
        touchAction: 'pan-y',
        cursor: top ? 'grab' : 'default',
      }}
      initial={false}
      animate={{ scale: 1 - depth * 0.045, y: depth * 16, opacity: depth > 2 ? 0 : 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      drag={top ? 'x' : false}
      dragElastic={0.9}
      dragConstraints={{ left: 0, right: 0 }}
      onPointerDown={() => (dragged.current = false)}
      onDragStart={() => (dragged.current = true)}
      onDragEnd={onDragEnd}
      onTap={top ? () => !dragged.current && onOpen() : undefined}
      whileDrag={{ cursor: 'grabbing' }}
    >
      <div className="relative h-[54%] [@media(max-height:760px)]:h-[47%]">
        <Img src={opp.image} alt={opp.title} category={opp.category} className="h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-900/80 via-transparent to-brand-900/30" />
        <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-2">
          <span className="flex flex-wrap items-center gap-1.5">
            {opp.isSample && <SampleBadge />}
            <Tag tone="white">
              {cat.label}
            </Tag>
          </span>
          <span className="shrink-0 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800">{rec.percent}% fit</span>
        </div>
        <div className="absolute bottom-3 left-4 right-4 text-brand-50">
          <h2 className="text-[1.45rem] font-bold leading-tight drop-shadow">{opp.title}</h2>
          <p className="text-sm font-medium text-brand-50/85">{opp.org}</p>
        </div>

        {/* stamps */}
        <motion.div style={{ opacity: likeOpacity }} className="pointer-events-none absolute left-5 top-16 -rotate-12 rounded-xl border-4 border-sage bg-brand-800/40 px-3 py-1 text-3xl font-black tracking-wider text-sage">
          LIKE
        </motion.div>
        <motion.div style={{ opacity: nopeOpacity }} className="pointer-events-none absolute right-5 top-16 rotate-12 rounded-xl border-4 border-brand-50 bg-brand-800/40 px-3 py-1 text-3xl font-black tracking-wider text-brand-50">
          SKIP
        </motion.div>
      </div>

      <div className="flex h-[46%] flex-col gap-2 p-4 pt-3 sm:gap-2.5 [@media(max-height:760px)]:h-[53%] [&>*]:shrink-0">
        <p className="text-sm font-semibold text-moss">{rec.headline}</p>
        <p className="line-clamp-2 text-sm leading-snug text-ink-600 [@media(max-height:760px)]:hidden">{opp.summary}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8rem] font-medium text-ink-600">
          <span className="flex items-center gap-1">
            <CalendarDays size={14} className="text-ink-400" aria-hidden /> {fmtDate(opp.startAt, { timeZone: opp.timeZone })} · ≈{hrs(opp.durationHours)}
          </span>
          <span className="flex items-center gap-1">
            <MapPin size={14} className="text-ink-400" aria-hidden /> {areaLabel(opp.area)}
            {opp.area !== 'remote' && <span className="text-ink-400">· {rec.distance} mi</span>}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="Accessibility and social info">
          {accessShown.map((a) => (
            <Tag key={a} tone="green">
              <span aria-hidden></span> {accessOf(a).short}
            </Tag>
          ))}
          {opp.social.slice(0, 1).map((s) => (
            <Tag key={s} tone="violet">
              <span aria-hidden></span> {socialOf(s).short}
            </Tag>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-brand-200 pt-2.5">
          <span className="flex items-center gap-2 text-xs font-semibold text-ink-500">
            <AvatarStack people={friends} size={26} />
            <span className="flex items-center gap-1">
              <Users size={13} aria-hidden /> {friends.length ? `${friends.length} friend${friends.length > 1 ? 's' : ''} · ` : ''}{opp.goingCount} going
            </span>
          </span>
          <span className="text-xs font-semibold text-ink-400">Tap for details</span>
        </div>
      </div>
    </motion.article>
  )
}

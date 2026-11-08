import { BookOpen, Brain, Cpu, HandHeart, Leaf, Palette, PawPrint, Stethoscope, Trophy, Utensils, type LucideProps } from 'lucide-react'
import type { CategoryId } from '../types'

const ICONS: Record<CategoryId, typeof Trophy> = {
  sports: Trophy,
  education: BookOpen,
  environment: Leaf,
  animals: PawPrint,
  community: HandHeart,
  health: Stethoscope,
  arts: Palette,
  food: Utensils,
  'mental-health': Brain,
  stem: Cpu,
}

/** one consistent icon set for categories (replaces emoji in the UI) */
export function CategoryIcon({ id, ...props }: { id: string } & LucideProps) {
  const I = ICONS[id as CategoryId] ?? HandHeart
  return <I aria-hidden {...props} />
}

import type { Metadata } from 'next';
import { queryOne } from '@/lib/db/postgres';

interface Props {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id: slug } = await params;

  const template = await queryOne<{ name: string; description: string; game_mode: string }>(
    'SELECT name, description, game_mode FROM game_templates WHERE slug = $1',
    [slug],
  ).catch(() => null);

  const title = template ? `${template.name} — DerivArena` : 'Join Game — DerivArena';
  const description = template?.description || 'Join this trading competition on DerivArena and test your skills!';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: '/og-game-preview.png', width: 1200, height: 630 }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og-game-preview.png'],
    },
  };
}

export default function CompeteLayout({ children }: Props) {
  return children;
}

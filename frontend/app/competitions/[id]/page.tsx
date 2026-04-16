'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function CompetitionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id ?? '') as string;

  useEffect(() => {
    if (id) {
      router.replace(`/compete/${id}`);
    }
  }, [id, router]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center bg-bg-primary">
      <Loader2 className="w-6 h-6 animate-spin text-accent-primary" />
    </div>
  );
}

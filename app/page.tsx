'use client';
import dynamic from 'next/dynamic';

const WarRoom = dynamic(() => import('@/components/WarRoom'), {
  ssr: false,
  loading: () => <div style={{ padding: 24, fontFamily: 'monospace', color: '#6c7c8a' }}>טוען את חדר המלחמה…</div>,
});

export default function Page() {
  return <WarRoom />;
}

'use client';
import { ZONE_LABEL, type Zone } from '@/lib/gazetteer';
import type { Pulse } from '@/lib/ui';

const ORDER: Zone[] = ['gaza', 'leb', 'wb', 'il', 'iran', 'syr', 'yem', 'irq', 'gulf', 'egy', 'jor'];

function Spark({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  const w = 48, h = 14, bw = w / data.length;
  return (
    <svg width={w} height={h} aria-hidden="true">
      {data.map((v, i) => (
        <rect key={i} x={w - (i + 1) * bw} y={h - (v / max) * h} width={bw - 0.6} height={(v / max) * h} />
      ))}
    </svg>
  );
}

/** Security-story counts per zone over the last 24h, from fetched reports only. */
export default function PulseStrip({ pulse, zone, onZone }: { pulse: Pulse; zone: Zone | null; onZone: (z: Zone | null) => void }) {
  const zones = ORDER.filter((z) => pulse[z]?.total);
  return (
    <div className="pulse" dir="rtl">
      <span className="pulse-h" title="מספר הסיפורים הביטחוניים לכל זירה ב-24 השעות האחרונות, לפי הדיווחים שנאספו">זירות · 24ש׳</span>
      {zones.length === 0 && <span className="pulse-empty">ממתין לנתונים…</span>}
      {zones.map((z) => {
        const p = pulse[z]!;
        return (
          <button key={z} className={`pz ${zone === z ? 'on' : ''}`} onClick={() => onZone(zone === z ? null : z)}>
            <span className="pz-l">{ZONE_LABEL[z]}</span>
            <b>{p.total}</b>
            {p.critical > 0 && <span className="pz-c" title="חומרה גבוהה/קריטית">{p.critical}</span>}
            <Spark data={p.hours} />
          </button>
        );
      })}
    </div>
  );
}

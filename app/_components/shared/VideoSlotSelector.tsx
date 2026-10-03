'use client';

import Image from 'next/image';
import { useState } from 'react';
import videoPreview from '../../images to use/image2.png';
import backIcon from '../../images to use/back.png';
import captionsIcon from '../../images to use/cc.png';
import expandIcon from '../../images to use/expand.png';
import volumeIcon from '../../images to use/medium-volume.png';
import pauseIcon from '../../images to use/pause (1).png';
import settingsIcon from '../../images to use/setting.png';

const slots = [
  { key: '8pct', percent: 8 },
  { key: '25pct', percent: 25 },
  { key: '45pct', percent: 45 },
  { key: '65pct', percent: 65 },
  { key: '85pct', percent: 85 },
];

export default function VideoSlotSelector({
  activeSlots,
  disabled,
  onToggle,
}: {
  activeSlots: string[];
  disabled: boolean;
  onToggle: (slotKey: string) => void;
}) {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const initialSlot = slots.find((slot) => activeSlots.includes(slot.key)) ?? slots[2];
  const previewSlot = slots.find((slot) => slot.key === selectedSlot) ?? initialSlot;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-2">
        {slots.map((slot) => {
          const isActive = activeSlots.includes(slot.key);
          const isPreviewed = previewSlot.key === slot.key;
          return (
            <button
              key={slot.key}
              type="button"
              aria-pressed={isActive}
              aria-label={`${slot.percent}% video placement, ${isActive ? 'enabled' : 'disabled'}${isPreviewed ? ', currently previewing' : ''}. Click to toggle.`}
              onClick={() => {
                setSelectedSlot(slot.key);
                onToggle(slot.key);
              }}
              disabled={disabled}
              className={`min-h-12 rounded-lg border px-2 py-2 text-center transition-colors disabled:cursor-wait disabled:opacity-60 ${
                isActive
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                  : 'border-(--color-border) bg-(--color-surface-1) text-(--color-muted) hover:bg-(--color-surface-3)'
              } ${isPreviewed ? 'ring-1 ring-white/60' : ''}`}
            >
              <span className="block text-xs font-bold">{slot.percent}%</span>
              <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-wide">
                {isActive ? 'Enabled' : 'Tap to enable'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative isolate aspect-video overflow-hidden rounded-xl border border-(--color-border) bg-black">
        <Image
          src={videoPreview}
          alt="Video preview"
          fill
          sizes="(max-width: 640px) 100vw, 720px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/10" />

        <div className="absolute inset-x-4 bottom-3 text-white sm:inset-x-6 sm:bottom-4">
          <div className="mb-3 flex items-center justify-between text-white drop-shadow">
            <div className="flex items-center gap-3">
              <Image src={backIcon} alt="" aria-hidden="true" width={16} height={16} />
              <Image src={pauseIcon} alt="" aria-hidden="true" width={14} height={14} />
              <span className="text-[10px] font-semibold tabular-nums sm:text-xs">
                {previewSlot.percent}% position
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Image src={volumeIcon} alt="" aria-hidden="true" width={16} height={16} />
              <Image src={captionsIcon} alt="" aria-hidden="true" width={22} height={16} />
              <Image src={settingsIcon} alt="" aria-hidden="true" width={16} height={16} />
              <Image src={expandIcon} alt="" aria-hidden="true" width={16} height={16} />
            </div>
          </div>

          <div className="relative h-1.5 rounded-full bg-white/40">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-red-500"
              style={{ width: `${previewSlot.percent}%` }}
            />
            {slots.filter((slot) => activeSlots.includes(slot.key) && slot.key !== previewSlot.key).map((slot) => (
              <span
                key={slot.key}
                aria-hidden="true"
                className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-emerald-400"
                style={{ left: `${slot.percent}%` }}
              />
            ))}
            <span
              aria-hidden="true"
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-500 shadow"
              style={{ left: `${previewSlot.percent}%` }}
            />
          </div>

          <div className="mt-1.5 flex justify-between text-[9px] font-semibold text-white/80">
            <span>0:00</span>
            <span>Video timeline</span>
            <span>End</span>
          </div>
        </div>
      </div>
    </div>
  );
}

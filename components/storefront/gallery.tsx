"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Foto principal con miniaturas. Con una sola foto no hay miniaturas; sin fotos, la inicial del producto. */
export function Gallery({ images, title }: { images: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  const current = images[index] ?? images[0];

  return (
    <div>
      <div className="aspect-[4/3] overflow-hidden rounded-xl bg-sunken">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current} alt={title} width={1200} height={900} decoding="async" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden className="flex h-full w-full items-center justify-center font-display text-7xl text-ink-3">
            {title.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      {images.length > 1 ? (
        <ul className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6">
          {images.map((src, i) => (
            <li key={src}>
              <button
                type="button"
                aria-label={`Ver foto ${i + 1} de ${images.length}`}
                aria-pressed={i === index}
                onClick={() => setIndex(i)}
                className={cn(
                  "block aspect-[4/3] w-full overflow-hidden rounded-md border-2 transition-colors",
                  i === index ? "border-ink" : "border-transparent opacity-70 hover:opacity-100",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" width={240} height={180} loading="lazy" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

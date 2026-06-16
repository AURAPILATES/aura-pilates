"use client";
import { useEffect } from "react";

export default function Drawer({
  title,
  subtitle,
  header,
  onClose,
  children,
  footer,
  maxWidth = "max-w-md",
}: {
  title?: string;
  subtitle?: string;
  header?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-navy/20 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative w-full ${maxWidth} bg-white h-full flex flex-col shadow-2xl`}>
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-navy/[0.07] shrink-0">
          <div className="min-w-0 flex-1">
            {header ?? (
              <>
                {title && <h2 className="text-base font-bold text-navy font-display truncate">{title}</h2>}
                {subtitle && <p className="text-xs text-navy/45 mt-0.5">{subtitle}</p>}
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-navy/5 text-navy/40 hover:text-navy transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-navy/[0.07] px-6 py-4 shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

'use client';

import { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface ListboxItem {
  value: string;
  label: string;
  triggerLabel?: string;
}

interface WizardListboxProps {
  items: ListboxItem[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hasError?: boolean;
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

export function WizardListbox({
  items,
  value,
  onChange,
  placeholder = 'Selecciona',
  hasError = false,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
}: WizardListboxProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const uid = useId();
  const listId = `${uid}-list`;

  const selectedIndex = items.findIndex((item) => item.value === value);
  const selected = selectedIndex >= 0 ? items[selectedIndex] : undefined;

  function openList() {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function closeList() {
    setOpen(false);
    setActiveIndex(-1);
    triggerRef.current?.focus();
  }

  function selectItem(item: ListboxItem) {
    onChange(item.value);
    closeList();
  }

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) closeList();
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Scroll active item into view
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const li = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    li?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  function handleTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      openList();
    }
  }

  function handleListKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, items.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0) selectItem(items[activeIndex]);
        break;
      case 'Escape':
      case 'Tab':
        closeList();
        break;
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        id={id}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={handleTriggerKeyDown}
        className={[
          'w-full flex items-center justify-between rounded-xl border px-4 py-3 font-body text-sm',
          'bg-white/[0.04] transition-all duration-200 cursor-pointer text-left',
          'focus:outline-none focus:ring-2',
          hasError
            ? 'border-red-500/40 focus:border-red-500/50 focus:ring-red-500/10'
            : open
            ? 'border-[#FF8C00]/55 ring-2 ring-[#FF8C00]/10'
            : 'border-white/[0.10] hover:border-white/20',
          selected ? 'text-white/90' : 'text-white/30',
        ].join(' ')}
      >
        <span className="truncate">
          {selected ? (selected.triggerLabel ?? selected.label) : placeholder}
        </span>
        <ChevronDown
          className={`ml-2 h-4 w-4 shrink-0 text-white/25 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          onKeyDown={handleListKeyDown}
          className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-white/[0.10] bg-[#0F1014] py-1 shadow-xl shadow-black/60 animate-wizard-step focus:outline-none"
        >
          {items.map((item, i) => {
            const isSel = item.value === value;
            const isActive = i === activeIndex;
            return (
              <li
                key={item.value}
                role="option"
                aria-selected={isSel}
                onClick={() => selectItem(item)}
                onMouseEnter={() => setActiveIndex(i)}
                className={[
                  'flex cursor-pointer items-center justify-between px-4 py-2.5 font-body text-sm transition-colors',
                  isSel
                    ? 'bg-[#FF8C00]/10 text-[#FF8C00]/85'
                    : isActive
                    ? 'bg-white/[0.05] text-white/80'
                    : 'text-white/60 hover:bg-white/[0.05] hover:text-white/80',
                ].join(' ')}
              >
                <span>{item.label}</span>
                {isSel && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-[#FF8C00]/65" aria-hidden="true" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

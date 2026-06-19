'use client';

import { useEffect, useRef } from 'react';

// A small rich-text note box: the rep types the talk/development, selects any
// part, and can HIGHLIGHT it or make the font bigger/smaller so the important
// bits stand out next time. Stores HTML (sanitized on the server before saving).
export function RichNote({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // The HTML we last sent up. We compare against THIS (not the live DOM) so that
  // while the rep is typing we NEVER rewrite the editor — rewriting innerHTML on
  // each keystroke is what was breaking typing (caret jumped / IME reset). We only
  // overwrite when `value` is changed from OUTSIDE (e.g. the outcome auto-fill or
  // opening the edit popup), which produces a value different from what we emitted.
  const lastEmitted = useRef<string | null>(null); // null until first sync (mount)

  useEffect(() => {
    const el = ref.current;
    if (el && (value || '') !== lastEmitted.current) {
      el.innerHTML = value || '';
      lastEmitted.current = value || '';
    }
  }, [value]);

  function emit() {
    if (ref.current) {
      lastEmitted.current = ref.current.innerHTML;
      onChange(ref.current.innerHTML);
    }
  }

  function wrap(style: Partial<CSSStyleDeclaration>) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const span = document.createElement('span');
    Object.assign(span.style, style);
    try {
      range.surroundContents(span);
    } catch {
      // Selection spans multiple nodes — extract then wrap.
      const frag = range.extractContents();
      span.appendChild(frag);
      range.insertNode(span);
    }
    sel.removeAllRanges();
    emit();
  }

  return (
    <div className="rounded-lg border border-stone-300 bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b border-stone-200 px-2 py-1.5">
        <ToolBtn onClick={() => wrap({ backgroundColor: '#fde047' })}>🖊️ Highlight</ToolBtn>
        <ToolBtn onClick={() => wrap({ backgroundColor: '#86efac' })}>🟩 Green</ToolBtn>
        <ToolBtn onClick={() => wrap({ fontSize: '1.4em', fontWeight: '700' })}>A+ Bada</ToolBtn>
        <ToolBtn onClick={() => wrap({ fontSize: '0.85em' })}>A− Chhota</ToolBtn>
        <ToolBtn onClick={() => wrap({ fontWeight: '700' })}>B Bold</ToolBtn>
        <span className="ml-auto hidden text-[10px] text-slate-400 sm:block">
          Text select karke button dabao
        </span>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        data-placeholder={placeholder || ''}
        className="min-h-[84px] px-3 py-2 text-sm leading-relaxed outline-none [&:empty::before]:text-slate-400 [&:empty::before]:content-[attr(data-placeholder)]"
      />
    </div>
  );
}

function ToolBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      // Keep the text selection alive when the toolbar button is pressed.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rounded px-2 py-1 text-xs font-medium text-slate-700 hover:bg-stone-100 active:bg-stone-200"
    >
      {children}
    </button>
  );
}

// Strip HTML tags to plain text — used to check a note isn't effectively empty.
export function richText(html: string): string {
  return (html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

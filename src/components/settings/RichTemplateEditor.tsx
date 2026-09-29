import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Bold, Italic, Underline, List, ListOrdered, Link2, RemoveFormatting } from "lucide-react";

export interface RichTemplateEditorHandle {
  insertText: (text: string) => void;
}

interface Props {
  value: string;
  onChange: (html: string) => void;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Köhnə düz mətn şablonlarını HTML-ə çevirir. */
const toHtml = (v: string) => (/<[a-z][\s\S]*>/i.test(v) ? v : escapeHtml(v).replace(/\n/g, "<br>"));

const RichTemplateEditor = forwardRef<RichTemplateEditorHandle, Props>(({ value, onChange }, ref) => {
  const elRef = useRef<HTMLDivElement>(null);
  const rangeRef = useRef<Range | null>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const html = toHtml(value || "");
    if (el.innerHTML !== html) el.innerHTML = html;
  }, [value]);

  const saveRange = () => {
    const sel = window.getSelection();
    const el = elRef.current;
    if (sel && sel.rangeCount && el && el.contains(sel.anchorNode)) {
      rangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreRange = () => {
    const el = elRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    if (rangeRef.current) {
      sel.removeAllRanges();
      sel.addRange(rangeRef.current);
    } else {
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
    }
  };

  const emit = () => {
    if (elRef.current) onChange(elRef.current.innerHTML);
    saveRange();
  };

  const exec = (cmd: string, arg?: string) => {
    restoreRange();
    document.execCommand(cmd, false, arg);
    emit();
  };

  useImperativeHandle(ref, () => ({
    insertText: (text: string) => exec("insertText", text),
  }));

  const tools = [
    { icon: Bold, t: "Qalın", a: () => exec("bold") },
    { icon: Italic, t: "Kursiv", a: () => exec("italic") },
    { icon: Underline, t: "Altdan xətt", a: () => exec("underline"), sep: true },
    { icon: List, t: "Siyahı", a: () => exec("insertUnorderedList") },
    { icon: ListOrdered, t: "Nömrəli siyahı", a: () => exec("insertOrderedList"), sep: true },
    { icon: Link2, t: "Link", a: () => { saveRange(); const url = prompt("Link ünvanı:", "https://"); if (url) exec("createLink", url); } },
    { icon: RemoveFormatting, t: "Formatı təmizlə", a: () => { exec("removeFormat"); exec("unlink"); } },
  ];

  return (
    <div className="border border-border rounded-lg bg-background overflow-hidden">
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-secondary/30">
        {tools.map(({ icon: I, t, a, sep }) => (
          <span key={t} className="flex items-center">
            <button type="button" title={t} onMouseDown={(e) => e.preventDefault()} onClick={a}
              className="p-1.5 rounded hover:bg-secondary text-foreground">
              <I className="w-4 h-4" />
            </button>
            {sep && <span className="w-px h-5 bg-border mx-1" />}
          </span>
        ))}
      </div>
      <div
        ref={elRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onKeyUp={saveRange}
        onMouseUp={saveRange}
        onBlur={saveRange}
        className="min-h-[120px] px-3 py-2 text-sm text-foreground outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline"
      />
    </div>
  );
});

RichTemplateEditor.displayName = "RichTemplateEditor";
export default RichTemplateEditor;

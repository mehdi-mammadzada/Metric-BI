import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Loader2, X, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ReactMarkdown from "react-markdown";
import { toast } from "@/hooks/use-toast";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Satış KPI-ları hansılardır?",
  "KPI necə hesablanır?",
  "HR üçün KPI nümunələri",
  "Komanda performansı necə ölçülür?",
  "KPI ilə OKR fərqi nədir?",
  "Aylıq KPI hesabatı necə hazırlanır?",
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kpi-chat`;

export const AIChatSection = () => {
  const { hasPermission } = useAuth();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canUseAi = hasPermission("home.ai_assistant");


  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Msg = { role: "user", content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setOpen(true);
    setIsLoading(true);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!resp.ok) {
        if (resp.status === 429) {
          toast({ title: "Çox sayda sorğu", description: "Bir az gözləyin və yenidən cəhd edin.", variant: "destructive" });
        } else if (resp.status === 402) {
          toast({ title: "Kredit bitib", description: "Workspace ayarlarından kredit əlavə edin.", variant: "destructive" });
        } else {
          toast({ title: "Xəta", description: "AI cavab vermədi.", variant: "destructive" });
        }
        setMessages((prev) => prev.slice(0, -1));
        setIsLoading(false);
        return;
      }
      if (!resp.body) throw new Error("No body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, nl);
          textBuffer = textBuffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsert(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Xəta", description: "Şəbəkə xətası baş verdi.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <section className="mb-6 relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-6 md:p-8">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/25 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-violet-500/15 blur-3xl pointer-events-none" />
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/15 text-primary text-sm font-bold mb-4 tracking-wide shadow-sm border border-primary/20">
            <Sparkles className="w-4 h-4" />
            METRIC AI
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold text-foreground mb-3 tracking-tight bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text">
            KPI ilə bağlı istənilən sual verin
          </h2>
          <p className="text-sm md:text-base text-muted-foreground mb-5">
            Süni intellekt köməkçisi sizə dərhal cavab verəcək
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex flex-col sm:flex-row gap-2 mb-4"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="KPI ilə bağlı sual verin…"
              className="h-12 rounded-full px-5 bg-background border-border flex-1 text-sm"
              disabled={isLoading}
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="h-12 rounded-full px-6 gap-2"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Soruş
            </Button>
          </form>

          <div className="flex flex-wrap gap-2 justify-center">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-full text-xs bg-secondary hover:bg-secondary/70 text-secondary-foreground border border-border transition-colors disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </section>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
          <SheetHeader className="p-4 border-b border-border">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              METRIC AI
            </SheetTitle>
          </SheetHeader>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                }`}>
                  {m.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`rounded-2xl px-4 py-2 max-w-[85%] text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground"
                }`}>
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-headings:my-2">
                      <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="rounded-2xl px-4 py-2 bg-secondary">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="p-4 border-t border-border flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Davam edin…"
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !input.trim()} size="icon">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
};

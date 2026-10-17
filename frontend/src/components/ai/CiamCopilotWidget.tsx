"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  RotateCcw,
  Maximize2,
  Minimize2,
  Wrench,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Layers,
  Shield,
  Activity,
  Terminal,
} from "lucide-react";
import { ciamApi, ChatMessage, AICopilotSettings } from "@/lib/api";

const SUGGESTED_PROMPTS = [
  { icon: Shield, text: "ตรวจสอบบัญชีผี (Ghost Accounts)" },
  { icon: Activity, text: "สถานะความพร้อมของระบบ (Health Check)" },
  { icon: Layers, text: "ตรวจสอบระบบลูก MTPulse" },
  { icon: Terminal, text: "ดูรายการ Audit Logs ล่าสุด" },
];

export default function CiamCopilotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [settings, setSettings] = useState<AICopilotSettings | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch settings on mount to see if Copilot is enabled
  useEffect(() => {
    let mounted = true;
    const loadSettings = async () => {
      try {
        const data = await ciamApi.getAICopilotSettings();
        if (mounted) setSettings(data);
      } catch (err) {
        // Not authenticated or settings unavailable
        if (mounted) setSettings(null);
      }
    };
    loadSettings();
    return () => {
      mounted = false;
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Initial welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content:
            "สวัสดีครับ! 🛡️ ผมคือ **Central IAM Copilot** ผู้ช่วยอัจฉริยะด้านการจัดการตัวตนและความปลอดภัยของระบบเครือ Window Asia\n\n" +
            "คุณสามารถสอบถามสถานะพนักงาน, ค้นหาบัญชีผี (Ghost Accounts), ตรวจสอบความพร้อมของระบบลูก (Spoke Apps) หรือดูประวัติ Audit Logs ได้ทันทีครับ!",
        },
      ]);
    }
  }, [isOpen]);

  // If copilot is explicitly disabled in settings, do not render the widget
  if (settings && !settings.enabled) {
    return null;
  }

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await ciamApi.sendAIChat({
        messages: newMessages,
      });

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: res.message.content,
        tool_calls: res.tools_used && res.tools_used.length > 0
          ? res.tools_used.map((t) => ({ name: t }))
          : undefined,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อกับ AI Copilot");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ เกิดข้อผิดพลาด: ${err.message || "ไม่สามารถติดต่อระบบ AI ได้ในขณะนี้"}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([
      {
        role: "assistant",
        content: "ล้างบทสนทนาเรียบร้อยครับ มีข้อมูลด้านใดที่ต้องการให้ผมช่วยตรวจสอบไหมครับ?",
      },
    ]);
  };

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center space-x-2.5 px-4 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 text-white font-medium rounded-full shadow-2xl hover:shadow-blue-500/30 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 group cursor-pointer border border-white/20"
          aria-label="เปิด Central IAM Copilot"
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border-2 border-slate-900 rounded-full" />
          </div>
          <span className="text-sm font-semibold tracking-wide">CIAM Copilot</span>
          <span className="bg-white/20 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
            AI
          </span>
        </button>
      )}

      {/* Chat Window / Drawer */}
      {isOpen && (
        <div
          className={`fixed z-50 transition-all duration-300 flex flex-col shadow-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl overflow-hidden ${
            isExpanded
              ? "bottom-4 right-4 left-4 md:left-auto md:w-[650px] top-12 md:top-20"
              : "bottom-6 right-6 w-[92vw] sm:w-[420px] h-[580px] max-h-[85vh]"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 border-b border-slate-700/60 text-white">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-inner">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-sm tracking-wide text-white">Central IAM Copilot</h3>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono font-medium">
                    {settings?.model || "Intelligence Engine"}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">Enterprise Identity & Spoke Assistant</p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={handleReset}
                title="ล้างบทสนทนา"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? "ย่อหน้าต่าง" : "ขยายหน้าต่าง"}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition hidden sm:block"
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="ปิดหน้าต่าง"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs text-slate-200">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${
                  msg.role === "user" ? "items-end" : "items-start"
                }`}
              >
                {/* Tool Badges */}
                {msg.tool_calls && msg.tool_calls.length > 0 && (
                  <div className="mb-1 flex flex-wrap gap-1">
                    {msg.tool_calls.map((tc: any, i: number) => (
                      <span
                        key={i}
                        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-blue-950/80 border border-blue-500/40 text-[10px] text-blue-300 font-mono"
                      >
                        <Wrench className="w-2.5 h-2.5 text-blue-400" />
                        <span>MCP Tool: {tc.name}</span>
                      </span>
                    ))}
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed shadow-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-none"
                      : "bg-slate-800/90 text-slate-200 border border-slate-700/60 rounded-bl-none font-normal"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center space-x-2 text-slate-400 text-xs py-2">
                <div className="w-5 h-5 rounded-full bg-blue-600/20 border border-blue-400/30 flex items-center justify-center animate-spin">
                  <Sparkles className="w-3 h-3 text-blue-400" />
                </div>
                <span>Copilot กำลังวิเคราะห์ข้อมูลและเรียกใช้งานเครื่องมือ...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Prompts (Chips) */}
          {messages.length <= 2 && (
            <div className="px-3 py-1.5 bg-slate-900/60 border-t border-slate-800 flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
              {SUGGESTED_PROMPTS.map((prompt, i) => {
                const Icon = prompt.icon;
                return (
                  <button
                    key={i}
                    onClick={() => handleSend(prompt.text)}
                    className="flex-shrink-0 flex items-center space-x-1 text-[11px] px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-blue-600/30 text-slate-300 hover:text-blue-200 border border-slate-700/50 hover:border-blue-500/40 transition cursor-pointer"
                  >
                    <Icon className="w-3 h-3 text-blue-400" />
                    <span>{prompt.text}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Input Footer */}
          <div className="p-3 bg-slate-950 border-t border-slate-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center space-x-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="สอบถามข้อมูลตัวตน บัญชีผี หรือสถานะระบบลูก..."
                disabled={loading}
                className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl transition cursor-pointer flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-slate-500">
              <span>ขับเคลื่อนโดย Central IAM MCP Server</span>
              <span>Window Asia Security Standard</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

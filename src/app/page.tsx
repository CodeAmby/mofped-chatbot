"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Check, Copy, ExternalLink, Send, Sparkles, User, X } from "lucide-react";

type Sender = "user" | "bot";

interface Message {
	id: string;
	text: string;
	sender: Sender;
	timestamp: Date;
	sources?: Array<{ url: string; title: string; section?: string; relevance: number }>;
	confidence?: number;
	notFound?: boolean;
}

export default function Home() {
	const [messages, setMessages] = useState<Message[]>([
		{ id: "1", text: "Hi, I'm your AI assistant! How may I assist you today?", sender: "bot", timestamp: new Date() },
	]);
	const [inputValue, setInputValue] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isOpen, setIsOpen] = useState(true);
	const [copiedSource, setCopiedSource] = useState<string | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, isOpen]);

	const handleSendMessage = async () => {
		if (!inputValue.trim() || isLoading) return;

		const userMessage: Message = {
			id: Date.now().toString(),
			text: inputValue,
			sender: "user",
			timestamp: new Date(),
		};
		setMessages((prev) => [...prev, userMessage]);
		setInputValue("");
		setIsLoading(true);

		try {
			const res = await fetch("/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message: userMessage.text }),
			});
			const data = await res.json();
			const botMessage: Message = {
				id: (Date.now() + 1).toString(),
				text: data.response ?? "Sorry, something went wrong.",
				sender: "bot",
				timestamp: new Date(),
				sources: data.sources ?? [],
				confidence: data.confidence,
				notFound: data.notFound,
			};
			setMessages((prev) => [...prev, botMessage]);
		} catch (e) {
			setMessages((prev) => [
				...prev,
				{ id: (Date.now() + 1).toString(), text: "Sorry, I hit an error. Please try again.", sender: "bot", timestamp: new Date() },
			]);
		} finally {
			setIsLoading(false);
		}
	};

	const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	};

	const copyToClipboard = async (text: string, sourceUrl: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopiedSource(sourceUrl);
			setTimeout(() => setCopiedSource(null), 1500);
		} catch {}
	};

	const formatConfidence = (c?: number) => {
		if (c === undefined || c === null) return undefined;
		if (c >= 0.8) return "Very High";
		if (c >= 0.6) return "High";
		if (c >= 0.4) return "Medium";
		return "Low";
	};

	return (
		<div className="min-h-screen">
			{!isOpen && (
				<button
					aria-label="Open AI Assistant"
					onClick={() => setIsOpen(true)}
					className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full px-4 py-3 shadow-lg border bg-[#103B73] text-white hover:bg-[#0B1F3B] transition-colors"
				>
					<Bot className="w-5 h-5" />
					<span className="text-sm font-medium">Ask MoFPED</span>
				</button>
			)}

			{isOpen && (
				<div className="fixed bottom-4 right-4 z-50 w-[380px] h-[560px] bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col">
					<div className="flex items-center justify-between px-4 py-3 rounded-t-2xl bg-[#103B73] text-white">
						<div className="flex items-center gap-2">
							<div className="p-2 bg-[#F2B01E] rounded-lg">
								<Sparkles className="w-4 h-4 text-white" />
							</div>
							<div>
								<h1 className="text-sm font-semibold leading-none">AI Assistant</h1>
								<p className="text-[11px] opacity-80">Widget appears bottom-right on finance.go.ug</p>
							</div>
						</div>
						<button aria-label="Close" onClick={() => setIsOpen(false)} className="p-1 rounded hover:bg-white/10">
							<X className="w-4 h-4" />
						</button>
					</div>

					<div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ backgroundColor: "#F5FAFF" }}>
						{messages.map((message) => (
							<div key={message.id} className={`flex gap-2 ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
								{message.sender === "bot" && (
									<div className="p-2 rounded-full" style={{ backgroundColor: "#103B73" }}>
										<Bot className="w-4 h-4 text-white" />
									</div>
								)}

								<div className={`max-w-[80%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed ${message.sender === "user" ? "text-white" : "text-[#0B1F3B] border border-gray-200"}`} style={{ backgroundColor: message.sender === "user" ? "#2E7D32" : "#ffffff" }}>
									<p>{message.text}</p>

									{message.sender === "bot" && message.sources && message.sources.length > 0 && (
										<div className="mt-3 pt-2 border-t border-gray-200">
											<div className="flex items-center justify-between mb-1">
												<span className="text-[11px] text-gray-600">Sources ({message.sources.length})</span>
												{formatConfidence(message.confidence) && (
													<span className="text-[11px] text-gray-600">Confidence: {formatConfidence(message.confidence)}</span>
												)}
											</div>
											<div className="space-y-1.5">
												{message.sources.map((source, index) => (
													<div key={index} className="flex items-center justify-between bg-gray-50 rounded-lg p-2 border border-gray-200">
														<div className="flex-1 min-w-0">
															<p className="text-[11px] font-medium" style={{ color: "#103B73" }}>{source.title}</p>
															{source.section && <p className="text-[11px] text-gray-500">{source.section}</p>}
														</div>
														<div className="flex items-center gap-1 ml-2">
															<button onClick={() => copyToClipboard(source.url, source.url)} className="p-1 text-gray-500 hover:opacity-80" title="Copy URL">
																{copiedSource === source.url ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
															</button>
															<a href={source.url} target="_blank" rel="noopener noreferrer" className="p-1 text-gray-500 hover:opacity-80" title="Open source">
																<ExternalLink className="w-3 h-3" />
															</a>
														</div>
													</div>
												))}
											</div>
										</div>
									)}

								<p className="text-[10px] opacity-60 mt-2">{message.timestamp.toLocaleTimeString()}</p>
							</div>

							{message.sender === "user" && (
								<div className="p-2 rounded-full" style={{ backgroundColor: "#2E7D32" }}>
									<User className="w-4 h-4 text-white" />
								</div>
							)}
						</div>
						))}

						{isLoading && (
							<div className="flex items-center gap-3" style={{ color: "#103B73" }}>
								{/* "Shuffling documents" animation using simple bouncing blocks */}
								<div className="w-4 h-4 bg-gray-300 rounded-sm animate-bounce" style={{ animationDelay: "0ms" }} />
								<div className="w-4 h-3 bg-yellow-200 rounded-sm animate-bounce" style={{ animationDelay: "120ms" }} />
								<div className="w-3 h-5 bg-white border border-gray-300 rounded-sm animate-bounce" style={{ animationDelay: "240ms" }} />
								<span className="text-[12px] text-gray-600 ml-1">Searching official documents…</span>
							</div>
						)}

						<div ref={messagesEndRef} />
					</div>

					<div className="p-3 border-t border-gray-200 bg-white rounded-b-2xl">
						<div className="flex gap-2">
							<input
								type="text"
								value={inputValue}
								onChange={(e) => setInputValue(e.target.value)}
								onKeyDown={handleKeyPress}
								placeholder="Type your message here..."
								className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-[13px] text-[#0B1F3B] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#103B73] focus:border-transparent"
								disabled={isLoading}
							/>
							<button
								onClick={handleSendMessage}
								disabled={!inputValue.trim() || isLoading}
								className="px-3 py-2 rounded-xl text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
								style={{ backgroundColor: "#2E7D32" }}
								aria-label="Send message"
							>
								<Send className="w-4 h-4" />
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

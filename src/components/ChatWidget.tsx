"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Check, Copy, ExternalLink, Send, User, Minus } from "lucide-react";
import { analyticsService } from "@/lib/analytics";

type Sender = "user" | "bot";

interface Message {
	id: string;
	text: string;
	sender: Sender;
	timestamp: Date;
	sources?: Array<{ url: string; title: string; section?: string; relevance: number }>;
	confidence?: number;
	notFound?: boolean;
	options?: Array<{ text: string; action: string; query: string }>;
}

interface ChatWidgetProps {
	apiUrl?: string;
	theme?: 'light' | 'dark';
	position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
	primaryColor?: string;
	secondaryColor?: string;
}

export default function ChatWidget({
	apiUrl = "/api/ask",
	// theme = 'light',
	position = 'bottom-right',
	primaryColor = "#103B73",
	secondaryColor = "#2E7D32"
}: ChatWidgetProps) {
	const [messages, setMessages] = useState<Message[]>([
		{ id: "1", text: "Hi! How can I help you today?", sender: "bot", timestamp: new Date() },
	]);
	const [inputValue, setInputValue] = useState("");
	const [pendingCount, setPendingCount] = useState(0);
	const [isOpen, setIsOpen] = useState(false);
	const [copiedSource, setCopiedSource] = useState<string | null>(null);
	const [pendingConfirmation, setPendingConfirmation] = useState<{ messageId: string; broadenQuery?: string } | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const startTime = useRef<number>(0);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, isOpen]);

	useEffect(() => {
		if (isOpen) {
			inputRef.current?.focus();
		}
	}, [isOpen]);


	const isLoading = pendingCount > 0;

	const handleSendMessage = async (messageText?: string, options?: { bypassConfirmation?: boolean }) => {
		const textToSend = messageText || inputValue;
		if (!textToSend.trim()) return;

		const cleanedText = textToSend.trim().toLowerCase();
		const isAffirmative = isAffirmativeReply(cleanedText);
		const isNegative = isNegativeReply(cleanedText);

		if (!options?.bypassConfirmation && pendingConfirmation) {
			if (isAffirmative) {
				setPendingConfirmation(null);
				setMessages((prev) => [
					...prev,
					{
						id: (Date.now() + 1).toString(),
						text: "Great — want me to refine the results or look for something else?",
						sender: "bot",
						timestamp: new Date()
					}
				]);
				if (!messageText) setInputValue("");
				return;
			}

			if (isNegative) {
				const broadenQuery = pendingConfirmation.broadenQuery;
				setPendingConfirmation(null);
				if (broadenQuery) {
					return handleSendMessage(broadenQuery, { bypassConfirmation: true });
				}
				setMessages((prev) => [
					...prev,
					{
						id: (Date.now() + 1).toString(),
						text: "Got it — what should I search for instead?",
						sender: "bot",
						timestamp: new Date()
					}
				]);
				if (!messageText) setInputValue("");
				return;
			}

			setPendingConfirmation(null);
		}

		// Check if this is an external link
		if (textToSend.startsWith('http')) {
			analyticsService.trackExternalLink(textToSend, 'external_link');
			window.open(textToSend, '_blank');
			return;
		}

		startTime.current = Date.now();

		const userMessage: Message = {
			id: Date.now().toString(),
			text: textToSend,
			sender: "user",
			timestamp: new Date(),
		};
		setMessages((prev) => [...prev, userMessage]);
		if (!messageText) setInputValue("");
		setPendingCount((count) => count + 1);

		try {
			const buildHistory = (items: Message[]) => {
				const history = items
					.filter((item) => item.sender === "user" || item.sender === "bot")
					.slice(-10)
					.map((item) => ({
						role: item.sender === "user" ? "user" : "assistant",
						content: item.text
					}));
				return history;
			};

			const res = await fetch(apiUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message: textToSend, history: buildHistory(messages) }),
			});
			let data: Record<string, unknown>;
			try {
				data = await res.json();
			} catch {
				const fallback = !res.ok ? `Request failed (${res.status}). Please check your connection.` : "Invalid response from server.";
				setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), text: fallback, sender: "bot", timestamp: new Date() }]);
				return;
			}

			const responseTime = Date.now() - startTime.current;

			// 400 from our API includes response/summary; show it or a clear message
			const displayText = (data.response || data.summary || data.error || (res.status === 400 ? "Please enter a question or message." : "Sorry, something went wrong.")) as string;
			if (displayText === "Sorry, something went wrong.") {
				console.warn('[ChatWidget] No response/summary/error in API response. Full data:', JSON.stringify(data));
			}

			const botMessage: Message = {
				id: (Date.now() + 1).toString(),
				text: displayText,
				sender: "bot",
				timestamp: new Date(),
				sources: data.sources?.map((s: { url: string; title: string; section?: string; category?: string }) => ({
					url: s.url,
					title: s.title,
					section: s.section ?? s.category,
					relevance: 0.8
				})) ?? [],
				confidence: data.confidence ?? (data.guardrail_status === "ok" ? 0.9 : 0.3),
				notFound: data.notFound ?? data.guardrail_status === "not_found",
				options: data.options ?? [],
			};
			setMessages((prev) => [...prev, botMessage]);
			const needsConfirmation =
				typeof data.summary === "string" &&
				data.summary.toLowerCase().includes("is this what you’re looking for");
			if (needsConfirmation) {
				const broadenOption = (data.options ?? []).find(
					(option: { text: string; action: string; query: string }) =>
						option.text.toLowerCase().includes("broaden")
				);
				setPendingConfirmation({
					messageId: botMessage.id,
					broadenQuery: broadenOption?.query
				});
			} else {
				setPendingConfirmation(null);
			}

			// Track analytics
			analyticsService.trackQuery({
				query: textToSend,
				responseTime,
				documentsFound: data.sources?.length || 0,
				timestamp: new Date(),
				userAgent: navigator.userAgent,
				sessionId: analyticsService.getSessionId()
			});

		} catch {
			setMessages((prev) => [
				...prev,
				{ id: (Date.now() + 1).toString(), text: "Sorry, I hit an error. Please try again.", sender: "bot", timestamp: new Date() },
			]);
		} finally {
			setPendingCount((count) => Math.max(0, count - 1));
		}
	};

	const isAffirmativeReply = (text: string) => {
		return (
			/^(yes|yeah|yep|correct|right|sure|ok|okay)\b/.test(text) ||
			/\b(yes|yep|sure|ok|okay)\b/.test(text)
		);
	};

	const isNegativeReply = (text: string) => {
		return (
			/^(no|nope|nah|incorrect|wrong)\b/.test(text) ||
			/\b(not really|no|nope|nah|incorrect|wrong)\b/.test(text) ||
			text.includes("any other") ||
			text.includes("any others")
		);
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

	const getPositionClasses = () => {
		switch (position) {
			case 'bottom-left': return 'bottom-4 left-4';
			case 'top-right': return 'top-4 right-4';
			case 'top-left': return 'top-4 left-4';
			default: return 'bottom-4 right-4';
		}
	};

	const positionClasses = getPositionClasses();

	return (
		<div className="mofped-chat-widget">
			{!isOpen && (
				<button
					aria-label="Open MoFPED AI Assistant"
					onClick={() => setIsOpen(true)}
					className={`fixed ${positionClasses} z-50 flex items-center gap-2 rounded-full px-4 py-3 shadow-lg border text-white hover:opacity-90 transition-all duration-200`}
					style={{ backgroundColor: primaryColor }}
				>
					<img src="/mofped-seal.svg" alt="MoFPED Seal" className="w-5 h-5" />
					<span className="text-sm font-medium">Ask MoFPED</span>
				</button>
			)}

			{isOpen && (
				<div className={`fixed ${positionClasses} z-50 w-[380px] h-[560px] bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col`}>
					<div className="flex items-center justify-between px-4 py-3 rounded-t-2xl text-white" style={{ backgroundColor: primaryColor }}>
						<div className="flex items-center gap-2">
							<div className="p-2 bg-white rounded-lg">
								<img src="/mofped-seal.svg" alt="MoFPED Seal" className="w-4 h-4" />
							</div>
							<div>
								<h1 className="text-sm font-semibold leading-none">MoFPED AI Assistant</h1>
							</div>
						</div>
						<button aria-label="Minimize" onClick={() => setIsOpen(false)} className="p-1 rounded hover:bg-white/10">
							<Minus className="w-4 h-4" />
						</button>
					</div>

					<div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ backgroundColor: "#F5FAFF" }}>
						{messages.map((message) => (
							<div key={message.id} className={`flex gap-2 ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
								{message.sender === "bot" && (
									<div className="p-2 rounded-full" style={{ backgroundColor: primaryColor }}>
										<Bot className="w-4 h-4 text-white" />
									</div>
								)}

								<div className={`max-w-[80%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed ${message.sender === "user" ? "text-white" : "text-[#0B1F3B] border border-gray-200"}`} style={{ backgroundColor: message.sender === "user" ? secondaryColor : "#ffffff" }}>
									<p>{message.text}</p>

									{message.sender === "bot" && message.options && message.options.length > 0 && (
										<div className="mt-3 pt-2 border-t border-gray-200">
											<p className="text-[11px] text-gray-600 mb-2">What would you like to do?</p>
											<div className="space-y-1.5">
												{message.options.map((option, index) => (
													<button
														key={index}
														onClick={() => {
															analyticsService.trackOptionClick(option.text, message.text);
															handleSendMessage(option.query);
														}}
														className="w-full text-left bg-blue-50 hover:bg-blue-100 rounded-lg p-2 border border-blue-200 transition-colors"
													>
														<p className="text-[11px] font-medium" style={{ color: primaryColor }}>{option.text}</p>
													</button>
												))}
											</div>
										</div>
									)}

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
															<p className="text-[11px] font-medium" style={{ color: primaryColor }}>{source.title}</p>
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
									<div className="p-2 rounded-full" style={{ backgroundColor: secondaryColor }}>
										<User className="w-4 h-4 text-white" />
									</div>
								)}
							</div>
						))}

						{isLoading && (
							<div className="flex items-center gap-3" style={{ color: primaryColor }}>
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
								ref={inputRef}
								placeholder="Type your message here..."
								className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-[13px] text-[#0B1F3B] placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
								style={{ focusRingColor: primaryColor }}
								disabled={false}
							/>
							<button
								onClick={handleSendMessage}
								className="px-3 py-2 rounded-xl text-white transition-all duration-200"
								style={{ backgroundColor: secondaryColor }}
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

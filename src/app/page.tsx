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
	intent?: 'location' | 'document' | 'contact' | 'service';
}

export default function Home() {
	const [messages, setMessages] = useState<Message[]>([
		{ 
			id: "1", 
			text: "Hello, I'm your MOFPED AI Assistant. How may I help you today?\n\nAny other questions?", 
			sender: "bot", 
			timestamp: new Date(),
			options: [
				{ text: "📍 Location & Directions", action: "location", query: "where is mofped located" },
				{ text: "📞 Contact Information", action: "contact", query: "contact information phone email" },
				{ text: "🔧 Service How-To", action: "service", query: "how to apply for services" },
				{ text: "📄 Document Lookup", action: "document", query: "download documents forms" }
			]
		},
	]);
	const [inputValue, setInputValue] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isOpen, setIsOpen] = useState(false);
	const [copiedSource, setCopiedSource] = useState<string | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// MoFPED brand colors
	const primaryColor = "#103B73";
	const secondaryColor = "#2E7D32";

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, isOpen]);

	const handleSendMessage = async (messageText?: string) => {
		const textToSend = messageText || inputValue;
		if (!textToSend.trim() || isLoading) return;

		// Check if this is an external link
		if (textToSend.startsWith('http')) {
			analyticsService.trackExternalLink(textToSend, 'external_link');
			window.open(textToSend, '_blank');
			return;
		}

		const userMessage: Message = {
			id: Date.now().toString(),
			text: textToSend,
			sender: "user",
			timestamp: new Date(),
		};
		setMessages((prev) => [...prev, userMessage]);
		if (!messageText) setInputValue("");
		setIsLoading(true);

		try {
			console.log('[Frontend] Sending query:', textToSend);
			const res = await fetch("/api/ask", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query: textToSend }),
			});
			const data = await res.json();
			console.log('[Frontend] Received response:', data);
			const botMessage: Message = {
				id: (Date.now() + 1).toString(),
				text: data.summary ?? "Sorry, something went wrong.",
				sender: "bot",
				timestamp: new Date(),
				sources: data.sources?.map((s: { url: string; title: string; category?: string }) => ({
					url: s.url,
					title: s.title,
					section: s.category,
					relevance: 0.8
				})) ?? [],
				confidence: data.confidence ?? (data.guardrail_status === "ok" ? 0.9 : 0.3),
				notFound: data.guardrail_status === "not_found",
				options: data.options ?? [],
				intent: data.intent,
			};
			console.log('[Frontend] Created bot message with intent:', data.intent, 'and text:', data.summary?.substring(0, 100));
			setMessages((prev) => [...prev, botMessage]);
		} catch {
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

	const getIntentIcon = (intent?: string) => {
		switch (intent) {
			case 'location':
				return '📍';
			case 'contact':
				return '📞';
			case 'service':
				return '🔧';
			case 'document':
				return '📄';
			default:
				return '🤖';
		}
	};

	const getIntentLabel = (intent?: string) => {
		switch (intent) {
			case 'location':
				return 'Location';
			case 'contact':
				return 'Contact';
			case 'service':
				return 'Service';
			case 'document':
				return 'Document';
			default:
				return 'General';
		}
	};

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Finance.go.ug Header */}
			<header className="bg-white shadow-sm border-b">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between items-center py-4">
						<div className="flex items-center space-x-4">
							<img src="/MOFPED-seal.png" alt="MoFPED Seal" className="w-12 h-12" />
							<div>
								<h1 className="text-xl font-bold text-gray-900">Ministry of Finance, Planning and Economic Development</h1>
								<p className="text-sm text-gray-600">The Republic of Uganda</p>
							</div>
						</div>
						<nav className="hidden md:flex space-x-8">
							<a href="#" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium">Home</a>
							<a href="#" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium">About</a>
							<a href="#" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium">Services</a>
							<a href="#" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium">Contact</a>
						</nav>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{/* Hero Section */}
				<div className="bg-gradient-to-r from-blue-900 to-blue-700 rounded-lg shadow-lg p-8 mb-8">
					<div className="text-center text-white">
						<h2 className="text-3xl font-bold mb-4">Welcome to the Ministry of Finance, Planning and Economic Development</h2>
						<p className="text-xl mb-6">Promoting sustainable economic growth and development for Uganda</p>
						<div className="flex justify-center space-x-4">
							<button className="bg-white text-blue-900 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
								Learn More
							</button>
							<button className="border-2 border-white text-white px-6 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-900 transition-colors">
								Our Services
							</button>
						</div>
					</div>
				</div>

				{/* Quick Links Grid */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
					<div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
						<div className="text-blue-600 text-2xl mb-3">📊</div>
						<h3 className="text-lg font-semibold mb-2">Budget & Planning</h3>
						<p className="text-gray-600 text-sm">Access budget documents and planning information</p>
					</div>
					<div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
						<div className="text-green-600 text-2xl mb-3">💰</div>
						<h3 className="text-lg font-semibold mb-2">Financial Management</h3>
						<p className="text-gray-600 text-sm">Financial policies and management systems</p>
					</div>
					<div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
						<div className="text-purple-600 text-2xl mb-3">🏛️</div>
						<h3 className="text-lg font-semibold mb-2">Economic Policy</h3>
						<p className="text-gray-600 text-sm">Economic development policies and strategies</p>
					</div>
					<div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
						<div className="text-orange-600 text-2xl mb-3">📋</div>
						<h3 className="text-lg font-semibold mb-2">Reports & Publications</h3>
						<p className="text-gray-600 text-sm">Annual reports and official publications</p>
					</div>
				</div>

				{/* News & Updates */}
				<div className="bg-white rounded-lg shadow-md p-6">
					<h3 className="text-xl font-semibold mb-4">Latest News & Updates</h3>
					<div className="space-y-4">
						<div className="border-l-4 border-blue-500 pl-4">
							<h4 className="font-medium">2024/25 Budget Framework Paper Released</h4>
							<p className="text-sm text-gray-600">The Ministry has released the Budget Framework Paper for the financial year 2024/25...</p>
							<span className="text-xs text-gray-500">December 15, 2024</span>
						</div>
						<div className="border-l-4 border-green-500 pl-4">
							<h4 className="font-medium">Economic Growth Projections Updated</h4>
							<p className="text-sm text-gray-600">Updated economic growth projections for the current fiscal year have been published...</p>
							<span className="text-xs text-gray-500">December 12, 2024</span>
						</div>
						<div className="border-l-4 border-purple-500 pl-4">
							<h4 className="font-medium">New Financial Management Guidelines</h4>
							<p className="text-sm text-gray-600">Updated guidelines for financial management in government institutions...</p>
							<span className="text-xs text-gray-500">December 10, 2024</span>
						</div>
					</div>
				</div>
			</main>

			{/* Footer */}
			<footer className="bg-gray-800 text-white mt-12">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
					<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
						<div>
							<h4 className="text-lg font-semibold mb-4">Contact Information</h4>
							<p className="text-sm text-gray-300">Plot 2-12 Apollo Kaggwa Road</p>
							<p className="text-sm text-gray-300">P.O. Box 8147, Kampala, Uganda</p>
							<p className="text-sm text-gray-300">Tel: +256 414 707000</p>
						</div>
						<div>
							<h4 className="text-lg font-semibold mb-4">Quick Links</h4>
							<ul className="space-y-2 text-sm text-gray-300">
								<li><a href="#" className="hover:text-white">Budget Documents</a></li>
								<li><a href="#" className="hover:text-white">Economic Reports</a></li>
								<li><a href="#" className="hover:text-white">Tenders</a></li>
								<li><a href="#" className="hover:text-white">Careers</a></li>
							</ul>
						</div>
						<div>
							<h4 className="text-lg font-semibold mb-4">Connect With Us</h4>
							<div className="flex space-x-4">
								<a href="#" className="text-gray-300 hover:text-white">Twitter</a>
								<a href="#" className="text-gray-300 hover:text-white">Facebook</a>
								<a href="#" className="text-gray-300 hover:text-white">LinkedIn</a>
							</div>
						</div>
					</div>
					<div className="border-t border-gray-700 mt-8 pt-8 text-center text-sm text-gray-300">
						<p>&copy; 2024 Ministry of Finance, Planning and Economic Development. All rights reserved.</p>
					</div>
				</div>
			</footer>

			{/* Chatbot Widget */}
			{!isOpen && (
				<button
					aria-label="Open MoFPED AI Assistant"
					onClick={() => setIsOpen(true)}
					className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-full px-6 py-4 shadow-lg hover:shadow-xl transition-all duration-200 bg-white border border-gray-200"
				>
					<img src="/MOFPED-seal.png" alt="MoFPED Seal" className="w-10 h-10" />
					<span className="text-black font-bold text-lg tracking-wide">ASK MOFPED</span>
				</button>
			)}

			{isOpen && (
				<div className="fixed bottom-6 right-6 z-50 w-[380px] h-[560px] bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col">
					<div className="flex items-center justify-between px-4 py-3 rounded-t-2xl text-white" style={{ backgroundColor: primaryColor }}>
						<div className="flex items-center gap-2">
							<div className="p-2 bg-white rounded-lg">
								<img src="/MOFPED-seal.png" alt="MoFPED Seal" className="w-4 h-4" />
							</div>
							<div>
								<h1 className="text-sm font-semibold leading-none">MoFPED Help Assistant</h1>
								<p className="text-xs opacity-80">Official AI Support</p>
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
									{message.sender === "bot" && message.intent && (
										<div className="flex items-center gap-1 mb-2 text-[11px] text-gray-600">
											<span>{getIntentIcon(message.intent)}</span>
											<span className="font-medium">{getIntentLabel(message.intent)} Query</span>
										</div>
									)}
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
								{/* "Shuffling documents" animation using simple bouncing blocks */}
								<div className="w-4 h-4 bg-gray-300 rounded-sm animate-bounce" style={{ animationDelay: "0ms" }} />
								<div className="w-4 h-3 bg-yellow-200 rounded-sm animate-bounce" style={{ animationDelay: "120ms" }} />
								<div className="w-3 h-5 bg-white border border-gray-300 rounded-sm animate-bounce" style={{ animationDelay: "240ms" }} />
								<span className="text-[12px] text-gray-600 ml-1">Analyzing your query and searching official sources…</span>
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
								placeholder="Ask about location, contacts, services, or documents..."
								className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-[13px] text-[#0B1F3B] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
								disabled={isLoading}
							/>
							<button
								onClick={() => handleSendMessage()}
								disabled={!inputValue.trim() || isLoading}
								className="px-3 py-2 rounded-xl text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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

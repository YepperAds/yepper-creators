'use client';
import { getToken } from '@/app/(adsense)/utils/token';
// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const MarketingAssistant = ({  user, isAuthenticated  }: any) => {
  const [conversations, setConversations] = useState<Array<{ _id: string; title?: string; messages?: unknown[] }>>([]);
  const [currentConversation, setCurrentConversation] = useState<unknown>(null);
  const [messages, setMessages] = useState<Record<string,unknown>[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<unknown>(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

    const DESIGN_THEMES = {
    branding: {
      name: 'Brand Identity',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      accentGradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      // icon: '🎨'
    },
    growth: {
      name: 'Growth Strategy',
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      accentGradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      // icon: '📈'
    },
    content: {
      name: 'Content Creation',
      gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      accentGradient: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
      // icon: '✍️'
    },
    social: {
      name: 'Social Media',
      gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      accentGradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
      // icon: '📱'
    },
    analytics: {
      name: 'Data & Analytics',
      gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
      accentGradient: 'linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)',
      // icon: '📊'
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputValue]);

  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
    }
  }, [isAuthenticated]);

  const detectIntent = (message) => {
    const lower = message.toLowerCase();
    if (/(brand|logo|identity|name|rebrand)/i.test(lower)) return 'branding';
    if (/(grow|scale|viral|acquisition|retention)/i.test(lower)) return 'growth';
    if (/(content|blog|post|write|create)/i.test(lower)) return 'content';
    if (/(social|instagram|facebook|tiktok|twitter)/i.test(lower)) return 'social';
    if (/(analytics|data|metrics|measure|track)/i.test(lower)) return 'analytics';
    return 'social';
  };

  const parseResponse = (text) => {
    const lines = text.split('\n').filter(l => l.trim());
    const parsed = {
      title: '',
      sections: [],
      tables: [],
      lists: []
    };

    let currentSection = null;
    let currentList = null;
    let tableLines = [];
    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Detect tables (lines with | characters)
      if (line.includes('|')) {
        if (!inTable) {
          inTable = true;
          tableLines = [];
        }
        tableLines.push(line);
        continue;
      } else if (inTable && tableLines.length > 0) {
        // Process completed table
        const headers = tableLines[0].split('|').map(h => h.trim()).filter(Boolean);
        const rows = tableLines.slice(2).map(row => 
          row.split('|').map(cell => cell.trim()).filter(Boolean)
        );
        parsed.tables.push({ headers, rows });
        inTable = false;
        tableLines = [];
        continue;
      }

      // Title detection (first bold text or # header)
      if (!parsed.title && (line.startsWith('**') || line.startsWith('#'))) {
        parsed.title = line.replace(/[*#]/g, '').trim();
        continue;
      }

      // Headers
      if (line.startsWith('**') && line.endsWith('**')) {
        if (currentSection) parsed.sections.push(currentSection);
        if (currentList) {
          parsed.lists.push(currentList);
          currentList = null;
        }
        currentSection = {
          header: line.replace(/\*\*/g, '').trim(),
          content: []
        };
        continue;
      }

      // List items
      if (line.match(/^[•\-*\d+.]\s/)) {
        if (!currentList) {
          currentList = { items: [] };
        }
        currentList.items.push(line.replace(/^[•\-*\d+.]\s/, '').trim());
        continue;
      } else if (currentList) {
        parsed.lists.push(currentList);
        currentList = null;
      }

      // Regular content
      if (currentSection) {
        currentSection.content.push(line);
      } else if (line) {
        if (!currentSection) {
          currentSection = { header: '', content: [line] };
        }
      }
    }

    if (currentSection) parsed.sections.push(currentSection);
    if (currentList) parsed.lists.push(currentList);

    return parsed;
  };

  const loadConversations = async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API_URL}/api/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setConversations(data.conversations);
      }
    } catch (err: unknown) {
      console.error('Failed to load conversations:', error);
    }
  };

  const generateAIResponse = async (prompt) => {
    try {
      const response = await fetch(`${API_URL}/api/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt })
      });

      const data = await response.json();
      
      if (data.success && data.response) {
        return { text: data.response, metadata: data.metadata };
      }
      
      throw new Error('Invalid response from AI service');
    } catch (err: unknown) {
      console.error('AI API Error:', err);
      return {
        text: `Here's your marketing strategy breakdown:

**Understanding Your Audience**
The foundation of any successful campaign starts with knowing exactly who you're talking to. Define demographics, psychographics, and pain points.

**Key Tactics to Implement:**
• Create detailed buyer personas with real behavioral data
• Map out customer journey touchpoints across all channels
• Use social listening tools to understand conversations
• Test messaging with A/B splits on smaller audiences first

**Content Strategy Framework**
Build a content calendar that balances educational, entertaining, and promotional content in a 70-20-10 split.

**Measurement & Optimization**
Track these core metrics: engagement rate, conversion rate, customer acquisition cost, and lifetime value. Review weekly and pivot based on data.`,
        metadata: { intent: 'general_marketing' }
      };
    }
  };

  const saveConversation = async (conversationData) => {
    if (!isAuthenticated) return;
    try {
      const token = getToken();
      const response = await fetch(`${API_URL}/api/conversations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(conversationData)
      });
      const data = await response.json();
      return data.conversation;
    } catch (err: unknown) {
      console.error('Failed to save conversation:', err);
      throw err;
    }
  };

  const updateConversation = async (conversationId, messages) => {
    if (!isAuthenticated) return;
    try {
      const token = getToken();
      await fetch(`${API_URL}/api/conversations/${conversationId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ messages })
      });
    } catch (err: unknown) {
      console.error('Failed to update conversation:', err);
    }
  };

  const deleteConversation = async (conversationId) => {
    if (!isAuthenticated) return;
    try {
      const token = getToken();
      const response = await fetch(`${API_URL}/api/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setConversations(prev => prev.filter(conv => conv._id !== conversationId));
        if (currentConversation?._id === conversationId) {
          startNewConversation();
        }
        setDeleteModalOpen(false);
        setConversationToDelete(null);
      }
    } catch (err: unknown) {
      console.error('Failed to delete conversation:', error);
      setError('Failed to delete conversation');
    }
  };

  const openDeleteModal = (conversation) => {
    setConversationToDelete(conversation);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setConversationToDelete(null);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      const aiResult = await generateAIResponse(userMessage.content);
      const intent = aiResult.metadata?.intent || detectIntent(userMessage.content);
      const theme = DESIGN_THEMES[intent] || DESIGN_THEMES.social;
      const parsed = parseResponse(aiResult.text);
      
      const assistantMessage = {
        role: 'assistant',
        content: aiResult.text,
        timestamp: new Date().toISOString(),
        visual: {
          intent,
          theme,
          parsed
        }
      };

      const updatedMessages = [...messages, userMessage, assistantMessage];
      setMessages(updatedMessages);

      if (isAuthenticated) {
        if (!currentConversation) {
          const title = userMessage.content.slice(0, 50) + (userMessage.content.length > 50 ? '...' : '');
          const newConversation = await saveConversation({
            title,
            messages: updatedMessages
          });
          setCurrentConversation(newConversation);
          setConversations(prev => [newConversation, ...prev]);
        } else {
          await updateConversation(currentConversation._id, updatedMessages);
          setConversations(prev => prev.map(conv => 
            conv._id === currentConversation._id 
              ? { ...conv, messages: updatedMessages, updatedAt: new Date() }
              : conv
          ));
        }
      }
    } catch (err: unknown) {
      console.error('Error sending message:', error);
      setError('Failed to get AI response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const startNewConversation = () => {
    setCurrentConversation(null);
    setMessages([]);
    setError(null);
  };

  const loadConversation = async (conversation) => {
    setCurrentConversation(conversation);
    setMessages(conversation.messages || []);
    setError(null);
  };

  const InstagramCard = ({  message, index  }: any) => {
    const { visual } = message;
    const [currentSlide, setCurrentSlide] = useState(0);
    
    if (!visual || !visual.theme) {
      return (
        <div className="w-full max-w-md mx-auto mb-6">
          <div className="bg-surface-1 rounded-lg shadow-lg p-6">
            <p className="text-subtle leading-relaxed">{message.content}</p>
          </div>
        </div>
      );
    }
    
    const theme = visual.theme;
    const parsed = visual.parsed;
    
    // Create slides from content
    const slides = [];
    
    // Slide 1: Cover
    slides.push({
      type: 'cover',
      title: parsed.title || theme.name,
      // icon: theme.icon
    });

    // Slide 2-N: Sections
    if (parsed.sections.length > 0) {
      parsed.sections.forEach((section, idx) => {
        // Split long sections into multiple slides
        const contentChunks = [];
        let currentChunk = [];
        let charCount = 0;
        
        section.content.forEach(para => {
          if (charCount + para.length > 200 && currentChunk.length > 0) {
            contentChunks.push([...currentChunk]);
            currentChunk = [para];
            charCount = para.length;
          } else {
            currentChunk.push(para);
            charCount += para.length;
          }
        });
        
        if (currentChunk.length > 0) {
          contentChunks.push(currentChunk);
        }
        
        contentChunks.forEach((chunk, chunkIdx) => {
          slides.push({
            type: 'section',
            header: chunkIdx === 0 ? section.header : '',
            content: chunk,
            index: idx
          });
        });
      });
    }

    // Add list slides
    if (parsed.lists.length > 0) {
      parsed.lists.forEach(list => {
        const itemsPerSlide = 4;
        for (let i = 0; i < list.items.length; i += itemsPerSlide) {
          slides.push({
            type: 'list',
            items: list.items.slice(i, i + itemsPerSlide)
          });
        }
      });
    }

    // Add table slides
    if (parsed.tables.length > 0) {
      parsed.tables.forEach(table => {
        slides.push({
          type: 'table',
          headers: table.headers,
          rows: table.rows
        });
      });
    }

    const nextSlide = () => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    };

    const prevSlide = () => {
      setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    };

    const renderSlide = (slide) => {
      if (slide.type === 'cover') {
        return (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-white">
            {/* <div className="text-6xl mb-4">{slide.icon}</div> */}
            <h1 className="text-4xl font-bold text-center leading-tight">
              {slide.title}
            </h1>
          </div>
        );
      }

      if (slide.type === 'section') {
        return (
          <div className="absolute inset-0 p-8 flex flex-col text-white">
            {slide.header && (
              <h2 className="text-2xl font-bold mb-6">{slide.header}</h2>
            )}
            <div className="flex-1 flex flex-col justify-center space-y-4">
              {slide.content.map((para: any, i: any) => (
                <p key={i} className="text-lg leading-relaxed">
                  {para.split('**').map((part: any, j: any) => 
                    j % 2 === 1 ? (
                      <span key={j} className="font-bold">{part}</span>
                    ) : part
                  )}
                </p>
              ))}
            </div>
          </div>
        );
      }

      if (slide.type === 'list') {
        return (
          <div className="absolute inset-0 p-8 flex flex-col justify-center text-white">
            <div className="space-y-4">
              {slide.items.map((item: any, i: any) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-surface-1/20 flex items-center justify-center flex-shrink-0 text-sm font-bold">
                    {i + 1}
                  </div>
                  <p className="text-lg leading-relaxed pt-0.5">
                    {item.split('**').map((part: any, j: any) => 
                      j % 2 === 1 ? (
                        <span key={j} className="font-bold">{part}</span>
                      ) : part
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      }

      if (slide.type === 'table') {
        return (
          <div className="absolute inset-0 p-6 flex flex-col text-white overflow-auto">
            <div className="bg-surface-1/10 backdrop-blur-sm rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-1/20">
                    {slide.headers.map((header: any, i: any) => (
                      <th key={i} className="px-4 py-3 text-left font-bold text-sm">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {slide.rows.map((row: any, i: any) => (
                    <tr key={i} className="border-t border-white/10">
                      {row.map((cell: any, j: any) => (
                        <td key={j} className="px-4 py-3 text-sm">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }
    };

    return (
      <div className="w-full max-w-md mx-auto mb-6">
        <div className="bg-surface-1 rounded-lg shadow-xl overflow-hidden">
          {/* Instagram-style card */}
          <div className="relative w-full aspect-[4/5] overflow-hidden" 
               style={{ background: slides[currentSlide]?.type === 'cover' ? theme.gradient : theme.accentGradient }}>
            {renderSlide(slides[currentSlide])}
            
            {/* Navigation */}
            {slides.length > 1 && (
              <>
                <button
                  onClick={prevSlide}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center text-white backdrop-blur-sm transition-all"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={nextSlide}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center text-white backdrop-blur-sm transition-all"
                >
                  <ChevronRight size={20} />
                </button>
                
                {/* Slide indicators */}
                <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-1.5">
                  {slides.map((_: any, i: any) => (
                    <button
                      key={i}
                      onClick={() => setCurrentSlide(i)}
                      className={`h-1.5 rounded-full transition-all ${
                        i === currentSlide ? 'w-8 bg-surface-1' : 'w-1.5 bg-surface-1/50'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
          
          {/* Bottom bar */}
          <div className="px-4 py-3 bg-surface-1 border-t border-border">
            <div className="flex items-center justify-between text-sm text-muted">
              <span>{currentSlide + 1} / {slides.length}</span>
              <span className="text-xs font-medium text-muted">{theme.name}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const PlusIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );

  const MessageIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );

  const MenuIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );

  const XIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );

  const TrashIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  );

  return (
    <div className="flex h-full bg-surface-2">
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-surface-1 rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                Delete Conversation?
              </h3>
              <p className="text-sm text-subtle mb-6">
                Are you sure you want to delete "{conversationToDelete?.title}"? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={closeDeleteModal}
                  className="px-4 py-2 text-sm font-medium text-subtle bg-surface-1 border border-border rounded-lg hover:bg-surface-2"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteConversation(conversationToDelete._id)}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAuthenticated && (
        <>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="fixed top-4 left-4 z-50 bg-black text-white p-2 rounded-lg hover:bg-gray-800"
          >
            {isSidebarOpen ? <XIcon /> : <MenuIcon />}
          </button>

          <div className={`${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } fixed z-40 w-64 bg-surface-1 border-r border-border flex flex-col transition-transform duration-300 h-full`}>
            <div className="p-4 border-b border-border">
              <button
                onClick={startNewConversation}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
              >
                <PlusIcon />
                <span className="text-sm">New Chat</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                {conversations.length === 0 ? (
                  <p className="text-sm text-muted text-center py-8">
                    No conversations yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {conversations.map((conv: any) => (
                      <div
                        key={conv._id}
                        className={`group relative rounded-lg ${
                          currentConversation?._id === conv._id
                            ? 'bg-surface-3'
                            : 'hover:bg-surface-2'
                        }`}
                      >
                        <button
                          onClick={() => loadConversation(conv)}
                          className="w-full text-left px-3 py-2 pr-10"
                        >
                          <div className="flex items-start gap-2">
                            <div className="mt-1 text-muted"><MessageIcon /></div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">
                                {conv.title}
                              </p>
                              <p className="text-xs text-muted">
                                {new Date(conv.updatedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={(e: any) => {
                            e.stopPropagation();
                            openDeleteModal(conv);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted hover:text-error opacity-0 group-hover:opacity-100"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center text-sm font-semibold">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                  <p className="text-xs text-muted truncate">{user?.email}</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-4xl mx-auto">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <h2 className="text-3xl font-bold text-white mb-3">
                  Marketing Intelligence
                </h2>
                <p className="text-subtle mb-8 max-w-md mx-auto">
                  Get professional marketing strategies delivered in beautiful, Instagram-ready formats
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                  {[
                    'Create a product launch strategy',
                    'Build my Instagram growth plan',
                    'Design a content calendar',
                    'Analyze my marketing metrics'
                  ].map((suggestion: any, idx: any) => (
                    <button
                      key={idx}
                      onClick={() => setInputValue(suggestion)}
                      className="text-left p-4 bg-surface-1 border border-border rounded-xl hover:border-border hover:shadow-md transition-all"
                    >
                      <p className="text-sm font-medium text-subtle">{suggestion}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((message: any, idx: any) => (
                  <div key={idx}>
                    {message.role === 'user' ? (
                      <div className="flex justify-end mb-4">
                        <div className="max-w-lg bg-black text-white rounded-2xl px-5 py-3 shadow-lg">
                          <p className="text-sm leading-relaxed">
                            {message.content}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <InstagramCard message={message} index={idx} />
                    )}
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-center">
                    <div className="bg-surface-1 rounded-xl p-6 shadow-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-black rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                        <span className="text-sm text-subtle ml-2">Creating your strategy...</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 bg-error/10 border-t border-error/30">
            <div className="max-w-4xl mx-auto">
              <p className="text-sm text-error">{error}</p>
            </div>
          </div>
        )}

        <div className="bg-surface-1 border-t border-border px-4 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-surface-2 border-2 border-border rounded-2xl focus-within:border-border transition-all">
              <div className="flex items-end gap-2 p-3">
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e: any) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about marketing strategy, growth tactics, content ideas..."
                  className="flex-1 bg-transparent text-white placeholder-muted outline-none resize-none text-sm leading-relaxed"
                  style={{ 
                    minHeight: '24px',
                    maxHeight: '120px'
                  }}
                  rows={1}
                  disabled={isLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  className="bg-black text-white px-6 py-2.5 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 text-sm font-medium shadow-lg"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketingAssistant;
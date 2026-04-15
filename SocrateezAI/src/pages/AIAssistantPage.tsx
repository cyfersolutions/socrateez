import { useEffect, useState, useRef, type KeyboardEvent } from 'react';
import {
  Bot,
  Send,
  User,
  Sparkles,
  TrendingUp,
  MapPin,
  Building2,
  DollarSign,
  Lightbulb,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Badge } from '../components/Badge';
import { Separator } from '../components/Separator';
import { cn } from '../lib/utils';
import { fetchAssistantChat, type AssistantChatPayload } from '../lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  data?: AssistantChatPayload['data'];
}

const suggestedQuestions = [
  {
    icon: <DollarSign className="h-4 w-4" />,
    text: 'What is the average salary for software engineers?',
  },
  {
    icon: <MapPin className="h-4 w-4" />,
    text: 'What are the top cities for tech jobs?',
  },
  {
    icon: <Building2 className="h-4 w-4" />,
    text: 'Which companies pay the highest average salaries?',
  },
  {
    icon: <TrendingUp className="h-4 w-4" />,
    text: 'Which roles have the largest share of listings?',
  },
];

export function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  async function handleSend(text?: string) {
    const query = text || inputValue.trim();
    if (!query || isTyping) return;

    const userMessage: Message = {
      id: `${Date.now()}-u`,
      role: 'user',
      content: query,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      const payload = await fetchAssistantChat(query);
      const assistantMessage: Message = {
        id: `${Date.now()}-a`,
        role: 'assistant',
        content: payload.content,
        timestamp: new Date(),
        data: payload.data,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (e) {
      const err = e as Error;
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-e`,
          role: 'assistant',
          content: err.message || 'Request failed.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          AI Assistant
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ask about salaries, locations, companies, and roles—answers use your
          live job dataset.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card className="flex flex-col h-[calc(100vh-220px)] min-h-[500px]">
            <CardHeader className="pb-3 border-b shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-base">JobInsight AI</CardTitle>
                  <CardDescription className="text-xs">
                    Answers from your job listings
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="ml-auto text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Online
                </Badge>
              </div>
            </CardHeader>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
                    <Bot className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    How can I help you today?
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mb-6">
                    Ask about salaries, cities, companies, or job openings.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                    {suggestedQuestions.map((sq, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => void handleSend(sq.text)}
                        className="flex items-center gap-2 p-3 rounded-lg border bg-card text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors">
                        <span className="text-muted-foreground shrink-0">
                          {sq.icon}
                        </span>
                        <span>{sq.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}>
                  {message.role === 'assistant' && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
                      <Bot className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[80%] rounded-xl px-4 py-3',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}>
                    <p className="text-sm whitespace-pre-wrap">
                      {message.content}
                    </p>

                    <p
                      className={cn(
                        'text-[10px] mt-2',
                        message.role === 'user'
                          ? 'text-primary-foreground/60'
                          : 'text-muted-foreground'
                      )}>
                      {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {message.role === 'user' && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                      <User className="h-4 w-4 text-secondary-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-3 justify-start">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="bg-muted rounded-xl px-4 py-3">
                    <div className="flex gap-1">
                      <span
                        className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <span
                        className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <span
                        className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t p-4 shrink-0">
              <div className="flex gap-2">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about salaries, jobs, companies..."
                  className="flex-1"
                  aria-label="Chat message input"
                />
                <Button
                  onClick={() => void handleSend()}
                  disabled={!inputValue.trim() || isTyping}
                  size="icon"
                  aria-label="Send message">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="hidden lg:block">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                What I Can Do
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div>
                <h4 className="text-xs font-medium text-foreground mb-1.5">
                  What you can ask
                </h4>
                <p className="text-xs text-muted-foreground">
                  Salaries by role or region, top cities and companies, job
                  openings, and trends—same information as Dashboard and Job
                  Search.
                </p>
              </div>
              <Separator />
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">
                  Try asking:
                </h4>
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => void handleSend('Show me remote jobs')}
                    className="block w-full text-left text-xs text-foreground hover:text-primary transition-colors py-1">
                    → &quot;Show me remote jobs&quot;
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void handleSend('Average salary for caregivers?')
                    }
                    className="block w-full text-left text-xs text-foreground hover:text-primary transition-colors py-1">
                    → &quot;Average salary for caregivers?&quot;
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void handleSend('Average salary by state')
                    }
                    className="block w-full text-left text-xs text-foreground hover:text-primary transition-colors py-1">
                    → &quot;Average salary by state&quot;
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

"use client";

import { PlusIcon, SendHorizonal, ChevronDown, ArrowUpIcon } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupTextarea,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
} from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

interface Collection {
  name: string;
  document_count: number;
  is_indexed: boolean;
}

interface IndexResponse {
  message: string;
  collection_name: string;
  files_processed: number;
  chunks_created: number;
  collection_size: number;
  source_type: string;
  source: string;
}

interface QueryResponse {
  results: Array<{
    id: string;
    code: string;
    metadata: {
      file_path: string;
      line_number: number;
    };
    distance: number;
  }>;
  count: number;
  collection_name: string;
  natural_language_response: string;
  query: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [showAddRepoModal, setShowAddRepoModal] = useState(false);
  const [repoSource, setRepoSource] = useState("");
  const [repoName, setRepoName] = useState("");
  const [isIndexing, setIsIndexing] = useState(false);
  const [sourceType, setSourceType] = useState<"path" | "url">("path");
  const lastMessageRef = useRef<HTMLDivElement>(null);

  const API_BASE_URL = "http://localhost:8000";

  // Helper function to detect GitHub URLs
  const isGitHubUrl = (input: string): boolean => {
    try {
      const url = new URL(input.startsWith('http') ? input : `https://${input}`);
      return url.hostname === 'github.com' || url.hostname === 'www.github.com';
    } catch {
      return false;
    }
  };

  // Auto-detect source type based on input
  const handleSourceChange = (value: string) => {
    setRepoSource(value);
    if (value.trim()) {
      setSourceType(isGitHubUrl(value) ? "url" : "path");
    }
  };

  // Scroll to top of latest message when new messages are added
  useEffect(() => {
    if (messages.length > 0) {
      lastMessageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [messages]);

  // Load collections on component mount
  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/collections`);
      const data = await response.json();
      setCollections(data.collections);
      if (data.collections.length > 0 && !selectedCollection) {
        setSelectedCollection(data.collections[0].name);
      }
    } catch (error) {
      console.error("Failed to load collections:", error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !selectedCollection || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: inputValue,
          collection_name: selectedCollection,
          n_results: 15,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: QueryResponse = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.natural_language_response,
        isUser: false,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Failed to send message:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "Sorry, I encountered an error while processing your request. Please try again.",
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRepo = async () => {
    if (!repoSource.trim() || !repoName.trim() || isIndexing) return;

    setIsIndexing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/index`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: repoSource,
          collection_name: repoName,
          chunk_size: 500,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: IndexResponse = await response.json();
      
      // Show success message
      const successMessage: Message = {
        id: Date.now().toString(),
        content: `Repository indexed successfully! Collection "${data.collection_name}" now has ${data.collection_size} chunks from ${data.files_processed} files. Source: ${data.source_type} (${data.source})`,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, successMessage]);

      // Reset form and close modal
      setRepoSource("");
      setRepoName("");
      setSourceType("path");
      setShowAddRepoModal(false);
      
      // Reload collections
      await loadCollections();
      setSelectedCollection(data.collection_name);
    } catch (error) {
      console.error("Failed to index repository:", error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: `Failed to index repository: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsIndexing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between p-4 flex-shrink-0">
          {/* Collection Dropdown */}
          <div className="flex items-center space-x-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="min-w-[200px] justify-between">
                  {selectedCollection ? (
                    <span>
                      {collections.find(c => c.name === selectedCollection)?.name}
                    </span>
                  ) : (
                    "Select a repository"
                  )}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="start">
                <DropdownMenuLabel>Repositories</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {collections.map((collection) => (
                  <DropdownMenuItem
                    key={collection.name}
                    onClick={() => setSelectedCollection(collection.name)}
                    className={selectedCollection === collection.name ? "bg-accent" : ""}
                  >
                    <span className="font-medium">{collection.name}</span>
                  </DropdownMenuItem>
                ))}
                {collections.length === 0 && (
                  <DropdownMenuItem disabled>
                    No collections available
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Add Repository Button */}
          <Button
            onClick={() => setShowAddRepoModal(true)}
          >
            <PlusIcon className="w-4 h-4" />
            Add Repository
          </Button>
        </div>

      {/* Main Chat Interface */}
      <div className="flex flex-1 flex-col w-full overflow-hidden">

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 w-full">
          <div className="max-w-4xl mx-auto">
          {messages.length === 0 ? (
            <div className="flex-1 text-center text-gray-500 dark:text-gray-400 mt-[24vh]">
              <h2 className="text-xl font-semibold mb-2">Welcome to Code Lens</h2>
              <p>Select a repository and start asking questions about your code!</p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={message.id}
                ref={index === messages.length - 1 ? lastMessageRef : null}
                className={`flex ${message.isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`px-4 py-3 mb-6 rounded-lg ${
                    message.isUser
                      ? "bg-gray-500 text-white max-w-xl"
                      : "max-w-3xl"
                  }`}
                >
                  {message.isUser ? (
                    <div className="whitespace-pre-wrap text-[11pt]">{message.content}</div>
                  ) : (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code: ({ className, children, ...props }) => {
                            const match = /language-(\w+)/.exec(className || '');
                            return match ? (
                              <pre className="bg-gray-100 dark:bg-gray-900 rounded-md p-3 overflow-x-auto mb-6 text-[11pt] leading-tight">
                                <code className={`${className} text-[10pt] leading-tight`} {...props}>
                                  {children?.toString().trim()}
                                </code>
                              </pre>
                            ) : (
                              <code className="bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded text-[10pt] leading-tight" {...props}>
                                {children?.toString().trim()}
                              </code>
                            );
                          },
                          pre: ({ children }) => <>{children}</>,
                          p: ({ children }) => <p className="text-[11pt] mb-3">{children}</p>,
                          ul: ({ children }) => <ul className="mb-4 last:mb-0 list-disc list-outside pl-4">{children}</ul>,
                          ol: ({ children }) => <ol className="mb-4 last:mb-0 list-decimal list-outside pl-4">{children}</ol>,
                          li: ({ children }) => <li className="text-[11pt] mb-1">{children}</li>,
                          h1: ({ children }) => <h1 className="text-[12pt] font-bold mb-4 mt-4 first:mt-0">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-sm font-bold mb-3 mt-3 first:mt-0">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-sm font-bold mb-2 mt-2 first:mt-0">{children}</h3>,
                          h4: ({ children }) => <h4 className="text-sm font-semibold mb-2 mt-2 first:mt-0">{children}</h4>,
                          h5: ({ children }) => <h5 className="text-sm font-semibold mb-2 mt-2 first:mt-0">{children}</h5>,
                          h6: ({ children }) => <h6 className="text-sm font-semibold mb-2 mt-2 first:mt-0">{children}</h6>,
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic mb-4 my-4">
                              {children}
                            </blockquote>
                          ),
                          table: ({ children }) => (
                            <div className="overflow-x-auto mb-4 my-4">
                              <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
                                {children}
                              </table>
                            </div>
                          ),
                          th: ({ children }) => (
                            <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 bg-gray-100 dark:bg-gray-800 font-semibold">
                              {children}
                            </th>
                          ),
                          td: ({ children }) => (
                            <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                              {children}
                            </td>
                          ),
                          hr: () => <hr className="my-6 border-gray-300 dark:border-gray-600" />,
                          br: () => <br className="mb-6" />,
                          strong: ({ children }) => <strong className="text-[12pt] font-bold">{children}</strong>,
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  )}
                  <div className={`text-xs font-mono font-semibold mt-1 ${
                    message.isUser ? "text-blue-100" : "text-gray-500 dark:text-gray-400"
                  }`}>
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 px-4 py-2 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-[11pt]">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-900 py-4 w-full max-w-4xl mx-auto">
          <InputGroup className="min-h-[80px] flex-col items-stretch rounded-2xl">
            <InputGroupTextarea 
              placeholder={"Ask anything about " + selectedCollection}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={!selectedCollection || isLoading}
              className="min-h-[48px] flex-1 p-4 md:text-[11pt] text-[11pt]"
            />
            <InputGroupAddon align="block-end" className="self-end p-3">
              <InputGroupButton
                variant="default"
                className="rounded-full"
                size="icon"
                disabled={!inputValue.trim() || !selectedCollection || isLoading}
                onClick={handleSendMessage}
              >
                <ArrowUpIcon />
                <span className="sr-only">Send</span>
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </div>

      {/* Add Repository Modal */}
      {showAddRepoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-md">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">
                Add Repository
              </h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="repo-name" className="text-sm font-medium text-foreground">
                    Collection Name
                  </label>
                  <Input
                    id="repo-name"
                    type="text"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    placeholder="e.g., my-project"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="repo-source" className="text-sm font-medium text-foreground">
                      Repository Source
                    </label>
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        sourceType === "url" 
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" 
                          : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                      }`}>
                        {sourceType === "url" ? "GitHub URL" : "Local Path"}
                      </span>
                    </div>
                  </div>
                  <Input
                    id="repo-source"
                    type="text"
                    value={repoSource}
                    onChange={(e) => handleSourceChange(e.target.value)}
                    placeholder={
                      sourceType === "url" 
                        ? "e.g., https://github.com/user/repo or user/repo"
                        : "e.g., /path/to/your/repository"
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {sourceType === "url" 
                      ? "Enter a GitHub repository URL. The system will automatically clone and index it."
                      : "Enter the local file system path to your repository directory."
                    }
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddRepoModal(false);
                    setRepoSource("");
                    setRepoName("");
                    setSourceType("path");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddRepo}
                  disabled={!repoSource.trim() || !repoName.trim() || isIndexing}
                >
                  {isIndexing ? "Indexing..." : "Submit"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

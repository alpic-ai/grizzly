import { TabsContent } from "@/components/ui/tabs";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, User } from "lucide-react";
import { Anthropic } from "@anthropic-ai/sdk";
import useModel from "@/lib/hooks/useModel";
import {
  CompatibilityCallToolResult,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

interface Message {
  role: "user" | "assistant";
  content: string;
  isToolResult?: boolean;
}

interface LLMTabProps {
  tools: Tool[];
  chatToolCall: (
    name: string,
    params: Record<string, unknown>,
  ) => Promise<unknown>;
  chatToolResult: CompatibilityCallToolResult | null;
}

// Define a local type for the stream chunk structure
interface AnthropicStreamChunk {
  type: string;
  delta?: {
    type: string;
    text?: string;
    partial_json?: string;
  };
  content_block?: {
    type: string;
    name: string;
    id: string;
  };
}

const LLMTab = ({ tools, chatToolCall, chatToolResult }: LLMTabProps) => {
  const { isModelConfigured, model, apiKey } = useModel();
  const [isKeyValid, setIsKeyValid] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isToolCallLoading, setIsToolCallLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [pendingToolCall, setPendingToolCall] = useState<{
    toolName: string;
    args: Record<string, unknown>;
    tool: Tool | null;
    messageIdx: number;
  } | null>(null);
  const [toolCallArgs, setToolCallArgs] = useState<Record<string, unknown>>({});
  const [toolCallError, setToolCallError] = useState<string | null>(null);

  useEffect(() => {
    if (apiKey) {
      localStorage.setItem("anthropic_api_key", apiKey);
      setIsKeyValid(true);
    }
  }, [apiKey]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle tool result changes
  useEffect(() => {
    if (chatToolResult) {
      const toolResultMessage = {
        role: "assistant" as const,
        content: (
          chatToolResult.content as Array<{ type: string; text?: string }>
        )
          .map((c) => (c.type === "text" ? c.text : JSON.stringify(c)))
          .join("\n"),
        isToolResult: true,
      };

      manageConversation(toolResultMessage);
    }
  }, [chatToolResult]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !isKeyValid || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    setInput("");
    setIsLoading(true);
    setError(null);
    manageConversation(userMessage);
  };

  const manageConversation = async (newMessage: Message) => {
    setMessages((prev) => [...prev, newMessage]);

    try {
      const anthropic = new Anthropic({
        apiKey,
        dangerouslyAllowBrowser: true,
      });

      // Create system message
      const systemMessage = {
        role: "assistant" as const,
        content:
          "You are a helpful AI assistant with access to tools. Please use these tools when appropriate to help the user.",
      };

      // Format tools according to Anthropic API specification
      const formattedTools = tools.map((tool) => ({
        name: tool.name,
        description: tool.description || "No description available",
        input_schema: tool.inputSchema,
      }));

      const stream = await anthropic.messages.create({
        model: model,
        max_tokens: 1024,
        messages: [systemMessage, ...messages, newMessage].map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        tools: formattedTools,
        stream: true,
      });

      let assistantMessage = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      // Tool use streaming state
      let currentToolCall: {
        toolName: string;
        toolId: string;
        args: Record<string, unknown>;
        tool: Tool | null;
        messageIdx: number;
      } | null = null;
      let toolInputJsonStringAccumulator: string = "";

      for await (const chunk of stream as unknown as Iterable<AnthropicStreamChunk>) {
        // Handle text deltas as before
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta?.type === "text_delta"
        ) {
          assistantMessage += chunk.delta.text || "";
          setMessages((prev) => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
              role: "assistant",
              content: assistantMessage,
            };
            return newMessages;
          });
        }
        // Detect start of a tool call
        else if (
          chunk.type === "content_block_start" &&
          chunk.content_block?.type === "tool_use"
        ) {
          const contentBlock = chunk.content_block;
          currentToolCall = {
            toolName: contentBlock.name,
            toolId: contentBlock.id,
            args: {},
            tool: tools.find((t) => t.name === contentBlock.name) || null,
            messageIdx: messages.length,
          };
          toolInputJsonStringAccumulator = "";
        }
        // Accumulate tool call input JSON string fragments
        else if (
          chunk.type === "content_block_delta" &&
          chunk.delta?.type === "input_json_delta" &&
          currentToolCall
        ) {
          if (chunk.delta.partial_json) {
            toolInputJsonStringAccumulator += chunk.delta.partial_json;
          }
        }
        // End of tool call block: parse accumulated JSON and trigger tool call UI/modal
        else if (chunk.type === "content_block_stop" && currentToolCall) {
          try {
            const parsedArgs = JSON.parse(toolInputJsonStringAccumulator);
            currentToolCall.args = parsedArgs;
            setPendingToolCall(currentToolCall);
            setToolCallArgs(parsedArgs);
          } catch (e) {
            console.error(
              "Failed to parse accumulated tool input JSON:",
              toolInputJsonStringAccumulator,
              e,
            );
            currentToolCall.args = {};
            setPendingToolCall(currentToolCall);
            setToolCallArgs({});
          }
          currentToolCall = null;
          toolInputJsonStringAccumulator = "";
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("An error occurred"));
      setIsKeyValid(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Tool call modal approval handler
  const handleApproveToolCall = async () => {
    if (!pendingToolCall) return;
    setToolCallError(null);
    setIsToolCallLoading(true);
    try {
      await chatToolCall(pendingToolCall.toolName, toolCallArgs);
      setPendingToolCall(null);
    } catch (e) {
      setToolCallError((e as Error).message || String(e));
    } finally {
      setIsToolCallLoading(false);
    }
  };

  // Tool call modal cancel handler
  const handleCancelToolCall = () => {
    setPendingToolCall(null);
    setToolCallError(null);
  };

  return (
    <TabsContent value="llm">
      <div className="grid grid-cols-1 gap-4">
        <Card className="p-4">
          <div className="mb-4"></div>

          <form onSubmit={handleSubmit} className="mb-4">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                disabled={!isKeyValid || isLoading}
                className="flex-1"
              />
              <Button type="submit" disabled={!isModelConfigured || isLoading}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your message..."
                  disabled={!isModelConfigured || isLoading}
                  className="flex-1"
                />
                <Button type="submit" disabled={!isModelConfigured || isLoading}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </form>
          )}

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              {error.message}
            </div>
          )}

          {/* Tool call modal */}
          {pendingToolCall && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 min-w-[320px] max-w-[90vw]">
                <h3 className="font-semibold mb-2">Approve Tool Call</h3>
                <div className="mb-2">
                  <strong>Tool:</strong> {pendingToolCall.toolName}
                </div>
                {pendingToolCall.tool && (
                  <div className="mb-2 text-sm text-gray-600">
                    {pendingToolCall.tool.description}
                  </div>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleApproveToolCall();
                  }}
                >
                  {pendingToolCall.tool &&
                    Object.entries(
                      pendingToolCall.tool.inputSchema?.properties || {},
                    ).map(([arg]) => {
                      const argValue = toolCallArgs[arg];
                      let displayValueNode: React.ReactNode = null;

                      if (argValue === null) {
                        displayValueNode = "null";
                      } else if (typeof argValue === "undefined") {
                        displayValueNode = "N/A";
                      } else if (
                        typeof argValue === "string" ||
                        typeof argValue === "number" ||
                        typeof argValue === "boolean"
                      ) {
                        displayValueNode = String(argValue);
                      } else if (typeof argValue === "object") {
                        try {
                          const stringified = JSON.stringify(argValue, null, 2);
                          displayValueNode = (
                            <pre>
                              {typeof stringified === "string"
                                ? stringified
                                : "N/A"}
                            </pre>
                          );
                        } catch {
                          displayValueNode = "[Unserializable Value]";
                        }
                      } else {
                        displayValueNode = `[${typeof argValue}]`;
                      }

                      return (
                        <div className="mb-2" key={arg}>
                          <Label htmlFor={`tool-arg-${arg}`}>{arg}</Label>
                          <div
                            id={`tool-arg-${arg}`}
                            className="mt-1 p-2 border rounded bg-gray-100 dark:bg-gray-800 text-sm break-all"
                          >
                            {displayValueNode as React.ReactNode}
                          </div>
                        </div>
                      );
                    })}
                  {toolCallError && (
                    <div className="mb-2 text-red-600 text-sm">
                      {toolCallError}
                    </div>
                  )}
                  <div className="flex gap-2 mt-4">
                    <Button type="submit" disabled={isToolCallLoading}>
                      {isToolCallLoading ? "Running..." : "Approve & Run"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancelToolCall}
                      disabled={isToolCallLoading}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </Card>
      </div>
    </TabsContent>
  );
};

export default LLMTab;

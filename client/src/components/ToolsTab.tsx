import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import DynamicJsonForm from "./DynamicJsonForm";
import type { JsonValue, JsonSchemaType } from "@/utils/jsonUtils";
import { generateDefaultValue } from "@/utils/schemaUtils";
import {
  CallToolResultSchema,
  CompatibilityCallToolResult,
  ListToolsResult,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { Loader2, Send } from "lucide-react";
import { useEffect, useState } from "react";
import ListPane from "./ListPane";
import JsonView from "./JsonView";
import ToolChecksSummary from "./ToolChecksSummary";
import ToolChecks from "./ToolChecks";
import ToolsEvaluation, { ToolsEvaluationProps } from "./ToolsEvaluation";
import useModel from "@/lib/hooks/useModel";
import { Anthropic } from "@anthropic-ai/sdk";
import { z } from "zod";

const testCaseSchema = z.object({
  id: z.string(),
  userPrompt: z.string(),
  expectedToolCall: z.object({
    toolName: z.string(),
    parameters: z.record(z.string(), z.unknown()),
  }),
});

const ToolsTab = ({
  tools,
  listTools,
  clearTools,
  callTool,
  selectedTool,
  setSelectedTool,
  toolResult,
  nextCursor,
}: {
  tools: Tool[];
  listTools: () => void;
  clearTools: () => void;
  callTool: (name: string, params: Record<string, unknown>) => Promise<void>;
  selectedTool: Tool | null;
  setSelectedTool: (tool: Tool | null) => void;
  toolResult: CompatibilityCallToolResult | null;
  nextCursor: ListToolsResult["nextCursor"];
  error: string | null;
}) => {
  const { isModelConfigured, model, apiKey } = useModel();
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [isToolRunning, setIsToolRunning] = useState(false);
  const [toolsEvaluationResult, setToolsEvaluationResult] =
    useState<ToolsEvaluationProps>();

  useEffect(() => {
    const params = Object.entries(
      selectedTool?.inputSchema.properties ?? [],
    ).map(([key, value]) => [
      key,
      generateDefaultValue(value as JsonSchemaType),
    ]);
    setParams(Object.fromEntries(params));
  }, [selectedTool]);

  const renderToolResult = () => {
    if (!toolResult) return null;

    if ("content" in toolResult) {
      const parsedResult = CallToolResultSchema.safeParse(toolResult);
      if (!parsedResult.success) {
        return (
          <>
            <h4 className="font-semibold mb-2">Invalid Tool Result:</h4>
            <JsonView data={toolResult} />
            <h4 className="font-semibold mb-2">Errors:</h4>
            {parsedResult.error.errors.map((error, idx) => (
              <JsonView data={error} key={idx} />
            ))}
          </>
        );
      }
      const structuredResult = parsedResult.data;
      const isError = structuredResult.isError ?? false;

      return (
        <>
          <h4 className="font-semibold mb-2">
            Tool Result:{" "}
            {isError ? (
              <span className="text-red-600 font-semibold">Error</span>
            ) : (
              <span className="text-[#00AD8A] font-semibold">Success</span>
            )}
          </h4>
          {structuredResult.content?.map((item, index) => (
            <div key={index} className="mb-2">
              {item.type === "text" && (
                <JsonView data={item.text} isError={isError} />
              )}
              {item.type === "image" && (
                <img
                  src={`data:${item.mimeType};base64,${item.data}`}
                  alt="Tool result image"
                  className="max-w-full h-auto"
                />
              )}
              {item.type === "resource" &&
                (item.resource?.mimeType?.startsWith("audio/") ? (
                  <audio
                    controls
                    src={`data:${item.resource.mimeType};base64,${item.resource.blob}`}
                    className="w-full"
                  >
                    <p>Your browser does not support audio playback</p>
                  </audio>
                ) : (
                  <JsonView data={item.resource} />
                ))}
            </div>
          ))}
        </>
      );
    } else if ("toolResult" in toolResult) {
      return (
        <>
          <h4 className="font-semibold mb-2">Tool Result (Legacy):</h4>

          <JsonView data={toolResult.toolResult} />
        </>
      );
    }
  };

  return (
    <TabsContent value="tools">
      <div className="grid grid-cols-2 gap-4">
        <ListPane
          items={tools}
          listItems={listTools}
          clearItems={() => {
            clearTools();
            setSelectedTool(null);
          }}
          setSelectedItem={setSelectedTool}
          renderItem={(tool) => (
            <div className="flex flex-row justify-between w-full gap-4">
              <div className="flex flex-col items-start">
                <span className="flex-1 line-clamp-1">{tool.name}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400 text-left">
                  {tool.description}
                </span>
              </div>
              <ToolChecksSummary tool={tool} />
            </div>
          )}
          title="Tools"
          buttonText={nextCursor ? "List More Tools" : "List Tools"}
          isButtonDisabled={!nextCursor && tools.length > 0}
          additionalActions={[
            {
              id: "evaluate",
              text: (
                <>
                  Evaluate Tools
                  <span className="ml-2 px-2 py-0.5 text-xs font-semibold tracking-wide text-white bg-[#00AD8A] rounded-full">
                    NEW
                  </span>
                </>
              ),
              onClick: async (tools) => {
                try {
                  const anthropic = new Anthropic({
                    apiKey,
                    dangerouslyAllowBrowser: true,
                  });

                  const STARTER = '{"testCases":[';
                  const response = await anthropic.messages.create({
                    model,
                    max_tokens: 4096,
                    system: `You're a Model Context Protocol expert and are tasked with evaluating a new MCP server.
                      Generate test cases that evaluate whether a language model can correctly distinguish between similar tools.
                      There are 2 types of test cases:
                      - First type of test aims at verifying tool calls in situation where no confusion seems possible, and where tool seem the most adapted to help the user. Those test should be very deterministic about the tool call parameters (e.g. "Help me create a new ticket called 'My first ticket'" rather than "Help me create a new ticket").
                      - Second type of test specifically target potential confusion points between tools with similar names, descriptions, or parameters that you have in your context.
                      
                      The test cases you generate should be in the following JSON format:

                      {
                        "testCases": [
                          {
                            "id": "TC001",
                            "userPrompt": "What is the weather in Tokyo?",
                            "expectedToolCall": {
                              toolName: "get_weather"
                              parameters: {
                                location: "Tokyo"
                              }
                            }
                          }
                        ]
                      } 

                      Your answer MUST only contain the response JSON object, nothing else.
                    `,
                    tool_choice: { type: "none" },
                    messages: [
                      {
                        role: "user",
                        content:
                          "Create a suite of test prompts that deliberately test each tool and edge cases between similar tools, measuring how often the model selects the correct tool.",
                      },
                      {
                        role: "assistant",
                        content: STARTER,
                      },
                    ],
                    tools: tools.map((tool) => ({
                      name: tool.name,
                      description:
                        tool.description || "No description available",
                      input_schema: tool.inputSchema,
                    })),
                  });

                  setToolsEvaluationResult({
                    tools,
                    status: "success",
                    result:
                      response.content[0].type === "text"
                        ? z
                            .string()
                            .transform((text) =>
                              JSON.parse([STARTER, text].join("")),
                            )
                            .pipe(
                              z.object({
                                testCases: z
                                  .array(z.any())
                                  .transform((testCases) =>
                                    testCases.filter(
                                      (testCase) =>
                                        testCaseSchema.safeParse(testCase)
                                          .success,
                                    ),
                                  ),
                              }),
                            )
                            .parse(response.content[0].text)
                        : { testCases: [] },
                  });
                } catch (e) {
                  setToolsEvaluationResult({
                    tools,
                    status: "error",
                    error: e,
                  });
                }
              },
              isDisabled: !isModelConfigured,
              disabledTooltipText:
                "In order to use this feature, please configure the model using corresponding configuration tab in the sidebar.",
            },
          ]}
          listPlaceholder={
            toolsEvaluationResult && (
              <ToolsEvaluation {...toolsEvaluationResult} />
            )
          }
        />

        <div className="bg-card rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="font-semibold">
              {selectedTool ? selectedTool.name : "Select a tool"}
            </h3>
          </div>
          <div className="p-4">
            {selectedTool ? (
              <div className="space-y-4">
                <ToolChecks tool={selectedTool} />
                <p className="text-sm text-gray-600">
                  {selectedTool.description}
                </p>
                {Object.entries(selectedTool.inputSchema.properties ?? []).map(
                  ([key, value]) => {
                    const prop = value as JsonSchemaType;
                    return (
                      <div key={key}>
                        <Label
                          htmlFor={key}
                          className="block text-sm font-medium text-gray-700"
                        >
                          {key}
                        </Label>
                        {prop.type === "boolean" ? (
                          <div className="flex items-center space-x-2 mt-2">
                            <Checkbox
                              id={key}
                              name={key}
                              checked={!!params[key]}
                              onCheckedChange={(checked: boolean) =>
                                setParams({
                                  ...params,
                                  [key]: checked,
                                })
                              }
                            />
                            <label
                              htmlFor={key}
                              className="text-sm font-medium text-gray-700 dark:text-gray-300"
                            >
                              {prop.description || "Toggle this option"}
                            </label>
                          </div>
                        ) : prop.type === "string" ? (
                          <Textarea
                            id={key}
                            name={key}
                            placeholder={prop.description}
                            value={(params[key] as string) ?? ""}
                            onChange={(e) =>
                              setParams({
                                ...params,
                                [key]: e.target.value,
                              })
                            }
                            className="mt-1"
                          />
                        ) : prop.type === "object" || prop.type === "array" ? (
                          <div className="mt-1">
                            <DynamicJsonForm
                              schema={{
                                type: prop.type,
                                properties: prop.properties,
                                description: prop.description,
                                items: prop.items,
                              }}
                              value={
                                (params[key] as JsonValue) ??
                                generateDefaultValue(prop)
                              }
                              onChange={(newValue: JsonValue) => {
                                setParams({
                                  ...params,
                                  [key]: newValue,
                                });
                              }}
                            />
                          </div>
                        ) : prop.type === "number" ||
                          prop.type === "integer" ? (
                          <Input
                            type="number"
                            id={key}
                            name={key}
                            placeholder={prop.description}
                            value={(params[key] as string) ?? ""}
                            onChange={(e) =>
                              setParams({
                                ...params,
                                [key]: Number(e.target.value),
                              })
                            }
                            className="mt-1"
                          />
                        ) : (
                          <div className="mt-1">
                            <DynamicJsonForm
                              schema={{
                                type: prop.type,
                                properties: prop.properties,
                                description: prop.description,
                                items: prop.items,
                              }}
                              value={params[key] as JsonValue}
                              onChange={(newValue: JsonValue) => {
                                setParams({
                                  ...params,
                                  [key]: newValue,
                                });
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  },
                )}
                <Button
                  onClick={async () => {
                    try {
                      setIsToolRunning(true);
                      await callTool(selectedTool.name, params);
                    } finally {
                      setIsToolRunning(false);
                    }
                  }}
                  disabled={isToolRunning}
                >
                  {isToolRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Run Tool
                    </>
                  )}
                </Button>
                {toolResult && renderToolResult()}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">
                Select a tool from the list to view its details and run it.
              </p>
            )}
          </div>
        </div>
      </div>
    </TabsContent>
  );
};

export default ToolsTab;

import { TabsContent } from "@/components/ui/tabs";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

const OverviewTab = ({ tools }: { tools: Tool[] }) => {
  return (
    <TabsContent value="overview">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-lg shadow col-span-1">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="font-semibold">Tools, Resources, and Prompts</h3>
          </div>
          <div className="space-y-2 overflow-y-auto max-h-96">
            {tools.map((tool, index) => (
              <div
                key={index}
                className="flex items-center p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
              >
                <div className="flex flex-col items-start">
                  <span className="flex-1">{tool.name}</span>
                  <span className="text-sm text-gray-500 text-left">
                    {tool.description}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-card rounded-lg shadow col-span-2">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="font-semibold">Security</h3>
          </div>
          <div className="space-y-2 overflow-y-auto max-h-96">
            {/* Content for the Security column will go here */}
          </div>
        </div>
      </div>
    </TabsContent>
  );
};

export default OverviewTab;

import { TabsContent } from "@/components/ui/tabs";
import {
  CreateMessageRequest,
  CreateMessageResult,
} from "@modelcontextprotocol/sdk/types.js";
import SamplingRequest from "./SamplingRequest";

export type PendingRequest = {
  id: number;
  request: CreateMessageRequest;
};

export type Props = {
  pendingRequests: PendingRequest[];
  onApprove: (id: number, result: CreateMessageResult) => void;
  onReject: (id: number) => void;
};

const SamplingTab = ({ pendingRequests, onApprove, onReject }: Props) => {
  return (
    <TabsContent value="sampling">
      <div className="h-96">
        <p className="text-sm text-gray-500 italic">
          When the server requests LLM sampling, requests will appear here for approval.
        </p>
        <div className="mt-4 bg-card rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-semibold">Recent Requests</h3>
          </div>
          <div className="p-4 space-y-4">
            {pendingRequests.map((request) => (
              <SamplingRequest
                key={request.id}
                request={request}
                onApprove={onApprove}
                onReject={onReject}
              />
            ))}
            {pendingRequests.length === 0 && (
              <p className="text-sm text-gray-500">No pending requests</p>
            )}
          </div>
        </div>
      </div>
    </TabsContent>
  );
};

export default SamplingTab;

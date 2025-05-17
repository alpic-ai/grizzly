import { useState } from "react";
import { Button } from "./ui/button";
import { Loader2 } from "lucide-react";

type ListPaneProps<T> = {
  items: T[];
  listItems: () => void;
  clearItems: () => void;
  setSelectedItem: (item: T | null) => void;
  renderItem: (item: T) => React.ReactNode;
  title: string;
  buttonText: string;
  isButtonDisabled?: boolean;
  additionalActions?: {
    id: string;
    text: React.ReactNode;
    onClick: (items: T[]) => Promise<void>;
    isDisabled?: boolean;
  }[];
  listPlaceholder?: React.ReactNode;
};

const ListPane = <T extends object>({
  items,
  listItems,
  clearItems,
  setSelectedItem,
  renderItem,
  title,
  buttonText,
  isButtonDisabled,
  additionalActions,
  listPlaceholder,
}: ListPaneProps<T>) => {
  const [isAdditionalActionRunning, setIsAdditionalActionRunning] =
    useState(false);

  return (
    <div className="bg-card rounded-lg shadow">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <h3 className="font-semibold dark:text-white">{title}</h3>
      </div>
      <div className="p-4">
        <Button
          variant="outline"
          className="w-full mb-4"
          onClick={listItems}
          disabled={isButtonDisabled || isAdditionalActionRunning}
        >
          {buttonText}
        </Button>
        {additionalActions?.map((action) => (
          <Button
            key={action.id}
            variant="outline"
            className="w-full mb-4"
            onClick={async () => {
              setSelectedItem(null);
              setIsAdditionalActionRunning(true);
              try {
                await action.onClick(items);
                clearItems();
              } finally {
                setIsAdditionalActionRunning(false);
              }
            }}
            disabled={
              action.isDisabled ||
              isAdditionalActionRunning ||
              items.length === 0
            }
          >
            {action.text}
          </Button>
        ))}
        <Button
          variant="outline"
          className="w-full mb-4"
          onClick={clearItems}
          disabled={items.length === 0}
        >
          Clear
        </Button>
        <div className="space-y-2 overflow-y-auto max-h-96">
          {isAdditionalActionRunning ? (
            <div className="flex flex-row items-center">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Running...
            </div>
          ) : items.length === 0 ? (
            listPlaceholder
          ) : (
            items.map((item, index) => (
              <div
                key={index}
                className="flex items-center p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                onClick={() => setSelectedItem(item)}
              >
                {renderItem(item)}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ListPane;

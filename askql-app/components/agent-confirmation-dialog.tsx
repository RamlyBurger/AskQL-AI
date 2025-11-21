"use client";

import {
  AlertDialog,
  AlertMsgAction,
  AlertMsgCancel,
  AlertMsgContent,
  AlertMsgDescription,
  AlertMsgFooter,
  AlertMsgHeader,
  AlertMsgTitle,
} from "@/components/alert-message";

interface PendingOperation {
  operation: string;
  sql: string;
  explanation: string;
  model: string;
}

interface AgentConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingOperation: PendingOperation | null;
  onConfirm: (confirmed: boolean) => void;
}

export function AgentConfirmationDialog({
  open,
  onOpenChange,
  pendingOperation,
  onConfirm,
}: AgentConfirmationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertMsgContent>
        <AlertMsgHeader>
          <AlertMsgTitle>
            Confirm {pendingOperation?.operation} Operation
          </AlertMsgTitle>
          <AlertMsgDescription>
            <div className="space-y-3">
              <p>{pendingOperation?.explanation}</p>
              <div className="rounded-lg bg-zinc-100 dark:bg-zinc-900 p-3">
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                  SQL Query:
                </p>
                <pre className="text-xs text-zinc-900 dark:text-zinc-100 overflow-x-auto">
                  {pendingOperation?.sql}
                </pre>
              </div>
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                ⚠️ This operation will modify your data. Are you sure you want
                to proceed?
              </p>
            </div>
          </AlertMsgDescription>
        </AlertMsgHeader>
        <AlertMsgFooter>
          <AlertMsgCancel onClick={() => onConfirm(false)}>
            Cancel
          </AlertMsgCancel>
          <AlertMsgAction
            onClick={() => onConfirm(true)}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Confirm & Execute
          </AlertMsgAction>
        </AlertMsgFooter>
      </AlertMsgContent>
    </AlertDialog>
  );
}

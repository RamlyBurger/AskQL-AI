"use client";

import { MainLayout } from "@/components/main-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/layout-box";
import { Code, Terminal, Webhook, Key } from "lucide-react";
import { Button } from "@/components/form-btn";

export default function DeveloperPage() {
  return (
    <MainLayout page="developer">
      <div className="flex h-full overflow-auto">
        <div className="mx-auto w-full max-w-4xl p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
              <Code className="h-8 w-8" />
              Developer Tools
            </h1>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400">
              API keys, webhooks, and integrations
            </p>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Key className="h-5 w-5 text-blue-600" />
                  <CardTitle>API Keys</CardTitle>
                </div>
                <CardDescription>
                  Manage your API keys for programmatic access
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4">
                    <p className="text-sm font-mono text-zinc-600 dark:text-zinc-400">
                      No API keys generated yet
                    </p>
                  </div>
                  <Button size="sm">Generate New Key</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Terminal className="h-5 w-5 text-green-600" />
                  <CardTitle>Code Examples</CardTitle>
                </div>
                <CardDescription>
                  Sample code for integrating with AskQL
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-zinc-900 p-4 font-mono text-sm text-zinc-100">
                  <pre>{`import { AskQL } from 'askql-sdk';

const client = new AskQL({
  apiKey: 'your-api-key'
});

const response = await client.query({
  message: 'Hello, AskQL!',
  model: 'gpt-4o'
});`}</pre>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Webhook className="h-5 w-5 text-purple-600" />
                  <CardTitle>Webhooks</CardTitle>
                </div>
                <CardDescription>
                  Configure webhooks for real-time notifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      No webhooks configured
                    </p>
                  </div>
                  <Button size="sm">Add Webhook</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

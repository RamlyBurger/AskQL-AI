"use client";

import { MainLayout } from "@/components/main-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/layout-box";
import { FileText, BookOpen, Code2, Zap } from "lucide-react";

export default function DocsPage() {
  return (
    <MainLayout page="docs">
      <div className="flex h-full overflow-auto">
        <div className="mx-auto w-full max-w-4xl p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
              <FileText className="h-8 w-8" />
              Documentation
            </h1>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400">
              Learn how to use AskQL
            </p>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                  <CardTitle>Getting Started</CardTitle>
                </div>
                <CardDescription>
                  Learn the basics of AskQL and how to get started
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <li>• Introduction to AskQL</li>
                  <li>• Setting up your account</li>
                  <li>• Configuring API keys</li>
                  <li>• Your first query</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Code2 className="h-5 w-5 text-green-600" />
                  <CardTitle>API Reference</CardTitle>
                </div>
                <CardDescription>
                  Complete API documentation and examples
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <li>• Authentication</li>
                  <li>• Chat endpoints</li>
                  <li>• Dataset management</li>
                  <li>• Error handling</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Zap className="h-5 w-5 text-yellow-600" />
                  <CardTitle>Advanced Features</CardTitle>
                </div>
                <CardDescription>
                  Explore advanced capabilities and integrations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <li>• Multi-model support</li>
                  <li>• Dataset querying</li>
                  <li>• Conversation history</li>
                  <li>• Custom integrations</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

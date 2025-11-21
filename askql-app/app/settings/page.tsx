"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/main-layout";
import { Button } from "@/components/form-btn";
import { Input } from "@/components/form-input";
import { Label } from "@/components/form-label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/layout-box";
import { Separator } from "@/components/ui-separator";
import {
  AlertDialog,
  AlertMsgAction,
  AlertMsgContent,
  AlertMsgDescription,
  AlertMsgFooter,
  AlertMsgHeader,
  AlertMsgTitle,
} from "@/components/alert-message";
import { Save, Key, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

interface APIKeys {
  google: string;
  openai: string;
  anthropic: string;
  deepseek: string;
}

export default function SettingsPage() {
  const { token } = useAuth();
  const [apiKeys, setApiKeys] = useState<APIKeys>({
    google: "",
    openai: "",
    anthropic: "",
    deepseek: "",
  });
  const [showKeys, setShowKeys] = useState<Record<keyof APIKeys, boolean>>({
    google: false,
    openai: false,
    anthropic: false,
    deepseek: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  // Load API keys from backend on mount
  useEffect(() => {
    const loadAPIKeys = async () => {
      if (!token) return;

      try {
        const { getAPIKeys } = await import("@/lib/api");
        const keys = await getAPIKeys(token);
        setApiKeys({
          google: keys.google || "",
          openai: keys.openai || "",
          anthropic: keys.anthropic || "",
          deepseek: keys.deepseek || "",
        });
      } catch (error) {
        console.error("Failed to load API keys:", error);
      }
    };

    loadAPIKeys();
  }, [token]);

  const handleSave = async () => {
    if (!token) {
      console.error("No authentication token found");
      alert("You must be logged in to save API keys.");
      return;
    }

    setIsSaving(true);
    try {
      const { updateAPIKeys } = await import("@/lib/api");
      await updateAPIKeys(token, apiKeys);
      // Add a small delay to make loading state more visible
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setShowSuccessDialog(true);
    } catch (error) {
      console.error("Failed to save API keys:", error);
      alert("Failed to save API keys. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyChange = (provider: keyof APIKeys, value: string) => {
    setApiKeys((prev) => ({ ...prev, [provider]: value }));
  };

  const toggleShowKey = (provider: keyof APIKeys) => {
    setShowKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  const apiProviders = [
    {
      key: "google" as keyof APIKeys,
      name: "Google AI",
      description: "For Gemini 2.5 Flash and Gemini 2.0 Flash",
      placeholder: "Enter your Google AI API key",
      link: "https://aistudio.google.com/app/apikey",
    },
    {
      key: "openai" as keyof APIKeys,
      name: "OpenAI",
      description: "For GPT-4o and GPT-4o Mini",
      placeholder: "Enter your OpenAI API key (sk-...)",
      link: "https://platform.openai.com/api-keys",
    },
    {
      key: "anthropic" as keyof APIKeys,
      name: "Anthropic",
      description: "For Claude 3.5 Sonnet",
      placeholder: "Enter your Anthropic API key",
      link: "https://console.anthropic.com/settings/keys",
    },
    {
      key: "deepseek" as keyof APIKeys,
      name: "DeepSeek",
      description: "For DeepSeek Chat",
      placeholder: "Enter your DeepSeek API key",
      link: "https://platform.deepseek.com/api_keys",
    },
  ];

  return (
    <MainLayout page="settings">
      <div className="flex h-full overflow-auto bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-4xl p-8 pb-32">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              Settings
            </h1>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400">
              Manage your API keys and preferences
            </p>
          </div>

          {/* API Keys */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                <CardTitle>API Keys</CardTitle>
              </div>
              <CardDescription>
                Configure your API keys for different AI providers. Keys are
                stored securely in the database.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form
                autoComplete="off"
                onSubmit={(e) => e.preventDefault()}
                className="space-y-6"
              >
                {apiProviders.map((provider, index) => (
                  <div key={provider.key}>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label
                            htmlFor={provider.key}
                            className="text-sm font-medium"
                          >
                            {provider.name}
                          </Label>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            {provider.description}
                          </p>
                        </div>
                        <a
                          href={provider.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                        >
                          Get API Key →
                        </a>
                      </div>
                      <div className="relative">
                        <Input
                          id={provider.key}
                          type={showKeys[provider.key] ? "text" : "password"}
                          value={apiKeys[provider.key]}
                          onChange={(e) =>
                            handleKeyChange(provider.key, e.target.value)
                          }
                          placeholder={provider.placeholder}
                          className="pr-10"
                          autoComplete="off"
                          data-form-type="other"
                          data-lpignore="true"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full hover:bg-transparent"
                          onClick={() => toggleShowKey(provider.key)}
                        >
                          {showKeys[provider.key] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </form>

              <div className="flex items-center justify-between pt-4">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  🔒 Your API keys are stored securely in the database and used
                  only for your requests.
                </p>
                <Button
                  onClick={handleSave}
                  className="gap-2"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {isSaving ? "Saving..." : "Save Keys"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <AlertMsgContent>
          <AlertMsgHeader>
            <AlertMsgTitle>Success!</AlertMsgTitle>
            <AlertMsgDescription>
              Your API keys have been saved successfully.
            </AlertMsgDescription>
          </AlertMsgHeader>
          <AlertMsgFooter>
            <AlertMsgAction onClick={() => setShowSuccessDialog(false)}>
              OK
            </AlertMsgAction>
          </AlertMsgFooter>
        </AlertMsgContent>
      </AlertDialog>
    </MainLayout>
  );
}

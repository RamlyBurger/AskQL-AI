"use client";

import { MainLayout } from "@/components/main-layout";
import { useAuth } from "@/contexts/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/profile-icon";
import { Button } from "@/components/form-btn";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/layout-box";
import { Separator } from "@/components/ui-separator";
import { Badge } from "@/components/ui-icon";
import { User, Mail, Calendar, Shield, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <MainLayout page="profile">
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <p className="text-zinc-500 dark:text-zinc-400">
              Loading profile...
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!user) {
    return (
      <MainLayout page="profile">
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              Not Logged In
            </h1>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400">
              Please log in to view your profile
            </p>
            <Button className="mt-4" onClick={() => router.push("/login")}>
              Go to Login
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout page="profile">
      <div className="h-full overflow-auto bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto max-w-4xl p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              Profile
            </h1>
            <Button variant="outline" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>

          {/* Profile Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src="" alt={user.full_name} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl font-bold">
                    {user.full_name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <CardTitle className="text-2xl">{user.full_name}</CardTitle>
                  <CardDescription className="text-base mt-1">
                    {user.email}
                  </CardDescription>
                  <div className="mt-2">
                    <Badge
                      variant={user.is_active ? "default" : "secondary"}
                      className="gap-1"
                    >
                      <Shield className="h-3 w-3" />
                      {user.is_active ? "Active Account" : "Inactive Account"}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-zinc-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      Full Name
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {user.full_name}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-zinc-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      Email Address
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {user.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-zinc-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      Member Since
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {formatDate(user.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-zinc-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      Account Status
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {user.is_active ? "Active and verified" : "Inactive"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                Your account details and settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">
                    User ID
                  </span>
                  <span className="font-mono text-zinc-900 dark:text-zinc-100">
                    #{user.id}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">
                    Account Type
                  </span>
                  <span className="text-zinc-900 dark:text-zinc-100">
                    Standard User
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">
                    Registration Date
                  </span>
                  <span className="text-zinc-900 dark:text-zinc-100">
                    {formatDate(user.created_at)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Account Actions</CardTitle>
              <CardDescription>Manage your account settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                disabled
              >
                Change Password
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                disabled
              >
                Update Profile Information
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start text-red-600 hover:text-red-700"
                disabled
              >
                Delete Account
              </Button>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 pt-2">
                * These features are coming soon
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}

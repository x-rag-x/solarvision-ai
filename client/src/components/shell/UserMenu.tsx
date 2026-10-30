import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { openOperatorLoginModal } from "@/const";
import { LogIn, LogOut, Shield, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserMenuProps {
  collapsed?: boolean;
}

export function UserMenu({ collapsed = false }: UserMenuProps) {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <button
        onClick={() => openOperatorLoginModal()}
        className={`flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-text-2 transition-all hover:border-brand hover:text-text hover:bg-surface-subtle active:scale-[0.98] ${
          collapsed ? "w-10 h-10 justify-center p-0" : "w-full"
        }`}
        title="Sign in as Operator"
        aria-label="Sign in as Operator"
      >
        <LogIn className="h-4 w-4 text-brand-text shrink-0" />
        {!collapsed && <span>Sign in</span>}
      </button>
    );
  }

  const initials = user.name ? user.name.slice(0, 2).toUpperCase() : "OP";
  const isAdmin = user.role === "admin";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`flex items-center gap-2.5 rounded-xl border border-transparent p-1.5 text-left transition-colors hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-focus ${
            collapsed ? "justify-center" : "w-full"
          }`}
          aria-label={`User menu for ${user.name}`}
        >
          <Avatar className="h-8 w-8 border border-border bg-brand-tint shrink-0">
            <AvatarFallback className="bg-brand-tint text-xs font-semibold text-brand-text">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-text">{user.name}</p>
              <div className="flex items-center gap-1 text-xs text-text-3">
                {isAdmin ? (
                  <Shield className="h-3 w-3 text-brand-text" />
                ) : (
                  <User className="h-3 w-3" />
                )}
                <span className="truncate">{isAdmin ? "Admin" : "Operator"}</span>
              </div>
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-xl border border-border bg-surface p-1 shadow-lg">
        <DropdownMenuLabel className="px-3 py-2 text-xs font-medium text-text-3">
          Signed in as
          <div className="font-semibold text-text text-sm truncate mt-0.5">{user.name}</div>
          <div className="text-xs font-mono text-text-3 capitalize">{user.role || "Operator"}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuItem
          onClick={() => logout()}
          className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-danger hover:bg-danger-tint hover:text-danger focus:bg-danger-tint focus:text-danger"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

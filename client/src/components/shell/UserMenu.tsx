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
        className={`flex items-center gap-2 rounded-lg bg-[#2F3A58] hover:bg-[#242E47] text-white px-3 py-2 text-[13px] font-semibold shadow-xs transition-all duration-150 active:scale-[0.98] ${
          collapsed ? "w-9 h-9 justify-center p-0" : "w-full"
        }`}
        title="Sign in as Operator"
        aria-label="Sign in as Operator"
      >
        <LogIn className="h-4 w-4 text-[#F2DBD7] shrink-0" />
        {!collapsed && <span>Sign in as Operator</span>}
      </button>
    );
  }

  const initials = user.name ? user.name.slice(0, 2).toUpperCase() : "OP";
  const isAdmin = user.role === "admin";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`flex items-center gap-2 rounded-lg border border-transparent p-1.5 text-left transition-colors duration-150 hover:bg-[#D8DCED] focus-visible:ring-2 focus-visible:ring-[#2F3A58] ${
            collapsed ? "justify-center" : "w-full"
          }`}
          aria-label={`User menu for ${user.name}`}
        >
          <Avatar className="h-7 w-7 border border-[#D9DDEB] bg-[#2F3A58] shrink-0">
            <AvatarFallback className="bg-[#2F3A58] text-[11px] font-bold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-[#2F3A58]">{user.name}</p>
              <div className="flex items-center gap-1 text-[12px] text-[#59647D]">
                {isAdmin ? (
                  <Shield className="h-3 w-3 text-[#965660]" />
                ) : (
                  <User className="h-3 w-3 text-[#2F3A58]" />
                )}
                <span className="truncate">{isAdmin ? "Admin" : "Operator"}</span>
              </div>
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-xl border border-[#D9DDEB] bg-white p-1 shadow-lg">
        <DropdownMenuLabel className="px-3 py-2 text-xs font-medium text-[#59647D]">
          Signed in as
          <div className="font-semibold text-[#2F3A58] text-sm truncate mt-0.5">{user.name}</div>
          <div className="text-xs font-mono text-[#59647D] capitalize">{user.role || "Operator"}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-[#D9DDEB]" />
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

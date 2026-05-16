"use client";

import type { ReactNode } from "react";
import { useTheme } from "@/components/theme-provider";
import { DocsShell } from "@/components/theme-shells/docs-shell";
import { ExcelShell } from "@/components/theme-shells/excel-shell";
import { JetBrainsShell } from "@/components/theme-shells/jetbrains-shell";
import { PowerPointShell } from "@/components/theme-shells/powerpoint-shell";
import { VsCodeShell } from "@/components/theme-shells/vscode-shell";
import { getThemeOption } from "@/lib/theme";

type ThemeChromeProps = {
  children: ReactNode;
  defaultHeader: ReactNode;
  policyBanner: ReactNode;
  footer: ReactNode;
  mobileChatDock: ReactNode;
  desktopChatSidebar: ReactNode;
};

export function ThemeChrome({
  children,
  defaultHeader,
  policyBanner,
  footer,
  mobileChatDock,
  desktopChatSidebar
}: ThemeChromeProps) {
  const { themeId } = useTheme();
  const option = getThemeOption(themeId);

  if (option.shellType === "default") {
    return (
      <div id="page-top" className="layout">
        {defaultHeader}
        <div className="default-chat-workspace">
          <div className="default-chat-content">
            {policyBanner}
            {children}
            {footer}
          </div>
          {desktopChatSidebar}
        </div>
        {mobileChatDock}
      </div>
    );
  }

  const framedContent = (
    <div id="page-top" className="layout theme-shell-page theme-shell-content-document" data-testid="theme-content-document">
      {policyBanner}
      {children}
      {footer}
      {mobileChatDock}
    </div>
  );

  if (option.shellType === "excel") {
    return (
      <ExcelShell option={option} chatSidebar={desktopChatSidebar}>
        {framedContent}
      </ExcelShell>
    );
  }

  if (option.shellType === "powerpoint") {
    return (
      <PowerPointShell option={option} chatSidebar={desktopChatSidebar}>
        {framedContent}
      </PowerPointShell>
    );
  }

  if (option.shellType === "docs") {
    return (
      <DocsShell option={option} chatSidebar={desktopChatSidebar}>
        {framedContent}
      </DocsShell>
    );
  }

  if (option.shellType === "vscode") {
    return (
      <VsCodeShell option={option} chatSidebar={desktopChatSidebar}>
        {framedContent}
      </VsCodeShell>
    );
  }

  if (option.shellType === "jetbrains") {
    return (
      <JetBrainsShell option={option} chatSidebar={desktopChatSidebar}>
        {framedContent}
      </JetBrainsShell>
    );
  }

  return (
    <div id="page-top" className="layout">
      {defaultHeader}
      <div className="default-chat-workspace">
        <div className="default-chat-content">
          {policyBanner}
          {children}
          {footer}
        </div>
        {desktopChatSidebar}
      </div>
      {mobileChatDock}
    </div>
  );
}

import { useState, useCallback, useRef, useEffect } from "react";
import type { EditorTab, FollowMode } from "../types";
import { DEFAULT_TAB_ID } from "../permissions";

export const useEditorState = () => {
  const [tabs, setTabs] = useState<EditorTab[]>([
    { id: DEFAULT_TAB_ID, name: "main.js", code: "" },
  ]);
  const [activeTabId, setActiveTabId] = useState(DEFAULT_TAB_ID);
  const tabsRef = useRef(tabs);
  const [userActiveTabs, setUserActiveTabs] = useState<Record<string, string>>({});
  const [followingUser, setFollowingUser] = useState<string | null>(null);
  const [followMode, setFollowMode] = useState<FollowMode>("auto");
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [fontSize, setFontSize] = useState(16);
  const [wrapLines, setWrapLines] = useState<boolean>(
    () => typeof window !== "undefined" && window.innerWidth < 640
  );
  const [showParticipants, setShowParticipants] = useState<boolean>(false);
  const [zen, setZen] = useState<boolean>(false);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  const handleCodeChangeLocal = useCallback((code: string, tabId: string) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, code } : tab))
    );
  }, []);

  const fontSizeChange = useCallback((change: number) => {
    setFontSize((prev) => Math.max(8, Math.min(prev + change, 36)));
  }, []);

  return {
    tabs,
    setTabs,
    tabsRef,
    activeTabId,
    setActiveTabId,
    userActiveTabs,
    setUserActiveTabs,
    followingUser,
    setFollowingUser,
    followMode,
    setFollowMode,
    renamingTabId,
    setRenamingTabId,
    renameValue,
    setRenameValue,
    fontSize,
    setFontSize,
    wrapLines,
    setWrapLines,
    showParticipants,
    setShowParticipants,
    zen,
    setZen,
    handleCodeChangeLocal,
    fontSizeChange,
  };
};

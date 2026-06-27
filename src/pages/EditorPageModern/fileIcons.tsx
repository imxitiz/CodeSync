import { File, FileText } from "lucide-react";
import type { ReactNode } from "react";
import {
  SiCss,
  SiHtml5,
  SiJavascript,
  SiReact,
  SiTypescript,
} from "react-icons/si";

/**
 * File extension → icon + color mapping.
 * - Brand/language icons use react-icons/si (Lucide has no brand icons).
 * - Generic file icons use lucide-react (project's primary icon library).
 */
const EXTENSIONS: Array<{ match: string[]; icon: ReactNode; color: string }> = [
  { match: ["js"], icon: <SiJavascript />, color: "text-yellow-400" },
  { match: ["jsx"], icon: <SiReact />, color: "text-cyan-400" },
  { match: ["ts"], icon: <SiTypescript />, color: "text-blue-500" },
  { match: ["tsx"], icon: <SiReact />, color: "text-blue-400" },
  { match: ["json"], icon: <File />, color: "text-green-500" },
  { match: ["css"], icon: <SiCss />, color: "text-purple-400" },
  { match: ["scss", "sass"], icon: <SiCss />, color: "text-pink-400" },
  { match: ["html", "htm"], icon: <SiHtml5 />, color: "text-orange-400" },
  {
    match: ["md", "mdx"],
    icon: <FileText />,
    color: "text-muted-foreground",
  },
  { match: ["py"], icon: <File />, color: "text-amber-500" },
  { match: ["yml", "yaml"], icon: <File />, color: "text-red-500" },
];

/**
 * Returns a colored icon element for the given filename.
 * Falls back to a generic file icon if extension is unknown.
 */
export function getFileIcon(name: string): ReactNode {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const found = EXTENSIONS.find((e) => e.match.includes(ext));

  if (found) {
    return <span className={found.color}>{found.icon}</span>;
  }

  return <File className="text-muted-foreground" />;
}

/**
 * Returns just the color class for the file extension.
 * Useful for text accents without an icon.
 */
export function getFileColor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const found = EXTENSIONS.find((e) => e.match.includes(ext));
  return found?.color ?? "text-muted-foreground";
}

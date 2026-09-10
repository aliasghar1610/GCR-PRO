import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  Sparkles,
  FileQuestion,
  GraduationCap,
  Users,
  FileText,
  Settings,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/courses", label: "Courses", icon: BookOpen },
  { href: "/dashboard/assignments", label: "Assignments", icon: ClipboardList },
  { href: "/dashboard/solver", label: "Solver", icon: Sparkles },
  { href: "/dashboard/quiz", label: "Quizzes", icon: FileQuestion },
  { href: "/dashboard/grades", label: "Grades", icon: GraduationCap },
  { href: "/dashboard/professors", label: "Professors", icon: Users },
  { href: "/dashboard/documents", label: "Documents", icon: FileText },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

// The five most-used destinations for the <768px bottom tab bar; the rest
// live behind "More" (§2).
export const MOBILE_TAB_HREFS = [
  "/dashboard",
  "/dashboard/courses",
  "/dashboard/assignments",
  "/dashboard/solver",
  "/dashboard/grades",
];

import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  GraduationCap,
  Users,
  ClipboardList,
  FileText,
  Plus,
  BookOpen,
} from "lucide-react";

const navigation = [
  {
    name: "Add Student",
    href: "/add-student",
    icon: Plus,
  },
  {
    name: "Student Lists",
    href: "/students",
    icon: Users,
  },
  {
    name: "Mark Entry",
    href: "/mark-entry",
    icon: ClipboardList,
  },
  {
    name: "Marksheet",
    href: "/marksheet",
    icon: FileText,
  },
];

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <GraduationCap className="h-8 w-8 text-primary mr-3" />
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  GUZIA HIGH SCHOOL
                </h1>
                <p className="text-xs text-muted-foreground">
                  Management System
                </p>
              </div>
            </div>
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Navigation */}
        <nav className="w-64 bg-card shadow-sm min-h-[calc(100vh-4rem)]">
          <div className="p-4">
            <div className="space-y-2">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent",
                    )}
                  >
                    <item.icon className="mr-3 h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-card border-t mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-muted-foreground">
            GUZIA HIGH SCHOOL, Guzia, Shibganj, Bogura
          </p>
        </div>
      </footer>
    </div>
  );
}

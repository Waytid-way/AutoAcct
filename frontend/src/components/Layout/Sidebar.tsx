'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, UploadCloud, AlertTriangle, Settings, FileText, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

interface SidebarProps {
    className?: string;
}

const NAV_ITEMS = [
    {
        title: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        variant: 'ghost',
    },
    {
        title: 'Upload Receipts',
        href: '/upload',
        icon: UploadCloud,
        variant: 'ghost',
    },
    {
        title: 'Anomalies',
        href: '/dashboard/anomalies',
        icon: AlertTriangle,
        variant: 'ghost',
    },
    {
        title: 'Reports',
        href: '/reports', // Placeholder
        icon: FileText,
        variant: 'ghost',
        disabled: true, // Not implemented yet
    },
    {
        title: 'Settings',
        href: '/settings', // Placeholder
        icon: Settings,
        variant: 'ghost',
        disabled: true,
    }
];

export function Sidebar({ className }: SidebarProps) {
    const pathname = usePathname();

    return (
        <div className={cn("pb-12 min-h-screen border-r border-border-default bg-bg-surface w-64 flex-shrink-0 flex flex-col", className)}>
            <div className="space-y-4 py-4">
                <div className="px-3 py-2">
                    <div className="flex items-center gap-2 mb-6 px-4">
                        <div className="w-8 h-8 bg-accent-primary rounded-lg flex items-center justify-center">
                            <span className="font-bold text-white">A</span>
                        </div>
                        <h2 className="text-lg font-bold tracking-tight text-text-primary">
                            AutoAcct
                        </h2>
                    </div>

                    <div className="space-y-1">
                        {NAV_ITEMS.map((item) => {
                            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));

                            return (
                                <Link
                                    key={item.href}
                                    href={item.disabled ? '#' : item.href}
                                    className={cn(
                                        item.disabled && "pointer-events-none opacity-50"
                                    )}
                                >
                                    <Button
                                        variant={isActive ? "secondary" : "ghost"}
                                        className={cn(
                                            "w-full justify-start gap-3 mb-1",
                                            isActive ? "bg-bg-subtle text-accent-primary font-medium" : "text-text-secondary hover:text-text-primary hover:bg-bg-subtle",
                                        )}
                                    >
                                        <item.icon className={cn("w-4 h-4", isActive ? "text-accent-primary" : "text-text-tertiary")} />
                                        {item.title}
                                        {isActive && <ChevronRight className="w-3 h-3 ml-auto opacity-50" />}
                                    </Button>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Footer User Profile Mock */}
            <div className="mt-auto px-6 py-4 border-t border-border-default">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent-primary/20 flex items-center justify-center text-accent-primary text-xs font-bold">
                        JD
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">John Doe</p>
                        <p className="text-xs text-text-tertiary truncate">Admin</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

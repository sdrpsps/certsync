"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { LayoutDashboard, FileCheck, Settings } from "lucide-react"

const userData = {
  name: "Admin",
  email: "admin@cert-sync.local",
  avatar: "/avatars/admin.jpg",
}

const navItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: <LayoutDashboard />,
  },
  {
    title: "Certificates",
    url: "/certificates",
    icon: <FileCheck />,
  },
  {
    title: "Configuration",
    url: "/config",
    icon: <Settings />,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

  const navMainItems = navItems.map(item => ({
    ...item,
    isActive: pathname === item.url,
  }))

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <FileCheck className="h-6 w-6" />
          <span className="font-semibold">Cert Sync</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMainItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

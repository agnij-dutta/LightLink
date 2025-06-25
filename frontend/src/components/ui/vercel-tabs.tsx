"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface Tab {
  id: string
  label: string
  icon?: React.ReactNode
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  className?: string
}

export const Tabs = ({ tabs, activeTab, onTabChange, className }: TabsProps) => {
  return (
    <div className={cn("w-full", className)}>
      <div className="relative flex space-x-1 rounded-xl bg-muted/30 p-1 backdrop-blur-sm border border-border/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "relative px-6 py-2.5 text-sm font-medium transition-all duration-200 rounded-lg flex items-center space-x-2",
              "hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50",
              activeTab === tab.id
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground/80"
            )}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-background/80 backdrop-blur-sm border border-border/50 rounded-lg shadow-lg"
                initial={false}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 30,
                }}
              />
            )}
            <div className="relative z-10 flex items-center space-x-2">
              {tab.icon && (
                <span className={cn(
                  "transition-colors duration-200",
                  activeTab === tab.id ? "text-primary" : "text-muted-foreground"
                )}>
                  {tab.icon}
                </span>
              )}
              <span>{tab.label}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
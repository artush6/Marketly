"use client"

import type React from "react"

import { useRef, useState, useEffect } from "react"
import { X, Maximize2, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { WindowType } from "@/app/page"

interface DashboardWindowProps {
  window: WindowType
  onUpdate: (id: string, updates: Partial<WindowType>) => void
  onClose: (id: string) => void
  onFocus: (id: string) => void
  children: React.ReactNode
}

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw"

export function DashboardWindow({ window, onUpdate, onClose, onFocus, children }: DashboardWindowProps) {
  const windowRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection | null>(null)
  const [isMaximized, setIsMaximized] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, windowX: 0, windowY: 0 })
  const [preMaximizeState, setPreMaximizeState] = useState<Partial<WindowType>>({})

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.x
        const newY = e.clientY - dragOffset.y
        onUpdate(window.id, {
          x: Math.max(0, newX),
          y: Math.max(0, newY),
        })
      } else if (isResizing && resizeDirection) {
        const deltaX = e.clientX - resizeStart.x
        const deltaY = e.clientY - resizeStart.y

        let newWidth = resizeStart.width
        let newHeight = resizeStart.height
        let newX = resizeStart.windowX
        let newY = resizeStart.windowY

        // Horizontal resizing
        if (resizeDirection.includes("e")) {
          newWidth = Math.max(300, resizeStart.width + deltaX)
        } else if (resizeDirection.includes("w")) {
          newWidth = Math.max(300, resizeStart.width - deltaX)
          newX = resizeStart.windowX + (resizeStart.width - newWidth)
        }

        // Vertical resizing
        if (resizeDirection.includes("s")) {
          newHeight = Math.max(200, resizeStart.height + deltaY)
        } else if (resizeDirection.includes("n")) {
          newHeight = Math.max(200, resizeStart.height - deltaY)
          newY = resizeStart.windowY + (resizeStart.height - newHeight)
        }

        onUpdate(window.id, {
          width: newWidth,
          height: newHeight,
          x: newX,
          y: newY,
        })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsResizing(false)
      setResizeDirection(null)
    }

    if (isDragging || isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [isDragging, isResizing, dragOffset, resizeStart, resizeDirection, window.id, onUpdate])

  const handleDragStart = (e: React.MouseEvent) => {
    if (isMaximized) return
    if ((e.target as HTMLElement).closest("button")) return

    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - window.x,
      y: e.clientY - window.y,
    })
    onFocus(window.id)
  }

  const handleResizeStart = (e: React.MouseEvent, direction: ResizeDirection) => {
    if (isMaximized) return
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    setResizeDirection(direction)
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: window.width,
      height: window.height,
      windowX: window.x,
      windowY: window.y,
    })
    onFocus(window.id)
  }

  const toggleMaximize = () => {
    if (isMaximized) {
      onUpdate(window.id, preMaximizeState)
      setIsMaximized(false)
    } else {
      setPreMaximizeState({
        x: window.x,
        y: window.y,
        width: window.width,
        height: window.height,
      })
      if (windowRef.current) {
        const parent = windowRef.current.parentElement
        if (parent) {
          onUpdate(window.id, {
            x: 0,
            y: 0,
            width: parent.clientWidth,
            height: parent.clientHeight,
          })
        }
      }
      setIsMaximized(true)
    }
  }

  return (
    <Card
      ref={windowRef}
      className="absolute shadow-2xl border border-border bg-card flex flex-col overflow-hidden"
      style={{
        left: `${window.x}px`,
        top: `${window.y}px`,
        width: `${window.width}px`,
        height: `${window.height}px`,
        zIndex: window.zIndex,
        userSelect: isDragging ? "none" : "auto",
      }}
      onMouseDown={() => onFocus(window.id)}
    >
      {/* Title Bar */}
      <div
        className="h-10 bg-secondary/50 border-b border-border flex items-center justify-between px-3 select-none"
        onMouseDown={handleDragStart}
        style={{ cursor: isMaximized ? "default" : isDragging ? "grabbing" : "grab" }}
      >
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-destructive" />
            <div className="h-2.5 w-2.5 rounded-full bg-accent" />
            <div className="h-2.5 w-2.5 rounded-full bg-primary" />
          </div>
          <span className="text-sm font-medium text-foreground ml-2">{window.title}</span>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={toggleMaximize}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {isMaximized ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => onClose(window.id)}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 bg-card">{children}</div>

      {!isMaximized && (
        <>
          {/* Corner handles */}
          <div
            className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize hover:bg-primary/30 transition-colors z-10"
            onMouseDown={(e) => handleResizeStart(e, "nw")}
          />
          <div
            className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize hover:bg-primary/30 transition-colors z-10"
            onMouseDown={(e) => handleResizeStart(e, "ne")}
          />
          <div
            className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize hover:bg-primary/30 transition-colors z-10"
            onMouseDown={(e) => handleResizeStart(e, "sw")}
          />
          <div
            className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize hover:bg-primary/30 transition-colors z-10"
            onMouseDown={(e) => handleResizeStart(e, "se")}
          />

          {/* Edge handles */}
          <div
            className="absolute top-0 left-3 right-3 h-1 cursor-n-resize hover:bg-primary/20 transition-colors z-10"
            onMouseDown={(e) => handleResizeStart(e, "n")}
          />
          <div
            className="absolute bottom-0 left-3 right-3 h-1 cursor-s-resize hover:bg-primary/20 transition-colors z-10"
            onMouseDown={(e) => handleResizeStart(e, "s")}
          />
          <div
            className="absolute left-0 top-3 bottom-3 w-1 cursor-w-resize hover:bg-primary/20 transition-colors z-10"
            onMouseDown={(e) => handleResizeStart(e, "w")}
          />
          <div
            className="absolute right-0 top-3 bottom-3 w-1 cursor-e-resize hover:bg-primary/20 transition-colors z-10"
            onMouseDown={(e) => handleResizeStart(e, "e")}
          />
        </>
      )}
    </Card>
  )
}

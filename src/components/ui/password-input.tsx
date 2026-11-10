"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/ui/utils"

/** The one password field: the Input with a show/hide toggle inside its right
 * edge. The toggle is a real button (keyboard reachable, labelled), the field
 * keeps every Input prop, and the text is masked until the user asks. */
function PasswordInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const [shown, setShown] = React.useState(false)
  return (
    <div className="relative">
      <Input type={shown ? "text" : "password"} className={cn("pr-9", className)} {...props} />
      <button
        type="button"
        tabIndex={-1}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        onClick={() => setShown((s) => !s)}
        className="absolute inset-y-0 right-0 flex w-9 pointer-coarse:w-11 items-center justify-center rounded-r-[10px] text-[#696F79] transition-colors duration-[180ms] ease-standard hover:text-[#3A3F47] focus-visible:text-[#3A3F47] outline-none"
      >
        {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

export { PasswordInput }

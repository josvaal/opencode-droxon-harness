// @ts-nocheck
/** @jsxImportSource @opentui/solid */
import type { TuiPlugin } from "@opencode-ai/plugin/tui"
import { useTerminalDimensions } from "@opentui/solid"
import { createMemo } from "solid-js"

const id = "droxon-logo"

const art = [
  "⠀⠀⢀⣤⣶⣶⣦⣄⡀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣤⣶⣶⠆⠀⠀⠀⠀",
  "⠀⣰⣿⣿⠟⠛⠻⢿⣿⣄⠀⠀⠀⠀⠀⠀⣾⣿⣿⣿⠃⠀⠀⠀⠀⠀",
  "⢠⣿⣿⠃⠀⠀⠀⠀⠹⣿⣷⡀⠀⠀⢀⣾⣿⣿⣿⠃⠀⠀⠀⠀⠀⠀",
  "⠈⠉⠉⠀⠀⠀⠀⠀⠀⠙⣿⣷⡀⢀⣾⣿⣿⡿⠃⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠹⣿⣷⣾⣿⣿⡿⠁⠀⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢹⣿⣿⣿⡿⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⣿⣿⣿⣿⣿⣧⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⠀⠀⠀⢠⣿⣿⣿⠏⠸⣿⣿⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⠀⠀⢠⣿⣿⣿⠏⠀⠀⢹⣿⣿⡀⠀⠀⠀⠀⠀⣿⣿⡇",
  "⠀⠀⠀⠀⠀⠀⣰⣿⣿⣿⠋⠀⠀⠀⠀⢻⣿⣷⡀⠀⠀⠀⣰⣿⣿⠀",
  "⠀⠀⠀⠀⠀⣰⣿⣿⡿⠃⠀⠀⠀⠀⠀⠀⠙⣿⣿⣦⣤⣴⣿⣿⠃⠀",
  "⠀⠀⠀⠀⠰⠟⠛⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠙⠻⠿⠟⠛⠁⠀⠀",
]

const compactArt = ["◆ Droxon ◆"]

const Logo = () => {
  const dim = useTerminalDimensions()
  const lines = createMemo(() => {
    const term = dim()
    return term.height >= art.length + 6 && term.width >= 64 ? art : compactArt
  })

  return (
    <box flexDirection="column" alignItems="center">
      {lines().map((line) => (
        <text fg="blue">{line}</text>
      ))}
    </box>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    id,
    order: 100,
    slots: {
      home_logo() {
        return <Logo />
      },
    },
  })
}

const plugin = { id: "droxon-logo", tui }
export default plugin

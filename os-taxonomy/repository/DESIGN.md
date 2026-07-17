# Design System

## Theme

明亮的学习工具界面。纯白画布承载图谱，深墨色用于阅读，琥珀色负责主要操作。图谱使用完整学科色谱，但界面控件保持克制。

## Color

- Background: `oklch(1 0 0)`
- Surface: `oklch(0.975 0.006 60)`
- Ink: `oklch(0.22 0.025 255)`
- Muted: `oklch(0.47 0.025 255)`
- Primary: `oklch(0.65 0.146 60)`
- Accent: `oklch(0.48 0.15 288)`
- Subject colors: semantic and stable across graph, legend, filters, and detail views

## Typography

Use a system Chinese sans-serif stack. Interface labels are compact and consistent; titles use weight rather than display fonts. Body copy is limited to readable line lengths.

## Layout

Desktop uses a slim top toolbar, a dominant graph canvas, a floating legend, and a right-side detail panel. Mobile collapses the filters and turns detail into a bottom sheet.

## Components

Controls use 10–14px radii, clear focus rings, 160–220ms state transitions, and consistent hover/selected states. Cards are reserved for true floating layers such as the detail sheet and legend.

## Motion

Dragging rotates the graph, wheel/pinch zooms, and selection smoothly focuses related nodes. Reduced-motion mode disables inertial and staged transitions.

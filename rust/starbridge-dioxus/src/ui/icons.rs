//! SVG icon components for the Cadet desktop UI.
//! Each icon renders at 16x16 by default, inheriting `currentColor`.

use dioxus::prelude::*;

#[component]
pub fn IconPlus(#[props(default = 16)] size: u32) -> Element {
    rsx! {
        svg {
            class: "icon",
            width: "{size}",
            height: "{size}",
            view_box: "0 0 16 16",
            fill: "none",
            stroke: "currentColor",
            stroke_width: "2",
            stroke_linecap: "round",
            line { x1: "8", y1: "3", x2: "8", y2: "13" }
            line { x1: "3", y1: "8", x2: "13", y2: "8" }
        }
    }
}

#[component]
pub fn IconSearch(#[props(default = 16)] size: u32) -> Element {
    rsx! {
        svg {
            class: "icon",
            width: "{size}",
            height: "{size}",
            view_box: "0 0 16 16",
            fill: "none",
            stroke: "currentColor",
            stroke_width: "1.5",
            stroke_linecap: "round",
            circle { cx: "7", cy: "7", r: "4" }
            line { x1: "10", y1: "10", x2: "13", y2: "13" }
        }
    }
}

#[component]
pub fn IconPlay(#[props(default = 16)] size: u32) -> Element {
    rsx! {
        svg {
            class: "icon",
            width: "{size}",
            height: "{size}",
            view_box: "0 0 16 16",
            fill: "currentColor",
            polygon { points: "4,2 13,8 4,14" }
        }
    }
}

#[component]
pub fn IconShield(#[props(default = 16)] size: u32) -> Element {
    rsx! {
        svg {
            class: "icon",
            width: "{size}",
            height: "{size}",
            view_box: "0 0 16 16",
            fill: "none",
            stroke: "currentColor",
            stroke_width: "1.5",
            stroke_linecap: "round",
            stroke_linejoin: "round",
            path { d: "M8 1.5L2.5 4v4c0 3.5 2.5 5.5 5.5 6.5 3-1 5.5-3 5.5-6.5V4L8 1.5z" }
            polyline { points: "5.5,8 7.5,10 10.5,6" }
        }
    }
}

#[component]
pub fn IconUsers(#[props(default = 16)] size: u32) -> Element {
    rsx! {
        svg {
            class: "icon",
            width: "{size}",
            height: "{size}",
            view_box: "0 0 16 16",
            fill: "none",
            stroke: "currentColor",
            stroke_width: "1.5",
            stroke_linecap: "round",
            circle { cx: "6", cy: "5", r: "2.5" }
            path { d: "M1.5 14c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5" }
            circle { cx: "11", cy: "5.5", r: "2" }
            path { d: "M14.5 14c0-2 -1.5-3.5-3.5-3.5" }
        }
    }
}

#[component]
pub fn IconBrain(#[props(default = 16)] size: u32) -> Element {
    rsx! {
        svg {
            class: "icon",
            width: "{size}",
            height: "{size}",
            view_box: "0 0 16 16",
            fill: "none",
            stroke: "currentColor",
            stroke_width: "1.5",
            stroke_linecap: "round",
            // Simple database/memory icon: three stacked ellipses
            ellipse { cx: "8", cy: "4", rx: "5", ry: "2" }
            path { d: "M3 4v4c0 1.1 2.2 2 5 2s5-.9 5-2V4" }
            path { d: "M3 8v4c0 1.1 2.2 2 5 2s5-.9 5-2V8" }
        }
    }
}

#[component]
pub fn IconCommand(#[props(default = 16)] size: u32) -> Element {
    rsx! {
        svg {
            class: "icon",
            width: "{size}",
            height: "{size}",
            view_box: "0 0 16 16",
            fill: "none",
            stroke: "currentColor",
            stroke_width: "1.5",
            stroke_linecap: "round",
            stroke_linejoin: "round",
            // Command/terminal prompt icon
            polyline { points: "2,4 6,8 2,12" }
            line { x1: "8", y1: "12", x2: "14", y2: "12" }
        }
    }
}

#[component]
pub fn IconSend(#[props(default = 16)] size: u32) -> Element {
    rsx! {
        svg {
            class: "icon",
            width: "{size}",
            height: "{size}",
            view_box: "0 0 16 16",
            fill: "currentColor",
            path { d: "M2 2l12 6-12 6 2-6-2-6z" }
        }
    }
}

#[component]
pub fn IconChevronDown(#[props(default = 16)] size: u32) -> Element {
    rsx! {
        svg {
            class: "icon",
            width: "{size}",
            height: "{size}",
            view_box: "0 0 16 16",
            fill: "none",
            stroke: "currentColor",
            stroke_width: "2",
            stroke_linecap: "round",
            stroke_linejoin: "round",
            polyline { points: "4,6 8,10 12,6" }
        }
    }
}

#[component]
pub fn IconCheck(#[props(default = 16)] size: u32) -> Element {
    rsx! {
        svg {
            class: "icon",
            width: "{size}",
            height: "{size}",
            view_box: "0 0 16 16",
            fill: "none",
            stroke: "currentColor",
            stroke_width: "2",
            stroke_linecap: "round",
            stroke_linejoin: "round",
            polyline { points: "3,8 6.5,11.5 13,4.5" }
        }
    }
}

#[component]
pub fn IconX(#[props(default = 16)] size: u32) -> Element {
    rsx! {
        svg {
            class: "icon",
            width: "{size}",
            height: "{size}",
            view_box: "0 0 16 16",
            fill: "none",
            stroke: "currentColor",
            stroke_width: "2",
            stroke_linecap: "round",
            line { x1: "4", y1: "4", x2: "12", y2: "12" }
            line { x1: "12", y1: "4", x2: "4", y2: "12" }
        }
    }
}

#[component]
pub fn IconChat(#[props(default = 16)] size: u32) -> Element {
    rsx! {
        svg {
            class: "icon",
            width: "{size}",
            height: "{size}",
            view_box: "0 0 16 16",
            fill: "none",
            stroke: "currentColor",
            stroke_width: "1.5",
            stroke_linecap: "round",
            stroke_linejoin: "round",
            path { d: "M2 3h12v8H5l-3 3V3z" }
        }
    }
}

#[component]
pub fn IconSpinner(#[props(default = 16)] size: u32) -> Element {
    rsx! {
        svg {
            class: "icon icon-spin",
            width: "{size}",
            height: "{size}",
            view_box: "0 0 16 16",
            fill: "none",
            stroke: "currentColor",
            stroke_width: "2",
            stroke_linecap: "round",
            // Three-quarter circle arc
            path { d: "M8 2a6 6 0 0 1 5.2 3" }
            path { d: "M14 8a6 6 0 0 1-3 5.2" }
            path { d: "M8 14a6 6 0 0 1-5.2-3" }
        }
    }
}

#[component]
pub fn IconRocket(#[props(default = 16)] size: u32) -> Element {
    rsx! {
        svg {
            class: "icon",
            width: "{size}",
            height: "{size}",
            view_box: "0 0 16 16",
            fill: "none",
            stroke: "currentColor",
            stroke_width: "1.5",
            stroke_linecap: "round",
            stroke_linejoin: "round",
            // Simple rocket
            path { d: "M8 1c0 0-5 4-5 9l2 2 3-1 3 1 2-2c0-5-5-9-5-9z" }
            circle { cx: "8", cy: "7", r: "1.5" }
        }
    }
}

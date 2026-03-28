//! 3D Mascot PiP — a tiny always-on-top transparent window that renders an
//! animated GLTF character via Three.js inside the wry/Chromium webview.
//!
//! Hotkey: Ctrl+Shift+M (toggle show/hide)
//! Window: 200×200 px, borderless, transparent, draggable, always-on-top.

// ── CSS ────────────────────────────────────────────────────────────

pub const MASCOT_STYLES: &str = r#"
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
        background: transparent;
        overflow: hidden;
    }

    .mascot-container {
        width: 100%;
        height: 100%;
        background: transparent;
        overflow: hidden;
        border-radius: 50%;
    }

    #mascot-canvas, #mascot-gl {
        width: 180px;
        height: 180px;
        margin: 10px;
    }
"#;

// ── Three.js scene HTML ────────────────────────────────────────────

pub const MASCOT_SCENE_HTML: &str = r#"<canvas id="mascot-gl"></canvas>
<script type="importmap">
{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.172.0/build/three.module.js" } }
</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.172.0/examples/jsm/loaders/GLTFLoader.js';

const canvas = document.getElementById('mascot-gl');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setSize(180, 180);
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 1, 3);
camera.lookAt(0, 0.8, 0);

const light = new THREE.DirectionalLight(0xffffff, 1.2);
light.position.set(2, 3, 2);
scene.add(light);
scene.add(new THREE.AmbientLight(0xe07b5a, 0.4)); // coral ambient

let mixer;
const loader = new GLTFLoader();
// Try to load a local .glb, fallback to a placeholder cube
try {
    loader.load('.cadet/mascot.glb', (gltf) => {
        scene.add(gltf.scene);
        gltf.scene.scale.set(0.8, 0.8, 0.8);
        if (gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(gltf.scene);
            mixer.clipAction(gltf.animations[0]).play();
        }
    });
} catch(e) {
    // Fallback: spinning cube
    const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const mat = new THREE.MeshStandardMaterial({ color: 0xe07b5a });
    const cube = new THREE.Mesh(geo, mat);
    cube.position.y = 0.8;
    scene.add(cube);
}

const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    if (mixer) mixer.update(clock.getDelta());
    renderer.render(scene, camera);
}
animate();
</script>"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mascot_scene_html_is_not_empty() {
        assert!(!MASCOT_SCENE_HTML.is_empty());
    }

    #[test]
    fn mascot_scene_html_contains_three_js_import() {
        assert!(
            MASCOT_SCENE_HTML.contains("three"),
            "expected Three.js reference in MASCOT_SCENE_HTML"
        );
    }

    #[test]
    fn mascot_scene_html_contains_gltf_loader() {
        assert!(
            MASCOT_SCENE_HTML.contains("GLTFLoader"),
            "expected GLTFLoader reference in MASCOT_SCENE_HTML"
        );
    }

    #[test]
    fn mascot_scene_html_contains_model_path() {
        assert!(
            MASCOT_SCENE_HTML.contains("mascot.glb"),
            "expected mascot.glb model path in MASCOT_SCENE_HTML"
        );
    }

    #[test]
    fn mascot_styles_contains_container_class() {
        assert!(
            MASCOT_STYLES.contains("mascot-container"),
            "expected .mascot-container in MASCOT_STYLES"
        );
    }
}

// ── Dioxus component ───────────────────────────────────────────────

#[cfg(feature = "desktop-ui")]
pub mod desktop {
    use super::*;
    use crate::widget::WidgetBridge;
    use dioxus::prelude::*;
    use dioxus_desktop::{Config, LogicalSize, WindowBuilder};

    #[cfg(target_os = "macos")]
    use dioxus_desktop::tao::platform::macos::WindowBuilderExtMacOS;

    /// Build the `Config` for the mascot PiP window.
    pub fn mascot_window_config() -> Config {
        let mut wb = WindowBuilder::new()
            .with_title("Cadet Mascot")
            .with_decorations(false)
            .with_transparent(true)
            .with_always_on_top(true)
            .with_resizable(false)
            .with_inner_size(LogicalSize::new(200.0, 200.0));

        #[cfg(target_os = "macos")]
        {
            wb = wb
                .with_titlebar_hidden(true)
                .with_fullsize_content_view(true)
                .with_has_shadow(false);
        }

        Config::new()
            .with_window(wb)
            .with_background_color((0, 0, 0, 0))
    }

    // PartialEq for WidgetBridge is already implemented in widget::desktop.
    // We implement it here for Props derivation within this module scope.

    #[derive(Props, Clone, PartialEq)]
    pub struct MascotWidgetProps {
        pub bridge: WidgetBridge,
    }

    #[component]
    pub fn MascotWidget(props: MascotWidgetProps) -> Element {
        let _bridge = props.bridge;

        rsx! {
            style { "{MASCOT_STYLES}" }
            div { class: "mascot-container",
                div {
                    id: "mascot-canvas",
                    dangerous_inner_html: MASCOT_SCENE_HTML,
                }
            }
        }
    }
}

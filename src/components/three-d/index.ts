/**
 * 3D component library — premium depth primitives for the spatial UI system.
 *
 * These complement the existing motion/depth system (DepthStage, DepthLayer,
 * SpotlightCard, MagneticButton) with additional 3D-first components:
 *
 * - TiltCard: physical cursor-tilt card with dynamic shadow + internal parallax
 * - DimensionalText: 3D typography with extrusion + gradient lighting
 * - Glass3D: enhanced glass surface with inner highlights + reflections
 * - SpatialLoader: branded 3D loading experience
 * - ParallaxLayers: multi-layer scroll parallax for section backgrounds
 */
export { TiltCard, TiltLayer, type TiltCardProps } from "./TiltCard";
export { DimensionalText, type DimensionalTextProps } from "./DimensionalText";
export { Glass3D, type Glass3DProps } from "./Glass3D";
export { SpatialLoader, SpatialLoaderOverlay, type SpatialLoaderProps } from "./SpatialLoader";
export { ParallaxLayers, type ParallaxLayersProps } from "./ParallaxLayers";

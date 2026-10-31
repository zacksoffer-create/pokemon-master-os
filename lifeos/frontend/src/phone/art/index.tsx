// Illustration components for the phone app. (Placeholders; the real art replaces these with the same props.)
import React from "react";
import type { Look, Mood } from "../api";

export type PortraitProps = { look?: Look | null; size?: number; mood?: Mood; color?: string; name?: string; ring?: string; shirt?: string; jersey?: number | null };
export function Portrait({ size = 56, color = "#8aa", name }: PortraitProps) {
  return <div style={{ width: size, height: size, borderRadius: "50%", background: color, display: "grid", placeItems: "center", color: "#fff", fontWeight: 800 }}>{(name || "?").slice(0, 1)}</div>;
}
export type SceneProps = { art: string; season?: string; phase?: string; className?: string; children?: React.ReactNode };
export function Scene({ className, children }: SceneProps) {
  return <div className={className} style={{ position: "relative", background: "linear-gradient(#9cd3ff,#ffe9c7)", minHeight: 220 }}>{children}</div>;
}
export type PetArtProps = { species: string; coat?: string; breed?: string; mood?: string; size?: number };
export function PetArt({ size = 96 }: PetArtProps) {
  return <div style={{ width: size, height: size, borderRadius: 20, background: "#e9d3b0" }} />;
}

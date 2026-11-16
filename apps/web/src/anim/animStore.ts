import { create } from 'zustand';
import type { Banner, Ghost } from './plan.ts';

export type Point = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

export type Flight = {
  readonly id: number;
  readonly ghost: Ghost;
  readonly from: Point;
  readonly to: Point;
  readonly delay: number;
  readonly duration: number;
};

type AnimState = {
  readonly flights: readonly Flight[];
  readonly banner: (Banner & { readonly id: number }) | null;
};

export const useAnim = create<AnimState>()(() => ({ flights: [], banner: null }));

let counter = 0;
export const nextAnimId = (): number => ++counter;

export const addFlights = (flights: readonly Flight[]): void =>
  useAnim.setState((s) => ({ flights: [...s.flights, ...flights] }));

export const removeFlight = (id: number): void =>
  useAnim.setState((s) => ({ flights: s.flights.filter((f) => f.id !== id) }));

export const showBanner = (banner: Banner): void =>
  useAnim.setState({ banner: { ...banner, id: nextAnimId() } });

export const hideBanner = (id: number): void =>
  useAnim.setState((s) => (s.banner?.id === id ? { banner: null } : s));

export const prefersReducedMotion = (): boolean =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

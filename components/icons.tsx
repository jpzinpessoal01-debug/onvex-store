import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps) => ({
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...props,
});

export function SearchIcon(props: IconProps) {
  return <svg {...base(props)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
}
export function UserIcon(props: IconProps) {
  return <svg {...base(props)}><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20c.8-4 3.3-6 7.5-6s6.7 2 7.5 6" /></svg>;
}
export function HeartIcon(props: IconProps) {
  return <svg {...base(props)}><path d="M20.8 4.8c-2-2-5.2-2-7.2 0L12 6.4l-1.6-1.6c-2-2-5.2-2-7.2 0s-2 5.2 0 7.2l8.8 8.4 8.8-8.4c2-2 2-5.2 0-7.2Z" /></svg>;
}
export function CartIcon(props: IconProps) {
  return <svg {...base(props)}><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.5a2 2 0 0 0 1.9-1.4L20 8H6" /><circle cx="9" cy="20" r="1" /><circle cx="17" cy="20" r="1" /></svg>;
}
export function MenuIcon(props: IconProps) {
  return <svg {...base(props)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
}
export function CloseIcon(props: IconProps) {
  return <svg {...base(props)}><path d="m6 6 12 12M18 6 6 18" /></svg>;
}
export function ArrowRightIcon(props: IconProps) {
  return <svg {...base(props)}><path d="M5 12h14M14 7l5 5-5 5" /></svg>;
}
export function ChevronDownIcon(props: IconProps) {
  return <svg {...base(props)}><path d="m7 10 5 5 5-5" /></svg>;
}
export function TruckIcon(props: IconProps) {
  return <svg {...base(props)}><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></svg>;
}
export function ShieldIcon(props: IconProps) {
  return <svg {...base(props)}><path d="M12 3 5 6v5c0 4.5 2.8 8 7 10 4.2-2 7-5.5 7-10V6z" /><path d="m9 12 2 2 4-4" /></svg>;
}
export function RotateIcon(props: IconProps) {
  return <svg {...base(props)}><path d="M20 7v5h-5" /><path d="M19 12a7 7 0 1 1-2-5" /></svg>;
}
export function BoxIcon(props: IconProps) {
  return <svg {...base(props)}><path d="m4 7 8-4 8 4-8 4z" /><path d="M4 7v10l8 4 8-4V7M12 11v10" /></svg>;
}


import {
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  Target,
  X,
} from "lucide-react";

// App chrome icons, all from one set (lucide). width/height props still
// override the default size at call sites.
const base = { "aria-hidden": true, size: 26, strokeWidth: 1.9 };
const small = { size: 22, strokeWidth: 2.2 };

export function ListIcon(props) {
  return <List {...base} {...props} />;
}
export function ChartIcon(props) {
  return <ChartColumn {...base} {...props} />;
}
export function TargetIcon(props) {
  return <Target {...base} {...props} />;
}
export function MoreIcon(props) {
  return <Ellipsis {...base} {...props} />;
}
export function PlusIcon(props) {
  return <Plus {...base} strokeWidth={2.4} {...props} />;
}
export function ChevronLeftIcon(props) {
  return <ChevronLeft {...base} {...small} {...props} />;
}
export function ChevronRightIcon(props) {
  return <ChevronRight {...base} {...small} {...props} />;
}
export function CloseIcon(props) {
  return <X {...base} {...small} {...props} />;
}
export function SearchIcon(props) {
  return <Search {...base} {...small} {...props} />;
}
export function FilterIcon(props) {
  return <SlidersHorizontal {...base} {...small} {...props} />;
}

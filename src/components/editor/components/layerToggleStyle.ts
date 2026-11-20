// Lock and visibility toggles in the layer lists (desktop sidebar and mobile
// toolbar). The default state (unlocked, visible) stays quiet so it does not
// read as "on"; only the exception (locked, hidden) is marked, with the same
// grey the rows use on hover rather than a bright fill that looks like a
// selection.
export function layerToggleClass(active: boolean): string {
  return active
    ? 'bg-[#444444] text-gray-100 hover:bg-[#4d4d4d]'
    : 'text-gray-500 hover:bg-[#444444] hover:text-gray-300';
}

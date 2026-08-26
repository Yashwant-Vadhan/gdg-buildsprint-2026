// Per-role accent colors for the admin/committee side. Uses literal Tailwind
// color classes rather than the `bg-brand` custom-property token — that token
// resolves to transparent for admin pages (verified: --color-brand computes
// empty even though --theme-color is correctly set on the .theme-* wrapper).
// Worth flagging to Sushil since it likely affects the student side too.
export const ACCENT_BY_ROLE = {
  canteen_admin: {
    bg: 'bg-red-600',
    bgHover: 'hover:bg-red-700',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-red-400 dark:border-red-700',
    ring: 'focus:border-red-500',
  },
  store_admin: {
    bg: 'bg-orange-600',
    bgHover: 'hover:bg-orange-700',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-400 dark:border-orange-700',
    ring: 'focus:border-orange-500',
  },
  laundry_admin: {
    bg: 'bg-blue-600',
    bgHover: 'hover:bg-blue-700',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-400 dark:border-blue-700',
    ring: 'focus:border-blue-500',
  },
  hostel_committee: {
    bg: 'bg-indigo-600',
    bgHover: 'hover:bg-indigo-700',
    text: 'text-indigo-600 dark:text-indigo-400',
    border: 'border-indigo-400 dark:border-indigo-700',
    ring: 'focus:border-indigo-500',
  },
};

export const DEFAULT_ACCENT = ACCENT_BY_ROLE.canteen_admin;
